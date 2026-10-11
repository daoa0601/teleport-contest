// Shared thrown-projectile lifecycle after a successful hit.
// C ref: dothrow.c should_mulch_missile().

import {
    FLINT, HARD_GEM_TYPES, OBJECT_MAGIC, OBJECT_NAMES, OBJECT_SUBTYPE,
} from './object_data.js';
import { rn2, rnl } from './rng.js';

import type { GameObject } from './object_types.js';

const P_BOW = 20;
const P_CROSSBOW = 22;
const P_DART = 23;
const P_BOOMERANG = 25;

export function projectileKind(object: Pick<GameObject, 'otyp'> | null | undefined): 'ammunition' | 'missile' | null {
    const subtype = object ? OBJECT_SUBTYPE[object.otyp] ?? 0 : 0;
    if (subtype >= -P_CROSSBOW && subtype <= -P_BOW)
        return 'ammunition';
    if (subtype >= -P_BOOMERANG && subtype <= -P_DART)
        return 'missile';
    return null;
}

// C frees a mulched projectile. Remove it from every JavaScript object list.
export function destroyMulchedProjectile(object: GameObject | null | undefined): void {
    if (!object) return;
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
    delete object.carrierMid;
}

export function shouldMulchMissile(object: GameObject | null | undefined, { monsterMoving = false }: { monsterMoving?: boolean } = {}): boolean {
    if (!object || !projectileKind(object)
        || OBJECT_NAMES[object.otyp] === 'boomerang'
        || OBJECT_MAGIC[object.otyp]) return false;

    const erosion = Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
    const enchantment = object.spe ?? object.enchantment ?? 0;
    const chance = 3 + erosion - enchantment;
    let broken = chance > 1 ? rn2(chance) !== 0 : rn2(4) === 0;
    if (object.blessed
        && (monsterMoving ? rn2(3) === 0 : rnl(4) === 0)) broken = false;
    if ((HARD_GEM_TYPES.has(object.otyp) || object.otyp === FLINT)
        && rn2(2) === 0) broken = false;
    return broken;
}
