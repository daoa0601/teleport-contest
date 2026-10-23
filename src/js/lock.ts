import { currency } from './currency.js';
// Lock forcing.
// C ref: lock.c doforce(), forcelock(), and breakchestlock().

import { exerciseAttribute } from './attrib.js';
import {
    A_DEX, A_STR, P_DAGGER, P_FLAIL, P_LANCE, P_PICK_AXE,
} from './const.js';
import {
    flushPendingTopline, newsym, pline, plineWithContinuation,
} from './display.js';
import { placeObject, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { ForceLockOccupation } from './occupation_types.js';
import { consumeInventoryItem } from './invent.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import {
    CHEST, LARGE_BOX, OBJECT_LARGE_DAMAGE,
    OBJECT_SUBTYPE,
} from './object_data.js';
import { objectMaterial } from './object_material.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { deleteObject, delobj } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { definiteName, objectName, observeObjectForNaming, ownedObjectName, pluralizeObjectNoun, singularObjectName } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName } from './terrain_name.js';
import { resetPick } from './lock_context.js';
import { objectResistsDestruction } from './object_state.js';
import { isWeaponTool } from './object_properties.js';
import { CORPSE, ICE_BOX } from './object_data.js';
import { startCorpseTimeout } from './mklev.js';
import { heroHasNoHands } from './polyself.js';
import { applySupportedPotionVapor, randomBottleName } from './potion_hit.js';
import { promptYesNoQuit } from './query.js';
import { rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { costlySpot, currentShopResident, chargeAlteredUnpaidObject } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { isBlade } from './weapon_type.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const ROCK_CLASS = 14;
const POTION_CLASS = 8;

export async function doforce(state: GameState = game): Promise<void> {
    if (state.u?.uswallow) {
        await pline("You can't force anything from inside here.");
        state.context.move = 0;
        return;
    }
    if (!state.uwep || !isForceableWeapon(state.uwep)) {
        await pline(forceWeaponFailure(state.uwep));
        state.context.move = 0;
        return;
    }

    if (!heroCanReachFloor(state, { checkPit: true })) {
        const surface = heroCanReachFloor(state) ? 'bottom of the pit' : surfaceName(state.u.ux, state.u.uy, state);
        await pline(`You can't reach the ${surface}.`);
        state.context.move = 0;
        return;
    }

    const prying = isBlade(state.uwep) && !isPick(state.uwep);
    const previous = state._lockAttempt;
    const samePickType = previous?.key === 'force-lock'
        ? previous.picktyp === prying
        : previous?.key === 'pick-lock' && !previous.tool && !prying;
    if (previous?.usedtime && previous.container && samePickType) {
        await pline('You resume your attempt to force the lock.');
        const attempt: ForceLockOccupation = previous.key === 'force-lock' ? previous : {
            key: 'force-lock', text: 'forcing the lock',
            container: previous.container, picktyp: prying,
            chance: previous.chance, usedtime: previous.usedtime,
        };
        state._lockAttempt = state._occupation = attempt;
        state.context.move = 1;
        return;
    }

    const x = state.u.ux;
    const y = state.u.uy;
    const boxes = (state.level?.objects?.[x]?.[y] || []).filter(object =>
        object.otyp === LARGE_BOX || object.otyp === CHEST);
    // Native clears the box target here, leaving interrupted door work intact.
    if (previous?.key !== 'pick-lock' || !previous.door) resetPick(state);
    let reportedOpenBox = false;
    for (const box of boxes) {
        observeObjectForNaming(box, { state });
        if (box.obroken || !box.olocked) {
            box.lknown = false;
            const condition = box.obroken ? 'broken' : 'unlocked';
            await plineWithContinuation(
                `There is ${inventoryItemDescription(box)} here, but its lock is `
                + `already ${condition}.`,
            );
            box.lknown = true;
            reportedOpenBox = true;
            continue;
        }

        if (reportedOpenBox) await flushPendingTopline();
        const description = inventoryItemDescription(box);
        box.lknown = true;
        const answer = await promptYesNoQuit(`There is ${description} here; force its lock?`);
        if (answer === 'q') {
            state.context.move = 0;
            return;
        }
        if (answer === 'n') continue;

        const weapon = state.uwep;
        const action = prying
            ? `You force ${ownedObjectName(weapon, state, { capitalized: false })} into a crack and pry.`
            : `You start bashing it with ${ownedObjectName(weapon, state, { capitalized: false })}.`;
        await pline(action);
        state._lockAttempt = state._occupation = {
            key: 'force-lock',
            text: 'forcing the lock',
            container: box,
            picktyp: prying,
            chance: 2 * (OBJECT_LARGE_DAMAGE[weapon.otyp] || 0),
            usedtime: 0,
        };
        state.context.move = 1;
        return;
    }

    if (reportedOpenBox)
        await plineWithContinuation('You decide not to force the issue.');
    else await pline('You decide not to force the issue.');
    state.context.move = 1;
}

export async function continueForceLock(occupation: ForceLockOccupation, state: GameState = game): Promise<boolean> {
    const box = occupation.container;
    if (box.ox !== state.u.ux || box.oy !== state.u.uy) {
        occupation.usedtime = 0;
        state._occupation = null;
        return false;
    }

    const usedtime = occupation.usedtime ?? 0;
    occupation.usedtime = usedtime + 1;
    const weapon = state.uwep;
    if (usedtime >= 50 || !weapon || heroHasNoHands(state)) {
        await giveUpForcing(occupation, state);
        return true;
    }

    if (occupation.picktyp) {
        if (bladeBreaks(weapon)) {
            await pline(bladeBreakMessage(weapon, state));
            await consumeInventoryItem(weapon, state);
            if (state.program_state?.gameover) return true;
            await plineWithContinuation(
                'You give up your attempt to force the lock.',
            );
            await exerciseAttribute(A_DEX, true, state);
            occupation.usedtime = 0;
            state._occupation = null;
            state.context.move = 1;
            return true;
        }
    } else {
        const wakeDistance = (state.u?.ulevel ?? 1) * 20;
        await wakeMonstersNearWithMessages(
            state.u?.ux ?? 0, state.u?.uy ?? 0, wakeDistance, state,
        );
    }

    if (rn2(100) < occupation.chance) {
        await plineWithContinuation('You succeed in forcing the lock.');
        await exerciseAttribute(occupation.picktyp ? A_DEX : A_STR, true, state);
        const destroyed = !occupation.picktyp && rn2(3) === 0;
        await breakChestLock(box, destroyed, state);
        if (state.program_state?.gameover) return true;
        newsym(state.u.ux, state.u.uy);
        resetPick(state);
        state._occupation = null;
    }
    state.context.move = 1;
    return true;
}

export function isForceableWeapon(weapon: GameObject | null | undefined): boolean {
    if (!weapon) return false;
    const weaponTool = isWeaponTool(weapon);
    if (weapon.oclass === WEAPON_CLASS || weaponTool) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] || 0;
        return skill >= P_DAGGER && skill <= P_LANCE && skill !== P_FLAIL;
    }
    return weapon.oclass === ROCK_CLASS;
}

function isPick(weapon: GameObject | null | undefined): boolean {
    return (weapon?.oclass === WEAPON_CLASS || weapon?.oclass === TOOL_CLASS)
        && OBJECT_SUBTYPE[weapon.otyp] === P_PICK_AXE;
}

function forceWeaponFailure(weapon: GameObject | null | undefined): string {
    if (!weapon)
        return "You can't force anything when not wielding a weapon.";
    const plural = objectQuantity(weapon) > 1;
    const description = weapon.oclass !== WEAPON_CLASS && !isWeaponTool(weapon)
        ? plural ? 'without proper' : 'without a proper'
        : plural ? 'with those' : 'with that';
    return `You can't force anything ${description} weapon${plural ? 's' : ''}.`;
}

function objectQuantity(object: GameObject | null | undefined): number {
    return object?.quan ?? object?.quantity ?? 1;
}

function bladeBreaks(weapon: GameObject): boolean {
    const enchantment = weapon.spe ?? weapon.enchantment ?? 0;
    const erosion = Math.max(weapon.oeroded ?? 0, weapon.oeroded2 ?? 0);
    if (rn2(1000 - enchantment) <= 992 - erosion * 10) return false;
    if (weapon.cursed) return false;
    return !objectResistsDestruction(weapon, 0, 99);
}

function bladeBreakMessage(weapon: GameObject, state: GameState): string {
    const name = objectName(weapon, state);
    return objectQuantity(weapon) > 1
        ? `One of your ${pluralizeObjectNoun(weapon, name)} broke!`
        : `Your ${name} broke!`;
}

async function giveUpForcing(occupation: ForceLockOccupation, state: GameState): Promise<void> {
    await pline('You give up your attempt to force the lock.');
    if (occupation.usedtime >= 50) {
        await exerciseAttribute(
            occupation.picktyp ? A_DEX : A_STR, true, state,
        );
    }
    occupation.usedtime = 0;
    state._occupation = null;
    state.context.move = 1;
}

function forceShatterMessage(object: GameObject, state: GameState): string {
    const thing = singularObjectName(object, state);
    const material = objectMaterial(object, state);
    const disposition = material === 5 ? 'is torn to shreds'
        : material === 2 ? 'is crushed'
        : material === 3 ? 'is pulped'
        : material === 4 ? 'is mashed'
        : material === 19 ? 'shatters'
        : material === 8 ? 'splinters to fragments'
        : 'is destroyed';
    const subject = withIndefiniteArticle(thing);
    return `${subject.charAt(0).toUpperCase() + subject.slice(1)} ${disposition}!`;
}

async function shatterChestContent(object: GameObject, state: GameState): Promise<void> {
    if (object.oclass === POTION_CLASS) {
        const bottle = randomBottleName(state);
        await plineWithContinuation(
            `You ${heroIsBlind(state) ? 'hear' : 'see'} ${withIndefiniteArticle(bottle)} shatter!`,
        );
        await applySupportedPotionVapor({ potion: object, state });
    } else {
        await plineWithContinuation(forceShatterMessage(object, state));
    }
}

export async function breakChestLock(box: GameObject, destroyIt: boolean, state: GameState): Promise<void> {
    if (!destroyIt) {
        const contents = box.contents;
        box.contents = [];
        try {
            await chargeAlteredUnpaidObject(box, 'break the lock on', state);
        } finally {
            if (contents === undefined) delete box.contents;
            else box.contents = contents;
        }
        box.olocked = false;
        box.obroken = true;
        box.lknown = true;
        return;
    }

    const x = state.u.ux;
    const y = state.u.uy;
    const shopkeeper = costlySpot(x, y, state)
        ? currentShopResident(state) : null;
    const peacefulShopkeeper = !!shopkeeper?.mpeaceful;
    let loss = 0;
    await plineWithContinuation(
        `In fact, you've totally destroyed ${definiteName(objectName(box, state), state)}.`,
    );
    while (box.contents?.length) {
        const object = box.contents[0];
        if (!object) throw new Error('A chest with contents must have a first object.');
        unlinkObject(object, state);
        const shatters = rn2(3) === 0 || object.oclass === POTION_CLASS;
        if (shatters) {
            await shatterChestContent(object, state);
            if (state.program_state?.gameover) return;
            if (shopkeeper) {
                loss += await stolenValue(object, x, y, peacefulShopkeeper,
                    { silent: true, state });
            }
            if (objectQuantity(object) === 1) {
                await deleteObject(object, state);
                continue;
            }
            await consumeInventoryItem(object, state);
        }
        if (box.otyp === ICE_BOX && object.otyp === CORPSE) {
            object.age = state.moves - (object.age ?? 0);
            startCorpseTimeout(object);
        }
        // Forcing a lock is a hero action; box contents may hold a
        // crysknife, so the drop takes the awaited placement.
        await placeObject(object, x, y, state);
        await stack_object(object, state);
    }

    if (shopkeeper) {
        loss += await stolenValue(box, x, y, peacefulShopkeeper,
            { silent: true, state });
    }
    if (loss) {
        await plineWithContinuation(
            `You owe ${loss} ${currency(loss, { state })} for objects destroyed.`,
        );
    }
    await delobj(box, state);
}
