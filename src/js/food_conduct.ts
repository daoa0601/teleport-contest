// Native food and diet conduct with their separate first-event logs.
// C refs: eat.c doeat(), eatcorpse(), doeat_nonfood(), eating_conducts(), fpostfx().
import { adjustHeroAlignment } from './alignment.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { veganCorpse, vegetarianCorpse } from './food_traits.js';
import { MONSTER_NAME, requireMonsterData } from './monster_data.js';
import {
    CANDY_BAR, CREAM_PIE, EGG, FORTUNE_COOKIE, LUMP_OF_ROYAL_JELLY, PANCAKE,
} from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { objectMaterial } from './object_material.js';
import { foodObjectName } from './objnam.js';

import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';

interface FoodConductOptions { state?: GameState; }

const WAX = 2, FLESH = 4, LEATHER = 7, BONE = 9, DRAGON_HIDE = 10;
const ANIMAL_INGREDIENTS = new Set([PANCAKE, FORTUNE_COOKIE, CREAM_PIE, CANDY_BAR, LUMP_OF_ROYAL_JELLY]);

// doeat increments food before touchfood; the returned flag belongs only to
// that invocation's ordinary-food diet log scope. Corpse diet starts a new one.
export function recordFoodConsumption(food: GameObject, { state = game }: FoodConductOptions = {}): boolean {
    requireLiveGame(state);
    requirePlayingGame(state);
    return incrementFood(`ate for the first time - ${foodObjectName(food, { state })}`, state);
}

export async function recordOrdinaryFoodDiet(
    food: GameObject,
    { state = game, firstFoodLogged = false }: FoodConductOptions & { firstFoodLogged?: boolean } = {},
): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let logged = firstFoodLogged;
    const name = foodObjectName(food, { state });
    if (objectMaterial(food, state) === FLESH) {
        if (incrementConduct('unvegan', state) && !logged) {
            recordGameLogEvent(`consumed animal products for the first time, by eating ${withIndefiniteArticle(name)}`, { state });
            logged = true;
        }
        if (food.otyp !== EGG) {
            if (!state.u.uconduct.unvegetarian && !logged)
                recordGameLogEvent(`tasted meat for the first time, by eating ${withIndefiniteArticle(name)}`, { state });
            await violateVegetarian(state);
        }
    } else if (ANIMAL_INGREDIENTS.has(food.otyp)) {
        if (incrementConduct('unvegan', state) && !logged)
            recordGameLogEvent(`consumed animal products (${name}) for the first time`, { state });
    }
}

export async function recordCorpseDiet(food: GameObject, { state = game }: FoodConductOptions = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const species = food.corpsenm;
    if (species === undefined) throw new Error('Corpse consumption requires a species.');
    const name = withIndefiniteArticle(foodObjectName(food, { state }));
    let logged = false;
    if (!veganCorpse(species) && incrementConduct('unvegan', state)) {
        recordGameLogEvent(`consumed animal products for the first time, by eating ${name}`, { state });
        logged = true;
    }
    if (!vegetarianCorpse(species)) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat for the first time, by eating ${name}`, { state });
        await violateVegetarian(state);
    }
}

// Tins and brain eating use one shared log scope for food and both diets.
export async function eatingConducts(species: number, { state = game }: FoodConductOptions = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const name = requireMonsterData(MONSTER_NAME, species);
    let logged = incrementFood(`ate for the first time - ${name}`, state);
    if (!veganCorpse(species) && incrementConduct('unvegan', state) && !logged) {
        recordGameLogEvent(`consumed animal products (${name}) for the first time`, { state });
        logged = true;
    }
    if (!vegetarianCorpse(species)) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat (${name}) for the first time`, { state });
        await violateVegetarian(state);
    }
}

export function recordSpinachConsumption({ state = game }: FoodConductOptions = {}): boolean {
    requireLiveGame(state);
    requirePlayingGame(state);
    return incrementFood('ate for the first time (spinach)', state);
}

export async function recordNonfoodConduct(food: GameObject, { state = game }: FoodConductOptions = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const name = foodObjectName(food, { state });
    let logged = incrementFood(`ate for the first time (${name})`, state);
    const material = objectMaterial(food, state);
    if (![LEATHER, BONE, DRAGON_HIDE, WAX].includes(material)) return;
    if (incrementConduct('unvegan', state) && !logged) {
        recordGameLogEvent(`consumed animal products for the first time, by eating ${withIndefiniteArticle(name)}`, { state });
        logged = true;
    }
    if (material !== WAX) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat by-products for the first time, by eating ${withIndefiniteArticle(name)}`, { state });
        await violateVegetarian(state);
    }
}

function incrementFood(message: string, state: PlayingGameState): boolean {
    const first = incrementConduct('food', state);
    if (first) recordGameLogEvent(message, { state });
    return first;
}

function incrementConduct(key: 'food' | 'unvegan' | 'unvegetarian', state: PlayingGameState): boolean {
    const conduct = state.u.uconduct;
    const first = !conduct[key];
    conduct[key] = (conduct[key] || 0) + 1;
    return first;
}

async function violateVegetarian(state: PlayingGameState): Promise<void> {
    incrementConduct('unvegetarian', state);
    if (state.urole.key !== 'monk') return;
    await pline('You feel guilty.');
    adjustHeroAlignment(-1, state);
}

