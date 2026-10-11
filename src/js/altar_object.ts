// What an altar reveals when an object lands on it.
// C ref: do.c doaltarobj().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import {
    simpleObjectNameWithArticle, observeObjectForNaming,
} from './objnam.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';

interface AltarLandingOptions {
    state?: GameState;
    monsterMoving?: boolean;
    publish?: MessagePublisher;
}

const COIN_CLASS = 12;

function objectDescription(object: GameObject, state: GameState): string {
    return state === game
        ? inventoryItemDescription(object)
        : simpleObjectNameWithArticle(object, state);
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function rememberBlessingOrCurse(object: GameObject): void {
    object.bknown = true;
    object.buc = object.blessed ? 'blessed'
        : object.cursed ? 'cursed' : undefined;
}

export async function landObjectOnAltar(
    object: GameObject, {
        state = game,
        monsterMoving = !!state.context?.mon_moving,
        publish = plineWithContinuation,
    }: AltarLandingOptions = {},
): Promise<boolean> {
    if (heroIsBlind(state)) return false;

    const coins = object.oclass === COIN_CLASS;
    if (coins) {
        object.blessed = false;
        object.cursed = false;
        object.buc = undefined;
    } else if (!monsterMoving) {
        const conduct = state.u.uconduct || (state.u.uconduct = {});
        conduct.gnostic = (conduct.gnostic ?? 0) + 1;
    }

    const quantity = object.quan ?? object.quantity ?? 1;
    observeObjectForNaming(object, { state });
    const description = objectDescription(object, state);
    const plural = quantity > 1;
    const hallucinating = heroIsHallucinating(state);
    if (object.blessed || object.cursed) {
        const color = hallucinating
            ? 'multicolored' : object.blessed ? 'amber' : 'black';
        const article = /^[aeiou]/i.test(color) ? 'an' : 'a';
        await publish(`There is ${article} ${color} flash as ${
            description
        } ${plural ? 'hit' : 'hits'} the altar.`);
        if (!hallucinating) rememberBlessingOrCurse(object);
    } else {
        await publish(`${capitalize(description)} ${
            plural ? 'land' : 'lands'
        } on the altar.`);
        if (!coins) rememberBlessingOrCurse(object);
    }
    return true;
}
