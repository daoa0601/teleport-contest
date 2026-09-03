// regions.js — Shared level-region construction.
// C ref: region.c create_region(), make_gas_cloud(), and
// create_gas_cloud_selection().

import {
    IS_LAVA, IS_POOL, IS_ROOM, Upolyd, isok,
} from './const.js';
import {
    canSeeMonster, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_RESISTS, MONSTER_SOUND,
    MONSTER_SYMBOL, monsterIsNonliving, monsterIsVampireShifter,
    monsterTypeName,
} from './monster_data.js';
import { AD_DRST, AD_RBRE, AT_BREA } from './monster_attack_types.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, syncBlindness } from './senses.js';
import { cansee, vision_note_blocker_change } from './vision.js';

const GAS_BAD = 0;
const GAS_MINOR = 1;
const GAS_OK = 2;
const M1_BREATHLESS = 0x00000400;
const M1_NOEYES = 0x00001000;
const MR_POISON = 0x20;
const S_EEL = 57;
const PM_FOG_CLOUD = 106;
const PM_VROCK = 295;
const PM_HEZROU = 296;

function uniqueXMajorCells(cells) {
    const points = new Map();
    for (const cell of cells || []) {
        if (!Number.isInteger(cell?.x) || !Number.isInteger(cell?.y)) continue;
        points.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
    }
    return [...points.values()].sort((left, right) =>
        left.x - right.x || left.y - right.y);
}

// Store the cells and lifetime shared by harmless and poisonous gas clouds.
export function createHarmlessGasCloudSelection(
    state, cells, { ttl = -1 } = {},
) {
    if (!state?.level) return null;
    const region = {
        kind: 'gas-cloud',
        visible: true,
        damage: 0,
        ttl,
        cells: uniqueXMajorCells(cells),
    };
    (state.level.regions ||= []).push(region);
    if (state.level === game.level) {
        for (const cell of region.cells)
            vision_note_blocker_change(cell.x, cell.y);
    }
    return region;
}

function validCloudPosition(state, x, y) {
    if (!isok(x, y)) return false;
    const typ = state.level?.at(x, y)?.typ;
    return IS_ROOM(typ) || IS_POOL(typ) || IS_LAVA(typ);
}

function gasCloudCells(state, x, y, cloudSize, random) {
    const cells = [{ x, y }];
    for (let current = 0; current < cells.length; current++) {
        if (cells.length >= cloudSize) break;
        const origin = cells[current];
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
        ];
        for (let count = 4; count > 0; count--) {
            const swap = random(count);
            const value = directions[swap];
            directions[swap] = directions[count - 1];
            directions[count - 1] = value;
        }
        let valid = 0;
        for (const direction of directions) {
            const nextX = origin.x + direction.x;
            const nextY = origin.y + direction.y;
            if (!validCloudPosition(state, nextX, nextY)) continue;
            valid++;
            if (valid === 4 && random(2) === 0) continue;
            const newCell = !cells.some(cell =>
                cell.x === nextX && cell.y === nextY);
            if (newCell) cells.push({ x: nextX, y: nextY });
            if (cells.length >= cloudSize) break;
        }
    }
    return cells;
}

function gasCloudTtl(cloudSize, cellCount, random) {
    return Math.trunc((4 + random(3)) * cloudSize / cellCount);
}

export function createSteamCloud(
    state, x, y, cloudSize, random = rn2,
) {
    const cells = gasCloudCells(state, x, y, cloudSize, random);
    const ttl = gasCloudTtl(cloudSize, cells.length, random);
    return createHarmlessGasCloudSelection(state, cells, { ttl });
}

export function createPoisonGasCloud(
    state, x, y, cloudSize, damage, random = rn2,
) {
    if (!state?.level) return null;
    const cells = gasCloudCells(state, x, y, cloudSize, random);
    const region = createHarmlessGasCloudSelection(state, cells, {
        ttl: gasCloudTtl(cloudSize, cells.length, random),
    });
    region.damage = damage;
    region.heroFault = !state.context?.mon_moving;
    return region;
}

function regionContains(region, x, y) {
    return region.cells?.some(cell => cell.x === x && cell.y === y);
}

function sameLevel(left, right) {
    return !!left && !!right
        && left.dnum === right.dnum
        && left.dlevel === right.dlevel;
}

function poisonBreather(mnum) {
    return (MONSTER_ATTACKS[mnum] || []).some(([type, damage]) =>
        type === AT_BREA && (damage === AD_DRST || damage === AD_RBRE));
}

function poisonGasImmuneSpecies(mnum, state, x, y) {
    if (!Number.isInteger(mnum)) return false;
    if (monsterIsNonliving(mnum)
        || (MONSTER_FLAGS1[mnum] ?? 0) & M1_BREATHLESS
        || mnum === PM_VROCK || mnum === PM_HEZROU
        || poisonBreather(mnum)) return true;
    const waterLevel = sameLevel(state.u?.uz, state.water_level);
    const inWater = IS_POOL(state.level?.at?.(x, y)?.typ);
    return MONSTER_SYMBOL[mnum] === S_EEL && (waterLevel || inWater);
}

function heroGasTolerance(state) {
    const hero = state.u || {};
    const mnum = Upolyd(hero) ? hero.umonnum : null;
    if (hero.uinvulnerable || hero.invulnerable
        || hero.breathless || hero.magicalBreathing
        || hero.underwater
        || poisonGasImmuneSpecies(mnum, state, hero.ux, hero.uy)) {
        return GAS_OK;
    }
    return hero.poisonResistance || hero.poison_resistance
        ? GAS_MINOR : GAS_BAD;
}

function monsterGasTolerance(monster, state) {
    if (monsterIsVampireShifter(monster)
        || poisonGasImmuneSpecies(
            monster.mnum, state, monster.mx, monster.my,
        )) return GAS_OK;
    return (MONSTER_RESISTS[monster.mnum] ?? 0) & MR_POISON
        ? GAS_MINOR : GAS_BAD;
}

function halfHeroGasDamage(damage, state) {
    const hero = state.u || {};
    if (hero.halfPhysicalDamage || hero.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);
    if (hero.halfGasDamage || hero.half_gas_damage)
        damage = Math.trunc((damage + 1) / 2);
    return damage;
}

function damageHero(damage, state) {
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(
        0, (state.u[hitPoints] ?? 1) - damage,
    );
    return state.u[hitPoints];
}

async function wakeNearGas(x, y, state, publish, wake) {
    await wake(x, y, 2, state, publish);
}

async function affectHeroWithGas(
    region, state, { publish, rollOne, wake, onHeroDeath },
) {
    if (region.damage < 1 || !regionContains(region, state.u.ux, state.u.uy))
        return null;
    const tolerance = heroGasTolerance(state);
    if (tolerance === GAS_OK) return null;

    if (!heroIsBlind(state)) {
        await publish('Your eyes sting.');
        state.u.blindTurns = Math.max(state.u.blindTurns ?? 0, 1);
        syncBlindness(state);
    }
    if (tolerance === GAS_MINOR) {
        await publish('You cough!');
        await wakeNearGas(state.u.ux, state.u.uy, state, publish, wake);
        return { kind: 'hero-gas', resisted: true, damage: 0 };
    }

    await publish('Something is burning your lungs!');
    await publish('You cough and spit blood!');
    await wakeNearGas(state.u.ux, state.u.uy, state, publish, wake);
    const damage = halfHeroGasDamage(rollOne(region.damage) + 5, state);
    const hitPoints = damageHero(damage, state);
    const event = { kind: 'hero-gas', resisted: false, damage };
    if (hitPoints <= 0) {
        if (typeof onHeroDeath !== 'function') {
            throw new TypeError('poison gas requires the hero death handler');
        }
        event.died = await onHeroDeath(event);
    }
    return event;
}

function monsterGasSubject(monster) {
    return monster.name
        || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

async function affectMonsterWithGas(
    region, monster, state,
    { publish, rollOne, wake, onAnger, onMonsterDeath },
) {
    if (region.damage < 1 || monster.dead || (monster.mhp ?? 1) <= 0
        || !regionContains(region, monster.mx, monster.my)) return null;
    if (monsterGasTolerance(monster, state) === GAS_OK) return null;

    const nearHero = (monster.mx - state.u.ux) ** 2
        + (monster.my - state.u.uy) ** 2 < 8;
    const visible = canSeeMonster(monster, monster.mx, monster.my);
    if ((MONSTER_SOUND[monster.mnum] ?? 0) !== 0 && (visible || nearHero))
        await publish(`${monsterGasSubject(monster)} coughs!`);
    await wakeNearGas(monster.mx, monster.my, state, publish, wake);
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
        && monster.mcansee !== 0 && monster.mcansee !== false) {
        monster.mblinded = 1;
        monster.mcansee = 0;
    }
    if (region.heroFault) {
        if (typeof onAnger !== 'function') {
            throw new TypeError('poison gas requires the monster anger handler');
        }
        await onAnger(monster);
    }
    if (monsterGasTolerance(monster, state) === GAS_MINOR)
        return { kind: 'monster-gas', monster, resisted: true, damage: 0 };

    const damage = rollOne(region.damage) + 5;
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    const event = {
        kind: 'monster-gas', monster, resisted: false, damage,
        heroFault: !!region.heroFault, visible,
    };
    if (monster.mhp <= 0) {
        if (typeof onMonsterDeath !== 'function') {
            throw new TypeError(
                'poison gas requires the monster death handler',
            );
        }
        event.death = await onMonsterDeath(monster, event);
    }
    return event;
}

async function expireRegions(state, publish) {
    let dissipatedAroundHero = false;
    let dissipatedInSight = 0;
    const survivors = [];
    for (const region of state.level.regions || []) {
        if (region.ttl !== 0) {
            survivors.push(region);
            continue;
        }
        if (region.kind === 'gas-cloud' && region.damage >= 5) {
            region.damage = Math.trunc(region.damage / 2);
            region.ttl = 2;
            survivors.push(region);
            continue;
        }
        if (regionContains(region, state.u.ux, state.u.uy))
            dissipatedAroundHero = true;
        else if (!heroIsBlind(state) && state === game
            && region.cells?.some(cell => cansee(cell.x, cell.y))) {
            dissipatedInSight++;
        }
        if (state.level === game.level) {
            for (const cell of region.cells || [])
                vision_note_blocker_change(cell.x, cell.y);
        }
    }
    state.level.regions = survivors;
    if (dissipatedAroundHero)
        await publish('The gas cloud around you dissipates.');
    else if (dissipatedInSight === 1)
        await publish('You see a gas cloud dissipate.');
    else if (dissipatedInSight > 1)
        await publish('You see some gas clouds dissipate.');
}

function maintainCloudForFog(region, state) {
    if (region.kind !== 'gas-cloud') return;
    const occupants = [
        (state.u?.mtimedone ?? 0) > 0
            && state.u?.umonnum === PM_FOG_CLOUD
            && { x: state.u.ux, y: state.u.uy },
        ...(state.level.monsters || [])
            .filter(monster => !monster.dead && monster.mnum === PM_FOG_CLOUD)
            .map(monster => ({ x: monster.mx, y: monster.my })),
    ].filter(Boolean);
    for (const occupant of occupants) {
        if (regionContains(region, occupant.x, occupant.y) && region.ttl < 20)
            region.ttl += 5;
    }
}

export async function runLevelRegions(state, {
    publish = plineWithContinuation,
    rollOne = rnd,
    wake = async () => {},
    onHeroDeath,
    onMonsterDeath,
    onAnger,
} = {}) {
    if (!state?.level?.regions?.length) return [];
    await expireRegions(state, publish);
    const events = [];
    for (const region of state.level.regions) {
        if (region.ttl > 0) region.ttl--;
        maintainCloudForFog(region, state);
        const hero = await affectHeroWithGas(region, state, {
            publish, rollOne, wake, onHeroDeath,
        });
        if (hero) events.push(hero);
        if (state.program_state?.gameover) break;
        for (const monster of [...(state.level.monsters || [])]) {
            const event = await affectMonsterWithGas(region, monster, state, {
                publish, rollOne, wake, onAnger, onMonsterDeath,
            });
            if (event) events.push(event);
        }
    }
    return events;
}
