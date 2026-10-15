// Shared thrown-projectile lifecycle after a successful hit.
// C ref: dothrow.c should_mulch_missile().
import { BAG_OF_HOLDING, BAG_OF_TRICKS, EUCALYPTUS_LEAF, FLINT, FORTUNE_COOKIE, HARD_GEM_TYPES, KELP_FROND, OBJECT_MAGIC, OBJECT_NAMES, OBJECT_SUBTYPE, OILSKIN_SACK, PANCAKE, SACK, SLING, SPRIG_OF_WOLFSBANE, } from './object_data.js';
import { game } from './gstate.js';
import { objectMaterial } from './object_material.js';
import { rn2, rnl } from './rng.js';
const P_BOW = 20;
const P_CROSSBOW = 22;
const P_DART = 23;
const P_BOOMERANG = 25;
const RUBBER_HOSE = OBJECT_NAMES.indexOf('rubber hose');
const SCROLL_CLASS = 9;
const CLOTH = 6;
// C dothrow.c:harmless_missile(). Contents make an otherwise soft bag hurt.
export function harmlessMissile(object, state = game) {
    switch (object.otyp) {
        case SLING:
        case EUCALYPTUS_LEAF:
        case KELP_FROND:
        case SPRIG_OF_WOLFSBANE:
        case FORTUNE_COOKIE:
        case PANCAKE:
            return true;
        case RUBBER_HOSE:
        case BAG_OF_TRICKS:
            return object.spe < 1;
        case SACK:
        case OILSKIN_SACK:
        case BAG_OF_HOLDING:
            return !object.contents?.length;
        default:
            return object.oclass === SCROLL_CLASS || objectMaterial(object, state) === CLOTH;
    }
}
export function projectileKind(object) {
    const subtype = object ? OBJECT_SUBTYPE[object.otyp] ?? 0 : 0;
    if (subtype >= -P_CROSSBOW && subtype <= -P_BOW)
        return 'ammunition';
    if (subtype >= -P_BOOMERANG && subtype <= -P_DART)
        return 'missile';
    return null;
}
// C frees a mulched projectile. Remove it from every JavaScript object list.
export function destroyMulchedProjectile(object) {
    if (!object)
        return;
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
    delete object.carrierMid;
}
export function shouldMulchMissile(object, { monsterMoving = false } = {}) {
    if (!object || !projectileKind(object)
        || OBJECT_NAMES[object.otyp] === 'boomerang'
        || OBJECT_MAGIC[object.otyp])
        return false;
    const erosion = Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
    const enchantment = object.spe ?? object.enchantment ?? 0;
    const chance = 3 + erosion - enchantment;
    let broken = chance > 1 ? rn2(chance) !== 0 : rn2(4) === 0;
    if (object.blessed
        && (monsterMoving ? rn2(3) === 0 : rnl(4) === 0))
        broken = false;
    if ((HARD_GEM_TYPES.has(object.otyp) || object.otyp === FLINT)
        && rn2(2) === 0)
        broken = false;
    return broken;
}
//# sourceMappingURL=projectile.js.map