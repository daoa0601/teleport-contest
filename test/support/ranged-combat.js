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

function rangedActorOptions(species, options) {
    return {
        species,
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
        ...options,
    };
}

export function rangedMonster(species, options = {}) {
    return liveMonster(rangedActorOptions(species, options));
}

export function rangedPet(species, options = {}) {
    return livePet(rangedActorOptions(species, {
        edog: { hungrytime: 1000 },
        ...options,
    }));
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
