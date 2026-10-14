import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { PotionEffectOptions } from './potion_types.js';
// C potion.c:dodrink()/dopotion(). Effects are shared with spells and digestion.
import { FOUNTAIN, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, SINK } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { addExperience } from './exper.js';
import { heroCanReachFloor } from './floor_reach.js';
import { useUpFloorObject } from './floor_consumption.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { consumeInventoryItem } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { tryCallObjectType } from './object_call.js';
import { learnObjectType } from './object_knowledge.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { OBJECT_INITIAL_KNOWN } from './object_data.js';
import { applyPotionEffect } from './potion_effects.js';
import { releasePotionOccupant } from './potion_occupants.js';
import { promptYesNo } from './query.js';
import { heroIsHallucinating } from './senses.js';
import { drinkFountain } from './cmd.js';
import { drinkSink } from './sink_drinking.js';

export async function quaff({ state = game }: PotionEffectOptions = {}): Promise<QuaffResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (heroIsStrangled(state)) {
        await pline("If you can't breathe air, how can you drink liquid?");
        return outcome(false, state);
    }
    const hero = state.u;
    const location = state.level.at(hero.ux, hero.uy);
    if (!location) throw new Error('Drinking requires the hero to stand on the map.');
    let declinedSource = false;
    if (!state.iflags.menu_requested) {
        if (heroCanReachFloor(state) && [FOUNTAIN, SINK].includes(location.typ)) {
            const fountain = location.typ === FOUNTAIN;
            if (await promptYesNo(`Drink from the ${fountain ? 'fountain' : 'sink'}?`, 'n') === 'y') {
                if (fountain) await drinkFountain(location);
                else await drinkSink({ state });
                return outcome(true, state);
            }
            declinedSource = true;
        }
        if ((hero.uinwater || state.underwater) && !hero.uswallow) {
            if (await promptYesNo('Drink the water around you?', 'n') === 'y') {
                await pline('Do you know what lives in this water?');
                return outcome(true, state);
            }
            declinedSource = true;
        }
    }
    if (declinedSource && !state.inventory.some(object => object.oclass === 8)) {
        await pline("You don't have anything else to drink.");
        return { ...outcome(false, state), cancelled: true };
    }
    let source = await chooseInventoryObject('drink', object =>
        object.oclass === 8 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
    if (!source) return { ...outcome(false, state), cancelled: true };
    if (source.owornmask) {
        if (objectQuantity(source) > 1) {
            const original = source;
            source = splitObjectStack(original, 1, state);
            if (!source) throw new Error('The selected potion stack could not release one bottle.');
        } else await removeWornHeroItem(source, state);
    }
    source.in_use = true;
    const occupant = await releasePotionOccupant(source, { state });
    if (occupant.released) {
        if (!occupant.heroDied) await consumePotion(source, state);
        return outcome(true, state, source);
    }
    return drinkPotion(source, { state });
}

// consume:false is native eatspecial's extra useup boundary: digestion owns
// its final carried/floor consumption, while dopotion still owns discovery.
export async function drinkPotion(source: GameObject, { state = game, consume = true }: PotionEffectOptions & { consume?: boolean } = {}): Promise<QuaffResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    source.in_use = true;
    const effect = await applyPotionEffect(source, { state });
    if (effect.heroDied) return outcome(true, state, source);
    if (effect.result > 0) {
        // Detection's strange_feeling() bypasses dopotion discovery.
        if (source.dknown) await tryCallObjectType(source, state);
    } else {
        let unknown = effect.unknown;
        if (effect.nothing) {
            unknown++;
            await pline(`You have a ${heroIsHallucinating(state) ? 'normal' : 'peculiar'} feeling for a moment, then it passes.`);
        }
        if (source.dknown && !OBJECT_INITIAL_KNOWN[source.otyp]
            && !state._knownObjectTypes?.has(source.otyp)) {
            if (unknown) await tryCallObjectType(source, state);
            else {
                learnObjectType(source.otyp, state);
                addExperience(0, 10, state);
            }
        }
    }
    if (consume) await consumePotion(source, state);
    else source.in_use = false;
    return outcome(effect.result !== 0, state, source);
}

async function consumePotion(source: GameObject, state: GameState) {
    if (source.where === 'inventory' || state.inventory.includes(source))
        await consumeInventoryItem(source, state);
    else await useUpFloorObject(source, 1, { state });
    state._capacityDirty = true;
}

function outcome(spentTime: boolean, state: GameState, object: GameObject | null = null): QuaffResult {
    return { spentTime, heroDied: !!state.program_state.gameover, object, cancelled: false };
}

export interface QuaffResult {
    spentTime: boolean;
    heroDied: boolean;
    object: GameObject | null;
    cancelled: boolean;
}
