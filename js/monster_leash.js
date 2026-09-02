// Shared ownership for a leash attached to a monster.
// C refs: apply.c:m_unleash(), get_mleash(), and unleash_all().

import { game } from './gstate.js';
import { LEASH } from './object_data.js';

export function leashAttachedToMonster(monster, state = game) {
    return (state.inventory || []).find(object =>
        object.otyp === LEASH && object.leashmon === monster?.m_id) || null;
}

export function releaseMonsterLeash(monster, state = game) {
    if (!monster?.mleashed) return null;
    const leash = leashAttachedToMonster(monster, state);
    monster.mleashed = 0;
    if (leash) leash.leashmon = 0;
    return leash;
}

export function releaseAllMonsterLeashes(state = game) {
    const attachedLeashes = (state.inventory || []).filter(object =>
        object.otyp === LEASH && object.leashmon);
    for (const monster of state.level?.monsters || [])
        monster.mleashed = 0;
    for (const leash of attachedLeashes) leash.leashmon = 0;
    return attachedLeashes.length;
}
