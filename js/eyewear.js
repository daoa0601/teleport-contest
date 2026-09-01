// Wearing and removing blindfolds, towels, and lenses.
// C ref: do_wear.c Blindf_on(), Blindf_off().

import { W_TOOL, W_WEAPONS } from './const.js';
import {
    pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { BLINDFOLD, LENSES, TOWEL } from './object_data.js';
import { heroHasNoHead } from './polyself.js';
import {
    heroIsBlind, isEyesOfTheOverworld, syncBlindness,
} from './senses.js';
import { redrawSight, rememberVisibleTerrain } from './sight_change.js';

function currentEyewear() {
    return game.ublindf || game.u?.ublindf || null;
}

function simpleEyewearName(object) {
    if (isEyesOfTheOverworld(object)) return 'the Eyes of the Overworld';
    if (object.otyp === LENSES) return 'a pair of lenses';
    if (object.otyp === TOWEL) return 'a towel';
    return 'a blindfold';
}

function releaseWeaponSlot(object) {
    const primary = game.uwep === object || game.u?.uwep === object;
    if (game.uwep === object) game.uwep = null;
    if (game.u?.uwep === object) game.u.uwep = null;
    if (game.uswapwep === object) game.uswapwep = null;
    if (game.u?.uswapwep === object) game.u.uswapwep = null;
    if (game.uquiver === object) game.uquiver = null;
    if (game.u?.uquiver === object) game.u.uquiver = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEAPONS;
    if (primary) game._unweapon = true;
}

function equipEyewear(object) {
    releaseWeaponSlot(object);
    game.ublindf = object;
    if (game.u) game.u.ublindf = object;
    object.worn = true;
    object.wornSlot = 'ublindf';
    object.owornmask = (object.owornmask ?? 0) | W_TOOL;
}

function unequipEyewear(object) {
    if (game.ublindf === object) game.ublindf = null;
    if (game.u?.ublindf === object) game.u.ublindf = null;
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

async function announceRemoved(object) {
    if (game.flags?.verbose === false) return;
    await pline(`You were wearing ${simpleEyewearName(object)}.`);
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

export async function removeEyewear(object) {
    if (!object || currentEyewear() !== object) return false;
    const wasBlind = heroIsBlind(game);
    unequipEyewear(object);
    await announceRemoved(object);
    const blind = syncBlindness(game);
    if (blind) {
        if (!wasBlind) {
            await plineWithContinuation("You can't see anything now!");
            await redrawSight();
        } else if (object.otyp !== LENSES) {
            await plineWithContinuation('You still cannot see.');
        }
    } else if (wasBlind) {
        await plineWithContinuation('You can see again.');
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
