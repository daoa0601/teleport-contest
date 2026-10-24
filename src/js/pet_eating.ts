import { currency } from './currency.js';
// A pet's meal, from nutritional recovery through the observable eating
// message to consumption. C refs: dogmove.c dog_nutrition() and dog_eat().
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import { canSeeMonster, canSpotMonster, monsterVisible, newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { foodNutrition } from './food_lifecycle.js';
import { inventoryItemDescription } from './invent.js';
import { MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE } from './monster_data.js';
import { consumeMonsterObject, feedBeeRoyalJelly } from './monster_consumption.js';
import { monsterName } from './monster_name.js';
import { CORPSE, LUMP_OF_ROYAL_JELLY, OBJECT_DELAY, OBJECT_NUTRITION } from './object_data.js';
import { objectName, observeDistantObjectForNaming } from './objnam.js';
import { splitObjectStack } from './object_stack.js';
import { DOGFOOD, dogFood } from './pet_food.js';
import { rn2 } from './rng.js';
import { chargeAlteredUnpaidObject, unpaidObjectCost } from './shk.js';
import { G_GENOD } from './const.js';
import { isPoolAt } from './terrain_properties.js';
import { cansee } from './vision.js';

export interface PetMeal {
    object: GameObject;
    from: Position;
    devour: boolean;
    royalJelly: boolean;
}

const FOOD_CLASS = 7;
const COIN_CLASS = 12;
const M1_TUNNEL = 0x00000020;

const PM_KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');

// dog_nutrition() also sets chewing time. Its denominator is the original
// food's nutrition, before the pet-size multiplier is applied.
export function petFoodNutrition(monster: Monster, object: GameObject): number {
    let nutrition: number;
    if (object.oclass === FOOD_CLASS) {
        let delay: number;
        if (object.otyp === CORPSE) {
            const body = object.corpsenm === undefined ? undefined : MONSTER_BODY_META[object.corpsenm];
            if (!body) throw new Error(`Corpse ${object.o_id} has no species nutrition`);
            delay = 3 + (body[0] >> 6);
            nutrition = body[1];
        } else {
            delay = OBJECT_DELAY[object.otyp] ?? 0;
            nutrition = OBJECT_NUTRITION[object.otyp] ?? 0;
        }
        const fullNutrition = foodNutrition(object);
        const size = MONSTER_SIZE[monster.mnum];
        const multiplier = size === 0 ? 8 : size === 1 ? 6
            : size === 3 ? 4 : size === 4 ? 3 : size === 7 ? 2 : 5;
        nutrition *= multiplier;
        if (object.oeaten) {
            const remaining = Math.min(object.oeaten, fullNutrition);
            delay = Math.max(1, fullNutrition ? Math.trunc(delay * remaining / fullNutrition) : 0);
            nutrition = Math.max(1, fullNutrition ? Math.trunc(nutrition * remaining / fullNutrition) : 0);
        }
        monster.meating = delay;
    } else if (object.oclass === COIN_CLASS) {
        // Quantity is a native long; these two results are signed ints.
        const delay = (Math.trunc(object.quan / 2000) + 1) | 0;
        monster.meating = delay < 0 ? 1 : delay;
        const coinNutrition = Math.trunc(object.quan / 20) | 0;
        nutrition = coinNutrition < 0 ? 0 : coinNutrition;
    } else {
        monster.meating = Math.trunc(object.owt / 20) + 1;
        nutrition = 5 * (OBJECT_NUTRITION[object.otyp] ?? 0);
    }
    return nutrition;
}

// Stoning cures share the deadline and confusion rules, but deliberately do
// not restore starvation HP, shorten flight, or reward ordinary feeding.
export function extendPetHungerDeadline(monster: Monster, nutrition: number, state: GameState): void {
    const dog = monster.edog;
    if (!dog) throw new Error(`Pet ${monster.m_id} has no feeding state`);
    dog.hungrytime = Math.max(dog.hungrytime, state.moves) + nutrition;
    monster.mconf = 0;
}

export function beginPetEating(
    monster: Monster, object: GameObject, from: Position,
    state: GameState = game, devour = false,
): PetMeal {
    const dog = monster.edog;
    if (!dog || !monster.mtame || monster.isminion)
        throw new Error(`Monster ${monster.m_id} is not an ordinary pet`);
    let nutrition = petFoodNutrition(monster, object);
    if (devour) {
        if ((monster.meating ?? 0) > 1)
            monster.meating = Math.trunc((monster.meating ?? 0) / 2);
        if (nutrition > 1) nutrition = Math.trunc(nutrition * 3 / 4);
    }
    extendPetHungerDeadline(monster, nutrition, state);
    monster.mhpmax += dog.mhpmax_penalty;
    dog.mhpmax_penalty = 0;
    if (monster.mflee && (monster.mfleetim ?? 0) > 1)
        monster.mfleetim = Math.trunc((monster.mfleetim ?? 0) / 2);
    if (monster.mtame < 20) monster.mtame++;

    const royalJelly = monster.mnum === PM_KILLER_BEE
        && object.otyp === LUMP_OF_ROYAL_JELLY
        && (!!((state.mvitals?.[PM_QUEEN_BEE]?.mvflags ?? 0) & G_GENOD)
            || !state.level?.monsters.some(candidate => candidate.mnum === PM_QUEEN_BEE
                && !candidate.dead && candidate.mhp > 0));
    return { object: royalJelly ? object : splitMealObject(object, state), from, devour, royalJelly };
}

function splitMealObject(object: GameObject, state: GameState): GameObject {
    if (object.oclass !== FOOD_CLASS || object.quan <= 1) return object;
    const split = splitObjectStack(object, 1, state);
    if (!split) throw new Error(`Pet meal ${object.o_id} could not split one food item`);
    // dog_eat's unit stays beside the stack until its message is acknowledged.
    return split;
}

async function describePetMeal(monster: Monster, meal: PetMeal, state: GameState): Promise<void> {
    if (isPoolAt(monster.mx, monster.my, state) && !state.underwater) return;
    const sawPet = cansee(meal.from.x, meal.from.y) && monsterVisible(monster);
    const seesObject = cansee(monster.mx, monster.my);
    if (!sawPet && !seesObject) return;
    const seesPet = sawPet || canSpotMonster(monster);
    observeDistantObjectForNaming(meal.object, state);
    const food = await inventoryItemDescription(meal.object);
    if (seesPet) {
        const subject = monsterName(monster, {
            state, article: 'your', capitalized: true, suppressIt: true,
        });
        if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_TUNNEL)
            await plineWithContinuation(`${subject} digs in.`);
        else await plineWithContinuation(`${subject} ${meal.devour ? 'devours' : 'eats'} ${food}.`);
    } else await plineWithContinuation(`It ${meal.devour ? 'devours' : 'eats'} ${food}.`);
}

export async function finishPetEating(
    monster: Monster, meal: PetMeal, state: GameState = game,
    random: RandomBelow = rn2, calls: MonsterCallLog = [],
): Promise<void> {
    if (meal.from.x !== monster.mx || meal.from.y !== monster.my) {
        newsym(meal.from.x, meal.from.y);
        newsym(monster.mx, monster.my);
    }
    const object = meal.object;
    if (meal.royalJelly && await feedBeeRoyalJelly(monster, object, state)) {
        return;
    }
    const previousPriceSuppression = state.iflags.suppress_price;
    if (object.unpaid) state.iflags.suppress_price = true;
    let chargedName = '';
    try {
        await describePetMeal(monster, meal, state);
        if (object.unpaid) chargedName = objectName(object, state);
    } finally {
        if (previousPriceSuppression === undefined) delete state.iflags.suppress_price;
        else state.iflags.suppress_price = previousPriceSuppression;
    }
    if (monster.mnum === PM_RUST_MONSTER && object.oerodeproof) {
        if (object.unpaid) await chargeAlteredUnpaidObject(object, 'degrade', state);
        object.oerodeproof = false;
        monster.mstun = 1;
        if (canSeeMonster(monster)) {
            observeDistantObjectForNaming(object, state);
            if (state.flags.verbose) await plineWithContinuation(
                `${monsterName(monster, { state, capitalized: true })} spits ${await inventoryItemDescription(object)} out in disgust!`,
            );
        }
        return;
    }
    if (dogFood(monster, object, random, calls, state) === DOGFOOD && object.invlet) {
        const dog = monster.edog;
        if (!dog) throw new Error(`Pet ${monster.m_id} has no feeding state`);
        const elapsed = dog.dropdist + state.moves - dog.droptime;
        if (elapsed <= 0) throw new Error(`Pet ${monster.m_id} has no elapsed apport reward interval`);
        dog.apport += Math.trunc(200 / elapsed);
    }
    if (object.unpaid) {
        const cost = await unpaidObjectCost(object, state, 'contents');
        await plineWithContinuation(`That ${chargedName} will cost you ${cost} ${currency(cost, { state })}.`);
    }
    await consumeMonsterObject(monster, object, state);
}
