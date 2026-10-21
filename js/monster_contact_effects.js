// C uhitm.c:mhitm_ad_were(), mhitm_ad_slee(), mhitm_ad_poly(), and mhitm_ad_tlpt().
// These effects resume after hitmsg(); polymorph negation precedes hitmsg().
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { artifactById } from './artifacts.js';
import { heroHasFreeAction } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { heroHasInvoluntaryDelay, nomul } from './command_state.js';
import { A_CON, A_DEX, A_STR, FAINTED, M_SEEN_ACID, M_SEEN_SLEEP, Upolyd } from './const.js';
import { displayLiquidName, shieldeff } from './display.js';
import { heroIsBlind } from './senses.js';
import { heroIsUnconscious, putHeroToSleep } from './hero_sleep.js';
import { retouchEquipment } from './hero_retouch.js';
import { specialAttackNegated } from './magic_negation.js';
import { AD_ACID, AD_CONF, AD_CURS, AD_DETH, AD_DISE, AD_FAMN, AD_HEAL, AD_PEST, AD_PLYS, AD_POLY, AD_SGLD, AD_SLEE, AD_SLOW, AD_SSEX, AD_TLPT, AD_WERE, AD_WRAP } from './monster_attack_types.js';
import { resolveDeathTouchContact } from './monster_death_touch.js';
import { AD_SAMU } from './monster_attack_types.js';
import { stealHeroQuestObject } from './monster_quest_theft.js';
import { infectHeroWithMonsterDisease } from './monster_disease.js';
import { makeConfused } from './hero_mental_status.js';
import { spendHeroNutrition } from './hunger.js';
import { resolveHeroSeduction } from './monster_seduction.js';
import { stealHeroGold } from './monster_gold_theft.js';
import { heroHasRemovableSpeed, slowHero } from './hero_speed.js';
import { resolveNurseContact } from './monster_nurse_contact.js';
import { MONSTER_NAME } from './monster_data.js';
import { grantMonsterIntrinsic } from './monster_corpse_intrinsic.js';
import { sessionIsNight } from './monster_sound.js';
import { attrcurse } from './throne.js';
import { heroIsDeaf } from './senses.js';
import { resolveMonsterWrapping } from './monster_wrapping_contact.js';
import { askTeleportDestination } from './cmd.js';
import { heroControlsTeleport, teleportHero } from './teleport.js';
import { monsterName, namelessMonsterName } from './monster_name.js';
import { monsterHasLineOfSightToHero, monstersForgetHeroResistance, monstersObserveHeroResistance, } from './monster_perception.js';
import { stopHeroOccupation } from './occupation.js';
import { heroIsUnchanging, heroHasProtectionFromShapeChangers, polymorphHero, returnHeroToHumanForm, } from './polyself.js';
import { applyHeroWereChange, revertHeroWereForm, setHeroLycanthropy } from './were.js';
import { d, rn2, rnd } from './rng.js';
import { drainHeroBrain } from './monster_hero_brain.js';
import { AD_DRIN } from './monster_attack_types.js';
export async function resolveMonsterContactEffect(monster, attack, { state, publish, random = rn2, rollOne = rnd, rollDice = d }) {
    attack.deferredSpecialContact = false;
    if (attack.damageType === AD_DRIN)
        await drainHeroBrain(monster, attack, state, publish, random, rollOne);
    else if (attack.damageType === AD_WERE)
        await infectHero(monster, state, publish, random);
    else if (attack.damageType === AD_SLEE)
        await sleepHero(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_POLY)
        await polymorphHeroOnContact(monster, attack, state, publish, rollOne);
    else if (attack.damageType === AD_TLPT)
        await teleportHeroOnContact(monster, attack, state, publish, random);
    else if (attack.damageType === AD_PLYS)
        await paralyzeHero(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_WRAP)
        await resolveMonsterWrapping(monster, attack, state, publish, random);
    else if (attack.damageType === AD_CURS)
        await curseHero(monster, state, publish, random);
    else if (attack.damageType === AD_HEAL)
        await resolveNurseContact(monster, attack, state, publish, random, rollOne, rollDice);
    else if (attack.damageType === AD_ACID)
        await splashHeroWithAcid(monster, attack, state, publish, random);
    else if (attack.damageType === AD_SLOW) {
        if (!attack.negated && heroHasRemovableSpeed(state) && random(4) === 0)
            await slowHero(state, publish);
    }
    else if (attack.damageType === AD_SGLD)
        await stealHeroGold(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_SSEX)
        await resolveHeroSeduction(monster, attack, state, publish, random, rollOne);
    else if (attack.damageType === AD_DISE) {
        if (!await infectHeroWithMonsterDisease(monster, state, publish, random))
            attack.damage = 0;
    }
    else if (attack.damageType === AD_PEST)
        await infectHeroWithMonsterDisease(monster, state, publish, random);
    else if (attack.damageType === AD_DETH)
        await resolveDeathTouchContact(monster, attack, state, publish, random, rollDice);
    else if (attack.damageType === AD_SAMU) {
        if (random(20) === 0)
            await stealHeroQuestObject(monster, state, publish, random, rollOne);
    }
    else if (attack.damageType === AD_FAMN) {
        await exerciseAttribute(A_CON, false, state);
        if (state.u.uhs !== FAINTED)
            await spendHeroNutrition(random(40) + 40, { state });
    }
    else if (attack.damageType === AD_CONF) {
        const duration = attack.damage ?? 0;
        if (!monster.mcan && random(4) === 0 && !monster.mspec_used) {
            monster.mspec_used = duration + random(6);
            await publish(state.u.confusionTurns ? 'You are getting even more confused.'
                : 'You are getting confused.');
            await makeConfused((state.u.confusionTurns ?? 0) + duration, { state, publish, talk: false });
        }
        attack.damage = 0;
    }
    else
        throw new Error(`Damage type ${attack.damageType} has no deferred contact effect`);
    attack.deferredPostHit = true;
}
async function splashHeroWithAcid(monster, attack, state, publish, random) {
    if (monster.mcan || random(3) !== 0) {
        attack.damage = 0;
        return;
    }
    const liquid = displayLiquidName('acid', state);
    const seesHero = (observer) => monsterHasLineOfSightToHero(observer, state);
    if (state.u.acidResistance) {
        await publish(`You're covered in ${liquid}, but it seems harmless.`);
        monstersObserveHeroResistance(M_SEEN_ACID, state, seesHero);
        attack.damage = 0;
    }
    else {
        await publish(`You're covered in ${liquid}!  It burns!`);
        await exerciseAttribute(A_STR, false, state);
        monstersForgetHeroResistance(M_SEEN_ACID, state, seesHero);
    }
}
// C uhitm.c:mhitm_ad_curs(). A daytime gremlin still makes contact, but
// only its nighttime curse can remove and retain a hero's intrinsic.
async function curseHero(monster, state, publish, random) {
    if (monster.mnum === MONSTER_NAME.indexOf('gremlin') && !sessionIsNight(state.datetime))
        return;
    if (monster.mcan || random(10) !== 0)
        return;
    if (!heroIsDeaf(state)) {
        if (heroIsBlind(state))
            await publishHeardMessage('laughter.', publish, state);
        else
            await publish(`${monsterName(monster, { state, capitalized: true })} chuckles.`);
    }
    if (state.u.umonnum === MONSTER_NAME.indexOf('clay golem')) {
        await publish('Some writing vanishes from your head!');
        await returnHeroToHumanForm(state, { publish });
        return;
    }
    await grantMonsterIntrinsic(monster, await attrcurse({ publish }), state, publish);
}
// C uhitm.c:mhitm_ad_plys(). Existing helplessness skips the paralysis
// chance, but cancellation and Free action leave the contact damage intact.
async function paralyzeHero(monster, state, publish, random, rollOne) {
    if (heroHasInvoluntaryDelay(state) || random(3) !== 0)
        return;
    if (await magicPreventsContact(monster, state, publish, random))
        return;
    if (heroHasFreeAction(state)) {
        await publish('You momentarily stiffen.');
        return;
    }
    await publish(heroIsBlind(state) ? 'You are frozen!'
        : `You are frozen by ${monsterName(monster, { state })}!`);
    nomul(-rollOne(10), state);
    state._helplessDoneMessage = 'You can move again.';
    state._helplessReason = {
        monsterId: monster.m_id,
        text: `paralyzed by ${namelessMonsterName(monster, {
            state, article: 'a', suppressIt: true, suppressInvisible: true,
            suppressHallucination: true, suppressSaddle: true,
        })}`,
    };
    await exerciseAttribute(A_DEX, false, state);
}
async function teleportHeroOnContact(monster, attack, state, publish, random) {
    if (specialAttackNegated(monster, state.u, { state, random })) {
        await publish('You are not affected.');
        return;
    }
    if (state.flags.verbose) {
        const controlled = heroControlsTeleport(state)
            && !state.u.stunned && !(state.u.stunnedTurns ?? 0)
            && !heroIsUnconscious(state);
        await publish(`Your position suddenly seems ${controlled ? '' : 'very '}uncertain!`);
    }
    await teleportHero({ chooseDestination: askTeleportDestination });
    const hp = Upolyd(state.u) ? 'mh' : 'uhp';
    const damage = attack.damage ?? 0;
    const half = !!state.u.halfPhysicalDamage;
    if ((half ? Math.trunc((damage - 1) / 2) : damage) < state.u[hp])
        return;
    attack.damage = (state.u[hp] - 1) * (half ? 2 : 1);
    if (attack.damage < 1) {
        attack.damage = 1;
        if (state.u[hp] === 1)
            state.u[hp]++;
    }
}
async function magicPreventsContact(monster, state, publish, random) {
    const negated = specialAttackNegated(monster, state.u, { state, random });
    if (negated && !monster.mcan)
        await publish('You avoid harm.');
    return negated;
}
async function infectHero(monster, state, publish, random) {
    if (random(4) !== 0 || state.u.ulycn !== -1
        || heroHasProtectionFromShapeChangers(state))
        return;
    const weapon = state.uwep || state.u.uwep;
    if (artifactById(weapon?.oartifact, state)?.defense === 'lycanthropy')
        return;
    if (await magicPreventsContact(monster, state, publish, random))
        return;
    await publish('You feel feverish.', { urgent: true });
    await exerciseAttribute(A_CON, false, state);
    setHeroLycanthropy(monster.mnum, state);
    await retouchEquipment(2, { state, publish });
}
async function sleepHero(monster, state, publish, random, rollOne) {
    if (heroHasInvoluntaryDelay(state) || random(5) !== 0)
        return;
    if (await magicPreventsContact(monster, state, publish, random))
        return;
    const seesHero = (observer) => monsterHasLineOfSightToHero(observer, state);
    if (state.u.sleepResistance) {
        monstersObserveHeroResistance(M_SEEN_SLEEP, state, seesHero);
        return;
    }
    monstersForgetHeroResistance(M_SEEN_SLEEP, state, seesHero);
    const turns = rollOne(10);
    await stopHeroOccupation(state, publish);
    await putHeroToSleep(turns, { state });
    await publish(heroIsBlind(state) ? 'You are put to sleep!'
        : `You are put to sleep by ${monsterName(monster, { state })}!`);
}
async function polymorphHeroOnContact(monster, attack, state, publish, rollOne) {
    const damage = attack.damage ?? 0;
    const physicalDamage = state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage;
    if (physicalDamage >= (Upolyd(state.u) ? state.u.mh : state.u.uhp))
        return;
    if (attack.negated) {
        if (monster.mcan)
            await publish("You aren't transformed.");
        return;
    }
    const oldForm = state.u.umonnum;
    if (state.u.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
    }
    else if (!heroIsUnchanging(state)) {
        if (state.u.ulycn === -1) {
            await publish('You are subjected to a freakish metamorphosis.');
            await polymorphHero();
        }
        else if (state.u.umonnum !== state.u.ulycn) {
            await publish(formatFeltMessage('an unnatural urge coming on.', state));
            await applyHeroWereChange({ state, publish });
        }
        else {
            await publish(formatFeltMessage('a natural urge coming on.', state));
            await revertHeroWereForm({ state, publish });
        }
    }
    if (state.u.umonnum !== oldForm)
        monster.mspec_used = (monster.mspec_used ?? 0) + rollOne(2);
    // mhitm_ad_poly() marks this hit done even when resistance prevented
    // the body change. hitmu() still attempts knockback, then returns.
    attack.contactDone = true;
}
//# sourceMappingURL=monster_contact_effects.js.map