// Hero wounded-leg state.
// C ref: do.c heal_legs().

import { A_DEX } from './const.js';
import { game } from './gstate.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';

export function healHeroLegs(state = game, {
    showBodyMessage = true,
} = {}) {
    const hero = state.u || (state.u = {});
    if (!(hero._woundedLegTurns > 0) && !hero._woundedLegSide)
        return { healed: false, messages: [] };

    const previousCapacity = Number.isInteger(state._encumbranceLevel)
        ? state._encumbranceLevel : nearCapacity(state);
    const bothLegs = hero._woundedLegSide === 'both';
    hero._woundedLegTurns = 0;
    hero._woundedLegSide = null;
    if (hero.acurr?.a) hero.acurr.a[A_DEX]++;

    const currentCapacity = nearCapacity(state);
    state._encumbranceLevel = currentCapacity;
    hero._encumbrance = encumbranceLabel(currentCapacity);
    const messages = [];
    if (showBodyMessage) {
        messages.push(bothLegs
            ? 'Your legs feel better.' : 'Your leg feels better.');
    }
    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    if (capacityMessage) messages.push(capacityMessage);
    return { healed: true, messages };
}
