import type { GameMap } from './game.js';
import type { DisplayGlyph, GlyphMetadata } from './display.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject, LevelTimer } from './object_types.js';

export interface Position {
    x: number;
    y: number;
}

export interface Rectangle {
    lx: number;
    ly: number;
    hx: number;
    hy: number;
}

// C bit fields still have both numeric and boolean writers in the port.
// Keep this bounded until the owning mechanics canonicalize their writes.
export type MapBit = boolean | 0 | 1;

export interface MapLocation {
    typ: number;
    roomno: number;
    lit: boolean;
    waslit: boolean;
    flags: number;
    doormask: number;
    seenv: number;
    lastseentyp: number;
    horizontal: boolean;
    edge: MapBit;
    icedpool: number;
    wall_info: number;
    disp_ch: string;
    disp_color: number;
    disp_decgfx: boolean;
    disp_attr: number;
    gnew: number;
    glyph_symidx: number;
    remembered_glyph?: DisplayGlyph | null | undefined;
    disp_glyph?: GlyphMetadata | null;
    arboreal_sdoor?: MapBit;
    blessedftn?: MapBit;
    candig?: MapBit;
    disturbed?: MapBit;
    emptygrave?: MapBit;
    ladder?: number;
    looted?: number;
    premapped?: boolean;
    drawbridgemask?: number;
    altarmask?: number;
}

export interface Room extends Rectangle {
    rtype: number;
    rlit: 0 | 1;
    doorct: number;
    fdoor: number;
    irregular: boolean;
    needjoining: boolean;
    nsubrooms: number;
    sbrooms: Room[];
    roomnoidx: number;
    needfill: number;
    resident?: Monster | null;
    arrival_room?: boolean;
    orig_rtype?: number;
}

// Native room arrays terminate at hx=-1; vault placement briefly reserves
// only an origin before add_room installs the full room.
export interface RoomSentinel {
    hx: -1;
    lx?: number;
    ly?: number;
}

export interface VaultRoomReservation {
    lx: number;
    ly: number;
    hx?: never;
}

export type RoomEntry = Room | RoomSentinel | VaultRoomReservation;

export function isRoom(entry: RoomEntry | null | undefined): entry is Room {
    return !!entry && 'rtype' in entry;
}

export interface Trap {
    ttyp: number;
    tx: number;
    ty: number;
    tseen: MapBit;
    once: MapBit;
    launch: Position;
    launch2?: Position;
    dst?: DungeonLocation;
    teledest?: Position;
    conjoined?: number;
    tnote?: number;
    madeby_u?: MapBit;
}

export interface GasCloud {
    kind: 'gas-cloud';
    visible: boolean;
    damage: number;
    ttl: number;
    cells: Position[];
    monsterIds: number[];
    heroInside: boolean;
    heroFault?: boolean;
}

export interface ExclusionZone extends Rectangle {
    type: 'teleport' | 'teleport-up' | 'teleport-down' | 'monster-generation';
}

export interface ArrivalRegion extends Rectangle {
    exclude?: Rectangle | null;
}

export interface StairRegion extends Rectangle {
    nlx?: number;
    nly?: number;
    nhx?: number;
    nhy?: number;
}

export interface Stairway {
    sx: number;
    sy: number;
    up: boolean;
    isladder: boolean;
    tolev: DungeonLocation;
    u_traversed: boolean;
    next: Stairway | null;
}

export interface LevelFlags {
    nfountains: number;
    nsinks: number;
    hero_memory: boolean;
    is_maze_lev: boolean;
    has_shop?: boolean;
    has_vault?: boolean;
    has_zoo?: boolean;
    has_court?: boolean;
    has_morgue?: boolean;
    graveyard?: boolean;
    has_beehive?: boolean;
    has_barracks?: boolean;
    has_temple?: boolean;
    has_swamp?: boolean;
    noteleport?: boolean;
    hardfloor?: boolean;
    nommap?: boolean;
    shortsighted?: boolean;
    sokoban_rules?: boolean;
    is_cavernous_lev?: boolean;
    is_rogue_level?: boolean;
    rogue_level?: boolean;
    arboreal?: boolean;
    has_town?: boolean;
    wizard_bones?: boolean;
    corrmaze?: boolean;
    temperature?: number;
    rndmongen?: boolean;
    deathdrops?: boolean;
    noautosearch?: boolean;
    fumaroles?: boolean;
    stormy?: boolean;
    stasis_until?: number;
    is_special?: boolean;
    no_bones?: boolean;
    waterlevel?: boolean;
}

export interface Engraving extends Position {
    text: string;
    erasedPrefix?: string;
    pristine: string;
    rememberedText: string;
    rememberedPrefix?: string;
    epoch: number;
    engr_type: number;
    nowipeout: boolean;
    guardobjects: boolean;
    eread: boolean;
    erevealed: boolean;
}

export interface ShopDamage {
    when: number;
    place: Position;
    cost: number;
    typ: number;
    flags: number;
}

export type BubbleContents =
    | (Position & { kind: 'objects'; items: GameObject[] })
    | (Position & { kind: 'monster'; monster: Monster })
    | (Position & { kind: 'hero' })
    | (Position & { kind: 'trap'; trap: Trap });

export interface ElementalBubble extends Position {
    dx: number;
    dy: number;
    width: number;
    height: number;
    rows: number[];
    contents?: BubbleContents[];
}

export interface ElementalBounds {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    bubbleXMin: number;
    bubbleYMin: number;
    bubbleXMax: number;
    bubbleYMax: number;
}

export interface SpecialLevelContext {
    xstart: number;
    ystart: number;
    width: number;
    height: number;
    readonly _room?: Room;
}

export interface LevelRegion {
    type: 'stair-up' | 'stair-down' | 'branch' | 'portal';
    area: Rectangle;
    exclude: Rectangle | null;
    destination?: string;
}

export interface ActiveSpecialLevel {
    prototype: string;
    file: string;
    variant?: number;
    align?: Array<'law' | 'neutral' | 'chaos'>;
    defaultLit?: boolean | null;
    context?: SpecialLevelContext;
    allowFlips?: number;
    checkInaccessibles?: boolean;
    icedPools?: boolean;
    levelInitialized?: boolean;
    solidify?: boolean;
    premapped?: boolean;
    elementalBubbles?: boolean;
    baalzFixup?: boolean;
    baalzFixupArea?: { x1: number; y1: number; x2: number; y2: number };
    baalzPoolMarkers?: Position[];
    specialMessages?: string[];
    levelRegions?: LevelRegion[];
    upTeleportRegion?: Rectangle;
    upTeleportExclude?: Rectangle | null;
    downTeleportRegion?: Rectangle;
    downTeleportExclude?: Rectangle | null;
}

export interface CachedLevelState {
    level: GameMap;
    stairs: Stairway | null;
    heroTrack?: Position[];
    savedAt: number;
    activeSpecialLevel?: ActiveSpecialLevel | null;
}

// JSON preserves an empty array slot as null; restored floor grids retain
// those vacant columns and piles alongside holes in a newly built level.
export type FloorObjects = Array<Array<GameObject[] | null | undefined> | null | undefined>;

export type { LevelTimer };
