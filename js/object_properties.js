// Predicates derived from NetHack's object table.
// C ref: include/obj.h is_multigen() and is_poisonable().

import { artifactById } from './artifacts.js';
import { P_BOW, P_SHURIKEN } from './const.js';
import { OBJECT_SUBTYPE } from './object_data.js';

const WEAPON_CLASS = 2;

export function isMultiGeneratedWeapon(object) {
    const skill = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    return object?.oclass === WEAPON_CLASS
        && skill >= -P_SHURIKEN && skill <= -P_BOW;
}

export function isPoisonableObject(object) {
    return isMultiGeneratedWeapon(object)
        || artifactById(object?.oartifact)?.invokePower === 'fling-poison';
}
