import { GameMap } from './game.js';
import { COLNO, ROWNO } from './const.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import type {
    ArrivalRegion, BubbleContents, ElementalBounds, ElementalBubble, Engraving,
    ExclusionZone, GasCloud, LevelFlags, LevelTimer, MapBit, MapLocation,
    Position, Rectangle, Room, RoomEntry, RoomSentinel, ShopDamage, Stairway,
    Trap, VaultRoomReservation,
} from './map_types.js';
import { validSavedGlyph, validSavedGlyphMetadata } from './display_validation.js';
import { isSavedRecord } from './saved_graph.js';
import { arrayOf, boolean, closedFieldsMatch as fieldsMatch, integer, nullable, optional, string, validateSavedEntity } from './saved_validation.js';
import type { Check, Fields, SavedEntityContext } from './saved_validation.js';

// Entity owners validate every declared entity field and retain their own
// visited set, so container/carrier back-references preserve object identity.
export interface MapEntityChecks {
    object: Check<GameObject>;
    monster: Check<Monster>;
    room: Check<Room>;
    failure?: string;
}

const mapBit = (value: unknown): value is MapBit =>
    typeof value === 'boolean' || value === 0 || value === 1;

export function validSavedPosition(value: unknown): value is Position {
    return fieldsMatch<Position>(value, { x: integer, y: integer });
}

export function validSavedDungeonLocation(value: unknown): value is DungeonLocation {
    return fieldsMatch<DungeonLocation>(value, { dnum: integer, dlevel: integer });
}

function validRectangle(value: unknown): value is Rectangle {
    return fieldsMatch<Rectangle>(value, {
        lx: integer, ly: integer, hx: integer, hy: integer,
    });
}

export function validSavedMapLocation(value: unknown): value is MapLocation {
    return fieldsMatch<MapLocation>(value, {
        typ: integer, roomno: integer, lit: boolean, waslit: boolean,
        flags: integer, doormask: integer, seenv: integer, lastseentyp: integer,
        horizontal: boolean, edge: mapBit, icedpool: integer, wall_info: integer,
        disp_ch: string, disp_color: integer, disp_decgfx: boolean,
        disp_attr: integer, gnew: integer, glyph_symidx: integer,
        remembered_glyph: optional(nullable(validSavedGlyph)),
        disp_glyph: optional(nullable(validSavedGlyphMetadata)),
        arboreal_sdoor: optional(mapBit), blessedftn: optional(mapBit),
        candig: optional(mapBit), disturbed: optional(mapBit),
        emptygrave: optional(mapBit), ladder: optional(integer),
        looted: optional(integer), premapped: optional(boolean),
        drawbridgemask: optional(integer),
        altarmask: optional(integer),
    });
}

function validSavedLocations(value: unknown): value is MapLocation[][] {
    return arrayOf(arrayOf(validSavedMapLocation))(value)
        && value.length === COLNO
        && value.every(column => column.length === ROWNO);
}

export function validSavedTrap(value: unknown): value is Trap {
    return fieldsMatch<Trap>(value, {
        ttyp: integer, tx: integer, ty: integer, tseen: mapBit, once: mapBit,
        launch: validSavedPosition, launch2: optional(validSavedPosition),
        dst: optional(validSavedDungeonLocation), teledest: optional(validSavedPosition),
        conjoined: optional(integer), tnote: optional(integer), madeby_u: optional(mapBit),
    });
}

function validFlags(value: unknown): value is LevelFlags {
    return fieldsMatch<LevelFlags>(value, {
        nfountains: integer, nsinks: integer, hero_memory: boolean,
        is_maze_lev: boolean, has_shop: optional(boolean), has_vault: optional(boolean),
        has_zoo: optional(boolean), has_court: optional(boolean),
        has_morgue: optional(boolean), graveyard: optional(boolean),
        has_beehive: optional(boolean), has_barracks: optional(boolean),
        has_temple: optional(boolean), has_swamp: optional(boolean),
        noteleport: optional(boolean), hardfloor: optional(boolean),
        nommap: optional(boolean), shortsighted: optional(boolean),
        sokoban_rules: optional(boolean), is_cavernous_lev: optional(boolean),
        is_rogue_level: optional(boolean), rogue_level: optional(boolean),
        arboreal: optional(boolean), has_town: optional(boolean),
        wizard_bones: optional(boolean), corrmaze: optional(boolean),
        temperature: optional(integer), rndmongen: optional(boolean),
        deathdrops: optional(boolean), noautosearch: optional(boolean),
        fumaroles: optional(boolean), stormy: optional(boolean),
        stasis_until: optional(integer), is_special: optional(boolean),
        no_bones: optional(boolean),
        waterlevel: optional(boolean),
    });
}

function validGasCloud(value: unknown): value is GasCloud {
    return fieldsMatch<GasCloud>(value, {
        kind: (kind): kind is 'gas-cloud' => kind === 'gas-cloud',
        visible: boolean, damage: integer, ttl: integer,
        cells: arrayOf(validSavedPosition),
        monsterIds: arrayOf((id): id is number => integer(id) && id > 0),
        heroInside: boolean,
        heroFault: optional(boolean),
    });
}

function validTimer(value: unknown): value is LevelTimer {
    return fieldsMatch<LevelTimer>(value, {
        kind: (kind): kind is 'melt-ice-away' => kind === 'melt-ice-away',
        deadline: integer, id: integer, order: integer, x: integer, y: integer,
    });
}

function validExclusion(value: unknown): value is ExclusionZone {
    return fieldsMatch<ExclusionZone>(value, {
        type: (type): type is ExclusionZone['type'] => type === 'teleport'
            || type === 'teleport-up' || type === 'teleport-down'
            || type === 'monster-generation',
        lx: integer, ly: integer, hx: integer, hy: integer,
    });
}

function validArrivalRegion(value: unknown): value is ArrivalRegion {
    return fieldsMatch<ArrivalRegion>(value, {
        lx: integer, ly: integer, hx: integer, hy: integer,
        exclude: optional(nullable(validRectangle)),
    });
}

function validEngraving(value: unknown): value is Engraving {
    return fieldsMatch<Engraving>(value, {
        x: integer, y: integer, text: string, pristine: string,
        erasedPrefix: optional((prefix): prefix is string => string(prefix) && /^ *$/.test(prefix)),
        rememberedPrefix: optional((prefix): prefix is string => string(prefix) && /^ *$/.test(prefix)),
        rememberedText: string, epoch: integer, engr_type: integer,
        nowipeout: boolean, guardobjects: boolean, eread: boolean, erevealed: boolean,
    });
}

function validDamage(value: unknown): value is ShopDamage {
    return fieldsMatch<ShopDamage>(value, {
        when: integer, place: validSavedPosition, cost: integer,
        typ: integer, flags: integer,
    });
}

function validElementalBounds(value: unknown): value is ElementalBounds {
    return fieldsMatch<ElementalBounds>(value, {
        xmin: integer, ymin: integer, xmax: integer, ymax: integer,
        bubbleXMin: integer, bubbleYMin: integer,
        bubbleXMax: integer, bubbleYMax: integer,
    });
}

type SavedMapData = Omit<GameMap, 'at' | 'requireAt' | 'requireColumn'>;

export function validSavedRoom(value: unknown, context: SavedEntityContext): value is Room {
    return validateSavedEntity<Room>(value, 'room', context, {
        lx: integer, ly: integer, hx: integer, hy: integer, rtype: integer,
        rlit: (lit): lit is 0 | 1 => lit === 0 || lit === 1,
        doorct: integer, fdoor: integer, irregular: boolean,
        needjoining: boolean, nsubrooms: integer, sbrooms: arrayOf(context.room),
        roomnoidx: integer, needfill: integer,
        resident: optional(nullable(context.monster)), arrival_room: optional(boolean),
        orig_rtype: optional(integer),
    });
}

// This validates the full map shape before installing its methods. Merely
// setting the prototype would not establish a typed map or its nested cells.
export function restoreSavedMap(value: unknown, entities: MapEntityChecks): GameMap {
    const validRoom = entities.room;
    function validRoomEntry(room: unknown): room is RoomEntry {
        if (!isSavedRecord(room)) return false;
        if ('rtype' in room) return validRoom(room);
        if (room.hx === -1) return fieldsMatch<RoomSentinel>(room, {
            hx: (hx): hx is -1 => hx === -1,
            lx: optional(integer), ly: optional(integer),
        });
        return fieldsMatch<VaultRoomReservation>(room, {
            lx: integer, ly: integer,
            hx: (hx): hx is undefined => hx === undefined,
        });
    }
    function validBubbleContent(content: unknown): content is BubbleContents {
        if (!isSavedRecord(content)) return false;
        switch (content.kind) {
        case 'objects': return fieldsMatch<Extract<BubbleContents, { kind: 'objects' }>>(content, {
            x: integer, y: integer, kind: (kind): kind is 'objects' => kind === 'objects',
            items: arrayOf(entities.object),
        });
        case 'monster': return fieldsMatch<Extract<BubbleContents, { kind: 'monster' }>>(content, {
            x: integer, y: integer, kind: (kind): kind is 'monster' => kind === 'monster',
            monster: entities.monster,
        });
        case 'hero': return fieldsMatch<Extract<BubbleContents, { kind: 'hero' }>>(content, {
            x: integer, y: integer, kind: (kind): kind is 'hero' => kind === 'hero',
        });
        case 'trap': return fieldsMatch<Extract<BubbleContents, { kind: 'trap' }>>(content, {
            x: integer, y: integer, kind: (kind): kind is 'trap' => kind === 'trap',
            trap: validSavedTrap,
        });
        default: return false;
        }
    }
    function validBubble(bubble: unknown): bubble is ElementalBubble {
        return fieldsMatch<ElementalBubble>(bubble, {
            x: integer, y: integer, dx: integer, dy: integer,
            width: integer, height: integer, rows: arrayOf(integer),
            contents: optional(arrayOf(validBubbleContent)),
        });
    }
    const fields: Fields<SavedMapData> = {
        locations: validSavedLocations,
        rooms: arrayOf(validRoomEntry), nroom: integer,
        subrooms: optional(arrayOf(validRoom)), nsubroom: optional(integer),
        doors: arrayOf(validSavedPosition), doorindex: integer,
        objects: arrayOf(optional(nullable(arrayOf(optional(nullable(arrayOf(entities.object))))))),
        buriedObjects: optional(arrayOf(entities.object)),
        monsters: arrayOf(entities.monster), traps: arrayOf(validSavedTrap),
        regions: arrayOf(validGasCloud), levelTimers: arrayOf(validTimer),
        exclusionZones: arrayOf(validExclusion), flags: validFlags,
        bonesNames: optional(arrayOf(string)),
        upstair: optional(validSavedPosition), dnstair: optional(validSavedPosition),
        invocationPosition: optional(validSavedPosition),
        upTeleportRegion: optional(nullable(validArrivalRegion)),
        downTeleportRegion: optional(nullable(validArrivalRegion)),
        engravings: optional(arrayOf(validEngraving)), damagelist: optional(arrayOf(validDamage)),
        elementalBubbles: optional(arrayOf(validBubble)),
        elementalBounds: optional(validElementalBounds),
        _flip: optional((flip): flip is NonNullable<SavedMapData['_flip']> =>
            fieldsMatch<NonNullable<SavedMapData['_flip']>>(flip, {
                flp: integer, minx: integer, miny: integer, maxx: integer, maxy: integer,
            })),
    };
    if (!isSavedRecord(value)) throw new TypeError('Saved level must be a record');
    for (const method of ['at', 'requireAt', 'requireColumn']) {
        if (Object.hasOwn(value, method))
            throw new TypeError(`Saved level must not replace ${method}`);
    }
    if (!fieldsMatch<SavedMapData>(value, fields, key => {
        throw new TypeError(`Saved level has invalid ${key}${entities.failure ? `: ${entities.failure}` : ''}`);
    }))
        throw new TypeError('Saved level failed map validation');
    Object.setPrototypeOf(value, GameMap.prototype);
    if (!(value instanceof GameMap)) throw new TypeError('Saved level could not acquire map methods');
    // C rest_room() rebuilds each parent's pointers into the subroom array.
    // JSON stores those room records twice, so restore their shared identity.
    const subrooms = value.subrooms ?? [];
    for (const room of [...value.rooms, ...subrooms]) {
        if (!('rtype' in room)) continue;
        room.sbrooms = room.sbrooms.map(child => {
            const restored = subrooms.find(candidate => candidate.roomnoidx === child.roomnoidx);
            if (!restored) throw new TypeError(`Saved level has no subroom ${child.roomnoidx}`);
            return restored;
        });
    }
    return value;
}

export function validSavedStairways(value: unknown): value is Stairway | null {
    const seen = new WeakSet<object>();
    function stairway(stair: unknown): stair is Stairway | null {
        if (stair === null) return true;
        if (!isSavedRecord(stair)) return false;
        if (seen.has(stair)) return true;
        seen.add(stair);
        return fieldsMatch<Stairway>(stair, {
            sx: integer, sy: integer, up: boolean, isladder: boolean,
            tolev: validSavedDungeonLocation, u_traversed: boolean, next: stairway,
        });
    }
    return stairway(value);
}
