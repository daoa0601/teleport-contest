// Weapons thrown or shot by monsters.
// C refs: weapon.c select_rwep() and mthrowu.c monmulti(), m_throw().

import { BOLT_LIM, NEED_RANGED_WEAPON, NEED_WEAPON } from './const.js';
import {
    canProjectMonster, flush_screen, newsym, show_glyph_cell,
} from './display.js';
import { dist2, distmin } from './hacklib.js';
import { nextIdent } from './ident.js';
import { stack_object } from './mklev.js';
import {
    MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_SIZE, monsterTypeName,
} from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    OBJECT_LARGE_DAMAGE, OBJECT_NAMES, OBJECT_SMALL_DAMAGE,
    OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import { rn2, rnd } from './rng.js';
import { cansee } from './vision.js';

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

export async function presentMonsterProjectileShot(
    shot, projectileGlyph, state, {
        publish,
        showMissWithoutTarget = false,
    },
) {
    let transientFlightCell = null;
    for (const cell of shot.flightPath || []) {
        if (transientFlightCell)
            newsym(transientFlightCell.x, transientFlightCell.y);
        transientFlightCell = null;
        const flightVisible = cansee(cell.x, cell.y);
        if (flightVisible) {
            show_glyph_cell(
                cell.x, cell.y, projectileGlyph.ch,
                projectileGlyph.color, projectileGlyph.decgfx,
                projectileGlyph.attr,
            );
            transientFlightCell = cell;
        }
        await flush_screen(1);
        if (flightVisible)
            state.nhDisplay?.setCursor(cell.x, cell.y + 1);
        await state.animationFrame?.();
    }

    const targetVisible = shot.target
        ? cansee(shot.target.mx, shot.target.my) : false;
    try {
        if (shot.target) {
            if (targetVisible) {
                const spotted = canProjectMonster(
                    shot.target, shot.target.mx, shot.target.my,
                );
                const target = spotted
                    ? `the ${monsterTypeName(
                        shot.target.mnum, !!shot.target.female,
                    )}`
                    : 'it';
                await publish(shot.hit
                    ? `The ${shot.appearance} hits ${target}.`
                    : `The ${shot.appearance} misses ${target}.`);
                if (shot.targetDied) {
                    const subject = target === 'it'
                        ? 'It' : `The ${target.slice(4)}`;
                    await publish(`${subject} is killed!`);
                }
            }
        } else if (showMissWithoutTarget) {
            await publish(`The ${shot.appearance} misses.`);
        }

        if (transientFlightCell)
            newsym(transientFlightCell.x, transientFlightCell.y);
        transientFlightCell = null;
        const impactX = shot.impactX ?? shot.target?.mx;
        const impactY = shot.impactY ?? shot.target?.my;
        const impactVisible = Number.isFinite(impactX)
            && Number.isFinite(impactY) && cansee(impactX, impactY);
        if (impactVisible) {
            show_glyph_cell(
                impactX, impactY, projectileGlyph.ch,
                projectileGlyph.color, projectileGlyph.decgfx,
                projectileGlyph.attr,
            );
            transientFlightCell = { x: impactX, y: impactY };
        }
        const impactCursor = impactVisible
            ? [impactX, impactY + 1]
            : [state._pending_message?.length || 0, 0];
        await flush_screen(1);
        state.nhDisplay?.setCursor(...impactCursor);
        await state.animationFrame?.();
    } finally {
        if (transientFlightCell)
            newsym(transientFlightCell.x, transientFlightCell.y);
    }

    return { targetVisible };
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

function projectileDamageAgainstMonster(object, monster, rollOne) {
    const damageTable = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3
        ? OBJECT_LARGE_DAMAGE : OBJECT_SMALL_DAMAGE;
    const sides = Math.max(1, damageTable[object.otyp] || 1);
    let damage = rollOne(sides) + (object.spe ?? 0);
    if (damage > 0) {
        damage = Math.max(
            1,
            damage - Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0),
        );
    }
    return Math.max(1, damage);
}

function livingMonsterAt(state, source, x, y) {
    return state.level?.monsters?.find(monster =>
        monster !== source && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function positionsAreLinedUp(source, target) {
    const dx = Math.abs(source.mx - target.mx);
    const dy = Math.abs(source.my - target.my);
    return dx === 0 || dy === 0 || dx === dy;
}

function throwOneMonsterMissile(
    source, target, state, weapon, launched, random, rollOne,
) {
    const missile = splitMonsterMissile(source, weapon);
    state._thrownObject = missile;
    const distance = distmin(source.mx, source.my, target.mx, target.my);
    const dx = Math.sign(target.mx - source.mx);
    const dy = Math.sign(target.my - source.my);
    const flightPath = [];
    let x = source.mx;
    let y = source.my;

    for (let remaining = distance; remaining > 0; remaining--) {
        x += dx;
        y += dy;
        const defender = livingMonsterAt(state, source, x, y);
        if (!defender) {
            random(5);
            if (remaining > 1) flightPath.push({ x, y });
            continue;
        }

        let hitThreshold = 5 + findMonsterArmorClass(defender);
        const sourceLevel = source.m_lev
            ?? MONSTER_LEVEL[source.mnum] ?? 0;
        if (defender === target && sourceLevel > 5)
            hitThreshold += sourceLevel - 5;
        const hitRoll = rollOne(20);
        const hit = hitThreshold >= hitRoll;
        const damage = hit
            ? projectileDamageAgainstMonster(missile, defender, rollOne)
            : 0;
        if (hit) {
            defender.msleeping = 0;
            defender.mhp = Math.max(0, (defender.mhp ?? 1) - damage);
        } else {
            random(5);
            if (remaining > 1) {
                flightPath.push({ x, y });
                continue;
            }
        }
        placeAndStackThrownObject(state, missile, x, y);
        return {
            weapon: missile,
            appearance: objectTypeName(missile) || 'weapon',
            target: defender,
            hit,
            targetDied: hit && (defender.mhp ?? 0) <= 0,
            hitRoll,
            hitThreshold,
            damage,
            launched,
            flightPath,
            flightGlyph: ')',
            impactX: x,
            impactY: y,
        };
    }

    placeAndStackThrownObject(state, missile, x, y);
    return {
        weapon: missile,
        appearance: objectTypeName(missile) || 'weapon',
        target: null,
        hit: false,
        damage: 0,
        launched,
        flightPath,
        flightGlyph: ')',
        impactX: x,
        impactY: y,
    };
}

export function throwMonsterWeaponAtMonster(
    source, target, state, {
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    const readiedWeapon = readyRangedMonsterWeapon(source);
    if (readiedWeapon) {
        return {
            attempted: true,
            launched: false,
            readiedWeapon,
        };
    }

    const weapon = selectRangedWeapon(source);
    if (!weapon || MONSTER_POLEARMS.has(objectTypeName(weapon))
        || !positionsAreLinedUp(source, target)) return null;

    const distance = distmin(source.mx, source.my, target.mx, target.my);
    const hesitationRange = Math.max(BOLT_LIM - distance, 1);
    if (target.mflee && random(hesitationRange) !== 0) return null;

    const launcher = monsterWieldedWeapon(source);
    const launcherNames = RANGED_LAUNCHERS.get(objectTypeName(weapon));
    const launched = !!(launcherNames
        && launcherNames.has(objectTypeName(launcher)));
    if (launched
        && dist2(source.mx, source.my, target.mx, target.my) > 36) {
        return null;
    }

    const volley = monsterVolleyCount(source, weapon, launcher, rollOne);
    source.weaponCheck = NEED_WEAPON;
    const shots = [];
    for (let shot = 0; shot < volley; shot++) {
        shots.push(throwOneMonsterMissile(
            source, target, state, weapon, launched, random, rollOne,
        ));
        if ((source.mhp ?? 1) <= 0) break;
    }
    const firstShot = shots[0];
    return {
        attempted: true,
        madeAttack: true,
        ...firstShot,
        hit: shots.some(shot => shot.hit),
        damage: shots.reduce((total, shot) => total + shot.damage, 0),
        target: shots.find(shot => shot.target)?.target || null,
        aimedAt: target,
        volley,
        shots,
        launched,
    };
}
