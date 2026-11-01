// Native eat.c:doeat(), start_eating(), bite(), eatfood(), and done_eating().
import { A_INT, M_ATTK_AGR_DIED, M_ATTK_HIT, M_ATTK_MISS, SATIATED, Upolyd } from './const.js';
import { finishEnvironmentalMonsterDeath, prepareMonsterPetrification } from './mon.js';
import { applyCorpsePostEffects, applyCorpsePreEffects } from './corpse_eating.js';
import { prepareCorpseMeal } from './corpse_meal.js';
import { plineWithContinuation as pline } from './pline.js';
import { recordFoodConsumption, recordOrdinaryFoodDiet } from './food_conduct.js';
import { consumeFoodObject, consumeRemainingFood, foodNutrition, touchFoodObject, } from './food_lifecycle.js';
import { selectFoodToEat } from './food_selection.js';
import { handleFoodAdmission } from './nonfood_eating.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS2, MONSTER_NAME, monsterIsMindless, monsterIsNoncorporeal, monsterIsRider, requireMonsterData, } from './monster_data.js';
import { monsterName, possessiveName } from './monster_name.js';
import { canSeeMonster, canSpotMonster } from './display.js';
import { exerciseWisdom } from './attrib.js';
import { fleshPetrifies } from './stoning.js';
import { finishMonsterAttackDeath } from './monster_attack_death.js';
import { propertyIsActive } from './properties.js';
import { formatFeltMessage } from './hero_speech.js';
import { chokeHeroOnFood, currentHungerState, gainHeroNutrition, updateHeroHunger } from './hunger.js';
import { inventoryItemDescription } from './invent.js';
import { CORPSE, CRAM_RATION, FORTUNE_COOKIE, LEMBAS_WAFER, OBJECT_DELAY, TIN, requireObjectData } from './object_data.js';
import { foodObjectName } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { applyOrdinaryFoodFirstBite, applyOrdinaryFoodPostEffects, applyRottenFood, } from './ordinary_food_effects.js';
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
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    if (food.otyp === TIN) {
        await startTin(food, { state });
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    const firstFoodLogged = recordFoodConsumption(food, { state });
    const partlyEaten = !!food.oeaten;
    const preparedFood = await touchFoodObject(food, { state });
    if (!preparedFood) {
        await resetFoodMeal(state);
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    food = preparedFood;
    const meal = {
        key: 'eat-food', piece: preparedFood, o_id: food.o_id,
        usedtime: 0, reqtime: 0, nmod: 0,
        canchoke: false, fullwarn: false, eating: false, doreset: false,
    };
    state.context.victual = meal;
    let dontStart = false;
    if (food.otyp === CORPSE || food.globby) {
        const result = await prepareCorpseMeal(food, { state });
        if (result === 'dead')
            return;
        if (result === 'consumed') {
            state.context.victual = null;
            state.context.move = 1;
            return;
        }
        dontStart = result === 'delayed';
    }
    else {
        await recordOrdinaryFoodDiet(food, { state, firstFoodLogged });
        meal.reqtime = requireObjectData(OBJECT_DELAY, food.otyp);
        if (ordinaryFoodIsRotten(food, state)) {
            dontStart = await applyRottenFood(food, { state });
            if (dontStart)
                food.orotten = true;
            await consumeRemainingFood(food, 1, { state });
        }
        else if (!partlyEaten) {
            const effect = await applyOrdinaryFoodFirstBite(food, { state });
            if (effect.heroDied)
                return;
            if (!effect.continueMeal) {
                await resetFoodMeal(state);
                state.context.move = 1;
                return;
            }
        }
        else {
            await pline(`You ${meal.reqtime === 1 ? 'eat' : 'begin eating'} ${await inventoryItemDescription(food)}.`);
        }
    }
    const nutrition = foodNutrition(food);
    meal.reqtime = nutrition ? roundNutritionTime(meal.reqtime * preparedFood.oeaten, nutrition) : 0;
    meal.nmod = !meal.reqtime || !preparedFood.oeaten ? 0
        : preparedFood.oeaten >= meal.reqtime ? -Math.trunc(preparedFood.oeaten / meal.reqtime)
            : meal.reqtime % preparedFood.oeaten;
    meal.canchoke = currentHungerState(state) === SATIATED;
    if (dontStart)
        food.owt = objectWeight(food);
    else
        await startFoodMeal(preparedFood, partlyEaten, state);
    if (!state.program_state.gameover)
        state.context.move = 1;
}
async function resumeFoodMeal(originalFood, state) {
    const meal = currentFoodMeal(state);
    const lastBite = meal.usedtime + 1 >= meal.reqtime;
    if (currentHungerState(state) !== SATIATED)
        meal.canchoke = false;
    meal.o_id = 0;
    const food = await touchFoodObject(originalFood, { state });
    if (food) {
        meal.piece = food;
        meal.o_id = food.o_id;
    }
    else
        await resetFoodMeal(state);
    if (state.program_state.gameover)
        return;
    await pline(`You ${lastBite ? 'consume the last bite of' : 'resume'} your meal.`);
    if (food)
        await startFoodMeal(food, false, state);
}
async function startFoodMeal(food, partlyEaten, state) {
    const meal = currentFoodMeal(state);
    meal.fullwarn = meal.doreset = false;
    meal.eating = true;
    if (food.otyp === CORPSE || food.globby) {
        const effect = await applyCorpsePreEffects(corpseSpecies(food), { state, food });
        if (effect.stopped || !state.context.victual?.piece || !meal.eating)
            return;
    }
    const oldMessage = state._helplessDoneMessage;
    if (await takeFoodBite(state)) {
        if (state.program_state.gameover)
            return;
        if (++meal.usedtime >= meal.reqtime) {
            const chokingMessage = state._helplessDoneMessage;
            if (!oldMessage)
                state._helplessDoneMessage = null;
            await finishFoodMeal(state, false);
            if (!oldMessage) {
                if (chokingMessage === undefined)
                    delete state._helplessDoneMessage;
                else
                    state._helplessDoneMessage = chokingMessage;
            }
        }
        return;
    }
    if (state.program_state.gameover)
        return;
    if (++meal.usedtime >= meal.reqtime) {
        await finishFoodMeal(state, meal.reqtime > 1 || partlyEaten);
        return;
    }
    meal.text = `eating ${foodObjectName(food, { state, definite: true })}`;
    state._occupation = { key: 'eat-food', text: meal.text };
}
// C eat.c:eatfood().
export async function continueFoodMeal(_occupation, state = game) {
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
    if (choked || state.program_state.gameover)
        state._occupation = null;
    return !choked && !state.program_state.gameover;
}
// C eat.c:bite().
// C eat.c:recalc_wt().
async function takeFoodBite(state) {
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
            if (state.program_state.gameover)
                return true;
            await consumeRemainingFood(currentMealFood(meal), meal.nmod, { state });
        }
        else if (meal.nmod > 0 && meal.usedtime % meal.nmod) {
            await gainHeroNutrition(1, { state });
            if (state.program_state.gameover)
                return true;
            await consumeRemainingFood(currentMealFood(meal), -1, { state });
        }
    }
    finally {
        delete state.context.forceSaveHungerState;
    }
    const food = currentMealFood(meal);
    food.owt = objectWeight(food);
    return false;
}
// C eat.c:done_eating().
async function finishFoodMeal(state, showMessage) {
    const food = currentMealFood(currentFoodMeal(state));
    food.in_use = true;
    state._occupation = null;
    await updateHeroHunger(false, { state });
    if (state.program_state.gameover)
        return;
    if (state._helplessDoneMessage) {
        if (showMessage)
            await pline(state._helplessDoneMessage);
        state._helplessDoneMessage = null;
    }
    else if (showMessage) {
        const verb = MONSTER_NAME[heroSpecies(state)] === 'fire elemental' ? 'consuming' : 'eating';
        await pline(`You finish ${verb} ${foodObjectName(food, { state, definite: true })}.`);
    }
    if (food.otyp === CORPSE || food.globby)
        await applyCorpsePostEffects(corpseSpecies(food), { state });
    else
        await applyOrdinaryFoodPostEffects(food, { state });
    if (state.program_state.gameover)
        return;
    await consumeFoodObject(food, { state });
    state.context.victual = null;
}
async function resetFoodMeal(state) {
    const meal = state.context.victual;
    if (meal?.piece && meal.piece.where !== 'gone') {
        meal.o_id = 0;
        meal.piece = await touchFoodObject(meal.piece, { state });
        if (meal.piece) {
            meal.o_id = meal.piece.o_id;
            meal.piece.owt = objectWeight(meal.piece);
        }
    }
    if (meal)
        meal.fullwarn = meal.eating = meal.doreset = false;
    await stopHeroOccupation(state);
    if (!state.program_state.gameover)
        await updateHeroHunger(false, { state });
}
function ordinaryFoodIsRotten(food, state) {
    if (food.otyp === FORTUNE_COOKIE)
        return false;
    if (food.cursed)
        return true;
    return ![LEMBAS_WAFER, CRAM_RATION].includes(food.otyp)
        && state.moves - food.age > (food.blessed ? 50 : 30)
        && (food.orotten || !rn2(7));
}
function roundNutritionTime(value, divisor) {
    const quotient = Math.trunc(value / divisor);
    return quotient + Number(2 * (value % divisor) >= divisor);
}
// C eat.c:adj_victual_nutrition().
function adjustedBiteNutrition(meal, state) {
    let nutrition = -meal.nmod;
    const race = requireMonsterData(MONSTER_FLAGS2, heroSpecies(state));
    const food = currentMealFood(meal);
    const elf = Upolyd(state.u) ? race & M2_ELF : state.urace.name === 'elf';
    const orc = Upolyd(state.u) ? race & M2_ORC : state.urace.name === 'orc';
    const dwarf = Upolyd(state.u) ? race & M2_DWARF : state.urace.name === 'dwarf';
    if (food.otyp === LEMBAS_WAFER) {
        if (elf)
            nutrition += Math.trunc((nutrition + 2) / 4);
        else if (orc)
            nutrition -= Math.trunc((nutrition + 2) / 4);
    }
    else if (food.otyp === CRAM_RATION && dwarf) {
        nutrition += Math.trunc((nutrition + 3) / 6);
    }
    return Math.max(nutrition, 1);
}
function currentFoodMeal(state) {
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food')
        throw new Error('No food meal is active');
    return meal;
}
function currentMealFood(meal) {
    if (!meal.piece)
        throw new Error(`The current meal no longer has food object ${meal.o_id}`);
    return meal.piece;
}
function corpseSpecies(food) {
    if (food.corpsenm === undefined)
        throw new Error(`Corpse ${food.o_id} has no species`);
    return food.corpsenm;
}
// C eat.c:eat_brains(), monster mind flayer eating the hero's brain.
// Called from uhitm.ts (mhitm_ad_drin()'s hero branch).
export async function eatHeroBrain(monster, attack, state, publish, rollOne) {
    rollOne(10);
    const body = { mnum: heroSpecies(state) };
    if (monsterIsNoncorporeal(body)) {
        await publish('Your brain is unharmed.');
        return false;
    }
    await publish('Your brain is eaten!');
    if (fleshPetrifies(body.mnum)) {
        if (canSeeMonster(monster))
            await publish(`${monsterName(monster, { state, capitalized: true })} turns to stone!`);
        const stone = await prepareMonsterPetrification(monster, { publish });
        if (stone.survived)
            return false;
        await finishEnvironmentalMonsterDeath(monster, state, {
            noCorpse: true, stoneRemains: stone.remains ?? null, publish,
        });
        return true;
    }
    const attributes = state.u.acurr?.a;
    if (!attributes)
        throw new Error('Brain drain requires initialized hero attributes');
    const minimum = state.urace.attrmin[A_INT];
    if (attributes[A_INT] <= minimum) {
        const options = { attribution: {
                kind: 'death-inflicted-by', killer: 'brainlessness', deathCause: 'killed by brainlessness',
            } };
        if (propertyIsActive('lifeSaving', state) || state.u.lifeSaving) {
            if (await finishMonsterAttackDeath(monster, options)) {
                attack.heroDied = true;
                return false;
            }
            await publish('Unfortunately your brain is still gone.');
        }
        else
            await publish('Your last thought fades away.');
        if (await finishMonsterAttackDeath(monster, options)) {
            attack.heroDied = true;
            return false;
        }
        attributes[A_INT] = minimum + 2;
        await publish(formatFeltMessage('like a scarecrow.', state));
    }
    exerciseWisdom(false, state);
    if (monster.mtame && !monster.isminion) {
        const pet = monster.edog ?? monster.mextra?.edog;
        if (!pet)
            throw new Error('A brain-eating pet needs feeding state');
        pet.hungrytime += rollOne(60);
        monster.mconf = 0;
    }
    return true;
}
export async function eatMonsterBrain(attacker, defender, damage, { state, visible, random, rollOne, publish, finishDeath }) {
    const extraDamage = rollOne(10);
    if (attacker.mhp <= 0)
        return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: false };
    if (monsterIsNoncorporeal(defender)) {
        if (visible) {
            const name = possessiveName(monsterName(defender, { state, capitalized: true }));
            await publish(`${name} brain is unharmed.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
    }
    if (visible && canSpotMonster(defender)) {
        const name = possessiveName(monsterName(defender, { state, capitalized: true }));
        await publish(`${name} brain is eaten!`);
    }
    if (fleshPetrifies(defender.mnum)) {
        if (visible && canSeeMonster(attacker)) {
            await publish(`${monsterName(attacker, { state, capitalized: true })} turns to stone!`);
        }
        // eat_brains calls monstone directly: no food cure, resistance check,
        // or golem conversion precedes its life-saving and statue handling.
        const stone = await prepareMonsterPetrification(attacker, { publish });
        if (stone.heroDied)
            return { damage, hitFlags: M_ATTK_MISS, heroDied: true };
        if (stone.survived)
            return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
        const death = await finishDeath(attacker, {
            noCorpse: true, stoneRemains: stone.remains ?? null, random, publish,
        });
        if (death.heroDied)
            return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: true };
        if (attacker.mtame && !visible) {
            await publish('You have a sad thought for a moment, then it passes.');
        }
        return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: false };
    }
    if (monsterIsMindless(defender.mnum)) {
        if (visible && canSpotMonster(defender)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} doesn't notice.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
    }
    if (monsterIsRider(defender)) {
        const death = await finishDeath(attacker, { random, publish });
        return {
            damage: damage + extraDamage,
            hitFlags: attacker.mhp <= 0 ? M_ATTK_AGR_DIED : M_ATTK_HIT,
            heroDied: !!death.heroDied,
        };
    }
    damage += extraDamage;
    if (damage >= defender.mhp && visible && canSpotMonster(defender)) {
        const name = possessiveName(monsterName(defender, { state, capitalized: true }));
        await publish(`${name} last thought fades away...`);
    }
    if (attacker.mtame && !attacker.isminion) {
        const pet = attacker.edog || attacker.mextra?.edog;
        if (!pet)
            throw new Error(`Brain-eating pet ${attacker.m_id} has no feeding state`);
        // Unlike a regular meal, brains do not reset an overdue deadline or
        // reverse the HP penalty from starvation.
        pet.hungrytime += rollOne(60);
        attacker.mconf = 0;
    }
    return { damage, hitFlags: M_ATTK_HIT, heroDied: false };
}
//# sourceMappingURL=eat.js.map