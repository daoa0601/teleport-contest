// hunger.js — Shared hero metabolism for global turns and melee attacks.
// C ref: eat.c:gethungry(), called by allmain.c and hack.c.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { nearCapacity } from './weight.js';
import {
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, MEAT_RING,
    OBJECT_CHARGED, RIN_PROTECTION, RIN_SLOW_DIGESTION,
} from './object_data.js';

const M1_METALLIVORE = 0x10000000;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;

function ringCostsNutrition(ring, otherRing = null) {
    if (!ring || ring.otyp === MEAT_RING) return false;
    if ((ring.spe || 0) !== 0 || !OBJECT_CHARGED[ring.otyp]) return true;
    return ring.otyp === RIN_PROTECTION
        && !game.u.protectionIntrinsic
        && (!otherRing || otherRing.otyp !== RIN_PROTECTION
            || !(otherRing.spe || 0));
}

function accessoryNutritionCost(accessoryTime) {
    const u = game.u;
    let cost = 0;
    if (accessoryTime % 2) {
        if (u.regenerationIntrinsic || u.regenerationExtrinsic) cost++;
        if (nearCapacity(game) > 1) cost++;
        return cost;
    }

    // Hunger and Conflict are independent C properties and can both charge.
    if (u.hunger) cost++;
    if (u.conflict) cost++;
    switch (accessoryTime) {
    case 0:
        if (u.slowDigestion
            && game.uright?.otyp !== RIN_SLOW_DIGESTION
            && game.uleft?.otyp !== RIN_SLOW_DIGESTION) cost++;
        break;
    case 4:
        if (ringCostsNutrition(game.uleft, game.uright)) cost++;
        break;
    case 8:
        if (game.uamul?.otyp !== undefined
            && game.uamul.otyp !== FAKE_AMULET_OF_YENDOR) cost++;
        break;
    case 12:
        if (ringCostsNutrition(game.uright, game.uleft)) cost++;
        break;
    case 16:
        if (u.uhave?.amulet || u.haveAmulet
            || game.inventory?.some(object => object.otyp === AMULET_OF_YENDOR))
            cost++;
        break;
    default:
        break;
    }
    return cost;
}

export function getHungry({ invulnerable = false } = {}) {
    const u = game.u;
    if (!u || invulnerable) return null;
    if (!Number.isInteger(u.uhunger)) u.uhunger = 900;

    // C's Unaware gate slows ordinary metabolism while the hero is asleep or
    // unconscious.  It is independent of the accessory-time roll below, so
    // every helpless global turn must preserve both calls and their order.
    const unaware = game._helplessReason === 'unconscious from rotten food'
        || game._helplessReason === 'unconscious from drinking';
    // eat.c:gethungry() charges ordinary metabolism only when the current
    // body can eat.  Polymorphing into a mold suppresses this decrement even
    // though worn accessories can still consume nutrition below.
    const polymorphed = (u.mtimedone ?? 0) > 0;
    const currentFormEats = !polymorphed
        || !!((MONSTER_FLAGS1[u.umonnum] ?? 0)
            & (M1_METALLIVORE | M1_CARNIVORE | M1_HERBIVORE));
    if (currentFormEats && !u.slowDigestion
        && (!unaware || rn2(10) === 0))
        u.uhunger--;
    const accessoryTime = rn2(20);
    u.uhunger -= accessoryNutritionCost(accessoryTime);
    return accessoryTime;
}
