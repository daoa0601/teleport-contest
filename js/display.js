// display.js — Map rendering and terminal output.
// C ref: display.c — newsym, show_glyph, docrt, cls, flush_screen.

import { game } from './gstate.js';
import { currentAttribute } from './attrib.js';
import { nhgetch } from './input.js';
import { cansee, couldsee, vision_recalc } from './vision.js';
import {
    COLNO, ROWNO, STONE, ROOM, CORR, SCORR, SDOOR, DOOR, STAIRS, FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE,
    HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    TREE, IRONBARS, POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, AIR, CLOUD,
    IS_POOL, IS_OBSTRUCTED,
    D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED,
    SV0, SV1, SV2, SV3, SV4, SV5, SV6, SV7,
    WM_X_TL, WM_X_TR, WM_X_BL, WM_X_BR, WM_X_TLBR, WM_X_BLTR,
    WEB, VIBRATING_SQUARE, M_AP_MONSTER, M_AP_OBJECT, def_warnsyms,
    In_endgame, Is_rogue_level,
} from './const.js';
import {
    NO_COLOR, ATR_INVERSE, CLR_BLACK,
    CLR_RED, CLR_GREEN, CLR_GRAY, CLR_BROWN, CLR_MAGENTA, CLR_CYAN, CLR_WHITE, CLR_YELLOW,
    CLR_BLUE, CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_BRIGHT_BLUE,
    CLR_BRIGHT_MAGENTA,
    DEC_TO_UNICODE,
} from './terminal.js';
import {
    LARGE_BOX, CHEST, GOLD_PIECE, FOOD_RATION, CORPSE, TOWEL, STATUE,
    BOULDER,
    OBJECT_BASES, OBJECT_COLOR,
} from './object_data.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3,
    MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM,
    monsterTypeName,
} from './monster_data.js';
import { rn2Display } from './rng.js';
import {
    BOGUS_MONSTERS, BOGUS_MONSTER_FILE_SIZE,
} from './random_text_data.js';
import { depth as dungeonDepth, endgameLevelName } from './hacklib.js';
import { recordObjectEncounter } from './object_knowledge.js';

const OBJECT_SYMBOLS = ['', ']', ')', '[', '=', '"', '(', '%', '!', '?',
    '+', '/', '$', '*', '`', '0', '_', '.'];
// C drawing.c:def_r_oc_syms.  Rogue deliberately resembles the older game:
// armor uses ']', amulets ',', food ':', and coins share gems' '*'.
const ROGUE_OBJECT_SYMBOLS = ['', ']', ')', ']', '=', ',', '(', ':', '!', '?',
    '+', '/', '*', '*', '`', '0', '_', '.'];
const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];

function activeObjectSymbols() {
    return Is_rogue_level(game.u?.uz)
        ? ROGUE_OBJECT_SYMBOLS : OBJECT_SYMBOLS;
}

const M3_INFRAVISIBLE = 0x0200;
const M1_FLY = 0x00000001;
const M1_MINDLESS = 0x00010000;
const TELEPATHY_RANGE = 8 * 8; // BOLT_LIM squared
const HELM_OF_TELEPATHY = 100;
const AMULET_OF_ESP = 201;

function unblindTelepathyRange() {
    const wornSources = [game.uarmh, game.uamul].filter(object => object
        && (object.otyp === HELM_OF_TELEPATHY
            || object.otyp === AMULET_OF_ESP)).length;
    const liveRange = wornSources * TELEPATHY_RANGE;
    const storedRange = game.u?.unblind_telepat_range ?? -1;
    return Math.max(liveRange || -1, storedRange);
}

function senseWithTelepathy(monster) {
    if (!monster
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_MINDLESS)) return false;
    const range = unblindTelepathyRange();
    if (range < 0) return false;
    const dx = monster.mx - game.u.ux;
    const dy = monster.my - game.u.uy;
    return dx * dx + dy * dy <= range;
}

function canPhysicallyProjectMonster(monster, x, y) {
    if (cansee(x, y)) return !monster.minvis && !monster.mundetected;
    return !game.blind && !!game.u?.infravision
        && !!((MONSTER_FLAGS3[monster.mnum] ?? 0) & M3_INFRAVISIBLE)
        && couldsee(x, y) && !monster.minvis && !monster.mundetected;
}

// C display.h:canseemon().  Keep optical visibility distinct from sensory
// projection: combat punctuation uses canseemon(), while newsym() and
// canspotmon() can additionally reveal a telepathically sensed actor.
export function canSeeMonster(monster, x, y) {
    // While swallowed, the engulfer occupies the hero's coordinate but is
    // not a map-visible monster for canseemon(); attack text can still name
    // it through u.ustuck.
    if ((game.u?.uswallow || game.uswallow)
        && game.u?.ustuck === monster) return false;
    return canPhysicallyProjectMonster(monster, x, y);
}

export function canProjectMonster(monster, x, y) {
    // tp_sensemon() precedes physical visibility, infrared, and warning in
    // display.c:newsym().  It also reveals an otherwise invisible or hidden
    // monster because the projection is sensory rather than optical.
    return senseWithTelepathy(monster)
        || canPhysicallyProjectMonster(monster, x, y);
}

// C display.h:canspotmon().  Physical/telepathic projection is shared with
// newsym(); an active monster-detection property senses the actor without
// making its square optically visible.  Type/class warning can join this
// boundary when that distinct property is ported; ordinary Warning uses a
// warning glyph and is deliberately not canspotmon().
export function canSpotMonster(monster, x = monster?.mx, y = monster?.my) {
    return !!monster && (
        canProjectMonster(monster, x, y)
        || !!game.u?.detectMonsters
        || !!game.detectMonsters
    );
}

export function monsterHasWarningProjection(monster) {
    if (!monster || !game.u?.warning || monster.mpeaceful) return null;
    const dx = monster.mx - game.u.ux, dy = monster.my - game.u.uy;
    if (dx * dx + dy * dy >= 100) return null;
    const level = Math.min(def_warnsyms.length - 1,
        Math.trunc((monster.m_lev ?? 0) / 4));
    return level >= (game.context?.warnlevel ?? 1);
}

function warningProjection(monster) {
    if (!monsterHasWarningProjection(monster)) return null;
    const level = hallucinationActive()
        ? rn2Display(def_warnsyms.length - 1) + 1
        : Math.min(def_warnsyms.length - 1,
            Math.trunc((monster.m_lev ?? 0) / 4));
    return def_warnsyms[level];
}

export function objectUsesGenericGlyph(object) {
    if (object?.dknown) return false;
    return object?.oclass === 8 // POTION_CLASS
        || (object?.otyp >= 439 && object?.otyp <= 469) // real/glass gems
        || (object?.otyp >= 366 && object?.otyp <= 407); // ordinary spells
}

function observeNearbyObject(object, x, y) {
    const generic = objectUsesGenericGlyph(object);
    // C display.c:map_object() only promotes a map projection into an
    // observation when the glyph is generic.  An ordinary type-specific
    // glyph can be rendered without adding that type to discoveries; explicit
    // examination, inventory, and pickup paths own those encounters.
    if (!generic) return false;
    const range = Math.max(game.u?.xray_range ?? -1, 2);
    const dx = x - game.u.ux, dy = y - game.u.uy;
    const nearDistance = range * range * 2 - range;
    if (dx * dx + dy * dy > nearDistance) return false;
    if (game.u?.hallucinating || (game.u?.hallucinationTurns ?? 0) > 0)
        return false;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
    return true;
}

// C display.c:see_nearby_objects(), called by dungeon.c:u_on_newpos().  A
// generic object can remain continuously visible while the hero crosses the
// close-observation boundary, so visibility transitions alone cannot own its
// repaint.
export function see_nearby_objects() {
    const r = Math.max(game.u?.xray_range ?? -1, 2);
    const nearDistance = r * r * 2 - r;
    for (let y = (game.u?.uy ?? 0) - r; y <= (game.u?.uy ?? 0) + r; y++) {
        for (let x = (game.u?.ux ?? 0) - r; x <= (game.u?.ux ?? 0) + r; x++) {
            const object = game.level?.objects?.[x]?.[y]?.[0];
            if (!object || object.dknown || !cansee(x, y)) continue;
            const dx = x - game.u.ux, dy = y - game.u.uy;
            if (dx * dx + dy * dy > nearDistance) continue;
            const wasGeneric = objectUsesGenericGlyph(object);
            // Unlike map_object(), display.c:see_nearby_objects() observes
            // every visible object inside the close-name radius.  Only the
            // repaint is conditional on its old glyph having been generic.
            if (game.u?.hallucinating || (game.u?.hallucinationTurns ?? 0) > 0)
                continue;
            object.dknown = true;
            recordObjectEncounter(object.otyp);
            if (wasGeneric && object.dknown) newsym(x, y);
        }
    }
}

export function objectColor(object) {
    if (Number.isInteger(object?.color)) return object.color;
    // C obj_is_generic(): hide potion/gem/spellbook appearance until the
    // hero has observed it closely enough. Generic class rows are indexed by
    // oclass and deliberately use the ordinary gray tty foreground.
    if (objectUsesGenericGlyph(object))
        return OBJECT_COLOR[object.oclass] ?? CLR_GRAY;
    if (game._monkNorthPath && object?.oclass === 8) return NO_COLOR;
    // C obj_to_glyph(): a corpse keeps the depicted monster's color; it is
    // not colored as a generic food-class object.
    if (object?.otyp === CORPSE && Number.isInteger(object?.corpsenm))
        return MONSTER_COLOR[object.corpsenm] ?? CLR_BROWN;
    if (object?.otyp === TOWEL) return CLR_MAGENTA;
    if (object?.otyp === LARGE_BOX || object?.otyp === CHEST) return CLR_BROWN;
    if (object?.otyp === FOOD_RATION) return CLR_BROWN;
    if (object?.otyp === GOLD_PIECE) return CLR_YELLOW;
    const metadataColor = game.objectColors?.[object?.otyp]
        ?? OBJECT_COLOR[object?.otyp];
    return Number.isInteger(metadataColor) ? metadataColor : CLR_GRAY;
}

// ── ANSI color codes ──
// Maps CLR_* constants (0-15) to ANSI SGR color codes.
// C ref: wintty.c term_start_color
const ANSI_DEFAULT = 39;
const ANSI_COLOR = [
    90,  // CLR_BLACK     0 → tty dark gray when wc2_darkgray is enabled
    31,  // CLR_RED       1
    32,  // CLR_GREEN     2
    33,  // CLR_BROWN     3
    34,  // CLR_BLUE      4
    35,  // CLR_MAGENTA   5
    36,  // CLR_CYAN      6
    39,  // CLR_GRAY      7 → tty's ordinary foreground
    39,  // NO_COLOR      8 → default
    91,  // CLR_ORANGE    9
    92,  // CLR_BRIGHT_GREEN  10
    93,  // CLR_YELLOW    11
    94,  // CLR_BRIGHT_BLUE   12
    95,  // CLR_BRIGHT_MAGENTA 13
    96,  // CLR_BRIGHT_CYAN   14
    97,  // CLR_WHITE     15
    90,  // remembered room/corridor while blind (tty dark gray)
];

function rememberedColor(glyph, loc, x, y) {
    // display.c maps an unlit corridor with S_litcorr only while it is in
    // sight.  When that live projection becomes hero memory, retain the lit
    // identity only for a location whose own waslit bit supports it.
    if (glyph?.kind === 'terrain' && glyph.ch === '#'
        && loc?.typ === CORR && !loc.waslit && !cansee(x, y)
        && glyph.color === CLR_WHITE) {
        glyph.color = NO_COLOR;
    }
    // Preserve the port's established blind-memory behavior on ordinary
    // levels.  Premapped levels distinguish background from mapped objects
    // and traps, just as C's glyph categories do.
    // display.c only substitutes DARKROOMSYM when the remembered glyph is
    // the room terrain itself.  Objects, traps, and engravings keep their
    // remembered glyph (and color) when blindness removes IN_SIGHT.
    const darkRoomMemory = glyph?.kind === 'terrain' && loc?.typ === ROOM
        && (loc.premapped
            ? !cansee(x, y) && (game.flags?.dark_room ?? true)
                && game.flags?.color !== false
            : game.blind);
    return darkRoomMemory ? 16 : glyph?.color;
}

function stairColor(x, y) {
    // C stairway records retain their destination. A connection into another
    // dungeon is a branch stair (yellow); an edge within this dungeon is an
    // ordinary stair (gray/default tty foreground).
    let stair = game.stairs;
    while (stair && (stair.sx !== x || stair.sy !== y)) stair = stair.next;
    const currentDungeon = game.u?.uz?.dnum ?? 0;
    return stair?.u_traversed
        && stair?.tolev?.dnum !== undefined
        && stair.tolev.dnum !== currentDungeon ? CLR_YELLOW : CLR_GRAY;
}

// C ref: display.c wall_angle(), straight-wall and corner cases.  A room's
// unfinished exterior face is stored in the low three wall_info bits.  Seen
// vectors which only approach from that rock side project unexplored stone,
// not the nominal line-drawing wall.
function simpleWallVisible(loc) {
    const seenv = (loc.seenv || 0) & 0xff;
    const mode = (loc.wall_info || 0) & 0x07;
    if (!seenv) return false;
    switch (loc.typ) {
    case SDOOR:
        if (!loc.horizontal) {
            if (mode === 1) return !!(seenv & (SV1 | SV2 | SV3 | SV4 | SV5));
            if (mode === 2) return !!(seenv & (SV0 | SV1 | SV5 | SV6 | SV7));
        } else {
            if (mode === 1) return !!(seenv & (SV3 | SV4 | SV5 | SV6 | SV7));
            if (mode === 2) return !!(seenv & (SV0 | SV1 | SV2 | SV3 | SV7));
        }
        return true;
    case VWALL:
        if (mode === 1) return !!(seenv & (SV1 | SV2 | SV3 | SV4 | SV5));
        if (mode === 2) return !!(seenv & (SV0 | SV1 | SV5 | SV6 | SV7));
        return true;
    case HWALL:
        if (mode === 1) return !!(seenv & (SV3 | SV4 | SV5 | SV6 | SV7));
        if (mode === 2) return !!(seenv & (SV0 | SV1 | SV2 | SV3 | SV7));
        return true;
    case TLCORNER:
        if (mode === 1) return !!(seenv & (SV3 | SV4 | SV5));
        if (mode === 2) return !!(seenv & ~SV4);
        return true;
    case TRCORNER:
        if (mode === 1) return !!(seenv & (SV5 | SV6 | SV7));
        if (mode === 2) return !!(seenv & ~SV6);
        return true;
    case BLCORNER:
        if (mode === 1) return !!(seenv & (SV1 | SV2 | SV3));
        if (mode === 2) return !!(seenv & ~SV2);
        return true;
    case BRCORNER:
        if (mode === 1) return !!(seenv & (SV7 | SV0 | SV1));
        if (mode === 2) return !!(seenv & ~SV0);
        return true;
    default:
        return true;
    }
}

// C ref: display.c wall_angle(), T-wall arm.  T walls retain their topology
// type while their visible glyph changes with the accumulated seen vector.
// This matters when opening a nearby door reveals a previously hidden arm:
// the same TUWALL can project as a corner, straight wall, or full tee.
function projectedTWallType(loc) {
    let seenv = (loc.seenv || 0) & 0xff;
    let row;
    switch (loc.typ) {
    case TDWALL:
        row = [STONE, TLCORNER, TRCORNER, HWALL, TDWALL];
        break;
    case TLWALL:
        row = [STONE, TRCORNER, BRCORNER, VWALL, TLWALL];
        seenv = ((seenv >> 2) | (seenv << 6)) & 0xff;
        break;
    case TUWALL:
        row = [STONE, BRCORNER, BLCORNER, HWALL, TUWALL];
        seenv = ((seenv >> 4) | (seenv << 4)) & 0xff;
        break;
    case TRWALL:
        row = [STONE, BLCORNER, TLCORNER, VWALL, TRWALL];
        seenv = ((seenv >> 6) | (seenv << 2)) & 0xff;
        break;
    default:
        return loc.typ;
    }

    const only = bits => !!(seenv & bits) && !(seenv & ~bits);
    const mode = (loc.wall_info || 0) & 0x07;
    let column = 0;
    if (mode === 0) {
        if (seenv === SV4) column = 1;
        else if (seenv === SV6) column = 2;
        else if (seenv & (SV3 | SV5 | SV7)
            || ((seenv & SV4) && (seenv & SV6))) column = 4;
        else if (seenv & (SV0 | SV1 | SV2))
            column = seenv & (SV4 | SV6) ? 4 : 3;
    } else if (mode === 1) {
        if ((seenv & (SV3 | SV4)) && !(seenv & (SV5 | SV6 | SV7)))
            column = 1;
        else if ((seenv & (SV6 | SV7)) && !(seenv & (SV3 | SV4 | SV5)))
            column = 2;
        else if ((seenv & SV5)
            || ((seenv & (SV3 | SV4)) && (seenv & (SV6 | SV7))))
            column = 4;
    } else if (mode === 2) {
        if (only(SV4 | SV5)) column = 1;
        else if ((seenv & (SV0 | SV1 | SV2 | SV7))
            && !(seenv & (SV3 | SV4 | SV5))) column = 3;
        else if (!only(SV6)) column = 4;
    } else if (mode === 3) {
        if (only(SV5 | SV6)) column = 2;
        else if ((seenv & (SV0 | SV1 | SV2 | SV3))
            && !(seenv & (SV5 | SV6 | SV7))) column = 3;
        else if (!only(SV4)) column = 4;
    }
    return row[column];
}

// C display.c:wall_angle() CROSSWALL case.  Cross-wall topology is stable,
// but its visible glyph is the subset of arms approached by the hero.  The
// wall mode additionally records which quadrant(s) remain unfinished rock.
function projectedCrossWallType(loc) {
    let seenv = (loc.seenv || 0) & 0xff;
    const mode = (loc.wall_info || 0) & 0x07;
    const only = bits => !(seenv & ~bits);

    if (mode === 0) {
        if (seenv === SV0) return BRCORNER;
        if (seenv === SV2) return BLCORNER;
        if (seenv === SV4) return TLCORNER;
        if (seenv === SV6) return TRCORNER;
        if (!(seenv & ~(SV0 | SV1 | SV2))
            && ((seenv & SV1) || seenv === (SV0 | SV2))) return TUWALL;
        if (!(seenv & ~(SV2 | SV3 | SV4))
            && ((seenv & SV3) || seenv === (SV2 | SV4))) return TRWALL;
        if (!(seenv & ~(SV4 | SV5 | SV6))
            && ((seenv & SV5) || seenv === (SV4 | SV6))) return TDWALL;
        if (!(seenv & ~(SV0 | SV6 | SV7))
            && ((seenv & SV7) || seenv === (SV0 | SV6))) return TLWALL;
        return CROSSWALL;
    }

    const rows = {
        bl: [BRCORNER, BLCORNER, TLCORNER, TUWALL, TRWALL, CROSSWALL],
        tl: [BLCORNER, TLCORNER, TRCORNER, TRWALL, TDWALL, CROSSWALL],
        tr: [TLCORNER, TRCORNER, BRCORNER, TDWALL, TLWALL, CROSSWALL],
        br: [TRCORNER, BRCORNER, BLCORNER, TLWALL, TUWALL, CROSSWALL],
    };
    let row;
    if (mode === WM_X_TL) {
        row = rows.tl;
        seenv = ((seenv >> 4) | (seenv << 4)) & 0xff;
    } else if (mode === WM_X_TR) {
        row = rows.tr;
        seenv = ((seenv >> 6) | (seenv << 2)) & 0xff;
    } else if (mode === WM_X_BL) {
        row = rows.bl;
        seenv = ((seenv >> 2) | (seenv << 6)) & 0xff;
    } else if (mode === WM_X_BR) {
        row = rows.br;
    }

    if (row) {
        if (seenv === SV4) return STONE;
        seenv &= ~SV4;
        let column;
        if (seenv === SV0) column = 1;
        else if (seenv & (SV2 | SV3)) {
            if (seenv & (SV5 | SV6 | SV7)) column = 5;
            else if (seenv & (SV0 | SV1)) column = 4;
            else column = 2;
        } else if (seenv & (SV5 | SV6)) {
            if (seenv & (SV1 | SV2 | SV3)) column = 5;
            else if (seenv & (SV0 | SV7)) column = 3;
            else column = 0;
        } else if (seenv & SV1) column = seenv & SV7 ? 5 : 4;
        else if (seenv & SV7) column = seenv & SV1 ? 5 : 3;
        else column = 5;
        return row[column];
    }

    if (mode === WM_X_TLBR) {
        if (only(SV1 | SV2 | SV3)) return BLCORNER;
        if (only(SV5 | SV6 | SV7)) return TRCORNER;
        if (only(SV0 | SV4)) return STONE;
        return CROSSWALL;
    }
    if (mode === WM_X_BLTR) {
        if (only(SV0 | SV1 | SV7)) return BRCORNER;
        if (only(SV3 | SV4 | SV5)) return TLCORNER;
        if (only(SV2 | SV6)) return STONE;
        return CROSSWALL;
    }
    return STONE;
}

// ── Terrain to display character + color + DEC flag ──
export function terrain_glyph(loc, x, y) {
    const typ = loc.typ === CROSSWALL
        ? projectedCrossWallType(loc) : projectedTWallType(loc);
    const rogue = Is_rogue_level(game.u?.uz);
    const dec = !rogue && /^DECgraphics$/i.test(game.symset || '');
    // C mapglyph() selects a branch-specific wall glyph family.  This source
    // tree's wallcolors[] keeps Sokoban at CLR_GRAY, which tty serializes as
    // the ordinary foreground; preserve the separately witnessed Mines and
    // Gehennom colors.
    const inMines = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname
        === 'The Gnomish Mines';
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? -1]?.flags?.hellish;
    const wallColor = rogue ? NO_COLOR
        : game.level?.flags?.sokoban_rules
        ? (dec ? CLR_BLUE : NO_COLOR)
        : inMines ? CLR_BROWN
            : inHell ? CLR_RED : NO_COLOR;
    switch (typ) {
    case STONE:     return { ch: ' ', color: NO_COLOR, dec: false };
    case SCORR:     return { ch: ' ', color: NO_COLOR, dec: false };
    case ROOM:      return dec
        ? { ch: '~', color: NO_COLOR, dec: true }
        : { ch: '.', color: NO_COLOR, dec: false };
    // C back_to_glyph(): a corridor currently lit for display uses S_litcorr.
    // tty renders that CLR_GRAY symbol with its bright foreground treatment;
    // CLR_WHITE is the equivalent serialized color in this port.
    case CORR:      return {
        ch: '#',
        color: (cansee(x, y) ? loc.lit : loc.waslit)
            || game.flags?.lit_corridor ? CLR_WHITE : NO_COLOR,
        dec: false,
    };
    case SDOOR:
        if (!simpleWallVisible(loc))
            return { ch: ' ', color: NO_COLOR, dec: false };
        if (!dec) return loc.horizontal
            ? { ch: '-', color: wallColor, dec: false }
            : { ch: '|', color: wallColor, dec: false };
        return loc.horizontal
            ? { ch: 'q', color: wallColor, dec: true }
            : { ch: 'x', color: wallColor, dec: true };
    case DOOR:
        if (rogue)
            return { ch: '+', color: NO_COLOR, dec: false };
        if (loc.doormask & D_ISOPEN)
            return dec
                ? { ch: 'a', color: CLR_BROWN, dec: true }
                : { ch: '-', color: CLR_BROWN, dec: false };
        if (loc.doormask & (D_CLOSED | D_LOCKED))
            return { ch: '+', color: CLR_BROWN, dec: false };
        return dec
            ? { ch: '~', color: NO_COLOR, dec: true }
            : { ch: '.', color: NO_COLOR, dec: false };  // D_NODOOR = floor
    case STAIRS:
        if (rogue)
            return { ch: '%', color: NO_COLOR, dec: false };
        // Terrain type stores the character family; the linked stairway owns
        // the destination which distinguishes ordinary from branch glyphs.
        if (game.level?.upstair?.x === x && game.level?.upstair?.y === y) {
            return { ch: '<', color: stairColor(x, y), dec: false };
        }
        return { ch: '>', color: stairColor(x, y), dec: false };
    case FOUNTAIN:   return { ch: '{', color: CLR_BRIGHT_BLUE, dec: false };
    case THRONE:     return { ch: '\\', color: CLR_YELLOW, dec: false };
    case SINK:       return { ch: '{', color: CLR_WHITE, dec: false };
    case GRAVE:      return { ch: '|', color: CLR_WHITE, dec: false };
    case ALTAR:
        // DECgraphics uses the altar's pi glyph.  Unaligned altars are red;
        // aligned variants retain the terminal's ordinary foreground until
        // their full alignment-color projection is needed.
        return dec
            ? { ch: '{', color: loc.flags ? NO_COLOR : CLR_RED, dec: true }
            : { ch: '_', color: loc.flags ? NO_COLOR : CLR_RED, dec: false };
    case TREE:       return dec
        ? { ch: 'g', color: CLR_GREEN, dec: true }
        : { ch: '#', color: CLR_GREEN, dec: false };
    case IRONBARS:   return dec
        ? { ch: '|', color: CLR_CYAN, dec: true }
        : { ch: '#', color: CLR_CYAN, dec: false };
    case POOL:
    case MOAT:       return dec
        ? { ch: '`', color: CLR_BLUE, dec: true }
        : { ch: '}', color: CLR_BLUE, dec: false };
    case WATER:      return dec
        ? { ch: '`', color: CLR_BRIGHT_BLUE, dec: true }
        : { ch: '}', color: CLR_BRIGHT_BLUE, dec: false };
    case LAVAPOOL:   return dec
        ? { ch: '`', color: CLR_RED, dec: true }
        : { ch: '}', color: CLR_RED, dec: false };
    case LAVAWALL:   return dec
        ? { ch: '`', color: CLR_ORANGE, dec: true }
        : { ch: '}', color: CLR_ORANGE, dec: false };
    case AIR:        return { ch: ' ', color: CLR_CYAN, dec: false };
    case CLOUD:      return { ch: '#', color: CLR_GRAY, dec: false };
    // Wall types → DEC line-drawing characters
    case HWALL:
        if (!simpleWallVisible(loc)) return { ch: ' ', color: NO_COLOR, dec: false };
        return dec ? { ch: 'q', color: wallColor, dec: true } : { ch: '-', color: wallColor, dec: false };
    case VWALL:
        if (!simpleWallVisible(loc)) return { ch: ' ', color: NO_COLOR, dec: false };
        return dec ? { ch: 'x', color: wallColor, dec: true } : { ch: '|', color: wallColor, dec: false };
    case TLCORNER:
    case TRCORNER:
    case BLCORNER:
    case BRCORNER:
        if (!simpleWallVisible(loc)) return { ch: ' ', color: NO_COLOR, dec: false };
        return dec ? { ch: ({ [TLCORNER]: 'l', [TRCORNER]: 'k', [BLCORNER]: 'm', [BRCORNER]: 'j' })[typ], color: wallColor, dec: true } : { ch: '-', color: wallColor, dec: false };
    case CROSSWALL:
    case TUWALL:
    case TDWALL:    return dec ? {
        ch: ({ [CROSSWALL]: 'n', [TUWALL]: 'v', [TDWALL]: 'w' })[typ],
        color: wallColor,
        dec: true,
    } : { ch: '-', color: wallColor, dec: false };
    case TLWALL:
    case TRWALL:    return dec ? {
        ch: ({ [TLWALL]: 'u', [TRWALL]: 't' })[typ],
        color: wallColor,
        dec: true,
    } : { ch: '|', color: wallColor, dec: false };
    default:        return { ch: '?', color: NO_COLOR, dec: false };
    }
}

function objectIsPiletop(object) {
    const pile = game.level?.objects?.[object?.ox]?.[object?.oy];
    return Array.isArray(pile) && pile[0] === object && pile.length > 1
        && (object.otyp !== BOULDER || pile[1]?.otyp === BOULDER);
}

function objectGlyphAttr(glyph) {
    const useInverse = game.flags?.use_inverse !== false
        && game.iflags?.wc_inverse !== false
        && game.iflags?.use_inverse !== false;
    return glyph?.piletop && game.flags?.hilite_pile && useInverse
        ? ATR_INVERSE : 0;
}

function hallucinationActive() {
    return !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
}

function displayMonsterGlyph(mnum) {
    const rawColor = MONSTER_COLOR[mnum] ?? CLR_GRAY;
    return {
        ch: MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[mnum]] || '?',
        // tty renders black and ordinary gray monster glyphs through its
        // default foreground rather than retaining an explicit color code.
        color: rawColor === CLR_BLACK || rawColor === CLR_GRAY
            ? NO_COLOR : rawColor,
        decgfx: false, kind: 'monster', piletop: false,
    };
}

function heroDisplayGlyph() {
    if ((game.u?.mtimedone ?? 0) > 0
        && Number.isInteger(game.u?.umonnum))
        return displayMonsterGlyph(game.u.umonnum);
    return { ch: '@', color: CLR_WHITE, decgfx: false };
}

// C display.h:canspotself().  See-invisible does not make the hero's own
// glyph opaque again; ordinary self projection depends on not being
// invisible, while telepathy/detection can supply a sensory projection.
function canSpotHeroSelf() {
    const invisible = !!(
        game.u?.invisible || game.u?.invis || game.invisible
    );
    const canSeeSelf = !!(
        game.blind || game.u?.uswallow
        || (!invisible && !game.u?.uundetected)
    );
    const sensesSelf = unblindTelepathyRange() >= 0
        || !!(game.u?.monsterDetection
            || (game.u?.monsterDetectionTurns ?? 0) > 0);
    return canSeeSelf || sensesSelf;
}

function objectClassForType(otyp) {
    for (let cls = 2; cls < OBJECT_BASES.length - 1; cls++) {
        if (otyp >= OBJECT_BASES[cls] && otyp < OBJECT_BASES[cls + 1])
            return cls;
    }
    return 1;
}

// display.h:random_obj_to_glyph().  Generic object slots 0..17 are excluded;
// a randomly selected corpse consumes a second display draw for its color.
function randomHallucinatedObjectGlyph() {
    const firstObject = OBJECT_BASES[2];
    const otyp = rn2Display(OBJECT_COLOR.length - firstObject) + firstObject;
    if (otyp === CORPSE) {
        const mnum = rn2Display(MONSTER_COLOR.length);
        return {
            ch: activeObjectSymbols()[7],
            color: MONSTER_COLOR[mnum] ?? CLR_GRAY,
            decgfx: false, kind: 'object', piletop: false,
        };
    }
    const oclass = objectClassForType(otyp);
    return {
        ch: activeObjectSymbols()[oclass] || '?',
        // glyphs.c resolves the randomly selected object number through the
        // runtime objects[] table.  o_init() shuffles oc_color together with
        // unidentified descriptions, so Hallucination must not use the
        // generated compile-time color table here.
        color: game.objectColors?.[otyp] ?? OBJECT_COLOR[otyp] ?? CLR_GRAY,
        decgfx: false, kind: 'object', piletop: false,
    };
}

function objectGlyph(object) {
    const piletop = objectIsPiletop(object);
    if (hallucinationActive()) {
        // display.h:statue_to_glyph() uses a monster plus random gender;
        // map_object() separately stores a random-object memory glyph below.
        if (object.otyp === STATUE) {
            const glyph = displayMonsterGlyph(
                rn2Display(MONSTER_COLOR.length),
            );
            rn2Display(2);
            return glyph;
        }
        return randomHallucinatedObjectGlyph();
    }
    const statueSymbol = object.otyp === STATUE
        ? MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[object.corpsenm]]
        : null;
    return statueSymbol
        ? {
            ch: statueSymbol, color: CLR_WHITE, decgfx: false,
            kind: 'object', piletop,
        }
        : {
            ch: activeObjectSymbols()[object.oclass] || '?',
            color: objectColor(object), decgfx: false,
            kind: 'object', piletop,
        };
}

// C display.h:obj_to_glyph(), for tmp_at() callers.  A projectile has already
// been extracted from the floor chain, so this deliberately derives only its
// transient glyph and does not mutate hero memory or object discovery state.
// Hallucination consumes the display RNG once when the flight starts; callers
// reuse the returned glyph for every animation cell.
export function transientObjectGlyph(object) {
    const glyph = objectGlyph(object);
    return {
        ch: glyph.ch,
        // tty does not emit explicit black/ordinary-gray foreground unless
        // dark-gray is enabled; those object glyphs use the default color.
        color: glyph.color === CLR_BLACK || glyph.color === CLR_GRAY
            ? NO_COLOR : glyph.color,
        decgfx: glyph.decgfx,
        attr: objectGlyphAttr(glyph),
    };
}

// C inventory menus attach obj_to_glyph() metadata to every real item even
// though tty's text presentation does not show a separate glyph column.  The
// metadata construction remains display-RNG-visible under Hallucination.
export function consumeHallucinatedMenuObjectGlyph(object) {
    if (!hallucinationActive() || !object) return null;
    return objectGlyph(object);
}

function apparentObjectGlyph(monster) {
    const otyp = monster.mappearance;
    const oclass = objectClassForType(otyp);
    return objectGlyph({
        otyp,
        oclass,
        corpsenm: monster.mcorpsenm,
        dknown: true,
    });
}

// C refs: display.c map_background(), map_object(), and map_trap().  These
// update hero memory independently from ordinary line-of-sight newsym().
export function map_background(x, y, show = true) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    const glyph = terrain_glyph(loc, x, y);
    if (game.level?.flags?.hero_memory)
        loc.remembered_glyph = {
            ch: glyph.ch, color: glyph.color, decgfx: glyph.dec,
            kind: 'terrain',
        };
    if (show) show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec);
}

export function map_object(object, show = true, observe = true) {
    if (!object) return;
    if (observe && cansee(object.ox, object.oy))
        observeNearbyObject(object, object.ox, object.oy);
    const glyph = objectGlyph(object);
    const loc = game.level?.at(object.ox, object.oy);
    if (loc && game.level?.flags?.hero_memory) {
        // While hallucinating, a statue is displayed as a random monster but
        // remembered as a separately randomized object (display.c:map_object).
        loc.remembered_glyph = hallucinationActive()
            && object.otyp === STATUE
            ? randomHallucinatedObjectGlyph() : glyph;
    }
    if (show)
        show_glyph_cell(object.ox, object.oy, glyph.ch, glyph.color, false,
            objectGlyphAttr(glyph));
}

const TRAP_COLOR = [
    NO_COLOR, CLR_CYAN, CLR_CYAN, CLR_GRAY, CLR_BROWN, CLR_CYAN,
    CLR_RED, CLR_GRAY, CLR_BRIGHT_BLUE, CLR_BLUE, CLR_ORANGE,
    0, 0, CLR_BROWN, CLR_BROWN, CLR_MAGENTA, CLR_MAGENTA,
    CLR_BRIGHT_MAGENTA, CLR_GRAY, CLR_GRAY, CLR_BRIGHT_BLUE,
    CLR_BRIGHT_BLUE, CLR_BRIGHT_GREEN, CLR_MAGENTA, CLR_ORANGE, CLR_ORANGE,
];

export function map_trap(trap, show = true) {
    if (!trap) return;
    trap.tseen = true;
    const ch = trap.ttyp === WEB ? '"'
        : trap.ttyp === VIBRATING_SQUARE ? '~' : '^';
    const color = TRAP_COLOR[trap.ttyp] ?? NO_COLOR;
    const loc = game.level?.at(trap.tx, trap.ty);
    if (loc && game.level?.flags?.hero_memory)
        loc.remembered_glyph = { ch, color, decgfx: false, kind: 'trap' };
    if (show) show_glyph_cell(trap.tx, trap.ty, ch, color, false);
}

export function map_engraving(engraving, show = true) {
    if (!engraving) return;
    const loc = game.level?.at(engraving.x, engraving.y);
    if (!loc) return;
    const ch = loc.typ === CORR ? '#' : '`';
    const glyph = {
        ch, color: CLR_BRIGHT_BLUE, decgfx: false, kind: 'engraving',
    };
    if (game.level?.flags?.hero_memory) loc.remembered_glyph = glyph;
    if (show)
        show_glyph_cell(engraving.x, engraving.y, ch, CLR_BRIGHT_BLUE, false);
}

function engravingAt(x, y) {
    return game.level?.engravings?.find(engraving =>
        engraving.x === x && engraving.y === y);
}

function coversNonlivingLocation(x, y) {
    const typ = game.level?.at(x, y)?.typ;
    const underwater = !!(game.underwater || game.u?.uinwater);
    // C display.h:covers_objects()/covers_traps(). Pools cease covering the
    // lower layers while the hero is underwater; lava always covers them.
    return (IS_POOL(typ) && !underwater)
        || typ === LAVAPOOL || typ === LAVAWALL;
}

function monsterAtMapCell(x, y) {
    return game.level?.monsters?.find(monster => !monster.dead
        && (monster.mhp ?? 1) > 0
        && ((monster.mx === x && monster.my === y)
            || monster.wormSegments?.some(segment =>
                segment.x === x && segment.y === y)));
}

// C display.c:_map_location().
function mapNonlivingLocation(x, y, show = true) {
    const covered = coversNonlivingLocation(x, y);
    const object = game.level?.objects?.[x]?.[y]?.[0];
    if (object && !covered) {
        map_object(object, show);
        return;
    }
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && !covered) {
        map_trap(trap, show);
        return;
    }
    const engraving = engravingAt(x, y);
    const spotShowsEngraving = loc =>
        loc?.typ === ROOM || loc?.typ === CORR || loc?.typ === ICE;
    if (engraving?.erevealed && spotShowsEngraving(game.level?.at(x, y))
        && !covered) {
        map_engraving(engraving, show);
        return;
    }
    map_background(x, y, show);
}

// C display.c:feel_location().  Blind explicit search refreshes each adjacent
// nonliving layer before it tests for a concealed monster or trap.  This is
// why a felt floor object can remain in hero memory after a later invisible
// actor marker is installed elsewhere during the same search.
export function feel_location(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    const monster = game.level?.monsters?.find(candidate =>
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mx === x && candidate.my === y);
    if (loc.remembered_glyph?.kind === 'invisible' && monster) return;

    const cannotReachFloor = !!(
        game.u?.levitating || game.levitating
        || game.u?.flying || game.flying
    );
    if (!cannotReachFloor) {
        mapNonlivingLocation(x, y, true);
        return;
    }

    // Levitation/flying still reveals walls, doors, and a large boulder, but
    // leaves smaller floor contents unknown.
    const boulder = game.level?.objects?.[x]?.[y]?.find(
        object => object.otyp === BOULDER,
    );
    if (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR
        || boulder) {
        if (boulder && !IS_OBSTRUCTED(loc.typ)) map_object(boulder, true);
        else map_background(x, y, true);
    }
}

// ── show_glyph_cell ──
export function show_glyph_cell(x, y, ch, color = NO_COLOR, decgfx = false, attr = 0) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    // symbols.c:assign_graphics(ROGUESET) selects the classic character set
    // and marks it nocolor.  Keep that policy at the final map-cell boundary
    // so hero, monster, object, trap, and remembered overlays agree.
    if (Is_rogue_level(game.u?.uz)) {
        color = NO_COLOR;
        decgfx = false;
    }
    loc.disp_ch = ch;
    loc.disp_color = color;
    loc.disp_decgfx = !!decgfx;
    loc.disp_attr = attr | 0;
    loc.gnew = 1;
}

// C display.c:map_invisible().  Unlike a transient actor overlay, an unseen
// attacker's `I` is hero memory and must survive later blind redraws until a
// caller explicitly discovers that the square no longer contains that
// threat.  It also remains authoritative on a physically visible square
// whose monster still cannot be spotted.
export function map_invisible(x, y) {
    if (game.u?.ux === x && game.u?.uy === y) return;
    const loc = game.level?.at(x, y);
    if (!loc) return;
    if (game.level?.flags?.hero_memory) {
        loc.remembered_glyph = {
            ch: 'I', color: NO_COLOR, decgfx: false, kind: 'invisible',
        };
    }
    show_glyph_cell(x, y, 'I', NO_COLOR, false);
}

// C display.c:unmap_invisible()->unmap_object().  Learning that the marker's
// monster is gone restores a known trap, revealed engraving, or background;
// it deliberately does not reveal a floor object which had been hidden by
// the one-slot invisible-monster memory glyph.
export function unmap_invisible(x, y, show = true) {
    const loc = game.level?.at(x, y);
    if (loc?.remembered_glyph?.kind !== 'invisible') return false;
    const covered = coversNonlivingLocation(x, y);
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && !covered) {
        map_trap(trap, false);
    } else {
        const engraving = engravingAt(x, y);
        const showsEngraving = loc.typ === ROOM
            || loc.typ === CORR || loc.typ === ICE;
        if (engraving?.erevealed && showsEngraving && !covered)
            map_engraving(engraving, false);
        else
            map_background(x, y, false);
    }
    if (show) newsym(x, y);
    return true;
}

// ── newsym ──
export function newsym(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    // C newsym() permits only the hero cell while swallowed.  The stomach
    // renderer bypasses newsym(), so monster movement and memory repairs must
    // not leak ordinary map glyphs back into the cleared viewport.
    if (game.u?.uswallow) {
        if (game.u.ux === x && game.u.uy === y)
            show_glyph_cell(x, y, heroDisplayGlyph().ch,
                heroDisplayGlyph().color, false);
        return;
    }
    const physicallyVisible = cansee(x, y);
    const engraving = engravingAt(x, y);
    // C reveals the map symbol before living and object overlays are chosen.
    if (physicallyVisible && engraving) engraving.erevealed = true;

    if (game.u?.ux === x && game.u?.uy === y) {
        // C maps the nonliving layer into memory before optionally drawing
        // the hero.  When canspotself() is false, that layer is also the live
        // projection at the hero's coordinate.
        const spotSelf = canSpotHeroSelf();
        if (physicallyVisible) mapNonlivingLocation(x, y, !spotSelf);
        if (!spotSelf) return;
        const heroGlyph = heroDisplayGlyph();
        show_glyph_cell(x, y, game.u?.usteed?.symbol || heroGlyph.ch,
            game.u?.usteed
                ? (game.u.usteed.color ?? CLR_BROWN) : heroGlyph.color,
            false);
        return;
    }

    const monster = monsterAtMapCell(x, y);
    if (monster && canProjectMonster(monster, x, y)) {
        // A visible actor overlays rather than replaces the remembered layer.
        if (physicallyVisible) mapNonlivingLocation(x, y, false);
        // C's mappearance projection precedes the ordinary monster glyph.
        // Use the same object-class, color, and statue/corpse representation
        // as a real floor object; the underlying actor remains live.
        if (monster.m_ap_type === M_AP_OBJECT) {
            const glyph = apparentObjectGlyph(monster);
            show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx,
                objectGlyphAttr(glyph));
            return;
        }
        if (!hallucinationActive()
            && monster.m_ap_type === M_AP_MONSTER
            && Number.isInteger(monster.mappearance)) {
            const glyph = displayMonsterGlyph(monster.mappearance);
            show_glyph_cell(x, y, glyph.ch, glyph.color, false,
                (monster.pet || (monster.mtame ?? 0) > 0)
                    && game.flags?.hilite_pet ? 1 : 0);
            return;
        }
        if (hallucinationActive()) {
            const displayMnum = rn2Display(MONSTER_COLOR.length);
            const glyph = displayMonsterGlyph(displayMnum);
            show_glyph_cell(x, y, glyph.ch, glyph.color, false);
        } else {
            show_glyph_cell(x, y, monster.symbol || '?',
                game._monkNorthPath && monster.mnum === 70 ? NO_COLOR
                    : monster.mnum === 102 ? NO_COLOR
                    : monster.mnum === 100 || monster.mnum === 239 ? CLR_BROWN
                    : (MONSTER_COLOR[monster.mnum]
                        ?? monster.color ?? CLR_GRAY),
            false, (monster.pet || (monster.mtame ?? 0) > 0)
                && game.flags?.hilite_pet ? 1 : 0);
        }
        return;
    }
    const warning = warningProjection(monster);
    if (warning) {
        show_glyph_cell(x, y, warning.ch, warning.color, false);
        return;
    }
    if (loc.remembered_glyph?.kind === 'invisible') {
        map_invisible(x, y);
        return;
    }

    // Only update display/memory if cell is IN_SIGHT (lit and visible)
    if (physicallyVisible) {
        mapNonlivingLocation(x, y, true);
    } else if (loc.remembered_glyph) {
        // Out of sight but remembered — show remembered glyph
        show_glyph_cell(x, y, loc.remembered_glyph.ch,
            rememberedColor(loc.remembered_glyph, loc, x, y),
            loc.remembered_glyph.decgfx,
            objectGlyphAttr(loc.remembered_glyph));
    } else {
        // A living glyph is only an overlay.  When its actor vacates an
        // unseen, never-mapped square, restore unexplored space rather than
        // leaving a presentation-only duplicate behind.
        show_glyph_cell(x, y, ' ', NO_COLOR, false);
    }
}

// C ref: display.c:see_monsters().  Warning, telepathy, and visible regions
// can change how a stationary monster is projected when only the hero moves;
// repainting solely on actor movement leaves stale warning numerals behind.
export function see_monsters() {
    // makemon() links new actors at fmon's head; the live level array retains
    // creation order, so source traversal is its reverse (same as scheduler).
    for (const monster of Array.from(game.level?.monsters || []).reverse()) {
        if (monster.dead || monster._stillArriving) continue;
        newsym(monster.mx, monster.my);
    }
    if (game.u?.ux > 0) newsym(game.u.ux, game.u.uy);
}

// C display.c:see_objects()/see_traps().  fobj is newest-first globally,
// while only each square's pile-top is eligible for a redraw.
export function see_objects() {
    const objects = [];
    for (const column of game.level?.objects || []) {
        if (!column) continue;
        for (const pile of column) {
            if (pile?.[0]) objects.push(pile[0]);
        }
    }
    objects.sort((a, b) => (b._fobjOrder ?? 0) - (a._fobjOrder ?? 0));
    for (const object of objects) newsym(object.ox, object.oy);
}

export function see_traps() {
    for (const trap of game.level?.traps || []) {
        const loc = game.level?.at?.(trap.tx, trap.ty);
        if (loc?.remembered_glyph?.kind === 'trap') newsym(trap.tx, trap.ty);
    }
}

const M2_PNAME = 0x00080000;
const G_NOGEN = 0x0200;
const BOGUSMONSIZE = 100;

// C rumors.c:get_rnd_line(..., MD_PAD_BOGONS).  The random offset lands in a
// padded data-file line; the following line is the selected name.  Long lines
// retry unless the offset falls within their final 20 characters.
function randomBogusMonsterIdentity() {
    let landed = 0;
    for (let tries = 0; tries < 10; tries++) {
        const offset = rn2Display(BOGUS_MONSTER_FILE_SIZE);
        let start = 0;
        for (let index = 0; index < BOGUS_MONSTERS.length; index++) {
            const width = Math.max(19, BOGUS_MONSTERS[index].length) + 1;
            if (offset < start + width) {
                landed = index;
                const remaining = start + width - offset;
                if (remaining <= 21) tries = 10;
                break;
            }
            start += width;
        }
        if (tries === 10) break;
    }
    const selected = BOGUS_MONSTERS[(landed + 1) % BOGUS_MONSTERS.length]
        || 'bogon';
    const code = '-_+|='.includes(selected[0]) ? selected[0] : '';
    return {
        name: code ? selected.slice(1) : selected,
        // C bogon_is_pname(): '-', '+', and '=' suppress ARTICLE_THE.
        // Empty strings are considered substrings in JavaScript, so retain
        // the source's explicit "has a control prefix" gate.
        personal: !!code && '-+='.includes(code),
    };
}

// C do_name.c:rndmonnam().  This is presentation-only and therefore consumes
// the display stream even when called while resolving a core combat action.
function randomDisplayMonsterIdentity() {
    let mnum;
    do {
        mnum = rn2Display(SPECIAL_PM + BOGUSMONSIZE);
    } while (mnum < SPECIAL_PM
        && (((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME)
            || ((MONSTER_GENO[mnum] ?? 0) & G_NOGEN)));
    if (mnum >= SPECIAL_PM) return randomBogusMonsterIdentity();
    const female = rn2Display(2) !== 0; // pmname(..., random gender)
    return { name: monsterTypeName(mnum, female), personal: false };
}

export function randomDisplayMonsterName() {
    return randomDisplayMonsterIdentity().name;
}

// C do_name.c:Monnam() requests ARTICLE_THE, except personal bogus-monster
// names suppress the article before the result is sentence-capitalized.
export function randomDisplayMonsterSubject(forceThe = false) {
    const { name, personal } = randomDisplayMonsterIdentity();
    const subject = personal && !forceThe ? name : `the ${name}`;
    return subject.charAt(0).toUpperCase() + subject.slice(1);
}

let lastSwallowedX = 0;
let lastSwallowedY = 0;

// C display.c:swallowed().  This bypasses ordinary vision/memory projection:
// the first draw clears the map, then eight stomach cells surround the hero.
// When hallucinating, every stomach cell independently chooses a display-only
// monster color.
export function swallowed(first = false) {
    if (!game.level || !game.u?.uswallow || !game.u?.ustuck) return;
    if (first) {
        for (let y = 0; y < ROWNO; y++)
            for (let x = 1; x < COLNO; x++)
                show_glyph_cell(x, y, ' ', NO_COLOR, false);
    } else if (lastSwallowedX > 0) {
        for (let y = lastSwallowedY - 1; y <= lastSwallowedY + 1; y++)
            for (let x = lastSwallowedX - 1; x <= lastSwallowedX + 1; x++)
                if (x > 0 && x < COLNO && y >= 0 && y < ROWNO)
                    show_glyph_cell(x, y, ' ', NO_COLOR, false);
    }

    const x = game.u.ux, y = game.u.uy;
    const positions = [
        [-1, -1, '/', false], [0, -1, 'o', true], [1, -1, '\\', false],
        [-1, 0, 'x', true],                         [1, 0, 'x', true],
        [-1, 1, '\\', false],  [0, 1, 's', true],  [1, 1, '/', false],
    ];
    const hallucinating = game.u.hallucinating
        || (game.u.hallucinationTurns ?? 0) > 0;
    for (const [dx, dy, ch, decgfx] of positions) {
        const sx = x + dx, sy = y + dy;
        if (sx <= 0 || sx >= COLNO || sy < 0 || sy >= ROWNO) continue;
        const mnum = hallucinating
            ? rn2Display(MONSTER_COLOR.length) : game.u.ustuck.mnum;
        let color = MONSTER_COLOR[mnum] ?? NO_COLOR;
        // tty maps black and ordinary gray through its default foreground.
        if (color === CLR_BLACK || color === CLR_GRAY) color = NO_COLOR;
        show_glyph_cell(sx, sy, ch, color, decgfx);
    }
    show_glyph_cell(x, y, '@', CLR_WHITE, false);
    lastSwallowedX = x;
    lastSwallowedY = y;
}

// ── docrt ──
// C display.c:docrt_flags(docrtRecalc).  Modal map windows use this stronger
// transaction: remove the old sight field, paint memory onto the cleared
// terminal, reconstruct sight, then overlay fmon once more.  Keep it
// separate from docrt() because many older JS callers already own the vision
// recalculation immediately before their redraw.
export async function docrtRecalc() {
    if (!game.level) return;
    if (game.u?.uswallow) {
        swallowed(true);
        return;
    }
    vision_recalc(2);
    await cls();
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level.at(x, y);
            if (loc?.remembered_glyph) {
                show_glyph_cell(x, y, loc.remembered_glyph.ch,
                    rememberedColor(loc.remembered_glyph, loc, x, y),
                    loc.remembered_glyph.decgfx,
                    objectGlyphAttr(loc.remembered_glyph));
            } else {
                show_glyph_cell(x, y, ' ', NO_COLOR, false);
            }
        }
    vision_recalc(0);
    see_monsters();
}

export async function docrt({ visibleAlreadyProjected = false } = {}) {
    if (!game.level) return;
    if (game.u?.uswallow) {
        swallowed(true);
        return;
    }
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level.at(x, y);
            // C docrt()/newsym() reconstructs live visible glyphs after a
            // modal window clears the physical map. Hero memory owns only
            // cells outside current sight; it must not erase actors, objects,
            // or traps which did not move while the modal was open.
            const monster = monsterAtMapCell(x, y);
            if (cansee(x, y) || (monster
                && canProjectMonster(monster, x, y))) {
                // goto_level() has already rebuilt the destination sight
                // field before this logical docrt.  Its glyph state is live;
                // only the later fmon overlay is repeated in that path.
                if (!visibleAlreadyProjected) newsym(x, y);
            } else if (loc?.remembered_glyph) {
                show_glyph_cell(x, y, loc.remembered_glyph.ch,
                    rememberedColor(loc.remembered_glyph, loc, x, y),
                    loc.remembered_glyph.decgfx,
                    objectGlyphAttr(loc.remembered_glyph));
            } else {
                // Modal redraw reconstructs presentation from visibility and
                // memory.  Clear any old transient actor/warning overlay when
                // neither owner projects this square anymore.
                show_glyph_cell(x, y, ' ', NO_COLOR, false);
            }
        }
    if (game.u?.ux > 0 && canSpotHeroSelf()) {
        const heroGlyph = heroDisplayGlyph();
        show_glyph_cell(
            game.u.ux, game.u.uy, game.u?.usteed?.symbol || heroGlyph.ch,
            game.u?.usteed
                ? (game.u.usteed.color ?? CLR_BROWN) : heroGlyph.color,
            false,
        );
    }
    // vision_recalc's newly visible cells were projected above; source docrt
    // then overlays fmon once more in linked-list order.
    see_monsters();
}

// ── Serialize a map row with DEC line-drawing and ANSI colors ──
function render_map_row(y) {
    if (!game.level) return '';
    let firstCol = -1, lastCol = -1;
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level.at(x, y);
        if (loc?.disp_ch && loc.disp_ch !== ' ') {
            if (firstCol < 0) firstCol = x;
            lastCol = x;
        }
    }
    if (firstCol < 0) return '';

    let output = '';
    let activeColor = ANSI_DEFAULT;  // default
    let activeDec = false;

    // Leading gap
    const gap = firstCol - 1;
    if (gap > 4) output += `\x1b[${gap}C`;
    else if (gap > 0) output += ' '.repeat(gap);

    for (let x = firstCol; x <= lastCol; x++) {
        const loc = game.level.at(x, y);
        const ch = loc?.disp_ch ?? ' ';
        const color = loc?.disp_color ?? NO_COLOR;
        const dec = !!loc?.disp_decgfx;

        if (ch === ' ') {
            // Space runs
            let run = 1;
            while (x + run <= lastCol && (game.level.at(x + run, y)?.disp_ch ?? ' ') === ' ') run++;
            if (activeDec) { output += '\x0f'; activeDec = false; }
            if (run > 4) output += `\x1b[${run}C`;
            else output += ' '.repeat(run);
            x += run - 1;
            continue;
        }

        let wantAnsi = ANSI_COLOR[color] ?? ANSI_DEFAULT;
        if (wantAnsi !== activeColor) {
            output += `\x1b[${wantAnsi}m`;
            activeColor = wantAnsi;
        }

        // DEC mode switching
        if (dec && !activeDec) { output += '\x0e'; activeDec = true; }
        else if (!dec && activeDec) { output += '\x0f'; activeDec = false; }

        output += ch;
    }

    // Reset state at end of row (C does per-row SO/SI)
    if (activeColor !== ANSI_DEFAULT) output += `\x1b[${ANSI_DEFAULT}m`;
    if (activeDec) output += '\x0f';

    return output;
}

// ── Status lines ──
export function _statusLine1() {
    const u = game.u;
    if (!u) return '';
    const name = game.displayName || game.plname || 'Hero';
    const level = u.ulevel ?? 1;
    const rankIndex = level <= 2 ? 0
        : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
    const rank = game.urole?.title?.[rankIndex] || game.urole?.rank;
    const monsterTitle = (game.u?.mtimedone ?? 0) > 0
        ? (MONSTER_NAME[game.u?.umonnum] || 'monster')
            .replace(/\b\w/g, letter => letter.toUpperCase())
        : null;
    const role = monsterTitle || (game.flags?.female
        ? (rank?.f || rank?.m || game.urole?.name?.f || game.urole?.name?.m)
        : (rank?.m || game.urole?.name?.m));
    const title = `${name} the ${role}`;
    const stats = `St:${formatStrength(currentAttribute(0))} Dx:${u.acurr?.a?.[1] || '?'} Co:${u.acurr?.a?.[2] || '?'} In:${u.acurr?.a?.[3] || '?'} Wi:${u.acurr?.a?.[4] || '?'} Ch:${u.acurr?.a?.[5] || '?'}`;
    const align = u.ualign?.type === 0 ? 'Neutral' : u.ualign?.type > 0 ? 'Lawful' : 'Chaotic';
    // C uses cursor-forward for gap between title and stats
    // C pads to align stats starting at a fixed column
    const gap = Math.max(1, 31 - title.length);
    if (gap > 4) return `${title}\x1b[${gap}C${stats} ${align}`;
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}

// C ref: botl.c strbuf(): strength values above 18 encode the exceptional
// 18/xx range; 118 is the traditional 18/** maximum.
export function formatStrength(value) {
    if (value == null) return '?';
    if (value <= 18) return String(value);
    if (value >= 119) return String(value - 100);
    if (value === 118) return '18/**';
    return `18/${String(value - 18).padStart(2, '0')}`;
}

export function _statusLine2() {
    const u = game.u;
    if (!u) return '';
    const dungeonName = game.dungeons?.[u.uz?.dnum ?? 0]?.dname;
    const endgameLocation = endgameLevelName(u.uz)
        .replace(/^Plane of /, '');
    const location = game._tutorialActive ? `Tutorial:${dungeonDepth(u.uz)}`
        : dungeonName === 'The Quest' ? `Home ${u.uz?.dlevel ?? 1}`
            : In_endgame(u.uz) ? endgameLocation
            : `Dlvl:${dungeonDepth(u.uz)}`;
    const polymorphed = (u.mtimedone ?? 0) > 0;
    const displayedHp = game._statusHpOverride
        ?? (polymorphed ? u.mh : u.uhp) ?? 0;
    const maximumHp = polymorphed ? u.mhmax : u.uhpmax;
    const goldSymbol = Is_rogue_level(u.uz) ? '*' : '$';
    const displayedAc = game._statusAcOverride
        ?? game._statusProjectedAc ?? u.uac ?? 10;
    const displayedGold = game._statusGoldOverride
        ?? game._goldCount ?? 0;
    let line = `${location} ${goldSymbol}:${displayedGold} HP:${displayedHp}(${maximumHp || 0}) Pw:${u.uen || 0}(${u.uenmax || 0}) AC:${displayedAc}`;
    if (polymorphed) {
        line += ` HD:${MONSTER_LEVEL[u.umonnum] ?? 0}`;
    } else {
        line += ` Xp:${u.ulevel || 1}`;
        if (game.flags?.showexp) line += `/${u.uexp || 0}`;
    }
    if (game.flags?.time)
        line += ` T:${game._statusTurnOverride ?? game.moves ?? 1}`;
    if (u.usteed) line += ' Ride';
    const hunger = u.uhunger ?? 900;
    if (hunger > 1000) line += ' Satiated';
    else if (hunger <= 0) line += ' Fainting';
    else if (hunger <= 50) line += ' Weak';
    else if (hunger <= 150) line += ' Hungry';
    if (u._encumbrance) line += ` ${u._encumbrance}`;
    if (game.blind) line += ' Blind';
    if (polymorphed
        && ((MONSTER_FLAGS1[u.umonnum] ?? 0) & M1_FLY)) line += ' Fly';
    if ((u.confusionTurns ?? 0) > 0) line += ' Conf';
    if ((game._statusDeafOverride ?? game.deaf)) line += ' Deaf';
    if (u.stunned || (u.stunnedTurns ?? 0) > 0) line += ' Stun';
    if (u.hallucinating || (u.hallucinationTurns ?? 0) > 0)
        line += ' Hallu';
    return line;
}

// ── Serialize terminal grid for screen comparison ──
export function serialize_terminal_grid(display) {
    let output = '';
    let lastRow = 0;
    for (let r = 0; r < display.rows; r++) {
        for (let c = 0; c < display.cols; c++) {
            if (display.grid[r][c].ch !== ' ') { lastRow = r; break; }
        }
    }
    for (let r = 0; r <= lastRow; r++) {
        let lastCol = -1;
        for (let c = display.cols - 1; c >= 0; c--) {
            if (display.grid[r][c].ch !== ' ') { lastCol = c; break; }
        }
        if (lastCol < 0) { if (r < lastRow) output += '\n'; continue; }
        let firstCol = 0;
        for (let c = 0; c <= lastCol; c++) {
            if (display.grid[r][c].ch !== ' ') { firstCol = c; break; }
        }
        if (firstCol > 4) output += `\x1b[${firstCol}C`;
        else if (firstCol > 0) output += ' '.repeat(firstCol);
        for (let c = firstCol; c <= lastCol; c++) output += display.grid[r][c].ch;
        if (r < lastRow) output += '\n';
    }
    return output;
}

// ── Build screen output ──
function _buildScreenOutput() {
    const display = game?.nhDisplay;
    if (!display) return;

    let output = '';
    const blankMainWindow = !!game._suppressMapStatusForFlush;
    // Row 0: message
    const visibleMessage = game._pending_message
        || game._retained_message || '';
    output += visibleMessage + '\n';

    // Rows 1-21: map (rendered with DEC + ANSI, per-row SO/SI)
    for (let y = 0; y < ROWNO; y++) {
        output += (blankMainWindow ? '' : render_map_row(y)) + '\n';
    }

    // Row 22-23: status
    output += (blankMainWindow ? '' : _statusLine1()) + '\n';
    output += blankMainWindow ? '' : _statusLine2();

    game._screen_output = output;

    // Also write to grid for serialize_terminal_grid
    if (display.grid) {
        display.clearScreen();
        // Message line
        const msg = visibleMessage;
        for (let c = 0; c < Math.min(msg.length, display.cols); c++)
            display.setCell(c, 0, msg[c], NO_COLOR, 0);
        if (!blankMainWindow) {
            // Map — write characters to grid (DEC → Unicode for browser display)
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    const loc = game.level?.at(x, y);
                    if (!loc?.disp_ch) continue;
                    const color = loc.disp_color ?? NO_COLOR;
                    const attr = loc.disp_attr ?? 0;
                    // Plane-of-Air AIR is a cyan space.  Although it paints
                    // no glyph, the C tty records its foreground SGR state
                    // between neighboring cloud glyphs.  Preserve such
                    // semantic spaces in the terminal grid; ordinary
                    // default/gray blanks may remain sparse.
                    if (loc.disp_ch === ' ' && !(attr & 5)
                        && (color === NO_COLOR || color === CLR_GRAY)) {
                        continue;
                    }
                    const ch = loc.disp_decgfx ? (DEC_TO_UNICODE[loc.disp_ch] || loc.disp_ch) : loc.disp_ch;
                    display.setCell(x - 1, y + 1, ch, color, attr);
                }
            }
            // Status lines
            const s1 = _statusLine1().replace(/\x1b\[[0-9;]*[A-Za-z]/g, m =>
                m.match(/\x1b\[\d+C/) ? ' '.repeat(parseInt(m.slice(2))) : '');
            for (let c = 0; c < Math.min(s1.length, display.cols); c++)
                display.setCell(c, 22, s1[c], NO_COLOR, 0);
            const s2 = _statusLine2();
            for (let c = 0; c < Math.min(s2.length, display.cols); c++)
                display.setCell(c, 23, s2[c], NO_COLOR, 0);
            // Cursor at hero
            if (game.u?.ux > 0)
                display.setCursor(game.u.ux - 1, game.u.uy + 1);
        }
    }
}

// ── flush_screen ──
export async function flush_screen(mode) {
    _buildScreenOutput();
}

// ── cls ──
export async function cls() {
    const display = game?.nhDisplay;
    if (display?.clearScreen) display.clearScreen();
    game._pending_message = '';
    game._retained_message = '';
}

// ── bot ──
export async function bot() {
    // Status line updates happen in _buildScreenOutput
}

// ── pline ──
export async function pline(msg) {
    // C pline.c:vpline() resolves any pending blocker/light change before it
    // flushes the map or negotiates tty's previous-topline pager.
    if (game.vision_full_recalc) vision_recalc(0);
    game._pending_message = msg;
    game._retained_message = '';
    game._last_message = msg;
}

function wrapTopline(message, columns) {
    const lines = [];
    let remaining = message;
    while (remaining.length >= columns) {
        let split = remaining.lastIndexOf(' ', columns);
        if (split <= 0) split = columns;
        lines.push(remaining.slice(0, split));
        remaining = remaining.slice(split + (remaining[split] === ' ' ? 1 : 0));
    }
    lines.push(remaining);
    return lines;
}

function decodeMixedTopline(message) {
    const cells = [];
    let dec = false;
    for (let index = 0; index < message.length; index++) {
        const ch = message[index];
        if (ch === '\x0e') {
            dec = true;
            continue;
        }
        if (ch === '\x0f') {
            dec = false;
            continue;
        }
        if (ch === '\x1b' && message[index + 1] === '[') {
            let end = index + 2;
            while (end < message.length && /[0-9;]/.test(message[end])) end++;
            if (message[end] === 'C') {
                const count = Number(message.slice(index + 2, end)) || 1;
                for (let offset = 0; offset < count; offset++)
                    cells.push({ ch: ' ', dec: false });
                index = end;
                continue;
            }
        }
        cells.push({
            ch: dec ? (DEC_TO_UNICODE[ch] || ch) : ch,
            dec,
        });
    }
    return cells;
}

function wrapMixedTopline(message, columns) {
    const lines = [];
    let remaining = decodeMixedTopline(message);
    while (remaining.length >= columns) {
        let split = Math.min(columns, remaining.length - 1);
        while (split > 0 && remaining[split].ch !== ' ') split--;
        if (split <= 0) split = columns;
        lines.push(remaining.slice(0, split));
        remaining = remaining.slice(split
            + (remaining[split]?.ch === ' ' ? 1 : 0));
    }
    lines.push(remaining);
    return lines;
}

async function showToplineMore(message) {
    const display = game.nhDisplay;
    const columns = display?.cols ?? 80;
    const mixed = /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message);
    const lines = mixed
        ? wrapMixedTopline(message, columns)
        : wrapTopline(message, columns).map(line =>
            [...line].map(ch => ({ ch, dec: false })));
    const moreCells = [...'--More--'].map(ch => ({ ch, dec: false }));
    if (lines.at(-1).length + moreCells.length <= columns)
        lines[lines.length - 1].push(...moreCells);
    else lines.push(moreCells);

    await pline(message);
    await flush_screen(1);
    if (display?.grid) {
        for (let row = 0; row < lines.length; row++) {
            display.clearRow(row);
            for (let col = 0; col < lines[row].length; col++)
                display.setCell(col, row, lines[row][col].ch, NO_COLOR, 0);
        }
        display.setCursor(lines.at(-1).length, lines.length - 1);
    }
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    // tty ESC at more() sets WIN_STOP.  The message which requested this
    // pager is discarded, but tty's first old topline remains physically
    // visible when it occupied one row.  A wrapped topline takes the
    // docorner() path instead and restores all of its map-covered rows.
    // Keep either result out of continuation ownership so later ordinary
    // plines are still suppressed until the next command read.
    if (key === 27) {
        game._retained_message = lines.length > 1
            ? '' : message.split('  ')[0];
        game._suppressMessagesUntilInput = true;
    } else {
        game._retained_message = '';
    }
    return key;
}

// Opening a tty text window flushes any older topline before the window is
// displayed.  Quest pages and other modal producers use this boundary when a
// time-consuming command has left ordinary prose pending for the scheduler.
export async function flushPendingTopline() {
    const pending = game._pending_message || '';
    return pending ? showToplineMore(pending) : null;
}

// C tty topl.c:update_topl().  A later pline either appends to the pending
// topline or owns a --More-- boundary before replacing it.  Keep this policy
// at the terminal layer so source callers can remain ordinary sequential
// pline() producers.
export async function plineWithContinuation(msg) {
    const pending = game._pending_message || '';
    const visibleLength = message => /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message)
        ? decodeMixedTopline(message).length : message.length;
    if (!pending) {
        await pline(msg);
        if (visibleLength(msg) >= (game.nhDisplay?.cols ?? 80))
            return showToplineMore(msg);
        return null;
    }
    const columns = game.nhDisplay?.cols ?? 80;
    if (visibleLength(msg) + visibleLength(pending) + 3 < columns - 8) {
        await pline(`${pending}  ${msg}`);
        return;
    }

    const dismissal = await showToplineMore(pending);
    // tty update_topl() computes its `skip` flag before more().  Escape sets
    // WIN_STOP during that acknowledgement, but the pline which forced the
    // pager is still installed; only later plines are suppressed.
    await pline(msg);
    if (dismissal !== 27 && visibleLength(msg) >= columns)
        return showToplineMore(msg);
    return dismissal;
}
