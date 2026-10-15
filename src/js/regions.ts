import { formatFeltMessage, formatSeenMessage } from './hero_speech.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
// regions.js — Shared level-region construction.
// C ref: region.c create_region(), make_gas_cloud(), and
// create_gas_cloud_selection().

import {
    ACCESSIBLE, PLNMSG_ENVELOPED_IN_GAS, Upolyd, isok,
} from './const.js';
import {
    canSeeMonster, newsym, plineWithContinuation,
} from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { monsterAtPosition } from './monster_location.js';
import { loseHeroHp } from './hero_damage.js';
import type { DeathHandler } from './end.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GasCloud, Position } from './map_types.js';
import type { MessagePublisher } from './display.js';

import { monsterHasPoisonResistance } from './monster_resistance.js';
import { heroIsBreathless } from './hero_species.js';
import { heroEyeName, heroLungName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { refreshProperty } from './properties.js';
import { teleportHeroSafely } from './teleport.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SOUND,
    MONSTER_SYMBOL, monsterIsNonliving, monsterIsVampireShifter,
} from './monster_data.js';
import { monsterName } from './monster_name.js';
import { AD_DRST, AD_RBRE, AT_BREA } from './monster_attack_types.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { cansee, vision_note_blocker_change } from './vision.js';

const GAS_BAD = 0;
const GAS_MINOR = 1;
export const GAS_OK = 2;
const M1_BREATHLESS = 0x00000400;
const M1_NOEYES = 0x00001000;
const S_EEL = 57;
const PM_FOG_CLOUD = 106;
const PM_VROCK = 295;
const PM_HEZROU = 296;

export type GasTolerance = typeof GAS_BAD | typeof GAS_MINOR | typeof GAS_OK;

export interface HeroGasDamage {
    kind: 'hero-gas';
    resisted: false;
    damage: number;
    died?: boolean;
}

export interface MonsterGasDeath {
    monster: Monster;
    survived: boolean;
    corpse?: GameObject | null;
    heroDied?: boolean;
}

export interface MonsterGasDamage {
    kind: 'monster-gas';
    monster: Monster;
    resisted: false;
    damage: number;
    heroFault: boolean;
    visible: boolean;
    death?: MonsterGasDeath;
}

export type RegionEvent = HeroGasDamage | MonsterGasDamage
    | { kind: 'hero-gas'; resisted: true; damage: 0 }
    | { kind: 'monster-gas'; monster: Monster; resisted: true; damage: 0 };

type WakeNearGas = (
    x: number, y: number, distance: number, state: GameState,
    publish: MessagePublisher,
) => void | Promise<void>;

export interface RegionTurnOptions {
    publish?: MessagePublisher;
    rollOne?: (sides: number) => number;
    wake?: WakeNearGas;
    die?: DeathHandler | undefined;
    onMonsterDeath?: ((monster: Monster, event: MonsterGasDamage)
        => MonsterGasDeath | Promise<MonsterGasDeath>) | undefined;
    onAnger?: ((monster: Monster) => unknown) | undefined;
}

interface RegionTurnHandlers extends RegionTurnOptions {
    publish: MessagePublisher;
    rollOne: (sides: number) => number;
    wake: WakeNearGas;
}

function uniqueXMajorCells(cells: readonly Position[] | null | undefined): Position[] {
    const points = new Map<string, Position>();
    for (const cell of cells || []) {
        if (!Number.isInteger(cell?.x) || !Number.isInteger(cell?.y)) continue;
        points.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
    }
    return [...points.values()].sort((left, right) =>
        left.x - right.x || left.y - right.y);
}

// Store the cells and lifetime shared by harmless and poisonous gas clouds.
export async function createHarmlessGasCloudSelection(
    state: GameState | null | undefined, cells: readonly Position[], { ttl = -1 } = {},
): Promise<GasCloud | null> {
    return await createGasCloudSelection(state, cells, ttl, 0);
}

export async function createGasCloudSelection(
    state: GameState | null | undefined, cells: readonly Position[], ttl: number, damage: number,
    publish: MessagePublisher = plineWithContinuation,
): Promise<GasCloud | null> {
    return await makeGasCloud(state, cells, ttl, damage, false, publish);
}

async function makeGasCloud(
    state: GameState | null | undefined, cells: readonly Position[], ttl: number, damage: number,
    silent: boolean, publish: MessagePublisher,
): Promise<GasCloud | null> {
    if (!state?.level) return null;
    const inside = state.level.regions.some(region =>
        regionContains(region, state.u.ux, state.u.uy));
    const orderedCells = uniqueXMajorCells(cells);
    const monsterIds = new Set<number>();
    for (const cell of orderedCells) {
        if (!isok(cell.x, cell.y)) continue;
        const monster = monsterAtPosition(state.level, cell.x, cell.y);
        if (monster) monsterIds.add(monster.m_id);
    }
    const region: GasCloud = {
        kind: 'gas-cloud',
        heroFault: !state.in_mklev && !state.context.mon_moving,
        visible: true,
        damage,
        ttl,
        cells: orderedCells,
        monsterIds: [...monsterIds],
    };
    (state.level.regions ||= []).push(region);
    if (state.level === game.level) {
        // C add_region() redraws the entire bounding box using the old sight
        // buffer. Blocking changes are deferred to the next recalculation.
        const xs = region.cells.map(cell => cell.x), ys = region.cells.map(cell => cell.y);
        for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
            for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
                if (!isok(x, y)) continue;
                if (regionContains(region, x, y)) vision_note_blocker_change(x, y);
                if (cansee(x, y)) newsym(x, y);
            }
        }
    }
    if (!state.in_mklev && !inside && !silent
        && regionContains(region, state.u.ux, state.u.uy)) {
        await publish(`You are enveloped in a cloud of ${damage ? 'noxious gas' : 'steam'}!`);
        state._lastPlineKind = PLNMSG_ENVELOPED_IN_GAS;
    }
    return region;
}

function validCloudPosition(state: GameState, x: number, y: number): boolean {
    if (!isok(x, y)) return false;
    const typ = state.level?.at(x, y)?.typ;
    return (typ !== undefined && ACCESSIBLE(typ))
        || isPoolAt(x, y, state) || isLavaAt(x, y, state);
}

function gasCloudCells(
    state: GameState, x: number, y: number, cloudSize: number,
    random: (limit: number) => number,
): Position[] {
    const cells = [{ x, y }];
    for (let current = 0; current < cells.length; current++) {
        if (cells.length >= cloudSize) break;
        const origin = cells[current];
        if (!origin) throw new Error('Gas cloud traversal lost its current cell');
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
        ];
        for (let count = 4; count > 0; count--) {
            const swap = random(count);
            const value = directions[swap];
            const last = directions[count - 1];
            if (!value || !last) throw new RangeError('Gas cloud direction roll is out of range');
            directions[swap] = last;
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

function gasCloudTtl(
    cloudSize: number, cellCount: number, random: (limit: number) => number,
): number {
    return Math.trunc((4 + random(3)) * cloudSize / cellCount);
}

export async function createSteamCloud(
    state: GameState, x: number, y: number, cloudSize: number, random = rn2,
): Promise<GasCloud | null> {
    return await createPoisonGasCloud(state, x, y, cloudSize, 0, random);
}

export async function createPoisonGasCloud(
    state: GameState | null | undefined,
    x: number, y: number, cloudSize: number, damage: number,
    random = rn2, publish: MessagePublisher = plineWithContinuation,
): Promise<GasCloud | null> {
    if (!state?.level) return null;
    const silentSingleCell = !state.context?.mon_moving
        && x === state.u.ux && y === state.u.uy && cloudSize === 1
        && (!damage || heroGasTolerance(state) === GAS_OK);
    const cells = gasCloudCells(state, x, y, cloudSize, random);
    return await makeGasCloud(state, cells,
        gasCloudTtl(cloudSize, cells.length, random), damage, silentSingleCell, publish);
}

function regionContains(region: GasCloud, x: number, y: number): boolean {
    return region.cells?.some(cell => cell.x === x && cell.y === y);
}

// C m_in_out_region()/update_monster_region(). Membership changes at the
// movement boundary; swapping with the hero does not cross this boundary.
export function updateMonsterRegions(monster: Monster, state: GameState = game,
    position: Position = { x: monster.mx, y: monster.my }): void {
    for (const region of requireGameLevel(state).regions) {
        const index = region.monsterIds.indexOf(monster.m_id);
        if (regionContains(region, position.x, position.y)) {
            if (index < 0) region.monsterIds.push(monster.m_id);
        } else if (index >= 0) {
            removeRegionMonster(region, index);
        }
    }
}

function removeRegionMonster(region: GasCloud, index: number): void {
    const lastId = region.monsterIds.pop();
    if (lastId !== undefined && index < region.monsterIds.length)
        region.monsterIds[index] = lastId;
}

export function visibleRegionAt(state: GameState, x: number, y: number): GasCloud | null {
    return requireGameLevel(state).regions.find(region => region.visible
        && region.ttl !== -2 && regionContains(region, x, y)) || null;
}

// C region.c:region_danger(), used when deciding whether prayer can help.
export function heroIsInDangerousRegion(state: GameState = game): boolean {
    if (heroIsBreathless(state) || state.u.poisonResistance
        || (state.u.umonnum !== undefined && monsterIsNonliving(state.u.umonnum))) return false;
    return requireGameLevel(state).regions.some(region =>
        region.kind === 'gas-cloud' && regionContains(region, state.u.ux, state.u.uy));
}

export async function rescueHeroFromRegion(state: GameState = game): Promise<void> {
    const level = requireGameLevel(state);
    const clouds = level.regions.filter(region =>
        region.kind === 'gas-cloud' && regionContains(region, state.u.ux, state.u.uy));
    const cloud = clouds[0];
    if (clouds.length > 1 || cloud && cloud.ttl < 0) {
        await teleportHeroSafely();
        if (heroIsInDangerousRegion(state)) {
            state.u.magicalBreathingTurns = d(4, 4) + 4;
            refreshProperty('magicalBreathing', state);
            await plineWithContinuation(formatFeltMessage('able to breathe.', state));
        }
    } else if (cloud) {
        removeGasCloud(cloud, state);
        await plineWithContinuation('The gas cloud enveloping you dissipates.');
    } else {
        await plineWithContinuation('The gas cloud has dissipated.');
    }
    if (state.u.blindTurns === 1) {
        await makeBlinded(0, { state });
    }
}

function sameLevel(
    left: DungeonLocation | null | undefined, right: DungeonLocation | null | undefined,
): boolean {
    return !!left && !!right
        && left.dnum === right.dnum
        && left.dlevel === right.dlevel;
}

function poisonBreather(mnum: number): boolean {
    return (MONSTER_ATTACKS[mnum] || []).some(([type, damage]) =>
        type === AT_BREA && (damage === AD_DRST || damage === AD_RBRE));
}

function poisonGasImmuneSpecies(
    mnum: number | null | undefined, state: GameState, x: number, y: number,
): boolean {
    if (typeof mnum !== 'number' || !Number.isInteger(mnum)) return false;
    if (monsterIsNonliving(mnum)
        || (MONSTER_FLAGS1[mnum] ?? 0) & M1_BREATHLESS
        || mnum === PM_VROCK || mnum === PM_HEZROU
        || poisonBreather(mnum)) return true;
    const waterLevel = sameLevel(state.u?.uz, state.water_level);
    return (MONSTER_SYMBOL[mnum] === S_EEL || waterLevel)
        && isPoolAt(x, y, state);
}

export function heroGasTolerance(state: GameState = game): GasTolerance {
    const hero = state.u;
    const mnum = Upolyd(hero) ? hero.umonnum : null;
    if (hero.uinvulnerable || hero.invulnerable
        || hero.breathless || hero.magicalBreathing
        || hero.underwater
        || poisonGasImmuneSpecies(mnum, state, hero.ux, hero.uy)) {
        return GAS_OK;
    }
    return hero.poisonResistance ? GAS_MINOR : GAS_BAD;
}

export function monsterGasTolerance(monster: Monster, state: GameState): GasTolerance {
    if (monsterIsVampireShifter(monster)
        || poisonGasImmuneSpecies(
            monster.mnum, state, monster.mx, monster.my,
        )) return GAS_OK;
    return monsterHasPoisonResistance(monster) ? GAS_MINOR : GAS_BAD;
}

function halfHeroGasDamage(damage: number, state: GameState): number {
    const hero = state.u;
    if (hero.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    if (hero.halfGasDamage)
        damage = Math.trunc((damage + 1) / 2);
    return damage;
}

async function wakeNearGas(
    x: number, y: number, state: GameState,
    publish: MessagePublisher, wake: WakeNearGas,
): Promise<void> {
    await wake(x, y, 2, state, publish);
}

async function affectHeroWithGas(
    region: GasCloud, state: GameState,
    { publish, rollOne, wake, die }: RegionTurnHandlers,
): Promise<RegionEvent | null> {
    if (!regionContains(region, state.u.ux, state.u.uy)) return null;
    if (Upolyd(state.u)) maintainCloudForFog(region, state.u.umonnum);
    if (region.damage < 1) return null;
    const tolerance = heroGasTolerance(state);
    if (tolerance === GAS_OK) return null;

    if (!heroIsBlind(state)) {
        await publish(`Your ${makePlural(heroEyeName(state))} sting.`);
        await makeBlinded(1, { state, talk: false, publish });
    }
    if (tolerance === GAS_MINOR) {
        await publish('You cough!');
        await wakeNearGas(state.u.ux, state.u.uy, state, publish, wake);
        return { kind: 'hero-gas', resisted: true, damage: 0 };
    }

    await publish(`Something is burning your ${makePlural(heroLungName(state))}!`);
    await publish('You cough and spit blood!');
    await wakeNearGas(state.u.ux, state.u.uy, state, publish, wake);
    const damage = halfHeroGasDamage(rollOne(region.damage) + 5, state);
    const event: HeroGasDamage = { kind: 'hero-gas', resisted: false, damage };
    const died = await loseHeroHp(damage, 'gas cloud', { state, publish, ...(die ? { die } : {}) });
    if (died) event.died = true;
    return event;
}

async function affectMonsterWithGas(
    region: GasCloud, monster: Monster, state: GameState,
    { publish, rollOne, wake, onAnger, onMonsterDeath }: RegionTurnHandlers,
): Promise<RegionEvent | null> {
    maintainCloudForFog(region, monster.mnum);
    if (region.damage < 1) return null;
    if (monsterGasTolerance(monster, state) === GAS_OK) return null;

    const nearHero = (monster.mx - state.u.ux) ** 2
        + (monster.my - state.u.uy) ** 2 < 8;
    const visible = canSeeMonster(monster);
    if ((MONSTER_SOUND[monster.mnum] ?? 0) !== 0) {
        if (cansee(monster.mx, monster.my) || nearHero)
            await publish(`${monsterName(monster, { state, capitalized: true })} coughs!`);
        await wakeNearGas(monster.mx, monster.my, state, publish, wake);
    }
    if (region.heroFault) {
        if (typeof onAnger !== 'function') {
            throw new TypeError('poison gas requires the monster anger handler');
        }
        await onAnger(monster);
    }
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
        && monster.mcansee !== 0 && monster.mcansee !== false) {
        monster.mblinded = 1;
        monster.mcansee = 0;
    }
    if (monsterGasTolerance(monster, state) === GAS_MINOR)
        return { kind: 'monster-gas', monster, resisted: true, damage: 0 };

    const damage = rollOne(region.damage) + 5;
    monster.mhp -= damage;
    const event: MonsterGasDamage = {
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

// C region.c:remove_region(). Unlink before rebuilding the blocker table so
// this cloud no longer hides the terrain, while overlapping clouds still do.
function removeGasCloud(region: GasCloud, state: GameState): void {
    const level = requireGameLevel(state);
    const index = level.regions.indexOf(region);
    if (index < 0) return;
    const last = level.regions.pop();
    if (last && last !== region) level.regions[index] = last;
    region.ttl = -2;
    if (!region.visible || state.level !== game.level) return;

    for (const cell of region.cells)
        vision_note_blocker_change(cell.x, cell.y);
    if (heroIsBlind(state)) return;
    for (const cell of region.cells)
        if (cansee(cell.x, cell.y)) newsym(cell.x, cell.y);
}

async function expireRegions(state: GameState, publish: MessagePublisher): Promise<void> {
    let dissipatedAroundHero = false;
    let dissipatedInSight = 0;
    const level = requireGameLevel(state);
    // Native expiry scans backward; removal fills the hole with the last
    // surviving region, which has already had its expiry check.
    for (const region of [...level.regions].reverse()) {
        if (region.ttl !== 0) continue;
        if (region.kind === 'gas-cloud' && region.damage >= 5) {
            region.damage = Math.trunc(region.damage / 2);
            region.ttl = 2;
            continue;
        }
        // expire_gas_cloud() counts visible spots before remove_region()
        // changes their display; blindness and swallowing suppress notice.
        if (!heroIsBlind(state) && !state.u.uswallow && state === game) {
            for (const cell of region.cells) {
                if (cell.x === state.u.ux && cell.y === state.u.uy)
                    dissipatedAroundHero = true;
                else if (cansee(cell.x, cell.y)) dissipatedInSight++;
            }
        }
        removeGasCloud(region, state);
    }
    if (dissipatedAroundHero) {
        await publish('The gas cloud around you dissipates.');
        if ((state.u.xray_range ?? -1) <= 1) dissipatedInSight = 0;
    }
    if (dissipatedInSight === 1)
        await publish(formatSeenMessage('a gas cloud dissipate.', state));
    else if (dissipatedInSight > 1)
        await publish(formatSeenMessage('some gas clouds dissipate.', state));
}

function maintainCloudForFog(region: GasCloud, species: number | undefined): void {
    if (region.ttl < 20 && species === PM_FOG_CLOUD) region.ttl += 5;
}

export async function runLevelRegions(state: GameState | null | undefined, {
    publish = plineWithContinuation,
    rollOne = rnd,
    wake = async () => {},
    die,
    onMonsterDeath,
    onAnger,
}: RegionTurnOptions = {}): Promise<RegionEvent[]> {
    if (!state?.level?.regions?.length) return [];
    await expireRegions(state, publish);
    const events: RegionEvent[] = [];
    for (const region of state.level.regions) {
        if (region.ttl > 0) region.ttl--;
        const hero = await affectHeroWithGas(region, state, {
            publish, rollOne, wake, die,
        });
        if (hero) events.push(hero);
        if (state.program_state?.gameover) break;
        let index = 0;
        while (index < region.monsterIds.length) {
            const id = region.monsterIds[index];
            const monster = state.level.monsters.find(candidate => candidate.m_id === id);
            if (!monster || monster.dead || monster.mhp <= 0) {
                removeRegionMonster(region, index);
                continue;
            }
            const event = await affectMonsterWithGas(region, monster, state, {
                publish, rollOne, wake, onAnger, onMonsterDeath,
            });
            if (event) events.push(event);
            if (monster.dead || monster.mhp <= 0) removeRegionMonster(region, index);
            else index++;
        }
    }
    return events;
}
