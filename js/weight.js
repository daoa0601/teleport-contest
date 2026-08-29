// weight.js — Hero inventory weight and carrying-capacity state.
// C refs: hack.c weight_cap(), inv_weight(), calc_capacity(), near_capacity().

import {
    BAG_OF_HOLDING, OBJECT_NUTRITION, OBJECT_WEIGHT,
} from './object_data.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS2, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import { Is_airlevel } from './const.js';
import { currentAttribute } from './attrib.js';

export const UNENCUMBERED = 0;
export const SLT_ENCUMBER = 1;
export const MOD_ENCUMBER = 2;
export const HVY_ENCUMBER = 3;
export const EXT_ENCUMBER = 4;
export const OVERLOADED = 5;

const M2_STRONG = 0x04000000;
const S_NYMPH = 14;
const MZ_HUMAN = 2;
const WT_HUMAN = 1450;

function quantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}

export function objectWeight(object) {
    if (!object) return 0;
    // C stores a stack's complete weight in owt.  Several early JS object
    // constructors still leave owt at the one-item metadata value after
    // changing quan, so reconstruct ordinary stack weight from the table.
    const base = OBJECT_WEIGHT[object.otyp];
    // A top-level coin stack is treated specially by inv_weight(), but coin
    // inside a container reaches mkobj.c:weight() and therefore weighs at
    // least one unit even below 50 pieces.
    if (object.oclass === 12)
        return Math.max(1, Math.trunc((quantity(object) + 50) / 100));
    // C mkobj.c:weight(): globs keep quantity one while absorption and
    // SHRINK_GLOB mutate their complete weight directly in owt.  This check
    // precedes partly-eaten food scaling because oeaten is also glob mass.
    if (object.globby) return object.owt ?? base ?? 0;
    // C mkobj.c:weight()->eaten_stat() scales partly eaten food by its
    // remaining nutrition.  touchfood() splits stacks first, but retain the
    // quantity-aware formula for restored objects and future constructors.
    if (object.oclass === 7 && (object.oeaten ?? 0) > 0 && base > 0) {
        const fullNutrition = (OBJECT_NUTRITION[object.otyp] ?? 0)
            * quantity(object);
        if (fullNutrition > 0) {
            return Math.max(1, Math.trunc(
                base * quantity(object) * object.oeaten / fullNutrition,
            ));
        }
    }
    if (Array.isArray(object.contents)) {
        let contentsWeight = object.contents.reduce(
            (total, content) => total + objectWeight(content), 0,
        );
        if (object.otyp === BAG_OF_HOLDING) {
            contentsWeight = object.cursed ? contentsWeight * 2
                : object.blessed ? Math.trunc((contentsWeight + 3) / 4)
                    : Math.trunc((contentsWeight + 1) / 2);
        }
        return (base || object.owt || 0) + contentsWeight;
    }
    if (base > 0) return base * quantity(object);
    return object.owt ?? 0;
}

function condensedStrength(value) {
    if (value <= 18) return Math.max(value, 3);
    if (value <= 121) return 19 + Math.trunc(value / 50);
    return Math.min(value, 125) - 100;
}

export function inventoryWeight(state) {
    const inventory = state.inventory || [];
    const objectWeightTotal = inventory.reduce((total, object) => {
        // NetHack's only coin denomination weighs one unit per 100 coins,
        // rounded after combining the entire inventory stack.
        if (object.oclass === 12)
            return total + Math.trunc((quantity(object) + 50) / 100);
        return total + objectWeight(object);
    }, 0);
    // The JS port keeps purse gold in `_goldCount` rather than a COIN_CLASS
    // inventory object.  It still contributes the same rounded stack weight
    // to source inv_weight(); avoid double counting if a restored state does
    // contain an explicit coin object.
    const hasCoinObject = inventory.some(object => object.oclass === 12);
    const purseWeight = hasCoinObject ? 0
        : Math.trunc(((state._goldCount ?? 0) + 50) / 100);
    return objectWeightTotal + purseWeight;
}

export function weightCapacity(state) {
    const stats = state.u?.acurr?.a || [];
    const strength = condensedStrength(currentAttribute(0, state));
    const constitution = stats[2] ?? 3;
    let capacity = 25 * (strength + constitution) + 50;
    if ((state.u?.mtimedone ?? 0) > 0
        && Number.isInteger(state.u?.umonnum)) {
        const mnum = state.u.umonnum;
        const bodyWeight = MONSTER_BODY_META[mnum]?.[0] ?? 0;
        const size = MONSTER_SIZE[mnum] ?? MZ_HUMAN;
        const strong = !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_STRONG);
        if (MONSTER_SYMBOL[mnum] === S_NYMPH) {
            capacity = 1000;
        } else if (!bodyWeight) {
            capacity = Math.trunc(capacity * size / MZ_HUMAN);
        } else if (!strong || bodyWeight > WT_HUMAN) {
            capacity = Math.trunc(capacity * bodyWeight / WT_HUMAN);
        }
    }
    // hack.c:weight_cap(): Air grants the same maximum carrying capacity as
    // levitation, and that shortcut precedes wounded-leg reductions.
    if (Is_airlevel(state.u?.uz)) capacity = 1000;
    else if (state.u?._woundedLegSide === 'both') capacity -= 200;
    else if (state.u?._woundedLegSide) capacity -= 100;
    return Math.max(1, Math.min(1000, capacity));
}

export function invWeight(state) {
    return inventoryWeight(state) - weightCapacity(state);
}

export function calcCapacity(state, extraWeight = 0) {
    const capacity = weightCapacity(state);
    const excess = invWeight(state) + extraWeight;
    if (excess <= 0) return UNENCUMBERED;
    if (capacity <= 1) return OVERLOADED;
    return Math.min(Math.trunc(excess * 2 / capacity) + 1, OVERLOADED);
}

export function nearCapacity(state) {
    return calcCapacity(state, 0);
}

// C hack.c:check_capacity().  Keep the shared threshold separate from the
// caller-owned message so commands can reject before opening their UI.
export function exceedsActionCapacity(state) {
    return nearCapacity(state) >= EXT_ENCUMBER;
}

export function encumbranceLabel(level) {
    return ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'][level]
        || '';
}

export function encumbranceMessage(previous, current) {
    if (previous < current) {
        return [
            '',
            'Your movements are slowed slightly because of your load.',
            'You rebalance your load.  Movement is difficult.',
            'You stagger under your heavy load.  Movement is very hard.',
            'You can barely move a handspan with this load!',
            "You can't even move a handspan with this load!",
        ][current] || '';
    }
    if (previous > current) {
        return [
            'Your movements are now unencumbered.',
            'Your movements are only slowed slightly by your load.',
            'You rebalance your load.  Movement is still difficult.',
            'You stagger under your load.  Movement is still very hard.',
            '',
            '',
        ][current] || '';
    }
    return '';
}

export function pickupLoadPrefix(level) {
    return [
        '',
        'You have a little trouble',
        'You have trouble',
        'You have much trouble',
        'You have extreme difficulty',
        'You have extreme difficulty',
    ][level] || '';
}
