// Monster weapon selection and wielded state.
// C refs: weapon.c select_hwep(), oselect(), setmnotwielded(),
// mwepgone(), and possibly_unwield().

import {
    NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE,
    NEED_RANGED_WEAPON, NEED_WEAPON, NO_WEAPON_WANTED, W_ARMG, W_ARMS, W_WEP,
} from './const.js';
import { artifactById, artifactEmitsLight, monsterCanTouchArtifact } from './artifacts.js';
import { monsterHandName } from './body_parts.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription } from './light.js';
import { MONSTER_FLAGS2, MONSTER_HAS_WEAPON_ATTACK, MONSTER_NAME } from './monster_data.js';
import { monsterCanTouchObject } from './monster_carry.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { selectMonsterMissile } from './monster_throw.js';
import {
    AKLYS, AXE, BATTLE_AXE, BULLWHIP, CLUB, CORPSE, DWARVISH_MATTOCK,
    EGG, OBJECT_BIMANUAL, OBJECT_NAMES, PICK_AXE,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';
import { willWeld } from './weapon_type.js';

const M2_GIANT = 0x00002000;
const M2_STRONG = 0x04000000;
const WEAPON_CLASS = 2;
const PM_BALROG = MONSTER_NAME.indexOf('balrog');

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
    const flags = MONSTER_FLAGS2[monster.mnum];
    const canUseBothHands = !!(flags & M2_STRONG)
        && !(monster.misc_worn_check & W_ARMS);
    // Artifact preference uses touch_artifact(), not the material check below.
    for (const object of inventory) {
        if (object.oclass === WEAPON_CLASS && object.oartifact
            && monsterCanTouchArtifact(monster, object, state)
            && (canUseBothHands || !OBJECT_BIMANUAL[object.otyp])) return object;
    }

    let favorite = null;
    if (flags & M2_GIANT) favorite = CLUB;
    else if (monster.mnum === PM_BALROG && (state.uwep || state.u?.uwep))
        favorite = BULLWHIP;
    if (favorite !== null) {
        const object = selectMonsterWeaponOfType(monster, favorite, state);
        if (object) return object;
    }

    for (const type of HAND_TO_HAND_WEAPONS) {
        if (OBJECT_BIMANUAL[type] && !canUseBothHands) continue;
        if (type === CORPSE && !(monster.misc_worn_check & W_ARMG)
            && !monsterHasStoneResistance(monster)) continue;
        const object = selectMonsterWeaponOfType(monster, type, state);
        if (object) return object;
    }
    return null;
}

// C oselect(): keep inventory order among items of the same type.
export function selectMonsterWeaponOfType(monster, type, state = game) {
    return (monster.minvent || monster.inventory || []).find(object =>
        object.otyp === type
        && (![CORPSE, EGG].includes(type) || touchPetrifies(object.corpsenm))
        && monsterCanTouchObject(monster, object, state)) || null;
}

export function monsterWieldedWeapon(monster) {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded
                || ((object?.owornmask ?? 0) & W_WEP));
}

// C mon_wield_item(): returns whether the attempt spent the monster's action.
export async function wieldMonsterWeapon(monster, state = game, {
    publish = plineWithContinuation,
} = {}) {
    if (monster.weaponCheck === NO_WEAPON_WANTED) return false;
    const digging = [NEED_PICK_AXE, NEED_AXE, NEED_PICK_OR_AXE].includes(monster.weaponCheck);
    const weapon = weaponForCurrentAction(monster, state);
    const previous = monsterWieldedWeapon(monster);
    if (!weapon || previous?.otyp === weapon.otyp) {
        monster.weaponCheck = NEED_WEAPON;
        return false;
    }
    if (willWeld(previous)) {
        if (canSeeMonster(monster, monster.mx, monster.my)) {
            const hand = wieldingHand(monster, previous);
            const pronoun = monster.female ? 'her' : 'his';
            const plural = (previous.quan ?? previous.quantity ?? 1) > 1;
            const welded = `${plural ? 'are' : 'is'} welded to ${pronoun} ${hand}`;
            if (weapon.otyp === PICK_AXE) {
                await publish(`Since ${monsterPossessive(monster)} weapon${plural ? 's' : ''} ${welded},`);
                await publish(`${monsterSentenceSubject(monster)} cannot wield that pick-axe.`);
            } else {
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
    if (canSeeMonster(monster, monster.mx, monster.my)) {
        weapon.dknown = true;
        const description = inventoryItemDescription(weapon);
        await publish(`${monsterSentenceSubject(monster)} wields ${description}${digging ? '.' : '!'}`);
        if (weapon.otyp === AKLYS)
            await publish(`${monsterSentenceSubject(monster)} secures the tether on the aklys.`);
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
        if (canSeeMonster(monster, monster.mx, monster.my)) {
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

function weaponForCurrentAction(monster, state) {
    const inventory = monster.minvent || monster.inventory || [];
    const carrying = type => inventory.find(object => object.otyp === type);
    const shield = !!(monster.misc_worn_check & W_ARMS);
    switch (monster.weaponCheck) {
    case NEED_HTH_WEAPON:
        return selectHandToHandWeapon(monster, state);
    case NEED_RANGED_WEAPON:
        return selectMonsterMissile(monster, state)?.launcher;
    case NEED_PICK_AXE:
        return carrying(PICK_AXE) || (!shield && carrying(DWARVISH_MATTOCK));
    case NEED_AXE:
        return (!shield && carrying(BATTLE_AXE)) || carrying(AXE);
    case NEED_PICK_OR_AXE:
        return (!shield && (carrying(DWARVISH_MATTOCK) || carrying(BATTLE_AXE)))
            || carrying(PICK_AXE) || carrying(AXE);
    default:
        throw new Error(`Unknown monster weapon request: ${monster.weaponCheck}`);
    }
}

function namedWeapon(weapon, state) {
    const artifact = artifactById(weapon.oartifact, state);
    if (artifact) return artifact.name;
    const name = OBJECT_NAMES[weapon.otyp];
    return `The ${(weapon.quan ?? weapon.quantity ?? 1) > 1 ? makePlural(name) : name}`;
}

function wieldingHand(monster, weapon) {
    const hand = monsterHandName(monster.mnum);
    return OBJECT_BIMANUAL[weapon.otyp] ? makePlural(hand) : hand;
}

function monsterPossessive(monster) {
    const subject = monsterSentenceSubject(monster);
    const name = monster.name ? subject : subject.charAt(0).toLowerCase() + subject.slice(1);
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export async function unwieldMonsterWeapon(monster, state = game, {
    weapon = monsterWieldedWeapon(monster),
    publish = plineWithContinuation,
} = {}) {
    if (!weapon) return null;

    if (weapon.lamplit && artifactEmitsLight(weapon)) {
        endObjectBurn(weapon, state);
        if (canSeeMonster(monster, monster.mx, monster.my)) {
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

export async function updateMonsterWeaponAfterPolymorph(monster, state = game, {
    polyspot = false,
    publish = plineWithContinuation,
} = {}) {
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
            const description = inventoryItemDescription(weapon);
            await publish(`${monsterSentenceSubject(monster)} drops ${description}.`);
            newsym(monster.mx, monster.my);
        }
        await removeObjectFromMonsterInventory(monster, weapon, state, { publish });
        const landing = await applyFloorEffects(
            weapon, monster.mx, monster.my, { state, publish },
        );
        if (landing.finished) return landing.object;
        if (polyspot) {
            weapon.bypass = true;
            state.context.bypasses = true;
        }
        place_object(weapon, monster.mx, monster.my, state);
        return stack_object(weapon, state);
    }

    const welded = weapon.cursed && ((weapon.owornmask ?? 0) & W_WEP);
    if (!(welded && monster.weaponCheck === NO_WEAPON_WANTED))
        monster.weaponCheck = NEED_WEAPON;
    return null;
}
