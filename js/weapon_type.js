// Shared weapon shape predicates.
// C ref: weapon.h is_blade().

import { P_DAGGER, P_SABER } from './const.js';
import { OBJECT_SUBTYPE } from './object_data.js';

const WEAPON_CLASS = 2;

export function isBlade(object) {
    const skill = OBJECT_SUBTYPE[object?.otyp] || 0;
    return object?.oclass === WEAPON_CLASS
        && skill >= P_DAGGER && skill <= P_SABER;
}
