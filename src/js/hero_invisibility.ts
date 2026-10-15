// Temporary and intrinsic hero invisibility.
// C refs: potion.c peffect_invisibility() and zap.c zapyourself().

import type { GameState } from './game_state.js';
import { heroIsHallucinating } from './senses.js';
import { TIMEOUT } from './const.js';
import { newsym, plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { MUMMY_WRAPPING } from './object_data.js';
import { ownedObjectName } from './objnam.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty, propertyHasOtherSources,
    propertyIsActive, propertyIsBlocked, refreshProperty, revokeIntrinsicProperty,
} from './properties.js';
import { d, rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';

export function invisibilityIsBlocked(state = game) {
    return propertyIsBlocked('invisible', state);
}

export function hasInternalInvisibility(state = game) {
    return !!(hasIntrinsicProperty('invisible', null, state)
        || (state.u?.invisibleTurns ?? 0) > 0);
}

export function hasNonArtifactInvisibility(state = game) {
    const hero = state.u;
    return !!((hero.invisibleTurns ?? 0) > 0
        || propertyHasOtherSources('invisible', state));
}

export function heroIsInvisible(state = game) {
    return propertyIsActive('invisible', state);
}

export function syncHeroInvisibility(state = game) {
    return refreshProperty('invisible', state);
}

export async function showInvisibilityMessage(state = game) {
    const hallucinating = heroIsHallucinating(state);
    const seesInvisible = !!(state.u?.seeInvisible
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
    const cloak = state.uarmc || state.u.uarmc;
    if (spell && invisibilityIsBlocked(state) && cloak?.otyp === MUMMY_WRAPPING) {
        await pline(`You feel rather itchy under ${ownedObjectName(cloak, state, { capitalized: false })}.`);
        return {
            blocked: true,
            showedInvisibility: false,
            aggravates: false,
        };
    }

    const wasInvisible = heroIsInvisible(state);
    const showedInvisibility = !wasInvisible && !heroIsBlind(state)
        && !invisibilityIsBlocked(state);
    if (showedInvisibility) await showInvisibilityMessage(state);

    const blessing = blessed ? 1 : cursed ? -1 : 0;
    let duration = 0;
    let permanent = false;
    if (blessed && random(hasInternalInvisibility(state) ? 15 : 30) === 0) {
        grantIntrinsicProperty('invisible', 'outside', state);
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
        revokeIntrinsicProperty('invisible', 'outside', state);
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
    const cloak = state.uarmc || state.u.uarmc;
    if (invisibilityIsBlocked(state) && cloak?.otyp === MUMMY_WRAPPING) {
        await pline(`You feel rather itchy under ${ownedObjectName(cloak, state, { capitalized: false })}.`);
        return false;
    }
    const observed = !heroIsInvisible(state) && !heroIsBlind(state)
        && !invisibilityIsBlocked(state);
    state.u.invisibleTurns = Math.min(
        TIMEOUT,
        (state.u.invisibleTurns ?? 0) + 31 + random(15),
    );
    syncHeroInvisibility(state);
    if (observed) {
        newsym(state.u.ux, state.u.uy);
        await showInvisibilityMessage(state);
    }
    return observed;
}
