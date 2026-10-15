import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Position, Trap } from './map_types.js';
// Monster level migration: departure, limbo, and arrival.
// C refs: dog.c migrate_to_level(), mon_leave(), losedogs(), mon_arrive(),
// mon_catchup_elapsed_time(), update_mlstmv(), discard_migrations();
// mon.c m_into_limbo()/migrate_mon().

import {
    RLOC_NOMSG, LARGEST_INT, MON_ARRIVE_BEFORE_YOU, MON_ARRIVE_WITH_YOU, MON_ARRIVE_AFTER_YOU,
    COLNO, In_endgame, MAGIC_PORTAL, MAX_NUM_WORMS, MIGR_APPROX_XY,
    MIGR_EXACT_XY, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_PORTAL,
    MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP,
    MIGR_WITH_HERO, MIGR_LEFTOVERS, MON_LIMBO, MON_MIGRATING, MON_STILL_ARRIVING, ROWNO, STRAT_ARRIVE,
} from './const.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { healMonster } from './mon.js';
import { finishMonsterEating } from './monster_eating.js';
import { insideWizardTower } from './dungeon.js';
import { depth } from './hacklib.js';
import { monsterHasMapPosition, placeMonsterAt as placeMonsterOnMap } from './monster_location.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { dropSpecialMonsterObjects } from './monster_drop.js';
import {
    releaseMonsterLeash, releaseMonsterLeashWithFeedback,
} from './monster_leash.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import {
    initializeUnplacedMonsterWormBody, removeMonsterWormBody,
} from './monster_worm.js';
import { newsym } from './display.js';
import { vision_recalc } from './vision.js';
import { rn2, rn1, rnd } from './rng.js';
import { randomMonsterRelocation, relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition, goodPosition } from './teleport_rules.js';
import { somexy } from './mkroom.js';
import { roomForRoomno, roomsAt } from './room.js';
import { makeShoppersHappy } from './shop_damage.js';
import { restoreMonsterShape } from './monster_polymorph.js';
import { detachMonsterFromLevel } from './monster_level_departure.js';
import { deliverOrcRaidLoot } from './orc_raid.js';

export type MonsterMigrationKind = 'level-fall-migration' | 'magic-portal-migration'
    | 'level-migration' | 'limbo-migration' | 'shop-return';

interface MonsterMigrationOptions {
    kind?: MonsterMigrationKind;
    mode?: number;
    confused?: boolean;
    coordinate?: Position | null;
}

export interface MonsterMigrationResult<
    T extends Pick<Trap, 'dst'> = Pick<Trap, 'dst'>,
    K extends MonsterMigrationKind = MonsterMigrationKind,
> {
    kind: K;
    trap: T;
    visible: boolean;
    destination: DungeonLocation;
    damage: 0;
    killed: false;
}

// C include/monflag.h M1 flags used by mon_catchup_elapsed_time().
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_REGEN = 0x00800000;

// C dog.c mon_arrive()'s `when` argument.
export const WIZ_ARRIVE = -1; // C dog.c mon_arrive(mtmp, -1) from resurrect()
export type MonsterArrivalPhase = typeof WIZ_ARRIVE | typeof MON_ARRIVE_BEFORE_YOU
    | typeof MON_ARRIVE_WITH_YOU | typeof MON_ARRIVE_AFTER_YOU;

const PM_LONG_WORM = 114;

// C dog.c: overloading of mtrack[] is kept as explicit fields here:
// migrationArrival (mtrack[0].x), migrationFlags (mtrack[0].y),
// migrationSource (mtrack[1]), migrationOrigin (mtrack[2]).

function sameLevel(first: DungeonLocation | null | undefined, second: DungeonLocation | null | undefined): boolean {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}

function migrationQueue(state: GameState): Monster[] {
    if (!Array.isArray(state._migratingMonsters))
        state._migratingMonsters = [];
    return state._migratingMonsters;
}

function currentDungeonLevel(state: GameState): DungeonLocation {
    if (!state.u.uz) throw new Error('Monster migration requires an initialized hero dungeon location.');
    return state.u.uz;
}

function defaultFallDestination(state: GameState): DungeonLocation {
    // C hole falls land on the next level down within the same dungeon.
    const uz = currentDungeonLevel(state);
    const bottom = state.dungeons?.[uz.dnum]?.num_dunlevs
        ?? (uz.dlevel ?? 1);
    return {
        dnum: uz.dnum,
        dlevel: Math.min((uz.dlevel ?? 1) + 1, bottom),
    };
}

function clearNoCharge(object: GameObject): void {
    // C dog.c mon_leave() resets shop pricing on carried containers.
    object.no_charge = false;
    for (const content of object.contents || [])
        clearNoCharge(content);
}

// losedogs() requeues ordinary failures after all arrivals. Wizard
// resurrection has no such caller tail and returns to limbo immediately.
async function failArrival(monster: Monster, when: MonsterArrivalPhase, state: GameState): Promise<false> {
    const level = requireGameLevel(state);
    level.monsters = level.monsters.filter(candidate => candidate !== monster);
    monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
    monster.mx = monster.my = 0;
    if (when === WIZ_ARRIVE) await sendMonsterToLimbo(monster, state);
    return false;
}

export function setShopResidency(monster: Monster, zeroOut: boolean, state: GameState): void {
    // C shk.c set_residency(): a shopkeeper leaving her shop level clears
    // the room's resident pointer; arriving on it restores the pointer.
    if (!monster.isshk || !monster.eshk) return;
    if (!sameLevel(monster.eshk.shoplevel, state.u?.uz)) return;
    const room = roomForRoomno(state.level, monster.eshk.shoproom);
    if (room) room.resident = zeroOut ? null : monster;
}

// C mon_leave(): both followers and independently migrating monsters lose
// their old shop residency and carry only a tail length between levels.
export function prepareMonsterDeparture(monster: Monster, state: GameState): void {
    for (const object of monster.minvent || monster.inventory || [])
        clearNoCharge(object);
    setShopResidency(monster, true, state);
    if (monster.wormno) {
        const x = monster.mx, y = monster.my;
        const count = Math.min(monster.wormSegments?.length ?? 0, MAX_NUM_WORMS - 1);
        removeMonsterWormBody(monster);
        monster.migratingWormSegments = count;
        if (x) placeMonsterAt(monster, x, y);
    }
}

function placeMonsterAt(monster: Monster, x: number, y: number): void {
    placeMonsterOnMap(monster, x, y);
    monster.mtrack = [];
}

export function migrateMonsterOffLevel<T extends Pick<Trap, 'dst'>>(
    monster: Monster, state: GameState, trap: T,
    options?: Omit<MonsterMigrationOptions, 'kind'> & { kind?: 'level-fall-migration' },
): Promise<MonsterMigrationResult<T, 'level-fall-migration'>>;
export function migrateMonsterOffLevel<T extends Pick<Trap, 'dst'>, K extends MonsterMigrationKind>(
    monster: Monster, state: GameState, trap: T,
    options: Omit<MonsterMigrationOptions, 'kind'> & { kind: K },
): Promise<MonsterMigrationResult<T, K>>;
export function migrateMonsterOffLevel<T extends Pick<Trap, 'dst'>>(
    monster: Monster, state: GameState, trap: T,
    options: MonsterMigrationOptions,
): Promise<MonsterMigrationResult<T>>;
export async function migrateMonsterOffLevel<T extends Pick<Trap, 'dst'>>(
    monster: Monster, state: GameState, trap: T, {
        kind = 'level-fall-migration',
        mode = MIGR_RANDOM,
        confused = false,
        coordinate = null,
    }: MonsterMigrationOptions = {},
): Promise<MonsterMigrationResult<T>> {
    // C dog.c migrate_to_level() plus mon_leave().
    requireLiveGame(state);
    const origin = currentDungeonLevel(state);
    const x = monster.mx, y = monster.my;
    const visible = !state.blind && !((state.u.blindTurns ?? 0) > 0)
        && !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2)
        && !!(!monster.minvis || state.u.seeInvisible);

    if (monster.mleashed) {
        monster.mtame = (monster.mtame ?? 0) - 1;
        monster.pet = monster.mtame > 0;
        await releaseMonsterLeashWithFeedback(monster, { state });
    }

    prepareMonsterDeparture(monster, state);
    await detachMonsterFromLevel(monster, state);
    if (confused) monster.mconf = 1;
    monster.migrating = true;
    monster.mstate = (monster.mstate ?? 0) | MON_MIGRATING;
    monster.migrationMode = mode;
    monster.migrationArrival = mode;
    monster.migrationOrigin = { ...origin };
    monster.migrationDestination = { ...(trap?.dst
        || defaultFallDestination(state)) };
    monster.migrationSource = coordinate
        ? { x: coordinate.x, y: coordinate.y } : { x, y };
    const movingUp = depth(monster.migrationDestination, state.dungeons)
        < depth(origin, state.dungeons);
    monster.migrationFlags = (movingUp ? 1 : 0) | (insideWizardTower(x, y, state) ? 2 : 0);
    monster.mlstmv = state.moves ?? 0;
    monster.mx = 0;
    monster.my = 0;
    migrationQueue(state).push(monster);
    return {
        kind, trap, visible, destination: monster.migrationDestination,
        damage: 0, killed: false,
    };
}

export async function sendMonsterToLimbo(monster: Monster, state: GameState = game): Promise<MonsterMigrationResult> {
    // C m_into_limbo()/migrate_mon(): release holds and protected objects
    // before migrate_to_level() loses the monster's map position.
    monster.mstate = (monster.mstate ?? 0) | MON_LIMBO;
    return await migrateMonsterToLevel(monster, { ...currentDungeonLevel(state) }, state, {
        kind: 'limbo-migration', mode: MIGR_APPROX_XY,
    });
}

// C mon.c:migrate_mon(): release holds and protected items before the
// ordinary migrate_to_level() transaction loses the old map position.
export async function migrateMonsterToLevel(monster: Monster, destination: DungeonLocation, state: GameState = game, {
    kind = 'level-migration', mode = MIGR_RANDOM,
}: Pick<MonsterMigrationOptions, 'kind' | 'mode'> = {}): Promise<MonsterMigrationResult> {
    if (monster.mx) {
        await releaseHeroFromMonster(monster, { state });
        await dropSpecialMonsterObjects(monster, state);
    }
    return await migrateMonsterOffLevel(monster, state, { dst: destination }, { kind, mode });
}

export function updateMonsterLastMove(state: GameState = game): void {
    // C dog.c update_mlstmv(): anchor catchup before a level goes inactive.
    for (const monster of state.level?.monsters || [])
        monster.mlstmv = state.moves ?? 0;
}

// C dog.c mon_catchup_elapsed_time().
export function catchUpMonster(monster: Monster, moves: number, state: GameState): void {
    if (moves < 0) throw new RangeError('Monster catch-up cannot start in the future.');
    const imv = Math.min(Math.trunc(moves), LARGEST_INT - 1);

    if (monster.mblinded)
        monster.mblinded = imv >= monster.mblinded ? 1
            : monster.mblinded - imv;
    if (monster.mfrozen)
        monster.mfrozen = imv >= monster.mfrozen ? 1
            : monster.mfrozen - imv;
    if (monster.mfleetim)
        monster.mfleetim = imv >= monster.mfleetim ? 1
            : monster.mfleetim - imv;

    if (monster.mtrapped && rn2(imv + 1) > 20) monster.mtrapped = 0;
    if (monster.mconf && rn2(imv + 1) > 25) monster.mconf = 0;
    if (monster.mstun && rn2(imv + 1) > 5) monster.mstun = 0;

    if (monster.meating) {
        if (imv > monster.meating) finishMonsterEating(monster, state);
        else monster.meating -= imv;
    }
    if (imv > (monster.mspec_used ?? 0)) monster.mspec_used = 0;
    else monster.mspec_used = (monster.mspec_used ?? 0) - imv;

    // Tameness drops by one for every 150 moves of separation.
    if (monster.mtame) {
        const wilder = Math.trunc((imv + 75) / 150);
        if (monster.mtame > wilder) monster.mtame -= wilder;
        else if (monster.mtame > rn2(wilder)) monster.mtame = 0;
        else monster.mtame = monster.mpeaceful = 0;
    }

    // A pet that would have starved goes wild instead of dying.
    if (monster.mtame && !monster.isminion) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (flags & (M1_CARNIVORE | M1_HERBIVORE)) {
            const pet = monster.edog ?? monster.mextra?.edog;
            if (!pet) throw new Error(`Tame monster ${monster.m_id} has no feeding history.`);
            const hungrytime = pet.hungrytime;
            if ((state.moves > hungrytime + 500 && monster.mhp < 3)
                || state.moves > hungrytime + 750)
                monster.mtame = monster.mpeaceful = 0;
        }
    }

    monster.pet = (monster.mtame ?? 0) > 0;
    if (!monster.mtame && monster.mleashed)
        releaseMonsterLeash(monster, state);

    const healing = (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_REGEN
        ? imv : Math.trunc(imv / 20);
    healMonster(monster, healing);

    monster.mlstmv = state.moves ?? 0;
}

function arrivalStairway(state: GameState, origin: DungeonLocation | undefined, ladder: boolean) {
    // C stairway_find_from()/stairway_find(): the stair on this level that
    // connects back to the origin level.
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameLevel(stair.tolev, origin)
            && !!stair.isladder === ladder) return stair;
    }
    return null;
}

function wanderLocale(state: GameState, x: number, y: number, wander: number): Position | null {
    // C mon_arrive(): a monster that moved during limbo arrives within
    // `wander` squares, or somewhere inside its room.
    const roomNumber = roomsAt(state.level, x, y, 0)[0];
    const room = roomNumber != null
        ? roomForRoomno(state.level, roomNumber) : null;
    if (room) {
        const coordinate = { x: 0, y: 0 };
        if (somexy(room, coordinate, state)) return coordinate;
        return null;
    }
    const lowX = Math.max(1, x - wander);
    const highX = Math.min(COLNO - 1, x + wander);
    const lowY = Math.max(0, y - wander);
    const highY = Math.min(ROWNO - 1, y + wander);
    return {
        x: rn1(highX - lowX, lowX),
        y: rn1(highY - lowY, lowY),
    };
}

// C dog.c mon_arrive(); returns false when no placement was possible.
export async function monsterArrive(monster: Monster, when: MonsterArrivalPhase, state: GameState): Promise<boolean> {
    const level = requireGameLevel(state);
    const queue = migrationQueue(state);
    const index = queue.indexOf(monster);
    if (index >= 0) queue.splice(index, 1);

    monster.mstate = ((monster.mstate ?? 0) | MON_STILL_ARRIVING)
        & ~(MON_MIGRATING | MON_LIMBO);
    monster.migrating = false;
    level.monsters.push(monster);
    setShopResidency(monster, false, state);
    monster.mstrategy = (monster.mstrategy ?? 0) | STRAT_ARRIVE;

    if (monster.mnum === PM_LONG_WORM) {
        initializeUnplacedMonsterWormBody(monster, monster.migratingWormSegments ?? 0, { state });
    } else {
        monster.wormno = 0;
    }
    delete monster.migratingWormSegments;

    // rloc_to()/mnexto() must not use stale pre-migration coordinates.
    monster.mux = state.u.ux;
    monster.muy = state.u.uy;

    let xlocale = monster.migrationSource?.x ?? 0;
    let ylocale = monster.migrationSource?.y ?? 0;
    const origin = monster.migrationOrigin;
    // C mon_arrive(): Wiz_arrive overrides the recorded arrival mode.
    const arrival = when === WIZ_ARRIVE
        ? MIGR_WITH_HERO : (monster.migrationArrival ?? MIGR_RANDOM);
    monster.mtrack = [];

    await restoreMonsterShape(monster, state);
    if (state.program_state.gameover) return false;

    if (monster === state.u?.usteed) return true;

    if (when === MON_ARRIVE_WITH_YOU) {
        // An accompanying monster usually lands beside the hero and
        // sometimes on the hero's own square (which then displaces the hero).
        const heroOccupied = level.monsters.some(candidate => monsterHasMapPosition(candidate, state) &&
            candidate !== monster && (candidate.mhp ?? 1) > 0
            && candidate.mx === state.u.ux && candidate.my === state.u.uy);
        const denominator = monster.mtame ? 10 : monster.mpeaceful ? 5 : 2;
        if (!heroOccupied && !rn2(denominator))
            await relocateMonsterTo(monster, state.u.ux, state.u.uy, { state, flags: RLOC_NOMSG });
        else {
            const nearby = findNearbyMonsterPosition(
                monster.mnum, state.u.ux, state.u.uy, { state },
            );
            if (!nearby) return await failArrival(monster, when, state);
            await relocateMonsterTo(monster, nearby.x, nearby.y, { state, flags: RLOC_NOMSG });
        }
        monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
        return true;
    }

    let wander = 0;
    const lastMove = monster.mlstmv ?? state.moves ?? 0;
    if (lastMove < (state.moves ?? 0) - 1) {
        const elapsed = (state.moves ?? 0) - 1 - lastMove;
        catchUpMonster(monster, elapsed, state);
        wander = Math.min(elapsed, 8);
    }

    switch (arrival) {
    case MIGR_APPROX_XY:
        break;
    case MIGR_EXACT_XY:
        wander = 0;
        break;
    case MIGR_WITH_HERO:
        xlocale = state.u.ux;
        ylocale = state.u.uy;
        break;
    case MIGR_STAIRS_UP:
    case MIGR_STAIRS_DOWN: {
        const stair = arrivalStairway(state, origin, false);
        if (stair) xlocale = stair.sx, ylocale = stair.sy;
        break;
    }
    case MIGR_LADDER_UP:
    case MIGR_LADDER_DOWN: {
        const stair = arrivalStairway(state, origin, true);
        if (stair) xlocale = stair.sx, ylocale = stair.sy;
        break;
    }
    case MIGR_SSTAIRS: {
        const stair = arrivalStairway(state, origin, false)
            || arrivalStairway(state, origin, true);
        if (stair) xlocale = stair.sx, ylocale = stair.sy;
        break;
    }
    case MIGR_PORTAL:
        if (In_endgame(state.u?.uz)) {
            const region = state.level?.upTeleportRegion;
            if (region) {
                xlocale = rn1(region.hx - region.lx + 1, region.lx);
                ylocale = rn1(region.hy - region.ly + 1, region.ly);
            }
            break;
        }
        {
            const portal = state.level?.traps?.find(candidate =>
                candidate.ttyp === MAGIC_PORTAL);
            if (portal) xlocale = portal.tx, ylocale = portal.ty;
            else xlocale = ylocale = 0;
        }
        break;
    default:
        xlocale = ylocale = 0;
        break;
    }

    if ((monster.migflags ?? 0) & MIGR_LEFTOVERS)
        await deliverOrcRaidLoot(monster, state, true);
    if (xlocale && wander) {
        const drifted = wanderLocale(state, xlocale, ylocale, wander);
        if (drifted) xlocale = drifted.x, ylocale = drifted.y;
        else xlocale = ylocale = 0;
    }

    if (xlocale) {
        // mnearto() uses the requested square before searching its neighbours.
        const destination = goodPosition(xlocale, ylocale, { kind: 'monster', monster }, { state })
            ? { x: xlocale, y: ylocale } : findNearbyMonsterPosition(
            monster.mnum, xlocale, ylocale, { state },
        );
        if (!destination) return await failArrival(monster, when, state);
        await relocateMonsterTo(monster, destination.x, destination.y, { state, flags: RLOC_NOMSG });
    } else {
        const relocation = await randomMonsterRelocation(monster, { state, flags: RLOC_NOMSG });
        if (!relocation) return await failArrival(monster, when, state);
    }

    monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
    if (monster.mx) newsym(monster.mx, monster.my);
    return true;
}

export async function deliverMigratingMonsters(
    state: GameState = game, followers: readonly Monster[] = [],
): Promise<number> {
    if (!state.level || !state.u?.uz) return 0;
    // Migration arrays append where C prepends to migrating_mons.
    const arrivals = [...migrationQueue(state)].reverse().filter(monster =>
        sameLevel(monster.migrationDestination, state.u.uz));
    // C losedogs(): settle a pacified keeper's home-level pursuit before
    // arrivals can displace anyone. An angry returning keeper vetoes it.
    let dismissKops = false;
    let angryKeeper = false;
    for (const monster of arrivals) {
        if (!monster.isshk) continue;
        const shop = monster.eshk;
        if (!shop) throw new Error(`Migrating shopkeeper ${monster.m_id} has no shop data.`);
        if (shop.dismiss_kops) {
            dismissKops = true;
            shop.dismiss_kops = false;
        } else if (!monster.mpeaceful) {
            angryKeeper = true;
        }
    }
    if (followers.some(monster => monster.isshk && !monster.mpeaceful))
        angryKeeper = true;
    if (dismissKops && !angryKeeper)
        await makeShoppersHappy({ state, silentKops: true });
    const exact = arrivals.filter(monster => monster.migrationArrival === MIGR_EXACT_XY);
    const others = arrivals.filter(monster => monster.migrationArrival !== MIGR_EXACT_XY);
    const failed: Monster[] = [];
    let delivered = 0;
    const passes: Array<[readonly Monster[], MonsterArrivalPhase]> = [
        [exact, MON_ARRIVE_BEFORE_YOU], [followers, MON_ARRIVE_WITH_YOU], [others, MON_ARRIVE_AFTER_YOU],
    ];
    for (const [group, when] of passes) {
        for (const monster of group) {
            if (await monsterArrive(monster, when, state)) delivered++;
            else failed.push(monster);
            if (state.program_state.gameover) return delivered;
        }
    }
    // C prepends failed_arrivals, then migrates that list only after all
    // arrivals. An exact arrival must not retry as approximate in this visit.
    for (const monster of failed.reverse()) await sendMonsterToLimbo(monster, state);
    return delivered;
}

export function discardMigrations(state: GameState = game): void {
    // C dog.c discard_migrations(): entering the endgame discards monsters
    // scheduled for unreachable levels; the Wizard always stays queued.
    const queue = migrationQueue(state);
    state._migratingMonsters = queue.filter(monster =>
        monster.iswiz || In_endgame(monster.migrationDestination));
}
