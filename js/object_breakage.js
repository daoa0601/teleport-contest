// Object impact break decisions.
// C ref: dothrow.c breaktest().

import {
    ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EGG, EXPENSIVE_CAMERA,
    MELON, OBJECT_MATERIAL,
} from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { rn2 } from './rng.js';

const ARMOR_CLASS = 3;
const POTION_CLASS = 8;
const GEM_CLASS = 13;
const GLASS = 19;

const BREAKABLE_TYPES = new Set([
    EXPENSIVE_CAMERA,
    EGG,
    CREAM_PIE,
    MELON,
    ACID_VENOM,
    BLINDING_VENOM,
]);

export function objectBreaksOnImpact(object, random = rn2) {
    const glassArmor = object.oclass === ARMOR_CLASS
        && OBJECT_MATERIAL[object.otyp] === GLASS;
    const ordinaryResistance = glassArmor ? 90 : 1;
    if (objectResistsDestruction(
        object, ordinaryResistance, 99, random,
    )) return false;

    const glassObject = OBJECT_MATERIAL[object.otyp] === GLASS
        && !object.oartifact && !object.artifact
        && object.oclass !== GEM_CLASS;
    return glassObject || object.oclass === POTION_CLASS
        || BREAKABLE_TYPES.has(object.otyp);
}
