import { freshObjectRoom } from './object-room.js';
import { liveMonster, livePet } from './monsters.js';

export function freshRangedCombatRoom(options = {}) {
    return freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 12,
        recalculateVision: false,
        ...options,
    });
}

export function rangedPet(species, options = {}) {
    return livePet({
        species,
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
        edog: { hungrytime: 1000 },
        ...options,
    });
}

export function rangedTarget(species = 'jackal', options = {}) {
    return liveMonster({
        species,
        x: 12,
        y: 10,
        hitPoints: 12,
        level: 8,
        mac: 20,
        ...options,
    });
}
