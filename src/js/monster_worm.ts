// Long-worm body ownership.
// C refs: makemon.c:initworm(), worm.c:place_worm_tail_randomly(), wormgone().

import { MAX_NUM_WORMS, MHPMAX, MON_FLOOR, MON_OFFMAP, NORMAL_SPEED, isok, xdir, ydir } from './const.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { cloneMonster } from './monster_clone.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { mcalcmove } from './monster_speed.js';
import { d, rn2, rnd } from './rng.js';
import { goodPosition } from './teleport_rules.js';
import { isSavedRecord } from './saved_graph.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';

const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

export interface WormMonster extends Monster {
    wormno: number;
    wormSegments: Position[];
    wormHead: Position;
    wormGrowTime: number;
}

// A reserved worm slot owns both the visible tail and its hidden head.
function requireWormBody(monster: Monster): asserts monster is WormMonster {
    if (monster.wormno === undefined || !monster.wormHead
        || !monster.wormSegments || monster.wormGrowTime === undefined)
        throw new Error(`Monster ${monster.m_id} has no initialized worm body.`);
}

// C worm.c:see_wsegs() traverses the visible tail toward the hidden head.
export function redrawMonsterWormSegments(monster: Monster): void {
    requireWormBody(monster);
    for (const segment of [...monster.wormSegments].reverse()) newsym(segment.x, segment.y);
}

interface WormPlacementOptions {
    state?: GameState;
    random?: typeof rn2;
}

interface WormInitializationOptions extends WormPlacementOptions {
    allowTail?: boolean;
    segmentCount?: number | null;
}

interface WormMovementOptions extends WormPlacementOptions {
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

interface WormCutOptions extends WormMovementOptions {
    publish?: typeof plineWithContinuation;
}

// C worm.c:cutworm(). The struck segment becomes the new head when the
// severed tail survives. Neither outcome is a monster death or a birth tally.
export async function cutWorm(monster: Monster, x: number, y: number, sliceOrChop: boolean, {
    state = game, random = rn2, rollOne = rnd, rollDice = d,
    publish = plineWithContinuation,
}: WormCutOptions = {}): Promise<void> {
    if (!monster.wormno || monster.mx === x && monster.my === y) return;
    requireLiveGame(state);
    requireWormBody(monster);
    if (rollOne(20) + (sliceOrChop ? 10 : 0) < 17) return;

    const cutIndex = monster.wormSegments.findIndex(point => point.x === x && point.y === y);
    if (cutIndex < 0) throw new Error(`Worm ${monster.m_id} has no segment at ${x},${y}.`);
    if (cutIndex === monster.wormSegments.length - 1) {
        removeWormTailTip(monster);
        return;
    }

    const severed = monster.wormSegments.slice(cutIndex);
    monster.wormSegments = monster.wormSegments.slice(0, cutIndex);
    monster.wormDetachedSegments = severed;
    try {
        const wormno = monster.m_lev >= 3 && random(3) === 0 ? nextWormNumber(state) : 0;
        // clone_mon() needs an empty head square. The remaining detached
        // cells stay owned by the original worm until place_wsegs().
        if (wormno) monster.wormDetachedSegments = severed.slice(1);
        const clone = wormno ? await cloneMonster(monster, state, {
            position: { x, y }, random,
        }) : null;
        if (!clone) {
            monster.wormDetachedSegments = severed;
            let message: string | null = null;
            if (!state.context.mon_moving) {
                message = `You cut part of the tail off of ${monsterName(monster, { state })}.`;
            } else if (canSpotMonster(monster)) {
                const name = monsterName(monster, { state });
                const possessive = name === 'it' ? 'its' : /s$/i.test(name) ? `${name}'` : `${name}'s`;
                message = `Part of ${possessive} tail has been cut off.`;
            }
            if (message) await publish(message);
            // toss_wsegs() clears and redraws each cell from tail to cut.
            while (severed.length) {
                const segment = severed.pop();
                if (segment?.x) newsym(segment.x, segment.y);
            }
            if (monster.mhp > 1) monster.mhp = Math.trunc(monster.mhp / 2);
            return;
        }

        clone.wormno = wormno;
        clone.mcloned = 0;
        monster.m_lev = Math.max(monster.m_lev - 2, 3);
        clone.m_lev = monster.m_lev;
        clone.mhpmax = clone.mhp = rollDice(clone.m_lev, 8);
        monster.mhpmax = rollDice(monster.m_lev, 8);
        monster.mhp = Math.min(monster.mhp, monster.mhpmax);
        clone.wormSegments = severed.slice(1);
        clone.wormHead = { x, y };
        clone.wormGrowTime = 0;
        delete monster.wormDetachedSegments;
        if (state.context.mon_moving)
            await publish(`${monsterName(monster, { state, capitalized: true })} is cut in half.`);
        else
            await publish(`You cut ${monsterName(monster, { state })} in half.`);
    } finally {
        delete monster.wormDetachedSegments;
    }
}

function nextWormNumber(state: GameState) {
    const used = new Set((state.level?.monsters || [])
        .map(monster => monster.wormno)
        .filter(Boolean));
    let wormno = 1;
    while (wormno < MAX_NUM_WORMS && used.has(wormno)) wormno++;
    return wormno < MAX_NUM_WORMS ? wormno : 0;
}

// C worm.c:wseg_at(). Segment numbers run from the hidden head toward the
// tail. A displaced live head need not coincide with any stored segment.
export function wormSegmentIndexAt(
    monster: Monster | null, x: number, y: number, state: GameState = game,
): number {
    if (!monster?.wormno || monsterAtPosition(requireGameLevel(state), x, y) !== monster)
        return 0;
    requireWormBody(monster);
    for (let index = monster.wormSegments.length - 1; index >= 0; index--) {
        const segment = monster.wormSegments[index];
        if (segment?.x === x && segment.y === y) return index + 2;
    }
    return monster.wormHead.x === x && monster.wormHead.y === y ? 1 : 0;
}

// C worm.c:worm_cross(). The head and each body segment are consecutive.
export function wormCrossesBetween(x1: number, y1: number, x2: number, y2: number, state: GameState = game) {
    if (Math.abs(x1 - x2) !== 1 || Math.abs(y1 - y2) !== 1) return false;
    const level = requireGameLevel(state);
    const worm = monsterAtPosition(level, x1, y2);
    if (!worm?.wormno || monsterAtPosition(level, x2, y1) !== worm)
        return false;

    requireWormBody(worm);
    let previous = worm.wormHead;
    for (const segment of worm.wormSegments) {
        if (previous.x === x1 && previous.y === y2
            && segment.x === x2 && segment.y === y1
            || previous.x === x2 && previous.y === y1
                && segment.x === x1 && segment.y === y2) return true;
        previous = segment;
    }
    return false;
}

// Visible segments are head-outward. wormHead holds C's hidden dummy segment;
// literal head-only moves can leave it behind until worm_move() or restore.
// Clearing occupancy retains the body slot and deadline for relocation.
export function clearMonsterWormFromMap(monster: Monster) {
    requireWormBody(monster);
    const count = monster.wormSegments.length;
    for (let i = count - 1; i >= 0; i--) {
        const point = monster.wormSegments[i];
        if (point?.x) {
            monster.wormSegments[i] = { x: 0, y: point.y };
            newsym(point.x, point.y);
        }
    }
    // C removes the head's grid entry without changing its coordinates or
    // lifecycle state. Hide it only for this synchronous repaint.
    const previousState = monster.mstate;
    monster.mstate = (monster.mstate ?? MON_FLOOR) | MON_OFFMAP;
    if (monster.wormHead.x) newsym(monster.wormHead.x, monster.wormHead.y);
    if (previousState === undefined) delete monster.mstate;
    else monster.mstate = previousState;
    monster.wormHead = { x: 0, y: monster.wormHead.y };
    return count;
}

export function removeMonsterWormBody(monster: Monster) {
    if (!monster?.wormno) return;
    monster.wormno = 0;
    clearMonsterWormFromMap(monster);
    monster.wormSegments = [];
    monster.wormHead = null;
    monster.wormGrowTime = 0;
    if (monster.mnum === PM_LONG_WORM) {
        if (Number.isInteger(monster.mcorpsenm)) monster.mcorpsenm = -1;
        if (monster.mextra && Number.isInteger(monster.mextra.mcorpsenm)) monster.mextra.mcorpsenm = -1;
    }
}

// C get_wormno() + initworm(): reserve the body before arrival can restore a
// shapechanger. Tail segments have no map occupancy until rloc places them.
export function initializeUnplacedMonsterWormBody(
    monster: Monster, segmentCount: number,
    { state = game }: Pick<WormPlacementOptions, 'state'> = {},
): monster is WormMonster {
    if (!Number.isInteger(segmentCount) || segmentCount < 0)
        throw new RangeError('A worm body needs a nonnegative integer tail length.');
    monster.wormno = nextWormNumber(state);
    monster.wormSegments = monster.wormno
        ? Array.from({ length: segmentCount }, () => ({ x: 0, y: 0 })) : [];
    monster.wormHead = monster.wormno ? { x: monster.mx, y: monster.my } : null;
    monster.wormGrowTime = 0;
    return monster.wormno !== 0;
}

// Ordinary births reserve the body first, then roll and place their tail.
// An explicit count also serves callers rebuilding a known tail on the map.
export function initializeMonsterWormBody(
    monster: Monster,
    {
        allowTail = true,
        segmentCount = null,
        state = game,
        random = rn2,
    }: WormInitializationOptions = {},
): monster is WormMonster {
    if (!initializeUnplacedMonsterWormBody(monster, segmentCount ?? 0, { state }))
        return false;

    const requestedSegments = segmentCount != null
        ? segmentCount
        : allowTail ? random(5) : 0;
    placeMonsterWormTailRandomly(monster, requestedSegments, { state, random });
    return true;
}

export function placeMonsterWormTailRandomly(monster: Monster, requestedSegments: number, {
    state = game, random = rn2,
}: WormPlacementOptions = {}) {
    monster.wormHead = { x: monster.mx, y: monster.my };
    monster.wormSegments = [];
    let oldX = monster.mx;
    let oldY = monster.my;
    for (let segment = 0; segment < requestedSegments; segment++) {
        const directions = Array.from({ length: 8 }, (_, index) => index);
        for (let remaining = 8; remaining > 0; remaining--) {
            const selected = random(remaining);
            const chosen = directions[selected], last = directions[remaining - 1];
            if (chosen === undefined || last === undefined)
                throw new Error(`Invalid worm direction shuffle index ${selected} for ${remaining} directions.`);
            directions[selected] = last;
            directions[remaining - 1] = chosen;
        }

        let next = null;
        for (const direction of directions) {
            const dx = xdir[direction], dy = ydir[direction];
            if (dx === undefined || dy === undefined)
                throw new Error(`Invalid worm direction ${direction}.`);
            const x = oldX + dx;
            const y = oldY + dy;
            if (goodPosition(x, y, { kind: 'monster', monster }, { state, random })) {
                next = { x, y };
                break;
            }
        }
        if (!next) break;
        monster.wormSegments.push(next);
        newsym(next.x, next.y);
        oldX = next.x;
        oldY = next.y;
    }
}

// Native redraw_worm includes the head's dummy segment after the tail.
export function redrawMonsterWorm(monster: Monster, state: GameState = game) {
    requireLiveGame(state);
    requireWormBody(monster);
    for (let i = monster.wormSegments.length - 1; i >= 0; i--) {
        const segment = monster.wormSegments[i];
        if (segment) newsym(segment.x, segment.y);
    }
    newsym(monster.wormHead.x, monster.wormHead.y);
}

// C worm.c:worm_move(). The ordinary movement owner has placed the new head.
export function advanceMonsterWormBody(monster: Monster, {
    state = game, random = rn2, rollOne = rnd, rollDice = d,
}: WormMovementOptions = {}) {
    requireWormBody(monster);
    const oldHead = monster.wormHead;
    monster.wormSegments.unshift(oldHead);
    newsym(oldHead.x, oldHead.y);
    monster.wormHead = { x: monster.mx, y: monster.my };
    if (monster.wormGrowTime > state.moves) {
        removeWormTailTip(monster);
        return;
    }

    if (monster.wormGrowTime === 0) {
        monster.wormGrowTime = state.moves + rollOne(5);
    } else {
        const speed = mcalcmove(monster, false, random, state);
        const increment = Math.trunc((random(10) + 2) * NORMAL_SPEED / Math.max(speed, 1));
        monster.wormGrowTime = state.moves + increment;
    }

    let segments = monster.wormSegments.length;
    let limit = monster.m_lev === 0 ? 4 : 8 * monster.m_lev;
    if (segments > 33) { limit += 2 * (segments - 33); segments = 33; }
    if (segments > 22) { limit += 4 * (segments - 22); segments = 22; }
    if (segments > 11) { limit += 6 * (segments - 11); segments = 11; }
    limit = Math.min(MHPMAX, limit + 8 * segments);

    const previousHp = monster.mhp;
    monster.mhp += rollDice(2, 2);
    const cap = Math.max(limit, monster.mhpmax);
    if (monster.mhp < cap) {
        if (monster.mhp > limit) monster.mhp = Math.max(previousHp, limit);
        if (monster.mhp > monster.mhpmax) monster.mhpmax = monster.mhp;
    } else if (monster.mhp > monster.mhpmax) {
        monster.mhp = monster.mhpmax;
    }
}

// C worm.c:worm_nomove(), only after ordinary candidate selection fails.
export function shrinkStationaryMonsterWorm(monster: Monster, { rollDice = d }: { rollDice?: typeof d } = {}) {
    requireWormBody(monster);
    removeWormTailTip(monster);
    if (monster.mhp > monster.wormSegments.length)
        monster.mhp = Math.max(1, monster.mhp - rollDice(2, 2));
}

function removeWormTailTip(monster: WormMonster) {
    const tip = monster.wormSegments.pop();
    if (tip) newsym(tip.x, tip.y);
}

type WormRestoreMonster = Pick<Monster,
    'mx' | 'my' | 'mstate' | 'wormno' | 'wormHead' | 'wormSegments' | 'wormGrowTime'>;

export interface WormRestoreLevel {
    monsters: WormRestoreMonster[];
}

// This boundary proves only worm restoration fields, not a complete Monster.
// Full saves and bones retain body identity and deadlines rather than rebuilding them.
export function validMonsterWormBodies(level: unknown): level is WormRestoreLevel {
    if (!isSavedRecord(level) || !Array.isArray(level.monsters)) return false;
    const monsters: unknown[] = level.monsters;
    const slots = new Set<number>();
    for (const monster of monsters) {
        if (!isSavedRecord(monster)
            || typeof monster.mx !== 'number' || !Number.isInteger(monster.mx)
            || typeof monster.my !== 'number' || !Number.isInteger(monster.my)
            || monster.mstate !== undefined && typeof monster.mstate !== 'number'
            || monster.wormno !== undefined && typeof monster.wormno !== 'number'
            || monster.wormGrowTime !== undefined
                && typeof monster.wormGrowTime !== 'number') return false;
        if (!monster.wormno) {
            if (monster.wormHead != null) return false;
            if (monster.wormSegments !== undefined
                && (!Array.isArray(monster.wormSegments)
                    || monster.wormSegments.length !== 0)) return false;
            continue;
        }
        if (!Number.isInteger(monster.wormno)
            || monster.wormno < 1 || monster.wormno >= MAX_NUM_WORMS
            || slots.has(monster.wormno)
            || typeof monster.wormGrowTime !== 'number'
            || !Number.isInteger(monster.wormGrowTime) || monster.wormGrowTime < 0
            || !savedWormPoint(monster.wormHead)
            || (monster.wormHead.x !== 0 && !isok(monster.wormHead.x, monster.wormHead.y))
            || !Array.isArray(monster.wormSegments)) return false;
        const segments: unknown[] = monster.wormSegments;
        for (const point of segments) {
            if (!savedWormPoint(point)
                || !(point.x === 0 && (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
                    && !isok(point.x, point.y)) return false;
        }
        slots.add(monster.wormno);
    }
    return true;
}

function savedWormPoint(value: unknown): value is Position {
    return isSavedRecord(value)
        && typeof value.x === 'number' && Number.isInteger(value.x)
        && typeof value.y === 'number' && Number.isInteger(value.y);
}

// C restore.c calls place_wsegs(), which normalizes only the hidden head.
export function restoreMonsterWormHeads(level: WormRestoreLevel): void {
    for (const monster of level.monsters) {
        if (monster.wormno) monster.wormHead = { x: monster.mx, y: monster.my };
    }
}
