// game.js — Core game data structures.
// C ref: rm.h struct rm, dungeon.h, you.h

import { COLNO, ROWNO, STONE } from './const.js';
import { NO_COLOR } from './terminal.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type {
    ArrivalRegion, ElementalBounds, ElementalBubble, Engraving, ExclusionZone,
    FloorObjects, GasCloud, LevelFlags, LevelTimer, MapLocation, Position,
    RoomEntry, Room, ShopDamage, Trap,
} from './map_types.js';

// A single map cell. Mirrors C's struct rm.
export function makeLocation(): MapLocation {
    return {
        typ: STONE,      // terrain type (STONE, ROOM, CORR, DOOR, etc.)
        roomno: 0,        // room number (0 = not in a room)
        lit: false,        // is this cell lit?
        waslit: false,     // was this cell lit last time we checked?
        flags: 0,          // door flags, wall flags, etc.
        doormask: 0,       // door state (D_NODOOR, D_CLOSED, etc.)
        seenv: 0,          // which angles the hero has seen this wall from
        lastseentyp: STONE, // remembered terrain beneath objects and monsters
        horizontal: false, // is this a horizontal wall?
        edge: false,       // is this at the edge of the map?
        icedpool: 0,       // ICE underlay: ICED_POOL or ICED_MOAT/other
        wall_info: 0,      // wall flags (W_NONDIGGABLE, etc.)
        disp_ch: ' ',      // current display character
        disp_color: NO_COLOR,
        disp_decgfx: false,
        disp_attr: 0,
        gnew: 0,           // dirty flag for flush_glyph_buf
        glyph_symidx: -1,  // S_* symbol index
        remembered_glyph: undefined,  // { ch, color, decgfx, symidx }
    };
}

// The dungeon level map. C ref: struct level.
export class GameMap {
    declare locations: MapLocation[][];
    declare rooms: RoomEntry[];
    declare nroom: number;
    declare subrooms?: Room[];
    declare nsubroom?: number;
    declare doors: Position[];
    declare doorindex: number;
    declare objects: FloorObjects;
    declare buriedObjects?: GameObject[];
    declare monsters: Monster[];
    declare traps: Trap[];
    declare regions: GasCloud[];
    declare levelTimers: LevelTimer[];
    declare exclusionZones: ExclusionZone[];
    declare flags: LevelFlags;
    declare bonesNames?: string[];
    declare upstair?: Position;
    declare dnstair?: Position;
    // C svi.inv_pos survives removal of the vibrating-square trap.
    declare invocationPosition?: Position;
    declare upTeleportRegion?: ArrivalRegion | null;
    declare downTeleportRegion?: ArrivalRegion | null;
    declare engravings?: Engraving[];
    declare damagelist?: ShopDamage[];
    declare elementalBubbles?: ElementalBubble[];
    declare elementalBounds?: ElementalBounds;
    declare _flip?: { flp: number; minx: number; miny: number; maxx: number; maxy: number };

    constructor() {
        this.locations = [];
        for (let x = 0; x < COLNO; x++) {
            const column: MapLocation[] = [];
            this.locations[x] = column;
            for (let y = 0; y < ROWNO; y++) {
                column[y] = makeLocation();
            }
        }
        this.rooms = [];
        this.nroom = 0;
        this.doors = [];
        this.doorindex = 0;
        this.objects = [];
        this.monsters = [];
        this.traps = [];
        this.regions = [];
        // timeout.c TIMER_LEVEL entries are saved with this level rather
        // than following the hero across the dungeon graph.
        this.levelTimers = [];
        // C dungeon.h: special-level exclusion zones persist with the map.
        this.exclusionZones = [];
        this.flags = {
            nfountains: 0,
            nsinks: 0,
            hero_memory: true,
            is_maze_lev: false,
        };
    }

    at(x: number, y: number): MapLocation | null {
        if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return null;
        return this.locations[x]?.[y] || null;
    }

    // Generation loops have a complete rectangle. Fail at its broken edge,
    // rather than letting a missing cell become a later terrain mutation.
    requireAt(x: number, y: number): MapLocation {
        const location = this.at(x, y);
        if (!location) throw new RangeError(`Missing map location (${x}, ${y})`);
        return location;
    }

    requireColumn(x: number): MapLocation[] {
        const column = this.locations[x];
        if (!column) throw new RangeError(`Missing map column ${x}`);
        return column;
    }
}
