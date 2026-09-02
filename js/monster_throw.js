// Weapons thrown or shot by monsters.
// C refs: weapon.c select_rwep() and mthrowu.c monmulti(), m_throw().

import { NEED_RANGED_WEAPON, NEED_WEAPON } from './const.js';
import { nextIdent } from './ident.js';
import { stack_object } from './mklev.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import {
    OBJECT_NAMES, OBJECT_SMALL_DAMAGE, OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import { rnd } from './rng.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;

// C weapon.c:rwep[] order. A melee weapon is not automatically a missile.
const RANGED_WEAPON_PREFERENCE = [
    'dwarvish spear', 'silver spear', 'elven spear', 'spear', 'orcish spear',
    'javelin', 'shuriken', 'ya', 'silver arrow', 'elven arrow', 'arrow',
    'orcish arrow', 'crossbow bolt', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'knife', 'flint', 'rock', 'loadstone',
    'luckstone', 'dart', 'cream pie',
];

export const RANGED_LAUNCHERS = new Map([
    ['ya', new Set(['yumi'])],
    ['silver arrow', new Set(['yumi', 'elven bow', 'bow', 'orcish bow'])],
    ['elven arrow', new Set(['yumi', 'elven bow', 'bow', 'orcish bow'])],
    ['arrow', new Set(['yumi', 'elven bow', 'bow', 'orcish bow'])],
    ['orcish arrow', new Set(['yumi', 'elven bow', 'bow', 'orcish bow'])],
    ['crossbow bolt', new Set(['crossbow'])],
    ['flint', new Set(['sling'])],
    ['rock', new Set(['sling'])],
    ['loadstone', new Set(['sling'])],
    ['luckstone', new Set(['sling'])],
]);

export const MONSTER_POLEARMS = new Set([
    'halberd', 'bardiche', 'spetum', 'bill-guisarme', 'voulge', 'ranseur',
    'guisarme', 'glaive', 'lucern hammer', 'bec de corbin', 'fauchard',
    'partisan', 'lance',
]);

export function objectTypeName(object) {
    return object?.name || OBJECT_NAMES[object?.otyp] || '';
}

export function selectRangedWeapon(monster) {
    const inventory = monster?.minvent || monster?.inventory || [];
    const carriedNames = new Set(inventory.map(objectTypeName));
    for (const name of RANGED_WEAPON_PREFERENCE) {
        const launcherNames = RANGED_LAUNCHERS.get(name);
        if (launcherNames
            && !Array.from(launcherNames).some(launcher =>
                carriedNames.has(launcher))) continue;
        const weapon = inventory.find(object =>
            objectTypeName(object) === name
            && !(name === 'loadstone' && object.cursed)
            && !(object.artifact || object.oartifact));
        if (weapon) return weapon;
    }
    return null;
}

export function monsterWieldedWeapon(monster) {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded);
}

// Switching to a launcher consumes this action. If no launcher is needed,
// or the correct launcher is already wielded, the monster may shoot now.
export function readyRangedMonsterWeapon(monster) {
    const current = monsterWieldedWeapon(monster);
    if (monster?.weaponCheck !== NEED_WEAPON && current) return null;

    monster.weaponCheck = NEED_RANGED_WEAPON;
    const missile = selectRangedWeapon(monster);
    const launcherNames = RANGED_LAUNCHERS.get(objectTypeName(missile));
    const inventory = monster?.minvent || monster?.inventory || [];
    const launcher = launcherNames
        ? inventory.find(object => launcherNames.has(objectTypeName(object)))
        : null;

    if (!launcher) {
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }
    if (current?.otyp === launcher.otyp) {
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }

    if (current) current.wielded = false;
    monster.mw = launcher;
    launcher.wielded = true;
    monster.weaponCheck = NEED_WEAPON;
    return launcher;
}

export function monsterVolleyCount(
    monster, missile, launcher, rollOne = rnd,
) {
    const quantity = missile?.quan ?? missile?.quantity ?? 1;
    const missileName = objectTypeName(missile);
    const launcherNames = RANGED_LAUNCHERS.get(missileName);
    const matchingLauncher = !!(launcherNames
        && launcherNames.has(objectTypeName(launcher)));
    const stackableWeapon = missile?.oclass === WEAPON_CLASS
        || missile?.class === 'Weapons';
    if (quantity <= 1 || monster?.mconf
        || (!matchingLauncher && !stackableWeapon)) return 1;

    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    let maximum = 1;
    if (flags & M2_PRINCE) maximum += 2;
    else if (flags & M2_LORD) maximum++;
    if (missileName === 'elven arrow' && !missile.cursed) maximum++;
    if (objectTypeName(launcher) === 'elven bow'
        && matchingLauncher && !launcher?.cursed) maximum++;
    if (matchingLauncher && (launcher?.spe ?? 0) > 1)
        maximum += Math.trunc(((launcher.spe ?? 0) + 1) / 3);

    let volley = rollOne(maximum);
    volley += monster.multishotClassBonus ?? 0;
    if (((flags & 0x00000010)
            && missileName === 'elven arrow'
            && objectTypeName(launcher) === 'elven bow')
        || ((flags & 0x00000080)
            && missileName === 'orcish arrow'
            && objectTypeName(launcher) === 'orcish bow')
        || ((flags & 0x00000040)
            && missileName === 'crossbow bolt'
            && objectTypeName(launcher) === 'crossbow')) {
        volley++;
    }
    return Math.max(1, Math.min(quantity, volley));
}

export function splitMonsterMissile(monster, missile) {
    const inventory = monster.minvent || monster.inventory || [];
    const quantity = missile.quan ?? missile.quantity ?? 1;
    if (quantity > 1) {
        const single = { ...missile };
        single.o_id = nextIdent();
        single.quan = single.quantity = 1;
        single.owt = OBJECT_WEIGHT[single.otyp] ?? single.owt ?? 1;
        single.wielded = false;
        single.worn = false;
        single.where = 'free';
        missile.quan = missile.quantity = quantity - 1;
        missile.owt = (OBJECT_WEIGHT[missile.otyp] ?? 1) * (quantity - 1);
        return single;
    }

    const index = inventory.indexOf(missile);
    if (index >= 0) inventory.splice(index, 1);
    if (monster.mw === missile) monster.mw = null;
    monster.minvent = inventory;
    monster.inventory = inventory;
    missile.wielded = false;
    missile.worn = false;
    missile.where = 'free';
    return missile;
}

export function placeThrownObject(state, object, x, y) {
    object.ox = x;
    object.oy = y;
    object.where = 'floor';
    state._fobjSerial = (state._fobjSerial || 0) + 1;
    object._fobjOrder = state._fobjSerial;
    if (!state.level.objects[x]) state.level.objects[x] = [];
    if (!state.level.objects[x][y]) state.level.objects[x][y] = [];
    state.level.objects[x][y].unshift(object);
}

export function clearThrownObject(state, object) {
    if (state?._thrownObject === object) state._thrownObject = null;
}

export function placeAndStackThrownObject(state, object, x, y) {
    placeThrownObject(state, object, x, y);
    stack_object(object, state);
    clearThrownObject(state, object);
    return object;
}

export function projectileDamageAgainstHero(object, rollOne = rnd) {
    const sides = Math.max(1, OBJECT_SMALL_DAMAGE[object.otyp] || 1);
    let damage = rollOne(sides);
    const weaponLike = object.oclass === WEAPON_CLASS
        || (object.oclass === TOOL_CLASS
            && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0);
    if (weaponLike) {
        damage += object.spe ?? 0;
        if (damage < 0) damage = 0;
    }
    if (damage > 0) {
        damage = Math.max(
            1,
            damage - Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0),
        );
    }
    return Math.max(1, damage);
}
