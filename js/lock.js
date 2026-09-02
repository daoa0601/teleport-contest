// Lock forcing.
// C ref: lock.c doforce(), forcelock(), and breakchestlock().

import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_DEX, A_STR, P_DAGGER, P_FLAIL, P_LANCE, P_PICK_AXE,
    W_QUIVER, W_SWAPWEP, W_WEP,
} from './const.js';
import {
    flushPendingTopline, newsym, pline, plineWithContinuation,
} from './display.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { wakeMonstersNear } from './monster_wake.js';
import {
    CHEST, LARGE_BOX, OBJECT_LARGE_DAMAGE, OBJECT_MATERIAL, OBJECT_NAMES,
    OBJECT_SUBTYPE,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { unseenObjectNoun } from './objnam.js';
import { heroHasNoHands } from './polyself.js';
import { promptYesNoQuit } from './query.js';
import { rn2 } from './rng.js';
import { objectWeight } from './weight.js';
import { isBlade } from './weapon_type.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const ROCK_CLASS = 14;

export async function doforce(state = game) {
    if (state.u?.uswallow) {
        await pline("You can't force anything from inside here.");
        state.context.move = 0;
        return;
    }
    if (!isForceableWeapon(state.uwep)) {
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
    const boxes = (state.level?.objects?.[x]?.[y] || []).filter(object =>
        object.otyp === LARGE_BOX || object.otyp === CHEST);
    let reportedOpenBox = false;
    for (const box of boxes) {
        if (box.obroken || !box.olocked) {
            const condition = box.obroken ? 'broken' : 'unlocked';
            await plineWithContinuation(
                `There is ${boxDescription(box)} here, but its lock is `
                + `already ${condition}.`,
            );
            box.lknown = true;
            reportedOpenBox = true;
            continue;
        }

        if (reportedOpenBox) await flushPendingTopline();
        const answer = await promptYesNoQuit(
            `There is ${boxDescription(box, true)} here; `
            + 'force its lock? [ynq] (q) ',
        );
        box.lknown = true;
        if (answer === 'q') {
            state.context.move = 0;
            return;
        }
        if (answer === 'n') continue;

        const weapon = state.uwep;
        const action = prying
            ? `You force ${possessiveWeaponName(weapon)} into a crack and pry.`
            : `You start bashing it with ${possessiveWeaponName(weapon)}.`;
        await pline(action);
        state._occupation = {
            key: 'force-lock',
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
            useOneWeapon(weapon, state);
            await plineWithContinuation(
                'You give up your attempt to force the lock.',
            );
            exerciseAttribute(A_DEX, true, state);
            state._occupation = null;
            state.context.move = 1;
            return true;
        }
    } else {
        const wakeDistance = (state.u?.ulevel ?? 1) * 20;
        wakeMonstersNear(
            state.u?.ux ?? 0, state.u?.uy ?? 0, wakeDistance, state,
        );
    }

    if (rn2(100) < occupation.chance) {
        await plineWithContinuation('You succeed in forcing the lock.');
        exerciseAttribute(occupation.picktyp ? A_DEX : A_STR, true, state);
        const destroyed = !occupation.picktyp && rn2(3) === 0;
        await breakChestLock(box, destroyed, state);
        newsym(state.u.ux, state.u.uy);
        state._occupation = null;
    }
    state.context.move = 1;
    return true;
}

function isForceableWeapon(weapon) {
    if (!weapon) return false;
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
    if (rn2(1000 - enchantment) <= 992 - erosion * 10) return false;
    if (weapon.cursed) return false;
    const resistance = weapon.oartifact || weapon.artifact ? 99 : 0;
    return rn2(100) >= resistance;
}

function bladeBreakMessage(weapon) {
    return objectQuantity(weapon) > 1
        ? `One of your ${objectName(weapon)} broke!`
        : `Your ${objectName(weapon)} broke!`;
}

function useOneWeapon(weapon, state) {
    const quantity = objectQuantity(weapon);
    if (quantity > 1) {
        weapon.quan = quantity - 1;
        weapon.quantity = quantity - 1;
        weapon.owt = objectWeight(weapon);
        return;
    }

    const index = state.inventory?.indexOf(weapon) ?? -1;
    if (index >= 0) state.inventory.splice(index, 1);
    if (state.uwep === weapon) state.uwep = null;
    if (state.uswapwep === weapon) state.uswapwep = null;
    if (state.uquiver === weapon) state.uquiver = null;
    if (state.u?.uwep === weapon) state.u.uwep = null;
    if (state.u?.uswapwep === weapon) state.u.uswapwep = null;
    if (state.u?.uquiver === weapon) state.u.uquiver = null;
    if (state.u) state.u.twoweap = false;
    weapon.owornmask = (weapon.owornmask ?? 0)
        & ~(W_WEP | W_SWAPWEP | W_QUIVER);
    weapon.wielded = false;
    weapon.alternate = false;
    weapon.ready = false;
    weapon.where = 'gone';
}

async function giveUpForcing(occupation, state) {
    await pline('You give up your attempt to force the lock.');
    if (occupation.usedtime >= 50) {
        exerciseAttribute(
            occupation.picktyp ? A_DEX : A_STR, true, state,
        );
    }
    state._occupation = null;
    state.context.move = 1;
}

function forceShatterMessage(object) {
    const thing = unseenObjectNoun({ ...object, dknown: false });
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

async function breakChestLock(box, destroyIt, state) {
    if (!destroyIt) {
        box.olocked = false;
        box.obroken = true;
        box.lknown = true;
        return;
    }

    await plineWithContinuation(
        `In fact, you've totally destroyed the ${boxName(box)}.`,
    );
    const contents = Array.isArray(box.contents) ? box.contents : [];
    while (contents.length) {
        const object = contents.shift();
        const shatters = rn2(3) === 0 || object.oclass === 8;
        if (shatters) {
            await plineWithContinuation(forceShatterMessage(object));
            const quantity = objectQuantity(object);
            if (quantity <= 1) {
                object.where = 'gone';
                object.ox = object.oy = 0;
                continue;
            }
            object.quan = object.quantity = quantity - 1;
        }
        place_object(object, state.u.ux, state.u.uy);
        stack_object(object, state);
    }

    rn2(100);
    const pile = state.level?.objects?.[state.u?.ux]?.[state.u?.uy];
    const index = pile?.indexOf(box) ?? -1;
    if (index >= 0) pile.splice(index, 1);
    box.where = 'gone';
    box.ox = box.oy = 0;
}
