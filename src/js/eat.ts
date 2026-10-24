// Native eat.c:doeat(), start_eating(), bite(), eatfood(), and done_eating().
import { SATIATED, Upolyd } from './const.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { FoodMeal, FoodOccupation, PreparedFoodObject } from './occupation_types.js';
import { applyCorpsePostEffects, applyCorpsePreEffects } from './corpse_eating.js';
import { prepareCorpseMeal } from './corpse_meal.js';
import { plineWithContinuation as pline } from './display.js';
import { recordFoodConsumption, recordOrdinaryFoodDiet } from './food_conduct.js';
import {
    consumeFoodObject, consumeRemainingFood, foodNutrition, touchFoodObject,
} from './food_lifecycle.js';
import { selectFoodToEat } from './food_selection.js';
import { handleFoodAdmission } from './nonfood_eating.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { chokeHeroOnFood, currentHungerState, gainHeroNutrition, updateHeroHunger } from './hunger.js';
import { inventoryItemDescription } from './invent.js';
import { MONSTER_FLAGS2, MONSTER_NAME, requireMonsterData } from './monster_data.js';
import { CORPSE, CRAM_RATION, FORTUNE_COOKIE, LEMBAS_WAFER, OBJECT_DELAY, TIN, requireObjectData } from './object_data.js';
import { foodObjectName } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import {
    applyOrdinaryFoodFirstBite, applyOrdinaryFoodPostEffects, applyRottenFood,
} from './ordinary_food_effects.js';
import { rn2 } from './rng.js';
import { startTin } from './tin.js';
import { objectWeight } from './weight.js';

const M2_ELF = 0x00000010, M2_DWARF = 0x00000020, M2_ORC = 0x00000080;

export async function doeat() {
    const state = game;
    requirePlayingGame(state);
    const selection = await selectFoodToEat({ state });
    if (!selection) {
        state.context.move = 0;
        return;
    }
    const admission = await handleFoodAdmission(selection, { state });
    if (admission.handled) {
        state.context.move = admission.heroDied ? 0 : Number(admission.spentTime);
        return;
    }
    let food = admission.food;
    if (food === state.context.victual?.piece) {
        await resumeFoodMeal(food, state);
        if (!state.program_state.gameover) state.context.move = 1;
        return;
    }
    if (food.otyp === TIN) {
        await startTin(food, { state });
        if (!state.program_state.gameover) state.context.move = 1;
        return;
    }

    const firstFoodLogged = recordFoodConsumption(food, { state });
    const partlyEaten = !!food.oeaten;
    const preparedFood = await touchFoodObject(food, { state });
    if (!preparedFood) {
        await resetFoodMeal(state);
        if (!state.program_state.gameover) state.context.move = 1;
        return;
    }
    food = preparedFood;
    const meal: FoodMeal = {
        key: 'eat-food', piece: preparedFood, o_id: food.o_id,
        usedtime: 0, reqtime: 0, nmod: 0,
        canchoke: false, fullwarn: false, eating: false, doreset: false,
    };
    state.context.victual = meal;
    let dontStart = false;
    if (food.otyp === CORPSE || food.globby) {
        const result = await prepareCorpseMeal(food, { state });
        if (result === 'dead') return;
        if (result === 'consumed') {
            state.context.victual = null;
            state.context.move = 1;
            return;
        }
        dontStart = result === 'delayed';
    } else {
        await recordOrdinaryFoodDiet(food, { state, firstFoodLogged });
        meal.reqtime = requireObjectData(OBJECT_DELAY, food.otyp);
        if (ordinaryFoodIsRotten(food, state)) {
            dontStart = await applyRottenFood(food, { state });
            if (dontStart) food.orotten = true;
            await consumeRemainingFood(food, 1, { state });
        } else if (!partlyEaten) {
            const effect = await applyOrdinaryFoodFirstBite(food, { state });
            if (effect.heroDied) return;
            if (!effect.continueMeal) {
                await resetFoodMeal(state);
                state.context.move = 1;
                return;
            }
        } else {
            await pline(`You ${meal.reqtime === 1 ? 'eat' : 'begin eating'} ${await inventoryItemDescription(food)}.`);
        }
    }
    const nutrition = foodNutrition(food);
    meal.reqtime = nutrition ? roundNutritionTime(meal.reqtime * preparedFood.oeaten, nutrition) : 0;
    meal.nmod = !meal.reqtime || !preparedFood.oeaten ? 0
        : preparedFood.oeaten >= meal.reqtime ? -Math.trunc(preparedFood.oeaten / meal.reqtime)
            : meal.reqtime % preparedFood.oeaten;
    meal.canchoke = currentHungerState(state) === SATIATED;
    if (dontStart) food.owt = objectWeight(food);
    else await startFoodMeal(preparedFood, partlyEaten, state);
    if (!state.program_state.gameover) state.context.move = 1;
}

async function resumeFoodMeal(originalFood: GameObject, state: PlayingGameState) {
    const meal = currentFoodMeal(state);
    const lastBite = meal.usedtime + 1 >= meal.reqtime;
    if (currentHungerState(state) !== SATIATED) meal.canchoke = false;
    meal.o_id = 0;
    const food = await touchFoodObject(originalFood, { state });
    if (food) {
        meal.piece = food;
        meal.o_id = food.o_id;
    } else await resetFoodMeal(state);
    if (state.program_state.gameover) return;
    await pline(`You ${lastBite ? 'consume the last bite of' : 'resume'} your meal.`);
    if (food) await startFoodMeal(food, false, state);
}

async function startFoodMeal(food: PreparedFoodObject, partlyEaten: boolean, state: PlayingGameState) {
    const meal = currentFoodMeal(state);
    meal.fullwarn = meal.doreset = false;
    meal.eating = true;
    if (food.otyp === CORPSE || food.globby) {
        const effect = await applyCorpsePreEffects(corpseSpecies(food), { state, food });
        if (effect.stopped || !state.context.victual?.piece || !meal.eating) return;
    }
    const oldMessage = state._helplessDoneMessage;
    if (await takeFoodBite(state)) {
        if (state.program_state.gameover) return;
        if (++meal.usedtime >= meal.reqtime) {
            const chokingMessage = state._helplessDoneMessage;
            if (!oldMessage) state._helplessDoneMessage = null;
            await finishFoodMeal(state, false);
            if (!oldMessage) {
                if (chokingMessage === undefined) delete state._helplessDoneMessage;
                else state._helplessDoneMessage = chokingMessage;
            }
        }
        return;
    }
    if (state.program_state.gameover) return;
    if (++meal.usedtime >= meal.reqtime) {
        await finishFoodMeal(state, meal.reqtime > 1 || partlyEaten);
        return;
    }
    meal.text = `eating ${foodObjectName(food, { state, definite: true })}`;
    state._occupation = { key: 'eat-food', text: meal.text };
}

export async function continueFoodMeal(_occupation: FoodOccupation, state: GameState = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const meal = state.context.victual;
    const food = meal?.piece;
    const available = food && (food.where === 'inventory'
        || food.where === 'floor' && food.ox === state.u.ux && food.oy === state.u.uy
            && state.level.objects[food.ox]?.[food.oy]?.includes(food));
    if (!available || !meal || meal.key !== 'eat-food') {
        await resetFoodMeal(state);
        return false;
    }
    if (!meal.eating) {
        state._occupation = null;
        return false;
    }
    if (++meal.usedtime > meal.reqtime) {
        await finishFoodMeal(state, true);
        return false;
    }
    const choked = await takeFoodBite(state);
    if (choked || state.program_state.gameover) state._occupation = null;
    return !choked && !state.program_state.gameover;
}

async function takeFoodBite(state: PlayingGameState) {
    const meal = currentFoodMeal(state);
    if (meal.canchoke && state.u.uhunger >= 2000) {
        await chokeHeroOnFood(meal.piece, { state });
        return true;
    }
    if (meal.doreset) {
        await resetFoodMeal(state);
        return false;
    }
    state.context.forceSaveHungerState = true;
    try {
        if (meal.nmod < 0) {
            await gainHeroNutrition(adjustedBiteNutrition(meal, state), { state });
            if (state.program_state.gameover) return true;
            await consumeRemainingFood(currentMealFood(meal), meal.nmod, { state });
        } else if (meal.nmod > 0 && meal.usedtime % meal.nmod) {
            await gainHeroNutrition(1, { state });
            if (state.program_state.gameover) return true;
            await consumeRemainingFood(currentMealFood(meal), -1, { state });
        }
    } finally {
        delete state.context.forceSaveHungerState;
    }
    const food = currentMealFood(meal);
    food.owt = objectWeight(food);
    return false;
}

async function finishFoodMeal(state: PlayingGameState, showMessage: boolean) {
    const food = currentMealFood(currentFoodMeal(state));
    food.in_use = true;
    state._occupation = null;
    await updateHeroHunger(false, { state });
    if (state.program_state.gameover) return;
    if (state._helplessDoneMessage) {
        if (showMessage) await pline(state._helplessDoneMessage);
        state._helplessDoneMessage = null;
    } else if (showMessage) {
        const verb = MONSTER_NAME[heroSpecies(state)] === 'fire elemental' ? 'consuming' : 'eating';
        await pline(`You finish ${verb} ${foodObjectName(food, { state, definite: true })}.`);
    }
    if (food.otyp === CORPSE || food.globby)
        await applyCorpsePostEffects(corpseSpecies(food), { state });
    else await applyOrdinaryFoodPostEffects(food, { state });
    if (state.program_state.gameover) return;
    await consumeFoodObject(food, { state });
    state.context.victual = null;
}

async function resetFoodMeal(state: PlayingGameState) {
    const meal = state.context.victual;
    if (meal?.piece && meal.piece.where !== 'gone') {
        meal.o_id = 0;
        meal.piece = await touchFoodObject(meal.piece, { state });
        if (meal.piece) {
            meal.o_id = meal.piece.o_id;
            meal.piece.owt = objectWeight(meal.piece);
        }
    }
    if (meal) meal.fullwarn = meal.eating = meal.doreset = false;
    await stopHeroOccupation(state);
    if (!state.program_state.gameover) await updateHeroHunger(false, { state });
}

function ordinaryFoodIsRotten(food: GameObject, state: GameState) {
    if (food.otyp === FORTUNE_COOKIE) return false;
    if (food.cursed) return true;
    return ![LEMBAS_WAFER, CRAM_RATION].includes(food.otyp)
        && state.moves - food.age > (food.blessed ? 50 : 30)
        && (food.orotten || !rn2(7));
}

function roundNutritionTime(value: number, divisor: number) {
    const quotient = Math.trunc(value / divisor);
    return quotient + Number(2 * (value % divisor) >= divisor);
}

function adjustedBiteNutrition(meal: FoodMeal, state: PlayingGameState) {
    let nutrition = -meal.nmod;
    const race = requireMonsterData(MONSTER_FLAGS2, heroSpecies(state));
    const food = currentMealFood(meal);
    const elf = Upolyd(state.u) ? race & M2_ELF : state.urace.name === 'elf';
    const orc = Upolyd(state.u) ? race & M2_ORC : state.urace.name === 'orc';
    const dwarf = Upolyd(state.u) ? race & M2_DWARF : state.urace.name === 'dwarf';
    if (food.otyp === LEMBAS_WAFER) {
        if (elf) nutrition += Math.trunc((nutrition + 2) / 4);
        else if (orc) nutrition -= Math.trunc((nutrition + 2) / 4);
    } else if (food.otyp === CRAM_RATION && dwarf) {
        nutrition += Math.trunc((nutrition + 3) / 6);
    }
    return Math.max(nutrition, 1);
}

function currentFoodMeal(state: GameState): FoodMeal {
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food') throw new Error('No food meal is active');
    return meal;
}

function currentMealFood(meal: FoodMeal): PreparedFoodObject {
    if (!meal.piece) throw new Error(`The current meal no longer has food object ${meal.o_id}`);
    return meal.piece;
}

function corpseSpecies(food: GameObject): number {
    if (food.corpsenm === undefined)
        throw new Error(`Corpse ${food.o_id} has no species`);
    return food.corpsenm;
}
