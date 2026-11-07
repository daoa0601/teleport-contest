// The Schroedinger's-box predicate. C ref: obj.h SchroedingersBox();
// the observe_quantum_cat() port lives in pickup.ts with its pickup.c owner.

import { LARGE_BOX } from './object_data.js';

import type { GameObject } from './object_types.js';

// C obj.h:SchroedingersBox().
export function isQuantumBox(object: Pick<GameObject, 'otyp' | 'spe'>): boolean {
    return object.otyp === LARGE_BOX && object.spe === 1;
}
