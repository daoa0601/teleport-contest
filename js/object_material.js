// Per-game object material after unidentified object classes are shuffled.
// C refs: o_init.c shuffle() and objects[].oc_material.

import { game } from './gstate.js';
import { OBJECT_MATERIAL } from './object_data.js';

export function objectMaterial(objectOrType, state = game) {
    const type = typeof objectOrType === 'number'
        ? objectOrType : objectOrType?.otyp;
    return state.objectMaterials?.[type] ?? OBJECT_MATERIAL[type] ?? 0;
}
