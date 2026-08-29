// projectile.js — Shared thrown-projectile lifecycle after a successful hit.
// C refs: dothrow.c:should_mulch_missile(); uhitm.c:passive_obj().

import { plineWithContinuation } from './display.js';
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    FLINT, HARD_GEM_TYPES, MAGIC_OBJECTS, OBJECT_CHARGED,
    OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SUBTYPE, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from './monster_data.js';
import { rn2, rnl } from './rng.js';
import { cansee } from './vision.js';

const P_BOW = 20;
const P_CROSSBOW = 22;
const P_DART = 23;
const P_BOOMERANG = 25;

export function projectileKind(object) {
    const subtype = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    if (subtype >= -P_CROSSBOW && subtype <= -P_BOW)
        return 'ammunition';
    if (subtype >= -P_BOOMERANG && subtype <= -P_DART)
        return 'missile';
    return null;
}

// C frees a mulched projectile. JavaScript witnesses can retain a reference,
// so make its removal from every ownership graph explicit.
export function destroyMulchedProjectile(object) {
    if (!object) return;
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
    delete object.carrierMid;
}

export function shouldMulchMissile(object, { monsterMoving = false } = {}) {
    if (!object || !projectileKind(object)
        || OBJECT_NAMES[object.otyp] === 'boomerang'
        || MAGIC_OBJECTS.has(object.otyp)) return false;

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

// passive_obj() runs only after should_mulch_missile() leaves the projectile
// alive. It affects the detached object, not the hero, and may emit a second
// tty transaction before the caller chooses floor or monster ownership.
export async function applyProjectileObjectPassive(monster, object) {
    const passive = MONSTER_ATTACKS[monster?.mnum]
        ?.find(attack => attack[0] === 0);
    if (!passive) return;
    const passiveDamageType = passive[1];
    const AD_FIRE = 2;
    const AD_ACID = 8;
    const AD_RUST = 24;
    const AD_ENCH = 41;
    const AD_CORR = 42;
    if (passiveDamageType === AD_FIRE) {
        if (rn2(6) !== 0 || monster.mcan
            || MONSTER_NAME[monster.mnum] === 'steam vortex') return;
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const flammable = (material > 1 && material <= 8)
            || material === 18;
        if (!flammable) return;
        if (object.oerodeproof || object.fireproof) {
            object.rknown = true;
            if (cansee(monster.mx, monster.my)) {
                const objectName = OBJECT_NAMES[object.otyp]
                    || object.name || 'object';
                const quantity = object.quantity ?? object.quan ?? 1;
                await plineWithContinuation(
                    `Somehow, the ${objectName} ${
                        quantity === 1 ? 'is' : 'are'
                    } not affected by the heat.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldBurn = object.oeroded ?? 0;
        if (oldBurn >= 3) return;
        object.oeroded = oldBurn + 1;
        const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
        const adverb = oldBurn + 1 === 3
            ? ' completely' : oldBurn ? ' further' : '';
        await plineWithContinuation(
            `The ${objectName} smoulders${adverb}!`,
        );
        return;
    }
    if (passiveDamageType === AD_RUST) {
        if (monster.mcan) return;
        if (object.greased) {
            if (rn2(2) === 0) object.greased = false;
            return;
        }
        if ((OBJECT_MATERIAL[object.otyp] ?? 0) !== 11) return;
        if (object.oerodeproof || object.rustproof) {
            object.rknown = true;
            if (cansee(monster.mx, monster.my)) {
                const objectName = OBJECT_NAMES[object.otyp]
                    || object.name || 'object';
                const quantity = object.quantity ?? object.quan ?? 1;
                await plineWithContinuation(
                    `Somehow, the ${objectName} ${
                        quantity === 1 ? 'is' : 'are'
                    } not affected by the oxidation.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldRust = object.oeroded ?? 0;
        if (oldRust >= 3) return;
        object.oeroded = oldRust + 1;
        const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
        const adverb = oldRust + 1 === 3
            ? ' completely' : oldRust ? ' further' : '';
        await plineWithContinuation(`The ${objectName} rusts${adverb}!`);
        return;
    }
    if (passiveDamageType === AD_CORR) {
        if (monster.mcan) return;
        if (object.greased) {
            if (rn2(2) === 0) object.greased = false;
            return;
        }
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        if (![11, 13].includes(material)) return;
        if (object.oerodeproof || object.corrodeproof) {
            object.rknown = true;
            if (cansee(monster.mx, monster.my)) {
                const objectName = OBJECT_NAMES[object.otyp]
                    || object.name || 'object';
                const quantity = object.quantity ?? object.quan ?? 1;
                await plineWithContinuation(
                    `Somehow, the ${objectName} ${
                        quantity === 1 ? 'is' : 'are'
                    } not affected by the corrosion.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldCorrosion = object.oeroded2 ?? 0;
        if (oldCorrosion >= 3) return;
        object.oeroded2 = oldCorrosion + 1;
        const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
        const adverb = oldCorrosion + 1 === 3
            ? ' completely' : oldCorrosion ? ' further' : '';
        await plineWithContinuation(`The ${objectName} corrodes${adverb}!`);
        return;
    }
    if (passiveDamageType === AD_ENCH) {
        if (monster.mcan) return;
        const enchantment = Number.isInteger(object.spe)
            ? object.spe : Number.isInteger(object.enchantment)
                ? object.enchantment : 0;
        if (!OBJECT_CHARGED[object.otyp] || enchantment <= 0
            || [AMULET_OF_YENDOR, SPE_BOOK_OF_THE_DEAD,
                CANDELABRUM_OF_INVOCATION, BELL_OF_OPENING]
                .includes(object.otyp)) return;
        if (rn2(100) < (object.oartifact ? 90 : 10)) return;
        object.spe = enchantment - 1;
        object.enchantment = object.spe;
        return;
    }
    if (passiveDamageType !== AD_ACID || rn2(6) !== 0) return;
    if (object.greased) {
        if (rn2(2) === 0) object.greased = false;
        return;
    }
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    if (![11, 13].includes(material)) return;
    if (object.oerodeproof || object.corrodeproof) {
        object.rknown = true;
        if (cansee(monster.mx, monster.my)) {
            const objectName = OBJECT_NAMES[object.otyp]
                || object.name || 'object';
            const quantity = object.quantity ?? object.quan ?? 1;
            await plineWithContinuation(
                `Somehow, the ${objectName} ${
                    quantity === 1 ? 'is' : 'are'
                } not affected by the corrosion.`,
            );
        }
        return;
    }
    if (object.blessed && rnl(4) === 0) return;

    const oldCorrosion = object.oeroded2 ?? 0;
    if (oldCorrosion >= 3) return;
    object.oeroded2 = oldCorrosion + 1;
    const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
    const adverb = oldCorrosion + 1 === 3
        ? ' completely' : oldCorrosion ? ' further' : '';
    await plineWithContinuation(`The ${objectName} corrodes${adverb}!`);
}
