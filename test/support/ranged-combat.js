import { freshObjectRoom } from './object-room.js';
export function freshRangedCombatRoom(options = {}) {
    const level = freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 12,
        recalculateVision: false,
        ...options,
    });
    return level;
}
//# sourceMappingURL=ranged-combat.js.map