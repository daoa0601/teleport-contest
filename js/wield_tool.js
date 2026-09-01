// Wielding a tool so another command can use it.
// C ref: wield.c wield_tool().

import { W_ACCESSORY, W_ARMOR, W_SWAPWEP, W_WEP } from './const.js';
import { pline } from './display.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import {
    HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_BIMANUAL, OBJECT_SUBTYPE,
    TIN_OPENER,
} from './object_data.js';
import {
    heroHasNoHands, heroIsVerySmall,
} from './polyself.js';
import { setQuiverObject } from './quiver.js';
import { releaseWeaponSlots } from './weapon_slots.js';

function quantityOf(object) {
    return object.quan ?? object.quantity ?? 1;
}

function objectIsPlural(object) {
    const name = object.name || '';
    return quantityOf(object) > 1
        || name.includes('pair of ')
        || name.includes('s of ');
}

function simpleName(object) {
    const quantity = quantityOf(object);
    const name = quantity === 1
        ? object.name || 'object'
        : object.plural || `${object.name || 'object'}s`;
    const blessing = object.bknown
        ? object.blessed ? 'blessed '
            : object.cursed ? 'cursed ' : 'uncursed '
        : '';
    return quantity === 1
        ? `${blessing}${name}`
        : `${quantity} ${blessing}${name}`;
}

function isWeapon(object) {
    return object.class === 'Weapons' || object.oclass === 2;
}

function isWeaponTool(object) {
    return object.oclass === 6 && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0;
}

function willWeld(object) {
    return !!object?.cursed && (
        isWeapon(object)
        || isWeaponTool(object)
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp)
    );
}

function isTwoHanded(object) {
    return !!(object?.bimanual || OBJECT_BIMANUAL[object?.otyp]);
}

function clearPrimary(object, state) {
    if (!object) return;
    if (state.uwep === object) state.uwep = null;
    if (state.u?.uwep === object) state.u.uwep = null;
    object.wielded = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEP;
}

function setPrimary(object, state) {
    releaseWeaponSlots(object, state);
    state.uwep = object;
    if (state.u) state.u.uwep = object;
    object.wielded = true;
    object.alternate = false;
    object.ready = false;
    object.owornmask = (object.owornmask ?? 0) | W_WEP;
}

function pushOldPrimary(object, state) {
    const oldSecondary = state.uswapwep || state.u?.uswapwep || null;
    if (oldSecondary && oldSecondary !== object) {
        oldSecondary.alternate = false;
        oldSecondary.owornmask = (oldSecondary.owornmask ?? 0) & ~W_SWAPWEP;
    }
    state.uswapwep = object;
    if (state.u) state.u.uswapwep = object;
    object.alternate = true;
    object.owornmask = (object.owornmask ?? 0) | W_SWAPWEP;
}

function weldedPrimary(state) {
    const primary = state.uwep || state.u?.uwep || null;
    return willWeld(primary) ? primary : null;
}

async function explainWeldedPrimary(primary, verb, object, state) {
    primary.bknown = true;
    if (state.flags?.verbose === false) {
        await pline("You can't do that.");
        return;
    }
    const hand = isTwoHanded(primary) ? 'hands' : 'hand';
    const demonstrative = quantityOf(object) > 1 ? 'those' : 'that';
    await pline(
        `Since your ${simpleName(primary)} is welded to your ${hand}, `
        + `you cannot ${verb} ${demonstrative} ${object.name || 'object'}.`,
    );
}

export async function wieldTool(
    object,
    verb = 'wield',
    { swapWeapons } = {},
    state = game,
) {
    const current = state.uwep || state.u?.uwep || null;
    if (object === current)
        return { ready: true, newlyWielded: false };

    const plural = objectIsPlural(object);
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) {
        await pline(
            `You can't ${verb} your ${simpleName(object)} while wearing ${
                plural ? 'them' : 'it'}.`,
        );
        return { ready: false, newlyWielded: false };
    }

    const welded = weldedPrimary(state);
    if (welded) {
        await explainWeldedPrimary(welded, verb, object, state);
        return { ready: false, newlyWielded: false };
    }

    if (heroHasNoHands(state) || heroIsVerySmall(state)) {
        await pline(`You can't hold ${plural ? 'them' : 'it'} strongly enough.`);
        return { ready: false, newlyWielded: false };
    }

    if ((state.uarms || state.u?.uarms) && isTwoHanded(object)) {
        await pline(
            `You cannot ${verb} a two-handed ${
                isWeapon(object) ? 'weapon' : 'tool'} while wearing a shield.`,
        );
        return { ready: false, newlyWielded: false };
    }

    if (state.uquiver === object || state.u?.uquiver === object)
        setQuiverObject(null, state);

    if (state.uswapwep === object || state.u?.uswapwep === object) {
        if (!swapWeapons)
            return { ready: false, newlyWielded: false };
        await swapWeapons();
        const ready = (state.uwep || state.u?.uwep) === object;
        return {
            ready,
            newlyWielded: ready,
        };
    }

    const description = inventoryItemDescription(object);
    clearPrimary(current, state);
    setPrimary(object, state);
    if (willWeld(object)) {
        const dominantSide = state.u?.rightHanded === false ? 'left' : 'right';
        const hand = isTwoHanded(object)
            ? 'hands'
            : `dominant ${dominantSide} hand`;
        const pluralName = object.plural || `${object.name || 'object'}s`;
        const subject = quantityOf(object) === 1
            ? `The ${object.name || 'object'} welds itself`
            : `The ${pluralName} weld themselves`;
        await pline(`${subject} to your ${hand}!`);
        object.bknown = true;
    } else {
        await pline(`You now wield ${description}.`);
    }

    if (state.flags?.pushweapon && current && current !== object)
        pushOldPrimary(current, state);
    if (state.u) state.u.twoweap = false;
    state._unweapon = !isWeapon(object);
    return { ready: true, newlyWielded: true };
}
