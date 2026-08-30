// throw_state.js — Shared throwit() direction, slip, and stamina ownership.
// C refs: dothrow.c throwit(); attrib.c exercise().

import { exerciseAttribute } from './attrib.js';
import { Is_airlevel } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    OBJECT_DESCRIPTIONS, OBJECT_NAMES,
} from './object_data.js';
import { heroIsPolymorphed } from './polyself.js';
import { rn2 } from './rng.js';
import { objectTypeKnown } from './shk.js';
import {
    calcCapacity, objectWeight, SLT_ENCUMBER,
} from './weight.js';

// objnam.c:xname() presentation used by Tobjnam() during thrown contact.
// Unlike doname(), this omits quantity, beatitude, enchantment, and article.
export function thrownObjectName(object, state = game) {
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

    if (!known && object.dknown !== false) {
        const callName = state._objectCallNames?.[object.otyp];
        if (callName) noun += ` called ${callName}`;
    }

    const individualName = object.oextra?.oname || object.oname;
    return individualName ? `${noun} named ${individualName}` : noun;
}

// throwit() evaluates this gate before its stamina branch.  A real slip
// rewrites the persistent direction even while engulfed, where every result
// still contacts the same monster.
export async function applyThrowSlip({
    state = game,
    object,
    launcher = false,
    throwingWeapon = false,
    publish = plineWithContinuation,
} = {}) {
    const u = state.u || (state.u = {});
    if (!(object?.cursed || object?.greased)
        || !(u.dx || u.dy) || rn2(7) !== 0) return false;

    if (launcher) {
        await publish(`The ${thrownObjectName(object, state)} misfires!`);
    } else if (object.greased || throwingWeapon) {
        await publish(
            `The ${thrownObjectName(object, state)} slips as you throw it!`,
        );
    } else {
        return false;
    }

    u.dx = rn2(3) - 1;
    u.dy = rn2(3) - 1;
    u.dz = 0;
    if (!u.dx && !u.dy) u.dz = 1;
    return true;
}

// The object has already left inventory here.  calc_capacity(obj->owt)
// temporarily adds its weight back, reproducing the pre-detachment load.
// While swallowed, changing direction to down does not bypass monster
// contact; it only records the source direction state.
export async function applyLowStaminaThrow({
    state = game,
    object,
    publish = plineWithContinuation,
} = {}) {
    const u = state.u || (state.u = {});
    const polymorphed = heroIsPolymorphed(state);
    const currentHp = polymorphed ? (u.mh ?? 1) : (u.uhp ?? 1);
    const currentHpMax = polymorphed
        ? (u.mhmax ?? currentHp) : (u.uhpmax ?? currentHp);
    const thrownWeight = objectWeight(object);
    const threshold = polymorphed ? 5 : 10;
    const activeDirection = !!(u.dx || u.dy || (u.dz ?? 0) < 1);
    if (!activeDirection
        || calcCapacity(state, thrownWeight) <= SLT_ENCUMBER
        || currentHp >= threshold || currentHp === currentHpMax
        || thrownWeight <= currentHp * 2
        || Is_airlevel(u.uz)) return false;

    await publish(
        `You have so little stamina, the ${
            thrownObjectName(object, state)
        } drops from your grasp.`,
    );
    // exercise() ignores physical attributes while polymorphed.
    if (!polymorphed) exerciseAttribute(2, false, state);
    u.dx = u.dy = 0;
    u.dz = 1;
    return true;
}
