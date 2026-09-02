// weapon_damage.js — Shared physical weapon die, enchantment, and erosion.
// C refs: weapon.c:dmgval(), weapon.c:dbon().

import { Upolyd } from './const.js';
import {
    OBJECT_LARGE_DAMAGE, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SMALL_DAMAGE,
    OBJECT_SUBTYPE,
} from './object_data.js';
import {
    MONSTER_SIZE, monsterHatesBlessings, monsterHatesSilver,
    monsterSpeciesHatesSilver,
} from './monster_data.js';
import { objectClassForType } from './object_knowledge.js';
import { rnd } from './rng.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const SILVER = 14;

function objectTypes(names) {
    return new Set(names.map(name => OBJECT_NAMES.indexOf(name))
        .filter(otyp => otyp >= 0));
}

const LARGE_FIXED_ONE = objectTypes([
    'iron chain', 'crossbow bolt', 'morning star', 'partisan', 'runesword',
    'elven broadsword', 'broadsword',
]);
const LARGE_RND4 = objectTypes(['flail', 'ranseur', 'voulge']);
const LARGE_RND6 = objectTypes(['halberd', 'spetum']);
const LARGE_2D4 = objectTypes(['battle-axe', 'bardiche', 'trident']);
const LARGE_2D6 = objectTypes([
    'tsurugi', 'dwarvish mattock', 'two-handed sword',
]);

const SMALL_FIXED_ONE = objectTypes([
    'iron chain', 'crossbow bolt', 'mace', 'silver mace', 'war hammer',
    'flail', 'spetum', 'trident',
]);
const SMALL_RND4 = objectTypes([
    'battle-axe', 'bardiche', 'bill-guisarme', 'guisarme', 'lucern hammer',
    'morning star', 'ranseur', 'broadsword', 'elven broadsword', 'runesword',
    'voulge',
]);
const SMALL_RND6 = objectTypes([]);

function damageProfile(object, monster) {
    const large = (MONSTER_SIZE[monster?.mnum] ?? 2) >= 3;
    const otyp = object.otyp;
    const range = (large ? OBJECT_LARGE_DAMAGE : OBJECT_SMALL_DAMAGE)[otyp]
        ?? 0;
    const fixed = (large ? LARGE_FIXED_ONE : SMALL_FIXED_ONE).has(otyp)
        ? 1 : 0;
    const random4 = (large ? LARGE_RND4 : SMALL_RND4).has(otyp);
    const random6 = (large ? LARGE_RND6 : SMALL_RND6).has(otyp);
    const twoD4 = large && LARGE_2D4.has(otyp);
    const twoD6 = large && LARGE_2D6.has(otyp);
    return { range, fixed, random4, random6, twoD4, twoD6 };
}

function enchantment(object) {
    return object.spe ?? object.enchantment ?? 0;
}

function erosion(object) {
    return Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
}

function addWeaponEnchantment(object, damage) {
    const objectClass = object.oclass || objectClassForType(object.otyp);
    const weaponLike = objectClass === WEAPON_CLASS
        || (objectClass === TOOL_CLASS
            && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0);
    if (!weaponLike) return damage;
    damage += enchantment(object);
    return Math.max(0, damage);
}

function canHaveTargetDamageBonus(object) {
    const objectClass = object.oclass || objectClassForType(object.otyp);
    return objectClass === WEAPON_CLASS
        || (objectClass === TOOL_CLASS
            && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0)
        || objectClass === GEM_CLASS
        || objectClass === BALL_CLASS
        || objectClass === CHAIN_CLASS;
}

function targetDamageBonus(
    object, { hatesBlessings, hatesSilver }, rollOne,
) {
    if (!canHaveTargetDamageBonus(object)) return 0;
    let bonus = 0;
    if (object.blessed && hatesBlessings) bonus += rollOne(4);
    if (OBJECT_MATERIAL[object.otyp] === SILVER && hatesSilver)
        bonus += rollOne(20);
    return bonus;
}

function maximumTargetDamageBonus(object, monster) {
    if (!canHaveTargetDamageBonus(object)) return 0;
    let bonus = 0;
    if (object.blessed && monsterHatesBlessings(monster)) bonus += 4;
    if (OBJECT_MATERIAL[object.otyp] === SILVER
        && monsterHatesSilver(monster)) bonus += 20;
    return bonus;
}

function applyErosion(object, damage) {
    if (damage > 0) damage = Math.max(1, damage - erosion(object));
    return damage;
}

export function rollPhysicalWeaponDamage(
    object, monster, {
        rollOne = rnd,
        hatesBlessings = monsterHatesBlessings(monster),
        hatesSilver = monsterHatesSilver(monster),
        rollDice = (count, sides) => {
            let total = 0;
            for (let die = 0; die < count; die++) total += rollOne(sides);
            return total;
        },
    } = {},
) {
    const profile = damageProfile(object, monster);
    let damage = profile.range > 0 ? rollOne(profile.range) : 0;
    damage += profile.fixed;
    if (profile.random4) damage += rollOne(4);
    if (profile.random6) damage += rollOne(6);
    if (profile.twoD4) damage += rollDice(2, 4);
    if (profile.twoD6) damage += rollDice(2, 6);
    damage = addWeaponEnchantment(object, damage);
    damage += targetDamageBonus(
        object, { hatesBlessings, hatesSilver }, rollOne,
    );
    return applyErosion(object, damage);
}

function heroMonsterNumber(state) {
    if (Upolyd(state.u)) return state.u.umonnum;
    return state.flags?.female
        ? state.urace?.femalenum ?? state.urace?.malenum
        : state.urace?.malenum;
}

export function heroHatesSilver(state) {
    if (Number.isInteger(state.u?.ulycn) && state.u.ulycn >= 0) return true;
    return monsterSpeciesHatesSilver(heroMonsterNumber(state));
}

export function rollPhysicalWeaponDamageAgainstHero(
    object, state, options = {},
) {
    return rollPhysicalWeaponDamage(
        object,
        { mnum: heroMonsterNumber(state) },
        { ...options, hatesSilver: heroHatesSilver(state) },
    );
}

export function maximumPhysicalWeaponDamage(object, monster) {
    const profile = damageProfile(object, monster);
    let damage = profile.range + profile.fixed;
    if (profile.random4) damage += 4;
    if (profile.random6) damage += 6;
    if (profile.twoD4) damage += 8;
    if (profile.twoD6) damage += 12;
    damage = addWeaponEnchantment(object, damage);
    damage += maximumTargetDamageBonus(object, monster);
    return applyErosion(object, damage);
}

// Strength values above 18 retain NetHack's internal encoding (19 == 18/01,
// 93 == 18/75, 118 == 18/**), matching display.js:formatStrength().
export function strengthDamageBonus(strength) {
    if (strength < 6) return -1;
    if (strength < 16) return 0;
    if (strength < 18) return 1;
    if (strength === 18) return 2;
    if (strength <= 93) return 3;
    if (strength <= 108) return 4;
    if (strength < 118) return 5;
    return 6;
}
