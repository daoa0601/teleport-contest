import {
    AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, AM_SANCTUM, FEMALE, MALE,
    MAXEXPCHARS, MAXTCHARS, WARNCOUNT,
} from './const.js';
import { MONSTER_COLOR } from './monster_data.js';
import { ARROW as FIRST_OBJECT, CORPSE, OBJECT_COLOR, STATUE } from './object_data.js';


// Pinned defsym.h indices. These select glyphs, independently of tty symbols.
export const CmapSymbol = {
    stone: 0, vwall: 1, hwall: 2, tlcorn: 3, trcorn: 4,
    blcorn: 5, brcorn: 6, crwall: 7, tuwall: 8, tdwall: 9,
    tlwall: 10, trwall: 11, ndoor: 12, vodoor: 13, hodoor: 14,
    vcdoor: 15, hcdoor: 16, bars: 17, tree: 18, room: 19,
    darkroom: 20, engroom: 21, corr: 22, litcorr: 23, engrcorr: 24,
    upstair: 25, dnstair: 26, upladder: 27, dnladder: 28,
    brupstair: 29, brdnstair: 30, brupladder: 31, brdnladder: 32,
    altar: 33, grave: 34, throne: 35, sink: 36, fountain: 37,
    pool: 38, ice: 39, lava: 40, lavawall: 41,
    vodbridge: 42, hodbridge: 43, vcdbridge: 44, hcdbridge: 45,
    air: 46, cloud: 47, water: 48, arrowTrap: 49, web: 66,
    vbeam: 74, hbeam: 75, lslant: 76, rslant: 77,
    digbeam: 78, flashbeam: 79, boomleft: 80, boomright: 81,
    shieldFirst: 82, poisoncloud: 86, goodpos: 87,
    swallowTopLeft: 88, swallowBottomRight: 95,
    explosionTopLeft: 96, explosionBottomRight: 104,
} as const;
export type CmapSymbol = typeof CmapSymbol[keyof typeof CmapSymbol];

const NUMMONS = MONSTER_COLOR.length;
const NUM_OBJECTS = OBJECT_COLOR.length;
const WALL_GLYPHS = CmapSymbol.trwall - CmapSymbol.vwall + 1;
const NUM_ZAP = 8;

// display.h:enum glyph_offsets. Keep every range in native order.
const monMale = 0;
const monFemale = NUMMONS + monMale;
const petMale = NUMMONS + monFemale;
const petFemale = NUMMONS + petMale;
const invisible = NUMMONS + petFemale;
const detectMale = 1 + invisible;
const detectFemale = NUMMONS + detectMale;
const body = NUMMONS + detectFemale;
const riddenMale = NUMMONS + body;
const riddenFemale = NUMMONS + riddenMale;
const object = NUMMONS + riddenFemale;
const cmapStone = NUM_OBJECTS + object;
const cmapMain = 1 + cmapStone;
const cmapMines = WALL_GLYPHS + cmapMain;
const cmapGehennom = WALL_GLYPHS + cmapMines;
const cmapKnox = WALL_GLYPHS + cmapGehennom;
const cmapSokoban = WALL_GLYPHS + cmapKnox;
const cmapA = WALL_GLYPHS + cmapSokoban;
const altar = CmapSymbol.brdnladder - CmapSymbol.ndoor + 1 + cmapA;
const cmapB = 5 + altar;
const zap = CmapSymbol.arrowTrap + MAXTCHARS - CmapSymbol.grave + cmapB;
// C display.h:GLYPH_CMAP_C_OFF member of enum glyph_offsets.
const cmapC = (NUM_ZAP << 2) + zap;
const swallow = CmapSymbol.goodpos - CmapSymbol.digbeam + 1 + cmapC;
// C display.h:GLYPH_EXPLODE_DARK_OFF member of enum glyph_offsets.
const explodeDark = (NUMMONS << 3) + swallow;
const explodeNoxious = MAXEXPCHARS + explodeDark;
const explodeMuddy = MAXEXPCHARS + explodeNoxious;
const explodeWet = MAXEXPCHARS + explodeMuddy;
const explodeMagical = MAXEXPCHARS + explodeWet;
const explodeFiery = MAXEXPCHARS + explodeMagical;
const explodeFrosty = MAXEXPCHARS + explodeFiery;
const warning = MAXEXPCHARS + explodeFrosty;
const statueMale = WARNCOUNT + warning;
const statueFemale = NUMMONS + statueMale;
const objectPiletop = NUMMONS + statueFemale;
const bodyPiletop = NUM_OBJECTS + objectPiletop;
const statueMalePiletop = NUMMONS + bodyPiletop;
const statueFemalePiletop = NUMMONS + statueMalePiletop;
const unexplored = NUMMONS + statueFemalePiletop;
const nothing = unexplored + 1;
const max = nothing + 1;

export const GlyphOffset = {
    monMale, monFemale, petMale, petFemale, invisible, detectMale, detectFemale,
    body, riddenMale, riddenFemale, object, cmapStone, cmapMain, cmapMines,
    cmapGehennom, cmapKnox, cmapSokoban, cmapA, altar, cmapB, zap, cmapC,
    swallow, explodeDark, explodeNoxious, explodeMuddy, explodeWet,
    explodeMagical, explodeFiery, explodeFrosty, warning, statueMale,
    statueFemale, objectPiletop, bodyPiletop, statueMalePiletop,
    statueFemalePiletop, unexplored, nothing, max,
} as const;
export type GlyphOffset = typeof GlyphOffset[keyof typeof GlyphOffset];

// C display.h:cmap_to_glyph(), with the caller selecting its branch's wall range
// (display.h:cmap_walls_to_glyph reads the hero's dungeon branch, which the
// caller derives from the current level).
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

// C display.h:altar_to_glyph(): shrine status does not select another glyph;
// sanctum status does.  Alignment uses 3 bits; every undefined value falls
// back to the unaligned altar, exactly as the macro chain does.
export function altarToGlyph(mask: number): number {
    if (mask & AM_SANCTUM) return GlyphOffset.altar + 4;
    const alignment = mask & AM_MASK;
    if (alignment === AM_LAWFUL) return GlyphOffset.altar + 3;
    if (alignment === AM_NEUTRAL) return GlyphOffset.altar + 2;
    if (alignment === AM_CHAOTIC) return GlyphOffset.altar + 1;
    return GlyphOffset.altar;
}

// C display.h:warning_to_glyph()
export function warningToGlyph(mwarnlev: number): number {
    return mwarnlev + GlyphOffset.warning;
}

// C display.h:monnum_to_glyph(): every gender other than MALE (including
// NEUTER) shares the female range, as the macro's == MALE test decides.
export function monnumToGlyph(mnum: number, gender: number): number {
    return mnum + (gender === MALE ? GlyphOffset.monMale : GlyphOffset.monFemale);
}

// C display.h:petnum_to_glyph()
export function petnumToGlyph(mnum: number, gender: number): number {
    return mnum + (gender === MALE ? GlyphOffset.petMale : GlyphOffset.petFemale);
}

// C display.h:detected_monnum_to_glyph()
export function detectedMonnumToGlyph(mnum: number, gender: number): number {
    return mnum + (gender === MALE ? GlyphOffset.detectMale : GlyphOffset.detectFemale);
}

// C display.h:ridden_monnum_to_glyph()
export function riddenMonnumToGlyph(mnum: number, gender: number): number {
    return mnum + (gender === MALE ? GlyphOffset.riddenMale : GlyphOffset.riddenFemale);
}

// C display.h:objnum_to_glyph()
export function objnumToGlyph(onum: number): number {
    return onum + GlyphOffset.object;
}

// C display.h:explosion_to_glyph(): every type but the six named ones,
// including EXPL_DARK, defaults to the fiery range.
export function explosionToGlyph(expltyp: number, idx: number): number {
    return idx - CmapSymbol.explosionTopLeft
        + (expltyp === 6 ? GlyphOffset.explodeFrosty       // EXPL_FROSTY
        : expltyp === 4 ? GlyphOffset.explodeMagical       // EXPL_MAGICAL
        : expltyp === 3 ? GlyphOffset.explodeWet           // EXPL_WET
        : expltyp === 2 ? GlyphOffset.explodeMuddy         // EXPL_MUDDY
        : expltyp === 1 ? GlyphOffset.explodeNoxious       // EXPL_NOXIOUS
        : GlyphOffset.explodeFiery);
}

// zapdir_to_glyph() and swallow_to_glyph() live in display.ts: their
// display.h:what_mon hallucination draws reach the hero-sense and RNG
// modules, and keeping glyph_numbers.ts import-light preserves the module
// initialization order.

// C display.h:glyph_is_normal_male_monster() and the female/pet/detected/
// ridden ranges beside it.
export function glyphIsNormalMaleMonster(glyph: number): boolean {
    return glyph >= GlyphOffset.monMale && glyph < GlyphOffset.monMale + NUMMONS;
}
// C display.h:glyph_is_normal_female_monster().
export function glyphIsNormalFemaleMonster(glyph: number): boolean {
    return glyph >= GlyphOffset.monFemale && glyph < GlyphOffset.monFemale + NUMMONS;
}
// C display.h:glyph_is_normal_monster().
export function glyphIsNormalMonster(glyph: number): boolean {
    return glyphIsNormalMaleMonster(glyph) || glyphIsNormalFemaleMonster(glyph);
}
// C display.h:glyph_is_male_pet().
export function glyphIsMalePet(glyph: number): boolean {
    return glyph >= GlyphOffset.petMale && glyph < GlyphOffset.petMale + NUMMONS;
}
// C display.h:glyph_is_female_pet().
export function glyphIsFemalePet(glyph: number): boolean {
    return glyph >= GlyphOffset.petFemale && glyph < GlyphOffset.petFemale + NUMMONS;
}
// C display.h:glyph_is_pet()
export function glyphIsPet(glyph: number): boolean {
    return glyphIsMalePet(glyph) || glyphIsFemalePet(glyph);
}
// C display.h:glyph_is_detected_male_monster().
export function glyphIsDetectedMaleMonster(glyph: number): boolean {
    return glyph >= GlyphOffset.detectMale && glyph < GlyphOffset.detectMale + NUMMONS;
}
// C display.h:glyph_is_detected_female_monster().
export function glyphIsDetectedFemaleMonster(glyph: number): boolean {
    return glyph >= GlyphOffset.detectFemale && glyph < GlyphOffset.detectFemale + NUMMONS;
}
// C display.h:glyph_is_detected_monster()
export function glyphIsDetectedMonster(glyph: number): boolean {
    return glyphIsDetectedMaleMonster(glyph) || glyphIsDetectedFemaleMonster(glyph);
}
// C display.h:glyph_is_ridden_male_monster().
export function glyphIsRiddenMaleMonster(glyph: number): boolean {
    return glyph >= GlyphOffset.riddenMale && glyph < GlyphOffset.riddenMale + NUMMONS;
}
// C display.h:glyph_is_ridden_female_monster().
export function glyphIsRiddenFemaleMonster(glyph: number): boolean {
    return glyph >= GlyphOffset.riddenFemale && glyph < GlyphOffset.riddenFemale + NUMMONS;
}
// C display.h:glyph_is_ridden_monster()
export function glyphIsRiddenMonster(glyph: number): boolean {
    return glyphIsRiddenMaleMonster(glyph) || glyphIsRiddenFemaleMonster(glyph);
}
// C display.h:glyph_is_monster(): bodies and statues are objects, not monsters.
export function glyphIsMonster(glyph: number): boolean {
    return glyphIsNormalMonster(glyph) || glyphIsPet(glyph)
        || glyphIsRiddenMonster(glyph) || glyphIsDetectedMonster(glyph);
}
// C display.h:glyph_is_invisible()
export function glyphIsInvisible(glyph: number): boolean {
    return glyph === GlyphOffset.invisible;
}

// C display.h:glyph_is_body_piletop() / glyph_is_body()
function glyphIsBodyPiletop(glyph: number): boolean {
    return glyph >= GlyphOffset.bodyPiletop && glyph < GlyphOffset.bodyPiletop + NUMMONS;
}
// C display.h:glyph_is_body().
export function glyphIsBody(glyph: number): boolean {
    return glyph >= GlyphOffset.body && glyph < GlyphOffset.body + NUMMONS
        || glyphIsBodyPiletop(glyph);
}

// C display.h:glyph_is_{fe,male}_statue{_piletop}() / glyph_is_statue()
function glyphIsFemStatuePiletop(glyph: number): boolean {
    return glyph >= GlyphOffset.statueFemalePiletop
        && glyph < GlyphOffset.statueFemalePiletop + NUMMONS;
}
// C display.h:glyph_is_male_statue_piletop().
function glyphIsMaleStatuePiletop(glyph: number): boolean {
    return glyph >= GlyphOffset.statueMalePiletop
        && glyph < GlyphOffset.statueMalePiletop + NUMMONS;
}
// C display.h:glyph_is_fem_statue().
export function glyphIsFemStatue(glyph: number): boolean {
    return glyph >= GlyphOffset.statueFemale && glyph < GlyphOffset.statueFemale + NUMMONS
        || glyphIsFemStatuePiletop(glyph);
}
// C display.h:glyph_is_male_statue().
export function glyphIsMaleStatue(glyph: number): boolean {
    return glyph >= GlyphOffset.statueMale && glyph < GlyphOffset.statueMale + NUMMONS
        || glyphIsMaleStatuePiletop(glyph);
}
// C display.h:glyph_is_statue().
export function glyphIsStatue(glyph: number): boolean {
    return glyphIsMaleStatue(glyph) || glyphIsFemStatue(glyph);
}

// C display.h:glyph_is_normal_generic_obj() / glyph_is_piletop_generic_obj()
// / glyph_is_generic_object().  Generic glyphs run from the strange object's
// class marker up to (excluding) the first real object.
function glyphIsNormalGenericObj(glyph: number): boolean {
    return glyph > GlyphOffset.object && glyph < GlyphOffset.object + FIRST_OBJECT - 1;
}
// C display.h:glyph_is_piletop_generic_obj().
function glyphIsPiletopGenericObj(glyph: number): boolean {
    return glyph > GlyphOffset.objectPiletop
        && glyph < GlyphOffset.objectPiletop + FIRST_OBJECT - 1;
}
// C display.h:glyph_is_generic_object().
export function glyphIsGenericObject(glyph: number): boolean {
    return glyphIsNormalGenericObj(glyph) || glyphIsPiletopGenericObj(glyph);
}
// C display.h:glyph_is_normal_piletop_obj() / glyph_is_normal_object()
function glyphIsNormalPiletopObj(glyph: number): boolean {
    return glyph === GlyphOffset.objectPiletop
        || glyph > GlyphOffset.objectPiletop + FIRST_OBJECT - 1
            && glyph < GlyphOffset.objectPiletop + NUM_OBJECTS;
}
// C display.h:glyph_is_normal_object().
export function glyphIsNormalObject(glyph: number): boolean {
    return glyph === GlyphOffset.object
        || glyph >= GlyphOffset.object + FIRST_OBJECT - 1
            && glyph < GlyphOffset.object + NUM_OBJECTS
        || glyphIsNormalPiletopObj(glyph);
}
// C display.h:glyph_is_object(): bodies are objects too.
export function glyphIsObject(glyph: number): boolean {
    return glyphIsNormalObject(glyph) || glyphIsGenericObject(glyph)
        || glyphIsStatue(glyph) || glyphIsBody(glyph);
}

// C display.h:GLYPH_TRAP_OFF and glyph_is_trap(): the trap glyphs are the
// tail of cmap range B, one per trap type character.
function glyphTrapOffset(): number {
    return GlyphOffset.cmapB + (CmapSymbol.arrowTrap - CmapSymbol.grave);
}
// C display.h:glyph_is_trap()
export function glyphIsTrap(glyph: number): boolean {
    const offset = glyphTrapOffset();
    return glyph >= offset && glyph < offset + MAXTCHARS;
}
// C display.h:glyph_is_warning()
export function glyphIsWarning(glyph: number): boolean {
    return glyph >= GlyphOffset.warning && glyph < GlyphOffset.warning + WARNCOUNT;
}
// C display.h:glyph_is_swallow()
export function glyphIsSwallow(glyph: number): boolean {
    return glyph >= GlyphOffset.swallow && glyph < GlyphOffset.swallow + (NUMMONS << 3);
}
// C display.h:glyph_is_explosion()
export function glyphIsExplosion(glyph: number): boolean {
    return glyph >= GlyphOffset.explodeDark
        && glyph < MAXEXPCHARS + GlyphOffset.explodeFrosty;
}
// C display.h:glyph_is_cmap(): the whole terrain span, stone through cmap C.
export function glyphIsCmap(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapStone
        && glyph < GlyphOffset.cmapC + (CmapSymbol.goodpos - CmapSymbol.digbeam + 1);
}
// C display.h:glyph_is_cmap_main() through glyph_is_cmap_c(): the individual
// terrain ranges, including the five per-branch wall ranges and the zap beams.
export function glyphIsCmapMain(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapMain
        && glyph < WALL_GLYPHS + GlyphOffset.cmapMain;
}
// C display.h:glyph_is_cmap_mines().
export function glyphIsCmapMines(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapMines
        && glyph < WALL_GLYPHS + GlyphOffset.cmapMines;
}
// C display.h:glyph_is_cmap_gehennom().
export function glyphIsCmapGehennom(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapGehennom
        && glyph < WALL_GLYPHS + GlyphOffset.cmapGehennom;
}
// C display.h:glyph_is_cmap_knox().
export function glyphIsCmapKnox(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapKnox
        && glyph < WALL_GLYPHS + GlyphOffset.cmapKnox;
}
// C display.h:glyph_is_cmap_sokoban().
export function glyphIsCmapSokoban(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapSokoban
        && glyph < WALL_GLYPHS + GlyphOffset.cmapSokoban;
}
// C display.h:glyph_is_cmap_a().
export function glyphIsCmapA(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapA
        && glyph < CmapSymbol.brdnladder - CmapSymbol.ndoor + 1 + GlyphOffset.cmapA;
}
// C display.h:glyph_is_cmap_altar().
export function glyphIsCmapAltar(glyph: number): boolean {
    return glyph >= GlyphOffset.altar && glyph < 5 + GlyphOffset.altar;
}
// C display.h:glyph_is_cmap_b().
export function glyphIsCmapB(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapB
        && glyph < CmapSymbol.arrowTrap + MAXTCHARS - CmapSymbol.grave + GlyphOffset.cmapB;
}
// C display.h:glyph_is_cmap_zap()
export function glyphIsCmapZap(glyph: number): boolean {
    return glyph >= GlyphOffset.zap && glyph < (NUM_ZAP << 2) + GlyphOffset.zap;
}
// C display.h:glyph_is_cmap_c().
export function glyphIsCmapC(glyph: number): boolean {
    return glyph >= GlyphOffset.cmapC
        && glyph < CmapSymbol.goodpos - CmapSymbol.digbeam + 1 + GlyphOffset.cmapC;
}

// C display.h:glyph_to_mon(): pets, detected and ridden monsters all decode
// to their species; anything else is the fencepost species NUMMONS.
export function glyphToMon(glyph: number): number {
    return glyphIsNormalFemaleMonster(glyph) ? glyph - GlyphOffset.monFemale
        : glyphIsNormalMaleMonster(glyph) ? glyph - GlyphOffset.monMale
        : glyphIsFemalePet(glyph) ? glyph - GlyphOffset.petFemale
        : glyphIsMalePet(glyph) ? glyph - GlyphOffset.petMale
        : glyphIsDetectedFemaleMonster(glyph) ? glyph - GlyphOffset.detectFemale
        : glyphIsDetectedMaleMonster(glyph) ? glyph - GlyphOffset.detectMale
        : glyphIsRiddenFemaleMonster(glyph) ? glyph - GlyphOffset.riddenFemale
        : glyphIsRiddenMaleMonster(glyph) ? glyph - GlyphOffset.riddenMale
        : NUMMONS;
}

// C display.h:glyph_to_obj(): bodies are the generic CORPSE, statues the
// generic STATUE, generic glyphs their class marker, and anything else the
// fencepost object NUM_OBJECTS.
export function glyphToObj(glyph: number): number {
    return glyphIsBody(glyph) ? CORPSE
        : glyphIsStatue(glyph) ? STATUE
        : glyphIsGenericObject(glyph)
            ? glyph - (glyphIsPiletopGenericObj(glyph)
                ? GlyphOffset.objectPiletop : GlyphOffset.object)
        : glyphIsNormalObject(glyph)
            ? glyph - (glyphIsNormalPiletopObj(glyph)
                ? GlyphOffset.objectPiletop : GlyphOffset.object)
        : NUM_OBJECTS;
}

// C display.h:glyph_to_swallow(): the swallow position in the low three bits;
// zero outside the range for lack of anything better.
export function glyphToSwallow(glyph: number): number {
    return glyphIsSwallow(glyph) ? (glyph - GlyphOffset.swallow) & 0x7 : 0;
}

// C display.h:glyph_to_warning()
export function glyphToWarning(glyph: number): number {
    return glyphIsWarning(glyph) ? glyph - GlyphOffset.warning : 0;
}

// C display.h:glyph_to_explosion(): the position within one explosion's nine
// characters; zero outside the range.
export function glyphToExplosion(glyph: number): number {
    return glyphIsExplosion(glyph)
        ? (glyph - GlyphOffset.explodeDark)
            % (CmapSymbol.explosionBottomRight - CmapSymbol.explosionTopLeft + 1)
        : 0;
}

// C display.h:glyph_to_trap(): the trap glyph's tail of cmap range B decodes
// through rm.h:defsym_to_trap; anything else is NO_GLYPH (== MAX_GLYPH).
export function glyphToTrap(glyph: number): number {
    return glyphIsTrap(glyph)
        ? glyph - glyphTrapOffset() + 1
        : GlyphOffset.max;
}
