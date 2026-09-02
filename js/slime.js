// Hero transformation into green slime.
// C refs: potion.c make_slimed(), timeout.c slime_dialogue() and
// slimed_to_death(), uhitm.c mhitm_ad_slim().

import { exerciseAttribute } from './attrib.js';
import {
    A_DEX, GENOCIDED, G_GENOD, M_AP_MONSTER, TURNED_SLIME,
} from './const.js';
import { game } from './gstate.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { removeIntrinsicProperty } from './properties.js';
import { stopRun } from './runmode.js';

export const PM_GREEN_SLIME = 208;

const PM_FLAMING_SPHERE = 30;
const PM_FIRE_VORTEX = 111;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
const S_GHOST = 54;
const FLAMING_FORMS = new Set([
    PM_FLAMING_SPHERE,
    PM_FIRE_VORTEX,
    PM_FIRE_ELEMENTAL,
    PM_SALAMANDER,
]);

function heroForm(state) {
    return heroIsPolymorphed(state) ? state.u?.umonnum : null;
}

export function heroIsFlaming(state = game) {
    return FLAMING_FORMS.has(heroForm(state));
}

export function heroIsNoncorporeal(state = game) {
    const form = heroForm(state);
    return form !== null && MONSTER_SYMBOL[form] === S_GHOST;
}

export function heroIsGreenSlime(state = game) {
    return heroForm(state) === PM_GREEN_SLIME;
}

function heroIsSlimeproof(state = game) {
    return heroIsGreenSlime(state)
        || heroIsFlaming(state)
        || heroIsNoncorporeal(state);
}

export function heroCanBeSlimed(state = game) {
    const hero = state.u || {};
    return !heroIsSliming(state)
        && !hero.unchanging && !state.unchanging
        && !heroIsSlimeproof(state);
}

export function heroIsSliming(state = game) {
    return (state.u?.slimedTurns ?? 0) > 0 || !!state.u?.slimed;
}

export function startHeroSliming({
    state = game,
    turns = 10,
    killer = '',
} = {}) {
    const hero = state.u || (state.u = {});
    if (!heroCanBeSlimed(state)) return false;
    hero.slimedTurns = turns;
    hero.slimed = turns > 0;
    hero.slimeKiller = killer;
    return hero.slimed;
}

export function clearHeroSliming(state = game) {
    const hero = state.u || (state.u = {});
    const wasSliming = heroIsSliming(state);
    hero.slimedTurns = 0;
    hero.slimed = false;
    delete hero.slimeKiller;
    if (hero.m_ap_type === M_AP_MONSTER
        && hero.mappearance === PM_GREEN_SLIME) {
        hero.m_ap_type = 0;
        hero.mappearance = 0;
    }
    return wasSliming;
}

// Continue a green slime's touch after hitmsg(). The contact's ordinary
// damage remains unless the hero's current form cannot be slimed.
export function resumeDeferredHeroSlime(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredSlimeEffect) return action;
    attack.deferredSlimeEffect = false;

    if (attack.slimeNegated) {
        if (!attack.slimeCancelled)
            attack.slimeEffectMessage = 'You escape harm.';
    } else if (heroIsFlaming(state)) {
        attack.damage = 0;
        attack.slimeEffectMessage = 'The slime burns away!';
    } else if (state.u?.unchanging || state.unchanging
        || heroIsNoncorporeal(state)
        || heroIsGreenSlime(state)) {
        attack.damage = 0;
        attack.slimeEffectMessage = 'You are unaffected.';
    } else if (!heroIsSliming(state)) {
        attack.slimeEffectMessage = "You don't feel very well.";
        attack.slimeStartPending = true;
        attack.slimeKiller = MONSTER_NAME[action.monster?.mnum]
            || 'green slime';
    } else {
        attack.slimeEffectMessage = 'Yuck!';
    }
    attack.deferredPostHit = true;
    return action;
}

// make_slimed() runs after its warning line has crossed tty.
export function finishDeferredHeroSlime(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.slimeStartPending) return action;
    startHeroSliming({ state, killer: attack.slimeKiller });
    attack.slimeStartPending = false;
    return action;
}

function articleFor(name) {
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function slimeMessage(turns, state, randomMonsterName) {
    if (turns === 9) {
        return state.blind || (state.u?.blindTurns ?? 0) > 0
            ? null : 'You are turning a little green.';
    }
    if (turns === 7) {
        return heroHasNoLimbs(state)
            ? 'Your extremities are getting oozy.'
            : 'Your limbs are getting oozy.';
    }
    if (turns === 5) return 'Your skin begins to peel away.';
    if (turns !== 3 && turns !== 1) return null;
    const hallucinating = !!state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0;
    const form = hallucinating ? randomMonsterName() : 'green slime';
    return turns === 3
        ? `You are turning into ${articleFor(form)}.`
        : `You have become ${articleFor(form)}.`;
}

function stopHeroActivities(state) {
    state._occupation = null;
    state._commandCount = 0;
    if ((state.multi ?? 0) > 0) state.multi = 0;
    if ((state._multi ?? 0) > 0) state._multi = 0;
    if (state._runState) stopRun(state);
}

function removeHeroSpeed(state) {
    const hero = state.u;
    hero.fastTurns = 0;
    hero.veryFastTurns = 0;
    removeIntrinsicProperty('fast', state);
    hero.veryFast = !!hero.veryFastFromArmor;
}

function cancelHeroPetrification(state) {
    const hero = state.u;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
}

export async function advanceHeroSliming({
    state = game,
    publish = async () => {},
    repaint = () => {},
    randomMonsterName = () => 'green slime',
    transform,
    die,
} = {}) {
    const hero = state.u || (state.u = {});
    const turns = hero.slimedTurns ?? 0;
    if (turns <= 0) return { active: false, died: false };

    if (turns === 1) {
        hero.m_ap_type = M_AP_MONSTER;
        hero.mappearance = PM_GREEN_SLIME;
        repaint(hero.ux, hero.uy);
    }

    const message = slimeMessage(turns, state, randomMonsterName);
    if (message) await publish(message);

    const stage = Math.trunc(turns / 2);
    if (stage === 3) {
        removeHeroSpeed(state);
        stopHeroActivities(state);
    } else if (stage === 2
        && (hero.deafTurns ?? 0) > 0
        && hero.deafTurns < 5) {
        hero.deafTurns = 5;
    } else if (stage === 1) {
        cancelHeroPetrification(state);
    }
    exerciseAttribute(A_DEX, false, state);

    hero.slimedTurns = turns - 1;
    if (hero.slimedTurns > 0) {
        hero.slimed = true;
        return { active: true, died: false, turns: hero.slimedTurns, message };
    }

    const killer = hero.slimeKiller || 'turned into green slime';
    clearHeroSliming(state);
    if (typeof transform !== 'function' || typeof die !== 'function') {
        throw new TypeError(
            'the final slime turn requires transform and death functions',
        );
    }
    await transform(PM_GREEN_SLIME, { announceForm: false });
    const died = await die({
        killer,
        deathVerb: 'turned into slime',
        deathLineShown: true,
        deathType: TURNED_SLIME,
    });
    if (died) return { active: false, died: true, transformed: true, message };

    const genocided = !!(
        (state.mvitals?.[PM_GREEN_SLIME]?.mvflags ?? 0) & G_GENOD
    );
    if (!genocided) {
        return { active: false, died: false, transformed: true, message };
    }

    await publish('Unfortunately, green slime has been genocided...');
    const genocidedDeath = await die({
        killer: 'slimicide',
        deathVerb: 'were genocided',
        deathLineShown: true,
        deathType: GENOCIDED,
    });
    return {
        active: false,
        died: genocidedDeath,
        transformed: true,
        genocided: true,
        message,
    };
}
