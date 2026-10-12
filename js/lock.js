// Lock forcing.
// C ref: lock.c doforce(), forcelock(), and breakchestlock().
import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_DEX, A_STR, P_DAGGER, P_FLAIL, P_LANCE, P_PICK_AXE, } from './const.js';
import { flushPendingTopline, newsym, pline, plineWithContinuation, } from './display.js';
import { placeObject, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { consumeInventoryItem } from './invent.js';
import { wakeMonstersNear } from './monster_wake.js';
import { CHEST, LARGE_BOX, OBJECT_LARGE_DAMAGE, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SUBTYPE, } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { deleteObject, delobj } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { unseenObjectNoun } from './objnam.js';
import { heroHasNoHands } from './polyself.js';
import { applySupportedPotionVapor, randomBottleName } from './potion_hit.js';
import { promptYesNoQuit } from './query.js';
import { rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { costlySpot, currentShopResident } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { isBlade } from './weapon_type.js';
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const ROCK_CLASS = 14;
const POTION_CLASS = 8;
export async function doforce(state = game) {
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
    const prying = isBlade(state.uwep) && !isPick(state.uwep);
    const previous = state._occupation;
    if (previous?.key === 'force-lock' && previous.usedtime
        && previous.container && previous.picktyp === prying) {
        await pline('You resume your attempt to force the lock.');
        state.context.move = 1;
        return;
    }
    const x = state.u.ux;
    const y = state.u.uy;
    const boxes = (state.level?.objects?.[x]?.[y] || []).filter(object => object.otyp === LARGE_BOX || object.otyp === CHEST);
    let reportedOpenBox = false;
    for (const box of boxes) {
        if (box.obroken || !box.olocked) {
            const condition = box.obroken ? 'broken' : 'unlocked';
            await plineWithContinuation(`There is ${boxDescription(box)} here, but its lock is `
                + `already ${condition}.`);
            box.lknown = true;
            reportedOpenBox = true;
            continue;
        }
        if (reportedOpenBox)
            await flushPendingTopline();
        const answer = await promptYesNoQuit(`There is ${boxDescription(box, true)} here; `
            + 'force its lock?');
        box.lknown = true;
        if (answer === 'q') {
            state.context.move = 0;
            return;
        }
        if (answer === 'n')
            continue;
        const weapon = state.uwep;
        const action = prying
            ? `You force ${possessiveWeaponName(weapon)} into a crack and pry.`
            : `You start bashing it with ${possessiveWeaponName(weapon)}.`;
        await pline(action);
        state._occupation = {
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
    else
        await pline('You decide not to force the issue.');
    state.context.move = 1;
}
export async function continueForceLock(occupation, state = game) {
    const box = occupation.container;
    const pile = state.level?.objects?.[state.u?.ux]?.[state.u?.uy] || [];
    if (!box || !pile.includes(box)) {
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
            await pline(bladeBreakMessage(weapon));
            await consumeInventoryItem(weapon, state);
            if (state.program_state?.gameover)
                return true;
            await plineWithContinuation('You give up your attempt to force the lock.');
            await exerciseAttribute(A_DEX, true, state);
            state._occupation = null;
            state.context.move = 1;
            return true;
        }
    }
    else {
        const wakeDistance = (state.u?.ulevel ?? 1) * 20;
        wakeMonstersNear(state.u?.ux ?? 0, state.u?.uy ?? 0, wakeDistance, state);
    }
    if (rn2(100) < occupation.chance) {
        await plineWithContinuation('You succeed in forcing the lock.');
        await exerciseAttribute(occupation.picktyp ? A_DEX : A_STR, true, state);
        const destroyed = !occupation.picktyp && rn2(3) === 0;
        await breakChestLock(box, destroyed, state);
        if (state.program_state?.gameover)
            return true;
        newsym(state.u.ux, state.u.uy);
        state._occupation = null;
    }
    state.context.move = 1;
    return true;
}
function isForceableWeapon(weapon) {
    if (!weapon)
        return false;
    const weaponTool = weapon.oclass === TOOL_CLASS
        && (OBJECT_SUBTYPE[weapon.otyp] || 0) !== 0;
    if (weapon.oclass === WEAPON_CLASS || weaponTool) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] || 0;
        return skill >= P_DAGGER && skill <= P_LANCE && skill !== P_FLAIL;
    }
    return weapon.oclass === ROCK_CLASS;
}
function isPick(weapon) {
    return (weapon?.oclass === WEAPON_CLASS || weapon?.oclass === TOOL_CLASS)
        && OBJECT_SUBTYPE[weapon.otyp] === P_PICK_AXE;
}
function forceWeaponFailure(weapon) {
    if (!weapon)
        return "You can't force anything when not wielding a weapon.";
    const plural = objectQuantity(weapon) > 1;
    return `You can't force anything ${plural
        ? 'with those weapons' : 'with that weapon'}.`;
}
function boxName(box) {
    return OBJECT_NAMES[box.otyp] || 'box';
}
function boxDescription(box, locked = false) {
    const description = `${locked ? 'locked ' : ''}${boxName(box)}`;
    const article = /^[aeiou]/i.test(description) ? 'an' : 'a';
    return `${article} ${description}`;
}
function objectQuantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
function objectName(object) {
    const base = OBJECT_NAMES[object.otyp] || object.name || 'weapon';
    const quantity = objectQuantity(object);
    const noun = quantity > 1 ? object.plural || makePlural(base) : base;
    const individual = object.oextra?.oname
        || artifactById(object.oartifact)?.name || object.artifactName;
    return individual ? `${noun} named ${individual}` : noun;
}
function possessiveWeaponName(weapon) {
    return `your ${objectName(weapon)}`;
}
function bladeBreaks(weapon) {
    const enchantment = weapon.spe ?? weapon.enchantment ?? 0;
    const erosion = Math.max(weapon.oeroded ?? 0, weapon.oeroded2 ?? 0);
    if (rn2(1000 - enchantment) <= 992 - erosion * 10)
        return false;
    if (weapon.cursed)
        return false;
    const resistance = weapon.oartifact || weapon.artifact ? 99 : 0;
    return rn2(100) >= resistance;
}
function bladeBreakMessage(weapon) {
    return objectQuantity(weapon) > 1
        ? `One of your ${objectName(weapon)} broke!`
        : `Your ${objectName(weapon)} broke!`;
}
async function giveUpForcing(occupation, state) {
    await pline('You give up your attempt to force the lock.');
    if (occupation.usedtime >= 50) {
        await exerciseAttribute(occupation.picktyp ? A_DEX : A_STR, true, state);
    }
    state._occupation = null;
    state.context.move = 1;
}
function forceShatterMessage(object) {
    const thing = unseenObjectNoun(object);
    const article = /^[aeiou]/i.test(thing) ? 'An' : 'A';
    const material = OBJECT_MATERIAL[object?.otyp] ?? 0;
    const disposition = material === 5 ? 'is torn to shreds'
        : material === 2 ? 'is crushed'
            : material === 3 ? 'is pulped'
                : material === 4 ? 'is mashed'
                    : material === 19 ? 'shatters'
                        : material === 8 ? 'splinters to fragments'
                            : 'is destroyed';
    return `${article} ${thing} ${disposition}!`;
}
async function shatterChestContent(object, state) {
    if (object.oclass === POTION_CLASS) {
        const bottle = randomBottleName(state);
        const article = /^[aeiou]/i.test(bottle) ? 'an' : 'a';
        await plineWithContinuation(`You ${heroIsBlind(state) ? 'hear' : 'see'} ${article} ${bottle} shatter!`);
        await applySupportedPotionVapor({ potion: object, state });
    }
    else {
        await plineWithContinuation(forceShatterMessage(object));
    }
}
async function breakChestLock(box, destroyIt, state) {
    if (!destroyIt) {
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
    await plineWithContinuation(`In fact, you've totally destroyed the ${boxName(box)}.`);
    while (box.contents?.length) {
        const object = box.contents[0];
        if (!object)
            throw new Error('A chest with contents must have a first object.');
        unlinkObject(object, state);
        const shatters = rn2(3) === 0 || object.oclass === POTION_CLASS;
        if (shatters) {
            await shatterChestContent(object, state);
            if (state.program_state?.gameover)
                return;
            if (shopkeeper) {
                loss += await stolenValue(object, x, y, peacefulShopkeeper, { silent: true, state });
            }
            if (objectQuantity(object) === 1) {
                await deleteObject(object, state);
                continue;
            }
            await consumeInventoryItem(object, state);
        }
        // Forcing a lock is a hero action; box contents may hold a
        // crysknife, so the drop takes the awaited placement.
        await placeObject(object, x, y, state);
        await stack_object(object, state);
    }
    if (shopkeeper) {
        loss += await stolenValue(box, x, y, peacefulShopkeeper, { silent: true, state });
    }
    if (loss) {
        await plineWithContinuation(`You owe ${loss} ${loss === 1 ? 'zorkmid' : 'zorkmids'} for objects destroyed.`);
    }
    await delobj(box, state);
}
//# sourceMappingURL=lock.js.map