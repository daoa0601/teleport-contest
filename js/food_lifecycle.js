// Native eat.c:touchfood(), obj_nutrition(), and food consumption boundaries.
import { game, requireLiveGame, requireGameLevel } from './gstate.js';
import { impossible } from './diagnostics.js';
import { consumeInventoryItem } from './invent.js';
import { freeInventoryObject, useUpInventoryStack } from './hero_inventory.js';
import { useUpFloorObject } from './floor_consumption.js';
import { MONSTER_BODY_META, MONSTER_FLAGS1, requireMonsterData } from './monster_data.js';
import { CORPSE, EGG, GOLD_PIECE, OBJECT_NUTRITION, TIN, requireObjectData } from './object_data.js';
import { dropObjectAtHero } from './object_drop.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { chargeAlteredUnpaidObject } from './shk.js';
import { SELL_DONTSELL, SELL_NORMAL, setSellDisposition } from './shop_sell.js';
import { fleshPetrifies } from './stoning.js';
import { addInventoryItem } from './u_init.js';
const M1_ACID = 0x08000000;
export function foodNutrition(food) {
    if (food.otyp === CORPSE) {
        const species = food.corpsenm;
        return species === undefined ? 0 : MONSTER_BODY_META[species]?.[1] ?? 0;
    }
    return food.globby ? food.owt : requireObjectData(OBJECT_NUTRITION, food.otyp);
}
// Native consume_oeaten(): positive adjustments divide by a power of two;
// negative adjustments subtract a bite. Zero remains reserved for untouched food.
export async function consumeRemainingFood(food, adjustment, { state = game } = {}) {
    if (!foodNutrition(food)) {
        const type = food.otyp === CORPSE ? 'corpse' : food.otyp === EGG ? 'egg'
            : food.otyp === TIN ? 'tin' : null;
        const name = type ? `${type} [${food.corpsenm}]` : String(food.otyp);
        await impossible(`oeaten: attempting to set 0 nutrition food (${name}) partially eaten`, { state });
        return;
    }
    requirePreparedFood(food);
    food.oeaten = adjustment > 0 ? food.oeaten >>> adjustment
        : Math.max(0, food.oeaten + adjustment);
    if (!food.oeaten) {
        const meal = state.context.victual;
        if (meal?.piece === food)
            meal.reqtime = meal.usedtime;
        food.oeaten = 1;
    }
}
export async function consumeFoodObject(food, { all = false, state = game } = {}) {
    requireLiveGame(state);
    if (food.where === 'inventory') {
        if (all)
            await useUpInventoryStack(food, state);
        else
            await consumeInventoryItem(food, state);
    }
    else {
        await useUpFloorObject(food, all ? objectQuantity(food) : 1, { state });
    }
}
// A bite splits the actual stack, including its timers and unpaid bill.
// A carried bite is reinserted without merging; a full pack drops it instead.
export async function touchFoodObject(food, { state = game } = {}) {
    requireLiveGame(state);
    const carried = food.where === 'inventory';
    const quantity = objectQuantity(food);
    if (quantity > 1) {
        const split = splitObjectStack(food, carried ? 1 : quantity - 1, state);
        if (!split)
            throw new Error(`Food stack ${food.o_id} could not be split`);
        if (carried)
            food = split;
    }
    if (!food.oeaten) {
        await chargeAlteredUnpaidObject(food, 'bite', state);
        food.oeaten = foodNutrition(food);
    }
    if (carried) {
        await freeInventoryObject(food, state);
        if (state.program_state.gameover)
            return null;
        const slots = state.inventory.filter(object => object.otyp !== GOLD_PIECE).length;
        if (slots >= 52) {
            setSellDisposition(SELL_DONTSELL);
            try {
                await dropObjectAtHero(food, { state });
            }
            finally {
                setSellDisposition(SELL_NORMAL);
            }
            if (food.where === 'gone')
                return null;
        }
        else {
            const noMerge = food.nomerge;
            food.nomerge = true;
            const carriedFood = await addInventoryItem(food, null, false);
            if (!carriedFood)
                throw new Error(`Food ${food.o_id} could not be returned to inventory`);
            food = carriedFood;
            if (noMerge === undefined)
                delete food.nomerge;
            else
                food.nomerge = noMerge;
        }
    }
    requirePreparedFood(food);
    return food;
}
export function eatingDangerousCorpse(property, { state = game } = {}) {
    if (state._occupation?.key !== 'eat-food')
        return false;
    const food = state.context.victual?.piece;
    if (food?.otyp !== CORPSE || food.corpsenm === undefined || food.corpsenm < 0)
        return false;
    const available = food.where === 'inventory'
        || food.where === 'floor' && food.ox === state.u.ux && food.oy === state.u.uy
            && requireGameLevel(state).objects[food.ox]?.[food.oy]?.includes(food);
    if (!available)
        return false;
    return property === 'acidResistance' ? !!(requireMonsterData(MONSTER_FLAGS1, food.corpsenm) & M1_ACID)
        : property === 'stoneResistance' && fleshPetrifies(food.corpsenm);
}
export function requirePreparedFood(food) {
    if (food.oeaten === undefined)
        throw new Error(`Food ${food.o_id} has not been prepared for eating`);
}
//# sourceMappingURL=food_lifecycle.js.map