// Thrown-object contact while the hero is engulfed.
// C refs: dothrow.c throw_obj(), throwit(), thitmonst(), swallowit();
// steal.c mpickobj().

import {
    hitMonsterWithThrownEggPieOrVenom, isHeroThrownEggPieOrVenom,
} from './hero_thrown_egg_pie_venom.js';
import { plineWithContinuation } from './display.js';
import { objectName } from './objnam.js';
import { game } from './gstate.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    BOULDER, BRASS_LANTERN, CLOVE_OF_GARLIC, MAGIC_LAMP, OBJECT_SUBTYPE,
    OIL_LAMP,
} from './object_data.js';
import {
    MONSTER_SYMBOL, monsterCanEngulf, monsterDigests, monsterTypeName,
} from './monster_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from './object_timers.js';
import {
    isThrowingWeapon, launcherMatchesAmmo,
} from './object_properties.js';
import { rnd } from './rng.js';
import {
    hitMonsterWithSupportedPotion, SUPPORTED_MONSTER_POTION_TYPES,
} from './potion_hit.js';
import { heroIsBlind } from './senses.js';
import { detachThrownUnit } from './thrown_object.js';
import {
    applyLowStaminaThrow, applyThrowSlip,
} from './throw_state.js';

const PM_AIR_ELEMENTAL = 154;
const POTION_CLASS = 8;
const TIMED_LAMP_TYPES = new Set([BRASS_LANTERN, OIL_LAMP]);
const LAMP_TYPES = new Set([...TIMED_LAMP_TYPES, MAGIC_LAMP]);

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function itemIsEquipped(state, item) {
    return EQUIPMENT_SLOTS.some(slot =>
        state[slot] === item || state.u?.[slot] === item)
        || !!(item.owornmask ?? 0);
}

function supportedLitLamp(state, item, engulfer) {
    if (!item.lamplit) return true;
    if (!LAMP_TYPES.has(item.otyp) || item.artifact || item.oartifact
        || !monsterCanEngulf(engulfer)) return false;
    const timers = objectTimers(item);
    if (item.otyp === MAGIC_LAMP) return timers.length === 0;
    return timers.length === 1
        && timers[0].kind === OBJECT_TIMER_KIND.BURN_OBJECT
        && Number.isFinite(timers[0].deadline)
        && timers[0].deadline >= (state.moves ?? 0);
}

function swallowedWeaponTarget(state, item, objectClass) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer) return null;
    const subtype = OBJECT_SUBTYPE[item.otyp] ?? 0;
    const weaponOrTool = objectClass === 2
        || (objectClass === 6 && subtype !== 0);

    if (!weaponOrTool || engulfer.wormno) {
        return null;
    }
    return engulfer;
}

function genericSwallowedEligibility(
    state, item, objectClass, selectedQuantity,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer) return null;

    // Weapon/gem damage, food/taming, effectful potions, balls, boulders,
    // eggs, venom,
    // shop objects, worn-state removal, unsupported burning objects, and
    // timed stack splitting own materially different continuations and
    // remain explicit successors.  The supported lamps below reuse the
    // live burn-timer owner after mpickobj() has linked monster ownership.
    const foodNeedsTamingRules = objectClass === 7
        && item.otyp !== CLOVE_OF_GARLIC;
    if ([2, 8, 12, 13, 15, 17].includes(objectClass)
        || foodNeedsTamingRules
        || item.otyp === BOULDER
        || item === state.uball || item === state.u?.uball) return null;
    if (objectClass === 6 && (OBJECT_SUBTYPE[item.otyp] ?? 0) !== 0)
        return null; // is_weptool()
    if (itemIsEquipped(state, item)) return null;
    if (!supportedLitLamp(state, item, engulfer)) return null;
    if (selectedQuantity > 1
        && ((item.timed ?? 0) > 0 || (item.objectTimers?.length ?? 0) > 0)) {
        return null;
    }
    return engulfer;
}

function swallowedPotionEligibility(
    state, item, objectClass, selectedQuantity,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1) {
        return null;
    }
    return engulfer;
}

export async function resolveSwallowedWeaponThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    finishKill,
}) {
    const engulfer = swallowedWeaponTarget(state, item, objectClass);
    if (!engulfer) return false;
    const thrown = await detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    const launched = launcherMatchesAmmo(thrown, state.uwep);
    await applyThrowSlip({
        state,
        object: thrown,
        launcher: launched,
        throwingWeapon: isThrowingWeapon(thrown),
    });
    await applyLowStaminaThrow({ state, object: thrown });

    const contact = await hitMonsterWithThrownObject(engulfer, thrown, {
        state,
        guaranteedHit: true,
        finishKillWithObject: finishKill,
    });
    if (!contact.consumed) {
        addObjectToMonsterInventory(
            engulfer, thrown, state, { atFront: true },
        );
    }
    state.context.move = 1;
    return true;
}

export async function resolveSwallowedEggPieOrVenomThrow({
    state = game,
    item,
    selectedQuantity,
    splitObjectId,
    finishKill,
}) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || !isHeroThrownEggPieOrVenom(item)) return false;

    const thrown = await detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );
    await applyThrowSlip({ state, object: thrown });
    await applyLowStaminaThrow({ state, object: thrown });
    await hitMonsterWithThrownEggPieOrVenom(engulfer, thrown, {
        state,
        guaranteedHit: true,
        finishMonsterKill: finishKill,
    });
    state.context.move = 1;
    return true;
}

export async function resolveSwallowedPotionThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    wakeMonster,
    wakeNearby,
    finishKill,
}) {
    const engulfer = swallowedPotionEligibility(
        state, item, objectClass, selectedQuantity,
    );
    if (!engulfer) return false;
    const thrown = await detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    // throwit() evaluates its cursed/greased slip draw before thitmonst().
    // Potions only enter the displacement branch when greased, but a cursed
    // ungreased identity still consumes the rn2(7) gate.
    await applyThrowSlip({ state, object: thrown });
    await applyLowStaminaThrow({ state, object: thrown });

    rnd(20);
    await hitMonsterWithSupportedPotion({
        state,
        monster: engulfer,
        potion: thrown,
        wakeMonster,
        wakeNearby,
        finishKill,
        heroCaused: true,
        resolveVapor: true,
        distance: 0,
    });
    state.context.move = 1;
    return true;
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
    const thrown = await detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );
    await applyThrowSlip({ state, object: thrown });
    await applyLowStaminaThrow({ state, object: thrown });

    rnd(20); // thitmonst() consumes dieroll before selecting this class arm
    await wakeMonster(engulfer);
    const monsterName = engulfer.name
        || `the ${monsterTypeName(engulfer.mnum, !!engulfer.female)}`;
    const whirly = MONSTER_SYMBOL[engulfer.mnum] === 22
        || engulfer.mnum === PM_AIR_ELEMENTAL;
    const trail = monsterDigests(engulfer)
        ? ' entrails' : whirly ? ' currents' : '';
    const destination = trail
        ? `${possessive(monsterName)}${trail}` : monsterName;
    await plineWithContinuation(
        `The ${objectName(thrown, state)} vanishes into ${destination}.`,
    );
    const snuffLamp = thrown.lamplit && LAMP_TYPES.has(thrown.otyp)
        && monsterCanEngulf(engulfer);
    if (snuffLamp && !heroIsBlind(state)) {
        await plineWithContinuation(
            `The ${objectName(thrown, state)} goes out.`,
        );
    }
    addObjectToMonsterInventory(
        engulfer, thrown, state, { atFront: true },
    );
    state.context.move = 1;
    return true;
}
