// C restore.c:rest_stairs().
import type { GameMap } from './game.js';
import type { Stairway } from './map_types.js';

// Native restoration prepends each saved stair to the new chain.
export function restoreLevelChains(level: GameMap, stairs: Stairway | null): Stairway | null {
    // C restdamage() prepends the saved pending repairs.
    level.damagelist?.reverse();
    let restored: Stairway | null = null;
    let saved = stairs;
    while (saved) {
        const next = saved.next;
        saved.next = restored;
        restored = saved;
        saved = next;
    }
    return restored;
}
