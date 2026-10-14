// Wearing and removing blindfolds, towels, and lenses.
// C ref: do_wear.c Blindf_on(), Blindf_off().
import { W_TOOL } from './const.js';
import { setWornArtifactProperties } from './artifact_properties.js';
import { setBallAndChainFelt } from './ball.js';
import { gulpBlindnessCheck } from './engulf_blindness.js';
import { pline, plineWithContinuation, } from './display.js';
import { game } from './gstate.js';
import { objectWearMessage } from './object_wear_message.js';
import { BLINDFOLD, LENSES, TOWEL } from './object_data.js';
import { heroHasNoHead } from './hero_species.js';
import { heroIsBlind, isEyesOfTheOverworld, syncBlindness, } from './senses.js';
import { toggleBlindness } from './sight_change.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { cancelSlotTakeoff } from './takeoff_state.js';
function currentEyewear() {
    return game.ublindf || game.u?.ublindf || null;
}
function simpleEyewearName(object) {
    if (isEyesOfTheOverworld(object))
        return 'the Eyes of the Overworld';
    if (object.otyp === LENSES)
        return 'a pair of lenses';
    if (object.otyp === TOWEL)
        return 'a towel';
    return 'a blindfold';
}
async function equipEyewear(object) {
    await releaseWeaponSlots(object);
    game.ublindf = object;
    if (game.u)
        game.u.ublindf = object;
    object.worn = true;
    object.wornSlot = 'ublindf';
    object.owornmask = (object.owornmask ?? 0) | W_TOOL;
    setWornArtifactProperties(object, 'ublindf', true, game);
}
export function unequipEyewear(object, state = game) {
    if (state.ublindf === object || state.u.ublindf === object)
        cancelSlotTakeoff('ublindf', state);
    if (state.ublindf === object)
        state.ublindf = null;
    if (state.u?.ublindf === object)
        state.u.ublindf = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~W_TOOL;
    setWornArtifactProperties(object, 'ublindf', false, state);
}
async function announceWorn(object) {
    const message = objectWearMessage(object);
    if (message)
        await pline(message);
}
async function announceOccupiedSlot(object, worn) {
    if (worn.otyp === TOWEL) {
        await pline('Your face is already covered by a towel.');
    }
    else if (worn.otyp === BLINDFOLD && object.otyp === LENSES) {
        await pline("You can't wear lenses because you're wearing a blindfold there already.");
    }
    else if (worn.otyp === LENSES && object.otyp === BLINDFOLD) {
        await pline("You can't wear a blindfold because you're wearing some lenses there already.");
    }
    else if (worn.otyp === LENSES) {
        await pline('You are already wearing some lenses.');
    }
    else {
        await pline('You are already wearing a blindfold.');
    }
}
export function isEyewear(object) {
    return !!object && [BLINDFOLD, LENSES, TOWEL].includes(object.otyp);
}
export async function wearEyewear(object, { checkHead = true } = {}) {
    if (!object || !isEyewear(object))
        return false;
    if (checkHead && heroHasNoHead(game)) {
        await pline(`You have no head to wear ${simpleEyewearName(object)} on.`);
        return false;
    }
    const worn = currentEyewear();
    if (worn) {
        await announceOccupiedSlot(object, worn);
        return false;
    }
    const wasBlind = heroIsBlind(game);
    await equipEyewear(object);
    const blind = syncBlindness(game);
    await announceWorn(object);
    if (!wasBlind && blind) {
        if (game.flags?.verbose !== false)
            await plineWithContinuation("You can't see any more.");
        if (game.uball || game.u.uball)
            await setBallAndChainFelt(false, game);
    }
    else if (wasBlind && !blind) {
        if (game.u.uroleplay?.blind) {
            await plineWithContinuation('For the first time in your life, you can see!');
            game.u.uroleplay.blind = false;
        }
        else {
            await plineWithContinuation('You can see!');
        }
    }
    if (wasBlind !== blind)
        await toggleBlindness(game);
    return true;
}
export async function removeEyewear(object = null, { state = game, publish = plineWithContinuation, } = {}) {
    const noOffMessage = !object;
    const worn = state.ublindf || state.u.ublindf;
    object ||= worn ?? null;
    if (!object || worn !== object)
        return false;
    const wasBlind = heroIsBlind(state);
    unequipEyewear(object, state);
    const blind = syncBlindness(state);
    if (!noOffMessage && state.flags?.verbose !== false)
        await publish(`You were wearing ${simpleEyewearName(object)}.`);
    let changed = false;
    if (blind) {
        if (!wasBlind) {
            await publish("You can't see anything now!");
            if (state.uball || state.u.uball)
                await setBallAndChainFelt(false, state);
            changed = true;
        }
        else if (object.otyp !== LENSES) {
            await publish('You still cannot see.');
        }
    }
    else if (wasBlind) {
        const gulp = await gulpBlindnessCheck({ state, publish });
        if (gulp.died)
            return true;
        if (!gulp.triggered) {
            await publish('You can see again.');
            changed = true;
        }
    }
    if (changed)
        await toggleBlindness(state);
    return true;
}
export async function applyEyewear(object) {
    const worn = currentEyewear();
    if (worn === object) {
        if (object.cursed)
            return false;
        return removeEyewear(object);
    }
    if (!worn)
        return wearEyewear(object, { checkHead: false });
    const description = worn.otyp === TOWEL
        ? 'covered by a towel'
        : worn.otyp === BLINDFOLD
            ? 'wearing a blindfold' : 'wearing lenses';
    await pline(`You are already ${description}.`);
    return false;
}
//# sourceMappingURL=eyewear.js.map