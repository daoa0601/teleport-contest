// C vault.c:clear_fcorr(), blackout(), parkguard(), and grddead().
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { RLOC_MSG, CORR, IS_OBSTRUCTED, IS_STWALL, STONE, Upolyd, isok } from './const.js';
import { map_location, newsym, plineWithContinuation } from './display.js';
import { deleteEngravingAt } from './engrave.js';
import { publishMonsterYelp } from './monster_anger.js';
import { releaseMonsterInventory } from './monster_drop.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { sendMonsterToLimbo } from './monster_migration.js';
import { randomMonsterRelocation } from './teleport.js';
import { deleteTrap } from './trap_lifecycle.js';
import { cansee, couldsee, unset_seenv, vision_note_blocker_change } from './vision.js';
export function requireVaultGuard(guard) {
    if (!guard._egd)
        throw new TypeError('Vault guard has no corridor state.');
}
function corridorPoint(corridor, index) {
    const point = corridor.fakecorr[index];
    if (!point)
        throw new RangeError(`Vault corridor has no square at index ${index}.`);
    return point;
}
function corridorLocation(level, x, y) {
    const location = level.at(x, y);
    if (!location)
        throw new RangeError(`Vault corridor square (${x}, ${y}) is outside the map.`);
    return location;
}
export function inVaultCorridor(guard, x, y) {
    requireVaultGuard(guard);
    const corridor = guard._egd;
    for (let index = corridor.fcbeg; index < corridor.fcend; index++) {
        const point = corridorPoint(corridor, index);
        if (point.x === x && point.y === y)
            return true;
    }
    return false;
}
export async function clearVaultCorridor(guard, force = false, state = game) {
    requireLiveGame(state);
    requireVaultGuard(guard);
    const heroLevel = state.u.uz;
    if (!heroLevel)
        throw new Error('Vault corridor cleanup requires the hero dungeon location.');
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
        if ((point.x === state.u.ux && point.y === state.u.uy && guard.mhp > 0) ||
            (!force && couldsee(point.x, point.y)) ||
            (ball && ball.where !== 'inventory' && ball.ox === point.x && ball.oy === point.y))
            return false;
        const occupant = monsterAtPosition(level, point.x, point.y);
        if (occupant) {
            if (occupant.isgd)
                return false;
            if (occupant.mtame)
                await publishMonsterYelp(occupant);
            if (!(await randomMonsterRelocation(occupant, { state, flags: RLOC_MSG })))
                await sendMonsterToLimbo(occupant, state);
        }
        const location = corridorLocation(level, point.x, point.y);
        if (location.typ === CORR && cansee(point.x, point.y))
            sawCorridor = true;
        location.typ = point.typ;
        location.flags = location.doormask = location.wall_info = point.flags;
        if (IS_STWALL(location.typ)) {
            const trap = level.traps.find((candidate) => candidate.tx === point.x && candidate.ty === point.y);
            if (trap)
                deleteTrap(trap, state);
            if (location.typ === STONE)
                blackout(point.x, point.y, state);
        }
        deleteEngravingAt(point.x, point.y, level);
        map_location(point.x, point.y, true);
        vision_note_blocker_change(point.x, point.y);
        state.vision_full_recalc = 1;
        corridor.fcbeg++;
    }
    if (sawCorridor && !silently)
        await plineWithContinuation('The corridor disappears.');
    const hp = (Upolyd(state.u) ? state.u.mh : state.u.uhp) ?? 0;
    if (IS_OBSTRUCTED(corridorLocation(level, state.u.ux, state.u.uy).typ) && hp > 0 && !silently)
        await plineWithContinuation('You are encased in rock.');
    return true;
}
function blackout(x, y, state) {
    const level = requireGameLevel(state);
    for (let nx = x - 1; nx <= x + 1; nx++) {
        for (let ny = y - 1; ny <= y + 1; ny++) {
            if (!isok(nx, ny))
                continue;
            const location = corridorLocation(level, nx, ny);
            if (location.typ === STONE)
                location.lit = location.waslit = false;
            unset_seenv(location, x, y, nx, ny);
        }
    }
}
export function parkVaultGuard(guard, state = game) {
    requireLiveGame(state);
    requireVaultGuard(guard);
    const polearm = state.context.polearm;
    if (polearm?.hitmonId === guard.m_id)
        polearm.hitmonId = null;
    const x = guard.mx, y = guard.my;
    // The JS monster list also supplies occupancy; hide the old head before redraw.
    placeMonsterAt(guard, 0, 0);
    if (x)
        newsym(x, y);
    guard._egd.ogx = guard._egd.ogy = 0;
}
export async function prepareVaultGuardDeath(guard, state = game) {
    requireLiveGame(state);
    let dispose = await clearVaultCorridor(guard, true, state);
    if (!dispose) {
        await releaseMonsterInventory(guard, state, { show: false });
        guard.mhp = 0;
        parkVaultGuard(guard, state);
        dispose = await clearVaultCorridor(guard, true, state);
    }
    if (dispose)
        guard.isgd = 0;
    return dispose;
}
// C vault.c:findgd(). Parked guards still own their unfinished corridor.
export function findVaultGuard(state = game) {
    requireLiveGame(state);
    const heroLevel = state.u.uz;
    if (!heroLevel)
        throw new Error('Finding a vault guard requires the hero dungeon location.');
    const level = requireGameLevel(state);
    const belongsHere = (monster) => {
        if (!monster.isgd)
            return false;
        requireVaultGuard(monster);
        return (monster._egd.gdlevel.dnum === heroLevel.dnum &&
            monster._egd.gdlevel.dlevel === heroLevel.dlevel);
    };
    const guard = [...level.monsters].reverse().find(belongsHere);
    if (guard) {
        if (!guard.mx && !guard._egd.gddone)
            guard.mhp = guard.mhpmax;
        return guard;
    }
    const migrants = state._migratingMonsters || [];
    const returning = [...migrants].reverse().find(belongsHere);
    if (!returning)
        return null;
    migrants.splice(migrants.indexOf(returning), 1);
    level.monsters.push(returning);
    returning.mtrack = [];
    returning.mux = state.u.ux;
    returning.muy = state.u.uy;
    returning.mx = returning.my = 0;
    parkVaultGuard(returning, state);
    return returning;
}
//# sourceMappingURL=vault_guard.js.map