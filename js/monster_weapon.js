// Monster weapon selection and wielded state.
// C refs: weapon.c select_hwep(), oselect(), setmnotwielded(),
// mwepgone(), and possibly_unwield().

import { NEED_WEAPON, NO_WEAPON_WANTED, W_ARMG, W_ARMS, W_WEP } from './const.js';
import { artifactById, artifactEmitsLight, monsterCanTouchArtifact } from './artifacts.js';
import { monsterHandName } from './body_parts.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { endObjectBurn } from './light.js';
import { MONSTER_FLAGS2, MONSTER_HAS_WEAPON_ATTACK, MONSTER_NAME } from './monster_data.js';
import { monsterCanTouchObject } from './monster_carry.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { BULLWHIP, CLUB, CORPSE, EGG, OBJECT_BIMANUAL, OBJECT_NAMES } from './object_data.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';

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

export async function unwieldMonsterWeapon(monster, state = game, {
    weapon = monsterWieldedWeapon(monster),
    publish = plineWithContinuation,
} = {}) {
    if (!weapon) return null;

    if (weapon.lamplit && artifactEmitsLight(weapon)) {
        endObjectBurn(weapon, state);
        if (canSeeMonster(monster, monster.mx, monster.my)) {
            const name = artifactById(weapon.oartifact, state)?.name
                || `The ${OBJECT_NAMES[weapon.otyp]}`;
            const subject = monsterSentenceSubject(monster);
            const owner = monster.name ? subject
                : subject.charAt(0).toLowerCase() + subject.slice(1);
            const possessive = owner.endsWith('s') ? `${owner}'` : `${owner}'s`;
            const hand = monsterHandName(monster.mnum);
            await publish(`${name} in ${possessive} ${hand} stops shining.`);
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
