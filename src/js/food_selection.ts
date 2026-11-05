import { feelPetrifyingCorpse, willFeelPetrifyingCorpse } from './invent.js';
// C eat.c:is_edible(), eat_ok(), and floorfood() for the eat command.

import { FOOD_CLASS, COIN_CLASS } from './objclass.js';
import {
    objectUnique, BEARTRAP, CORPSE, EGG, GOLD_PIECE,
} from './object_data.js';
import { BEAR_TRAP, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, IRONBARS, TT_BEARTRAP, W_NONDIGGABLE } from './const.js';
import { plineWithContinuation as pline } from './pline.js';
import { veganCorpse } from './food_traits.js';
import { heroCanReachFloor } from './engrave.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroFormClings, heroIsFlying, heroIsBreathless, heroSpecies } from './polyself.js';
import { heroIsStrangled } from './do_wear.js';
import { deleteTrap, resetUtrap } from './trap.js';
import { inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './invent.js';
import { mksobj, objectQuantity, objectIsFlammable } from './mkobj.js';
import { MONSTER_NAME } from './monster_data.js';
import { objectIsMetallic, objectIsOrganic, objectIsRustprone } from './object_properties.js';
import { dropObjectAtHero } from './do.js';
import { observeObjectForNaming } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { promptYesNoQuit } from './query.js';

import { isLavaAt, isPoolAt } from './dbridge.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { exceedsActionCapacity } from './hack.js';
import { metallivorous } from './mondata.js';

const RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const FIRE_ELEMENTAL = MONSTER_NAME.indexOf('fire elemental');
const GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const GHOUL = MONSTER_NAME.indexOf('ghoul');

// C hands_obj represents the terrain being eaten, not an inventory object.
export const IRON_BARS_FOOD = Object.freeze({ kind: 'iron-bars' });
export type FoodSelection = GameObject | typeof IRON_BARS_FOOD;

export function heroEatsMetal(state: GameState = game): boolean {
    return metallivorous(heroSpecies(state));
}

export function isEdibleFood(object: GameObject | null | undefined, state: GameState = game): boolean {
    if (!object || objectUnique(object.otyp)) return false;
    const form = heroSpecies(state);
    if (form === FIRE_ELEMENTAL && objectIsFlammable(object, state)) return true;
    if (heroEatsMetal(state) && objectIsMetallic(object, state)
        && (form !== RUST_MONSTER || objectIsRustprone(object, state))) return true;
    if (form === GHOUL)
        return object.otyp === CORPSE && !veganCorpse(object.corpsenm) || object.otyp === EGG;
    if (form === GELATINOUS_CUBE && objectIsOrganic(object, state) && !object.contents?.length) return true;
    return object.oclass === FOOD_CLASS;
}

// C eat.c:floorfood().
// Also C eat.c:eat_ok(): inlined as the inventory chooser callback at the
// end (edible suggested, gold excluded for its own message, others
// selectable).
export async function selectFoodToEat({ state = game }: { state?: GameState } = {}): Promise<FoodSelection | null> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (heroIsStrangled(state)) {
        await pline("If you can't breathe air, how can you consume solids?");
        return null;
    }
    let declinedFloorFood = false;
    if (canSelectFloorFood(state)) {
        const metallic = heroEatsMetal(state);
        const hero = state.u;
        if (metallic) {
            const trap = state.level.traps.find(candidate => candidate.tx === hero.ux
                && candidate.ty === hero.uy && candidate.ttyp === BEAR_TRAP && candidate.tseen);
            if (trap) {
                const held = hero.utrap && hero.utraptype === TT_BEARTRAP;
                const answer = await askFloorFood(`There is a bear trap here (${held ? 'holding you' : 'armed'}); eat it?`);
                if (answer === 'q') return null;
                if (answer === 'y') {
                    deleteTrap(trap, state);
                    if (held) await resetUtrap(false, state);
                    const object = await mksobj(BEARTRAP, true, false);
                    object.ox = hero.ux;
                    object.oy = hero.uy;
                    if (exceedsActionCapacity(state)) {
                        await pline(`You only manage to ${held ? 'free yourself from' : 'disarm'} the bear trap.`);
                        await dropObjectAtHero(object, { state });
                        return null;
                    }
                    return object;
                }
                declinedFloorFood = true;
            }
            const location = state.level.at(hero.ux, hero.uy);
            if (!location) throw new Error('Food selection requires a map cell at the hero position.');
            if (location.typ === IRONBARS) {
                const undiggable = location.wall_info & W_NONDIGGABLE;
                if (undiggable || hero.uhunger > 1500) {
                    await pline(`There are iron bars here but you ${undiggable ? 'cannot' : 'are too full to'} eat them.`);
                } else {
                    const digging = state.context.digging;
                    const resume = digging?.chew && digging.pos.x === hero.ux && digging.pos.y === hero.uy
                        && digging.level.dnum === hero.uz.dnum && digging.level.dlevel === hero.uz.dlevel;
                    const answer = await askFloorFood(`There are iron bars here; ${resume ? 'resume eating' : 'eat'} them?`);
                    if (answer === 'y') return IRON_BARS_FOOD;
                    if (answer === 'q') return null;
                }
                declinedFloorFood = true;
            }
            const coins = state.level.objects[hero.ux]?.[hero.uy]?.find(object => object.otyp === GOLD_PIECE);
            if (coins && hero.umonnum !== RUST_MONSTER) {
                const quantity = objectQuantity(coins);
                const answer = await askFloorFood(quantity === 1 ? 'There is 1 gold piece here; eat it?'
                    : `There are ${quantity} gold pieces here; eat them?`);
                if (answer === 'y') return coins;
                if (answer === 'q') return null;
                declinedFloorFood = true;
            }
        }
        for (const object of state.level.objects[hero.ux]?.[hero.uy] || []) {
            if (object.oclass === COIN_CLASS || !isEdibleFood(object, state)) continue;
            if (willFeelPetrifyingCorpse(object, { state })) {
                await feelPetrifyingCorpse(object, { state });
                return null;
            }
            observeObjectForNaming(object, { state });
            const one = objectQuantity(object) === 1;
            const answer = await askFloorFood(`There ${one ? 'is' : 'are'} ${await inventoryItemDescription(object)} here; eat ${one ? 'it' : 'one'}?`);
            if (answer === 'y') return object;
            if (answer === 'q') return null;
            declinedFloorFood = true;
        }
    }
    return chooseInventoryObject('eat', object => isEdibleFood(object, state)
        ? GETOBJ_SUGGEST : object.oclass === COIN_CLASS ? GETOBJ_EXCLUDE : GETOBJ_EXCLUDE_SELECTABLE,
    { hands: declinedFloorFood ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE });
}

function canSelectFloorFood(state: PlayingGameState): boolean {
    if (state.iflags.menu_requested || !heroCanReachFloor(state, { checkPit: true }) || state.u.usteed)
        return false;
    const liquid = isPoolAt(state.u.ux, state.u.uy, state) || isLavaAt(state.u.ux, state.u.uy, state);
    return !liquid || !(propertyIsActive('waterWalking', state) || heroFormClings(state)
        || heroIsFlying(state) && !heroIsBreathless(state));
}

function askFloorFood(prompt: string): Promise<'y' | 'n' | 'q'> {
    return promptYesNoQuit(`${prompt}`, 'n');
}

