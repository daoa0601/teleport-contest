// vault.js — Vault residence, guard arrival, and the initial interrogation.
// C ref: vault.c:invault(), find_guard_dest(), and the PM_GUARD setup slice.

import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { Monster, VaultGuardData } from './monster_types.js';
import type { MonsterCallLog, MonsterMovement } from './monster_action_types.js';
import type { Position, Room } from './map_types.js';
import { isRoom } from './map_types.js';
import { getLine } from './query.js';
import { deleteEngravingAt } from './engrave.js';
import { bot, redrawMap, flush_screen, newsym, pline, plineWithContinuation, displayMessageWindow } from './display.js';
import {
    COLNO,
    ROWNO,
    ROOM,
    ROOMOFFSET,
    CORR,
    STONE,
    DOOR,
    D_NODOOR,
    VAULT,
    SCORR,
    IS_STWALL,
    IS_POOL,
    IS_ROOM,
    IS_WALL,
    ACCESSIBLE,
    HWALL,
    VWALL,
    TLCORNER,
    TRCORNER,
    BLCORNER,
    BRCORNER,
    MM_NOMSG,
    MMOVE_NOTHING,
    MMOVE_MOVED,
    MMOVE_DIED,
    GD_EATGOLD,
} from './const.js';
import { makemonAt } from './mklev.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { setWallStateAt } from './wall_topology.js';
import { LEVEL_TIMER_KIND, stopLevelTimer } from './object_timers.js';
import {
    clearVaultCorridor,
    findVaultGuard,
    inVaultCorridor,
    requireVaultGuard,
} from './vault_guard.js';
import { hiddenGold } from './gold.js';
import { heroGoldAmount } from './hero_gold.js';
import { resetHeroFaint } from './hunger.js';
import { heroIsDeaf } from './senses.js';

const PM_GUARD = 272;
const VAULT_GUARD_TIME = 30;

// C vault.c:vault_summon_gd(). The next world turn owns guard arrival.
export function summonVaultGuardSoon(state: GameState = game) {
    const level = requireGameLevel(state);
    const inVault = (state.u.urooms || []).some((roomno) => {
        const room = level.rooms[roomno - ROOMOFFSET];
        return isRoom(room) && room.rtype === VAULT;
    });
    if (inVault && !findVaultGuard(state)) state.u.uinvault = VAULT_GUARD_TIME - 1;
}

function vaultRoomAt(x: number, y: number, level: GameMap | null = game.level): Room | null {
    return (
        level?.rooms?.find(
            (room): room is Room =>
                isRoom(room) &&
                room.rtype === VAULT &&
                x >= room.lx &&
                x <= room.hx &&
                y >= room.ly &&
                y <= room.hy,
        ) || null
    );
}

// Called from the synchronous once-per-global-turn owner.  Returning true
// means invault() has suspended before the later engraving-wear roll.
export function maintainVaultResidence(state: GameState = game) {
    requireLiveGame(state);
    const vault = vaultRoomAt(state.u?.ux, state.u?.uy, state.level);
    if (!vault) {
        if (state.u) state.u.uinvault = 0;
        return false;
    }

    state.u.uinvault = (state.u.uinvault || 0) + 1;
    if (
        state.u.uinvault < VAULT_GUARD_TIME ||
        state.u.uinvault % (VAULT_GUARD_TIME / 2) !== 0 ||
        findVaultGuard(state) ||
        state._vaultGuardArrivalPending
    )
        return false;

    state._vaultGuardArrivalPending = { vault };
    // C increments again immediately after successful creation so a guard
    // killed during its greeting cannot respawn on the following turn.
    state.u.uinvault++;
    return true;
}

function findGuardDestination() {
    const level = requireGameLevel();
    const ux = game.u.ux;
    const uy = game.u.uy;
    for (let distance = 2; distance < ROWNO || distance < COLNO; distance++) {
        let rejectRadius = false;
        for (let y = uy - distance; y <= uy + distance; y++) {
            if (y < 0 || y >= ROWNO) continue;
            for (let x = ux - distance; x <= ux + distance; x++) {
                if (y !== uy - distance && y !== uy + distance && x !== ux - distance)
                    x = ux + distance;
                if (x < 1 || x >= COLNO) continue;
                if (level.at(x, y)?.typ !== CORR) continue;
                const lx = x < ux ? x + 1 : x > ux ? x - 1 : x;
                const ly = y < uy ? y + 1 : y > uy ? y - 1 : y;
                const inward = level.at(lx, ly)?.typ;
                if (inward !== STONE && inward !== CORR) {
                    rejectRadius = true;
                    break;
                }
                return { x, y };
            }
            if (rejectRadius) break;
        }
    }
    return null;
}

function guardEntryToward(destination: Position) {
    const level = requireGameLevel();
    let x = game.u.ux;
    let y = game.u.uy;
    if (level.at(x, y)?.typ !== ROOM) {
        const offsets = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
            [1, 1],
            [-1, -1],
            [1, -1],
            [-1, 1],
        ] as const;
        const roomNeighbor = offsets.find(([dx, dy]) => level.at(x + dx, y + dy)?.typ === ROOM);
        if (roomNeighbor) {
            x += roomNeighbor[0];
            y += roomNeighbor[1];
        }
    }
    while (level.at(x, y)?.typ === ROOM) {
        const dx = Math.sign(destination.x - x);
        const dy = Math.sign(destination.y - y);
        if (Math.abs(destination.x - x) >= Math.abs(destination.y - y)) x += dx;
        else y += dy;
    }
    return { x, y };
}

async function morePrompt(message: string) {
    await plineWithContinuation(message);
    await displayMessageWindow();
}

async function readGuardName() {
    const prompt = heroIsDeaf(game) ? 'You are required to supply your name. -'
        : '"Hello stranger, who are you?" -';
    for (let tries = 5; tries > 0; tries--) {
        const response = await getLine(prompt, (_character, key) => key >= 32 && key !== 127);
        const name = response?.trim().replace(/\s+/g, ' ') ?? '\x1b';
        if (name) return name;
    }
    return '';
}

function guardGoldState(state: GameState = game) {
    return heroGoldAmount(state) + hiddenGold(state, true);
}

function guardLocation(level: GameMap, x: number, y: number) {
    const location = level.at(x, y);
    if (!location) throw new RangeError(`Vault guard square (${x}, ${y}) is outside the map.`);
    return location;
}

function vaultGuardNextSquare(guard: Monster, state: GameState = game) {
    requireVaultGuard(guard);
    const level = requireGameLevel(state);
    const egd = guard._egd;
    const x = guard.mx;
    const y = guard.my;
    const dx = Math.sign(egd.gdx - x);
    let dy = Math.sign(egd.gdy - y);
    let nx = x;
    let ny = y;
    if (Math.abs(egd.gdx - x) >= Math.abs(egd.gdy - y)) nx += dx;
    else ny += dy;

    let loc = guardLocation(level, nx, ny);
    let typ = loc.typ;
    while (typ !== STONE) {
        const ex = nx + nx - x;
        const ey = ny + ny - y;
        if (
            ex >= 1 &&
            ex < COLNO &&
            ey >= 0 &&
            ey < ROWNO &&
            IS_ROOM(guardLocation(level, ex, ey).typ)
        ) {
            loc.typ = DOOR;
            loc.flags = loc.wall_info = loc.doormask = D_NODOOR;
            deleteEngravingAt(ex, ey, level);
            return { nx, ny, typ, flags: 0 };
        }
        if (dy && nx !== x) {
            nx = x;
            ny = y + dy;
        } else if (dx && ny !== y) {
            ny = y;
            nx = x + dx;
            dy = 0;
        } else {
            if (IS_ROOM(typ)) {
                loc.typ = DOOR;
                loc.flags = loc.wall_info = loc.doormask = D_NODOOR;
                deleteEngravingAt(ex, ey, level);
                return { nx, ny, typ, flags: 0 };
            }
            break;
        }
        loc = guardLocation(level, nx, ny);
        typ = loc.typ;
    }
    loc.typ = CORR;
    loc.flags = loc.wall_info = loc.doormask = 0;
    return { nx, ny, typ, flags: 0 };
}

// C ref: vault.c:gd_move(), peaceful escort slice.  The guard carves one
// reversible square toward its exterior destination, then waits whenever the
// hero falls more than one square behind.  The only RNG in this owner is the
// occasional "Move along!" line; route selection itself is deterministic.
export async function moveVaultGuard(
    guard: Monster,
    state: GameState = game,
    random: (limit: number) => number,
    calls: Pick<MonsterCallLog, 'push'> = [],
): Promise<MonsterMovement | null> {
    requireLiveGame(state);
    const egd = guard?._egd;
    const oldx = guard.mx;
    const oldy = guard.my;
    const stopped = (message?: string): MonsterMovement => ({
        oldx,
        oldy,
        x: oldx,
        y: oldy,
        moved: false,
        postMoveStatus: MMOVE_NOTHING,
        movementStage: 'postmov',
        ...(message ? { message } : {}),
    });
    if (!egd || !guard.mpeaceful) return null;
    const heroLevel = state.u.uz;
    if (!heroLevel) throw new Error('Vault guard movement requires the hero dungeon location.');
    const level = requireGameLevel(state);

    if (
        egd.witness &&
        guard.mx &&
        guard.mhp > 0 &&
        !egd.gddone &&
        egd.gdlevel.dnum === heroLevel.dnum &&
        egd.gdlevel.dlevel === heroLevel.dlevel &&
        Math.abs(egd.ogx - guard.mx) <= 1 &&
        Math.abs(egd.ogy - guard.my) <= 1
    ) {
        if (!heroIsDeaf(state))
            await pline(
                `"How dare you ${egd.witness & GD_EATGOLD ? 'consume' : 'destroy'} that gold, scoundrel!"`,
            );
        egd.witness = 0;
        guard.mpeaceful = 0;
        // C returns -1 so ordinary hostile monster movement takes over.
        return null;
    }

    const heroInVault = !!vaultRoomAt(state.u.ux, state.u.uy, state.level);
    const carryingGold = guardGoldState(state) > 0;
    const distance = Math.max(Math.abs(oldx - state.u.ux), Math.abs(oldy - state.u.uy));

    if (egd.fcend === 1 && heroInVault && (carryingGold || distance > 1)) {
        egd.warncnt = (egd.warncnt || 0) + 1;
        return stopped();
    }

    if (distance > 1 || egd.gddone) {
        let message = null;
        if (!egd.gddone) {
            const roll = random(10);
            calls.push('rn2(10)');
            if (roll === 0 && !state.deaf) message = '"Move along!"';
        }
        await clearVaultCorridor(guard, false, state);
        return stopped(message ?? undefined);
    }

    if (!heroInVault) {
        for (let nx = oldx - 1; nx <= oldx + 1; nx++) {
            for (let ny = oldy - 1; ny <= oldy + 1; ny++) {
                if (
                    !((nx === oldx || ny === oldy) && (nx !== oldx || ny !== oldy)) ||
                    nx < 1 ||
                    nx >= COLNO ||
                    ny < 0 ||
                    ny >= ROWNO
                )
                    continue;
                const location = guardLocation(level, nx, ny);
                const typ = location.typ;
                if (inVaultCorridor(guard, nx, ny)) continue;
                if (vaultRoomAt(nx, ny, state.level)) continue;
                if (!IS_STWALL(typ) && !IS_POOL(typ)) {
                    egd.gddone = 1;
                    if (!ACCESSIBLE(typ)) {
                        location.typ = typ === SCORR ? CORR : DOOR;
                        location.doormask = location.typ === DOOR ? D_NODOOR : 0;
                    }
                    guard.mx = 0;
                    guard.my = 0;
                    return {
                        oldx,
                        oldy,
                        x: nx,
                        y: ny,
                        moved: true,
                        guardFinished: true,
                        postMoveStatus: MMOVE_DIED,
                        movementStage: 'dochug',
                    };
                }
            }
        }
    }

    const { nx, ny, typ, flags } = vaultGuardNextSquare(guard, state);
    vision_note_blocker_change(nx, ny);
    if (cansee(nx, ny)) newsym(nx, ny);
    egd.fakecorr.push({ x: nx, y: ny, typ, flags });
    egd.fcend++;
    egd.ogx = oldx;
    egd.ogy = oldy;
    guard.mx = nx;
    guard.my = ny;
    await clearVaultCorridor(guard, false, state);
    state.vision_full_recalc = 1;
    return {
        oldx,
        oldy,
        x: nx,
        y: ny,
        moved: true,
        postMoveStatus: MMOVE_MOVED,
        movementStage: 'postmov',
    };
}

export async function continueVaultGuardArrival(state: GameState = game) {
    requireLiveGame(state);
    const pending = state._vaultGuardArrivalPending;
    if (!pending) return false;
    state._vaultGuardArrivalPending = null;

    const destination = findGuardDestination();
    if (!destination) return false;
    const entry = guardEntryToward(destination);
    const original = requireGameLevel(state).at(entry.x, entry.y);
    if (!original) return false;

    const guard = await makemonAt(PM_GUARD, entry.x, entry.y, MM_NOMSG);
    if (!guard) return false;
    guard.isgd = 1;
    guard.mpeaceful = 1;
    const heroLevel = state.u.uz;
    if (!heroLevel) throw new Error('Vault guard arrival requires the hero dungeon location.');
    const corridor: VaultGuardData = {
        gdlevel: { ...heroLevel },
        gddone: 0,
        ogx: entry.x,
        ogy: entry.y,
        gdx: destination.x,
        gdy: destination.y,
        vault: pending.vault,
        warncnt: 1,
        fcbeg: 0,
        fcend: 0,
        fakecorr: [],
        dropgoldcnt: 0,
    };
    guard._egd = corridor;
    await resetHeroFaint({ state });
    game._occupation = null;
    newsym(entry.x, entry.y);
    await redrawMap();
    await bot();

    await morePrompt("Suddenly one of the Vault's guards enters!");
    await readGuardName();

    await plineWithContinuation('"I don\'t know you."');
    const gold = heroGoldAmount(game);
    const stashedGold = hiddenGold(game, true);
    if (!gold && !stashedGold) {
        await plineWithContinuation('"Please follow me."');
    } else {
        if (!gold) await plineWithContinuation('"You have hidden gold."');
        await plineWithContinuation('"Most likely all your gold was stolen from this vault."');
        await plineWithContinuation('"Please drop that gold and follow me."');
        corridor.dropgoldcnt++;
    }

    if (!IS_WALL(original.typ)) {
        const { lx, hx, ly, hy } = pending.vault;
        const { x, y } = entry;
        if (x === lx - 1 && y === ly - 1) original.typ = TLCORNER;
        else if (x === hx + 1 && y === ly - 1) original.typ = TRCORNER;
        else if (x === lx - 1 && y === hy + 1) original.typ = BLCORNER;
        else if (x === hx + 1 && y === hy + 1) original.typ = BRCORNER;
        else if (y === ly - 1 || y === hy + 1) original.typ = HWALL;
        else if (x === lx - 1 || x === hx + 1) original.typ = VWALL;
        original.wall_info = 0;
        setWallStateAt(entry.x, entry.y);
    }
    corridor.fakecorr.push({
        x: entry.x,
        y: entry.y,
        typ: original.typ,
        flags: original.wall_info,
    });
    corridor.fcend = 1;
    stopLevelTimer(entry.x, entry.y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    original.typ = DOOR;
    original.flags = original.wall_info = original.doormask = D_NODOOR;
    vision_note_blocker_change(entry.x, entry.y);
    newsym(entry.x, entry.y);
    game.vision_full_recalc = 1;
    game.context.move = 0;
    return true;
}
