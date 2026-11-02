// vault.js — Vault residence, guard lifecycle, escort, and exit accounting.
// C refs: vault.c — clear_fcorr(), blackout(), parkguard(), grddead(),
// in_fcorridor(), findgd(), uleftvault(), find_guard_dest(), gd_move(),
// invault(), move_gold(), vault_summon_gd(), paygd(), hidden_gold().

import { game, requireGameLevel, requireLiveGame, requireInitializedGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { VaultGuardData, Monster } from './monster_types.js';
import type { Position, Room, MapLocation } from './map_types.js';
import { isRoom } from './map_types.js';
import { getLine } from './query.js';
import { deleteEngravingAt } from './engrave.js';
import { bot } from './botl.js';
import { redrawMap, newsym, canSpotMonster, map_invisible, map_location, monsterVisible } from './display.js';
import { plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import { displayMessageWindow } from './tty_topline.js';
import { ROOM, ROOMOFFSET, DOOR, D_NODOOR, VAULT, IS_WALL, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, MM_NOMSG, M_AP_OBJECT, M_AP_TYPE, NEED_HTH_WEAPON, LEVEL_TIMER_KIND, RLOC_MSG, CORR, IS_OBSTRUCTED, IS_STWALL, STONE, Upolyd, isok, ACCESSIBLE, COLNO, COULD_SEE, GD_EATGOLD, IN_SIGHT, IS_POOL, IS_ROOM, MMOVE_DIED, MMOVE_MOVED, MMOVE_NOTHING, RLOC_ERR, RLOC_NOMSG, ROWNO, SCORR } from './const.js';
import { makemonAt, setMonsterMalign } from './makemon.js';
import { vision_note_blocker_change, cansee, couldsee, unset_seenv } from './vision.js';
import { setWallStateAt } from './wall_topology.js';
import { stopLevelTimer } from './timeout.js';
import { containedGold } from './shk.js';
import { heroGoldAmount } from './hero_gold.js';
import { resetHeroFaint } from './hunger.js';
import { heroIsDeaf, heroIsBlind } from './senses.js';
import { adjustHeroAlignment } from './alignment.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { stopHeroOccupation } from './occupation.js';
import { MONSTER_SOUND, monsterTypeName } from './monster_data.js';
import { monsterName } from './do_name.js';
import { monsterPossessive, monsterSubjectPronoun } from './mondata.js';
import { monsterWieldedWeapon, wieldMonsterWeapon } from './weapon.js';
import { BOULDER, GOLD_PIECE, ROCK, TIN_WHISTLE } from './object_data.js';
import { simpleObjectTypeName } from './objnam.js';
import { fractureRock } from './rock_breakage.js';
import { rn2 } from './rng.js';
import { formatSeenMessage, publishHeardMessage } from './hero_speech.js';
import { roomForRoomno, roomsAt } from './room.js';
import { angerMonster, removeMonsterFromGame, sendMonsterToLimbo } from './mon.js';
import { releaseMonsterInventory } from './steal.js';
import { monsterAtPosition, placeMonsterOnMap, removeMonsterFromMapAt } from './steed.js';
import { randomMonsterRelocation, moveMonsterNextToHero, teleportHero, askTeleportDestination } from './teleport.js';
import { deleteTrap } from './trap.js';
import { publishMonsterYelp } from './ambient_sounds.js';
import type { GameObject } from './object_types.js';
import type { MonsterCallLog, MonsterMovement } from './monster_action_types.js';
import { impossible } from './diagnostics.js';
import { placeObject, remove_object, stack_object } from './floor_object.js';
import { heroFormSticks } from './hero_species.js';
import { linkObjectToMonsterInventory, unlinkObject } from './mkobj.js';
import { deleteObject } from './shk.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { currency } from './currency.js';
import { freeInventoryObject } from './hero_inventory.js';
import { make_grave } from './mklev.js';
import type { MessagePublisher } from './pline.js';
const PM_GUARD = 272;
const VAULT_GUARD_TIME = 30;
const STRANGE_OBJECT = 0;

// C vault.c:vault_summon_gd(). The next world turn owns guard arrival.
export async function summonVaultGuardSoon(state: GameState = game) {
    const level = requireGameLevel(state);
    const inVault = (state.u.urooms || []).some((roomno) => {
        const room = level.rooms[roomno - ROOMOFFSET];
        return isRoom(room) && room.rtype === VAULT;
    });
    if (inVault && !await findVaultGuard(state)) state.u.uinvault = VAULT_GUARD_TIME - 1;
}

function vaultRoomAt(x: number, y: number, level: GameMap | null = game.level): Room | null {
    const roomno = roomsAt(level, x, y, VAULT)[0];
    return roomno === undefined ? null : roomForRoomno(level, roomno);
}

// C vault.c:invault().  Called once per world turn from allmain.c's
// once-per-turn maintenance: the countdown, guard construction, and the
// whole interrogation happen in this one call, before the turn decrements
// negative multi and before the engraving-wear roll that follows.
export async function invault(state: GameState = game) {
    requireLiveGame(state);
    const vault = vaultRoomAt(state.u?.ux, state.u?.uy, state.level);
    if (!vault) {
        if (state.u) state.u.uinvault = 0;
        return;
    }

    // After a couple of guards fail to come back from their trips to the
    // vault, later guards grow reluctant to turn up at all.
    const deaths = state.mvitals?.[PM_GUARD]?.died ?? 0;
    state.u.uinvault ??= 0;
    if (deaths < 2 || deaths < 50 && !rn2(deaths * deaths))
        state.u.uinvault = (state.u.uinvault || 0) + 1;
    if (state.u.uinvault < VAULT_GUARD_TIME
        || state.u.uinvault % (VAULT_GUARD_TIME / 2) !== 0)
        return;
    if (await findVaultGuard(state)) return;

    const destination = await guardDestination(state);
    if (!destination) return;
    const entry = guardEntryToward(destination);
    if (!entry) return;
    const original = requireGameLevel(state).at(entry.x, entry.y);
    if (!original) return;

    const guard = await makemonAt(PM_GUARD, entry.x, entry.y, MM_NOMSG);
    if (!guard) return;
    guard.isgd = 1;
    guard.mpeaceful = 1;
    setMonsterMalign(guard, state);
    const heroLevel = state.u.uz;
    if (!heroLevel) throw new Error('Vault guard arrival requires the hero dungeon location.');
    const corridor: VaultGuardData = {
        gdlevel: { ...heroLevel },
        gddone: 0,
        ogx: entry.x,
        ogy: entry.y,
        gdx: destination.x,
        gdy: destination.y,
        vault,
        warncnt: 0,
        fcbeg: 0,
        fcend: 0,
        fakecorr: [],
        dropgoldcnt: 0,
    };
    guard._egd = corridor;
    state.u.uinvault = (state.u.uinvault ?? 0) + 1;
    await resetHeroFaint({ state });
    const boulders = requireGameLevel(state).objects[entry.x]?.[entry.y]?.filter(object => object.otyp === BOULDER) ?? [];
    for (const boulder of boulders) await fractureRock(boulder, entry.x, entry.y, { state });
    if (boulders.length) {
        const description = `${boulders.length === 1 ? 'a boulder' : 'boulders'} shatter.`;
        if (heroIsBlind(state)) await publishHeardMessage(description, plineWithContinuation, state);
        else await plineWithContinuation(formatSeenMessage(description, state));
    }

    const spotted = canSpotMonster(guard);
    await plineWithContinuation(spotted ? "Suddenly one of the Vault's guards enters!" : 'Someone else has entered the Vault.');
    if (spotted) await newsym(guard.mx, guard.my);
    else await map_invisible(entry.x, entry.y);
    const deaf = heroIsDeaf(state), blind = heroIsBlind(state);
    const name = () => monsterName(guard, { state, capitalized: true, suppressIt: true });
    if (state.u.uswallow) {
        if (!deaf) await plineWithContinuation(`"What's going on here?"`);
        if (!spotted) await plineWithContinuation('The other presence vanishes.');
        await removeMonsterFromGame(guard);
        return;
    }
    if (M_AP_TYPE(state.u) === M_AP_OBJECT || state.u.uundetected) {
        if (!deaf && M_AP_TYPE(state.u) === M_AP_OBJECT && state.u.mappearance !== GOLD_PIECE) {
            const appearance = state.u.mappearance ?? STRANGE_OBJECT;
            const disguise = appearance === STRANGE_OBJECT
                ? 'whatcha-may-callit' : simpleObjectTypeName(appearance, state);
            await plineWithContinuation(`"Hey!  Who left that ${disguise} in here?"`);
        }
        await plineWithContinuation(`Puzzled, ${monsterSubjectPronoun(guard, { state })} turns around and leaves.`);
        await removeMonsterFromGame(guard);
        return;
    }
    if (state.u.strangled || (state.u.strangledTurns ?? 0) > 0
        || MONSTER_SOUND[state.u.umonnum ?? state.u.umonster ?? 260] === 0 || heroHasInvoluntaryDelay(state)) {
        await plineWithContinuation(deaf ? `${name()} huffs and turns to leave.`
            : `"I'll be back when you're ready to speak to me!"`);
        await removeMonsterFromGame(guard);
        return;
    }
    // C invault() follows stop_occupation() with `if (gm.multi > 0)
    // { nomul(0); unmul((char *) 0); }`, but that block is unreachable:
    // this tree's stop_occupation() (allmain.c) already calls nomul(0)
    // whenever there is an occupation or multi >= 0, zeroing a count
    // repeat.  stopHeroOccupation() models that reset, and native play
    // prints no recovery message before the name prompt.
    await stopHeroOccupation(state);
    await displayMessageWindow();
    const response = await readGuardName();
    const claimedName = lowercaseAscii(response);
    if (state.u.ualign?.type === 1 && !claimedName.startsWith(lowercaseAscii(state.plname)))
        adjustHeroAlignment(-1, state);
    if (['croesus', 'kroisos', 'creosote'].includes(claimedName)) {
        if (!(state.mvitals?.[286]?.died ?? 0)) {
            if (!deaf) await plineWithContinuation('"Oh, yes, of course.  Sorry to have disturbed you."');
            else if (!blind) await plineWithContinuation(`${name()} waves goodbye.`);
            await removeMonsterFromGame(guard);
        } else {
            await angerMonster(guard);
            if (!deaf) await plineWithContinuation(`"Back from the dead, are you?  I'll remedy that!"`);
            else if (!blind) await plineWithContinuation(`${name()} mouths something and looks very angry!`);
            if (!monsterWieldedWeapon(guard)) {
                guard.weaponCheck = NEED_HTH_WEAPON;
                await wieldMonsterWeapon(guard, state);
            }
        }
        return;
    }
    await plineWithContinuation(deaf ? `${name()} doesn't ${blind ? '' : 'appear to '}recognize you.` : `"I don't know you."`);
    const gold = heroGoldAmount(state);
    const stashedGold = hiddenGold(state, true);
    if (!gold && !stashedGold) {
        await plineWithContinuation(deaf ? `${name()} stomps${blind ? '' : ' and beckons'}.` : '"Please follow me."');
    } else {
        if (!gold) {
            if (!deaf) await plineWithContinuation('"You have hidden gold."');
            else if (!blind) await plineWithContinuation(`${name()} glares at you${state.inventory.length ? 'r stuff' : ''}.`);
        }
        if (!deaf) {
            await plineWithContinuation('"Most likely all your gold was stolen from this vault."');
            await plineWithContinuation('"Please drop that gold and follow me."');
        } else if (!blind) {
            const possessive = monsterPossessive(guard, { state, noIt: true });
            await plineWithContinuation(`${name()} holds out ${possessive} palm and beckons with ${monsterPossessive(guard, { state, noIt: true })} other hand.`);
        }
        corridor.dropgoldcnt++;
    }

    if (!IS_WALL(original.typ)) {
        const { lx, hx, ly, hy } = vault;
        const { x, y } = entry;
        if (x === lx - 1 && y === ly - 1) original.typ = TLCORNER;
        else if (x === hx + 1 && y === ly - 1) original.typ = TRCORNER;
        else if (x === lx - 1 && y === hy + 1) original.typ = BLCORNER;
        else if (x === hx + 1 && y === hy + 1) original.typ = BRCORNER;
        else if (y === ly - 1 || y === hy + 1) original.typ = HWALL;
        else if (x === lx - 1 || x === hx + 1) original.typ = VWALL;
        original.wall_info = 0;
        setWallStateAt(entry.x, entry.y);
        setVaultTerrainFlags(original, original.wall_info);
    }
    corridor.fakecorr.push({
        x: entry.x,
        y: entry.y,
        typ: original.typ,
        flags: original.wall_info,
    });
    corridor.fcend = 1;
    corridor.warncnt = 1;
    stopLevelTimer(entry.x, entry.y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    original.typ = DOOR;
    setVaultTerrainFlags(original, D_NODOOR);
    vision_note_blocker_change(entry.x, entry.y);
    game.vision_full_recalc = 1;
    // No C counterpart: vault.c:invault() never writes context.move, and
    // allmain.c:483 presets context.move = 1 after the once-per-turn block
    // and before the next rhack(), so in C nothing the interrogation could
    // write is ever read.  This port presets nothing; each command handler
    // records its own context.move (the cmd.c:3810-3826 result seam), and
    // every reader that could observe this square after the interrogation —
    // rhack's tail, dokick's maybe_kick_monster return (dokick.c:1380),
    // doopen's locked-door result, doloot's unlock — writes it first.  The
    // zero is shadowed before any reader: removing it replays every
    // vault-guard holdout session and a per-keystroke battery taken right
    // after the dialog identically.  Retained, do not grow new readers of
    // the post-interrogation value.
    game.context.move = 0;
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
    if (x === game.u.ux && y === game.u.uy) {
        const horizontalEntry = (x: number, y: number) => [HWALL, DOOR].includes(level.requireAt(x, y).typ);
        const verticalEntry = (x: number, y: number) => [VWALL, DOOR].includes(level.requireAt(x, y).typ);
        if (horizontalEntry(x + 1, y)) x++;
        else if (horizontalEntry(x - 1, y)) x--;
        else if (verticalEntry(x, y + 1)) y++;
        else if (verticalEntry(x, y - 1)) y--;
        else return null;
    }
    return { x, y };
}

async function readGuardName() {
    const prompt = heroIsDeaf(game) ? 'You are required to supply your name. -'
        : '"Hello stranger, who are you?" -';
    for (let tries = 5; tries > 0; tries--) {
        const response = await getLine(prompt, (_character, key) => key >= 32 && key !== 127);
        // C mungspaces() trims and collapses ordinary spaces only.
        const name = response?.replace(/^ +| +$/g, '').replace(/ +/g, ' ') ?? '\x1b';
        if (name) return name;
    }
    return '';
}

// C strcmpi()/strncmpi() preserve characters outside ASCII A-Z.
function lowercaseAscii(name: string): string {
    return name.replace(/[A-Z]/g, character => character.toLowerCase());
}

// C vault.c:clear_fcorr(), blackout(), parkguard(), and grddead().
export interface VaultGuard extends Monster {
    _egd: VaultGuardData;
}

export function requireVaultGuard(guard: Monster): asserts guard is VaultGuard {
    if (!guard._egd) throw new TypeError('Vault guard has no corridor state.');
}

// C rm.h overlays these fields on rm.flags. Vault repairs must restore
// every alias so the restored terrain uses the saved flags.
export function setVaultTerrainFlags(location: MapLocation, flags: number): void {
    location.flags = flags;
    location.doormask = flags;
    location.wall_info = flags;
    location.altarmask = flags;
    location.ladder = flags;
    location.drawbridgemask = flags;
    location.looted = flags;
    location.icedpool = flags;
    location.emptygrave = flags !== 0;
}

function corridorPoint(corridor: VaultGuardData, index: number) {
    const point = corridor.fakecorr[index];
    if (!point) throw new RangeError(`Vault corridor has no square at index ${index}.`);
    return point;
}

function corridorLocation(level: GameMap, x: number, y: number) {
    const location = level.at(x, y);
    if (!location) throw new RangeError(`Vault corridor square (${x}, ${y}) is outside the map.`);
    return location;
}

// C vault.c:in_fcorridor().
export function inVaultCorridor(guard: Monster, x: number, y: number) {
    requireVaultGuard(guard);
    const corridor = guard._egd;
    for (let index = corridor.fcbeg; index < corridor.fcend; index++) {
        const point = corridorPoint(corridor, index);
        if (point.x === x && point.y === y) return true;
    }
    return false;
}

// C vault.c:clear_fcorr().
export async function clearVaultCorridor(guard: Monster, force = false, state: GameState = game) {
    requireLiveGame(state);
    requireVaultGuard(guard);
    const heroLevel = state.u.uz;
    if (!heroLevel) throw new Error('Vault corridor cleanup requires the hero dungeon location.');
    const level = requireGameLevel(state);
    const corridor = guard._egd;
    if (corridor.gdlevel.dnum !== heroLevel.dnum || corridor.gdlevel.dlevel !== heroLevel.dlevel)
        return true;
    const silently = !!state.program_state?.stopprint;
    let sawCorridor = false;

    while (corridor.fcbeg < corridor.fcend) {
        const point = corridorPoint(corridor, corridor.fcbeg);
        if ((guard.mhp <= 0 || !inVaultCorridor(guard, state.u.ux, state.u.uy)) && corridor.gddone)
            force = true;
        const ball = state.uball || state.u.uball;
        if (
            (point.x === state.u.ux && point.y === state.u.uy && guard.mhp > 0) ||
            (!force && couldsee(point.x, point.y)) ||
            (ball && ball.where !== 'inventory' && ball.ox === point.x && ball.oy === point.y)
        )
            return false;

        const occupant = monsterAtPosition(level, point.x, point.y);
        if (occupant) {
            if (occupant.isgd) return false;
            if (occupant.mtame) await publishMonsterYelp(occupant);
            if (!await randomMonsterRelocation(occupant, { state, flags: RLOC_MSG }))
                await sendMonsterToLimbo(occupant, state);
        }
        const location = corridorLocation(level, point.x, point.y);
        if (location.typ === CORR && cansee(point.x, point.y)) sawCorridor = true;
        location.typ = point.typ;
        setVaultTerrainFlags(location, point.flags);
        if (IS_STWALL(location.typ)) {
            const trap = level.traps.find(
                (candidate) => candidate.tx === point.x && candidate.ty === point.y,
            );
            if (trap) deleteTrap(trap, state);
            if (location.typ === STONE) blackout(point.x, point.y, state);
        }
        deleteEngravingAt(point.x, point.y, level);
        await map_location(point.x, point.y, true);
        vision_note_blocker_change(point.x, point.y);
        state.vision_full_recalc = 1;
        corridor.fcbeg++;
    }
    if (sawCorridor && !silently) await plineWithContinuation('The corridor disappears.');
    const hp = (Upolyd(state.u) ? state.u.mh : state.u.uhp) ?? 0;
    if (IS_OBSTRUCTED(corridorLocation(level, state.u.ux, state.u.uy).typ) && hp > 0 && !silently)
        await plineWithContinuation('You are encased in rock.');
    return true;
}

function blackout(x: number, y: number, state: GameState) {
    const level = requireGameLevel(state);
    for (let nx = x - 1; nx <= x + 1; nx++) {
        for (let ny = y - 1; ny <= y + 1; ny++) {
            if (!isok(nx, ny)) continue;
            const location = corridorLocation(level, nx, ny);
            if (location.typ === STONE) location.lit = location.waslit = false;
            unset_seenv(location, x, y, nx, ny);
        }
    }
}

// C vault.c:parkguard().
export async function parkVaultGuard(guard: Monster, state: GameState = game) {
    requireLiveGame(state);
    requireVaultGuard(guard);
    const polearm = state.context.polearm;
    if (polearm?.hitmonId === guard.m_id) polearm.hitmonId = null;
    const x = guard.mx,
        y = guard.my;
    if (x) {
        removeMonsterFromMapAt(x, y, state);
        await newsym(x, y);
    }
    if (monsterAtPosition(requireGameLevel(state), 0, 0, state) !== guard)
        await placeMonsterOnMap(guard, 0, 0, state);
    guard._egd.ogx = guard._egd.ogy = 0;
}

export async function prepareVaultGuardDeath(guard: Monster, state: GameState = game) {
    requireLiveGame(state);
    let dispose = await clearVaultCorridor(guard, true, state);
    if (!dispose) {
        await releaseMonsterInventory(guard, state, { show: false });
        guard.mhp = 0;
        await parkVaultGuard(guard, state);
        dispose = await clearVaultCorridor(guard, true, state);
    }
    if (dispose) guard.isgd = 0;
    return dispose;
}

// C vault.c:findgd(). Parked guards still own their unfinished corridor.
export async function findVaultGuard(state: GameState = game): Promise<VaultGuard | null> {
    requireLiveGame(state);
    const heroLevel = state.u.uz;
    if (!heroLevel) throw new Error('Finding a vault guard requires the hero dungeon location.');
    const level = requireGameLevel(state);
    const belongsHere = (monster: Monster): monster is VaultGuard => {
        if (!monster.isgd) return false;
        requireVaultGuard(monster);
        return (
            monster._egd.gdlevel.dnum === heroLevel.dnum &&
            monster._egd.gdlevel.dlevel === heroLevel.dlevel
        );
    };
    const guard = [...level.monsters].reverse().find(belongsHere);
    if (guard) {
        if (!guard.mx && !guard._egd.gddone) guard.mhp = guard.mhpmax;
        return guard;
    }
    const migrants = state._migratingMonsters || [];
    const returning = [...migrants].reverse().find(belongsHere);
    if (!returning) return null;
    migrants.splice(migrants.indexOf(returning), 1);
    level.monsters.push(returning);
    returning.mtrack = [];
    returning.mux = state.u.ux;
    returning.muy = state.u.uy;
    returning.mx = returning.my = 0;
    await parkVaultGuard(returning, state);
    return returning;
}

// C vault.c:gd_move(), its escort helpers, and find_guard_dest().
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
                await restoreEntry(guard, oldx, oldy, state);
                return null;
            }
            if (!heroHasInvoluntaryDelay(state)) egd.warncnt++;
            return result();
        }
        if (!heroInVault) {
            if (carryingGold) {
                await randomMonsterRelocation(guard, { state, flags: RLOC_MSG, random });
                await restoreEntry(guard, oldx, oldy, state);
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
            await pline(`${guardDisplayName(guard, state)}, confused, disappears.`);
            return result(await finishEscort(guard, semiDead, true, state));
        }
        if (carryingGold && (inVaultCorridor(guard, state.u.ux, state.u.uy) || heroInVault)) {
            const firstWarning = egd.warncnt < 6;
            if (firstWarning) egd.warncnt = 6;
            if (!heroIsDeaf(state)) await pline(firstWarning ? '"Drop all your gold, scoundrel!"' : '"So be it, rogue!"');
            else if (!heroIsBlind(state)) {
                const pronoun = monsterPossessive(guard, { state, noIt: true });
                await pline(firstWarning ? `${guardDisplayName(guard, state)} holds out ${pronoun} palm demandingly!`
                    : `${guardDisplayName(guard, state)} rubs ${pronoun} hands with enraged delight!`);
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
                    setVaultTerrainFlags(cell, D_NODOOR);
                    deleteEngravingAt(x, y, level);
                    vision_note_blocker_change(x, y);
                    if (cansee(x, y)) await newsym(x, y);
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
        if (cansee(x, y)) await newsym(x, y);
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
        await placeMonsterOnMap(guard, x, y);
        if (goldAt(x, y, state)) {
            await pickGoldAtGuard(guard, state);
            if (canSpotMonster(guard)) await pline(`${monsterName(guard, { state, capitalized: true })} picks up some gold.`);
        } else await newsym(x, y);
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

function guardDisplayName(guard: Monster, state: GameState) {
    return monsterName(guard, { state, capitalized: true, suppressIt: true });
}

async function restoreEntry(guard: VaultGuard, x: number, y: number, state: GameState) {
    const entry = guard._egd.fakecorr[0];
    if (!entry) throw new Error('A vault guard cannot restore its missing entry.');
    const cell = requireGameLevel(state).requireAt(x, y);
    cell.typ = entry.typ;
    setVaultTerrainFlags(cell, entry.flags);
    vision_note_blocker_change(x, y);
    deleteEngravingAt(x, y, requireGameLevel(state));
    await newsym(x, y);
}

async function restoreFakeCorridor(guard: VaultGuard, state: GameState) {
    if (await clearVaultCorridor(guard, false, state)) {
        guard.isgd = 0;
        await removeMonsterFromGame(guard);
    }
}

async function finishEscort(guard: VaultGuard, semiDead: boolean, alreadyAnnounced: boolean, state: GameState) {
    const x = guard.mx, y = guard.my, spotted = canSpotMonster(guard);
    await parkVaultGuard(guard, state);
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
    if (!cansee(guard.mx, guard.my) || !monsterVisible(guard)) {
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
    if (!await randomMonsterRelocation(occupant, { state, flags: RLOC_ERR | RLOC_MSG, random })
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
            setVaultTerrainFlags(cell, 0);
            return { x: nx, y: ny, typ };
        }
        const ex = nx + nx - x, ey = ny + ny - y;
        if (isok(ex, ey) && IS_ROOM(level.requireAt(ex, ey).typ)) {
            cell.typ = DOOR;
            setVaultTerrainFlags(cell, D_NODOOR);
            deleteEngravingAt(ex, ey, level);
            return { x: nx, y: ny, typ };
        }
        if (dy && nx !== x) { nx = x; ny = y + dy; continue; }
        if (dx && ny !== y) { ny = y; nx = x + dx; dy = 0; continue; }
        cell.typ = IS_ROOM(typ) ? DOOR : CORR;
        setVaultTerrainFlags(cell, 0);
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
    if (cansee(guard.mx, guard.my)) await newsym(guard.mx, guard.my);
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
                await placeMonsterOnMap(guard, best.x, best.y);
                await newsym(oldx, oldy);
                await newsym(best.x, best.y);
            }
        }
        unlinkObject(gold, state);
        await linkObjectToMonsterInventory(guard, gold, { state });
        await newsym(x, y);
    } else {
        if (x !== oldx || y !== oldy) {
            await moveMonsterAside(guard, x, y, state, random);
            if (seen) {
                await placeMonsterOnMap(guard, x, y);
                await newsym(oldx, oldy);
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
        await placeMonsterOnMap(guard, oldx, oldy);
        await newsym(x, y);
        await newsym(oldx, oldy);
    }
}

// C vault.c:move_gold(). Guard-cleaned gold lands inside the vault.
async function moveGoldIntoVault(gold: GameObject, guard: VaultGuard, state: GameState, random: (limit: number) => number) {
    const vault = guard._egd.vault;
    if (!vault) throw new Error('An appointed vault guard must have an assigned vault');
    const oldx = gold.ox, oldy = gold.oy;
    remove_object(gold, state);
    await newsym(oldx, oldy);
    const x = vault.lx + random(2), y = vault.ly + random(2);
    await placeObject(gold, x, y, state);
    await stack_object(gold, state);
    await newsym(x, y);
}

export async function wallifyVault(guard: VaultGuard, state: GameState, random: (limit: number) => number = rn2) {
    const level = requireGameLevel(state), vault = guard._egd.vault;
    if (!vault) throw new Error('An appointed vault guard must have an assigned vault');
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
                if (!await randomMonsterRelocation(occupant, { state, flags: RLOC_MSG, random }))
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
            cell.wall_info = 0;
            setWallStateAt(x, y);
            setVaultTerrainFlags(cell, cell.wall_info);
            deleteEngravingAt(x, y, level);
            const row = state.viz_array?.[y], oldVision = row?.[x] ?? 0;
            if (row) row[x] = IN_SIGHT | COULD_SEE;
            await newsym(x, y);
            if (row) row[x] = oldVision;
            vision_note_blocker_change(x, y);
            fixed = true;
        }
    }
    if (!movedGold && !fixed) return;
    if (inVaultCorridor(guard, guard.mx, guard.my) || cansee(guard.mx, guard.my))
        await pline(`${guardDisplayName(guard, state)} whispers an incantation.`);
    else await publishHeardMessage('a distant chant.', pline, state);
    if (movedGold) await pline('A mysterious force moves the gold into the vault.');
    if (fixed) await pline("The damaged vault's walls are magically restored!");
}

// C vault.c:paygd(). Only openly carried coins can be reclaimed by a guard.
const COIN_CLASS = 12;

export async function payVaultGuardOnExit({
    silent = false, publish = plineWithContinuation, random = rn2,
}: { silent?: boolean; publish?: MessagePublisher; random?: typeof rn2 } = {}): Promise<void> {
    const state = requireInitializedGame();
    const guard = await findVaultGuard(state);
    const amount = heroGoldAmount(state);
    if (!amount || !guard) return;

    let x: number, y: number;
    if (state.u.uinvault) {
        if (!silent)
            await publish(`Your ${amount} ${currency(amount, { state, random })} goes into the Magic Memory Vault.`);
        x = state.u.ux;
        y = state.u.uy;
    } else {
        if (guard.mpeaceful) {
            await removeMonsterFromGame(guard);
            return;
        }
        await moveMonsterNextToHero(guard, state, { flags: RLOC_NOMSG, random });
        if (!silent)
            await publish(`${monsterName(guard, { state, capitalized: true })} remits your gold to the vault.`);
        const vault = guard._egd.vault;
        if (!vault) throw new Error('An appointed vault guard must have an assigned vault');
        x = vault.lx + random(2);
        y = vault.ly + random(2);
        const role = monsterTypeName(state.u.umonster, !!state.flags.female);
        make_grave(x, y, `To Croesus: here's the gold recovered from ${state.plname} the ${role}.`);
    }

    for (const coins of [...state.inventory]) {
        if (coins.oclass !== COIN_CLASS) continue;
        await freeInventoryObject(coins, state);
        await placeObject(coins, x, y, state);
        await stack_object(coins, state);
    }
    await removeMonsterFromGame(guard);
}

// C vault.c:hidden_gold(): gold hidden inside containers, plus the
// money_cnt() + hidden_gold() composition botl.c uses.
export function hiddenGold(state: Pick<GameState, 'inventory'>, evenIfUnknown = true): number {
    let total = 0;
    for (const object of state?.inventory || []) {
        if (!Array.isArray(object.contents)
            || (!evenIfUnknown && !object.cknown)) continue;
        total += containedGold(object, evenIfUnknown);
    }
    return total;
}

export function carriedGold(state: Pick<GameState, 'inventory'>, evenIfUnknown = true): number {
    return heroGoldAmount(state) + hiddenGold(state, evenIfUnknown);
}
