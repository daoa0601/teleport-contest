// Monster weapon selection and wielded state.
// C refs: weapon.c select_hwep(), oselect(), setmnotwielded(),
// mwepgone(), and possibly_unwield().
import { bypassObject } from './worn.js';
import { NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE, NEED_RANGED_WEAPON, NEED_WEAPON, NO_WEAPON_WANTED, P_BOW, P_CROSSBOW, P_SLING, W_ARMG, W_ARMS, W_WEP, } from './const.js';
import { definiteObjectAction, objectName, objectCombatName, objectNameIsPlural, observeObjectForNaming, observeDistantObjectForNaming, ownedObjectName, } from './objnam.js';
import { artifactById, artifactEmitsLight, monsterCanTouchArtifact } from './artifacts.js';
import { monsterHandName } from './body_parts.js';
import { canSeeMonster, monsterVisible, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription } from './light.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_HAS_WEAPON_ATTACK, MONSTER_NAME, MONSTER_SYMBOL, requireMonsterData, } from './monster_data.js';
import { monsterCanTouchObject } from './mon.js';
import { unlinkMonsterObject } from './mkobj.js';
import { monsterName } from './do_name.js';
import { monsterPossessive as perceivedPossessivePronoun } from './mondata.js';
import { monsterSentenceSubject } from './ambient_sounds.js';
import { AKLYS, AXE, BATTLE_AXE, BOULDER, BOW, BULLWHIP, CLUB, CORPSE, CREAM_PIE, CROSSBOW, DART, DWARVISH_MATTOCK, EGG, ELVEN_BOW, LOADSTONE, OBJECT_BIMANUAL, OBJECT_NAMES, OBJECT_SUBTYPE, ORCISH_BOW, PICK_AXE, SLING, YUMI, requireObjectData, } from './object_data.js';
import { makePlural, makeSingular } from './objnam.js';
import { objectClassForType } from './o_init.js';
import { touchPetrifies } from './stoning.js';
import { heroIsBlind } from './senses.js';
import { isBimanualObject } from './object_properties.js';
import { rn2 } from './rng.js';
import { cansee, couldsee } from './vision.js';
import { isPolearm } from './object_properties.js';
import { monsterWeaponSwingVerb } from './mhitu.js';
import { willWeld } from './wield.js';
import { monsterHasStoneResistance } from './mondata.js';
import { AKLYS_LIM, P_AXE, P_DAGGER, P_LANCE, P_PICK_AXE, P_POLEARMS, P_SABER, P_SHORT_SWORD, P_WHIP, } from './const.js';
import { HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_DIR, TIN_OPENER, TOWEL } from './object_data.js';
import { isMissileObject, isWeaponTool } from './object_properties.js';
import { artifactDamageBonus, artifactStrikesShade } from './artifacts.js';
import { currentAttribute } from './attrib.js';
import { A_STR, Upolyd, WT_IRON_BALL_INCR } from './const.js';
import { heroSpecies } from './hero_species.js';
import { GAUNTLETS_OF_POWER, OBJECT_LARGE_DAMAGE, OBJECT_SMALL_DAMAGE, OBJECT_WEIGHT, } from './object_data.js';
import { MONSTER_SIZE, monsterHatesBlessings, monsterHatesLight, monsterHatesSilver, monsterIsShade, monsterIsThickSkinned, monsterIsWooden, monsterSpeciesHatesSilver, } from './monster_data.js';
import { objectMaterial } from './o_init.js';
import { d, rnd } from './rng.js';
import { isPoolAt } from './dbridge.js';
import { artifactToHitBonus } from './artifacts.js';
import { P_SPEAR } from './const.js';
import { requireInitializedHero } from './hero_types.js';
import { MONSTER_MOVE } from './monster_data.js';
import { OBJECT_HIT_BONUS, TRIDENT } from './object_data.js';
import { P_FLAIL } from './const.js';
import { FLINT, GRAPPLING_HOOK, LUCKSTONE, ROCK, STATUE, TIN, TOUCHSTONE } from './object_data.js';
import { SKILL_NAMES } from './skills.js';
import { isAmmunition } from './object_properties.js';
const M2_GIANT = 0x00002000;
const M2_STRONG = 0x04000000;
const M2_ROCKTHROW = 0x08000000;
const M2_JEWELS = 0x20000000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const WEAPON_CLASS = 2;
const GEM_CLASS = 13;
const S_KOP = 37;
const PM_BALROG = MONSTER_NAME.indexOf('balrog');
// C weapon.c:rwep[] order. A melee weapon is not automatically a missile.
const RANGED_WEAPON_PREFERENCE = [
    'dwarvish spear', 'silver spear', 'elven spear', 'spear', 'orcish spear',
    'javelin', 'shuriken', 'ya', 'silver arrow', 'elven arrow', 'arrow',
    'orcish arrow', 'crossbow bolt', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'knife', 'flint', 'rock', 'loadstone',
    'luckstone', 'dart', 'cream pie',
].map(name => OBJECT_NAMES.indexOf(name));
// C weapon.c:monmightthrowwep(). This is the native missile preference set.
export function monsterMightThrowWeapon(object) {
    return RANGED_WEAPON_PREFERENCE.includes(object.otyp);
}
const POLEARM_PREFERENCE = [
    'halberd', 'bardiche', 'spetum', 'bill-guisarme', 'voulge', 'ranseur',
    'guisarme', 'glaive', 'lucern hammer', 'bec de corbin', 'fauchard',
    'partisan', 'lance',
].map(name => OBJECT_NAMES.indexOf(name));
// C select_rwep(). Keep the selected weapon and launcher together instead of
// storing the launcher in C's global propellor.
export function selectMonsterRangedWeapon(monster, state = game) {
    const inventory = monster.minvent || monster.inventory || [];
    const flags1 = requireMonsterData(MONSTER_FLAGS1, monster.mnum);
    const flags2 = requireMonsterData(MONSTER_FLAGS2, monster.mnum);
    const egg = selectMonsterWeaponOfType(monster, EGG, state);
    if (egg)
        return { weapon: egg, launcher: null };
    if (MONSTER_SYMBOL[monster.mnum] === S_KOP) {
        const pie = selectMonsterWeaponOfType(monster, CREAM_PIE, state);
        if (pie)
            return { weapon: pie, launcher: null };
    }
    if (flags2 & M2_ROCKTHROW) {
        const boulder = selectMonsterWeaponOfType(monster, BOULDER, state);
        if (boulder)
            return { weapon: boulder, launcher: null };
    }
    const current = monsterWieldedWeapon(monster);
    const cannotSwitch = willWeld(current) && monster.weaponCheck === NO_WEAPON_WANTED;
    const distance = monster.mux === undefined || monster.muy === undefined
        ? null : (monster.mx - monster.mux) ** 2 + (monster.my - monster.muy) ** 2;
    if (distance !== null && distance <= 13 && couldsee(monster.mx, monster.my)) {
        if (current && artifactById(current.oartifact, state)?.name === 'Snickersnee')
            return { weapon: current, launcher: current };
        const twoHands = (flags2 & M2_STRONG)
            && !((monster.misc_worn_check ?? 0) & W_ARMS);
        for (const type of POLEARM_PREFERENCE) {
            // C weapon.c:574 reads objects[pwep[i]].oc_bimanual raw on the
            // otyp table; the class guard does not apply to table entries.
            if (OBJECT_BIMANUAL[type] && !twoHands)
                continue;
            const polearm = selectMonsterWeaponOfType(monster, type, state);
            if (polearm && (polearm === current || !cannotSwitch))
                return { weapon: polearm, launcher: polearm };
        }
    }
    if (!cannotSwitch && !(flags1 & (M1_MINDLESS | M1_ANIMAL))) {
        const aklys = selectMonsterWeaponOfType(monster, AKLYS, state);
        const range = returningWeaponRangeSquared(aklys);
        if (aklys && range !== null && distance !== null && distance <= range
            && couldsee(monster.mx, monster.my))
            return { weapon: aklys, launcher: aklys };
    }
    for (const type of RANGED_WEAPON_PREFERENCE) {
        if (type === DART && !(flags2 & M2_JEWELS)) {
            const sling = inventory.find(object => object.otyp === SLING);
            if (sling) {
                const gem = inventory.find(object => object.oclass === GEM_CLASS
                    && (object.otyp !== LOADSTONE || !object.cursed));
                if (gem)
                    return { weapon: gem, launcher: sling };
            }
        }
        const skill = requireObjectData(OBJECT_SUBTYPE, type);
        const launcher = selectMissileLauncher(monster, skill, state);
        const needsLauncher = skill >= -P_CROSSBOW && skill <= -P_BOW;
        if (needsLauncher && !launcher)
            continue;
        if (skill < 0 && cannotSwitch && launcher !== current)
            continue;
        if (type === LOADSTONE) {
            const stone = inventory.find(object => object.otyp === LOADSTONE && !object.cursed);
            if (stone)
                return { weapon: stone, launcher };
        }
        else {
            const missile = selectMonsterWeaponOfType(monster, type, state);
            if (missile && !missile.oartifact
                && !(missile === current && willWeld(missile)))
                return { weapon: missile, launcher };
        }
    }
    return null;
}
function selectMissileLauncher(monster, skill, state) {
    let types;
    if (skill === -P_BOW)
        types = [YUMI, ELVEN_BOW, BOW, ORCISH_BOW];
    else if (skill === -P_SLING)
        types = [SLING];
    else if (skill === -P_CROSSBOW)
        types = [CROSSBOW];
    else
        return null;
    for (const type of types) {
        const launcher = selectMonsterWeaponOfType(monster, type, state);
        if (launcher)
            return launcher;
    }
    return null;
}
// C weapon.c:hwep[], in preference order.
const HAND_TO_HAND_WEAPONS = [
    'corpse', 'tsurugi', 'runesword', 'dwarvish mattock', 'two-handed sword',
    'battle-axe', 'katana', 'unicorn horn', 'crysknife', 'trident',
    'long sword', 'elven broadsword', 'broadsword', 'scimitar',
    'silver saber', 'morning star', 'elven short sword',
    'dwarvish short sword', 'short sword', 'orcish short sword',
    'silver mace', 'mace', 'axe', 'dwarvish spear', 'silver spear',
    'elven spear', 'spear', 'orcish spear', 'flail', 'bullwhip',
    'quarterstaff', 'javelin', 'aklys', 'club', 'pick-axe',
    'rubber hose', 'war hammer', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'athame', 'scalpel', 'knife', 'worm tooth',
].map(name => OBJECT_NAMES.indexOf(name));
export function selectHandToHandWeapon(monster, state = game) {
    const inventory = monster.minvent || monster.inventory || [];
    const flags = requireMonsterData(MONSTER_FLAGS2, monster.mnum);
    const canUseBothHands = !!(flags & M2_STRONG)
        && !((monster.misc_worn_check ?? 0) & W_ARMS);
    // Artifact preference uses touch_artifact(), not the material check below.
    for (const object of inventory) {
        if (object.oclass === WEAPON_CLASS && object.oartifact
            && monsterCanTouchArtifact(monster, object, state)
            // C weapon.c:717 reads oc_bimanual raw for the artifact (already
            // restricted to WEAPON_CLASS by the loop guard above).
            && (canUseBothHands || !OBJECT_BIMANUAL[object.otyp]))
            return object;
    }
    let favorite = null;
    if (flags & M2_GIANT)
        favorite = CLUB;
    else if (monster.mnum === PM_BALROG && (state.uwep || state.u?.uwep))
        favorite = BULLWHIP;
    if (favorite !== null) {
        const object = selectMonsterWeaponOfType(monster, favorite, state);
        if (object)
            return object;
    }
    for (const type of HAND_TO_HAND_WEAPONS) {
        // C weapon.c:733 reads objects[hwep[i]].oc_bimanual raw on the table.
        if (OBJECT_BIMANUAL[type] && !canUseBothHands)
            continue;
        if (type === CORPSE && !((monster.misc_worn_check ?? 0) & W_ARMG)
            && !monsterHasStoneResistance(monster))
            continue;
        const object = selectMonsterWeaponOfType(monster, type, state);
        if (object)
            return object;
    }
    return null;
}
// C oselect(): keep inventory order among items of the same type.
export function selectMonsterWeaponOfType(monster, type, state = game) {
    return (monster.minvent || monster.inventory || []).find(object => object.otyp === type
        && (![CORPSE, EGG].includes(type)
            || (object.corpsenm !== undefined && touchPetrifies(object.corpsenm)))
        && monsterCanTouchObject(monster, object, state)) || null;
}
export function monsterWieldedWeapon(monster) {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded
            || ((object?.owornmask ?? 0) & W_WEP));
}
// C mon_wield_item(): returns whether the attempt spent the monster's action.
export async function wieldMonsterWeapon(monster, state = game, { publish = plineWithContinuation, } = {}) {
    if (monster.weaponCheck === NO_WEAPON_WANTED)
        return false;
    const digging = monster.weaponCheck !== undefined
        && [NEED_PICK_AXE, NEED_AXE, NEED_PICK_OR_AXE].includes(monster.weaponCheck);
    const weapon = weaponForCurrentAction(monster, state);
    const previous = monsterWieldedWeapon(monster);
    if (!weapon || previous?.otyp === weapon.otyp) {
        monster.weaponCheck = NEED_WEAPON;
        return false;
    }
    if (previous && willWeld(previous)) {
        if (canSeeMonster(monster)) {
            const hand = wieldingHand(monster, previous);
            const pronoun = perceivedPossessivePronoun(monster, { state });
            const plural = (previous.quan ?? previous.quantity ?? 1) > 1;
            const welded = `${plural ? 'are' : 'is'} welded to ${pronoun} ${hand}`;
            if (weapon.otyp === PICK_AXE) {
                await publish(`Since ${monsterPossessive(monster, state)} weapon${plural ? 's' : ''} ${welded},`);
                // C weapon.c:mon_wield_item() starts this line with mon_nam(), uncapitalized.
                observeObjectForNaming(weapon, { state });
                await publish(`${monsterName(monster, { state })} cannot wield that ${objectName(weapon, state)}.`);
            }
            else {
                observeObjectForNaming(weapon, { state });
                const description = await inventoryItemDescription(weapon);
                await publish(`${monsterName(monster, { state, capitalized: true })} tries to wield ${description}.`);
                observeObjectForNaming(previous, { state });
                await publish(`${ownedObjectName(previous, state)} ${welded}!`);
            }
            previous.bknown = true;
        }
        monster.weaponCheck = NO_WEAPON_WANTED;
        return true;
    }
    monster.mw = weapon;
    if (previous)
        await unwieldMonsterWeapon(monster, state, { weapon: previous, publish });
    monster.weaponCheck = NEED_WEAPON;
    if (canSeeMonster(monster)) {
        observeObjectForNaming(weapon, { state });
        const description = await inventoryItemDescription(weapon);
        await publish(`${monsterName(monster, { state, capitalized: true })} wields ${description}${digging ? '.' : '!'}`);
        if (weapon.otyp === AKLYS)
            await publish(`${monsterName(monster, { state, capitalized: true })} secures the tether on the ${objectName(weapon, state)}.`);
        if (willWeld(weapon)) {
            const plural = (weapon.quan ?? weapon.quantity ?? 1) > 1;
            const hand = wieldingHand(monster, weapon);
            const welding = plural ? 'weld themselves' : 'welds itself';
            await publish(`${definiteObjectAction(weapon, null, state)} ${welding} to ${monsterPossessive(monster, state)} ${hand}!`);
            weapon.bknown = true;
        }
    }
    if (artifactEmitsLight(weapon) && !weapon.lamplit) {
        beginObjectBurn(weapon, state);
        if (canSeeMonster(monster)) {
            const hand = monsterHandName(monster.mnum);
            const brightness = equipmentLightDescription(weapon, state);
            await publish(`${definiteObjectAction(weapon, null, state)} shines ${brightness} in ${monsterPossessive(monster, state)} ${hand}!`);
        }
        else if (cansee(monster.mx, monster.my)) {
            const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
            await publish(`Light begins shining ${distance <= 25 ? 'nearby' : 'in the distance'}.`);
        }
    }
    weapon.owornmask = W_WEP;
    weapon.wielded = true;
    weapon.worn = true;
    return true;
}
function weaponForCurrentAction(monster, state) {
    const inventory = monster.minvent || monster.inventory || [];
    const carrying = (type) => inventory.find(object => object.otyp === type) ?? null;
    const shield = !!((monster.misc_worn_check ?? 0) & W_ARMS);
    switch (monster.weaponCheck) {
        case NEED_HTH_WEAPON:
            return selectHandToHandWeapon(monster, state);
        case NEED_RANGED_WEAPON:
            return selectMonsterRangedWeapon(monster, state)?.launcher ?? null;
        case NEED_PICK_AXE:
            return carrying(PICK_AXE) || (shield ? null : carrying(DWARVISH_MATTOCK));
        case NEED_AXE:
            return (shield ? null : carrying(BATTLE_AXE)) || carrying(AXE);
        case NEED_PICK_OR_AXE:
            return (!shield && (carrying(DWARVISH_MATTOCK) || carrying(BATTLE_AXE)))
                || carrying(PICK_AXE) || carrying(AXE);
        case undefined:
        default:
            throw new Error(`Unknown monster weapon request: ${monster.weaponCheck}`);
    }
}
function wieldingHand(monster, weapon) {
    // C weapon.c:mon_wield_item() checks bimanual() at both the welded
    // message (866) and the welds-itself message (910).
    const hand = monsterHandName(monster.mnum);
    return isBimanualObject(weapon) ? makePlural(hand) : hand;
}
function monsterPossessive(monster, state) {
    const name = monsterName(monster, { state });
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}
export async function unwieldMonsterWeapon(monster, state = game, { weapon = monsterWieldedWeapon(monster), publish = plineWithContinuation, } = {}) {
    if (!weapon)
        return null;
    if (weapon.lamplit && artifactEmitsLight(weapon)) {
        endObjectBurn(weapon, state);
        if (canSeeMonster(monster)) {
            const hand = monsterHandName(monster.mnum);
            await publish(`${definiteObjectAction(weapon, null, state)} in ${monsterPossessive(monster, state)} ${hand} ${objectNameIsPlural(weapon, state) ? 'stop' : 'stops'} shining.`);
        }
    }
    if (monster.mw === weapon)
        monster.mw = null;
    weapon.owornmask = (weapon.owornmask ?? 0) & ~W_WEP;
    weapon.wielded = false;
    weapon.worn = weapon.owornmask !== 0;
    monster.weaponCheck = NEED_WEAPON;
    return weapon;
}
export async function updateMonsterWeaponAfterPolymorph(monster, state = game, { polyspot = false, publish = plineWithContinuation, } = {}) {
    const weapon = monsterWieldedWeapon(monster);
    if (!weapon)
        return null;
    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.includes(weapon)) {
        monster.mw = null;
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }
    if (!MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        await unwieldMonsterWeapon(monster, state, { weapon, publish });
        monster.weaponCheck = NO_WEAPON_WANTED;
        if (cansee(monster.mx, monster.my)) {
            observeDistantObjectForNaming(weapon, state);
            const description = await inventoryItemDescription(weapon);
            await publish(`${monsterSentenceSubject(monster)} drops ${description}.`);
            await newsym(monster.mx, monster.my);
        }
        // C possibly_unwield(): raw extraction after setmnotwielded(),
        // not extract_from_minvent() and its separate release.
        unlinkMonsterObject(monster, weapon);
        const landing = await applyFloorEffects(weapon, monster.mx, monster.my, { state, publish });
        if (landing.finished)
            return landing.object;
        if (polyspot) {
            bypassObject(weapon, state);
        }
        // Weapon drops can follow hero-caused unwields: awaited placement.
        await placeObject(weapon, monster.mx, monster.my, state);
        return await stack_object(weapon, state);
    }
    const welded = willWeld(weapon) && ((weapon.owornmask ?? 0) & W_WEP);
    if (!(welded && monster.weaponCheck === NO_WEAPON_WANTED))
        monster.weaponCheck = NEED_WEAPON;
    return null;
}
// C weapon.c:autoreturn_weapon(). The pinned game only includes the aklys.
export function returningWeaponRangeSquared(object) {
    return object?.otyp === AKLYS ? AKLYS_LIM * AKLYS_LIM : null;
}
const TOOL_CLASS = 6;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const LEATHER = 7;
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
export function rollPhysicalWeaponDamage(object, monster, { state = game, hero = false, rollOne = rnd, hatesBlessings = monsterHatesBlessings(monster), hatesSilver = monsterHatesSilver(monster), rollDice = d, } = {}) {
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
    // C dmgval(obj, &youmonst) asks mon_hates_silver() about the hero's
    // current form; lycanthropy (Hate_silver) only adds the searing line.
    const species = heroSpecies(state);
    return rollPhysicalWeaponDamage(object, { mnum: species }, { ...options, state, hero: true, hatesSilver: monsterSpeciesHatesSilver(species) });
}
// Strength values above 18 retain NetHack's internal encoding (19 == 18/01,
// 93 == 18/75, 118 == 18/**), matching botl.js:formatStrength().
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
// C weapon.c:hitval() and dothrow.c:omon_adj().
const M1_SWIM = 0x00000002;
const M1_WALLWALK = 0x00000008;
const M1_THICK_HIDE = 0x00200000;
const S_DRAGON = 30;
const S_GIANT = 34;
const S_JABBERWOCK = 36;
const S_NAGA = 40;
const S_SNAKE = 45;
const S_XORN = 50;
const S_EEL = 57;
function heroTarget(defender, state) {
    return defender === state.u;
}
export function weaponHitBonus(object, defender, { state = game, random = rn2, rollOne = rnd, } = {}) {
    const hero = heroTarget(defender, state);
    let target;
    if (heroTarget(defender, state)) {
        requireInitializedHero(defender);
        target = { mnum: defender.umonnum, mx: defender.ux, my: defender.uy };
    }
    else
        target = defender;
    const skill = OBJECT_SUBTYPE[object.otyp];
    const weapon = object.oclass === WEAPON_CLASS
        || (object.oclass === TOOL_CLASS && skill !== 0);
    const symbol = MONSTER_SYMBOL[target.mnum];
    const flags = MONSTER_FLAGS1[target.mnum];
    let bonus = OBJECT_HIT_BONUS[object.otyp];
    if (bonus === undefined || skill === undefined)
        throw new RangeError(`Unknown weapon type ${object.otyp}`);
    if (symbol === undefined || flags === undefined)
        throw new RangeError(`Unknown weapon defender species ${target.mnum}`);
    if (weapon) {
        if (object.spe === undefined)
            throw new Error(`Weapon ${object.otyp} has no enchantment value.`);
        bonus += object.spe;
    }
    if (weapon && object.blessed && monsterHatesBlessings(target))
        bonus += 2;
    if (object.oclass === WEAPON_CLASS && skill === P_SPEAR
        && [S_XORN, S_DRAGON, S_JABBERWOCK, S_NAGA, S_GIANT].includes(symbol)) {
        bonus += 2;
    }
    if (object.otyp === TRIDENT && (flags & M1_SWIM)) {
        if (isPoolAt(target.mx, target.my, state))
            bonus += 4;
        else if (symbol === S_EEL || symbol === S_SNAKE)
            bonus += 2;
    }
    if (weapon && skill === P_PICK_AXE
        && (flags & M1_WALLWALK) && (flags & M1_THICK_HIDE)) {
        bonus += 2;
    }
    if (object.oartifact) {
        bonus += artifactToHitBonus(object, target, rollOne, { hero, random, state });
    }
    return bonus;
}
// C weapon.c:weapon_descr(). Describe the kind of weapon without knowledge,
// enchantment, material, or a personal name.
const CLASS_NAMES = [
    'strange object', 'strange object', 'weapon', 'armor', 'ring', 'amulet',
    'tool', 'food', 'potion', 'scroll', 'spellbook', 'wand', 'coin', 'gem',
    'large rock', 'iron ball', 'chain', 'venom',
];
export function weaponDescription(object) {
    const skill = [2, 6, 13].includes(object.oclass)
        ? Math.abs(requireObjectData(OBJECT_SUBTYPE, object.otyp)) : 0;
    let description = SKILL_NAMES[skill];
    if (skill === 0) {
        if ([CORPSE, TIN, EGG, STATUE, BOULDER, TOWEL, TIN_OPENER].includes(object.otyp))
            description = requireObjectData(OBJECT_NAMES, object.otyp) ?? undefined;
        else
            description = object.globby ? 'glob' : CLASS_NAMES[object.oclass];
    }
    else if (skill === P_SLING && isAmmunition(object)) {
        description = [ROCK, LUCKSTONE, LOADSTONE, TOUCHSTONE, FLINT].includes(object.otyp)
            ? 'stone' : object.oclass === 13 ? 'gem' : CLASS_NAMES[object.oclass];
    }
    else if (skill === P_BOW && isAmmunition(object))
        description = 'arrow';
    else if (skill === P_CROSSBOW && isAmmunition(object))
        description = 'bolt';
    else if (skill === P_FLAIL && object.otyp === GRAPPLING_HOOK)
        description = 'hook';
    else if (skill === P_PICK_AXE && object.otyp === DWARVISH_MATTOCK)
        description = 'mattock';
    if (!description)
        throw new Error(`No weapon description for object type ${object.otyp}`);
    return makeSingular(description);
}
//# sourceMappingURL=weapon.js.map