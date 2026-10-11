import type { MapLocation, Position } from './map_types.js';
import type { finishHeroMonsterKill } from './hero_monster_death.js';
import {
    DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER, ICE, LAVAPOOL, MOAT, STONE,
} from './const.js';

export interface DrawbridgeSquare extends Position {
    location: MapLocation;
}

export interface DrawbridgeOptions {
    finishMonsterKill?: typeof finishHeroMonsterKill;
}

// C dbridge.c:db_under_typ(), also used by SURFACE_AT.
export function drawbridgeUnderlyingType(mask: number): typeof ICE | typeof LAVAPOOL | typeof MOAT | typeof STONE {
    switch (mask & DB_UNDER) {
    case DB_ICE: return ICE;
    case DB_LAVA: return LAVAPOOL;
    case DB_MOAT: return MOAT;
    default: return STONE;
    }
}
