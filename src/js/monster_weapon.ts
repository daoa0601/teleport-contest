// Monster weapon selection and wielded state.
// C refs: weapon.c select_hwep(), oselect(), setmnotwielded(),
// mwepgone(), and possibly_unwield().

import {
    NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE,
    NEED_RANGED_WEAPON, NEED_WEAPON, NO_WEAPON_WANTED, P_BOW, P_CROSSBOW, P_SLING,
    W_ARMG, W_ARMS, W_WEP,
} from './const.js';
import {
    objectName, observeObjectForNaming, observeDistantObjectForNaming,
} from './objnam.js';
import { artifactById, artifactEmitsLight, monsterCanTouchArtifact } from './artifacts.js';
import { monsterHandName } from './body_parts.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription } from './light.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_HAS_WEAPON_ATTACK,
    MONSTER_NAME, MONSTER_SYMBOL, requireMonsterData,
} from './monster_data.js';
import { monsterCanTouchObject } from './monster_carry.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { isPoisonableObject } from './object_properties.js';
import { recordObjectEncounter } from './object_knowledge.js';
import {
    AKLYS, AXE, BATTLE_AXE, BOULDER, BOW, BULLWHIP, CLUB, CORPSE, CREAM_PIE,
    CROSSBOW, DART, DWARVISH_MATTOCK, EGG, ELVEN_BOW, LOADSTONE,
    OBJECT_BIMANUAL, OBJECT_DESCRIPTIONS, OBJECT_NAMES, OBJECT_SUBTYPE,
    ORCISH_BOW, PICK_AXE, SLING, YUMI, requireObjectData,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { touchPetrifies } from './stoning.js';
import { heroIsBlind } from './senses.js';
import { rn2 } from './rng.js';
import { cansee, couldsee } from './vision.js';
import { isPolearm, monsterWeaponSwingVerb, returningWeaponRangeSquared, willWeld } from './weapon_type.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

interface WeaponMessageOptions {
    publish?: MessagePublisher;
}

interface WeaponSwingOptions extends WeaponMessageOptions {
    defender?: Monster | null;
    random?: (limit: number) => number;
}

interface UnwieldOptions extends WeaponMessageOptions {
    weapon?: GameObject | null;
}

interface PolymorphWeaponOptions extends WeaponMessageOptions {
    polyspot?: boolean;
}

export interface MonsterRangedWeapon {
    weapon: GameObject;
    launcher: GameObject | null;
}

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

// C mhitu.c:mswings() and mhitm.c:mswingsm().
export async function swingMonsterWeapon(
    monster: Monster,
    weapon: GameObject,
    state: GameState = game,
    {
        defender = null,
        publish = plineWithContinuation,
        random = rn2,
    }: WeaponSwingOptions = {},
): Promise<void> {
    if (!state.flags.verbose || heroIsBlind(state)
        || !canSeeMonster(monster)) return;
    weapon.dknown = true;
    recordObjectEncounter(weapon.otyp, state);
    const x = defender ? defender.mx : state.u.ux;
    const y = defender ? defender.my : state.u.uy;
    const bash = isPolearm(weapon)
        && artifactById(weapon.oartifact, state)?.name !== 'Snickersnee'
        && (monster.mx - x) ** 2 + (monster.my - y) ** 2 <= 2;
    const verb = monsterWeaponSwingVerb(weapon, bash, random);
    const name = meleeWeaponName(weapon, state);
    const quantity = weapon.quan > 1 ? 'one of ' : '';
    const possessive = monster.female ? 'her' : 'his';
    let target = '';
    if (defender) {
        const targetName = canSeeMonster(defender)
            ? monsterSentenceSubject(defender).replace(/^The /, 'the ') : 'it';
        target = ` at ${targetName}`;
    }
    await publish(`${monsterSentenceSubject(monster)} ${verb} ${quantity}${possessive} ${name}${target}.`);
}

// mswings uses xname(), so it does not show BUC or enchantment.
function meleeWeaponName(weapon: GameObject, state: GameState): string {
    const artifact = artifactById(weapon.oartifact, state);
    if (artifact) return artifact.name;
    const known = weapon.typeKnown || state._knownObjectTypes?.has(weapon.otyp);
    const appearance = state.objectDescriptions?.[weapon.otyp] ?? OBJECT_DESCRIPTIONS[weapon.otyp];
    const baseName = requireObjectData(OBJECT_NAMES, weapon.otyp);
    if (baseName === null) throw new Error(`Weapon ${weapon.o_id} has no native object name`);
    let name = known ? baseName : appearance || baseName;
    if (weapon.otyp === CORPSE) {
        if (weapon.corpsenm === undefined)
            throw new Error(`Corpse weapon ${weapon.o_id} has no species`);
        name = `${requireMonsterData(MONSTER_NAME, weapon.corpsenm)} corpse`;
    }
    if (weapon.quan > 1) name = makePlural(name);
    if (weapon.opoisoned && isPoisonableObject(weapon)) name = `poisoned ${name}`;
    if (weapon.oextra?.oname) name += ` named ${weapon.oextra.oname}`;
    return name;
}

// C weapon.c:rwep[] order. A melee weapon is not automatically a missile.
const RANGED_WEAPON_PREFERENCE = [
    'dwarvish spear', 'silver spear', 'elven spear', 'spear', 'orcish spear',
    'javelin', 'shuriken', 'ya', 'silver arrow', 'elven arrow', 'arrow',
    'orcish arrow', 'crossbow bolt', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'knife', 'flint', 'rock', 'loadstone',
    'luckstone', 'dart', 'cream pie',
].map(name => OBJECT_NAMES.indexOf(name));

const POLEARM_PREFERENCE = [
    'halberd', 'bardiche', 'spetum', 'bill-guisarme', 'voulge', 'ranseur',
    'guisarme', 'glaive', 'lucern hammer', 'bec de corbin', 'fauchard',
    'partisan', 'lance',
].map(name => OBJECT_NAMES.indexOf(name));

// C select_rwep(). Keep the selected weapon and launcher together instead of
// storing the launcher in C's global propellor.
export function selectMonsterRangedWeapon(
    monster: Monster, state: GameState = game,
): MonsterRangedWeapon | null {
    const inventory = monster.minvent || monster.inventory || [];
    const flags1 = requireMonsterData(MONSTER_FLAGS1, monster.mnum);
    const flags2 = requireMonsterData(MONSTER_FLAGS2, monster.mnum);
    const egg = selectMonsterWeaponOfType(monster, EGG, state);
    if (egg) return { weapon: egg, launcher: null };
    if (MONSTER_SYMBOL[monster.mnum] === S_KOP) {
        const pie = selectMonsterWeaponOfType(monster, CREAM_PIE, state);
        if (pie) return { weapon: pie, launcher: null };
    }
    if (flags2 & M2_ROCKTHROW) {
        const boulder = selectMonsterWeaponOfType(monster, BOULDER, state);
        if (boulder) return { weapon: boulder, launcher: null };
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
            if (OBJECT_BIMANUAL[type] && !twoHands) continue;
            const polearm = selectMonsterWeaponOfType(monster, type, state);
            if (polearm && (polearm === current || !cannotSwitch))
                return { weapon: polearm, launcher: polearm };
        }
    }
    if (!cannotSwitch && !(flags1 & (M1_MINDLESS | M1_ANIMAL))) {
        const aklys = selectMonsterWeaponOfType(monster, AKLYS, state);
        const range = returningWeaponRangeSquared(aklys);
        if (aklys && range !== null && distance !== null && distance <= range
            && couldsee(monster.mx, monster.my)) return { weapon: aklys, launcher: aklys };
    }
    for (const type of RANGED_WEAPON_PREFERENCE) {
        if (type === DART && !(flags2 & M2_JEWELS)) {
            const sling = inventory.find(object => object.otyp === SLING);
            if (sling) {
                const gem = inventory.find(object => object.oclass === GEM_CLASS
                    && (object.otyp !== LOADSTONE || !object.cursed));
                if (gem) return { weapon: gem, launcher: sling };
            }
        }

        const skill = requireObjectData(OBJECT_SUBTYPE, type);
        const launcher = selectMissileLauncher(monster, skill, state);
        const needsLauncher = skill >= -P_CROSSBOW && skill <= -P_BOW;
        if (needsLauncher && !launcher) continue;
        if (skill < 0 && cannotSwitch && launcher !== current) continue;
        if (type === LOADSTONE) {
            const stone = inventory.find(object => object.otyp === LOADSTONE && !object.cursed);
            if (stone) return { weapon: stone, launcher };
        } else {
            const missile = selectMonsterWeaponOfType(monster, type, state);
            if (missile && !missile.oartifact
                && !(missile === current && willWeld(missile))) return { weapon: missile, launcher };
        }
    }
    return null;
}

function selectMissileLauncher(
    monster: Monster, skill: number, state: GameState,
): GameObject | null {
    let types: number[];
    if (skill === -P_BOW) types = [YUMI, ELVEN_BOW, BOW, ORCISH_BOW];
    else if (skill === -P_SLING) types = [SLING];
    else if (skill === -P_CROSSBOW) types = [CROSSBOW];
    else return null;
    for (const type of types) {
        const launcher = selectMonsterWeaponOfType(monster, type, state);
        if (launcher) return launcher;
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

export function selectHandToHandWeapon(
    monster: Monster, state: GameState = game,
): GameObject | null {
    const inventory = monster.minvent || monster.inventory || [];
    const flags = requireMonsterData(MONSTER_FLAGS2, monster.mnum);
    const canUseBothHands = !!(flags & M2_STRONG)
        && !((monster.misc_worn_check ?? 0) & W_ARMS);
    // Artifact preference uses touch_artifact(), not the material check below.
    for (const object of inventory) {
        if (object.oclass === WEAPON_CLASS && object.oartifact
            && monsterCanTouchArtifact(monster, object, state)
            && (canUseBothHands || !OBJECT_BIMANUAL[object.otyp])) return object;
    }

    let favorite: number | null = null;
    if (flags & M2_GIANT) favorite = CLUB;
    else if (monster.mnum === PM_BALROG && (state.uwep || state.u?.uwep))
        favorite = BULLWHIP;
    if (favorite !== null) {
        const object = selectMonsterWeaponOfType(monster, favorite, state);
        if (object) return object;
    }

    for (const type of HAND_TO_HAND_WEAPONS) {
        if (OBJECT_BIMANUAL[type] && !canUseBothHands) continue;
        if (type === CORPSE && !((monster.misc_worn_check ?? 0) & W_ARMG)
            && !monsterHasStoneResistance(monster)) continue;
        const object = selectMonsterWeaponOfType(monster, type, state);
        if (object) return object;
    }
    return null;
}

// C oselect(): keep inventory order among items of the same type.
export function selectMonsterWeaponOfType(
    monster: Monster, type: number, state: GameState = game,
): GameObject | null {
    return (monster.minvent || monster.inventory || []).find(object =>
        object.otyp === type
        && (![CORPSE, EGG].includes(type)
            || (object.corpsenm !== undefined && touchPetrifies(object.corpsenm)))
        && monsterCanTouchObject(monster, object, state)) || null;
}

export function monsterWieldedWeapon(
    monster: Partial<Pick<Monster, 'mnum' | 'mw' | 'minvent' | 'inventory'>> | null | undefined,
): GameObject | undefined {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded
                || ((object?.owornmask ?? 0) & W_WEP));
}

// C mon_wield_item(): returns whether the attempt spent the monster's action.
export async function wieldMonsterWeapon(monster: Monster, state: GameState = game, {
    publish = plineWithContinuation,
}: WeaponMessageOptions = {}): Promise<boolean> {
    if (monster.weaponCheck === NO_WEAPON_WANTED) return false;
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
            const pronoun = monster.female ? 'her' : 'his';
            const plural = (previous.quan ?? previous.quantity ?? 1) > 1;
            const welded = `${plural ? 'are' : 'is'} welded to ${pronoun} ${hand}`;
            if (weapon.otyp === PICK_AXE) {
                await publish(`Since ${monsterPossessive(monster)} weapon${plural ? 's' : ''} ${welded},`);
                await publish(`${monsterSentenceSubject(monster)} cannot wield that pick-axe.`);
            } else {
                observeObjectForNaming(weapon, { state });
                const description = inventoryItemDescription(weapon);
                await publish(`${monsterSentenceSubject(monster)} tries to wield ${description}.`);
                await publish(`${namedWeapon(previous, state)} ${welded}!`);
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
        const description = inventoryItemDescription(weapon);
        await publish(`${monsterSentenceSubject(monster)} wields ${description}${digging ? '.' : '!'}`);
        if (weapon.otyp === AKLYS)
            await publish(`${monsterSentenceSubject(monster)} secures the tether on the ${objectName(weapon, state)}.`);
        if (willWeld(weapon)) {
            const plural = (weapon.quan ?? weapon.quantity ?? 1) > 1;
            const hand = wieldingHand(monster, weapon);
            const welding = plural ? 'weld themselves' : 'welds itself';
            await publish(`${namedWeapon(weapon, state)} ${welding} to ${monsterPossessive(monster)} ${hand}!`);
            weapon.bknown = true;
        }
    }
    if (artifactEmitsLight(weapon) && !weapon.lamplit) {
        beginObjectBurn(weapon, state);
        if (canSeeMonster(monster)) {
            const hand = monsterHandName(monster.mnum);
            const brightness = equipmentLightDescription(weapon, state);
            await publish(`${namedWeapon(weapon, state)} shines ${brightness} in ${monsterPossessive(monster)} ${hand}!`);
        } else if (cansee(monster.mx, monster.my)) {
            const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
            await publish(`Light begins shining ${distance <= 25 ? 'nearby' : 'in the distance'}.`);
        }
    }
    weapon.owornmask = W_WEP;
    weapon.wielded = true;
    weapon.worn = true;
    return true;
}

function weaponForCurrentAction(monster: Monster, state: GameState): GameObject | null {
    const inventory = monster.minvent || monster.inventory || [];
    const carrying = (type: number) => inventory.find(object => object.otyp === type) ?? null;
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

function namedWeapon(weapon: GameObject, state: GameState): string {
    const artifact = artifactById(weapon.oartifact, state);
    if (artifact) return artifact.name;
    const name = objectName(weapon, state);
    return `The ${(weapon.quan ?? weapon.quantity ?? 1) > 1 ? makePlural(name) : name}`;
}

function wieldingHand(monster: Monster, weapon: GameObject): string {
    const hand = monsterHandName(monster.mnum);
    return OBJECT_BIMANUAL[weapon.otyp] ? makePlural(hand) : hand;
}

function monsterPossessive(monster: Monster): string {
    const subject = monsterSentenceSubject(monster);
    const name = monster.name ? subject : subject.charAt(0).toLowerCase() + subject.slice(1);
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export async function unwieldMonsterWeapon(monster: Monster, state: GameState = game, {
    weapon = monsterWieldedWeapon(monster),
    publish = plineWithContinuation,
}: UnwieldOptions = {}): Promise<GameObject | null> {
    if (!weapon) return null;

    if (weapon.lamplit && artifactEmitsLight(weapon)) {
        endObjectBurn(weapon, state);
        if (canSeeMonster(monster)) {
            const hand = monsterHandName(monster.mnum);
            await publish(`${namedWeapon(weapon, state)} in ${monsterPossessive(monster)} ${hand} stops shining.`);
        }
    }
    if (monster.mw === weapon) monster.mw = null;
    weapon.owornmask = (weapon.owornmask ?? 0) & ~W_WEP;
    weapon.wielded = false;
    weapon.worn = weapon.owornmask !== 0;
    monster.weaponCheck = NEED_WEAPON;
    return weapon;
}

export async function updateMonsterWeaponAfterPolymorph(monster: Monster, state: GameState = game, {
    polyspot = false,
    publish = plineWithContinuation,
}: PolymorphWeaponOptions = {}): Promise<GameObject | null> {
    const weapon = monsterWieldedWeapon(monster);
    if (!weapon) return null;

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
            const description = inventoryItemDescription(weapon);
            await publish(`${monsterSentenceSubject(monster)} drops ${description}.`);
            newsym(monster.mx, monster.my);
        }
        // C possibly_unwield(): raw extraction after setmnotwielded(),
        // not extract_from_minvent() and its separate release.
        unlinkMonsterObject(monster, weapon);
        const landing = await applyFloorEffects(
            weapon, monster.mx, monster.my, { state, publish },
        );
        if (landing.finished) return landing.object;
        if (polyspot) {
            weapon.bypass = true;
            state.context.bypasses = true;
        }
        // Weapon drops can follow hero-caused unwields: awaited placement.
        await placeObject(weapon, monster.mx, monster.my, state);
        return await stack_object(weapon, state);
    }

    const welded = weapon.cursed && ((weapon.owornmask ?? 0) & W_WEP);
    if (!(welded && monster.weaponCheck === NO_WEAPON_WANTED))
        monster.weaponCheck = NEED_WEAPON;
    return null;
}
