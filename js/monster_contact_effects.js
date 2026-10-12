// C uhitm.c:mhitm_ad_were(), mhitm_ad_slee(), mhitm_ad_poly(), and mhitm_ad_tlpt().
// These effects resume after hitmsg(); polymorph negation precedes hitmsg().
import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { heroHasInvoluntaryDelay } from './command_state.js';
import { A_CON, M_SEEN_SLEEP, Upolyd } from './const.js';
import { shieldeff } from './display.js';
import { heroIsBlind } from './senses.js';
import { heroIsUnconscious, putHeroToSleep } from './hero_sleep.js';
import { retouchEquipment } from './hero_retouch.js';
import { specialAttackNegated } from './magic_negation.js';
import { AD_POLY, AD_SLEE, AD_TLPT, AD_WERE } from './monster_attack_types.js';
import { askTeleportDestination } from './cmd.js';
import { heroControlsTeleport, teleportHero } from './teleport.js';
import { monsterName } from './monster_name.js';
import { monsterHasLineOfSightToHero, monstersForgetHeroResistance, monstersObserveHeroResistance, } from './monster_perception.js';
import { stopHeroOccupation } from './occupation.js';
import { heroIsUnchanging, heroHasProtectionFromShapeChangers, polymorphHero, } from './polyself.js';
import { applyHeroWereChange, revertHeroWereForm, setHeroLycanthropy } from './were.js';
import { rn2, rnd } from './rng.js';
export async function resolveMonsterContactEffect(monster, attack, { state, publish, random = rn2, rollOne = rnd }) {
    attack.deferredSpecialContact = false;
    if (attack.damageType === AD_WERE)
        await infectHero(monster, state, publish, random);
    else if (attack.damageType === AD_SLEE)
        await sleepHero(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_POLY)
        await polymorphHeroOnContact(monster, attack, state, publish, rollOne);
    else if (attack.damageType === AD_TLPT)
        await teleportHeroOnContact(monster, attack, state, publish, random);
    else
        throw new Error(`Damage type ${attack.damageType} has no deferred contact effect`);
    attack.deferredPostHit = true;
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
    putHeroToSleep(turns, { state });
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
            await publish('You feel an unnatural urge coming on.');
            await applyHeroWereChange({ state, publish });
        }
        else {
            await publish('You feel a natural urge coming on.');
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