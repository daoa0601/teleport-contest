// swallowed_throw.js — Generic non-consuming projectile contact while engulfed.
// C refs: dothrow.c throw_obj(), throwit(), thitmonst(), swallowit();
// steal.c mpickobj().

import { LOST_THROWN } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    BOULDER, OBJECT_DESCRIPTIONS, OBJECT_NAMES, OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import {
    MONSTER_ATTACKS, MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { rn2, rnd } from './rng.js';
import { objectTypeKnown } from './shk.js';

const PM_AIR_ELEMENTAL = 154;
const AT_ENGL = 11;
const AD_DGST = 26;

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// objnam.c:xname() presentation used by Tobjnam() during swallowed contact.
// Unlike doname(), this deliberately omits quantity, beatitude, enchantment,
// and an indefinite article; throwit adds the definite article and verb.
function thrownObjectName(object, state) {
    const oclass = object.oclass;
    const trueName = OBJECT_NAMES[object.otyp] || object.name || 'object';
    const appearance = state.objectDescriptions?.[object.otyp]
        ?? OBJECT_DESCRIPTIONS[object.otyp];
    const known = objectTypeKnown(object, state);
    let noun;
    if (known) {
        if (oclass === 4) noun = `ring of ${trueName}`;
        else if (oclass === 8) noun = `potion of ${trueName}`;
        else if (oclass === 9) noun = `scroll of ${trueName}`;
        else if (oclass === 10) noun = `spellbook of ${trueName}`;
        else if (oclass === 11) noun = `wand of ${trueName}`;
        else noun = trueName;
    } else if (oclass === 4) noun = `${appearance || 'unknown'} ring`;
    else if (oclass === 8) noun = `${appearance || 'unknown'} potion`;
    else if (oclass === 9) noun = appearance === 'unlabeled'
        ? 'unlabeled scroll' : `scroll labeled ${appearance || 'unknown'}`;
    else if (oclass === 10) noun = `${appearance || 'unknown'} spellbook`;
    else if (oclass === 11) noun = `${appearance || 'unknown'} wand`;
    else noun = appearance || trueName;

    const individualName = object.oextra?.oname || object.oname;
    return individualName ? `${noun} named ${individualName}` : noun;
}

function containsUnpaidObject(object) {
    if (!object) return false;
    if (object.unpaid) return true;
    return (object.contents || []).some(containsUnpaidObject);
}

function genericSwallowedEligibility(
    state, item, objectClass, selectedQuantity,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer) return null;

    // Weapon/gem damage, food/taming, potions, balls, boulders, venom,
    // lit/shop objects, worn-state removal, and timed stack splitting own
    // materially different continuations and remain explicit successors.
    if ([2, 7, 8, 12, 13, 15, 17].includes(objectClass)
        || item.otyp === BOULDER
        || item === state.uball || item === state.u?.uball) return null;
    if (objectClass === 6 && (OBJECT_SUBTYPE[item.otyp] ?? 0) !== 0)
        return null; // is_weptool()
    if (EQUIPMENT_SLOTS.some(slot =>
        state[slot] === item || state.u?.[slot] === item)
        || (item.owornmask ?? 0)) return null;
    if (item.lamplit || containsUnpaidObject(item)) return null;
    if (selectedQuantity > 1
        && ((item.timed ?? 0) > 0 || (item.objectTimers?.length ?? 0) > 0)) {
        return null;
    }
    const currentHp = state.u?.mh ?? state.u?.uhp ?? 1;
    const currentHpMax = state.u?.mhmax ?? state.u?.uhpmax ?? currentHp;
    if (currentHp < 10 && currentHp !== currentHpMax
        && (item.owt ?? OBJECT_WEIGHT[item.otyp] ?? 0) > currentHp * 2) {
        return null;
    }
    return engulfer;
}

function detachThrownUnit(
    state, item, selectedQuantity, splitObjectId,
) {
    let thrown = item;
    if (selectedQuantity > 1) {
        const unitWeight = OBJECT_WEIGHT[item.otyp]
            ?? Math.max(1, Math.trunc((item.owt ?? 1) / selectedQuantity));
        item.owt = unitWeight * (item.quantity ?? item.quan ?? 1);
        thrown = {
            ...item,
            o_id: splitObjectId,
            invlet: null,
            quan: 1,
            quantity: 1,
            owt: unitWeight,
            owornmask: 0,
            worn: false,
            wornSlot: null,
            ready: false,
            where: 'free',
            objectTimers: [],
            timed: 0,
        };
    } else {
        const index = state.inventory.indexOf(item);
        if (index >= 0) state.inventory.splice(index, 1);
        for (const slot of EQUIPMENT_SLOTS) {
            if (state[slot] === item) state[slot] = null;
            if (state.u?.[slot] === item) state.u[slot] = null;
        }
        thrown.owornmask = 0;
        thrown.worn = false;
        thrown.wornSlot = null;
        thrown.ready = false;
        thrown.where = 'free';
    }
    thrown.how_lost = LOST_THROWN;
    return thrown;
}

export async function resolveGenericSwallowedThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    wakeMonster,
}) {
    const engulfer = genericSwallowedEligibility(
        state, item, objectClass, selectedQuantity,
    );
    if (!engulfer) return false;

    // freeinv() occurs before throwit() begins slip/contact handling.
    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );
    if ((thrown.cursed || thrown.greased) && rn2(7) === 0
        && thrown.greased) {
        await plineWithContinuation(
            `The ${thrownObjectName(thrown, state)} slips as you throw it!`,
        );
        // throwit() rewrites direction even though u.uswallow makes every
        // result contact the same engulfer.
        rn2(3);
        rn2(3);
    }

    rnd(20); // thitmonst() consumes dieroll before selecting this class arm
    await wakeMonster(engulfer);
    const monsterName = engulfer.name
        || `the ${monsterTypeName(engulfer.mnum, !!engulfer.female)}`;
    const digests = MONSTER_ATTACKS[engulfer.mnum]?.some(attack =>
        attack[0] === AT_ENGL && attack[1] === AD_DGST);
    const whirly = MONSTER_SYMBOL[engulfer.mnum] === 22
        || engulfer.mnum === PM_AIR_ELEMENTAL;
    const trail = digests ? ' entrails' : whirly ? ' currents' : '';
    const destination = trail
        ? `${possessive(monsterName)}${trail}` : monsterName;
    await plineWithContinuation(
        `The ${thrownObjectName(thrown, state)} vanishes into ${destination}.`,
    );
    addObjectToMonsterInventory(
        engulfer, thrown, state, { atFront: true },
    );
    state.context.move = 1;
    return true;
}
