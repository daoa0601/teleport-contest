// Wearing and removing blindfolds, towels, and lenses.
// C ref: do_wear.c Blindf_on(), Blindf_off().

import { W_TOOL } from './const.js';
import {
    pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { BLINDFOLD, LENSES, TOWEL } from './object_data.js';
import { heroHasNoHead } from './hero_species.js';
import {
    heroIsBlind, isEyesOfTheOverworld, syncBlindness,
} from './senses.js';
import { redrawSight, rememberVisibleTerrain } from './sight_change.js';
import { releaseWeaponSlots } from './weapon_slots.js';

function currentEyewear() {
    return game.ublindf || game.u?.ublindf || null;
}

function simpleEyewearName(object) {
    if (isEyesOfTheOverworld(object)) return 'the Eyes of the Overworld';
    if (object.otyp === LENSES) return 'a pair of lenses';
    if (object.otyp === TOWEL) return 'a towel';
    return 'a blindfold';
}

function equipEyewear(object) {
    releaseWeaponSlots(object);
    game.ublindf = object;
    if (game.u) game.u.ublindf = object;
    object.worn = true;
    object.wornSlot = 'ublindf';
    object.owornmask = (object.owornmask ?? 0) | W_TOOL;
}

export function unequipEyewear(object, state = game) {
    if (state.ublindf === object) state.ublindf = null;
    if (state.u?.ublindf === object) state.u.ublindf = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~W_TOOL;
}

async function announceWorn(object) {
    if (game.flags?.verbose === false) {
        await pline(
            `${object.invlet} - ${inventoryItemDescription(object)} (being worn).`,
        );
        return;
    }
    const suffix = object.otyp === TOWEL ? ' around your head' : '';
    await pline(`You are now wearing ${simpleEyewearName(object)}${suffix}.`);
}

async function announceOccupiedSlot(object) {
    const worn = currentEyewear();
    if (worn.otyp === TOWEL) {
        await pline('Your face is already covered by a towel.');
    } else if (worn.otyp === BLINDFOLD && object.otyp === LENSES) {
        await pline(
            "You can't wear lenses because you're wearing a blindfold there already.",
        );
    } else if (worn.otyp === LENSES && object.otyp === BLINDFOLD) {
        await pline(
            "You can't wear a blindfold because you're wearing some lenses there already.",
        );
    } else if (worn.otyp === LENSES) {
        await pline('You are already wearing some lenses.');
    } else {
        await pline('You are already wearing a blindfold.');
    }
}

export function isEyewear(object) {
    return [BLINDFOLD, LENSES, TOWEL].includes(object?.otyp);
}

export async function wearEyewear(object, { checkHead = true } = {}) {
    if (!isEyewear(object)) return false;
    if (checkHead && heroHasNoHead(game)) {
        await pline(
            `You have no head to wear ${simpleEyewearName(object)} on.`,
        );
        return false;
    }
    if (currentEyewear()) {
        await announceOccupiedSlot(object);
        return false;
    }

    const wasBlind = heroIsBlind(game);
    if (!wasBlind && object.otyp !== LENSES) rememberVisibleTerrain();
    equipEyewear(object);
    await announceWorn(object);
    const blind = syncBlindness(game);
    if (!wasBlind && blind) {
        await plineWithContinuation("You can't see any more.");
        await redrawSight();
    } else if (wasBlind && !blind) {
        if (game.u?.uroleplay?.blind) {
            game.u.uroleplay.blind = false;
            await plineWithContinuation(
                'For the first time in your life, you can see!',
            );
        } else {
            await plineWithContinuation('You can see!');
        }
        await redrawSight();
    }
    return true;
}

export async function removeEyewear(object, {
    state = game, publish = plineWithContinuation,
} = {}) {
    if (!object || (state.ublindf || state.u?.ublindf) !== object) return false;
    const wasBlind = heroIsBlind(state);
    unequipEyewear(object, state);
    if (state.flags?.verbose !== false)
        await publish(`You were wearing ${simpleEyewearName(object)}.`);
    const blind = syncBlindness(state);
    if (blind) {
        if (!wasBlind) {
            await publish("You can't see anything now!");
            await redrawSight();
        } else if (object.otyp !== LENSES) {
            await publish('You still cannot see.');
        }
    } else if (wasBlind) {
        await publish('You can see again.');
        await redrawSight();
    }
    return true;
}

export async function applyEyewear(object) {
    const worn = currentEyewear();
    if (worn === object) {
        if (object.cursed) return false;
        return removeEyewear(object);
    }
    if (!worn) return wearEyewear(object, { checkHead: false });

    const description = worn.otyp === TOWEL
        ? 'covered by a towel'
        : worn.otyp === BLINDFOLD
            ? 'wearing a blindfold' : 'wearing lenses';
    await pline(`You are already ${description}.`);
    return false;
}
