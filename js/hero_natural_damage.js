// C uhitm.c:damageum() and the hero-attacker branches of mhitm_adtyping();
// the mhitm_ad_fire(), mhitm_ad_cold(), mhitm_ad_elec(), mhitm_ad_drli(),
// mhitm_ad_blnd(), mhitm_ad_ench(), mhitm_ad_stun() and mhitm_ad_legs()
// branches live in uhitm.ts with those functions' other actor branches.
import { formatFeltMessage } from './hero_speech.js';
import { artifactById, monsterHasArtifactDefense } from './artifacts.js';
import { exerciseWisdom } from './attrib.js';
import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, MSLOW, STRAT_WAITFORU, W_ARM, W_ARMH, } from './const.js';
import { canSeeMonster, shieldeff } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game, requirePlayingGame } from './gstate.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { applyHeroNaturalBrain } from './hero_natural_brain.js';
import { applyHeroNaturalGrip } from './hero_natural_grip.js';
import { applyHeroNaturalPolymorph } from './hero_natural_polymorph.js';
import { applyHeroNaturalSliming } from './hero_natural_sliming.js';
import { applyHeroNaturalTheft } from './hero_natural_theft.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { specialAttackNegated } from './magic_negation.js';
import { normalDemon } from './minion.js';
import { makemonNear } from './mklev.js';
import { paralyzeMonster } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_DRDX, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPC1, AD_SPC2, AD_SPEL, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_CLAW, AT_GAZE, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL, monsterIsUndead, } from './monster_data.js';
import { mhitmAdBlnd, mhitmAdCold, mhitmAdDrli, mhitmAdEnch, mhitmAdElec, mhitmAdFire, mhitmAdLegs, mhitmAdStun, physicalDamage, } from './uhitm.js';
import { drainMonsterEnergy } from './mhitm.js';
import { teleportMonsterByHero } from './monster_magic_response.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterResistsSleep, putMonsterToSleep } from './monster_sleep.js';
import { sessionIsNight } from './monster_sound.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { OBJECT_NAMES } from './object_data.js';
import { erodeArmor } from './object_erosion.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { cansee } from './vision.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance } from './mondata.js';
import { tameMonster } from './dog.js';
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_METALLIVORE = 0x80000000;
const M2_DEMON = 0x00000100;
const S_FUNGUS = 32;
const S_TROLL = 46;
const BLUE_DRAGON_SCALES = OBJECT_NAMES.indexOf('blue dragon scales');
const BLUE_DRAGON_SCALE_MAIL = OBJECT_NAMES.indexOf('blue dragon scale mail');
const GREEN_DRAGON_SCALES = OBJECT_NAMES.indexOf('green dragon scales');
const GREEN_DRAGON_SCALE_MAIL = OBJECT_NAMES.indexOf('green dragon scale mail');
export async function resolveHeroNaturalDamage(monster, attack, specialDamage, { state = game, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, target = { x: monster.mx, y: monster.my }, } = {}) {
    requirePlayingGame(state);
    const context = {
        state, publish, random, rollDice, rollOne, target, attack, specialDamage,
        damage: rollDice(attack[2], attack[3]),
    };
    if (await summonDemonPet(context))
        return { nativeResult: M_ATTK_MISS, heroDied: !!state.program_state.gameover };
    const effect = await applyNaturalEffect(monster, context);
    const result = {
        nativeResult: effect.nativeResult, heroDied: effect.heroDied,
    };
    if (effect.skipBrainDrain !== undefined)
        result.skipBrainDrain = effect.skipBrainDrain;
    if (effect.heroDied || effect.done)
        return result;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    monster.mhp -= effect.damage;
    if (monster.dead || monster.mhp <= 0) {
        const death = { publish };
        const weapon = state.uwep || state.u.uwep;
        death.noRevive = (attack[0] === AT_WEAP || attack[0] === AT_CLAW)
            && MONSTER_SYMBOL[monster.mnum] === S_TROLL
            && artifactById(weapon?.oartifact, state)?.enumName === 'TROLLSBANE';
        if (monster.mtame && !cansee(monster.mx, monster.my)) {
            await publish(formatFeltMessage('embarrassed for a moment.', state));
            death.showKillMessage = false;
        }
        else if (!state.flags.verbose) {
            await publish('You destroy it!');
            death.showKillMessage = false;
        }
        // Zero means that the effect already dispatched the native death.
        if (effect.damage)
            await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, death);
        return { ...result, nativeResult: M_ATTK_DEF_DIED, heroDied: !!state.program_state.gameover };
    }
    return { ...result, nativeResult: M_ATTK_HIT };
}
async function applyNaturalEffect(monster, context) {
    const { state, publish, attack, random, rollOne } = context;
    let damage = context.damage;
    switch (attack[1]) {
        case AD_STUN: {
            // C uhitm.c:mhitm_ad_stun() uhitm branch now owns the stun attack.
            const stun = await mhitmAdStun({ magr: 'youmonst', defender: monster, context });
            damage = stun.damage;
            break;
        }
        case AD_PHYS:
        case AD_WERE:
        case AD_HEAL:
            damage = physicalDamage(monster, context);
            break;
        case AD_LEGS: {
            // C uhitm.c:mhitm_ad_legs() uhitm branch reduces to mhitm_ad_phys().
            const legs = await mhitmAdLegs({ magr: 'youmonst', defender: monster, context });
            damage = legs.damage;
            break;
        }
        case AD_FIRE: {
            // C uhitm.c:mhitm_ad_fire() uhitm branch now owns the fire attack.
            const fire = await mhitmAdFire({ magr: 'youmonst', defender: monster, context });
            damage = fire.damage;
            break;
        }
        case AD_COLD: {
            // C uhitm.c:mhitm_ad_cold() uhitm branch now owns the cold attack.
            const cold = await mhitmAdCold({ magr: 'youmonst', defender: monster, context });
            damage = cold.damage;
            break;
        }
        case AD_ELEC: {
            // C uhitm.c:mhitm_ad_elec() uhitm branch now owns the electric attack.
            const electric = await mhitmAdElec({ magr: 'youmonst', defender: monster, context });
            damage = electric.damage;
            break;
        }
        case AD_ACID:
            if (monsterHasAcidResistance(monster) || monsterHasArtifactDefense(monster, 'acid', state))
                damage = 0;
            break;
        case AD_RUST:
        case AD_CORR:
        case AD_DCAY:
            await erodeNaturalTarget(monster, context);
            damage = 0;
            break;
        case AD_CURS:
            await curseNaturalTarget(monster, context);
            damage = 0;
            break;
        case AD_DETH:
            if (monsterIsUndead(monster.mnum) && damage > 1)
                damage = rollOne(Math.trunc(damage / 2));
            // C uhitm.c:mhitm_ad_deth() redirects its hero branch to
            // mhitm_ad_drli(), which lives in uhitm.ts.
            damage = (await mhitmAdDrli({
                magr: 'youmonst', defender: monster, context: { ...context, damage },
            })).damage;
            break;
        case AD_DRLI:
            // C uhitm.c:mhitm_ad_drli() uhitm branch now owns the drain attack.
            damage = (await mhitmAdDrli({ magr: 'youmonst', defender: monster, context })).damage;
            break;
        case AD_DREN:
            if (!await negated(monster, context, false) && !random(4))
                await drainMonsterEnergy(monster, context);
            damage = 0;
            break;
        case AD_DRST:
        case AD_DRDX:
        case AD_DRCO:
            damage = await poisonNaturalTarget(monster, context);
            break;
        case AD_PLYS:
            if (!random(3) && damage < monster.mhp && !await negated(monster, context, true)) {
                if (!heroIsBlind(state))
                    await publish(`${subject(monster, context)} is frozen by you!`);
                paralyzeMonster(monster, rollOne(10));
            }
            break;
        case AD_SLEE:
            await sleepNaturalTarget(monster, context);
            break;
        case AD_SLOW:
            await slowNaturalTarget(monster, context);
            break;
        case AD_BLND: {
            // C uhitm.c:mhitm_ad_blnd() uhitm branch now owns the blinding.
            const blnd = await mhitmAdBlnd({ magr: 'youmonst', defender: monster, context });
            damage = blnd.damage;
            break;
        }
        case AD_CONF:
            if (!monster.mconf) {
                if (canSeeMonster(monster))
                    await publish(`${subject(monster, context)} looks confused.`);
                monster.mconf = 1;
            }
            break;
        case AD_TLPT:
            damage = await teleportNaturalTarget(monster, context);
            break;
        case AD_STON:
            await petrifyNaturalTarget(monster, context);
            damage = 0;
            break;
        case AD_SGLD:
        case AD_SITM:
        case AD_SEDU:
        case AD_SSEX:
            return applyHeroNaturalTheft(monster, context);
        case AD_DRIN:
            return applyHeroNaturalBrain(monster, context);
        case AD_STCK:
        case AD_WRAP:
            return applyHeroNaturalGrip(monster, context);
        case AD_POLY:
            return applyHeroNaturalPolymorph(monster, context);
        case AD_SLIM:
            return applyHeroNaturalSliming(monster, context);
        case AD_DISE:
        case AD_PEST:
            if (MONSTER_SYMBOL[monster.mnum] === S_FUNGUS || speciesIs(monster, 'ghoul')
                || wearsDragonDefense(monster, 'green dragon', GREEN_DRAGON_SCALES, GREEN_DRAGON_SCALE_MAIL))
                damage = 0;
            break;
        case AD_FAMN:
            if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & (M1_CARNIVORE | M1_HERBIVORE | M1_METALLIVORE)))
                damage = 0;
            break;
        case AD_ENCH: {
            // C uhitm.c:mhitm_ad_ench() uhitm branch has no armor selection.
            const ench = await mhitmAdEnch({ magr: 'youmonst', defender: monster, context });
            damage = ench.damage;
            break;
        }
        case AD_DGST:
        case AD_HALU:
        case AD_SAMU:
        case AD_MAGM:
        case AD_DISN:
        case AD_SPC1:
        case AD_SPC2:
        case AD_CLRC:
        case AD_SPEL:
        case AD_RBRE:
            damage = 0;
            break;
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: !!state.program_state.gameover };
}
// C uhitm.c:demonpet().
async function summonDemonPet(context) {
    const { state, random, publish } = context;
    const species = heroSpecies(state);
    if (!((MONSTER_FLAGS2[species] ?? 0) & M2_DEMON) || random(13)
        || state.uwep || state.u.uwep || species === MONSTER_NAME.indexOf('amorous demon')
        || species === MONSTER_NAME.indexOf('balrog'))
        return false;
    await publish('Some hell-p has arrived!');
    const summonedSpecies = !random(6) ? normalDemon(state.u.ualign.type) : null;
    const pet = await makemonNear(summonedSpecies ?? species, state.u.ux, state.u.uy);
    if (pet)
        await tameMonster(pet, null, { state });
    exerciseWisdom(true, state);
    return true;
}
async function erodeNaturalTarget(monster, context) {
    const { attack, state, publish, random } = context;
    if (attack[1] === AD_RUST && speciesIs(monster, 'iron golem')
        || attack[1] === AD_DCAY && (speciesIs(monster, 'wood golem') || speciesIs(monster, 'leather golem'))) {
        await publish(`${subject(monster, context)} ${wornMonsterLifeSaver(monster) ? 'starts to fall' : 'falls'} to pieces!`);
        await killNaturalTarget(monster, context);
    }
    if (!state.program_state.gameover)
        await erodeArmor(monster, attack[1] === AD_RUST ? 'rust' : attack[1] === AD_CORR ? 'corrosion' : 'rot', { state, publish, random });
}
async function curseNaturalTarget(monster, context) {
    const { state, publish, random } = context;
    if (!sessionIsNight(state.datetime) || random(10) || monster.mcan)
        return;
    if (speciesIs(monster, 'clay golem')) {
        if (!heroIsBlind(state))
            await publish(`Some writing vanishes from ${possessiveName(monsterName(monster, { state }))} head!`);
        await killNaturalTarget(monster, context);
    }
    else {
        monster.mcan = 1;
        await publish('You chuckle.');
    }
}
async function poisonNaturalTarget(monster, context) {
    const { state, attack, random, publish } = context;
    let damage = context.damage;
    if (await negated(monster, context, false) || random(8))
        return damage;
    const weapon = state.uwep || state.u.uwep;
    const method = attack[0];
    const noun = method === AT_WEAP ? weapon?.opoisoned ? 'weapon' : 'attack'
        : method === AT_TUCH ? 'contact' : method === AT_GAZE ? 'gaze' : method === AT_BITE ? 'bite' : 'sting';
    await publish(`Your ${noun} was poisoned!`);
    if (monsterHasPoisonResistance(monster)) {
        await publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
    }
    else if (!random(10)) {
        await publish('Your poison was deadly...');
        damage = monster.mhp;
    }
    else
        damage += 6 + random(10);
    return damage;
}
async function sleepNaturalTarget(monster, context) {
    const { state, publish, rollOne } = context;
    if (monster.msleeping || await negated(monster, context, false))
        return;
    const duration = rollOne(10);
    if (monsterResistsSleep(monster) || monsterHasArtifactDefense(monster, 'sleep', state)) {
        await shieldeff(monster.mx, monster.my, state);
        return;
    }
    if (!await putMonsterToSleep(monster, duration))
        return;
    if (!heroIsBlind(state))
        await publish(`${subject(monster, context)} is put to sleep by you!`);
    if (state.u.ustuck === monster && !state.u.uswallow && !heroFormSticks(state)) {
        await publish(`${possessiveName(subject(monster, context))} grip relaxes.`);
        await releaseHeroFromMonster(monster, { state, publish, rollOne });
    }
}
async function slowNaturalTarget(monster, context) {
    const blocked = await negated(monster, context, false);
    if (blocked || monster.mspeed === MSLOW
        || wearsDragonDefense(monster, 'blue dragon', BLUE_DRAGON_SCALES, BLUE_DRAGON_SCALE_MAIL))
        return;
    const speed = adjustMonsterSpeed(monster, -1);
    // mon_adjust_speed() announces the change before mhitm_ad_slow() does.
    const seen = canSeeMonster(monster);
    const message = seen ? monsterSpeedMessage(speed, subject(monster, context), context.state) : null;
    if (message)
        await context.publish(message);
    if (speed.changed && seen)
        await context.publish(`${subject(monster, context)} slows down.`);
}
async function teleportNaturalTarget(monster, context) {
    const { state, publish } = context;
    let damage = Math.max(1, context.damage);
    if (await negated(monster, context, true)) {
        await publish(`${subject(monster, context)} is not affected.`);
        return damage;
    }
    const name = subject(monster, context);
    const wasSeen = canSeeMonster(monster) || !!state.u.uswallow && state.u.ustuck === monster;
    if (await teleportMonsterByHero(monster, { state, giveFeedback: false })
        && wasSeen && !(canSeeMonster(monster) || state.u.uswallow && state.u.ustuck === monster))
        await publish(`${name} suddenly disappears!`);
    if (damage >= monster.mhp) {
        if (monster.mhp === 1)
            monster.mhp++;
        damage = monster.mhp - 1;
    }
    return damage;
}
async function petrifyNaturalTarget(monster, context) {
    await petrifyMonsterFromContact(monster, {
        state: context.state, publish: context.publish, rollOne: context.rollOne, creditHero: true,
        finishDeath: (target, death) => finishHeroMonsterKillOutcome(target, target.mx, target.my, {
            ...death, publish: context.publish, showKillMessage: false,
            recordConduct: !death?.noCorpse,
        }),
    });
}
async function negated(monster, { state, random, publish }, tell) {
    const blocked = specialAttackNegated(state.u, monster, { state, random });
    if (blocked && tell && canSeeMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} avoids harm.`);
    return blocked;
}
function wearsDragonDefense(monster, species, scales, mail) {
    return speciesIs(monster, species) || (monster.minvent ?? []).some(object => ((object.owornmask ?? 0) & W_ARM) && (object.otyp === scales || object.otyp === mail));
}
function speciesIs(monster, species) {
    return MONSTER_NAME[monster.mnum] === species;
}
function subject(monster, { state }) {
    return monsterName(monster, { state, capitalized: true });
}
async function killNaturalTarget(monster, context, options = {}) {
    await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...options, showKillMessage: false, publish: context.publish,
    });
}
//# sourceMappingURL=hero_natural_damage.js.map