// Shared primary object-state transitions.
// C refs: mkobj.c curse(), uncurse(), bless(), and unbless().
//
// NetHack stores blessed/cursed as boolean bits.  Older JavaScript inventory
// producers can also attach a textual `buc` compatibility field, so every
// shared transition must keep that projection synchronized.

import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    CORPSE, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { rn2 } from './rng.js';

const COIN_CLASS = 12;
const PM_DEATH = 311;
const PM_FAMINE = 313;

export function objectResistsDestruction(
    object, ordinaryChance, artifactChance, random = rn2,
) {
    if (!object) return false;
    if (object.otyp === AMULET_OF_YENDOR
        || object.otyp === SPE_BOOK_OF_THE_DEAD
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === BELL_OF_OPENING
        || (object.otyp === CORPSE
            && object.corpsenm >= PM_DEATH
            && object.corpsenm <= PM_FAMINE)) return true;
    return random(100) < (object.oartifact || object.artifact
        ? artifactChance : ordinaryChance);
}

export function curseObjectState(object) {
    if (!object || object.oclass === COIN_CLASS) return false;
    const changed = !object.cursed || !!object.blessed;
    object.blessed = false;
    object.cursed = true;
    object.buc = 'cursed';
    return changed;
}

export function uncurseObjectState(object) {
    if (!object) return false;
    const changed = !!object.cursed;
    object.cursed = false;
    object.buc = object.blessed ? 'blessed' : 'uncursed';
    return changed;
}

export function unblessObjectState(object) {
    if (!object) return false;
    const changed = !!object.blessed;
    object.blessed = false;
    object.buc = object.cursed ? 'cursed' : 'uncursed';
    return changed;
}
