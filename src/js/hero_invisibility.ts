// Temporary and intrinsic hero invisibility helpers; zap.c zapyourself()'s
// invisibility case.  potion.c self_invis_message() and peffect_invisibility()
// live in potion.ts.

import { formatFeltMessage } from './hero_speech.js';
import { heroIsHallucinating } from './senses.js';
import { TIMEOUT } from './const.js';
import { newsym } from './display.js';
import { plineWithContinuation as pline } from './pline.js';
import { game } from './gstate.js';
import { MUMMY_WRAPPING } from './object_data.js';
import { ownedObjectName } from './objnam.js';
import {
    hasIntrinsicProperty, propertyHasOtherSources,
    propertyIsActive, propertyIsBlocked, refreshProperty,
} from './properties.js';
import { rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { showInvisibilityMessage } from './potion.js';

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

export async function zapHeroInvisible(
    state = game, random = rn2,
) {
    const cloak = state.uarmc || state.u.uarmc;
    if (invisibilityIsBlocked(state) && cloak?.otyp === MUMMY_WRAPPING) {
        await pline(formatFeltMessage(`rather itchy under ${ownedObjectName(cloak, state, { capitalized: false })}.`, state));
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
        await newsym(state.u.ux, state.u.uy);
        await showInvisibilityMessage(state);
    }
    return observed;
}
