// C steed.c:place_monster(). Map placement and list membership are separate:
// callers own the level/migration list, and placement resets every mstate bit.

import { MON_FLOOR } from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MonsterPosition } from './monster_types.js';

export function placeMonsterAt(monster: MonsterPosition, x: number, y: number): void {
    monster.mx = x;
    monster.my = y;
    monster.mstate = MON_FLOOR;
    monster.headOnMap = true;
}

// Occupancy ends at unlink/off-map placement, not at zero hit points.
export function monsterAtPosition<T extends MonsterPosition>(
    level: { monsters: readonly T[] }, x: number, y: number,
): T | null {
    return level.monsters.find(monster =>
        monsterHasMapPosition(monster)
        && monsterOccupiesPosition(monster, x, y)) || null;
}

// remove_monster() clears the mounted actor's map slot, without unlinking
// it from fmon or changing mstate. Its coordinates still follow the hero.
export function monsterHasMapPosition(
    monster: MonsterPosition | null | undefined,
    state: { u?: { usteed?: MonsterPosition | null };
        _monsterEngulf?: GameState['_monsterEngulf'] } = game,
): boolean {
    if (!monster || monster === state.u?.usteed
        || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR) return false;
    const engulf = state._monsterEngulf;
    return !engulf || monster !== (engulf.defenderExposed ? engulf.attacker : engulf.defender);
}

// C mdamagem() makes the dying defender the mapped actor before monkilled().
// Both actors remain in fmon throughout the temporary engulf overlap.
export function exposeEngulfedDefenderForDeath(
    attacker: MonsterPosition, defender: MonsterPosition, state: GameState = game,
): void {
    const engulf = state._monsterEngulf;
    if (engulf?.attacker === attacker && engulf.defender === defender
        && state.level && monsterAtPosition(state.level, defender.mx, defender.my) === attacker)
        engulf.defenderExposed = true;
}

export function monsterOccupiesPosition(
    monster: MonsterPosition | null | undefined, x: number, y: number,
): boolean {
    return !!monster && (
        (monster.headOnMap !== false && monster.mx === x && monster.my === y)
        || !!monster.wormSegments?.some(segment => segment.x !== 0 && segment.x === x && segment.y === y)
        || !!monster.wormDetachedSegments?.some(segment => segment.x !== 0 && segment.x === x && segment.y === y)
    );
}
