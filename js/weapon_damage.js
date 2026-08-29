// weapon_damage.js — Shared physical weapon die, enchantment, and erosion.
// C refs: weapon.c:dmgval(), weapon.c:dbon().

import {
    OBJECT_LARGE_DAMAGE, OBJECT_NAMES, OBJECT_SMALL_DAMAGE,
} from './object_data.js';
import { MONSTER_SIZE } from './monster_data.js';
import { d, rnd } from './rng.js';

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

function finalizePhysicalDamage(object, damage) {
    damage += enchantment(object);
    if (damage < 0) damage = 0;
    if (damage > 0) damage = Math.max(1, damage - erosion(object));
    return damage;
}

// This owns dmgval()'s ordinary physical table. Target-specific blessing,
// silver, wooden-target, artifact-light, shade, and thick-hide modifiers are
// intentionally selected by callers before they enter this shared core.
export function rollPhysicalWeaponDamage(object, monster) {
    const profile = damageProfile(object, monster);
    let damage = profile.range > 0 ? rnd(profile.range) : 0;
    damage += profile.fixed;
    if (profile.random4) damage += rnd(4);
    if (profile.random6) damage += rnd(6);
    if (profile.twoD4) damage += d(2, 4);
    if (profile.twoD6) damage += d(2, 6);
    return finalizePhysicalDamage(object, damage);
}

export function maximumPhysicalWeaponDamage(object, monster) {
    const profile = damageProfile(object, monster);
    let damage = profile.range + profile.fixed;
    if (profile.random4) damage += 4;
    if (profile.random6) damage += 6;
    if (profile.twoD4) damage += 8;
    if (profile.twoD6) damage += 12;
    return finalizePhysicalDamage(object, damage);
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
