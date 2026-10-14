// Native eat.c:doeat() admission, doeat_nonfood(), and eatspecial().

import { artifactById, artifactByName } from './artifacts.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { NonfoodMeal } from './occupation_types.js';

import { touchArtifactByHero } from './artifact_touch.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_WIS, GD_EATGOLD, SATIATED, W_AMUL, W_ARMOR, W_RING, W_SADDLE, W_TOOL } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { digestAccessory } from './eaten_accessory.js';
import { checkFoodEdibility } from './food_edibility.js';
import { consumeFoodObject } from './food_lifecycle.js';
import { recordNonfoodConduct } from './food_conduct.js';
import { isEdibleFood } from './food_selection.js';
import type { FoodSelection } from './food_selection.js';
import { stack_object } from './floor_object.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { freeInventoryObject } from './hero_inventory.js';
import { makeStunned } from './hero_mental_status.js';
import { retouchHeroObject } from './hero_retouch.js';
import { currentHungerState, gainHeroNutrition } from './hunger.js';
import { chewIronBars } from './iron_bars_meal.js';
import { releaseObjectLeash } from './monster_leash.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterHasLineOfSightToHero } from './monster_perception.js';
import {
    FLINT, LEASH, OBJECT_NAMES, OBJECT_NUTRITION, RIN_SLOW_DIGESTION, SCR_SCARE_MONSTER, TRIDENT, requireObjectData,
} from './object_data.js';
import { objectMaterial } from './object_material.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { tryCallObjectType } from './object_call.js';
import { dropObjectAtHero } from './object_drop.js';
import { objectName, objectHasPersonalName } from './objnam.js';
import { applyRottenFood } from './ordinary_food_effects.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { unpunishHero } from './punishment.js';
import { drinkPotion } from './quaff.js';
import { rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { surfaceName } from './terrain_name.js';
import { findVaultGuard } from './vault_guard.js';
import { isWeldedPrimary, releaseWeaponSlots } from './weapon_slots.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';

interface FoodOptions { state?: GameState; }
export type FoodAdmission = { handled: true; spentTime: boolean; heroDied: boolean }
    | { handled: false; food: GameObject; spentTime: false; heroDied: boolean };

const FOOD_CLASS = 7, RING_CLASS = 4, AMULET_CLASS = 5, POTION_CLASS = 8;
const SCROLL_CLASS = 9, COIN_CLASS = 12, BALL_CLASS = 15, CHAIN_CLASS = 16;
const PAPER = 5, IRON = 11, MITHRIL = 17;
const RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');

export async function handleFoodAdmission(object: FoodSelection, { state = game }: FoodOptions = {}): Promise<FoodAdmission> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (exceedsActionCapacity(state)) {
        await pline("You can't do that while carrying so much stuff.");
        return admissionResult(true, false, state);
    }
    if (!await checkFoodEdibility(object, { state })) return admissionResult(true, false, state);
    if ('kind' in object) {
        await chewIronBars({ state });
        return admissionResult(true, true, state);
    }
    if (!isEdibleFood(object, state)) {
        await pline('You cannot eat that!');
        return admissionResult(true, false, state);
    }
    if ((object.owornmask ?? 0) & (W_ARMOR | W_TOOL | W_AMUL | W_SADDLE)) {
        await pline("You can't eat something you're wearing.");
        return admissionResult(true, false, state);
    }
    if (object.where === 'inventory') {
        const touch = await retouchHeroObject(object, { state });
        if (touch.died || touch.rejected) return admissionResult(true, true, state);
    } else {
        const touch = await touchArtifactByHero(object, artifactById(object.oartifact, state), { state });
        if (touch.died || touch.allowed === false) return admissionResult(true, true, state);
    }
    const material = objectMaterial(object, state);
    if (material >= IRON && material <= MITHRIL
        && state.u.umonnum === RUST_MONSTER && object.oerodeproof) {
        await spitOutRustproofObject(object, state);
        return admissionResult(true, true, state);
    }
    if (object.otyp === RIN_SLOW_DIGESTION) {
        await pline('This ring is indigestible!');
        await applyRottenFood(object, { state });
        if (object.dknown) await tryCallObjectType(object, state);
        return admissionResult(true, true, state);
    }
    if (object.oclass === FOOD_CLASS)
        return { handled: false, food: object, spentTime: false, heroDied: !!state.program_state.gameover };
    await eatNonFood(object, state);
    return admissionResult(true, true, state);
}

function admissionResult(handled: true, spentTime: boolean, state: GameState): FoodAdmission {
    return { handled, spentTime, heroDied: !!state.program_state.gameover };
}

async function spitOutRustproofObject(object: GameObject, state: PlayingGameState) {
    object.rknown = true;
    if (objectQuantity(object) > 1) {
        const carried = object.where === 'inventory';
        const split = splitObjectStack(object, carried ? 1 : objectQuantity(object) - 1, state);
        if (!split) throw new Error(`Edible stack ${object.o_id} could not be split`);
        if (carried) object = split;
    }
    await pline(`Ulch - that ${objectName(object, state)} was rustproofed!`);
    object.oerodeproof = false;
    await makeStunned((state.u.stunnedTurns || 0) + rn2(10), { state });
    if (isWeldedPrimary(object, state) || object.cursed && ((object.owornmask ?? 0) & W_RING)) {
        object.bknown = true;
        await pline(`You spit out the ${objectName(object, state)}.`);
        return;
    }
    await pline(`You spit the ${objectName(object, state)} out onto the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
    if (object.where === 'inventory') {
        if (object.owornmask) await removeWornHeroItem(object, state);
        if (state.program_state.gameover) return;
        await freeInventoryObject(object, state);
        if (state.program_state.gameover) return;
        await dropObjectAtHero(object, { state });
    }
    if (object.where === 'floor') await stack_object(object, state);
}

async function eatNonFood(object: GameObject, state: PlayingGameState) {
    const material = objectMaterial(object, state);
    const nutrition = object.otyp === SCR_MAIL ? 0 : object.oclass === COIN_CLASS
        ? Math.min(2000, Math.trunc(objectQuantity(object) / 100))
        : [BALL_CLASS, CHAIN_CLASS].includes(object.oclass) ? objectWeight(object)
            : requireObjectData(OBJECT_NUTRITION, object.otyp);
    const meal: NonfoodMeal = { piece: object, o_id: object.o_id, reqtime: 1,
        usedtime: 0, nmod: nutrition, canchoke: currentHungerState(state) === SATIATED, eating: true };
    state.context.victual = meal;
    await recordNonfoodConduct(object, { state });
    let noDelicious = object.otyp === SCR_MAIL || material === PAPER;
    if (object.cursed) {
        await applyRottenFood(object, { state });
        noDelicious = true;
    }
    if (object.oclass === 2 && object.opoisoned) {
        await pline('Ecch - that must have been poisonous!');
        if (state.u.poisonResistance) await pline('You seem unaffected by the poison.');
        else {
            const name = objectName(object, state);
            if (await poisonHeroStrengthAndHp(rnd(4), rnd(15), name, {
                state, deathCause: `killed by ${withIndefiniteArticle(name)}`,
            })) return;
        }
    } else if (!noDelicious) {
        let namedArtifact = false;
        if (objectHasPersonalName(object, state)) {
            const orb = artifactByName('The Orb of Detection', state);
            if (!orb) throw new Error('The Orb of Detection is missing from artifact data');
            namedArtifact = (object.oartifact ?? 0) < orb.id;
        }
        await pline(`${namedArtifact ? '' : 'This '}${object.oclass === COIN_CLASS ? 'gold' : objectName(object, state)} is delicious!`);
    }
    await finishNonFoodMeal(object, meal, state);
}

async function finishNonFoodMeal(object: GameObject, meal: NonfoodMeal, state: PlayingGameState) {
    state._occupation = { key: 'eat-food', text: 'eating non-food' };
    await gainHeroNutrition(meal.nmod, { state });
    state._occupation = null;
    state.context.victual = null;
    if (state.program_state.gameover) return;
    if (object.oclass === COIN_CLASS) {
        await consumeFoodObject(object, { all: true, state });
        const guard = findVaultGuard(state);
        if (guard?.mx && guard.mcansee && monsterHasLineOfSightToHero(guard, state)) {
            if (!guard._egd) throw new Error('A vault guard has no guard state');
            guard._egd.witness = GD_EATGOLD;
        }
        return;
    }
    if (objectMaterial(object, state) === PAPER) {
        const label = state.objectDescriptions?.[object.otyp];
        await pline(object.otyp === SCR_MAIL ? 'This junk mail is less than satisfying.'
            : object.otyp === SCR_SCARE_MONSTER ? `Yuck${object.blessed ? '!' : '.'}`
            : object.oclass === SCROLL_CLASS && label === 'YUM YUM' ? `Yum${object.blessed ? '!' : '.'}` : 'Needs salt...');
    }
    if (object.oclass === POTION_CLASS) await drinkPotion(object, { state, consume: false });
    else if ([RING_CLASS, AMULET_CLASS].includes(object.oclass)) await digestAccessory(object, { state });
    else if (object.otyp === LEASH && object.leashmon) releaseObjectLeash(object, state);
    if (state.program_state.gameover) return;
    if (object.otyp === TRIDENT && !object.cursed) {
        await pline(heroIsHallucinating(state) ? 'Four out of five dentists agree.' : 'That was pure chewing satisfaction!');
        await exerciseAttribute(A_WIS, true, state);
    }
    if (object.otyp === FLINT && !object.cursed) {
        await pline('Yabba-dabba delicious!');
        await exerciseAttribute(A_CON, true, state);
    }
    if (objectQuantity(object) === 1) await releaseWeaponSlots(object, state);
    const chain = object === state.uchain;
    if (object === state.uball || chain) await unpunishHero(state);
    if (!chain) await consumeFoodObject(object, { state });
}
