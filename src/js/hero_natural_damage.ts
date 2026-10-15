// C uhitm.c:damageum() and the hero-attacker branches of mhitm_adtyping().
import { formatFeltMessage } from './hero_speech.js';
import { artifactById, monsterHasArtifactDefense } from './artifacts.js';
import { exerciseWisdom } from './attrib.js';
import { monsterResistsBlindingLight } from './blinding_attack.js';
import {
    M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, MSLOW, STRAT_WAITFORU, W_ARM, W_ARMH,
} from './const.js';
import { canSeeMonster, plineWithContinuation, shieldeff } from './display.js';
import type { MessagePublisher } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { applyHeroNaturalBrain } from './hero_natural_brain.js';
import { applyHeroNaturalGrip } from './hero_natural_grip.js';
import { applyHeroNaturalPolymorph } from './hero_natural_polymorph.js';
import { applyHeroNaturalSliming } from './hero_natural_sliming.js';
import { applyHeroNaturalTheft } from './hero_natural_theft.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { igniteItems } from './light.js';
import { specialAttackNegated } from './magic_negation.js';
import { normalDemon } from './minion.js';
import { makemonNear } from './mklev.js';
import { applyMonsterGolemEffects, paralyzeMonster } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import {
    AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY,
    AD_DETH, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DREN, AD_DRIN, AD_DRLI,
    AD_DRST, AD_DRDX, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL,
    AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST,
    AD_SAMU, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPC1,
    AD_SPC2, AD_SPEL, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE,
    AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE,
    AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsNonliving, monsterIsShade, monsterIsUndead,
} from './monster_data.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { drainMonsterEnergy } from './monster_energy.js';
import { staggerVerb } from './monster_hurtle.js';
import { teleportMonsterByHero } from './monster_magic_response.js';
import { monsterName, possessiveName } from './monster_name.js';
import {
    monsterHasAcidResistance, monsterHasColdResistance, monsterHasDrainResistance,
    monsterHasFireResistance, monsterHasPoisonResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { monsterResistsSleep, putMonsterToSleep } from './monster_sleep.js';
import { sessionIsNight } from './monster_sound.js';
import { adjustMonsterSpeed } from './monster_speed.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { tameMonster } from './monster_taming.js';
import { OBJECT_DESCRIPTIONS, OBJECT_NAMES } from './object_data.js';
import { erodeArmor } from './object_erosion.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { cansee } from './vision.js';
import { destroyMonsterInventoryByElement } from './zap.js';
import type { GameState } from './game_state.js';
import type { HeroMonsterKillOptions } from './hero_monster_death.js';
import type {
    HeroNaturalDamageResult, HeroNaturalEffectContext, HeroNaturalEffectResult,
} from './hero_natural_types.js';
import type { Position } from './map_types.js';
import type { AttackTuple } from './monster_action_types.js';
import type { Monster } from './monster_types.js';

const M1_NOEYES = 0x00001000;
const M1_THICK_HIDE = 0x00200000;
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

interface HeroNaturalDamageOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    target?: Position;
}

export async function resolveHeroNaturalDamage(
    monster: Monster, attack: AttackTuple, specialDamage: number,
    {
        state = game, publish = plineWithContinuation, random = rn2,
        rollDice = d, rollOne = rnd, target = { x: monster.mx, y: monster.my },
    }: HeroNaturalDamageOptions = {},
): Promise<HeroNaturalDamageResult> {
    requirePlayingGame(state);
    const context: HeroNaturalEffectContext = {
        state, publish, random, rollDice, rollOne, target, attack, specialDamage,
        damage: rollDice(attack[2], attack[3]),
    };
    if (await summonDemonPet(context))
        return { nativeResult: M_ATTK_MISS, heroDied: !!state.program_state.gameover };

    const effect = await applyNaturalEffect(monster, context);
    const result: HeroNaturalDamageResult = {
        nativeResult: effect.nativeResult, heroDied: effect.heroDied,
    };
    if (effect.skipBrainDrain !== undefined) result.skipBrainDrain = effect.skipBrainDrain;
    if (effect.heroDied || effect.done) return result;

    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    monster.mhp -= effect.damage;
    if (monster.dead || monster.mhp <= 0) {
        const death: HeroMonsterKillOptions = { publish };
        const weapon = state.uwep || state.u.uwep;
        death.noRevive = (attack[0] === AT_WEAP || attack[0] === AT_CLAW)
            && MONSTER_SYMBOL[monster.mnum] === S_TROLL
            && artifactById(weapon?.oartifact, state)?.enumName === 'TROLLSBANE';
        if (monster.mtame && !cansee(monster.mx, monster.my)) {
            await publish(formatFeltMessage('embarrassed for a moment.', state));
            death.showKillMessage = false;
        } else if (!state.flags.verbose) {
            await publish('You destroy it!');
            death.showKillMessage = false;
        }
        // Zero means that the effect already dispatched the native death.
        if (effect.damage) await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, death);
        return { ...result, nativeResult: M_ATTK_DEF_DIED, heroDied: !!state.program_state.gameover };
    }
    return { ...result, nativeResult: M_ATTK_HIT };
}

async function applyNaturalEffect(monster: Monster, context: HeroNaturalEffectContext): Promise<HeroNaturalEffectResult> {
    const { state, publish, attack, random, rollOne } = context;
    let damage = context.damage;
    switch (attack[1]) {
    case AD_STUN:
        if (!heroIsBlind(state))
            await publish(`${subject(monster, context)} ${staggerVerb(monster.mnum)} for a moment.`);
        monster.mstun = 1;
        damage = physicalDamage(monster, context);
        break;
    case AD_PHYS:
    case AD_WERE:
    case AD_HEAL:
    case AD_LEGS:
        damage = physicalDamage(monster, context);
        break;
    case AD_FIRE:
    case AD_COLD:
    case AD_ELEC:
        damage = await elementalDamage(monster, context);
        break;
    case AD_ACID:
        if (monsterHasAcidResistance(monster) || monsterHasArtifactDefense(monster, 'acid', state)) damage = 0;
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
        damage = await drainLife(monster, { ...context, damage });
        break;
    case AD_DRLI:
        damage = await drainLife(monster, context);
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
            if (!heroIsBlind(state)) await publish(`${subject(monster, context)} is frozen by you!`);
            paralyzeMonster(monster, rollOne(10));
        }
        break;
    case AD_SLEE:
        await sleepNaturalTarget(monster, context);
        break;
    case AD_SLOW:
        await slowNaturalTarget(monster, context);
        break;
    case AD_BLND:
        if (naturalAttackCanBlind(monster, context)) {
            if (!heroIsBlind(state) && monster.mcansee)
                await publish(`${subject(monster, context)} is blinded.`);
            monster.mcansee = 0;
            monster.mblinded = Math.min(127, damage + (monster.mblinded ?? 0));
        }
        damage = 0;
        break;
    case AD_CONF:
        if (!monster.mconf) {
            if (canSeeMonster(monster)) await publish(`${subject(monster, context)} looks confused.`);
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
        if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & (M1_CARNIVORE | M1_HERBIVORE | M1_METALLIVORE))) damage = 0;
        break;
    case AD_ENCH:
        break;
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

async function summonDemonPet(context: HeroNaturalEffectContext): Promise<boolean> {
    const { state, random, publish } = context;
    const species = heroSpecies(state);
    if (!((MONSTER_FLAGS2[species] ?? 0) & M2_DEMON) || random(13)
        || state.uwep || state.u.uwep || species === MONSTER_NAME.indexOf('amorous demon')
        || species === MONSTER_NAME.indexOf('balrog')) return false;
    await publish('Some hell-p has arrived!');
    const summonedSpecies = !random(6) ? normalDemon(state.u.ualign.type) : null;
    const pet = await makemonNear(summonedSpecies ?? species, state.u.ux, state.u.uy);
    if (pet) await tameMonster(pet, null, { state });
    exerciseWisdom(true, state);
    return true;
}

function physicalDamage(monster: Monster, { state, damage, attack, specialDamage }: HeroNaturalEffectContext): number {
    if (monsterIsShade(monster)) damage = 0;
    damage += specialDamage;
    if (attack[0] === AT_WEAP) return 0;
    if ([AT_KICK, AT_CLAW, AT_TUCH, AT_HUGS].includes(attack[0])) {
        if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_THICK_HIDE)
            damage = attack[0] === AT_KICK ? 0 : Math.trunc((damage + 1) / 2);
        const bonus = state.u.udaminc ?? 0;
        if (bonus > 0) damage += bonus;
        else if (damage > 0) damage = Math.max(1, damage + bonus);
    }
    return damage;
}

async function elementalDamage(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, publish, attack, random, rollOne } = context;
    if (await negated(monster, context, true)) return 0;
    const type = attack[1];
    let damage = context.damage;
    const blind = heroIsBlind(state);
    const fire = type === AD_FIRE;
    const cold = type === AD_COLD;
    if (!blind) await publish(`${subject(monster, context)} is ${fire
        ? monsterFireDescription(monster, attack[0]) : cold ? 'covered in frost' : 'zapped'}!`);
    if (fire && (speciesIs(monster, 'paper golem') || speciesIs(monster, 'straw golem'))) {
        if (blind) await publish(`You smell burning ${speciesIs(monster, 'paper golem') ? 'paper' : 'straw'}.`);
        else await publish(`${subject(monster, context)} ${wornMonsterLifeSaver(monster)
            ? 'is totally engulfed in flames' : 'burns completely'}!`);
        await killNaturalTarget(monster, context, { noCorpse: true });
        return 0;
    }
    const resisted = fire ? monsterHasFireResistance(monster)
        : cold ? monsterHasColdResistance(monster) : monsterHasShockResistance(monster);
    if (resisted) {
        if (cold) await shieldeff(monster.mx, monster.my, state);
        if (!blind) await publish(`The ${fire ? 'fire' : cold ? 'frost' : 'zap'} doesn't ${fire ? 'heat' : cold ? 'chill' : 'shock'} ${monsterName(monster, { state })}!`);
        await applyMonsterGolemEffects(monster, type, damage, { state, publish });
        if (!cold) await shieldeff(monster.mx, monster.my, state);
        damage = 0;
    }
    damage += await destroyMonsterInventoryByElement(monster, fire ? 'fire' : cold ? 'cold' : 'electric', context.damage, {
        state, publish, random, rollOne, visible: canSeeMonster(monster),
    });
    if (fire) await igniteItems(monster.minvent, {
        state, publish, random, carrier: monster, visible: canSeeMonster(monster),
    });
    return damage;
}

async function erodeNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { attack, state, publish, random } = context;
    if (attack[1] === AD_RUST && speciesIs(monster, 'iron golem')
        || attack[1] === AD_DCAY && (speciesIs(monster, 'wood golem') || speciesIs(monster, 'leather golem'))) {
        await publish(`${subject(monster, context)} ${wornMonsterLifeSaver(monster) ? 'starts to fall' : 'falls'} to pieces!`);
        await killNaturalTarget(monster, context);
    }
    if (!state.program_state.gameover)
        await erodeArmor(monster, attack[1] === AD_RUST ? 'rust' : attack[1] === AD_CORR ? 'corrosion' : 'rot', { state, publish, random });
}

async function curseNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { state, publish, random } = context;
    if (!sessionIsNight(state.datetime) || random(10) || monster.mcan) return;
    if (speciesIs(monster, 'clay golem')) {
        if (!heroIsBlind(state))
            await publish(`Some writing vanishes from ${possessiveName(monsterName(monster, { state }))} head!`);
        await killNaturalTarget(monster, context);
    } else {
        monster.mcan = 1;
        await publish('You chuckle.');
    }
}

async function drainLife(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, random, rollDice, publish } = context;
    if (random(3) || monsterHasDrainResistance(monster)
        || monsterHasArtifactDefense(monster, 'life-drain', state)
        || await negated(monster, context, true)) return context.damage;
    const damage = rollDice(2, 6);
    await publish(`${subject(monster, context)} becomes weaker!`);
    if (monster.mhpmax - damage > monster.m_lev) monster.mhpmax -= damage;
    else if (monster.mhpmax > monster.m_lev) monster.mhpmax = monster.m_lev + 1;
    monster.mhp -= damage;
    if (monster.mhp <= 0 || !monster.m_lev) {
        await publish(`${subject(monster, context)} ${monsterIsNonliving(monster.mnum) ? 'expires' : 'dies'}!`);
        await killNaturalTarget(monster, context);
    } else monster.m_lev--;
    return 0;
}

async function poisonNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, attack, random, publish } = context;
    let damage = context.damage;
    if (await negated(monster, context, false) || random(8)) return damage;
    const weapon = state.uwep || state.u.uwep;
    const method = attack[0];
    const noun = method === AT_WEAP ? weapon?.opoisoned ? 'weapon' : 'attack'
        : method === AT_TUCH ? 'contact' : method === AT_GAZE ? 'gaze' : method === AT_BITE ? 'bite' : 'sting';
    await publish(`Your ${noun} was poisoned!`);
    if (monsterHasPoisonResistance(monster)) {
        await publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
    } else if (!random(10)) {
        await publish('Your poison was deadly...');
        damage = monster.mhp;
    } else damage += 6 + random(10);
    return damage;
}

async function sleepNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { state, publish, rollOne } = context;
    if (monster.msleeping || await negated(monster, context, false)) return;
    const duration = rollOne(10);
    if (monsterResistsSleep(monster) || monsterHasArtifactDefense(monster, 'sleep', state)) {
        await shieldeff(monster.mx, monster.my, state);
        return;
    }
    if (!putMonsterToSleep(monster, duration)) return;
    if (!heroIsBlind(state)) await publish(`${subject(monster, context)} is put to sleep by you!`);
    if (state.u.ustuck === monster && !state.u.uswallow && !heroFormSticks(state)) {
        await publish(`${possessiveName(subject(monster, context))} grip relaxes.`);
        await releaseHeroFromMonster(monster, { state, publish, rollOne });
    }
}

async function slowNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const blocked = await negated(monster, context, false);
    if (blocked || monster.mspeed === MSLOW
        || wearsDragonDefense(monster, 'blue dragon', BLUE_DRAGON_SCALES, BLUE_DRAGON_SCALE_MAIL)) return;
    const oldSpeed = monster.mspeed;
    adjustMonsterSpeed(monster, -1);
    if (monster.mspeed !== oldSpeed && canSeeMonster(monster))
        await context.publish(`${subject(monster, context)} slows down.`);
}

async function teleportNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
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
        if (monster.mhp === 1) monster.mhp++;
        damage = monster.mhp - 1;
    }
    return damage;
}

async function petrifyNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    await petrifyMonsterFromContact(monster, {
        state: context.state, publish: context.publish, rollOne: context.rollOne, creditHero: true,
        finishDeath: (target, death) => finishHeroMonsterKillOutcome(target, target.mx, target.my, {
            ...death, publish: context.publish, showKillMessage: false,
            recordConduct: !death?.noCorpse,
        }),
    });
}

async function negated(monster: Monster, { state, random, publish }: HeroNaturalEffectContext, tell: boolean): Promise<boolean> {
    const blocked = specialAttackNegated(state.u, monster, { state, random });
    if (blocked && tell && canSeeMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} avoids harm.`);
    return blocked;
}

function naturalAttackCanBlind(monster: Monster, { state, attack }: HeroNaturalEffectContext): boolean {
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES || !monster.mcansee && !monster.mblinded) return false;
    if (heroSpecies(state) === MONSTER_NAME.indexOf('raven') && speciesIs(monster, 'raven')) return false;
    const method = attack[0];
    if ([AT_EXPL, AT_BOOM, AT_GAZE, AT_MAGC, AT_BREA].includes(method))
        return !monsterResistsBlindingLight(monster, state);
    if ([AT_WEAP, AT_SPIT, AT_NONE].includes(method)) return false;
    if (method === AT_ENGL) return !monster.msleeping;
    if (method !== AT_CLAW) return true;
    if (state.u.uswallow) return false;
    return !(monster.minvent ?? []).some(object => (object.owornmask ?? 0) & W_ARMH
        && (state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
}

function wearsDragonDefense(monster: Monster, species: string, scales: number, mail: number): boolean {
    return speciesIs(monster, species) || (monster.minvent ?? []).some(object =>
        ((object.owornmask ?? 0) & W_ARM) && (object.otyp === scales || object.otyp === mail));
}

function speciesIs(monster: Monster, species: string): boolean {
    return MONSTER_NAME[monster.mnum] === species;
}

function subject(monster: Monster, { state }: HeroNaturalEffectContext): string {
    return monsterName(monster, { state, capitalized: true });
}

async function killNaturalTarget(monster: Monster, context: HeroNaturalEffectContext, options: HeroMonsterKillOptions = {}): Promise<void> {
    await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...options, showKillMessage: false, publish: context.publish,
    });
}
