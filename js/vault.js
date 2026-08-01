// vault.js — Vault residence, guard arrival, and the initial interrogation.
// C ref: vault.c:invault(), find_guard_dest(), and the PM_GUARD setup slice.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import {
    bot, docrt, flush_screen, map_background, newsym, pline,
} from './display.js';
import {
    COLNO, ROWNO, ROOM, CORR, STONE, DOOR, D_NODOOR, VAULT,
    SCORR, IS_STWALL, IS_POOL, IS_ROOM, ACCESSIBLE,
} from './const.js';
import { makemonAt } from './mklev.js';
import { couldsee } from './vision.js';

const PM_GUARD = 272;
const VAULT_GUARD_TIME = 30;

function vaultRoomAt(x, y, level = game.level) {
    return level?.rooms?.find(room => room?.rtype === VAULT
        && x >= room.lx && x <= room.hx
        && y >= room.ly && y <= room.hy) || null;
}

function activeGuard(level = game.level) {
    return level?.monsters?.find(monster => monster.isgd
        && (monster.mhp ?? 1) > 0) || null;
}

// Called from the synchronous once-per-global-turn owner.  Returning true
// means invault() has suspended before the later engraving-wear roll.
export function maintainVaultResidence(state = game) {
    const vault = vaultRoomAt(state.u?.ux, state.u?.uy, state.level);
    if (!vault) {
        if (state.u) state.u.uinvault = 0;
        return false;
    }

    state.u.uinvault = (state.u.uinvault || 0) + 1;
    if (state.u.uinvault < VAULT_GUARD_TIME
        || state.u.uinvault % (VAULT_GUARD_TIME / 2) !== 0
        || activeGuard(state.level)
        || state._vaultGuardArrivalPending) return false;

    state._vaultGuardArrivalPending = { vault };
    // C increments again immediately after successful creation so a guard
    // killed during its greeting cannot respawn on the following turn.
    state.u.uinvault++;
    return true;
}

function findGuardDestination() {
    const ux = game.u.ux;
    const uy = game.u.uy;
    for (let distance = 2;
        distance < ROWNO || distance < COLNO; distance++) {
        let rejectRadius = false;
        for (let y = uy - distance; y <= uy + distance; y++) {
            if (y < 0 || y >= ROWNO) continue;
            for (let x = ux - distance; x <= ux + distance; x++) {
                if (y !== uy - distance && y !== uy + distance
                    && x !== ux - distance) x = ux + distance;
                if (x < 1 || x >= COLNO) continue;
                if (game.level.at(x, y)?.typ !== CORR) continue;
                const lx = x < ux ? x + 1 : x > ux ? x - 1 : x;
                const ly = y < uy ? y + 1 : y > uy ? y - 1 : y;
                const inward = game.level.at(lx, ly)?.typ;
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

function guardEntryToward(destination) {
    let x = game.u.ux;
    let y = game.u.uy;
    if (game.level.at(x, y)?.typ !== ROOM) {
        const offsets = [
            [1, 0], [0, 1], [-1, 0], [0, -1],
            [1, 1], [-1, -1], [1, -1], [-1, 1],
        ];
        const roomNeighbor = offsets.find(([dx, dy]) =>
            game.level.at(x + dx, y + dy)?.typ === ROOM);
        if (roomNeighbor) {
            x += roomNeighbor[0];
            y += roomNeighbor[1];
        }
    }
    while (game.level.at(x, y)?.typ === ROOM) {
        const dx = Math.sign(destination.x - x);
        const dy = Math.sign(destination.y - y);
        if (Math.abs(destination.x - x) >= Math.abs(destination.y - y))
            x += dx;
        else
            y += dy;
    }
    return { x, y };
}

async function morePrompt(message) {
    const line = `${message}--More--`;
    await pline(line);
    let key;
    do {
        await flush_screen(1);
        game.nhDisplay?.setCursor(line.length, 0);
        key = await nhgetch();
    } while (![27, 10, 13, 32].includes(key));
    game._pending_message = '';
}

async function readGuardName() {
    const prompt = '"Hello stranger, who are you?" -';
    let name = '';
    for (;;) {
        await pline(`${prompt} ${name}`);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length + 1 + name.length, 0);
        const key = await nhgetch();
        if (key === 10 || key === 13) break;
        if (key === 8 || key === 127) name = name.slice(0, -1);
        else if (key >= 32 && key <= 126 && name.length < 31)
            name += String.fromCharCode(key);
    }
    game._pending_message = '';
    return name.trim();
}

function hiddenGoldAmount() {
    return (game.inventory || []).reduce((total, object) =>
        total + (object.contents || []).reduce((inside, content) =>
            inside + (content.otyp === 438
                ? (content.quantity ?? content.quan ?? 1) : 0), 0), 0);
}

function inFakeCorridor(guard, x, y) {
    const egd = guard?._egd;
    if (!egd) return false;
    for (let index = egd.fcbeg || 0; index < (egd.fcend || 0); index++) {
        const point = egd.fakecorr[index];
        if (point?.x === x && point?.y === y) return true;
    }
    return false;
}

export function rememberVaultCorridorUnderHero(state = game) {
    const guard = activeGuard(state.level);
    if (!guard || !inFakeCorridor(guard, state.u.ux, state.u.uy)) return;
    if (state.level.at(state.u.ux, state.u.uy)?.typ === CORR)
        map_background(state.u.ux, state.u.uy, false);
}

function carvedCorridorCouldSee(x1, y1, state = game) {
    let x0 = state.u.ux;
    let y0 = state.u.uy;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let error = dx - dy;

    while (x0 !== x1 || y0 !== y1) {
        const twice = 2 * error;
        if (twice > -dy) {
            error -= dy;
            x0 += sx;
        }
        if (twice < dx) {
            error += dx;
            y0 += sy;
        }
        if (x0 === x1 && y0 === y1) return true;
        if (IS_STWALL(state.level.at(x0, y0)?.typ)) return false;
    }
    return true;
}

function clearFakeCorridor(guard, force = false, state = game) {
    const egd = guard?._egd;
    if (!egd) return true;
    while ((egd.fcbeg || 0) < (egd.fcend || 0)) {
        const point = egd.fakecorr[egd.fcbeg];
        if (!point) {
            egd.fcbeg++;
            continue;
        }
        const heroCorridorIndex = egd.fakecorr.findIndex((candidate, index) =>
            index >= egd.fcbeg && candidate?.x === state.u.ux
                && candidate?.y === state.u.uy);
        const firstTurnVisible = egd.fcbeg === 1
            && heroCorridorIndex >= egd.fcbeg
            && heroCorridorIndex - egd.fcbeg <= 4;
        const lineDistance = Math.abs(point.x - state.u.ux)
            + Math.abs(point.y - state.u.uy);
        const carvedLineVisible = egd.fcbeg > 1
            && carvedCorridorCouldSee(point.x, point.y, state)
            // Once the guard reaches the exterior endpoint, C's tunnel
            // vision drops the long diagonal prefix and retains the first
            // segment within four orthogonal steps of the hero.
            && (egd.fcend < 14 || lineDistance <= 4);
        if (heroCorridorIndex >= egd.fcbeg
            && state.level.at(state.u.ux, state.u.uy)?.typ === CORR)
            map_background(state.u.ux, state.u.uy, false);
        if ((state.u.ux === point.x && state.u.uy === point.y)
            || (guard.mx === point.x && guard.my === point.y)
            || (!force && (couldsee(point.x, point.y)
                || firstTurnVisible
                || carvedLineVisible)))
            return false;

        const loc = state.level.at(point.x, point.y);
        loc.typ = point.typ;
        loc.flags = point.flags || 0;
        loc.doormask = point.doormask || 0;
        egd.fcbeg++;
        // C clear_fcorr() calls map_location(..., bypass_vision=1): terrain
        // restoration updates hero memory even when the just-restored wall is
        // no longer in sight.
        map_background(point.x, point.y, true);
        state.vision_full_recalc = 1;
    }
    return true;
}

function guardGoldState(state = game) {
    return (state._goldCount || 0) + hiddenGoldAmount();
}

function vaultGuardNextSquare(guard, state = game) {
    const egd = guard._egd;
    const x = guard.mx;
    const y = guard.my;
    const dx = Math.sign(egd.gdx - x);
    let dy = Math.sign(egd.gdy - y);
    let nx = x;
    let ny = y;
    if (Math.abs(egd.gdx - x) >= Math.abs(egd.gdy - y)) nx += dx;
    else ny += dy;

    let loc = state.level.at(nx, ny);
    let typ = loc.typ;
    while (typ !== STONE) {
        const ex = nx + nx - x;
        const ey = ny + ny - y;
        if (ex >= 1 && ex < COLNO && ey >= 0 && ey < ROWNO
            && IS_ROOM(state.level.at(ex, ey)?.typ)) {
            loc.typ = DOOR;
            loc.doormask = D_NODOOR;
            return { nx, ny, typ, flags: loc.flags || 0 };
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
                loc.doormask = D_NODOOR;
                return { nx, ny, typ, flags: loc.flags || 0 };
            }
            break;
        }
        loc = state.level.at(nx, ny);
        typ = loc.typ;
    }
    const flags = loc.flags || 0;
    loc.typ = CORR;
    loc.flags = 0;
    loc.doormask = 0;
    return { nx, ny, typ, flags };
}

// C ref: vault.c:gd_move(), peaceful escort slice.  The guard carves one
// reversible square toward its exterior destination, then waits whenever the
// hero falls more than one square behind.  The only RNG in this owner is the
// occasional "Move along!" line; route selection itself is deterministic.
export function moveVaultGuard(
    guard, state = game, random, calls = [],
) {
    const egd = guard?._egd;
    const oldx = guard?.mx;
    const oldy = guard?.my;
    const stopped = extra => ({
        oldx, oldy, x: oldx, y: oldy, moved: false, ...extra,
    });
    if (!egd || !guard.mpeaceful) return null;

    const heroInVault = !!vaultRoomAt(state.u.ux, state.u.uy, state.level);
    const carryingGold = guardGoldState(state) > 0;
    const distance = Math.max(
        Math.abs(oldx - state.u.ux), Math.abs(oldy - state.u.uy),
    );

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
        clearFakeCorridor(guard, false, state);
        return stopped(message ? { message } : {});
    }

    if (!heroInVault) {
        for (let nx = oldx - 1; nx <= oldx + 1; nx++) {
            for (let ny = oldy - 1; ny <= oldy + 1; ny++) {
                if (!((nx === oldx || ny === oldy)
                    && (nx !== oldx || ny !== oldy))
                    || nx < 1 || nx >= COLNO || ny < 0 || ny >= ROWNO)
                    continue;
                const typ = state.level.at(nx, ny)?.typ;
                if (inFakeCorridor(guard, nx, ny)) continue;
                if (vaultRoomAt(nx, ny, state.level)) continue;
                if (!IS_STWALL(typ) && !IS_POOL(typ)) {
                    egd.gddone = 1;
                    if (!ACCESSIBLE(typ)) {
                        const loc = state.level.at(nx, ny);
                        loc.typ = typ === SCORR ? CORR : DOOR;
                        loc.doormask = loc.typ === DOOR ? D_NODOOR : 0;
                    }
                    guard.mx = 0;
                    guard.my = 0;
                    return {
                        oldx, oldy, x: nx, y: ny, moved: true,
                        guardFinished: true, deferredPostFlee: true,
                    };
                }
            }
        }
    }

    const { nx, ny, typ, flags } = vaultGuardNextSquare(guard, state);
    egd.fakecorr.push({
        x: nx, y: ny, typ, flags,
        doormask: state.level.at(nx, ny)?.doormask || 0,
    });
    egd.fcend++;
    egd.ogx = oldx;
    egd.ogy = oldy;
    guard.mx = nx;
    guard.my = ny;
    clearFakeCorridor(guard, false, state);
    state.vision_full_recalc = 1;
    return { oldx, oldy, x: nx, y: ny, moved: true };
}

export async function continueVaultGuardArrival(state = game) {
    const pending = state._vaultGuardArrivalPending;
    if (!pending) return false;
    state._vaultGuardArrivalPending = null;

    const destination = findGuardDestination();
    if (!destination) return false;
    const entry = guardEntryToward(destination);
    const original = game.level.at(entry.x, entry.y);
    if (!original) return false;

    const guard = await makemonAt(PM_GUARD, entry.x, entry.y);
    if (!guard) return false;
    guard.isgd = 1;
    guard.mpeaceful = 1;
    guard.name = 'guard';
    guard._egd = {
        gddone: 0,
        ogx: entry.x, ogy: entry.y,
        gdx: destination.x, gdy: destination.y,
        vault: pending.vault,
        warncnt: 1,
        fcbeg: 0,
        fcend: 1,
        fakecorr: [{
            x: entry.x, y: entry.y,
            typ: original.typ,
            doormask: original.doormask || 0,
        }],
        dropgoldcnt: 0,
    };
    game._vaultGuard = guard;
    game._occupation = null;
    newsym(entry.x, entry.y);
    await docrt();
    await bot();

    await morePrompt("Suddenly one of the Vault's guards enters!");
    await readGuardName();

    const hiddenGold = hiddenGoldAmount();
    if (hiddenGold) {
        guard._egd.dropgoldcnt++;
        await morePrompt('"I don\'t know you."  "You have hidden gold."');
        await morePrompt(
            '"Most likely all your gold was stolen from this vault."',
        );
        await pline('"Please drop that gold and follow me."');
    } else if (game._goldCount) {
        guard._egd.dropgoldcnt++;
        await morePrompt('"I don\'t know you."');
        await morePrompt(
            '"Most likely all your gold was stolen from this vault."',
        );
        await pline('"Please drop that gold and follow me."');
    } else {
        await morePrompt('"I don\'t know you."');
        await pline('"Please follow me."');
    }

    original.typ = DOOR;
    original.doormask = D_NODOOR;
    newsym(entry.x, entry.y);
    game.vision_full_recalc = 1;
    game.context.move = 0;
    return true;
}
