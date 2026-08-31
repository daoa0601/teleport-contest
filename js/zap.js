// Elemental damage to carried objects.
// C ref: zap.c destroy_items() and maybe_destroy_item().

import { exerciseAttribute } from './attrib.js';
import { Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, OBJECT_NAMES, POT_OIL, SCR_FIRE,
    SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL,
} from './object_data.js';
import {
    OBJECT_TIMER_KIND, stopObjectTimer,
} from './object_timers.js';
import { applySupportedPotionVapor } from './potion_hit.js';
import { makePlural } from './object_grammar.js';
import { rn2, rnd } from './rng.js';

const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const MAX_ITEMS_DESTROYED = 20;

function fireDestroyable(object) {
    if (!object || object.artifact || object.oartifact) return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1) return false;
    if ([SCR_FIRE, SPE_FIREBALL].includes(object.otyp)) return false;
    return object.otyp === GLOB_OF_GREEN_SLIME
        || [POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS]
            .includes(object.oclass);
}

function fireProtectionChance(state) {
    const hero = state.u || {};
    const source = hero._propertySources?.fireResistance;
    if (hero.fireResistanceFromArmor
        || hero.fire_resistance_from_armor
        || ['worn', 'wielded', 'accessory', 'artifact']
            .includes(source?.kind)) return 99;
    const cloak = state.uarmc || hero.uarmc;
    return cloak?.otyp === DWARVISH_CLOAK ? 90 : 0;
}

function removeDestroyedQuantity(state, object, count) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        return;
    }
    const index = state.inventory?.indexOf(object) ?? -1;
    if (index >= 0) state.inventory.splice(index, 1);
    if (state.uwep === object) state.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    object.lamplit = false;
    object.where = 'gone';
    object.ox = object.oy = 0;
}

function destructionMessage(object, count, quantity) {
    const one = count === 1;
    const prefix = one && quantity === 1 ? 'Your '
        : one ? 'One of your '
            : count < quantity ? 'Some of your '
                : quantity === 2 ? 'Both of your ' : 'All of your ';
    const baseName = object.name || OBJECT_NAMES[object.otyp] || 'item';
    const singular = object.oclass === POTION_CLASS
        ? `potion of ${baseName}`
        : object.oclass === SCROLL_CLASS ? `scroll of ${baseName}`
            : object.oclass === SPBOOK_CLASS
                ? `spellbook of ${baseName}` : baseName;
    const name = one && quantity === 1 ? singular : makePlural(singular);
    if (object.oclass === POTION_CLASS) {
        const verb = object.otyp === POT_OIL
            ? one ? 'ignites and explodes' : 'ignite and explode'
            : one ? 'boils and explodes' : 'boil and explode';
        return `${prefix}${name} ${verb}!`;
    }
    const verb = one ? 'catches fire and burns' : 'catch fire and burn';
    return `${prefix}${name} ${verb}!`;
}

function damageHero(state, amount) {
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(0, (state.u[hitPoints] ?? 1) - amount);
}

async function destroyFireItem(
    state,
    object,
    publish,
    random,
    rollOne,
) {
    const protection = fireProtectionChance(state);
    if (protection && random(100) < protection) return 0;
    if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
        const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
        if (!blind) {
            await publish(
                'The Book of the Dead glows a strange dark red, but remains intact.',
            );
        }
        return 0;
    }

    const total = object.quan ?? object.quantity ?? 1;
    const quantity = Math.max(0, total - Number(!!object.in_use));
    const damage = object.oclass === POTION_CLASS ? rollOne(6)
        : object.otyp === GLOB_OF_GREEN_SLIME
            ? Math.trunc(((object.owt ?? 1) + 19) / 20) : 1;
    let destroyed = 0;
    for (let index = 0; index < quantity; index++) {
        if (random(3) === 0) destroyed++;
    }
    if (!destroyed) return 0;

    await publish(destructionMessage(object, destroyed, quantity));
    if (object.oclass === POTION_CLASS) {
        await applySupportedPotionVapor({
            state,
            potion: object,
            publish,
        });
    }
    removeDestroyedQuantity(state, object, destroyed);

    if (!damage) return 0;
    const fireResistant = !!(state.u?.fireResistance
        || state.u?.fire_resistance);
    if (object.oclass !== POTION_CLASS
        && object.otyp !== GLOB_OF_GREEN_SLIME
        && fireResistant) {
        await publish("You aren't hurt!");
        return 0;
    }
    damageHero(state, damage);
    exerciseAttribute(0, false, state);
    return damage;
}

export async function destroyFireInventory(
    sourceDamage,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5)) limit++;
    limit = Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
    if (!limit) return 0;

    const chosen = Array(limit).fill(null);
    let eligible = 0;
    for (const object of state.inventory || []) {
        if (!fireDestroyable(object)) continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit) chosen[index] = object;
    }

    let damage = 0;
    for (const object of chosen.slice(0, Math.min(eligible, limit))) {
        if (object && state.inventory?.includes(object)) {
            damage += await destroyFireItem(
                state, object, publish, random, rollOne,
            );
        }
    }
    return damage;
}
