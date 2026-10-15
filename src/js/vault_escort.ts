// C vault.c:gd_move(), its escort helpers, and find_guard_dest().
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MonsterCallLog, MonsterMovement } from './monster_action_types.js';
import {
    ACCESSIBLE, BLCORNER, BRCORNER, COLNO, COULD_SEE, CORR, DOOR, D_NODOOR,
    GD_EATGOLD, HWALL, IN_SIGHT, IS_POOL, IS_ROOM, IS_STWALL, IS_WALL,
    MMOVE_DIED, MMOVE_MOVED, MMOVE_NOTHING, RLOC_ERR, RLOC_MSG, RLOC_NOMSG,
    ROWNO, SCORR, STONE, TLCORNER, TRCORNER, VAULT, VWALL, isok,
} from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation as pline } from './display.js';
import { impossible } from './diagnostics.js';
import { deleteEngravingAt } from './engrave.js';
import { placeObject, remove_object, stack_object } from './floor_object.js';
import { carriedGold } from './gold.js';
import { heroGoldAmount } from './hero_gold.js';
import { heroFormSticks } from './hero_species.js';
import { heroHasInvoluntaryDelay } from './command_state.js';
import { publishHeardMessage } from './hero_speech.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { publishMonsterYelp } from './monster_anger.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { sendMonsterToLimbo } from './monster_migration.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import { BOULDER, GOLD_PIECE, ROCK, TIN_WHISTLE } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { roomsAt } from './room.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { moveMonsterNextToHero, randomMonsterRelocation, teleportHero } from './teleport.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { deleteTrap } from './trap_lifecycle.js';
import { clearVaultCorridor, inVaultCorridor, parkVaultGuard, requireVaultGuard } from './vault_guard.js';
import type { VaultGuard } from './vault_guard.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { setWallStateAt } from './wall_topology.js';
import { askTeleportDestination } from './cmd.js';

export function findGuardDestination(state: GameState = game, guard: Monster | null = null) {
    const level = requireGameLevel(state);
    const ux = state.u.ux;
    const uy = state.u.uy;
    for (let distance = 2; distance < ROWNO || distance < COLNO; distance++) {
        let rejectRadius = false;
        for (let y = uy - distance; y <= uy + distance; y++) {
            if (y < 0 || y >= ROWNO) continue;
            for (let x = ux - distance; x <= ux + distance; x++) {
                if (y !== uy - distance && y !== uy + distance && x !== ux - distance)
                    x = ux + distance;
                if (x < 1 || x >= COLNO) continue;
                if (guard && (x === guard.mx && y === guard.my || inVaultCorridor(guard, x, y))) continue;
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

export async function moveVaultGuard(
    guard: Monster, state: GameState = game,
    random: (limit: number) => number,
    calls: Pick<MonsterCallLog, 'push'> = [],
): Promise<MonsterMovement | null> {
    requireLiveGame(state);
    requireVaultGuard(guard);
    const egd = guard._egd, level = requireGameLevel(state);
    const oldx = guard.mx, oldy = guard.my;
    const result = (status = MMOVE_NOTHING): MonsterMovement => ({
        oldx, oldy, x: guard.mx, y: guard.my,
        moved: guard.mx !== oldx || guard.my !== oldy,
        postMoveStatus: status, movementStage: 'postmov',
    });
    if (egd.gdlevel.dnum !== state.u.uz?.dnum || egd.gdlevel.dlevel !== state.u.uz.dlevel)
        return null;
    const semiDead = guard.mhp <= 0;
    if (semiDead || !guard.mx || egd.gddone) {
        egd.gddone = 1;
        return result(await finishEscort(guard, semiDead, false, state));
    }

    const heroInVault = roomsAt(level, state.u.ux, state.u.uy, VAULT).length > 0;
    const guardInVault = roomsAt(level, guard.mx, guard.my, VAULT).length > 0;
    if (!heroInVault && !guardInVault) await wallifyVault(guard, state, random);
    if (!guard.mpeaceful) {
        if (!heroInVault && (guardInVault
            || inVaultCorridor(guard, guard.mx, guard.my) && !inVaultCorridor(guard, state.u.ux, state.u.uy))) {
            await randomMonsterRelocation(guard, { state, flags: RLOC_MSG, random });
            await wallifyVault(guard, state, random);
            if (!inVaultCorridor(guard, guard.mx, guard.my)) await clearVaultCorridor(guard, true, state);
            await letHeroKnow(guard, state);
        } else if (!inVaultCorridor(guard, guard.mx, guard.my)) await clearVaultCorridor(guard, true, state);
        return null;
    }
    if (Math.abs(egd.ogx - guard.mx) > 1 || Math.abs(egd.ogy - guard.my) > 1) return null;
    if (egd.witness) {
        if (!heroIsDeaf(state))
            await pline(`"How dare you ${egd.witness & GD_EATGOLD ? 'consume' : 'destroy'} that gold, scoundrel!"`);
        egd.witness = 0;
        guard.mpeaceful = 0;
        return null;
    }

    const carryingGold = carriedGold(state) > 0;
    const distant = Math.max(Math.abs(guard.mx - state.u.ux), Math.abs(guard.my - state.u.uy)) > 1;
    if (egd.fcend === 1) {
        if (heroInVault && (carryingGold || distant)) {
            if (egd.warncnt === 3 && !heroIsDeaf(state)) {
                const order = `${carryingGold ? heroGoldAmount(state) ? 'drop that gold and ' : 'drop that hidden gold and ' : ''}follow me!`;
                await pline(`"${egd.dropgoldcnt || !carryingGold ? 'I repeat, ' + order : order.charAt(0).toUpperCase() + order.slice(1)}"`);
                if (carryingGold) egd.dropgoldcnt++;
            }
            if (egd.warncnt === 7) {
                if (!heroIsDeaf(state)) await pline('"You\'ve been warned, knave!"');
                guard.mpeaceful = 0;
                await moveMonsterNextToHero(guard, state, { flags: RLOC_NOMSG, random });
                restoreEntry(guard, oldx, oldy, state);
                return null;
            }
            if (!heroHasInvoluntaryDelay(state)) egd.warncnt++;
            return result();
        }
        if (!heroInVault) {
            if (carryingGold) {
                await randomMonsterRelocation(guard, { state, flags: RLOC_MSG, random });
                restoreEntry(guard, oldx, oldy, state);
                guard.mpeaceful = 0;
                await letHeroKnow(guard, state);
                return null;
            }
            if (!heroIsDeaf(state)) await pline('"Well, begone."');
            egd.gddone = 1;
            return result(await finishEscort(guard, semiDead, false, state));
        }
    }
    if (egd.fcend > 1) {
        const entry = egd.fakecorr[0];
        if (!entry) throw new Error('A vault escort corridor has no entry.');
        if (egd.fcend > 2 && inVaultCorridor(guard, guard.mx, guard.my)
            && !inVaultCorridor(guard, state.u.ux, state.u.uy)
            && level.requireAt(entry.x, entry.y).typ === entry.typ) {
            await pline(`${guardName(guard, state)}, confused, disappears.`);
            return result(await finishEscort(guard, semiDead, true, state));
        }
        if (carryingGold && (inVaultCorridor(guard, state.u.ux, state.u.uy) || heroInVault)) {
            const firstWarning = egd.warncnt < 6;
            if (firstWarning) egd.warncnt = 6;
            if (!heroIsDeaf(state)) await pline(firstWarning ? '"Drop all your gold, scoundrel!"' : '"So be it, rogue!"');
            else if (!heroIsBlind(state)) {
                const pronoun = monsterPossessive(guard, { state, noIt: true });
                await pline(firstWarning ? `${guardName(guard, state)} holds out ${pronoun} palm demandingly!`
                    : `${guardName(guard, state)} rubs ${pronoun} hands with enraged delight!`);
            }
            if (firstWarning) return result();
            guard.mpeaceful = 0;
            return null;
        }
    }
    for (const point of egd.fakecorr.slice(egd.fcbeg, egd.fcend)) {
        if (!goldAt(point.x, point.y, state)) continue;
        await pickCorridorGold(guard, point.x, point.y, state, random);
        if (!guard.mpeaceful) return null;
        egd.warncnt = 5;
        return result();
    }
    if (distant) {
        calls.push('rn2(10)');
        if (!random(10) && !heroIsDeaf(state) && !state.u.uswallow
            && !(state.u.ustuck && !heroFormSticks(state))) await pline('"Move along!"');
        await restoreFakeCorridor(guard, state);
        return result();
    }
    if (!heroInVault) {
        for (let x = oldx - 1; x <= oldx + 1; x++) {
            for (let y = oldy - 1; y <= oldy + 1; y++) {
                if (!(x === oldx || y === oldy) || x === oldx && y === oldy || !isok(x, y)) continue;
                const cell = level.requireAt(x, y), typ = cell.typ;
                if (IS_STWALL(typ) || IS_POOL(typ) || inVaultCorridor(guard, x, y)
                    || roomsAt(level, x, y, VAULT).length) continue;
                egd.gddone = 1;
                if (!ACCESSIBLE(typ)) {
                    cell.typ = typ === SCORR ? CORR : DOOR;
                    cell.flags = cell.doormask = cell.wall_info = D_NODOOR;
                    deleteEngravingAt(x, y, level);
                    vision_note_blocker_change(x, y);
                    if (cansee(x, y)) newsym(x, y);
                    appendCorridor(guard, x, y, typ, cell.flags);
                }
                await moveMonsterAside(guard, x, y, state, random);
                return result(await finishEscort(guard, semiDead, false, state));
            }
        }
    }

    for (;;) {
        const target = nextCorridorSquare(guard, state);
        const { x, y, typ } = target;
        const cell = level.requireAt(x, y);
        vision_note_blocker_change(x, y);
        if (cansee(x, y)) newsym(x, y);
        if (x === egd.gdx && y === egd.gdy && guard.mx === egd.gdx && guard.my === egd.gdy) {
            const destination = await guardDestination(state, guard);
            if (!destination || destination.x === egd.gdx && destination.y === egd.gdy) {
                await pline(`${monsterName(guard, { state, capitalized: true })}, confused, disappears.`);
                return result(await finishEscort(guard, semiDead, true, state));
            }
            egd.gdx = destination.x;
            egd.gdy = destination.y;
            continue;
        }
        appendCorridor(guard, x, y, typ, cell.flags);
        await moveMonsterAside(guard, x, y, state, random);
        egd.ogx = guard.mx;
        egd.ogy = guard.my;
        placeMonsterAt(guard, x, y);
        if (goldAt(x, y, state)) {
            await pickGoldAtGuard(guard, state);
            if (canSpotMonster(guard)) await pline(`${monsterName(guard, { state, capitalized: true })} picks up some gold.`);
        } else newsym(x, y);
        await restoreFakeCorridor(guard, state);
        return result(MMOVE_MOVED);
    }
}

export async function guardDestination(state: GameState, guard: Monster | null = null) {
    const destination = findGuardDestination(state, guard);
    if (!destination) {
        await impossible('Not a single corridor on this level?', { state });
        await teleportHero({ chooseDestination: askTeleportDestination });
    }
    return destination;
}

// C uleftvault(): warn before the destination's room-entry feedback.
export async function noticeVaultEscape(guard: VaultGuard, state: GameState): Promise<void> {
    if (guard.mhp <= 0 || !guard.isgd) {
        await impossible('escaping vault without guard?', { state });
        return;
    }
    if (!carriedGold(state)
        || Math.max(Math.abs(guard.mx - state.u.ux), Math.abs(guard.my - state.u.uy)) <= 1) return;
    if (guard.mpeaceful) {
        if (canSpotMonster(guard)) await pline(`${monsterName(guard, { state, capitalized: true })} becomes irate.`);
        guard.mpeaceful = 0;
    }
    if (!inVaultCorridor(guard, state.u.ux, state.u.uy)) await moveVaultGuard(guard, state, rn2);
}

function guardName(guard: Monster, state: GameState) {
    return monsterName(guard, { state, capitalized: true, suppressIt: true });
}

function restoreEntry(guard: VaultGuard, x: number, y: number, state: GameState) {
    const entry = guard._egd.fakecorr[0];
    if (!entry) throw new Error('A vault guard cannot restore its missing entry.');
    const cell = requireGameLevel(state).requireAt(x, y);
    cell.typ = entry.typ;
    cell.flags = cell.wall_info = cell.doormask = entry.flags;
    vision_note_blocker_change(x, y);
    deleteEngravingAt(x, y, requireGameLevel(state));
    newsym(x, y);
}

async function restoreFakeCorridor(guard: VaultGuard, state: GameState) {
    if (await clearVaultCorridor(guard, false, state)) {
        guard.isgd = 0;
        await removeMonsterFromGame(guard);
    }
}

async function finishEscort(guard: VaultGuard, semiDead: boolean, alreadyAnnounced: boolean, state: GameState) {
    const x = guard.mx, y = guard.my, spotted = canSpotMonster(guard);
    parkVaultGuard(guard, state);
    await wallifyVault(guard, state);
    await restoreFakeCorridor(guard, state);
    if (!semiDead && (inVaultCorridor(guard, state.u.ux, state.u.uy) || cansee(x, y))) {
        if (!alreadyAnnounced && spotted)
            await pline(`Suddenly, ${monsterName(guard, { state, suppressIt: true })} disappears.`);
        return MMOVE_MOVED;
    }
    return MMOVE_DIED;
}

async function letHeroKnow(guard: Monster, state: GameState) {
    if (!canSeeMonster(guard)) {
        await publishHeardMessage(guard.minvent?.some(object => object.otyp === TIN_WHISTLE)
            ? "the shrill sound of a guard's whistle." : 'angry shouting.', pline, state);
    } else {
        const name = monsterName(guard, { state, article: 'a', adjective: 'angry' });
        const distant = Math.max(Math.abs(guard.mx - state.u.ux), Math.abs(guard.my - state.u.uy)) > 2;
        await pline(distant ? `You see ${name} approaching.` : `You are confronted by ${name}.`);
    }
}

async function moveMonsterAside(guard: Monster, x: number, y: number, state: GameState, random: (limit: number) => number) {
    const occupant = monsterAtPosition(requireGameLevel(state), x, y);
    if (!occupant || occupant === guard) return;
    if (!heroIsDeaf(state)) await pline('"Out of my way, scum!"');
    if (!(await randomMonsterRelocation(occupant, { state, flags: RLOC_ERR | RLOC_MSG, random }))
        || monsterAtPosition(requireGameLevel(state), x, y))
        await sendMonsterToLimbo(occupant, state);
    vision_note_blocker_change(x, y);
}

function appendCorridor(guard: VaultGuard, x: number, y: number, typ: number, flags: number) {
    const egd = guard._egd;
    if (egd.fcend >= ROWNO + COLNO) throw new Error('Vault fake corridor overflow.');
    egd.fakecorr[egd.fcend++] = { x, y, typ, flags };
}

function nextCorridorSquare(guard: VaultGuard, state: GameState) {
    const level = requireGameLevel(state), egd = guard._egd;
    const x = guard.mx, y = guard.my;
    const dx = Math.sign(egd.gdx - x);
    let dy = Math.sign(egd.gdy - y);
    let nx = x, ny = y;
    if (Math.abs(egd.gdx - x) >= Math.abs(egd.gdy - y)) nx += dx;
    else ny += dy;
    for (;;) {
        const cell = level.requireAt(nx, ny), typ = cell.typ;
        if (typ === STONE) {
            cell.typ = CORR;
            cell.flags = cell.wall_info = cell.doormask = 0;
            return { x: nx, y: ny, typ };
        }
        const ex = nx + nx - x, ey = ny + ny - y;
        if (isok(ex, ey) && IS_ROOM(level.requireAt(ex, ey).typ)) {
            cell.typ = DOOR;
            cell.flags = cell.wall_info = cell.doormask = D_NODOOR;
            deleteEngravingAt(ex, ey, level);
            return { x: nx, y: ny, typ };
        }
        if (dy && nx !== x) { nx = x; ny = y + dy; continue; }
        if (dx && ny !== y) { ny = y; nx = x + dx; dy = 0; continue; }
        cell.typ = IS_ROOM(typ) ? DOOR : CORR;
        cell.flags = cell.wall_info = cell.doormask = 0;
        if (IS_ROOM(typ)) deleteEngravingAt(ex, ey, level);
        return { x: nx, y: ny, typ };
    }
}

function goldAt(x: number, y: number, state: GameState): GameObject | undefined {
    return requireGameLevel(state).objects[x]?.[y]?.find(object => object.otyp === GOLD_PIECE);
}

async function pickGoldAtGuard(guard: Monster, state: GameState) {
    const gold = goldAt(guard.mx, guard.my, state);
    if (!gold) return;
    unlinkObject(gold, state);
    await linkObjectToMonsterInventory(guard, gold, { state });
    if (cansee(guard.mx, guard.my)) newsym(guard.mx, guard.my);
}

async function pickCorridorGold(guard: VaultGuard, x: number, y: number, state: GameState, random: (limit: number) => number) {
    const oldx = guard.mx, oldy = guard.my, seen = cansee(x, y);
    const underHero = x === state.u.ux && y === state.u.uy;
    if (underHero) {
        const gold = goldAt(x, y, state);
        if (!gold) {
            await impossible("vault guard: no gold at hero's feet?", { state });
            return;
        }
        const distance = (px: number, py: number) => (px - state.u.ux) ** 2 + (py - state.u.uy) ** 2;
        if (distance(oldx, oldy) > 2 && seen) {
            let best = { x: oldx, y: oldy };
            for (let attempt = 0; attempt < 10; attempt++) {
                const point = findNearbyMonsterPosition(guard.mnum, x, y, { state, random });
                if (!point) continue;
                if (distance(point.x, point.y) < distance(best.x, best.y)
                    || distance(point.x, point.y) === distance(best.x, best.y)
                    && (point.x - oldx) ** 2 + (point.y - oldy) ** 2 < (best.x - oldx) ** 2 + (best.y - oldy) ** 2)
                    best = point;
            }
            if (distance(best.x, best.y) < distance(oldx, oldy)) {
                placeMonsterAt(guard, best.x, best.y);
                newsym(oldx, oldy);
                newsym(best.x, best.y);
            }
        }
        unlinkObject(gold, state);
        await linkObjectToMonsterInventory(guard, gold, { state });
        newsym(x, y);
    } else {
        if (x !== oldx || y !== oldy) {
            await moveMonsterAside(guard, x, y, state, random);
            if (seen) {
                placeMonsterAt(guard, x, y);
                newsym(oldx, oldy);
            }
        }
        await pickGoldAtGuard(guard, state);
    }
    if (seen) {
        const name = monsterName(guard, { state, capitalized: true, augmentIt: true });
        await pline(`${name}${guard.mpeaceful && guard._egd.warncnt > 5 ? ' calms down and' : ''} picks up the gold${underHero ? ' from beneath you' : ''}.`);
    }
    if (guard.mx !== oldx || guard.my !== oldy) {
        const x = guard.mx, y = guard.my;
        placeMonsterAt(guard, oldx, oldy);
        newsym(x, y);
        newsym(oldx, oldy);
    }
}

async function moveGoldIntoVault(gold: GameObject, guard: VaultGuard, state: GameState, random: (limit: number) => number) {
    const oldx = gold.ox, oldy = gold.oy;
    remove_object(gold, state);
    newsym(oldx, oldy);
    const x = guard._egd.vault.lx + random(2), y = guard._egd.vault.ly + random(2);
    await placeObject(gold, x, y, state);
    await stack_object(gold, state);
    newsym(x, y);
}

export async function wallifyVault(guard: VaultGuard, state: GameState, random: (limit: number) => number = rn2) {
    const level = requireGameLevel(state), vault = guard._egd.vault;
    const left = vault.lx - 1, right = vault.hx + 1, top = vault.ly - 1, bottom = vault.hy + 1;
    let fixed = false, movedGold = false;
    for (let x = left; x <= right; x++) {
        for (let y = top; y <= bottom; y++) {
            if (x !== left && x !== right && y !== top && y !== bottom) continue;
            const cell = level.requireAt(x, y);
            const pile = level.objects[x]?.[y] ?? [];
            if (inVaultCorridor(guard, x, y)
                || IS_WALL(cell.typ) && !pile.some(object => [GOLD_PIECE, ROCK, BOULDER].includes(object.otyp))) continue;
            const occupant = monsterAtPosition(level, x, y);
            if (occupant && occupant !== guard) {
                if (occupant.mtame) await publishMonsterYelp(occupant);
                if (!(await randomMonsterRelocation(occupant, { state, flags: RLOC_MSG, random })))
                    await sendMonsterToLimbo(occupant, state);
            }
            const gold = goldAt(x, y, state);
            if (gold) {
                await moveGoldIntoVault(gold, guard, state, random);
                movedGold = true;
            }
            for (const rock of [...pile]) if (rock.otyp === ROCK || rock.otyp === BOULDER) await deleteObject(rock, state);
            const trap = level.traps.find(trap => trap.tx === x && trap.ty === y);
            if (trap) deleteTrap(trap, state);
            cell.typ = x === left ? y === top ? TLCORNER : y === bottom ? BLCORNER : VWALL
                : x === right ? y === top ? TRCORNER : y === bottom ? BRCORNER : VWALL : HWALL;
            cell.wall_info = cell.flags = cell.doormask = 0;
            setWallStateAt(x, y);
            deleteEngravingAt(x, y, level);
            const row = state.viz_array?.[y], oldVision = row?.[x] ?? 0;
            if (row) row[x] = IN_SIGHT | COULD_SEE;
            newsym(x, y);
            if (row) row[x] = oldVision;
            vision_note_blocker_change(x, y);
            fixed = true;
        }
    }
    if (!movedGold && !fixed) return;
    if (inVaultCorridor(guard, guard.mx, guard.my) || cansee(guard.mx, guard.my))
        await pline(`${guardName(guard, state)} whispers an incantation.`);
    else await publishHeardMessage('a distant chant.', pline, state);
    if (movedGold) await pline('A mysterious force moves the gold into the vault.');
    if (fixed) await pline("The damaged vault's walls are magically restored!");
}
