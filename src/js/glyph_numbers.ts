import {
    AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, AM_SANCTUM,
    MAXEXPCHARS, MAXTCHARS, WARNCOUNT,
} from './const.js';
import { MONSTER_COLOR } from './monster_data.js';
import { OBJECT_COLOR } from './object_data.js';

// Pinned defsym.h indices. These select glyphs, independently of tty symbols.
export enum CmapSymbol {
    stone = 0, vwall = 1, hwall = 2, tlcorn = 3, trcorn = 4,
    blcorn = 5, brcorn = 6, crwall = 7, tuwall = 8, tdwall = 9,
    tlwall = 10, trwall = 11, ndoor = 12, vodoor = 13, hodoor = 14,
    vcdoor = 15, hcdoor = 16, bars = 17, tree = 18, room = 19,
    darkroom = 20, engroom = 21, corr = 22, litcorr = 23, engrcorr = 24,
    upstair = 25, dnstair = 26, upladder = 27, dnladder = 28,
    brupstair = 29, brdnstair = 30, brupladder = 31, brdnladder = 32,
    altar = 33, grave = 34, throne = 35, sink = 36, fountain = 37,
    pool = 38, ice = 39, lava = 40, lavawall = 41,
    vodbridge = 42, hodbridge = 43, vcdbridge = 44, hcdbridge = 45,
    air = 46, cloud = 47, water = 48, arrowTrap = 49,
    digbeam = 78, poisoncloud = 86, goodpos = 87,
}

const NUMMONS = MONSTER_COLOR.length;
const NUM_OBJECTS = OBJECT_COLOR.length;
const WALL_GLYPHS = CmapSymbol.trwall - CmapSymbol.vwall + 1;

// display.h:enum glyph_offsets. Keep every range in native order.
export enum GlyphOffset {
    monMale = 0,
    monFemale = NUMMONS + monMale,
    petMale = NUMMONS + monFemale,
    petFemale = NUMMONS + petMale,
    invisible = NUMMONS + petFemale,
    detectMale = 1 + invisible,
    detectFemale = NUMMONS + detectMale,
    body = NUMMONS + detectFemale,
    riddenMale = NUMMONS + body,
    riddenFemale = NUMMONS + riddenMale,
    object = NUMMONS + riddenFemale,
    cmapStone = NUM_OBJECTS + object,
    cmapMain = 1 + cmapStone,
    cmapMines = WALL_GLYPHS + cmapMain,
    cmapGehennom = WALL_GLYPHS + cmapMines,
    cmapKnox = WALL_GLYPHS + cmapGehennom,
    cmapSokoban = WALL_GLYPHS + cmapKnox,
    cmapA = WALL_GLYPHS + cmapSokoban,
    altar = CmapSymbol.brdnladder - CmapSymbol.ndoor + 1 + cmapA,
    cmapB = 5 + altar,
    zap = CmapSymbol.arrowTrap + MAXTCHARS - CmapSymbol.grave + cmapB,
    cmapC = (8 << 2) + zap,
    swallow = CmapSymbol.goodpos - CmapSymbol.digbeam + 1 + cmapC,
    explodeDark = (NUMMONS << 3) + swallow,
    explodeNoxious = MAXEXPCHARS + explodeDark,
    explodeMuddy = MAXEXPCHARS + explodeNoxious,
    explodeWet = MAXEXPCHARS + explodeMuddy,
    explodeMagical = MAXEXPCHARS + explodeWet,
    explodeFiery = MAXEXPCHARS + explodeMagical,
    explodeFrosty = MAXEXPCHARS + explodeFiery,
    warning = MAXEXPCHARS + explodeFrosty,
    statueMale = WARNCOUNT + warning,
    statueFemale = NUMMONS + statueMale,
    objectPiletop = NUMMONS + statueFemale,
    bodyPiletop = NUM_OBJECTS + objectPiletop,
    statueMalePiletop = NUMMONS + bodyPiletop,
    statueFemalePiletop = NUMMONS + statueMalePiletop,
    unexplored = NUMMONS + statueFemalePiletop,
    nothing = unexplored + 1,
    max = nothing + 1,
}

// display.h:cmap_to_glyph(), with the caller selecting its branch's wall range.
export function cmapToGlyph(symbol: number, wallOffset = GlyphOffset.cmapMain): number {
    if (symbol === CmapSymbol.stone) return GlyphOffset.cmapStone;
    if (symbol <= CmapSymbol.trwall) return symbol - CmapSymbol.vwall + wallOffset;
    if (symbol < CmapSymbol.altar) return symbol - CmapSymbol.ndoor + GlyphOffset.cmapA;
    if (symbol === CmapSymbol.altar) return altarToGlyph(AM_NEUTRAL);
    if (symbol < CmapSymbol.arrowTrap + MAXTCHARS)
        return symbol - CmapSymbol.grave + GlyphOffset.cmapB;
    if (symbol <= CmapSymbol.goodpos) return symbol - CmapSymbol.digbeam + GlyphOffset.cmapC;
    return GlyphOffset.max;
}

// Shrine status does not select another glyph; sanctum status does.
export function altarToGlyph(mask: number): number {
    if (mask & AM_SANCTUM) return GlyphOffset.altar + 4;
    const alignment = mask & AM_MASK;
    if (alignment === AM_LAWFUL) return GlyphOffset.altar + 3;
    if (alignment === AM_NEUTRAL) return GlyphOffset.altar + 2;
    if (alignment === AM_CHAOTIC) return GlyphOffset.altar + 1;
    return GlyphOffset.altar;
}
