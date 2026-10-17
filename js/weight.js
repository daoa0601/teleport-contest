// weight.js — Hero inventory weight and carrying-capacity state.
// C refs: hack.c weight_cap(), inv_weight(), calc_capacity(), near_capacity().
import { BAG_OF_HOLDING, BOULDER, CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, HEAVY_IRON_BALL, ICE_BOX, LARGE_BOX, OBJECT_NUTRITION, OBJECT_WEIGHT, OILSKIN_SACK, SACK, STATUE, TALLOW_CANDLE, requireObjectData, } from './object_data.js';
import { MONSTER_BODY_META, MONSTER_FLAGS2, MONSTER_SIZE, MONSTER_SYMBOL, } from './monster_data.js';
import { A_CON, Is_airlevel, LARGEST_INT } from './const.js';
import { currentAttribute, currentStrength } from './attrib.js';
import { flyingSupportsLoad, levitationSupportsLoad } from './properties.js';
import { heroSpecies } from './hero_species.js';
import { monsterStagger } from './monster_locomotion.js';
export const UNENCUMBERED = 0;
export const SLT_ENCUMBER = 1;
export const MOD_ENCUMBER = 2;
export const HVY_ENCUMBER = 3;
export const EXT_ENCUMBER = 4;
export const OVERLOADED = 5;
const M2_STRONG = 0x04000000;
const M2_ROCKTHROW = 0x08000000;
const S_NYMPH = 14;
const MZ_HUMAN = 2;
const WT_HUMAN = 1450;
const WEIGHTED_CONTENT_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING, STATUE,
]);
function quantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
export function objectWeight(object) {
    if (!object)
        return 0;
    // C stores a stack's complete weight in owt.  Several early JS object
    // constructors still leave owt at the one-item metadata value after
    // changing quan, so reconstruct ordinary stack weight from the table.
    const base = requireObjectData(OBJECT_WEIGHT, object.otyp);
    const count = quantity(object);
    if (count < 1)
        return 0;
    const species = object.corpsenm;
    const uneatenNutrition = object.oeaten ?? 0;
    // A top-level coin stack is treated specially by inv_weight(), but coin
    // inside a container reaches mkobj.c:weight() and therefore weighs at
    // least one unit even below 50 pieces.
    if (object.oclass === 12)
        return Math.max(1, Math.trunc((quantity(object) + 50) / 100));
    // C mkobj.c:weight(): globs keep quantity one while absorption and
    // SHRINK_GLOB mutate their complete weight directly in owt.  This check
    // precedes partly-eaten food scaling because oeaten is also glob mass.
    if (object.globby)
        return object.owt ?? base ?? 0;
    if (object.otyp === CORPSE && species !== undefined
        && Number.isInteger(species) && species >= 0 && species < MONSTER_BODY_META.length) {
        const [bodyWeight = 0, nutrition = 0] = MONSTER_BODY_META[species] || [];
        const fullWeight = Math.min(LARGEST_INT, bodyWeight * count);
        if (uneatenNutrition > 0) {
            return Math.max(1, nutrition > 0
                ? Math.trunc(fullWeight * Math.min(uneatenNutrition, nutrition) / nutrition)
                : 0);
        }
        return fullWeight;
    }
    // C mkobj.c:weight()->eaten_stat() scales partly eaten food by its
    // remaining nutrition per item, including stacks of partly eaten wishes.
    if (object.oclass === 7 && uneatenNutrition > 0 && base > 0) {
        const fullNutrition = OBJECT_NUTRITION[object.otyp] ?? 0;
        if (fullNutrition > 0) {
            return Math.max(1, Math.trunc(base * count * Math.min(uneatenNutrition, fullNutrition) / fullNutrition));
        }
    }
    if (WEIGHTED_CONTENT_TYPES.has(object.otyp)) {
        let ownWeight = base || object.owt || 0;
        if (object.otyp === STATUE && species !== undefined
            && Number.isInteger(species) && species >= 0 && species < MONSTER_BODY_META.length) {
            const bodyWeight = MONSTER_BODY_META[species]?.[0] ?? 0;
            const size = MONSTER_SIZE[species] ?? 0;
            ownWeight = Math.max(Math.trunc(3 * bodyWeight / 2), (2 * size + 1) * 100) * quantity(object);
        }
        let contentsWeight = (object.contents || []).reduce((total, content) => total + objectWeight(content), 0);
        if (object.otyp === BAG_OF_HOLDING) {
            contentsWeight = object.cursed ? contentsWeight * 2
                : object.blessed ? Math.trunc((contentsWeight + 3) / 4)
                    : Math.trunc((contentsWeight + 1) / 2);
        }
        return ownWeight + contentsWeight;
    }
    if (object.otyp === HEAVY_IRON_BALL && object.owt)
        return object.owt;
    if (object.otyp === CANDELABRUM_OF_INVOCATION && object.spe)
        return (base || 0) + object.spe * (OBJECT_WEIGHT[TALLOW_CANDLE] || 0);
    if (base > 0)
        return base * quantity(object);
    return Math.trunc((count + 1) / 2);
}
export function inventoryWeight(state) {
    const inventory = state.inventory || [];
    const species = state.u.umonnum;
    const throwsRocks = species !== undefined && Number.isInteger(species)
        && !!((MONSTER_FLAGS2[species] ?? 0) & M2_ROCKTHROW);
    const objectWeightTotal = inventory.reduce((total, object) => {
        // NetHack's only coin denomination weighs one unit per 100 coins,
        // rounded after combining the entire inventory stack.
        if (object.oclass === 12)
            return total + Math.trunc((quantity(object) + 50) / 100);
        if (object.otyp === BOULDER && throwsRocks)
            return total;
        return total + objectWeight(object);
    }, 0);
    return objectWeightTotal;
}
export function weightCapacity(state) {
    const strength = currentStrength(state);
    const constitution = currentAttribute(A_CON, state);
    let capacity = 25 * (strength + constitution) + 50;
    const mnum = state.u.umonnum;
    if ((state.u?.mtimedone ?? 0) > 0
        && mnum !== undefined && Number.isInteger(mnum)) {
        const bodyWeight = MONSTER_BODY_META[mnum]?.[0] ?? 0;
        const size = MONSTER_SIZE[mnum] ?? MZ_HUMAN;
        const strong = !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_STRONG);
        if (MONSTER_SYMBOL[mnum] === S_NYMPH) {
            capacity = 1000;
        }
        else if (!bodyWeight) {
            capacity = Math.trunc(capacity * size / MZ_HUMAN);
        }
        else if (!strong || bodyWeight > WT_HUMAN) {
            capacity = Math.trunc(capacity * bodyWeight / WT_HUMAN);
        }
    }
    const steedMnum = state.u?.usteed?.mnum;
    const strongSteed = steedMnum !== undefined && Number.isInteger(steedMnum)
        && !!((MONSTER_FLAGS2[steedMnum] ?? 0) & M2_STRONG);
    const dressing = state._delayedAction;
    const bootsPending = dressing?.kind === 'wear'
        && dressing.object === (state.uarmf ?? state.u.uarmf);
    const levitating = levitationSupportsLoad(bootsPending, state)
        || !bootsPending && !!(state.u.levitating || state.u.levitation || state.levitating);
    if (levitating || Is_airlevel(state.u?.uz) || strongSteed) {
        capacity = 1000;
    }
    else {
        capacity = Math.min(1000, capacity);
        const flying = flyingSupportsLoad(bootsPending, state)
            || !bootsPending && !!(state.u.flying || state.flying);
        if (!flying) {
            if (state.u?._woundedLegSide === 'both')
                capacity -= 200;
            else if (state.u?._woundedLegSide)
                capacity -= 100;
        }
    }
    return Math.max(1, Math.min(1000, capacity));
}
export function invWeight(state) {
    return inventoryWeight(state) - weightCapacity(state);
}
export function calcCapacity(state, extraWeight = 0) {
    const capacity = weightCapacity(state);
    const excess = invWeight(state) + extraWeight;
    if (excess <= 0)
        return UNENCUMBERED;
    if (capacity <= 1)
        return OVERLOADED;
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
// C pickup.c:encumber_msg(). The strained verb follows the hero's body.
export function encumbranceMessage(previous, current, state) {
    const stagger = monsterStagger(heroSpecies(state), 'stagger');
    if (previous < current) {
        return [
            '',
            'Your movements are slowed slightly because of your load.',
            'You rebalance your load.  Movement is difficult.',
            `You ${stagger} under your heavy load.  Movement is very hard.`,
            'You can barely move a handspan with this load!',
            "You can't even move a handspan with this load!",
        ][current] || '';
    }
    if (previous > current) {
        return [
            'Your movements are now unencumbered.',
            'Your movements are only slowed slightly by your load.',
            'You rebalance your load.  Movement is still difficult.',
            `You ${stagger} under your load.  Movement is still very hard.`,
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
//# sourceMappingURL=weight.js.map