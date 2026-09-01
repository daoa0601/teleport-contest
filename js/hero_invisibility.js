// Temporary and intrinsic hero invisibility.
// C refs: potion.c peffect_invisibility() and zap.c zapyourself().

import { TIMEOUT } from './const.js';
import { newsym, pline } from './display.js';
import { game } from './gstate.js';
import { MUMMY_WRAPPING } from './object_data.js';
import { d, rn2 } from './rng.js';

function isBlind(state) {
    return !!(state.blind || state.u?.blind
        || (state.u?.blindTurns ?? 0) > 0);
}

function invisibilityIsBlocked(state) {
    const hero = state.u || {};
    return !!(hero.invisibilityBlocked || hero.invisBlocked
        || hero.invis_blkd);
}

function wearsMummyWrapping(state) {
    const cloak = state.uarmc || state.u?.uarmc;
    return cloak?.otyp === MUMMY_WRAPPING;
}

function hasInternalInvisibility(state) {
    return !!(state.u?.intrinsicInvisible
        || (state.u?.invisibleTurns ?? 0) > 0);
}

export function heroIsInvisible(state = game) {
    const hero = state.u || {};
    const active = !!(hero.intrinsicInvisible || hero.extrinsicInvisible
        || hero.formInvisible || (hero.invisibleTurns ?? 0) > 0);
    return active && !invisibilityIsBlocked(state);
}

function syncHeroInvisibility(state) {
    const invisible = heroIsInvisible(state);
    state.u.invisible = invisible;
    state.u.invis = invisible;
    return invisible;
}

async function showInvisibilityMessage(state) {
    const hallucinating = !!(state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0);
    const seesInvisible = !!(state.u?.seeInvisible
        || state.u?.see_invisible
        || (state.u?.seeInvisibleTurns ?? 0) > 0);
    const lead = hallucinating
        ? 'Far out, man!  You' : 'Gee!  All of a sudden, you';
    const effect = seesInvisible
        ? 'can see right through yourself' : "can't see yourself";
    await pline(`${lead} ${effect}.`);
}

export async function applyPotionLikeInvisibility({
    state = game,
    blessed = false,
    cursed = false,
    spell = false,
    random = rn2,
    rollDice = d,
} = {}) {
    if (spell && invisibilityIsBlocked(state) && wearsMummyWrapping(state)) {
        await pline('You feel rather itchy under your mummy wrapping.');
        return {
            blocked: true,
            showedInvisibility: false,
            aggravates: false,
        };
    }

    const wasInvisible = heroIsInvisible(state);
    const showedInvisibility = !wasInvisible && !isBlind(state)
        && !invisibilityIsBlocked(state);
    if (showedInvisibility) await showInvisibilityMessage(state);

    const blessing = blessed ? 1 : cursed ? -1 : 0;
    let duration = 0;
    let permanent = false;
    if (blessed && random(hasInternalInvisibility(state) ? 15 : 30) === 0) {
        state.u.intrinsicInvisible = true;
        permanent = true;
    } else {
        duration = rollDice(6 - 3 * blessing, 100) + 100;
        state.u.invisibleTurns = Math.min(
            TIMEOUT,
            (state.u.invisibleTurns ?? 0) + duration,
        );
    }

    let aggravates = false;
    if (cursed) {
        await pline('For some reason, you feel your presence is known.');
        state.u.intrinsicInvisible = false;
        aggravates = true;
    }
    syncHeroInvisibility(state);
    newsym(state.u.ux, state.u.uy);
    return {
        blocked: false,
        showedInvisibility,
        aggravates,
        duration,
        permanent,
    };
}

export async function zapHeroInvisible(
    state = game, random = rn2,
) {
    if (invisibilityIsBlocked(state) && wearsMummyWrapping(state)) {
        await pline('You feel rather itchy under your mummy wrapping.');
        return false;
    }
    const observed = !heroIsInvisible(state) && !isBlind(state)
        && !invisibilityIsBlocked(state);
    state.u.invisibleTurns = Math.min(
        TIMEOUT,
        (state.u.invisibleTurns ?? 0) + 31 + random(15),
    );
    syncHeroInvisibility(state);
    if (observed) await showInvisibilityMessage(state);
    newsym(state.u.ux, state.u.uy);
    return observed;
}
