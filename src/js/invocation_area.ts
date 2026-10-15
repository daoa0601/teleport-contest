// C mklev.c:mkinvokearea()/mkinvpos(). The rings are deliberately visited
// in native order: actors encounter the changed terrain before the next ring.
import {
    COLNO, ROWNO, COULD_SEE, IN_SIGHT, FIRE_TRAP, IRONBARS, IS_STWALL, MOAT, ROOM,
    TT_BURIEDBALL,
} from './const.js';
import { buriedBallToPunishment } from './buried_object.js';
import { flushPendingTopline, flush_screen, newsym, plineWithContinuation as pline } from './display.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { MonsterLiquidDeathContext } from './mon.js';
import type { MonsterLiquidDeathResult } from './monster_death.js';
import type { HeroLiquidMonsterDeathOutcome } from './hero_monster_death.js';
import { impossible, panic } from './diagnostics.js';
import { finishHeroLiquidMonsterDeath } from './hero_monster_death.js';
import { maketrap, mkstairs } from './mklev.js';
import { resolveMonsterLiquid } from './mon.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { BOULDER } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { fractureRock } from './rock_breakage.js';
import { resetHeroTrap } from './terrain_movement.js';
import { isPoolAt } from './terrain_properties.js';
import { deleteTrap } from './trap_lifecycle.js';
import { vision_note_blocker_change } from './vision.js';

function invocationRings(x: number, y: number): Position[][] {
    const rings = [[{ x, y }]];
    let xmin = x, xmax = x, ymin = y, ymax = y;
    for (let distance = 1; distance < 7; distance++) {
        xmin--; xmax++;
        const ring: Position[] = [];
        if (distance !== 3) {
            ymin--; ymax++;
            for (let column = xmin + 1; column < xmax; column++)
                ring.push({ x: column, y: ymin }, { x: column, y: ymax });
        }
        for (let row = ymin; row <= ymax; row++)
            ring.push({ x: xmin, y: row }, { x: xmax, y: row });
        rings.push(ring);
    }
    return rings;
}

export async function makeInvocationArea({ state = game }: { state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const level = requireGameLevel(state);
    const rings = invocationRings(state.u.ux, state.u.uy);
    await pline('The floor shakes violently under you!');
    if (rings.flat().some(({ x, y }) => {
        const location = level.at(x, y);
        return location && (IS_STWALL(location.typ) || location.typ === IRONBARS);
    })) await pline('The walls around you begin to bend and crumble!');
    await flushPendingTopline();
    if (state.u.utrap) {
        if (state.u.utraptype === TT_BURIEDBALL) await buriedBallToPunishment();
        await resetHeroTrap(false, state);
    }
    for (const [distance, ring] of rings.entries()) {
        for (const position of ring) await changeInvocationSquare(position, distance, state);
        if (distance) await flush_screen(1);
    }
    await pline('You are standing at the top of a stairwell leading down!');
    await mkstairs(state.u.ux, state.u.uy, false, null);
    newsym(state.u.ux, state.u.uy);
    state.vision_full_recalc = 1;
}

async function changeInvocationSquare({ x, y }: Position, distance: number, state: PlayingGameState): Promise<void> {
    if (x < 2 || y < 2 || x > ((COLNO - 1) & ~1) || y > ((ROWNO - 1) & ~1)) {
        if (distance < 5) {
            const report = x > 0 && x < COLNO && y >= 0 && y < ROWNO ? impossible : panic;
            await report(`mkinvpos: <${x},${y}> (${distance}) off map edge!`, { state });
        }
        return;
    }
    const level = requireGameLevel(state);
    const location = level.requireAt(x, y);
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap) deleteTrap(trap, state);
    let makeRocks = ![1, 4, 5].includes(distance);
    for (const boulder of [...(level.objects[x]?.[y] || [])].filter(object => object.otyp === BOULDER)) {
        if (makeRocks) {
            await fractureRock(boulder, x, y, { state });
            makeRocks = false;
        } else await deleteObject(boulder, state);
    }
    location.seenv = location.doormask = location.flags = 0;
    if (distance < 6) location.lit = true;
    location.waslit = true;
    location.horizontal = false;
    const visionRow = state.viz_array?.[y];
    if (visionRow) visionRow[x] = distance < 6 ? IN_SIGHT | COULD_SEE : COULD_SEE;
    if (distance === 1) {
        if (!isPoolAt(x, y, state)) {
            location.typ = ROOM;
            const fire = await maketrap(x, y, FIRE_TRAP);
            if (fire) fire.tseen = true;
        }
    } else location.typ = distance === 4 || distance === 5 ? MOAT : ROOM;
    const monster = monsterAtPosition(level, x, y);
    if (monster) {
        if (monster.m_ap_type) revealMonsterAppearance(monster);
        if (level.traps.some(candidate => candidate.tx === x && candidate.ty === y)) {
            const action = await triggerImmediateMonsterTrap(monster, state);
            await finishImmediateMonsterTrap(action, state);
        } else await resolveMonsterLiquid(monster, state, {
            announce: pline, monsterMoving: false, finishDeath: finishInvocationLiquidDeath,
        });
    }
    vision_note_blocker_change(x, y);
    newsym(x, y);
}

function finishInvocationLiquidDeath(
    monster: Monster, options: MonsterLiquidDeathContext,
): Promise<MonsterLiquidDeathResult | HeroLiquidMonsterDeathOutcome> {
    if (options.cause === 'drowning' || options.cause === 'lava-burning')
        return finishHeroLiquidMonsterDeath(monster, options);
    return finishMonsterLiquidDeath(monster, options);
}
