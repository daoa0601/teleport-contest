// monster_inventory.js — Shared monster acquisition boundary.
// C refs: steal.c:mpickobj()/add_to_minv() and invent.c:carry_obj_effects().

import { attachCursedFigurineTimer } from './figurine_timer.js';
import {
    LOST_DROPPED, LOST_NONE, LOST_STOLEN, LOST_THROWN,
} from './const.js';
import { game } from './gstate.js';
import { mergable, mergeObjectStacks } from './object_merge.js';

// Runtime monster inventories mirror C's minvent chain head-to-tail.  Every
// unmerged add_to_minv() acquisition becomes the new head; callers may request
// tail insertion only for a source boundary which explicitly constructs one.
// carry_obj_effects() must run before add_to_minv() because linking/merging may
// replace the input identity; the current live carrying effect is FIG_TRANSFORM.
export function addObjectToMonsterInventory(
    monster, object, state = game, { atFront = true } = {},
) {
    if (!monster || !object) return null;
    // steal.c:mpickobj() repairs hero-loss provenance before carrying
    // effects or add_to_minv() can inspect merge compatibility.  A hostile
    // swallower acquiring a thrown object therefore owns LOST_STOLEN, while
    // a pet deliberately preserves the hero's thrown/dropped marker.
    if (!monster.mtame) {
        if (object.how_lost === LOST_THROWN)
            object.how_lost = LOST_STOLEN;
        else if (object.how_lost === LOST_DROPPED)
            object.how_lost = LOST_NONE;
    }
    object.no_charge = false;
    attachCursedFigurineTimer(object, state);
    return linkObjectToMonsterInventory(
        monster, object, { atFront, state },
    );
}

// add_to_minv() is also called directly for identities such as newly minted
// monster gold.  That source boundary links ownership without
// carry_obj_effects(); keep it distinct so future carrying effects do not
// silently consume RNG or mutate direct-link objects.
export function linkObjectToMonsterInventory(
    monster, object, { atFront = true, state = game } = {},
) {
    if (!monster || !object) return null;
    const inventory = monster.minvent || monster.inventory || [];
    const existing = inventory.find(candidate =>
        mergable(candidate, object, state));
    if (existing) {
        const survivor = mergeObjectStacks(existing, object, state);
        monster.minvent = inventory;
        monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
        survivor.where = 'minvent';
        survivor.carrierMid = monster.m_id ?? null;
        return survivor;
    }
    if (atFront) inventory.unshift(object);
    else inventory.push(object);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.where = 'minvent';
    // C add_to_minv() does not rewrite ox/oy.  Those fields retain their
    // origin-specific payload (often 0,0 for a constructed/inventory object
    // or its former square for a floor pickup); ocarry is the ownership link.
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
