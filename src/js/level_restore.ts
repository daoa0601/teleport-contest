// C restore.c:rest_stairs().
import type { Stairway } from './map_types.js';

// Native restoration prepends each saved stair to the new chain.
export function restoreLevelChains(stairs: Stairway | null): Stairway | null {
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
