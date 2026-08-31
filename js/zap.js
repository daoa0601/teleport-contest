// Elemental damage to carried objects.
// C ref: zap.c destroy_items() and maybe_destroy_item().

import { findArmorClass } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { Upolyd, W_RING } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { makePlural } from './object_grammar.js';
import {
    DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, OBJECT_CHARGED,
    OBJECT_MATERIAL, OBJECT_NAMES, POT_OIL, RIN_PROTECTION,
    RIN_REGENERATION, RIN_SHOCK_RESISTANCE, SCR_FIRE,
    SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, WAN_LIGHTNING,
} from './object_data.js';
import {
    OBJECT_TIMER_KIND, stopObjectTimer,
} from './object_timers.js';
import { applySupportedPotionVapor } from './potion_hit.js';
import { rn2, rnd } from './rng.js';

const RING_CLASS = 4;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const MAX_ITEMS_DESTROYED = 20;

export const INVENTORY_DAMAGE = Object.freeze({
    COLD: 'cold',
    FIRE: 'fire',
    ELECTRIC: 'electric',
});

function objectClass(object) {
    if (Number.isInteger(object?.oclass)) return object.oclass;
    return {
        Rings: RING_CLASS,
        Potions: POTION_CLASS,
        Scrolls: SCROLL_CLASS,
        Spellbooks: SPBOOK_CLASS,
        Wands: WAND_CLASS,
    }[object?.class] ?? 0;
}

function destroyable(object, damageType) {
    if (!object || object.artifact || object.oartifact) return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1) return false;
    const itemClass = objectClass(object);
    if (damageType === INVENTORY_DAMAGE.FIRE) {
        if ([SCR_FIRE, SPE_FIREBALL].includes(object.otyp)) return false;
        return object.otyp === GLOB_OF_GREEN_SLIME
            || [POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS]
                .includes(itemClass);
    }
    if (damageType === INVENTORY_DAMAGE.COLD)
        return itemClass === POTION_CLASS && object.otyp !== POT_OIL;
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        return [RING_CLASS, WAND_CLASS].includes(itemClass)
            && ![RIN_SHOCK_RESISTANCE, WAN_LIGHTNING]
                .includes(object.otyp);
    }
    return false;
}

function protectionChance(state, damageType) {
    const hero = state.u || {};
    const property = {
        [INVENTORY_DAMAGE.COLD]: 'coldResistance',
        [INVENTORY_DAMAGE.FIRE]: 'fireResistance',
        [INVENTORY_DAMAGE.ELECTRIC]: 'shockResistance',
    }[damageType];
    const source = hero._propertySources?.[property];
    const snakeProperty = property.replace(
        /[A-Z]/gu, letter => `_${letter.toLowerCase()}`,
    );
    if (hero[`${property}FromArmor`]
        || hero[`${snakeProperty}_from_armor`]
        || ['worn', 'wielded', 'accessory', 'artifact']
            .includes(source?.kind)) return 99;
    const cloak = state.uarmc || hero.uarmc;
    return damageType !== INVENTORY_DAMAGE.ELECTRIC
        && cloak?.otyp === DWARVISH_CLOAK ? 90 : 0;
}

function heroResists(state, damageType) {
    const hero = state.u || {};
    if (damageType === INVENTORY_DAMAGE.FIRE)
        return !!(hero.fireResistance || hero.fire_resistance);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return !!(hero.shockResistance || hero.shock_resistance);
    return false;
}

function isWornRing(object, state) {
    return object === state.uleft || object === state.uright
        || object === state.u?.uleft || object === state.u?.uright
        || ((object?.owornmask ?? 0) & W_RING) !== 0;
}

function glovesBlockRingShock(object, state) {
    if (!isWornRing(object, state)) return false;
    const gloves = state.uarmg || state.u?.uarmg;
    if (!gloves) return false;
    const material = OBJECT_MATERIAL[gloves.otyp] ?? 0;
    return material < 11 || material > 17;
}

function clearWornRing(object, state) {
    for (const slot of ['uleft', 'uright']) {
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
    }
    object.owornmask = (object.owornmask ?? 0) & ~W_RING;
    object.worn = false;
    object.wornSlot = null;
    if (object.otyp === RIN_REGENERATION) {
        const otherRing = state.uleft || state.uright
            || state.u?.uleft || state.u?.uright;
        if (otherRing?.otyp !== RIN_REGENERATION) {
            state.u.regenerationExtrinsic = false;
            state.u.regeneration = false;
        }
    }
    findArmorClass(state);
}

function removeDestroyedQuantity(state, object, count) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        return;
    }
    if (isWornRing(object, state)) clearWornRing(object, state);
    const index = state.inventory?.indexOf(object) ?? -1;
    if (index >= 0) state.inventory.splice(index, 1);
    if (state.uwep === object) state.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    object.lamplit = false;
    object.where = 'gone';
    object.ox = object.oy = 0;
}

function className(object) {
    const name = object.name || OBJECT_NAMES[object.otyp] || 'item';
    const itemClass = objectClass(object);
    if (itemClass === POTION_CLASS && !/\bpotion\b/u.test(name))
        return `potion of ${name}`;
    if (itemClass === SCROLL_CLASS && !/\bscroll\b/u.test(name))
        return `scroll of ${name}`;
    if (itemClass === SPBOOK_CLASS && !/\bspellbook\b/u.test(name))
        return `spellbook of ${name}`;
    if (itemClass === RING_CLASS && !/\bring\b/u.test(name))
        return `ring of ${name}`;
    if (itemClass === WAND_CLASS && !/\bwand\b/u.test(name))
        return `wand of ${name}`;
    return name;
}

function destructionMessage(
    object, damageType, count, quantity, carrierName = null,
) {
    const one = count === 1;
    const prefix = carrierName
        ? one && quantity === 1 ? `The ${carrierName}'s `
            : one ? `One of the ${carrierName}'s `
                : count < quantity ? `Some of the ${carrierName}'s `
                    : quantity === 2 ? `Both of the ${carrierName}'s `
                        : `All of the ${carrierName}'s `
        : one && quantity === 1 ? 'Your '
            : one ? 'One of your '
                : count < quantity ? 'Some of your '
                    : quantity === 2 ? 'Both of your ' : 'All of your ';
    const singular = className(object);
    const name = one && quantity === 1 ? singular : makePlural(singular);
    if (damageType === INVENTORY_DAMAGE.COLD) {
        return `${prefix}${name} ${
            one ? 'freezes and shatters' : 'freeze and shatter'
        }!`;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        const wand = objectClass(object) === WAND_CLASS;
        return `${prefix}${name} ${wand
            ? 'breaks apart and explodes'
            : 'turns to dust and vanishes'}!`;
    }
    if (objectClass(object) === POTION_CLASS) {
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
    state.u[hitPoints] = Math.max(
        0, (state.u[hitPoints] ?? 1) - amount,
    );
}

async function rechargeRing(object, state, publish, random, rollOne) {
    if (!OBJECT_CHARGED[object.otyp] || random(3) === 0) return null;
    const enchantment = object.spe ?? object.enchantment ?? 0;
    if (enchantment > random(7) || enchantment <= -5) {
        await publish(
            `Your ${className(object)} pulsates momentarily, then explodes!`,
        );
        removeDestroyedQuantity(
            state, object, object.quan ?? object.quantity ?? 1,
        );
        let damage = rollOne(3 * Math.abs(enchantment));
        if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
            damage = Math.trunc((damage + 1) / 2);
        damageHero(state, damage);
        return damage;
    }
    await publish(`Your ${className(object)} spins clockwise for a moment.`);
    object.spe = enchantment + 1;
    object.enchantment = object.spe;
    if (object.otyp === RIN_PROTECTION) findArmorClass(state);
    return 0;
}

function itemDamage(object, damageType, rollOne) {
    if (damageType === INVENTORY_DAMAGE.COLD) return rollOne(4);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return objectClass(object) === WAND_CLASS ? rollOne(10) : 0;
    if (objectClass(object) === POTION_CLASS) return rollOne(6);
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return Math.trunc(((object.owt ?? 1) + 19) / 20);
    return 1;
}

async function destroyChosenItem(
    state,
    object,
    damageType,
    publish,
    random,
    rollOne,
) {
    const protection = protectionChance(state, damageType);
    if (protection && random(100) < protection) return 0;
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.otyp === SPE_BOOK_OF_THE_DEAD) {
        const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
        if (!blind) {
            await publish(
                'The Book of the Dead glows a strange dark red, but remains intact.',
            );
        }
        return 0;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC
        && objectClass(object) === RING_CLASS) {
        if (glovesBlockRingShock(object, state)) return 0;
        const rechargeDamage = await rechargeRing(
            object, state, publish, random, rollOne,
        );
        if (rechargeDamage !== null) return rechargeDamage;
    }

    const total = object.quan ?? object.quantity ?? 1;
    const quantity = Math.max(0, total - Number(!!object.in_use));
    const damage = itemDamage(object, damageType, rollOne);
    let destroyed = 0;
    for (let index = 0; index < quantity; index++) {
        if (random(3) === 0) destroyed++;
    }
    if (!destroyed) return 0;

    await publish(destructionMessage(
        object, damageType, destroyed, quantity,
    ));
    if (damageType === INVENTORY_DAMAGE.FIRE
        && objectClass(object) === POTION_CLASS) {
        await applySupportedPotionVapor({
            state,
            potion: object,
            publish,
        });
    }
    removeDestroyedQuantity(state, object, destroyed);

    if (!damage) return 0;
    const resistant = heroResists(state, damageType);
    const resistanceStopsDamage
        = damageType === INVENTORY_DAMAGE.ELECTRIC
            ? objectClass(object) !== RING_CLASS
            : damageType === INVENTORY_DAMAGE.FIRE
                && objectClass(object) !== POTION_CLASS
                && object.otyp !== GLOB_OF_GREEN_SLIME;
    if (resistant && resistanceStopsDamage) {
        await publish("You aren't hurt!");
        return 0;
    }
    damageHero(state, damage);
    exerciseAttribute(0, false, state);
    return damage;
}

export async function destroyInventoryByElement(
    damageType,
    sourceDamage,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    if (!Object.values(INVENTORY_DAMAGE).includes(damageType)) return 0;
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return 0;

    const chosen = chooseStacks(
        state.inventory || [], damageType, limit, random,
    );

    let damage = 0;
    for (const object of chosen) {
        if (object && state.inventory?.includes(object)) {
            damage += await destroyChosenItem(
                state, object, damageType, publish, random, rollOne,
            );
        }
    }
    return damage;
}

function destructionLimit(sourceDamage, random) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5)) limit++;
    return Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
}

function chooseStacks(objects, damageType, limit, random) {
    const chosen = Array(limit).fill(null);
    let eligible = 0;
    for (const object of objects) {
        if (!destroyable(object, damageType)) continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit) chosen[index] = object;
    }
    return chosen.slice(0, Math.min(eligible, limit));
}

function removeMonsterQuantity(monster, object, count) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    object.quan = remaining;
    object.quantity = remaining;
    if (remaining > 0) return;
    const inventory = (monster.minvent || monster.inventory || [])
        .filter(candidate => candidate !== object);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.where = 'gone';
    object.ocarry = null;
}

export async function destroyColdMonsterInventory(
    monster,
    sourceDamage,
    {
        carrierName = 'monster',
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        visible = false,
    } = {},
) {
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const chosen = chooseStacks(
        inventory, INVENTORY_DAMAGE.COLD, limit, random,
    );
    let damage = 0;
    for (const object of chosen) {
        if (!inventory.includes(object)) continue;
        const stackDamage = rollOne(4);
        const total = object.quan ?? object.quantity ?? 1;
        const quantity = Math.max(0, total - Number(!!object.in_use));
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        if (visible) {
            await publish(destructionMessage(
                object, INVENTORY_DAMAGE.COLD, destroyed, quantity,
                carrierName,
            ));
        }
        removeMonsterQuantity(monster, object, destroyed);
        damage += stackDamage;
    }
    return damage;
}

export function destroyFireInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyColdInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyElectricInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options,
    );
}
