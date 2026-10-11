// C monmove.c:m_search_items(). The current pursuit goal is part of the
// input: remembered traps can change it without finding a replacement item.
import { COLNO, ROWNO, SHOPBASE } from './const.js';
import type { PlayingGameState } from './game_state.js';
import { requireLiveGame } from './gstate.js';
import { distmin } from './hacklib.js';
import { isLevelPrize } from './level_prize.js';
import type { Position } from './map_types.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import { monsterCanCarryObject, monsterCanTouchObject } from './monster_carry.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE } from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterWantsFloorObject, monsterWouldConsumeItem } from './monster_item_interest.js';
import { monsterCouldReachItem } from './monster_item_reach.js';
import { monsterAtPosition } from './monster_location.js';
import type { Monster } from './monster_types.js';
import { ROCK } from './object_data.js';
import type { GameObject } from './object_types.js';
import { roomsAt } from './room.js';
import { costlySpot } from './shk.js';
import { monsterKnowsTrap } from './trap_knowledge.js';
import { cansee, clearPath } from './vision.js';

const SEARCH_RADIUS = 5;
const M1_CONCEAL = 0x80, M2_MERC = 0x200;

export type MonsterApproach = -2 | -1 | 0 | 1;
export interface MonsterItemSearchOptions {
    goal: Position;
    approach: MonsterApproach;
    random: RandomBelow;
    calls?: MonsterCallLog;
}
export interface MonsterItemSearchResult {
    goal: Position;
    approach: MonsterApproach;
    underfoot: GameObject | null;
}

export function searchMonsterItems(monster: Monster, state: PlayingGameState, {
    goal: initialGoal, approach: initialApproach, random, calls = [],
}: MonsterItemSearchOptions): MonsterItemSearchResult {
    requireLiveGame(state);
    const { mx, my, mux, muy } = monster;
    if (typeof mux !== 'number' || typeof muy !== 'number'
        || !Number.isFinite(mux) || !Number.isFinite(muy))
        throw new Error('An item search requires the monster perceived hero position');
    const heroGoal = { x: mux, y: muy };
    let goal = { ...initialGoal };
    let approach = initialApproach;
    let radius = SEARCH_RADIUS;
    if (!monster.mpeaceful && distmin(mx, my, mux, muy) < SEARCH_RADIUS) radius--;
    if (!monster.mpeaceful && ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MERC)) radius = 1;

    let skipSearch = false;
    if (roomsAt(state.level, mx, my, SHOPBASE).length) {
        const shopRoll = random(25);
        calls.push('rn2(25)');
        skipSearch = shopRoll !== 0 || !!monster.isshk;
    }
    if (!skipSearch) {
        const maxX = Math.min(COLNO - 1, mx + radius);
        const maxY = Math.min(ROWNO - 1, my + radius);
        const minX = Math.max(1, mx - radius);
        const minY = Math.max(0, my - radius);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const pile = state.level.objects[x]?.[y];
                if (!pile?.length || radius < distmin(mx, my, x, y)
                    || !monsterCouldReachItem(monster, x, y, state)) continue;
                if (((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL) && cansee(x, y)) continue;
                const occupant = monsterAtPosition(state.level, x, y);
                if (occupant && (occupant.msleeping || !occupant.mcanmove || occupant.mundetected
                    || (occupant.mappearance && !occupant.iswiz) || !MONSTER_MOVE[occupant.mnum])) continue;
                if (monsterIsScaredAt(monster, state, x, y)) continue;
                const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
                if (trap && monsterKnowsTrap(monster, trap)) {
                    if (goal.x === x && goal.y === y) goal = heroGoal;
                    continue;
                }
                if (!clearPath(mx, my, x, y)) continue;
                const costly = costlySpot(x, y, state) !== null;
                for (const object of pile) {
                    if (object.otyp === ROCK || isLevelPrize(object, state) || (costly && !object.no_charge)) continue;
                    if (((monsterWantsFloorObject(monster, object, state)
                        && monsterCanCarryObject(monster, object, state, random))
                        || monsterWouldConsumeItem(monster, object, state, random, calls))
                        && monsterCanTouchObject(monster, object, state)) {
                        radius = distmin(mx, my, x, y);
                        goal = { x: object.ox, y: object.oy };
                        if (goal.x === mx && goal.y === my)
                            return { goal, approach, underfoot: object };
                        break;
                    }
                }
            }
        }
    }
    if (radius < SEARCH_RADIUS && approach === -1) {
        if (distmin(mx, my, mux, muy) <= 3) goal = heroGoal;
        else approach = 1;
    }
    return { goal, approach, underfoot: null };
}
