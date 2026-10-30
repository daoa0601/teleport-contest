import type { ObjectRoomOptions } from './object-room.js';
import { freshObjectRoom } from './object-room.js';

export async function freshRangedCombatRoom(options: ObjectRoomOptions = {}) {
    const level = await freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 12,
        recalculateVision: false,
        ...options,
    });
    return level;
}

