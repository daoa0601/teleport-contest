// Weapons thrown or shot by monsters.
// C refs: weapon.c select_rwep() and mthrowu.c monmulti(), m_throw().

import {
    A_CON, A_DEX, A_STR, BOLT_LIM, NEED_RANGED_WEAPON, NEED_WEAPON,
    NO_WEAPON_WANTED, POISONING, P_BOW, P_CROSSBOW, P_DAGGER, P_DART,
    P_SHURIKEN, P_SLING, P_SPEAR,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import {
    blindHeroWithThrownObject, blindMonsterWithThrownObject,
} from './blinding_attack.js';
import {
    canProjectMonster, flush_screen, newsym, show_glyph_cell,
} from './display.js';
import { dist2, distmin } from './hacklib.js';
import { nextIdent } from './ident.js';
import { stack_object } from './floor_object.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME,
    MONSTER_SYMBOL, monsterHatesSilver, monsterIsPlayerMonster,
    monsterTypeName,
} from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { monsterWieldedWeapon, selectMonsterWeaponOfType } from './monster_weapon.js';
import { game } from './gstate.js';
import {
    BLINDING_VENOM, BOULDER, BOW, CREAM_PIE, CROSSBOW, DART, EGG,
    ELVEN_BOW, FLINT, LOADSTONE, OBJECT_DESCRIPTIONS,
    OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SUBTYPE, OBJECT_WEIGHT,
    ORCISH_BOW, SLING, YUMI,
} from './object_data.js';
import { ammunitionMatchesLauncher, isAmmunition, willWeld } from './weapon_type.js';
import { deleteObject } from './object_delete.js';
import { isPoisonableObject } from './object_properties.js';
import {
    monsterHasPoisonResistance, monsterHasStoneResistance,
} from './monster_resistance.js';
import { resolvePoisonedHero } from './poison.js';
import { d, rn2, rnd } from './rng.js';
import { cansee } from './vision.js';
import { heroHatesSilver } from './hero_species.js';
import {
    rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero,
} from './weapon_damage.js';
import { finishHeroDeath } from './end.js';
import { hitByPetrifyingEgg, touchPetrifies } from './stoning.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;
const VENOM_CLASS = 17;
const M2_ELF = 0x00000010;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_ROCKTHROW = 0x08000000;
const M2_JEWELS = 0x20000000;
const M1_AMORPHOUS = 0x00000004;
const S_GHOST = 54;
const S_KOP = 37;
const SILVER = 14;
const PM_CAVE_DWELLER = MONSTER_NAME.indexOf('cave dweller');
const PM_MONK = MONSTER_NAME.indexOf('monk');
const PM_RANGER = MONSTER_NAME.indexOf('ranger');
const PM_ROGUE = MONSTER_NAME.indexOf('rogue');
const PM_SAMURAI = MONSTER_NAME.indexOf('samurai');
const PM_NINJA = MONSTER_NAME.indexOf('ninja');
const BLINDING_PROJECTILES = new Set([CREAM_PIE, BLINDING_VENOM]);
const ZERO_DAMAGE_HERO_PROJECTILES = new Set([
    CREAM_PIE, BLINDING_VENOM, EGG,
]);

// C weapon.c:rwep[] order. A melee weapon is not automatically a missile.
const RANGED_WEAPON_PREFERENCE = [
    'dwarvish spear', 'silver spear', 'elven spear', 'spear', 'orcish spear',
    'javelin', 'shuriken', 'ya', 'silver arrow', 'elven arrow', 'arrow',
    'orcish arrow', 'crossbow bolt', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'knife', 'flint', 'rock', 'loadstone',
    'luckstone', 'dart', 'cream pie',
].map(name => OBJECT_NAMES.indexOf(name));

export const MONSTER_POLEARMS = new Set([
    'halberd', 'bardiche', 'spetum', 'bill-guisarme', 'voulge', 'ranseur',
    'guisarme', 'glaive', 'lucern hammer', 'bec de corbin', 'fauchard',
    'partisan', 'lance',
]);

export function objectTypeName(object) {
    return OBJECT_NAMES[object?.otyp] || '';
}

// The disposable-missile branches of C select_rwep(). Returning both objects
// keeps the selected launcher with its ammunition without C's global propellor.
export function selectMonsterMissile(monster, state = game) {
    const inventory = monster.minvent || monster.inventory || [];
    const egg = selectMonsterWeaponOfType(monster, EGG, state);
    if (egg) return { missile: egg, launcher: null };
    if (MONSTER_SYMBOL[monster.mnum] === S_KOP) {
        const pie = selectMonsterWeaponOfType(monster, CREAM_PIE, state);
        if (pie) return { missile: pie, launcher: null };
    }
    if (MONSTER_FLAGS2[monster.mnum] & M2_ROCKTHROW) {
        const boulder = selectMonsterWeaponOfType(monster, BOULDER, state);
        if (boulder) return { missile: boulder, launcher: null };
    }

    const current = monsterWieldedWeapon(monster);
    const cannotSwitch = willWeld(current) && monster.weaponCheck === NO_WEAPON_WANTED;
    for (const type of RANGED_WEAPON_PREFERENCE) {
        if (type === DART && !(MONSTER_FLAGS2[monster.mnum] & M2_JEWELS)) {
            const sling = inventory.find(object => object.otyp === SLING);
            if (sling) {
                const gem = inventory.find(object => object.oclass === GEM_CLASS
                    && (object.otyp !== LOADSTONE || !object.cursed));
                if (gem) return { missile: gem, launcher: sling };
            }
        }

        const skill = OBJECT_SUBTYPE[type];
        const launcher = selectMissileLauncher(monster, skill, state);
        const needsLauncher = skill >= -P_CROSSBOW && skill <= -P_BOW;
        if (needsLauncher && !launcher) continue;
        if (skill < 0 && cannotSwitch && launcher !== current) continue;
        if (type === LOADSTONE) {
            const stone = inventory.find(object => object.otyp === LOADSTONE && !object.cursed);
            if (stone) return { missile: stone, launcher };
        } else {
            const missile = selectMonsterWeaponOfType(monster, type, state);
            if (missile && !missile.oartifact
                && !(missile === current && willWeld(missile))) return { missile, launcher };
        }
    }
    return null;
}

function selectMissileLauncher(monster, skill, state) {
    let types;
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

// Switching to a launcher consumes this action. If no launcher is needed,
// or the correct launcher is already wielded, the monster may shoot now.
export function readyRangedMonsterWeapon(monster, state = game) {
    const current = monsterWieldedWeapon(monster);
    if (monster?.weaponCheck !== NEED_WEAPON && current) return null;

    monster.weaponCheck = NEED_RANGED_WEAPON;
    const launcher = selectMonsterMissile(monster, state)?.launcher;

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
    const ammunition = isAmmunition(missile);
    const matchingLauncher = ammunitionMatchesLauncher(missile, launcher);
    const stackableWeapon = missile?.oclass === WEAPON_CLASS
        || missile?.class === 'Weapons';
    if (quantity <= 1 || monster?.mconf
        || (ammunition ? !matchingLauncher : !stackableWeapon)) return 1;

    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    let maximum = 1;
    if (flags & M2_PRINCE) maximum += 2;
    else if (flags & M2_LORD) maximum++;
    else if (monsterIsPlayerMonster(monster.mnum)) maximum++;
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
    let broken = BLINDING_PROJECTILES.has(object.otyp)
        || (shot.hit && object.otyp === EGG);
    if (!broken && shot.hit && (ammo || missile) && !magicStone) {
        const chance = 3 + Math.max(
            object.oeroded ?? 0, object.oeroded2 ?? 0,
        ) - (object.spe ?? 0);
        broken = chance > 1 ? random(chance) !== 0 : random(4) === 0;
        if (object.blessed && random(3) === 0) broken = false;
        if (object.otyp === FLINT && random(2) === 0) broken = false;
    }
    if (broken) {
        random(100);
        deleteObject(object, state);
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
        publish = async () => undefined,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
    } = {},
) {
    const killer = objectTypeName(shot.weapon)
        || shot.appearance || 'weapon';
    if (shot.hit && shot.silverSears) {
        await publish('The silver sears your flesh!');
        exerciseAttribute(A_CON, false, state);
    }
    const baseHitWasFatal = (state.u?.uhp ?? 1) < 1;
    if (baseHitWasFatal && await finishDeath({
        killer,
        beforeFinalDeath,
    })) {
        return { died: true, lifeSaved: false };
    }

    exerciseAttribute(A_STR, false, state);
    let lifeSaved = baseHitWasFatal;
    const poisoned = shot.hit && shot.weapon?.opoisoned
        && isPoisonableObject(shot.weapon);
    if (poisoned) {
        const poison = await resolvePoisonedHero({
            reason: shot.appearance,
            attribute: A_STR,
            fatal: baseHitWasFatal ? 0 : 10,
            state,
            random,
            rollDice,
            rollOne,
            publish,
            thrownWeapon: true,
        });
        if (poison.deadly) {
            if (await finishDeath({
                killer,
                beforeFinalDeath,
                deathType: POISONING,
            })) {
                return { died: true, lifeSaved: false };
            }
            lifeSaved = true;
        }
    }
    if (shot.hit && BLINDING_PROJECTILES.has(shot.weapon?.otyp)) {
        const blindness = blindHeroWithThrownObject(
            shot.weapon.otyp, state, rollOne,
        );
        if (blindness) await publish(blindness.message);
    }
    if (shot.hit && shot.weapon?.otyp === EGG)
        await hitByPetrifyingEgg(shot.weapon, state);
    finishDeferredRangedProjectileHit(shot, state, random);
    return { died: false, lifeSaved };
}

export async function finishMonsterProjectileHit(
    shot, state, {
        finishMonsterDeath,
        publish,
        rollOne = rnd,
    } = {},
) {
    if (!shot?.hit || !shot.petrifyingEgg || !shot.target)
        return { handled: false, deathFinished: false };
    if (!state.level?.monsters?.includes(shot.target))
        return { handled: false, deathFinished: false };

    const petrification = await petrifyMonsterFromContact(shot.target, {
        finishDeath: finishMonsterDeath,
        publish, rollOne, state,
    });
    const deathFinished = !petrification.survived;
    let damage = 0;
    if (petrification.survived
        && !monsterHasStoneResistance(shot.target)) {
        damage = shot.eggImpactDamage;
        shot.target.mhp = Math.max(0, shot.target.mhp - damage);
    }
    shot.damage = damage;
    shot.targetDied = (shot.target.mhp ?? 0) <= 0;
    return { handled: true, deathFinished, petrification };
}

export async function presentMonsterProjectileContact(
    contact, publish, { showDeath = true } = {},
) {
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
    if (contact.hit && contact.weapon?.otyp === EGG) {
        const subject = target === 'it' ? 'It' : `The ${target.slice(4)}`;
        const article = /^[aeiou]/i.test(contact.appearance) ? 'an' : 'a';
        await publish(
            `Splat!  ${subject} is hit with ${article} ${contact.appearance}!`,
        );
    } else {
        await publish(contact.hit
            ? `The ${contact.appearance} hits ${target}.`
            : `The ${contact.appearance} misses ${target}.`);
    }
    if (contact.poisonResisted)
        await publish(`The poison doesn't seem to affect ${target}.`);
    else if (contact.poisonDeadly)
        await publish('The poison was deadly...');
    if (contact.silverSears) {
        const flesh = MONSTER_SYMBOL[contact.target?.mnum] !== S_GHOST
            && !((MONSTER_FLAGS1[contact.target?.mnum] ?? 0) & M1_AMORPHOUS);
        const object = flesh
            ? target === 'it' ? 'its flesh' : `${possessive(target)} flesh`
            : target;
        await publish(`The silver sears ${object}!`);
    }
    if (contact.blinded && spotted) {
        const cause = contact.weapon?.otyp === CREAM_PIE ? 'pie' : 'venom';
        await publish(`The ${target.slice(4)} is blinded by the ${cause}.`);
    }
    if (contact.targetDied && showDeath) {
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

export function projectileDamageAgainstHero(object, state, rollOne = rnd) {
    if (ZERO_DAMAGE_HERO_PROJECTILES.has(object.otyp)) return 0;
    return Math.max(1, rollPhysicalWeaponDamageAgainstHero(
        object, state, { rollOne },
    ));
}

function projectileDamageAgainstMonster(object, monster, rollOne) {
    if (BLINDING_PROJECTILES.has(object.otyp)) return 0;
    return rollPhysicalWeaponDamage(object, monster, { rollOne });
}

function missileAppearance(missile) {
    if (missile.otyp === EGG && missile.known
        && MONSTER_NAME[missile.corpsenm]) {
        return `${MONSTER_NAME[missile.corpsenm]} egg`;
    }
    const name = missile.dknown
        ? objectTypeName(missile)
        : OBJECT_DESCRIPTIONS[missile.otyp]
            || objectTypeName(missile) || 'weapon';
    return missile.opoisoned && isPoisonableObject(missile)
        ? `poisoned ${name}` : name;
}

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
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
    source, intendedTarget, defender, missile, state, random, rollOne,
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
    const petrifyingEgg = hit && missile.otyp === EGG
        && touchPetrifies(missile.corpsenm);
    const silverSears = hit
        && OBJECT_MATERIAL[missile.otyp] === SILVER
        && monsterHatesSilver(defender);
    const eggImpactDamage = petrifyingEgg ? damage : 0;
    if (petrifyingEgg) damage = 0;
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
    const blindness = hit ? blindMonsterWithThrownObject(
        defender, missile.otyp, { state, rollOne },
    ) : null;
    const appearance = missileAppearance(missile);
    if (petrifyingEgg) missile.known = true;
    return {
        weapon: missile,
        appearance,
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
        silverSears,
        petrifyingEgg,
        eggImpactDamage,
        blinded: blindness?.wasSeeing ?? false,
        blindIncrement: blindness?.blindIncrement ?? 0,
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
            source, target, defender, missile, state, random, rollOne,
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
        appearance: missileAppearance(missile),
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
                source, null, defender, missile, state, random, rollOne,
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

            const silverSears = OBJECT_MATERIAL[missile.otyp] === SILVER
                && heroHatesSilver(state);
            const damage = projectileDamageAgainstHero(
                missile, state, rollOne,
            );
            const hitLevel = ZERO_DAMAGE_HERO_PROJECTILES.has(missile.otyp)
                ? 8
                : Math.max(
                    -4, 3 - distmin(heroX, heroY, source.mx, source.my),
                ) + 8 + (missile.spe ?? 0);
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
                    silverSears,
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
            const disappears = BLINDING_PROJECTILES.has(missile.otyp);
            if (!disappears)
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
                deferredFloorResolution: disappears,
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
    const launched = ammunitionMatchesLauncher(weapon, launcher);
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
    const readiedWeapon = readyRangedMonsterWeapon(source, state);
    if (readiedWeapon) {
        return {
            attempted: true,
            launched: false,
            readiedWeapon,
        };
    }

    const weapon = selectMonsterMissile(source, state)?.missile;
    if (!weapon || !positionsAreLinedUp(source, target)) return null;

    const distance = distmin(source.mx, source.my, target.mx, target.my);
    const hesitationRange = Math.max(BOLT_LIM - distance, 1);
    if (target.mflee && random(hesitationRange) !== 0) return null;

    const launcher = monsterWieldedWeapon(source);
    const launched = ammunitionMatchesLauncher(weapon, launcher);
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
