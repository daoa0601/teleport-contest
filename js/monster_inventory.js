// monster_inventory.js — Shared monster acquisition boundary.
// C refs: steal.c:mpickobj()/add_to_minv() and invent.c:carry_obj_effects().

import { attachCursedFigurineTimer } from './figurine_timer.js';
import { game } from './gstate.js';

// Runtime monster inventories use acquisition order in JavaScript. Callers
// which mirror a source head insertion can request the front explicitly.
// carry_obj_effects() must run before add_to_minv() because linking/merging may
// replace the input identity; the current live carrying effect is FIG_TRANSFORM.
export function addObjectToMonsterInventory(
    monster, object, state = game, { atFront = false } = {},
) {
    if (!monster || !object) return null;
    attachCursedFigurineTimer(object, state);
    return linkObjectToMonsterInventory(monster, object, { atFront });
}

// add_to_minv() is also called directly for identities such as newly minted
// monster gold.  That source boundary links ownership without
// carry_obj_effects(); keep it distinct so future carrying effects do not
// silently consume RNG or mutate direct-link objects.
export function linkObjectToMonsterInventory(
    monster, object, { atFront = false } = {},
) {
    if (!monster || !object) return null;
    const inventory = monster.minvent || monster.inventory || [];
    if (atFront) inventory.unshift(object);
    else inventory.push(object);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.where = 'minvent';
    object.ox = monster.mx;
    object.oy = monster.my;
    object.carrierMid = monster.m_id ?? null;
    return object;
}

export function removeObjectFromMonsterInventory(monster, object) {
    if (!monster || !object) return false;
    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(object);
    if (index < 0) return false;
    inventory.splice(index, 1);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    delete object.carrierMid;
    return true;
}
