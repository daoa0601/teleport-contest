// weapon_damage.js — Shared physical weapon die, enchantment, and erosion.
// C refs: weapon.c:dmgval(), weapon.c:dbon().
import { artifactDamageBonus, artifactEmitsLight, artifactStrikesShade, } from './artifacts.js';
import { currentAttribute } from './attrib.js';
import { A_STR, P_AXE, Upolyd, W_ARMG, WT_IRON_BALL_INCR, } from './const.js';
import { game } from './gstate.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { CREAM_PIE, GAUNTLETS_OF_POWER, HEAVY_IRON_BALL, OBJECT_LARGE_DAMAGE, OBJECT_NAMES, OBJECT_SMALL_DAMAGE, OBJECT_SUBTYPE, OBJECT_WEIGHT, } from './object_data.js';
import { MONSTER_SIZE, monsterHatesBlessings, monsterHatesLight, monsterHatesSilver, monsterIsShade, monsterIsThickSkinned, monsterIsWooden, } from './monster_data.js';
import { objectClassForType } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { rn2, rnd } from './rng.js';
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const LEATHER = 7;
const SILVER = 14;
// C uhitm.c:mhitm_ad_phys(). Carrying these gloves is not enough.
export function monsterWeaponStrengthBonus(monster, random = rn2) {
    const gloves = (monster.minvent || []).find(object => (object.owornmask ?? 0) & W_ARMG);
    return gloves?.otyp === GAUNTLETS_OF_POWER ? 3 + random(4) : 0;
}
function objectTypes(names) {
    return new Set(names.map(name => OBJECT_NAMES.indexOf(name))
        .filter(otyp => otyp >= 0));
}
const LARGE_FIXED_ONE = objectTypes([
    'iron chain', 'crossbow bolt', 'morning star', 'partisan', 'runesword',
    'elven broadsword', 'broadsword',
]);
const LARGE_RND4 = objectTypes(['flail', 'ranseur', 'voulge']);
const LARGE_RND6 = objectTypes([
    'splash of acid venom', 'halberd', 'spetum',
]);
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
const SMALL_RND6 = objectTypes(['splash of acid venom']);
function damageProfile(object, monster) {
    const large = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3;
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
    if (!weaponLike)
        return damage;
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
export function shadeBlocksWeaponBaseDamage(object, monster, state = game) {
    return monsterIsShade(monster)
        && objectMaterial(object, state) !== SILVER
        && !artifactStrikesShade(object);
}
function applyTargetBaseRules(object, monster, damage, rollOne, state) {
    const material = objectMaterial(object, state);
    if (material !== undefined && material <= LEATHER && monsterIsThickSkinned(monster))
        damage = 0;
    if (shadeBlocksWeaponBaseDamage(object, monster, state))
        damage = 0;
    if (object.otyp === HEAVY_IRON_BALL && damage > 0) {
        const baseWeight = OBJECT_WEIGHT[HEAVY_IRON_BALL];
        if (baseWeight === undefined)
            throw new Error('The heavy iron ball has no base weight');
        const extraWeight = Math.max(0, (object.owt ?? baseWeight) - baseWeight);
        const increments = Math.trunc(extraWeight / WT_IRON_BALL_INCR);
        if (increments > 0) {
            damage += rollOne(4 * increments);
            damage = Math.min(damage, 25);
        }
    }
    return damage;
}
function targetDamageBonus(object, monster, { hatesBlessings, hatesSilver, hero }, rollOne, state) {
    if (!canHaveTargetDamageBonus(object))
        return 0;
    let bonus = 0;
    if (object.blessed && hatesBlessings)
        bonus += rollOne(4);
    if (Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0) === P_AXE
        && monsterIsWooden(monster))
        bonus += rollOne(4);
    if (objectMaterial(object, state) === SILVER && hatesSilver)
        bonus += rollOne(20);
    if (artifactEmitsLight(object) && object.lamplit
        && monsterHatesLight(monster))
        bonus += rollOne(8);
    // dmgval probes spec_dbon with 25 damage. An artifact with its own
    // damage die still performs that probe even when it will not double.
    return bonus > 1 && object.oartifact
        && artifactDamageBonus(object, monster, 25, rollOne, { hero, state }) >= 25
        ? Math.trunc((bonus + 1) / 2) : bonus;
}
function applyErosion(object, damage) {
    if (damage > 0)
        damage = Math.max(1, damage - erosion(object));
    return damage;
}
export function rollPhysicalWeaponDamage(object, monster, { state = game, hero = false, rollOne = rnd, hatesBlessings = monsterHatesBlessings(monster), hatesSilver = monsterHatesSilver(monster), rollDice = (count, sides) => {
    let total = 0;
    for (let die = 0; die < count; die++)
        total += rollOne(sides);
    return total;
}, } = {}) {
    if (object.otyp === CREAM_PIE)
        return 0;
    const profile = damageProfile(object, monster);
    let damage = profile.range > 0 ? rollOne(profile.range) : 0;
    damage += profile.fixed;
    if (profile.random4)
        damage += rollOne(4);
    if (profile.random6)
        damage += rollOne(6);
    if (profile.twoD4)
        damage += rollDice(2, 4);
    if (profile.twoD6)
        damage += rollDice(2, 6);
    damage = addWeaponEnchantment(object, damage);
    damage = applyTargetBaseRules(object, monster, damage, rollOne, state);
    damage += targetDamageBonus(object, monster, { hatesBlessings, hatesSilver, hero }, rollOne, state);
    return applyErosion(object, damage);
}
export function rollPhysicalWeaponDamageAgainstHero(object, state, options = {}) {
    return rollPhysicalWeaponDamage(object, { mnum: heroSpecies(state) }, { ...options, state, hero: true, hatesSilver: heroHatesSilver(state) });
}
// Strength values above 18 retain NetHack's internal encoding (19 == 18/01,
// 93 == 18/75, 118 == 18/**), matching display.js:formatStrength().
export function strengthDamageBonus(strength) {
    if (strength < 6)
        return -1;
    if (strength < 16)
        return 0;
    if (strength < 18)
        return 1;
    if (strength === 18)
        return 2;
    if (strength <= 93)
        return 3;
    if (strength <= 108)
        return 4;
    if (strength < 118)
        return 5;
    return 6;
}
// C weapon.c:dbon(). Monster forms do not use the human Strength score.
export function heroStrengthDamageBonus(state) {
    return Upolyd(state?.u)
        ? 0 : strengthDamageBonus(currentAttribute(A_STR, state));
}
//# sourceMappingURL=weapon_damage.js.map