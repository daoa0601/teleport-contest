// Weapons thrown or shot by monsters.
// C refs: weapon.c select_rwep() and mthrowu.c monmulti(), m_throw().

import {
    A_DEX, A_STR, BOLT_LIM, NEED_RANGED_WEAPON, NEED_WEAPON,
    P_DAGGER, P_DART, P_SHURIKEN, P_SLING, P_SPEAR,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import {
    canProjectMonster, flush_screen, newsym, show_glyph_cell,
} from './display.js';
import { dist2, distmin } from './hacklib.js';
import { nextIdent } from './ident.js';
import { stack_object } from './mklev.js';
import {
    MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, monsterTypeName,
} from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    FLINT, OBJECT_DESCRIPTIONS, OBJECT_NAMES, OBJECT_SMALL_DAMAGE,
    OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import { isPoisonableObject } from './object_properties.js';
import { monsterHasPoisonResistance } from './monster_resistance.js';
import { rn2, rnd } from './rng.js';
import { cansee } from './vision.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { finishHeroDeath } from './end.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;
const VENOM_CLASS = 17;
const M2_ELF = 0x00000010;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const PM_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');
const PM_CAVE_DWELLER = MONSTER_NAME.indexOf('cave dweller');
const PM_MONK = MONSTER_NAME.indexOf('monk');
const PM_RANGER = MONSTER_NAME.indexOf('ranger');
const PM_ROGUE = MONSTER_NAME.indexOf('rogue');
const PM_SAMURAI = MONSTER_NAME.indexOf('samurai');
const PM_WIZARD = MONSTER_NAME.indexOf('wizard');
const PM_NINJA = MONSTER_NAME.indexOf('ninja');

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

function isPlayerMonster(mnum) {
    return mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD;
}

function monsterClassVolleyBonus(monster, missile, launcher) {
    const skill = OBJECT_SUBTYPE[missile.otyp] ?? 0;
    if (monster.mnum === PM_CAVE_DWELLER)
        return skill === -P_SLING || skill === P_SPEAR ? 1 : 0;
    if (monster.mnum === PM_MONK)
        return skill === -P_SHURIKEN ? 1 : 0;
    if (monster.mnum === PM_RANGER) return skill !== P_DAGGER ? 1 : 0;
    if (monster.mnum === PM_ROGUE) return skill === P_DAGGER ? 1 : 0;

    let bonus = 0;
    if (monster.mnum === PM_NINJA
        && (skill === -P_SHURIKEN || skill === -P_DART)) {
        bonus++;
    }
    if ((monster.mnum === PM_NINJA || monster.mnum === PM_SAMURAI)
        && objectTypeName(missile) === 'ya'
        && objectTypeName(launcher) === 'yumi') {
        bonus++;
    }
    return bonus;
}

export function monsterVolleyCount(
    monster, missile, launcher, rollOne = rnd,
) {
    const quantity = missile?.quan ?? missile?.quantity ?? 1;
    const missileName = objectTypeName(missile);
    const launcherNames = RANGED_LAUNCHERS.get(missileName);
    const ammunition = !!launcherNames;
    const matchingLauncher = !!(launcherNames
        && launcherNames.has(objectTypeName(launcher)));
    const stackableWeapon = missile?.oclass === WEAPON_CLASS
        || missile?.class === 'Weapons';
    if (quantity <= 1 || monster?.mconf
        || (ammunition ? !matchingLauncher : !stackableWeapon)) return 1;

    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    let maximum = 1;
    if (flags & M2_PRINCE) maximum += 2;
    else if (flags & M2_LORD) maximum++;
    else if (isPlayerMonster(monster.mnum)) maximum++;
    if (missileName === 'elven arrow' && !missile.cursed) maximum++;
    if (objectTypeName(launcher) === 'elven bow'
        && matchingLauncher && !launcher?.cursed) maximum++;
    if (matchingLauncher && (launcher?.spe ?? 0) > 1)
        maximum += Math.trunc(((launcher.spe ?? 0) + 1) / 3);

    let volley = rollOne(maximum);
    volley += monsterClassVolleyBonus(monster, missile, launcher);
    if (((flags & M2_ELF)
            && missileName === 'elven arrow'
            && objectTypeName(launcher) === 'elven bow')
        || ((flags & M2_ORC)
            && missileName === 'orcish arrow'
            && objectTypeName(launcher) === 'orcish bow')
        || ((flags & M2_GNOME)
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

export function finishDeferredRangedProjectileHit(
    shot, state, random = rn2,
) {
    if (!shot?.deferredFloorResolution || !shot.weapon) return shot;
    shot.deferredFloorResolution = false;
    const object = shot.weapon;
    const subtype = OBJECT_SUBTYPE[object.otyp] ?? 0;
    const ammo = (object.oclass === WEAPON_CLASS
            || object.oclass === GEM_CLASS)
        && subtype >= -22 && subtype <= -20;
    const missile = (object.oclass === WEAPON_CLASS
            || object.oclass === TOOL_CLASS)
        && subtype >= -24 && subtype <= -23;
    const magicStone = objectTypeName(object) === 'loadstone'
        || objectTypeName(object) === 'luckstone';
    let broken = false;
    if (shot.hit && (ammo || missile) && !magicStone) {
        const chance = 3 + Math.max(
            object.oeroded ?? 0, object.oeroded2 ?? 0,
        ) - (object.spe ?? 0);
        broken = chance > 1 ? random(chance) !== 0 : random(4) === 0;
        if (object.blessed && random(3) === 0) broken = false;
        if (object.otyp === FLINT && random(2) === 0) broken = false;
    }
    if (broken) {
        random(100);
        object.where = 'gone';
        object.ox = object.oy = 0;
        clearThrownObject(state, object);
    } else {
        const x = shot.impactX ?? state.u?.ux ?? 0;
        const y = shot.impactY ?? state.u?.uy ?? 0;
        placeAndStackThrownObject(
            state, object, x, y,
        );
    }
    shot.floorResolved = true;
    shot.projectileBroken = broken;
    return shot;
}

export async function finishHeroProjectileHit(
    shot, state, {
        beforeFinalDeath,
        finishDeath = finishHeroDeath,
        random = rn2,
    } = {},
) {
    const fatal = (state.u?.uhp ?? 1) < 1;
    if (fatal && await finishDeath({
        killer: shot.appearance || 'weapon',
        beforeFinalDeath,
    })) {
        return { died: true, lifeSaved: false };
    }

    exerciseAttribute(A_STR, false, state);
    finishDeferredRangedProjectileHit(shot, state, random);
    return { died: false, lifeSaved: fatal };
}

export async function presentMonsterProjectileContact(contact, publish) {
    const x = contact.x ?? contact.impactX ?? contact.target?.mx;
    const y = contact.y ?? contact.impactY ?? contact.target?.my;
    if (!cansee(x, y)) return;
    const spotted = canProjectMonster(
        contact.target, x, y,
    );
    const target = spotted
        ? `the ${monsterTypeName(
            contact.target.mnum, !!contact.target.female,
        )}`
        : 'it';
    await publish(contact.hit
        ? `The ${contact.appearance} hits ${target}.`
        : `The ${contact.appearance} misses ${target}.`);
    if (contact.poisonResisted)
        await publish(`The poison doesn't seem to affect ${target}.`);
    else if (contact.poisonDeadly)
        await publish('The poison was deadly...');
    if (contact.targetDied) {
        const subject = target === 'it'
            ? 'It' : `The ${target.slice(4)}`;
        await publish(`${subject} is killed!`);
    }
}

export async function presentMonsterProjectileShot(
    shot, projectileGlyph, state, {
        publish,
        showMissWithoutTarget = false,
    },
) {
    let transientFlightCell = null;
    for (const cell of shot.flightPath || []) {
        if (cell.contact)
            await presentMonsterProjectileContact(cell.contact, publish);
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
        if (shot.target)
            await presentMonsterProjectileContact(shot, publish);
        else if (showMissWithoutTarget)
            await publish(`The ${shot.appearance} misses.`);

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
    return rollPhysicalWeaponDamage(object, monster, { rollOne });
}

function missileAppearance(missile) {
    return missile.dknown
        ? objectTypeName(missile)
        : OBJECT_DESCRIPTIONS[missile.otyp]
            || objectTypeName(missile) || 'weapon';
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

function hitMonsterWithMissile(
    source, intendedTarget, defender, missile, random, rollOne,
) {
    let hitThreshold = 5 + findMonsterArmorClass(defender);
    const sourceLevel = source.m_lev ?? MONSTER_LEVEL[source.mnum] ?? 0;
    if (defender === intendedTarget && sourceLevel > 5)
        hitThreshold += sourceLevel - 5;
    const hitRoll = rollOne(20);
    const hit = hitThreshold >= hitRoll;
    let damage = hit
        ? projectileDamageAgainstMonster(missile, defender, rollOne)
        : 0;
    let poisonResisted = false;
    let poisonDeadly = false;
    if (hit && missile.opoisoned && isPoisonableObject(missile)) {
        if (monsterHasPoisonResistance(defender)) {
            poisonResisted = true;
        } else if (random(30)) {
            damage += rollOne(6);
        } else {
            poisonDeadly = true;
            damage = defender.mhp ?? 1;
        }
    }
    if (hit) {
        defender.msleeping = 0;
        defender.mhp = Math.max(0, (defender.mhp ?? 1) - damage);
    }
    return {
        appearance: objectTypeName(missile) || 'weapon',
        target: defender,
        x: defender.mx,
        y: defender.my,
        hit,
        targetDied: hit && (defender.mhp ?? 0) <= 0,
        hitRoll,
        hitThreshold,
        damage,
        poisonResisted,
        poisonDeadly,
    };
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

        const contact = hitMonsterWithMissile(
            source, target, defender, missile, random, rollOne,
        );
        if (!contact.hit) {
            random(5);
            if (remaining > 1) {
                flightPath.push({ x, y, contact });
                continue;
            }
        }
        return {
            weapon: missile,
            ...contact,
            launched,
            flightPath,
            flightGlyph: ')',
            impactX: x,
            impactY: y,
            deferredFloorResolution: true,
        };
    }

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
        deferredFloorResolution: true,
    };
}

function throwOneMonsterMissileAtHero(
    source, state, weapon, launched, random, rollOne,
) {
    const missile = splitMonsterMissile(source, weapon);
    state._thrownObject = missile;
    const heroX = state.u?.ux ?? source.mx;
    const heroY = state.u?.uy ?? source.my;
    const distance = distmin(source.mx, source.my, heroX, heroY);
    const dx = Math.sign(heroX - source.mx);
    const dy = Math.sign(heroY - source.my);
    const appearance = missileAppearance(missile);
    const flightPath = [];
    let x = source.mx;
    let y = source.my;

    for (let remaining = distance; remaining > 0; remaining--) {
        x += dx;
        y += dy;
        const defender = livingMonsterAt(state, source, x, y);
        if (defender) {
            const contact = hitMonsterWithMissile(
                source, null, defender, missile, random, rollOne,
            );
            if (!contact.hit) {
                random(5);
                if (remaining > 1) {
                    flightPath.push({ x, y, contact });
                    continue;
                }
            }
            placeAndStackThrownObject(state, missile, x, y);
            return {
                weapon: missile,
                ...contact,
                launched,
                flightPath,
                flightGlyph: ')',
                impactX: x,
                impactY: y,
            };
        }

        if (x === heroX && y === heroY) {
            const dexterity = state.u?.acurr?.a?.[A_DEX] ?? 10;
            const catchChance = 100 - dexterity
                - (['monk', 'rogue'].includes(state.urole?.key) ? 20 : 0);
            const catchEligible = !state.blind
                && !(state.u?.blindTurns > 0)
                && !state.u?.confused
                && !state.u?.stunned
                && !state.u?.fumbling
                && missile.oclass !== VENOM_CLASS;
            const caught = catchEligible
                && random(Math.max(1, catchChance)) === 0;
            if (caught) {
                (state.inventory ||= []).push(missile);
                missile.where = 'invent';
                clearThrownObject(state, missile);
                return {
                    weapon: missile,
                    appearance,
                    heroTarget: true,
                    caught: true,
                    launched,
                    flightPath,
                    flightGlyph: ')',
                    impactX: x,
                    impactY: y,
                };
            }

            const damage = projectileDamageAgainstHero(missile, rollOne);
            let hitLevel = Math.max(
                -4, 3 - distmin(heroX, heroY, source.mx, source.my),
            );
            hitLevel += 8 + (missile.spe ?? 0);
            const hitRoll = rollOne(20);
            const hit = (state.u?.uac ?? 10) + hitLevel > hitRoll;
            if (hit) {
                const preHitHp = state.u?.uhp ?? 1;
                state.u.uhp = Math.max(0, preHitHp - damage);
                return {
                    weapon: missile,
                    appearance,
                    heroTarget: true,
                    hit,
                    hitRoll,
                    hitLevel,
                    damage,
                    preHitHp,
                    launched,
                    flightPath,
                    flightGlyph: ')',
                    impactX: x,
                    impactY: y,
                    deferredFloorResolution: true,
                };
            }

            random(5);
            placeAndStackThrownObject(state, missile, x, y);
            return {
                weapon: missile,
                appearance,
                heroTarget: true,
                hit,
                hitRoll,
                hitLevel,
                damage,
                launched,
                flightPath,
                flightGlyph: ')',
                impactX: x,
                impactY: y,
            };
        }

        random(5);
        if (remaining > 1) flightPath.push({ x, y });
    }
    return null;
}

function newMonsterWeaponVolley({
    source, aimedAt = null, targetKind, weapon, launched, volley, shot,
}) {
    return {
        attempted: true,
        madeAttack: true,
        source,
        aimedAt,
        targetKind,
        missileStack: weapon,
        appearance: shot.appearance,
        volley,
        shots: [shot],
        launched,
    };
}

export function throwMonsterWeaponAtHero(
    source, state, weapon, {
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    const launcher = monsterWieldedWeapon(source);
    const launcherNames = RANGED_LAUNCHERS.get(objectTypeName(weapon));
    const launched = !!(launcherNames
        && launcherNames.has(objectTypeName(launcher)));
    const volley = monsterVolleyCount(source, weapon, launcher, rollOne);
    source.weaponCheck = NEED_WEAPON;
    const shot = throwOneMonsterMissileAtHero(
        source, state, weapon, launched, random, rollOne,
    );
    return shot ? newMonsterWeaponVolley({
        source,
        targetKind: 'hero',
        weapon,
        volley,
        launched,
        shot,
    }) : null;
}

export function continueMonsterWeaponVolley(
    attack, state, {
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    const targetAlive = attack?.targetKind === 'hero'
        ? (state.u?.uhp ?? 1) > 0
        : state.level?.monsters?.includes(attack?.aimedAt)
            && (attack.aimedAt?.mhp ?? 0) > 0;
    if (!attack?.shots
        || attack.shots.length >= attack.volley
        || (attack.source?.mhp ?? 1) <= 0
        || !targetAlive) {
        return null;
    }
    const shot = attack.targetKind === 'hero'
        ? throwOneMonsterMissileAtHero(
            attack.source, state, attack.missileStack,
            attack.launched, random, rollOne,
        )
        : throwOneMonsterMissile(
            attack.source, attack.aimedAt, state, attack.missileStack,
            attack.launched, random, rollOne,
        );
    if (shot) attack.shots.push(shot);
    return shot;
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
    const shot = throwOneMonsterMissile(
        source, target, state, weapon, launched, random, rollOne,
    );
    return newMonsterWeaponVolley({
        source,
        aimedAt: target,
        targetKind: 'monster',
        weapon,
        volley,
        launched,
        shot,
    });
}
