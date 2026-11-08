// display.js — Map rendering and terminal output.
// C ref: display.c — newsym, show_glyph, docrt, cls, flush_screen.

import {
    RANDOM_CLASS, ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
    AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS,
    SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS,
    BALL_CLASS, CHAIN_CLASS, VENOM_CLASS, MAXOCLASSES,
} from './objclass.js';
import {
    objectClassForType, LARGE_BOX, CHEST, GOLD_PIECE, FOOD_RATION, CORPSE, TOWEL, STATUE, BOULDER,
    OBJECT_BASES, OBJECT_COLOR,
    oc_color, OBJ_NAME, getObjectDefinition,
} from './object_data.js';
import { pline_xy } from './pline.js';
import { engravingAt, heroCanReachFloor } from './engrave.js';
import { flushPendingTopline } from './topl.js';
import { updateStatusLines } from './botl.js';
import { _buildScreenOutput, writeMapCell } from './wintty.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { known_branch_stairs, stairwayAt } from './stairs.js';
import { C_ATR_INVERSE, terminalAttrFromCAttr } from './color_attr.js';
import { monsterAtPosition } from './steed.js';
import { redrawMonsterWormSegments, wormKnown } from './worm.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { CmapSymbol, GlyphOffset, altarToGlyph, cmapToGlyph, detectedMonnumToGlyph, explosionToGlyph, glyphIsCmapA, glyphIsCmapAltar, glyphIsCmapB, glyphIsCmapMain, glyphIsCmapSokoban, glyphIsExplosion, glyphIsMonster, glyphIsNormalMaleMonster, monnumToGlyph, objnumToGlyph, petnumToGlyph, riddenMonnumToGlyph, warningToGlyph } from './glyph_numbers.js';

import { isok } from './cmd.js';
import { cmapToType } from './mkroom.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { drawbridgeUnderlyingType, isIceAt, isPoolAt, isPoolOrLavaAt } from './dbridge.js';
import { heroWarnsOfMonster } from './polyself.js';
import { artifactWarningFeedback } from './artifact.js';
import { cansee, couldsee, mimicBlocksLight, vision_note_blocker_change, vision_recalc } from './vision.js';
import { describeMapLocation } from './pager.js';
import { glyphToCmapSymbol } from './glyphs.js';
import { ACCESSIBLE, BC_BALL, BC_CHAIN, COLNO, ROWNO, STONE, ROOM, CORR, SCORR, SDOOR, DOOR, STAIRS, FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, HI_ZAP, TREE, IRONBARS, POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, AIR, CLOUD, IS_POOL, IS_OBSTRUCTED, IS_ROOM, IS_WALL, IS_STWALL, LADDER, LA_DOWN, DBWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN, SV0, SV1, SV2, SV3, SV4, SV5, SV6, SV7, SVALL, WM_MASK, WM_X_TL, WM_X_TR, WM_X_BL, WM_X_BR, WM_X_TLBR, WM_X_BLTR, BEAR_TRAP, WEB, VIBRATING_SQUARE, CORPSTAT_GENDER, CORPSTAT_FEMALE, ENGRAVE, BURN, HEADSTONE, EXPL_FROSTY, EXPL_MAGICAL, EXPL_WET, EXPL_MUDDY, EXPL_NOXIOUS, EXPL_FIERY, is_pit, M_AP_NOTHING, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, def_warnsyms, MON_STILL_ARRIVING, Is_rogue_level, Is_waterlevel, Is_knox_level, In_sokoban, FEMALE, MALE, MONSEEN_NORMAL, MONSEEN_SEEINVIS, MONSEEN_INFRAVIS, MONSEEN_TELEPAT, MONSEEN_XRAYVIS, MONSEEN_DETECT, MONSEEN_WARNMON, TIMEOUT, Upolyd, ismnum } from './const.js';
import { NO_COLOR, ATR_INVERSE, CLR_BLACK, CLR_RED, CLR_GREEN, CLR_GRAY, CLR_BROWN, CLR_MAGENTA, CLR_CYAN, CLR_WHITE, CLR_YELLOW, CLR_BLUE, CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA } from './terminal.js';
import { MONSTER_COLOR, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { rn2Display } from './rng.js';
import { recordObjectEncounter, objectTypeColor } from './o_init.js';
import { grantIntrinsicProperty, hasCarriedProperty, hasWornProperty, propertyIsActive, refreshProperty } from './properties.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MapLocation, Position, Trap, Engraving } from './map_types.js';
import { infravisible, monsterIsMindless } from './mondata.js';
import { updateLastSeenTerrain } from './dungeon.js';

export interface GlyphAppearance {
    ch: string;
    color: number;
    dec?: boolean;
    decgfx?: boolean;
    attr?: number;
}

// Indexed projections carry the native display.h glyph number. Unindexed
// transient effects carry only appearance until their native owner is ported.
export type GlyphMetadata = { glyph?: number } & (
    | { kind: 'terrain'; terrainName: string }
    | { kind: 'monster'; mnum?: number; piletop?: false }
    | { kind: 'object'; otyp: number; corpsenm?: number;
        statueGlyph?: boolean; piletop?: boolean }
    | { kind: 'trap'; trapType: number }
    | { kind: 'nothing' | 'engraving' | 'invisible' | 'effect' | 'warning' | 'unexplored' });

/** A remembered glyph owns its appearance; a live overlay may store only metadata. */
export type DisplayGlyph = GlyphAppearance & GlyphMetadata;
/** A transient effect may use the terminal's default color and character set. */
export type TransientGlyph = GlyphMetadata & Pick<GlyphAppearance, 'ch'>
    & Partial<Omit<GlyphAppearance, 'ch'>>;
export type TerrainGlyph = GlyphAppearance & { dec: boolean }
    & Extract<GlyphMetadata, { kind: 'terrain' }>;
type ObjectGlyph = GlyphAppearance & Extract<GlyphMetadata, { kind: 'object' | 'monster' }>;

/** Mimics project an object description without creating an inventory object. */
interface ObjectGlyphSource {
    otyp: number;
    oclass: number;
    ox?: number;
    oy?: number;
    corpsenm?: number;
    spe?: number;
    color?: number;
    dknown?: boolean;
}
interface FloorObjectGlyphSource extends ObjectGlyphSource {
    ox: number;
    oy: number;
}
interface MimicAppearance {
    mappearance?: number;
    mcorpsenm?: number;
}
interface MonsterProjection { wormTail: boolean; showAppearance: boolean; detected: boolean }
interface RedrawOptions { beforeGlow?: (() => void | Promise<void>) | null }

// C drawing.c:def_r_oc_syms.  Rogue deliberately resembles the older game:
// armor uses ']', amulets ',', food ':', and coins share gems' '*'.
const ROGUE_OBJECT_SYMBOLS = ['', ']', ')', ']', '=', ',', '(', ':', '!', '?',
    '+', '/', '*', '*', '`', '0', '_', '.'];
const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];

// Port only: the currently shown symbol set (rogue or primary).
export function shownSymbolSet(state: GameState = game) {
    const rogue = Is_rogue_level(state.u?.uz, state);
    return state.shownSymbols ?? {
        rogue, name: (rogue ? state.rogueSymset : state.symset) ?? null,
    };
}

// C sym.h:SYMHANDLING(H_DEC) over gs.symset[gc.currentgraphics]: the shown
// set's handling test.  DECgraphics declares `Handling: DEC` and loads into
// either slot — the roguesymset option never checks `Restrictions: primary`
// (options.c:3553-3566 -> read_sym_file), so a Rogue level whose rogue set
// is DECgraphics also carries the DEC handling.  assign_graphics()
// (symbols.c:233/246) picks the slot from the level; switch_symbols()
// (symbols.c:257-260) copies a picked primary set into showsyms without
// changing currentgraphics.
export function usesDecSymbols(state: GameState = game): boolean {
    return /^DECgraphics$/i.test(shownSymbolSet(state).name ?? '');
}

// Port only: the active set's object-class symbol table.
export function activeObjectSymbols() {
    const shown = shownSymbolSet();
    if (!shown.rogue) return OBJECT_CLASS_SYMBOLS;
    if (shown.name) {
        const key = shown.name.toLowerCase();
        if (ROGUE_SYMSETS[key]?.blank) return BLANK_OBJECT_SYMBOLS;
        return ROGUE_SYMSET_OBJECT_TABLES[key] ?? ROGUE_OBJECT_SYMBOLS;
    }
    return ROGUE_OBJECT_SYMBOLS;
}

// Port only: object-class symbol lookup.
export function objectClassSymbol(index: number): string {
    return activeObjectSymbols()[index] ?? '';
}

// Part of C symbols.c:get_othersym(): the SYM_BOULDER lookup for the active symbol set.
// symbols.c:get_othersym(SYM_BOULDER, which_set): the active set's override,
// else the default rock-class symbol.  optfn_boulder() fills both sets'
// overrides, while the BOULDER= statement (cfgfiles.c) only fills the
// primary one. A named primary selection can display that slot on Rogue.
export function currentBoulderSymbol(state: GameState = game): string {
    if (shownSymbolSet(state).rogue) {
        const set = activeRogueSymset(state);
        return state.rogueBoulderSym
            || (set?.blank ? BLANK_SYMBOL : '`');
    }
    return state.boulderSym || '`';
}

const TELEPATHY_RANGE = 8 * 8; // BOLT_LIM squared
const HELM_OF_TELEPATHY = 100;
const AMULET_OF_ESP = 201;
const PM_LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');

// Part of C worn.c:recalc_telepat_range(): the worn telepathy count as
// u.unblind_telepat_range.
export function unblindTelepathyRange() {
    const wornSources = [game.uarmh, game.uamul].filter(object => object
        && (object.otyp === HELM_OF_TELEPATHY
            || object.otyp === AMULET_OF_ESP)).length;
    const liveRange = wornSources * TELEPATHY_RANGE;
    const storedRange = game.u?.unblind_telepat_range ?? -1;
    return Math.max(liveRange || -1, storedRange);
}

// C display.c:sensemon().
export function senseWithTelepathy(monster: Monster | null | undefined) {
    if (!monster
        || monsterIsMindless(monster.mnum)) return false;
    if (game.blind && game.u.telepathy) return true;
    // C Unblind_telepat requires an extrinsic source even when worn.c counts
    // a wielded non-weapon telepathy object toward the cached range.
    if (!hasWornProperty('telepathy') && !hasCarriedProperty('telepathy')) return false;
    const range = unblindTelepathyRange();
    if (range < 0) return false;
    const dx = monster.mx - game.u.ux;
    const dy = monster.my - game.u.uy;
    return dx * dx + dy * dy <= range;
}

// C display.c:mon_visible().
// This does not check the square or sensory detection.
export function monsterVisible(monster: Monster, state: GameState = game) {
    const seesInvisible = !!(state.u.seeInvisible
        || (state.u.seeInvisibleTurns ?? 0) > 0);
    return (!monster.minvis || seesInvisible) && !monster.mundetected;
}

// C display.c:see_with_infrared().
export function seeMonsterWithInfrared(monster: Monster) {
    return !game.blind && !!game.u?.infravision
        && !!infravisible(monster.mnum)
        && couldsee(monster.mx, monster.my);
}

// Part of C display.c:newsym(): the physically-seen test.
function canPhysicallyProjectMonster(monster: Monster, x: number, y: number) {
    return monsterVisible(monster) && (cansee(x, y) || seeMonsterWithInfrared(monster));
}

// C display.h:canseemon(), an actor-level optical sight query.
export function canSeeMonster(monster: Monster) {
    return monster.wormno ? wormKnown(monster) && monsterVisible(monster)
        : canPhysicallyProjectMonster(monster, monster.mx, monster.my);
}


// Part of C display.c:newsym(): the worm-tail test.
function isWormTail(monster: Monster | null | undefined, x: number, y: number) {
    return !!monster?.wormno && (x !== monster.mx || y !== monster.my);
}

// Part of C display.c:newsym(): which sense projects the monster at this
// cell.
function monsterProjectionAtCell(monster: Monster, x: number, y: number): MonsterProjection | null {
    const wormTail = isWormTail(monster, x, y);
    // newsym() checks each sense directly after its viewport guards. Only
    // display_monster() uses sensemon() to decide whether a disguise fails.
    const located = senseWithTelepathy(monster) || heroWarnsOfMonster(monster);
    const detected = heroDetectsMonsters();
    if (cansee(x, y)) {
        // Native PHYSICALLY_SEEN includes telepathy/warning on a visible head
        // square. Only this branch can map a mimic's appearance into memory.
        const showAppearance = monsterVisible(monster) || (!wormTail && located);
        return showAppearance || (!wormTail && detected)
            ? { wormTail, showAppearance, detected: !showAppearance } : null;
    }
    // Native permits telepathy/warn-of-monster on unseen tails, but ordinary
    // Detect monsters only projects the head.
    const seen = located || (seeMonsterWithInfrared(monster) && monsterVisible(monster));
    return seen || (!wormTail && detected)
        ? { wormTail, showAppearance: false, detected: !seen } : null;
}

// C display.h:sensemon().  This excludes ordinary sight so callers can tell
// whether a disguised monster was noticed by telepathy or detection.
export function canSenseMonster(monster: Monster | null | undefined) {
    if (!monster) return false;
    if ((game.u?.uswallow || game.uswallow)
        && game.u?.ustuck !== monster) return false;
    if (game.u?.uinwater || game.underwater) {
        const distance = (monster.mx - game.u.ux) ** 2
            + (monster.my - game.u.uy) ** 2;
        if (distance > 2 || !isPoolAt(monster.mx, monster.my)) return false;
    }
    return senseWithTelepathy(monster)
        || heroWarnsOfMonster(monster)
        || heroDetectsMonsters();
}

// C display.h:canspotmon(). Seeing or sensing any part identifies the actor.
// Per-cell projection can still hide its head or other segments.
// Ordinary Warning does not identify the monster.
export function canSpotMonster(monster: Monster | null | undefined) {
    return !!monster && (canSeeMonster(monster) || canSenseMonster(monster));
}

// C display.c:mon_warning(): the warning projection test — display.h's
// _mon_warning macro: Warning, not peaceful, mdistu() < 100, and
// m_lev / 4 already at context.warnlevel.
export function monsterHasWarningProjection(monster: Monster | null | undefined) {
    if (!monster || !game.u?.warning || monster.mpeaceful) return null;
    const dx = monster.mx - game.u.ux, dy = monster.my - game.u.uy;
    if (dx * dx + dy * dy >= 100) return null;
    // C dist2(): the warning radius is a squared distance (ten squares).
    return warningOf(monster) >= (game.context?.warnlevel ?? 1);
}

// C display.c:warning_of(): the warning level of a warning-eligible
// monster: m_lev / 4 clamped to WARNCOUNT - 1 (def_warnsyms here).
function warningOf(monster: Monster): number {
    return Math.min(def_warnsyms.length - 1, Math.trunc((monster.m_lev ?? 0) / 4));
}

// C display.c:display_warning(): the ordinary-warning glyph — warning_of()'s
// m_lev/4, rerolled on the display RNG while hallucinating — which newsym()'s
// warning branch (C show_mon_or_warn()) shows over an otherwise-unshown
// monster.
function warningProjection(monster: Monster | null | undefined) {
    if (!monster || !monsterHasWarningProjection(monster)) return null;
    const level = heroIsHallucinating()
        ? rn2Display(def_warnsyms.length - 1) + 1
        : warningOf(monster);
    // The map reads showsyms[SYM_OFF_W+n], which symset loading initializes
    // from def_warnsyms; WARNINGS=/warnings: only retarget the pager lookup.
    const warning = def_warnsyms[level];
    return warning ? { ...warning, glyph: warningToGlyph(level) } : null;
}

// C display.h:obj_is_generic().
export function objectUsesGenericGlyph(object: ObjectGlyphSource | null | undefined) {
    if (!object || object.dknown) return false;
    return object?.oclass === POTION_CLASS
        || (object?.otyp >= 439 && object?.otyp <= 469) // real/glass gems
        || (object?.otyp >= 366 && object?.otyp <= 407); // ordinary spells
}

// Part of C display.c:map_object(): the close-observation promotion.
function observeNearbyObject(object: ObjectGlyphSource, x: number, y: number) {
    const generic = objectUsesGenericGlyph(object);
    // C display.c:map_object() only promotes a map projection into an
    // observation when the glyph is generic.  An ordinary type-specific
    // glyph can be rendered without adding that type to discoveries; explicit
    // examination, inventory, and pickup paths own those encounters.
    // STRANGE_OBJECT lies outside C's generic glyph range, so a mimic's
    // zero-class disguise cannot become a known object at close range.
    if (!generic || object.oclass === RANDOM_CLASS) return false;
    const range = Math.max(game.u?.xray_range ?? -1, 2);
    const dx = x - game.u.ux, dy = y - game.u.uy;
    const nearDistance = range * range * 2 - range;
    if (dx * dx + dy * dy > nearDistance) return false;
    if (heroIsHallucinating(game))
        return false;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
    return true;
}

// C display.c:see_nearby_objects(), called by dungeon.c:u_on_newpos().
export async function see_nearby_objects() {
    const r = Math.max(game.u?.xray_range ?? -1, 2);
    const nearDistance = r * r * 2 - r;
    for (let y = (game.u?.uy ?? 0) - r; y <= (game.u?.uy ?? 0) + r; y++) {
        for (let x = (game.u?.ux ?? 0) - r; x <= (game.u?.ux ?? 0) + r; x++) {
            const object = game.level?.objects?.[x]?.[y]?.[0];
            if (!object || object.dknown || !cansee(x, y)) continue;
            const dx = x - game.u.ux, dy = y - game.u.uy;
            if (dx * dx + dy * dy > nearDistance) continue;
            // Unlike map_object(), display.c:see_nearby_objects() observes
            // every visible object inside the close-name radius.  Only the
            // repaint is conditional, and it tests the remembered glyph: an
            // object first seen under a monster may not be remembered at all.
            if (heroIsHallucinating(game))
                continue;
            object.dknown = true;
            recordObjectEncounter(object.otyp);
            // C display.h:glyph_is_generic_object(), on the remembered glyph:
            // generic object numbers are the class slots below MAXOCLASSES;
            // zero is the strange object, not a class.  A generic object can
            // remain continuously visible while the hero crosses the
            // close-observation boundary, so the repaint keys on the
            // remembered glyph, not on a visibility transition.
            const memory = game.level?.at(x, y)?.remembered_glyph;
            if (memory?.kind === 'object' && !memory.statueGlyph
                && memory.otyp > 0 && memory.otyp < MAXOCLASSES)
                await newsym_force(x, y);
        }
    }
}

// Part of C display.c:reset_glyphmap(): the obj_color() and mon_color()
// rows for object, corpse and statue glyphs.
export function objectColor(object: ObjectGlyphSource): number {
    if (typeof object.color === 'number' && Number.isInteger(object.color)) return object.color;
    // C obj_is_generic(): hide potion/gem/spellbook appearance until the
    // hero has observed it closely enough. Generic class rows are indexed by
    // oclass and deliberately use the ordinary gray tty foreground.
    if (objectUsesGenericGlyph(object))
        return oc_color(object.oclass);
    // C obj_to_glyph(): a corpse keeps the depicted monster's color; it is
    // not colored as a generic food-class object.
    if (object?.otyp === CORPSE && typeof object.corpsenm === 'number' && Number.isInteger(object.corpsenm))
        return MONSTER_COLOR[object.corpsenm] ?? CLR_BROWN;
    if (object?.otyp === TOWEL) return CLR_MAGENTA;
    if (object?.otyp === LARGE_BOX || object?.otyp === CHEST) return CLR_BROWN;
    if (object?.otyp === FOOD_RATION) return CLR_BROWN;
    if (object?.otyp === GOLD_PIECE) return CLR_YELLOW;
    const metadataColor = objectTypeColor(object?.otyp);
    return typeof metadataColor === 'number' && Number.isInteger(metadataColor)
        ? metadataColor : CLR_GRAY;
}

// Part of C display.c:newsym(): the remembered dark-room/corridor
// downgrade.
function rememberedGlyph(glyph: DisplayGlyph, loc: MapLocation, x: number, y: number): DisplayGlyph {
    if (glyph.kind !== 'terrain' || cansee(x, y)) return glyph;
    const rogue = Is_rogue_level(game.u.uz);
    const darkRoom = !rogue && (game.flags.dark_room ?? true) && game.flags.color !== false;
    if (loc.typ === CORR && glyph.glyph === cmapToGlyph(CmapSymbol.litcorr)
        && (rogue || !loc.waslit || darkRoom)) {
        // lookat() names the square from the downgraded glyph number.
        return { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr),
            terrainName: 'corridor' };
    }
    if (loc.typ !== ROOM || glyph.glyph !== cmapToGlyph(CmapSymbol.room)
        || loc.waslit && !darkRoom) return glyph;
    if (rogue) {
        return { ch: ' ', color: NO_COLOR, decgfx: false, kind: 'terrain',
            terrainName: 'stone', glyph: cmapToGlyph(CmapSymbol.stone) };
    }
    return { ...glyph, ch: darkRoom ? glyph.ch : ' ',
        color: darkRoom ? 16 : NO_COLOR, decgfx: darkRoom && !!glyph.decgfx,
        terrainName: 'dark part of a room', glyph: cmapToGlyph(CmapSymbol.darkroom) };
}

// Part of C display.c:newsym(): showing the remembered location.
async function showRememberedLocation(x: number, y: number, loc: MapLocation): Promise<void> {
    const memory = loc.remembered_glyph;
    if (!memory) return;
    const glyph = rememberedGlyph(memory, loc, x, y);
    loc.remembered_glyph = glyph;
    await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx,
        objectGlyphAttr(glyph), glyph);
}

// C display.c:reglyph_darkroom(). Option changes convert stored floor glyphs
// before docrt() displays memory; ordinary redraws must leave memory alone.
export function reglyph_darkroom(): void {
    if (!game.level) return;
    const darkRoom = game.flags.dark_room ?? true;
    const showDarkFloor = darkRoom && game.flags.color !== false
        && !Is_rogue_level(game.u.uz);
    const dec = usesDecSymbols();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            const memory = loc?.remembered_glyph;
            if (!loc || !memory) continue;

            if (!darkRoom && loc.waslit && memory.glyph === cmapToGlyph(CmapSymbol.corr)) {
                loc.remembered_glyph = { ...memory, color: CLR_WHITE,
                    glyph: cmapToGlyph(CmapSymbol.litcorr),
                    kind: 'terrain', terrainName: 'lit corridor' };
            } else if (darkRoom && !cansee(x, y)
                && memory.glyph === cmapToGlyph(CmapSymbol.litcorr)) {
                loc.remembered_glyph = { ...memory, color: NO_COLOR,
                    glyph: cmapToGlyph(CmapSymbol.corr),
                    kind: 'terrain', terrainName: 'corridor' };
            }

            if (!showDarkFloor) {
                if (memory.glyph === cmapToGlyph(CmapSymbol.darkroom)) {
                    loc.remembered_glyph = loc.waslit ? roomMemoryGlyph(false, dec)
                        : { ch: ' ', color: NO_COLOR, decgfx: false,
                            kind: 'nothing', glyph: GlyphOffset.nothing };
                }
            } else if (memory.glyph === cmapToGlyph(CmapSymbol.darkroom)
                || (loc.seenv && !cansee(x, y)
                    && (memory.glyph === cmapToGlyph(CmapSymbol.room) && loc.waslit
                        || memory.glyph === GlyphOffset.nothing && loc.typ === ROOM))) {
                // Native also refreshes showsyms[S_darkroom] for glyphs that
                // were already stored as darkroom while color was disabled.
                loc.remembered_glyph = roomMemoryGlyph(true, dec);
            }
        }
    }
}

// Part of C symbols.c:switch_symbols(), symbols.c:assign_graphics():
// re-resolve memory characters after a set change.  Object classes differ
// on Rogue, and terrain characters and branch wall colors also depend on
// the selected set.
export function reglyphSymbolSet(): void {
    if (!game.level) return;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            const memory = loc?.remembered_glyph;
            if (!loc || !memory) continue;
            if (memory.kind === 'object' && !memory.statueGlyph) {
                const ch = memory.otyp === BOULDER ? currentBoulderSymbol()
                    : activeObjectSymbols()[objectClassForType(memory.otyp)] ?? memory.ch;
                loc.remembered_glyph = { ...memory, ch };
                continue;
            }
            if (memory.kind === 'trap') {
                loc.remembered_glyph = { ...memory,
                    ch: transientTrapGlyph({ ttyp: memory.trapType }).ch };
                continue;
            }

            if (memory.kind === 'object' && memory.statueGlyph && memory.corpsenm !== undefined) {
                // A displayed rogue set can replace the monster-class
                // symbol a statue shows (Blank blanks every class).
                loc.remembered_glyph = { ...memory,
                    ch: monsterClassSymbol(MONSTER_SYMBOL[memory.corpsenm] ?? 0) };
                continue;
            }
            const glyphNumber = memory.glyph;
            if (memory.kind !== 'terrain'
                || typeof glyphNumber !== 'number') continue;
            const index = rememberedTerrainIndex(glyphNumber);
            if (index === null) continue;
            // display.c:reglyph_darkroom() points S_darkroom at the room
            // symbol only while dark-room display is active; otherwise the
            // stored character stays the blank SYM_NOTHING one.
            if (index === CmapSymbol.darkroom) {
                const showDarkFloor = (game.flags.dark_room ?? true)
                    && game.flags.color !== false && !shownSymbolSet().rogue;
                const room = cmapSymbolAppearance(CmapSymbol.room);
                loc.remembered_glyph = { ...memory,
                    ch: showDarkFloor ? room.ch : ' ',
                    decgfx: showDarkFloor ? room.dec : false };
                continue;
            }
            const appearance = cmapSymbolAppearance(index);
            const wall = index >= CmapSymbol.vwall && index <= CmapSymbol.trwall;
            const offset = glyphNumber - (index - CmapSymbol.vwall);
            // clear_all_glyphmap_colors() drops the previous set's G_ wall
            // colors first; a set that declares its own re-colors the
            // branch walls (the glyph range names the branch), and any
            // other set leaves them their set-independent gray.
            let color = memory.color;
            if (wall) {
                if (BRANCH_WALL_COLOR_SYMSETS.test(shownSymbolSet().name ?? ''))
                    color = decWallColors.get(offset) ?? memory.color;
                else if ([CLR_BROWN, CLR_RED, CLR_YELLOW, CLR_BLUE].includes(memory.color))
                    color = NO_COLOR;
            }
            loc.remembered_glyph = { ...memory, ch: appearance.ch,
                color: color ?? memory.color, decgfx: appearance.dec };
        }
    }
}

// Part of C options.c:optfn_boulder(): repaint remembered boulders through
// the refreshed symbol.
export function reglyphBoulderSymbols(): void {
    if (!game.level) return;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            const memory = loc?.remembered_glyph;
            if (!loc || !memory || memory.kind !== 'object' || memory.otyp !== BOULDER) continue;
            loc.remembered_glyph = { ...memory, ch: currentBoulderSymbol() };
        }
    }
}

// Part of C glyphs.c:glyph_to_cmap(): restricted to the terrain memory can hold; trap,
// beam, and effect glyphs keep set-independent characters, so everything at
// or past the first trap symbol (and every non-terrain glyph) decodes null.
function rememberedTerrainIndex(glyph: number): number | null {
    const symbol = glyphToCmapSymbol(glyph);
    return symbol !== null && symbol < CmapSymbol.arrowTrap ? symbol : null;
}

// Part of C display.c:reglyph_darkroom(), display.c:newsym(): the
// remembered room glyph.
function roomMemoryGlyph(dark: boolean, dec: boolean): DisplayGlyph {
    return {
        ch: dec ? '~' : '.', color: dark ? 16 : NO_COLOR, decgfx: dec,
        kind: 'terrain', terrainName: dark ? 'dark part of a room' : 'floor of a room',
        glyph: cmapToGlyph(dark ? CmapSymbol.darkroom : CmapSymbol.room),
    };
}
// Part of C display.c:back_to_glyph(): the stair glyph with known-branch
// stairs.
function stairGlyphIndex(loc: MapLocation, x: number, y: number) {
    // C display.c:back_to_cmap(). Direction belongs to the terrain cell;
    // the traversed stairway determines whether its branch is known.
    const stair = stairwayAt(game, x, y);
    const knownBranch = stair !== null && known_branch_stairs(stair, game);
    return (knownBranch ? 29 : 25)
        + (loc.typ === LADDER ? 2 : 0) + (((loc.ladder ?? 0) & LA_DOWN) ? 1 : 0);
}

// Part of C display.c:back_to_glyph(): the stair symbol lookup.
function stairSymbol(loc: MapLocation, x: number, y: number) {
    const index = stairGlyphIndex(loc, x, y);
    const symbol = MAP_SYMBOLS[index];
    if (!symbol) throw new RangeError(`Missing stair symbol ${index} at (${x}, ${y})`);
    return symbol;
}


// ── Terrain to display character + color + DEC flag ──
const TERRAIN_NAMES = new Map([
    [STONE, 'stone'], [SCORR, 'stone'], [ROOM, 'floor of a room'],
    [TREE, 'tree'], [IRONBARS, 'iron bars'], [POOL, 'water'], [MOAT, 'water'],
    [WATER, 'water'], [LAVAPOOL, 'molten lava'], [LAVAWALL, 'wall of lava'],
    [FOUNTAIN, 'fountain'], [THRONE, 'opulent throne'], [SINK, 'sink'],
    [GRAVE, 'grave'], [ALTAR, 'altar'], [ICE, 'ice'], [AIR, 'air'],
    [CLOUD, 'cloud'], [DRAWBRIDGE_DOWN, 'lowered drawbridge'],
]);
// Part of C pager.c:lookat(): the terrain name for a square.
function terrainGlyphName(loc: MapLocation, x: number, y: number, glyph: GlyphAppearance): string {
    if (isArborealBackground(loc)) return 'tree';
    if (loc.typ === DBWALL) return 'raised drawbridge';
    if (IS_WALL(loc.typ) || loc.typ === SDOOR)
        return glyph.ch === ' ' ? 'stone' : 'wall';
    if (loc.typ === DOOR) {
        if (!loc.doormask || loc.doormask & D_BROKEN) return 'doorway';
        if (loc.doormask & D_ISOPEN) return 'open door';
        return 'closed door';
    }
    if (loc.typ === STAIRS || loc.typ === LADDER) {
        return stairSymbol(loc, x, y).name;
    }
    if (loc.typ === CORR)
        return loc.waslit || game.flags?.lit_corridor
            ? 'lit corridor' : 'corridor';
    return TERRAIN_NAMES.get(projectedTerrainType(loc)) || 'stone';
}
// C display.c:back_to_glyph(): the background glyph of a square.  C's bare
// glyph number arrives with the appearance map_glyphinfo() resolves for it
// — character, color and terrain name — because the port paints glyphs
// directly.  The wall branch is projectedTerrainType() + wall_angle()
// below; the altar bypass is altar_to_glyph().
export function back_to_glyph(loc: MapLocation, x: number, y: number): TerrainGlyph {
    const appearance = terrainGlyphAppearance(loc, x, y);
    const typ = projectedTerrainType(loc);
    const symbol = terrainSymbolIndex(loc, x, y, typ, appearance);
    return {
        ...appearance, kind: 'terrain', terrainName: terrainGlyphName(loc, x, y, appearance),
        glyph: typ === ALTAR ? altarToGlyph(loc.flags) : cmapToGlyph(symbol, currentWallGlyphOffset()),
    };
}

// Part of C display.h:cmap_walls_to_glyph(): the branch wall offset.
function currentWallGlyphOffset(): GlyphOffset {
    const branch = game.dungeons[game.u.uz?.dnum ?? 0];
    return branch?.dname === 'The Gnomish Mines' ? GlyphOffset.cmapMines
        : branch?.flags.hellish ? GlyphOffset.cmapGehennom
            : Is_knox_level(game.u.uz) ? GlyphOffset.cmapKnox
                : In_sokoban(game.u.uz) ? GlyphOffset.cmapSokoban : GlyphOffset.cmapMain;
}
// Part of C display.c:back_to_glyph(): the cmap symbol for the terrain.
function terrainSymbolIndex(loc: MapLocation, x: number, y: number, typ: number, appearance: GlyphAppearance) {
    if ((IS_WALL(typ) && typ !== DBWALL) || typ === SDOOR) {
        if (appearance.ch === ' ') return CmapSymbol.stone;
        if (typ === SDOOR) return loc.horizontal ? CmapSymbol.hwall : CmapSymbol.vwall;
        return typ;
    }
    if (typ === DOOR) {
        if (!loc.doormask || (loc.doormask & D_BROKEN)) return CmapSymbol.ndoor;
        if (loc.doormask & D_ISOPEN) return loc.horizontal ? CmapSymbol.hodoor : CmapSymbol.vodoor;
        return loc.horizontal ? CmapSymbol.hcdoor : CmapSymbol.vcdoor;
    }
    if (typ === STAIRS || typ === LADDER) return stairGlyphIndex(loc, x, y);
    if (typ === CORR) return loc.waslit || game.flags.lit_corridor
        ? CmapSymbol.litcorr : CmapSymbol.corr;
    if (typ === DBWALL) return loc.horizontal ? CmapSymbol.hcdbridge : CmapSymbol.vcdbridge;
    if (typ === DRAWBRIDGE_DOWN) return loc.horizontal ? CmapSymbol.hodbridge : CmapSymbol.vodbridge;
    switch (typ) {
    case ROOM: return CmapSymbol.room;
    case TREE: return CmapSymbol.tree;
    case IRONBARS: return CmapSymbol.bars;
    case POOL:
    case MOAT: return CmapSymbol.pool;
    case WATER: return CmapSymbol.water;
    case LAVAPOOL: return CmapSymbol.lava;
    case LAVAWALL: return CmapSymbol.lavawall;
    case FOUNTAIN: return CmapSymbol.fountain;
    case THRONE: return CmapSymbol.throne;
    case SINK: return CmapSymbol.sink;
    case GRAVE: return CmapSymbol.grave;
    case ALTAR: return CmapSymbol.altar;
    case ICE: return CmapSymbol.ice;
    case AIR: return CmapSymbol.air;
    case CLOUD: return CmapSymbol.cloud;
    default: return CmapSymbol.stone;
    }
}
// Part of C display.c:back_to_glyph(): the exposed surface type with
// wall_angle().
function projectedTerrainType(loc: MapLocation) {
    // back_to_glyph() shows the exposed surface under a raised bridge.
    // db_under_typ() uses STONE for dry ground, but its map symbol is room.
    if (loc.typ === DRAWBRIDGE_UP) {
        const surface = drawbridgeUnderlyingType(loc.drawbridgemask ?? 0);
        return surface === STONE ? ROOM : surface;
    }
    if (isArborealBackground(loc)) return TREE;
    // Also C display.c:back_to_glyph(): its wall branch reads
    // `ptr->seenv ? wall_angle(ptr) : S_stone` for every wall type.
    if (IS_WALL(loc.typ) && loc.typ !== DBWALL || loc.typ === SDOOR)
        return (loc.seenv || 0) ? wall_angle(loc) : STONE;
    return loc.typ;
}

// Part of C display.c:map_glyphinfo(): the terrain appearance (rogue set
// overlay).
function terrainGlyphAppearance(loc: MapLocation, x: number, y: number): GlyphAppearance & { dec: boolean } {
    const appearance = terrainGlyphChars(loc, x, y);
    if (!shownSymbolSet().rogue) return appearance;
    // Every terrain character resolves through the displayed rogue set's
    // table layered over the base rogue symbols (showsyms[] after
    // assign_graphics(ROGUESET)): rooms, corridors, unseen-wall stone and
    // everything Blank replaces included.  show_glyph_cell() applies the
    // Rogue color rules at paint time.
    const index = terrainSymbolIndex(loc, x, y, projectedTerrainType(loc), appearance);
    return { ...cmapSymbolAppearance(index), color: NO_COLOR };
}
// Part of C display.c:map_glyphinfo(): the terrain character and branch
// wall color.
function terrainGlyphChars(loc: MapLocation, x: number, y: number): GlyphAppearance & { dec: boolean } {
    const typ = projectedTerrainType(loc);
    const rogue = Is_rogue_level(game.u?.uz);
    const dec = usesDecSymbols();
    // symbols.c:load_symset() applies these sets' G_ wall colors independently
    // of character handling; glyphs.c:apply_customizations(gc.currentgraphics)
    // applies the shown set's entries, so the shown set's name decides here.
    const hasBranchWallColors = BRANCH_WALL_COLOR_SYMSETS.test(shownSymbolSet().name ?? '');
    const inMines = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname
        === 'The Gnomish Mines';
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? -1]?.flags?.hellish;
    const wallColor = rogue ? NO_COLOR
        : In_sokoban(game.u?.uz)
        ? (hasBranchWallColors ? CLR_BLUE : NO_COLOR)
        : hasBranchWallColors && inMines ? CLR_BROWN
            : hasBranchWallColors && inHell ? CLR_RED
                : hasBranchWallColors && Is_knox_level(game.u.uz) ? CLR_YELLOW : NO_COLOR;
    switch (typ) {
    case STONE:     return { ch: ' ', color: NO_COLOR, dec: false };
    case SCORR:     return { ch: ' ', color: NO_COLOR, dec: false };
    case ROOM:      return dec
        ? { ch: '~', color: NO_COLOR, dec: true }
        : { ch: '.', color: NO_COLOR, dec: false };
    case ICE:       return dec
        ? { ch: '~', color: CLR_CYAN, dec: true }
        : { ch: '.', color: CLR_CYAN, dec: false };
    case DRAWBRIDGE_DOWN: return dec
        ? { ch: '~', color: CLR_BROWN, dec: true }
        : { ch: '.', color: CLR_BROWN, dec: false };
    case DBWALL:    return { ch: '#', color: CLR_BROWN, dec: false };
    // C back_to_glyph(): newsym() records lighting before choosing this glyph.
    // tty renders that CLR_GRAY symbol with its bright foreground treatment;
    // CLR_WHITE is the equivalent serialized color in this port.
    case CORR:      return {
        ch: '#',
        color: loc.waslit || game.flags?.lit_corridor ? CLR_WHITE : NO_COLOR,
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
        if (!loc.doormask || loc.doormask & D_BROKEN)
            return dec
                ? { ch: '~', color: NO_COLOR, dec: true }
                : { ch: '.', color: NO_COLOR, dec: false };
        if (loc.doormask & D_ISOPEN)
            return dec
                ? { ch: 'a', color: CLR_BROWN, dec: true }
                : { ch: loc.horizontal ? '|' : '-', color: CLR_BROWN, dec: false };
        return { ch: '+', color: CLR_BROWN, dec: false };
    case STAIRS:
    case LADDER: {
        const symbol = stairSymbol(loc, x, y);
        return { ...cmapSymbolAppearance(stairGlyphIndex(loc, x, y)),
            color: rogue ? NO_COLOR : symbol.color };
    }
    case FOUNTAIN:   return { ch: '{', color: CLR_BRIGHT_BLUE, dec: false };
    case THRONE:     return { ch: '\\', color: CLR_YELLOW, dec: false };
    case SINK:       return { ch: '{', color: CLR_WHITE, dec: false };
    case GRAVE:      return { ch: '|', color: CLR_WHITE, dec: false };
    case ALTAR: {
        // reset_glyphmap() colors the selected altar glyph; shrine status
        // does not change alignment, while sanctum status selects "other".
        const altar = altarToGlyph(loc.flags) - GlyphOffset.altar;
        const color = altar === 4 ? CLR_BRIGHT_MAGENTA : altar === 0 ? CLR_RED : NO_COLOR;
        return dec
            ? { ch: '{', color, dec: true }
            : { ch: '_', color, dec: false };
    }
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

// Part of C display.c:back_to_glyph(): forest rock and forest secret doors
// share the tree projection, including its terrain name for touch and
// obstacle messages.
function isArborealBackground(loc: MapLocation): boolean {
    return ((loc.typ === STONE || loc.typ === SCORR) && !!game.level?.flags.arboreal)
        || (loc.typ === SDOOR && !!loc.arboreal_sdoor);
}

// C display.h:obj_is_piletop().
function objectIsPiletop(object: ObjectGlyphSource) {
    if (object.ox === undefined || object.oy === undefined) return false;
    const pile = game.level?.objects?.[object.ox]?.[object.oy];
    return Array.isArray(pile) && pile[0] === object && pile.length > 1
        && (object.otyp !== BOULDER || pile[1]?.otyp === BOULDER);
}

// Part of C wintty.c:tty_print_glyph(): the hilite_pile inverse attribute
// (MG_OBJPILE).
function objectGlyphAttr(glyph: GlyphMetadata) {
    const useInverse = game.flags?.use_inverse !== false
        && game.iflags?.wc_inverse !== false
        && game.iflags?.use_inverse !== false;
    return glyph.kind === 'object' && glyph.piletop && game.flags?.hilite_pile && useInverse
        ? ATR_INVERSE : 0;
}

// Part of C display.h:mon_to_glyph(): symbol, color, and glyph number.
function displayMonsterGlyph(
    mnum: number, female = false,
    monsterState: 'normal' | 'pet' | 'detected' | 'ridden' = 'normal',
): GlyphAppearance & Extract<GlyphMetadata, { kind: 'monster' }> {
    const rawColor = MONSTER_COLOR[mnum] ?? CLR_GRAY;
    return {
        ch: monsterClassSymbol(MONSTER_SYMBOL[mnum] ?? 0) || '?',
        // tty has no hilite for ordinary gray; black is dark gray (use_darkgray).
        color: rawColor === CLR_GRAY ? NO_COLOR : rawColor,
        decgfx: false, kind: 'monster', mnum, piletop: false,
        glyph: monsterGlyphNumber(mnum, female, monsterState),
    };
}

// Part of C display.h:monnum_to_glyph(), display.h:petnum_to_glyph(),
// display.h:detected_monnum_to_glyph(), display.h:ridden_monnum_to_glyph():
// the glyph number by monster state.
function monsterGlyphNumber(mnum: number, female: boolean, state: 'normal' | 'pet' | 'detected' | 'ridden') {
    const gender = female ? FEMALE : MALE;
    return state === 'pet' ? petnumToGlyph(mnum, gender)
        : state === 'detected' ? detectedMonnumToGlyph(mnum, gender)
        : state === 'ridden' ? riddenMonnumToGlyph(mnum, gender)
        : monnumToGlyph(mnum, gender);
}

// C display.h:hero_glyph().
function heroDisplayGlyph(): DisplayGlyph {
    if (game.u?.m_ap_type === M_AP_OBJECT)
        return apparentObjectGlyph(game.u);
    if (game.u.m_ap_type === M_AP_MONSTER) {
        const appearance = game.u.mappearance;
        if (!ismnum(appearance)) throw new Error('Hero monster disguise requires a valid species');
        return displayMonsterGlyph(appearance,
            Upolyd(game.u) ? !!game.u.mfemale : !!game.flags.female);
    }
    if (game.u.m_ap_type === M_AP_FURNITURE) {
        const appearance = game.u.mappearance;
        if (appearance === undefined) throw new Error('Hero furniture disguise requires a map symbol');
        return furnitureDisplayGlyph(appearance);
    }
    // display.h:hero_glyph and you.h:Ugender select the current body's sex.
    // Hero glyph identity still changes when the tty symbol remains '@'.
    const polymorphed = Upolyd(game.u);
    const mnum = polymorphed || !game.flags.showrace
        ? game.u.umonnum : game.urace?.mnum;
    if (!ismnum(mnum)) throw new Error('Hero glyph requires an initialized species');
    const glyph = displayMonsterGlyph(mnum,
        polymorphed ? !!game.u.mfemale : !!game.flags.female);
    return polymorphed ? glyph
        : { ...glyph, ch: game.flags.showrace ? glyph.ch
            : monsterClassSymbol(HUMAN_CLASS_INDEX) || '@', color: CLR_WHITE };
}

// symbols.c:init_rogue_symbols() changes ordinary stairs and open doorways.
// Branch stairs retain their default symbols.
const rogueFurnitureSymbols = new Map<number, string>([
    [CmapSymbol.ndoor, '+'], [CmapSymbol.vodoor, '+'], [CmapSymbol.hodoor, '+'],
    [CmapSymbol.upstair, '%'], [CmapSymbol.dnstair, '%'],
]);

// dat/symbols `start:` bodies for the sets a Rogue level can display,
// layered over the base rogue set exactly as load_symset() replaces the
// entries update_rogue_symset() writes. `blank` models the Blank set,
// which replaces every symbol with \032.
interface RogueSymsetSymbols {
    cmap?: ReadonlyMap<number, string>;
    blank?: boolean;
    objectClasses?: Partial<Record<number, string>>;
    boulderSymbol?: string;
    trapSymbol?: string;
    humanSymbol?: string;
    ibm?: boolean;
    // `Color: Yes` clears nocolor; together with IBM handling, that turns
    // the Rogue-level color tables on.
    color?: boolean;
}

const ROGUE_DOUBLE_WALLS: ReadonlyMap<number, string> = new Map([
    [CmapSymbol.vwall, '\u00ba'], [CmapSymbol.hwall, '\u00cd'],
    [CmapSymbol.tlcorn, '\u00c9'], [CmapSymbol.trcorn, '\u00bb'],
    [CmapSymbol.blcorn, '\u00c8'], [CmapSymbol.brcorn, '\u00bc'],
    [CmapSymbol.crwall, '\u00ce'], [CmapSymbol.tuwall, '\u00ca'],
    [CmapSymbol.tdwall, '\u00cb'], [CmapSymbol.tlwall, '\u00b9'], [CmapSymbol.trwall, '\u00cc'],
    [CmapSymbol.ndoor, '\u00ce'], [CmapSymbol.vodoor, '\u00ce'], [CmapSymbol.hodoor, '\u00ce'],
    [CmapSymbol.room, '\u00fa'], [CmapSymbol.corr, '\u00b1'], [CmapSymbol.litcorr, '\u00b2'],
    [CmapSymbol.engrcorr, '\u00b1'],
    [CmapSymbol.upstair, '\u00f0'], [CmapSymbol.dnstair, '\u00f0'],
    [CmapSymbol.brupstair, '\u00f0'], [CmapSymbol.brdnstair, '\u00f0'],
]);

// The three IBMgraphics sets share these S_ entries; their doorway,
// corridor and floor replacements differ in dat/symbols.
const IBM_COMMON_SYMBOLS: ReadonlyMap<number, string> = new Map([
    [CmapSymbol.vwall, '\xb3'], [CmapSymbol.hwall, '\xc4'],
    [CmapSymbol.tlcorn, '\xda'], [CmapSymbol.trcorn, '\xbf'],
    [CmapSymbol.blcorn, '\xc0'], [CmapSymbol.brcorn, '\xd9'],
    [CmapSymbol.crwall, '\xc5'], [CmapSymbol.tuwall, '\xc1'],
    [CmapSymbol.tdwall, '\xc2'], [CmapSymbol.tlwall, '\xb4'], [CmapSymbol.trwall, '\xc3'],
    [CmapSymbol.engroom, '\xee'],
    [CmapSymbol.vbeam, '\xb3'], [CmapSymbol.hbeam, '\xc4'],
    [CmapSymbol.swallowTopLeft + 3, '\xb3'], [CmapSymbol.swallowTopLeft + 4, '\xb3'],
    [CmapSymbol.explosionTopLeft + 3, '\xb3'], [CmapSymbol.explosionTopLeft + 5, '\xb3'],
]);

export const ROGUE_SYMSETS: Readonly<Record<string, RogueSymsetSymbols>> = {
    plain: { cmap: new Map([
        [CmapSymbol.tlcorn, '+'], [CmapSymbol.trcorn, '+'],
        [CmapSymbol.blcorn, '+'], [CmapSymbol.brcorn, '+'],
        [CmapSymbol.crwall, '+'], [CmapSymbol.tuwall, '+'],
        [CmapSymbol.tdwall, '+'], [CmapSymbol.tlwall, '+'], [CmapSymbol.trwall, '+'],
    ]) },
    blank: { blank: true },
    ibmgraphics: {
        ibm: true,
        cmap: new Map([...IBM_COMMON_SYMBOLS,
            [CmapSymbol.ndoor, '\xfa'], [CmapSymbol.vodoor, '\xfe'], [CmapSymbol.hodoor, '\xfe'],
            [CmapSymbol.bars, '\xf0'], [CmapSymbol.tree, '\xf1'], [CmapSymbol.room, '\xfa'],
            [CmapSymbol.corr, '\xb0'], [CmapSymbol.litcorr, '\xb1'], [CmapSymbol.engrcorr, '\xb0'],
            [CmapSymbol.fountain, '\xf4'], [CmapSymbol.sink, '\xf4'],
            [CmapSymbol.pool, '\xf7'], [CmapSymbol.ice, '\xfa'],
            [CmapSymbol.lava, '\xf7'], [CmapSymbol.lavawall, '\xf7'],
            [CmapSymbol.vodbridge, '\xfa'], [CmapSymbol.hodbridge, '\xfa'], [CmapSymbol.water, '\xf7'],
        ]),
    },
    ibmgraphics_1: { ibm: true, cmap: IBM_COMMON_SYMBOLS },
    ibmgraphics_2: {
        ibm: true,
        cmap: new Map([...IBM_COMMON_SYMBOLS,
            [CmapSymbol.vodoor, '\xfe'], [CmapSymbol.hodoor, '\xfe'],
            [CmapSymbol.corr, '\xb0'], [CmapSymbol.litcorr, '\xb1'], [CmapSymbol.engrcorr, '\xb0'],
        ]),
    },
    amigafont: { cmap: new Map([
        [CmapSymbol.stone, ' '], [CmapSymbol.vwall, '\xc0'], [CmapSymbol.hwall, '\xc1'],
        [CmapSymbol.tlcorn, '\xc2'], [CmapSymbol.trcorn, '\xc3'],
        [CmapSymbol.blcorn, '\xc4'], [CmapSymbol.brcorn, '\xc5'], [CmapSymbol.crwall, '\xc6'],
        [CmapSymbol.tuwall, '\xd8'], [CmapSymbol.tdwall, '\xd6'],
        [CmapSymbol.tlwall, '\xd7'], [CmapSymbol.trwall, '\xd5'],
        [CmapSymbol.ndoor, '\xd9'], [CmapSymbol.vodoor, '\x91'], [CmapSymbol.hodoor, '\x92'],
        [CmapSymbol.vcdoor, '\x93'], [CmapSymbol.hcdoor, '\x94'],
        [CmapSymbol.bars, '#'], [CmapSymbol.tree, '#'], [CmapSymbol.room, '.'], [CmapSymbol.darkroom, ' '],
        [CmapSymbol.corr, '\xe5'], [CmapSymbol.litcorr, '\xe5'],
        [CmapSymbol.upstair, '<'], [CmapSymbol.dnstair, '>'],
        [CmapSymbol.upladder, '<'], [CmapSymbol.dnladder, '>'], [CmapSymbol.altar, '_'],
        [CmapSymbol.grave, '\\'], [CmapSymbol.throne, '#'], [CmapSymbol.sink, '{'], [CmapSymbol.fountain, '}'],
        [CmapSymbol.pool, '*'], [CmapSymbol.ice, '}'], [CmapSymbol.lava, '*'],
        [CmapSymbol.vodbridge, '*'], [CmapSymbol.hodbridge, '#'],
        [CmapSymbol.vcdbridge, '#'], [CmapSymbol.hcdbridge, '.'], [CmapSymbol.air, '#'], [CmapSymbol.cloud, '}'],
        [CmapSymbol.vbeam, '\xf1'], [CmapSymbol.hbeam, '\xf0'],
        [CmapSymbol.lslant, '\xf2'], [CmapSymbol.rslant, '\xf3'],
        [CmapSymbol.digbeam, '*'], [CmapSymbol.flashbeam, '!'],
        [CmapSymbol.boomleft, '{'], [CmapSymbol.boomright, '}'],
        ...['@', '&', '*', '#'].map((ch, index): [number, string] => [CmapSymbol.shieldFirst + index, ch]),
        ...['\xf4', '\xf5', '\xf6', '\xf7', '\xef', '\xf8', '\xf9', '\xfa']
            .map((ch, index): [number, string] => [CmapSymbol.swallowTopLeft + index, ch]),
        ...['\xe6', '\xea', '\xe7', '\xec', '\xd4', '\xed', '\xe8', '\xeb', '\xe9']
            .map((ch, index): [number, string] => [CmapSymbol.explosionTopLeft + index, ch]),
    ]) },
    rogueibm: {
        ibm: true,
        cmap: ROGUE_DOUBLE_WALLS,
        objectClasses: {
            [WEAPON_CLASS]: ')', [AMULET_CLASS]: ',', [FOOD_CLASS]: ':',
            [POTION_CLASS]: '\u00ad', [SCROLL_CLASS]: '?', [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '\u00e7',
        },
    },
    rogueepyx: {
        ibm: true,
        cmap: new Map([...ROGUE_DOUBLE_WALLS, [CmapSymbol.engroom, '\u00ee']]),
        objectClasses: {
            [WEAPON_CLASS]: '\x18', [ARMOR_CLASS]: '[', [RING_CLASS]: '=',
            [AMULET_CLASS]: '\x0c', [TOOL_CLASS]: '(', [FOOD_CLASS]: '\x05',
            [POTION_CLASS]: '\u00ad', [SCROLL_CLASS]: '\x0e', [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '\u00e7', [COIN_CLASS]: '\x0f', [GEM_CLASS]: '\x0f',
            [ROCK_CLASS]: '`', [BALL_CLASS]: '0', [CHAIN_CLASS]: '_',
            [VENOM_CLASS]: '.',
        },
        trapSymbol: '\x04',
        humanSymbol: '\x01',
        color: true,
    },
    roguewindows: {
        ibm: true,
        cmap: new Map([...ROGUE_DOUBLE_WALLS, [CmapSymbol.engroom, '\u00ee']]),
        objectClasses: {
            [WEAPON_CLASS]: ')', [AMULET_CLASS]: ',', [FOOD_CLASS]: ':',
            [POTION_CLASS]: '\u00ad', [SCROLL_CLASS]: '?', [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '\u00e7',
        },
    },
};

const BLANK_SYMBOL = '\x1a';
const BLANK_OBJECT_SYMBOLS: readonly string[]
    = ROGUE_OBJECT_SYMBOLS.map(() => BLANK_SYMBOL);
const ROGUE_SYMSET_OBJECT_TABLES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
    Object.entries(ROGUE_SYMSETS)
        .filter(([, set]) => set.objectClasses !== undefined)
        .map(([name, set]) => [name, ROGUE_OBJECT_SYMBOLS.map((symbol, index) =>
            set.objectClasses?.[index] ?? symbol)]),
);

// Port only: the named Rogue symbol set (C's loaded rogue showsyms).
function activeRogueSymset(state: GameState = game): RogueSymsetSymbols | null {
    const shown = shownSymbolSet(state);
    if (!shown.rogue || !shown.name) return null;
    return ROGUE_SYMSETS[shown.name.toLowerCase()] ?? null;
}

// Port only: rogue-set cmap symbol override.
function rogueCmapSymbol(set: RogueSymsetSymbols | null, symbol: number): string | undefined {
    if (!set) return undefined;
    if (set.blank) return BLANK_SYMBOL;
    return set.cmap?.get(symbol);
}

// The monster-class tables only change on the Rogue level, where a named
// set can replace the human symbol (RogueEpyx) or every class (Blank).
const HUMAN_CLASS_INDEX = MONSTER_CLASS_SYMBOLS.indexOf('@');

// Port only: monster-class symbol for the shown set.
export function monsterClassSymbol(index: number): string {
    const shown = shownSymbolSet();
    if (shown.rogue) {
        const set = shown.name ? ROGUE_SYMSETS[shown.name.toLowerCase()] : undefined;
        if (set?.blank) return BLANK_SYMBOL;
        if (set?.humanSymbol && index === HUMAN_CLASS_INDEX) return set.humanSymbol;
    }
    return MONSTER_CLASS_SYMBOLS[index] ?? '';
}

// Part of C display.c:swallowed(): the swallow border symbol; is_swallow_sym()
// (pager.c) tests a displayed symbol against these eight.
export function swallowSymbolAppearance(index: number): { ch: string; dec: boolean } {
    if (!Number.isInteger(index) || index < 0 || index > 7)
        throw new RangeError(`Unknown swallow border ${index}`);
    return cmapSymbolAppearance(CmapSymbol.swallowTopLeft + index);
}

// defsym.h effect symbols follow terrain and traps in showsyms[].
const DEFAULT_EFFECT_SYMBOLS: ReadonlyMap<number, string> = new Map([
    [CmapSymbol.vbeam, '|'], [CmapSymbol.hbeam, '-'], [CmapSymbol.lslant, '\\'], [CmapSymbol.rslant, '/'],
    [CmapSymbol.digbeam, '*'], [CmapSymbol.flashbeam, '!'],
    [CmapSymbol.boomleft, ')'], [CmapSymbol.boomright, '('],
    ...['0', '#', '@', '*'].map((ch, index): [number, string] => [CmapSymbol.shieldFirst + index, ch]),
    ...['/', '-', '\\', '|', '|', '\\', '-', '/']
        .map((ch, index): [number, string] => [CmapSymbol.swallowTopLeft + index, ch]),
    ...['/', '-', '\\', '|', ' ', '|', '\\', '-', '/']
        .map((ch, index): [number, string] => [CmapSymbol.explosionTopLeft + index, ch]),
]);

// dat/symbols:DECgraphics overrides dungeon symbols independently of the
// terrain type at the hero's location. Furniture mimicry uses these symbols.
const decFurnitureSymbols = new Map<number, string>([
    [CmapSymbol.vwall, 'x'], [CmapSymbol.hwall, 'q'],
    [CmapSymbol.tlcorn, 'l'], [CmapSymbol.trcorn, 'k'],
    [CmapSymbol.blcorn, 'm'], [CmapSymbol.brcorn, 'j'],
    [CmapSymbol.crwall, 'n'], [CmapSymbol.tuwall, 'v'],
    [CmapSymbol.tdwall, 'w'], [CmapSymbol.tlwall, 'u'], [CmapSymbol.trwall, 't'],
    [CmapSymbol.ndoor, '~'], [CmapSymbol.vodoor, 'a'], [CmapSymbol.hodoor, 'a'],
    [CmapSymbol.bars, '|'], [CmapSymbol.tree, 'g'], [CmapSymbol.room, '~'],
    [CmapSymbol.upladder, 'y'], [CmapSymbol.dnladder, 'z'],
    [CmapSymbol.brupladder, 'y'], [CmapSymbol.brdnladder, 'z'],
    [CmapSymbol.altar, '{'], [CmapSymbol.pool, '`'], [CmapSymbol.ice, '~'],
    [CmapSymbol.lava, '`'], [CmapSymbol.lavawall, '`'],
    [CmapSymbol.vodbridge, '~'], [CmapSymbol.hodbridge, '~'], [CmapSymbol.water, '`'],
    [CmapSymbol.vbeam, 'x'], [CmapSymbol.hbeam, 'q'],
    [CmapSymbol.swallowTopLeft + 1, 'o'], [CmapSymbol.swallowTopLeft + 3, 'x'],
    [CmapSymbol.swallowTopLeft + 4, 'x'], [CmapSymbol.swallowTopLeft + 6, 's'],
    [CmapSymbol.explosionTopLeft + 1, 'o'], [CmapSymbol.explosionTopLeft + 3, 'x'],
    [CmapSymbol.explosionTopLeft + 5, 'x'], [CmapSymbol.explosionTopLeft + 7, 's'],
]);

// Part of C symbols.c:assign_graphics(): selects the active dungeon symbols. DEC
// characters retain their alternate font so they do not match ASCII letters.
export function cmapSymbolAppearance(symbol: number): { ch: string; dec: boolean } {
    const defaultSymbol = MAP_SYMBOLS[symbol]?.ch ?? DEFAULT_EFFECT_SYMBOLS.get(symbol);
    if (defaultSymbol === undefined) throw new RangeError(`Unknown dungeon symbol ${symbol}`);
    if (shownSymbolSet().rogue) {
        const set = activeRogueSymset();
        const ch = rogueCmapSymbol(set, symbol) ?? rogueFurnitureSymbols.get(symbol) ?? defaultSymbol;
        // wintty.c:g_putch() uses the alternate font for high-bit bytes
        // without IBM handling, unless eight_bit_tty requests raw bytes.
        if (!set?.ibm && !game.iflags.wc_eight_bit_input && ch.charCodeAt(0) >= 128)
            return { ch: String.fromCharCode(ch.charCodeAt(0) & 0x7f), dec: true };
        return { ch, dec: false };
    }
    const decSymbol = usesDecSymbols()
        ? decFurnitureSymbols.get(symbol) : undefined;
    return { ch: decSymbol ?? defaultSymbol, dec: decSymbol !== undefined };
}

// display.c:reset_glyphmap() and map_glyphinfo() retain the glyph's color.
// dat/symbols assigns these colors to branch wall glyphs.
const decWallColors = new Map<GlyphOffset, number>([
    [GlyphOffset.cmapMines, CLR_BROWN], [GlyphOffset.cmapGehennom, CLR_RED],
    [GlyphOffset.cmapKnox, CLR_YELLOW], [GlyphOffset.cmapSokoban, CLR_BLUE],
]);

// symbols.c:load_symset() applies these sets' G_ wall colors independently
// of character handling; every other set leaves branch walls gray
// (clear_symsetentry() → clear_all_glyphmap_colors()).
const BRANCH_WALL_COLOR_SYMSETS = /^(?:DECgraphics|curses|IBMgraphics(?:_[12])?)$/i;

// Part of C wizcmds.c:wizcustom_callback(), wintty.c:g_putch(): the shown
// symbol's byte.
export function cmapSymbolByte(symbol: number): number {
    const shown = shownSymbolSet();
    const name = shown.name?.toLowerCase();
    if (!shown.rogue && (name === 'decgraphics' || name === 'curses')) {
        const ch = decFurnitureSymbols.get(symbol);
        if (ch !== undefined) return ch.charCodeAt(0) | 0x80;
    }
    // Named S_ overrides are identical in the primary and Rogue sets.
    const set = name ? ROGUE_SYMSETS[name] : undefined;
    const trap = symbol >= CmapSymbol.arrowTrap && symbol < CmapSymbol.vbeam;
    const vibrating = symbol === CmapSymbol.arrowTrap + VIBRATING_SQUARE - 1;
    const trapSymbol = vibrating ? '~' : symbol === CmapSymbol.web ? '"' : '^';
    const ch = rogueCmapSymbol(set ?? null, symbol)
        ?? (shown.rogue && trap && !vibrating ? set?.trapSymbol : undefined)
        ?? (shown.rogue ? rogueFurnitureSymbols.get(symbol) : undefined)
        ?? MAP_SYMBOLS[symbol]?.ch ?? DEFAULT_EFFECT_SYMBOLS.get(symbol) ?? (trap ? trapSymbol : undefined);
    if (ch === undefined) throw new RangeError(`Unknown dungeon symbol ${symbol}`);
    return ch.charCodeAt(0);
}

// Part of C display.c:display_monster(): the furniture-disguise glyph.
function furnitureDisplayGlyph(appearance: number): DisplayGlyph {
    const symbol = MAP_SYMBOLS[appearance];
    if (!symbol) throw new RangeError(`Unknown furniture disguise ${appearance}`);
    const display = cmapSymbolAppearance(appearance);
    const wallOffset = currentWallGlyphOffset();
    const wall = appearance >= CmapSymbol.vwall && appearance <= CmapSymbol.trwall;
    const color = display.dec && wall
        ? decWallColors.get(wallOffset) ?? symbol.color : symbol.color;
    return { ch: display.ch, color, decgfx: display.dec,
        kind: 'terrain', terrainName: symbol.name, glyph: cmapToGlyph(appearance, wallOffset) };
}

// C display.h:canspotself().  Its Invisible (youprop.h) is Invis without
// See_invisible, so seeing invisible lets the hero see their own glyph;
// telepathy/detection can otherwise supply a sensory projection.
export function canSpotHeroSelf() {
    const invisible = !!(
        game.u?.invisible || game.u?.invis || game.invisible
    ) && !propertyIsActive('seeInvisible', game);
    const canSeeSelf = !!(
        game.blind || game.u?.uswallow
        || (!invisible && !game.u?.uundetected)
    );
    const sensesSelf = hasWornProperty('telepathy') || hasCarriedProperty('telepathy')
        || heroDetectsMonsters();
    return canSeeSelf || sensesSelf;
}

// Part of C display.h:random_obj_to_glyph(): the hallucinated object
// glyph.  Generic object slots 0..17 are excluded; a randomly selected
// corpse consumes a second display draw for its color.
function randomHallucinatedObjectGlyph(): ObjectGlyph {
    const firstObject = OBJECT_BASES[WEAPON_CLASS];
    if (firstObject === undefined) throw new Error('Missing first real object class in object data');
    const otyp = rn2Display(OBJECT_COLOR.length - firstObject) + firstObject;
    if (otyp === CORPSE) {
        const mnum = rn2Display(MONSTER_COLOR.length);
        return {
            ch: activeObjectSymbols()[7] || '?',
            color: MONSTER_COLOR[mnum] ?? CLR_GRAY,
            decgfx: false, kind: 'object', otyp, corpsenm: mnum, piletop: false,
            glyph: GlyphOffset.body + mnum,
        };
    }
    const oclass = objectClassForType(otyp);
    return {
        // display.c routes any boulder object number, including one a
        // hallucinating hero invents, through showsyms[SYM_BOULDER].
        ch: otyp === BOULDER ? currentBoulderSymbol()
            : activeObjectSymbols()[oclass] || '?',
        // glyphs.c resolves the randomly selected object number through the
        // runtime objects[] table.  o_init() shuffles oc_color together with
        // unidentified descriptions, so Hallucination must not use the
        // generated compile-time color table here.
        color: objectTypeColor(otyp) ?? CLR_GRAY,
        decgfx: false, kind: 'object', otyp, piletop: false,
        glyph: objnumToGlyph(otyp),
    };
}

// C display.h:obj_to_glyph().
function objectGlyph(object: ObjectGlyphSource): ObjectGlyph {
    const piletop = objectIsPiletop(object);
    if (heroIsHallucinating()) {
        // display.h:statue_to_glyph() uses a monster plus random gender;
        // map_object() separately stores a random-object memory glyph below.
        if (object.otyp === STATUE) {
            const mnum = rn2Display(MONSTER_COLOR.length);
            return displayMonsterGlyph(mnum, !!rn2Display(2));
        }
        return randomHallucinatedObjectGlyph();
    }
    const statueSymbol = object.otyp === STATUE && object.corpsenm !== undefined
        ? monsterClassSymbol(MONSTER_SYMBOL[object.corpsenm] ?? 0)
        : null;
    const species = (object.otyp === CORPSE || object.otyp === STATUE)
        && object.corpsenm !== undefined ? { corpsenm: object.corpsenm } : {};
    const glyph = objectGlyphNumber(object, piletop);
    // reset_glyphmap() resolves both normal and generic object numbers
    // through objects[].oc_class, including a mimic's zero-class disguise.
    // glyph_to_obj() later reads that generic slot back, not the hidden type.
    const displayedType = objectUsesGenericGlyph(object) ? object.oclass : object.otyp;
    return statueSymbol
        ? {
            ch: statueSymbol, color: CLR_WHITE, decgfx: false,
            kind: 'object', otyp: object.otyp, ...species, glyph,
            statueGlyph: true, piletop,
        }
        : {
            // display.c sends the boulder object to showsyms[SYM_BOULDER],
            // whose override each symbol set carries separately.
            ch: object.otyp === BOULDER ? currentBoulderSymbol()
                : activeObjectSymbols()[objectClassForType(displayedType)] || '?',
            color: objectColor(object), decgfx: false,
            kind: 'object', otyp: displayedType, ...species, glyph,
            statueGlyph: object.otyp === STATUE, piletop,
        };
}

// Part of C display.h:statue_to_glyph(), display.h:corpse_to_glyph(),
// display.h:generic_obj_to_glyph(): the piletop-adjusted glyph number.
// An unobserved potion uses its class number in the same object range.
function objectGlyphNumber(object: ObjectGlyphSource, piletop: boolean) {
    if (object.otyp === STATUE) {
        const female = ((object.spe ?? 0) & CORPSTAT_GENDER) === CORPSTAT_FEMALE;
        const offset = female
            ? (piletop ? GlyphOffset.statueFemalePiletop : GlyphOffset.statueFemale)
            : (piletop ? GlyphOffset.statueMalePiletop : GlyphOffset.statueMale);
        return offset + (object.corpsenm ?? 0);
    }
    if (object.otyp === CORPSE)
        return (piletop ? GlyphOffset.bodyPiletop : GlyphOffset.body) + (object.corpsenm ?? 0);
    return (piletop ? GlyphOffset.objectPiletop : GlyphOffset.object)
        + (objectUsesGenericGlyph(object) ? object.oclass : object.otyp);
}

// C display.h:mon_to_glyph(). Ignore disguises for a revelation flash.
export function transientMonsterGlyph(
    monster: Pick<Monster, 'mnum'> & Partial<Pick<Monster, 'female'>>,
    monsterState: 'normal' | 'pet' | 'detected' = 'normal',
) {
    return displayMonsterGlyph(heroIsHallucinating()
        ? rn2Display(MONSTER_COLOR.length) : monster.mnum, !!monster.female, monsterState);
}

// C display.c:zapdir_to_glyph(): the direction collapses to one of the four
// beam symbols and the beam type keeps its own glyph even for equal colors.
// display.c:2463-2466 reports impossible("zapdir_to_glyph:  illegal beam
// type") before resetting an out-of-range beam type to 0; this sync encoder
// clamps without the report, which no caller reaches (display.c:1132 and
// spell.c:997/1017 pass sgn() deltas and zap-colors enum values).
export function zapdirToGlyph(dx: number, dy: number, beamType: number): number {
    const type = beamType >= 8 ? 0 : beamType;
    const direction = dx === dy ? 2 : dx && dy ? 3 : dx ? 1 : 0;
    return ((type << 2) | direction) + GlyphOffset.zap;
}

// Part of C display.c:zapdir_to_glyph(): appearance adapter around the glyph-number port zapdirToGlyph().
// zapdir_to_glyph()'s glyph with the appearance reset_glyphmap() and
// map_glyphinfo() give it: the beam color table and the terminal symbol
// whose index is the glyph's low two bits (display.c packs type << 2 | dir).
export function zapdir_to_glyph(dx: number, dy: number, beamType: number): DisplayGlyph {
    const glyph = zapdirToGlyph(dx, dy, beamType);
    const type = beamType >= 8 ? 0 : beamType;
    const color = [CLR_BRIGHT_BLUE, CLR_ORANGE, CLR_WHITE, CLR_BRIGHT_BLUE,
        CLR_BLACK, CLR_WHITE, CLR_GREEN, CLR_YELLOW][type];
    if (color === undefined) throw new RangeError(`Unknown beam type ${beamType}`);
    const appearance = cmapSymbolAppearance(CmapSymbol.vbeam + (glyph - GlyphOffset.zap & 3));
    return { ch: appearance.ch, color, decgfx: appearance.dec,
        kind: 'effect', glyph };
}

// Part of C display.h:explosion_to_glyph(): the explosion glyph by style
// and cell.  Rows run from top left to bottom right, and every style but
// the six named ones, including dark, defaults to fiery.
export function explosionGlyph(style: number, dx: number, dy: number): DisplayGlyph {
    const type = [EXPL_FROSTY, EXPL_MAGICAL, EXPL_WET, EXPL_MUDDY, EXPL_NOXIOUS]
        .includes(style) ? style : EXPL_FIERY;
    const index = (dy + 1) * 3 + dx + 1;
    const color = [CLR_GREEN, CLR_BROWN, CLR_BLUE,
        CLR_MAGENTA, CLR_ORANGE, CLR_WHITE][type - EXPL_NOXIOUS];
    if (index < 0 || index > 8 || color === undefined)
        throw new RangeError(`Unknown explosion glyph ${style} at offset ${dx},${dy}`);
    const appearance = cmapSymbolAppearance(CmapSymbol.explosionTopLeft + index);
    return { ch: appearance.ch, color, decgfx: appearance.dec,
        kind: 'effect', glyph: explosionToGlyph(style, CmapSymbol.explosionTopLeft + index) };
}

// Part of C display.c:shieldeff(): the shield-effect glyph.
export function shieldGlyph(character: string): DisplayGlyph {
    const index = ['0', '#', '@', '*'].indexOf(character);
    if (index < 0) throw new RangeError(`Unknown shield symbol ${character}`);
    const appearance = cmapSymbolAppearance(CmapSymbol.shieldFirst + index);
    return { ch: appearance.ch, color: CLR_BRIGHT_BLUE, decgfx: appearance.dec, kind: 'effect',
        glyph: cmapToGlyph(82 + index) };
}

// Part of C display.h:obj_to_glyph(): the tmp_at() callers' adapter (display.ts
// objectGlyph() is the macro port).  A projectile has already
// been extracted from the floor chain, so this deliberately derives only its
// transient glyph and does not mutate hero memory or object discovery state.
// Hallucination consumes the display RNG once when the flight starts; callers
// reuse the returned glyph for every animation cell.
export function transientObjectGlyph(object: ObjectGlyphSource): DisplayGlyph {
    const glyph = objectGlyph(object);
    return {
        ...glyph,
        // tty has no hilite for ordinary gray; black is dark gray (use_darkgray).
        color: glyph.color === CLR_GRAY ? NO_COLOR : glyph.color,
        decgfx: glyph.decgfx ?? false,
        attr: objectGlyphAttr(glyph),
    };
}

// Port only: obj_to_glyph() metadata for inventory menus.
// C inventory menus attach obj_to_glyph() metadata to every real item even
// though tty's text presentation does not show a separate glyph column.  The
// metadata construction remains display-RNG-visible under Hallucination.
export function consumeHallucinatedMenuObjectGlyph(object: ObjectGlyphSource | null | undefined) {
    if (!heroIsHallucinating() || !object) return null;
    return objectGlyph(object);
}

// Port only: mappearance accessor for a disguised creature.
export function mimicAppearance(monster: MimicAppearance): number {
    if (monster.mappearance === undefined)
        throw new Error('A disguised creature has no appearance');
    return monster.mappearance;
}

// Part of C display.c:display_monster(), display.c:display_self(): the
// object-disguise glyph.
function apparentObjectGlyph(monster: MimicAppearance) {
    const otyp = mimicAppearance(monster);
    const oclass = objectClassForType(otyp);
    // display_self() uses objnum_to_glyph(), including generic corpses and
    // statues. The hero's disguise never uses hallucinated object selection.
    return {
        ch: activeObjectSymbols()[oclass] || '?',
        color: objectColor({ otyp, oclass, dknown: true }),
        decgfx: false, kind: 'object', otyp, glyph: objnumToGlyph(otyp),
    } satisfies DisplayGlyph;
}

// C display.c:map_background()
// Like map_object() and map_trap(), this
// updates hero memory independently from ordinary line-of-sight newsym().
export async function map_background(x: number, y: number, show = true) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    const glyph = back_to_glyph(loc, x, y);
    if (game.level?.flags?.hero_memory)
        loc.remembered_glyph = {
            ...glyph, decgfx: glyph.dec,
        };
    if (show) await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec, 0, glyph);
}

// Port only: bounds-checked levl[] access for display.
function requireDisplayLocation(x: number, y: number): MapLocation {
    const location = requireGameLevel().at(x, y);
    if (!location) throw new RangeError(`Display coordinate (${x}, ${y}) is outside the map`);
    return location;
}

// C display.c:magic_map_background(). Unlike ordinary mapping, this keeps
// remembered objects and invisible markers and corrects never-seen lighting.
export async function magic_map_background(x: number, y: number, show = true) {
    const location = requireDisplayLocation(x, y);
    let glyph: GlyphAppearance & { dec: boolean } & GlyphMetadata = back_to_glyph(location, x, y);
    if (!cansee(x, y) && !location.waslit) {
        if (location.typ === ROOM) {
            if ((game.flags.dark_room ?? true) && game.flags.color !== false) {
                glyph = Is_rogue_level(game.u.uz)
                    ? { ch: ' ', color: NO_COLOR, dec: false,
                        kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone }
                    : { ...glyph, color: CLR_BLACK, glyph: cmapToGlyph(CmapSymbol.darkroom),
                        terrainName: 'dark part of a room' };
            } else {
                glyph = { ch: ' ', color: NO_COLOR, dec: false, kind: 'nothing', glyph: GlyphOffset.nothing };
            }
        } else if (location.typ === CORR) {
            glyph = { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr) };
        }
    }
    const remembered = location.remembered_glyph;
    // C's cmap glyph range includes traps and engraved floor glyphs.
    if (requireGameLevel().flags.hero_memory && (!remembered
        || ['unexplored', 'terrain', 'trap', 'engraving'].includes(remembered.kind))) {
        location.remembered_glyph = { ...glyph, decgfx: glyph.dec };
    }
    if (show) await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec, 0, glyph);
    updateLastSeenTerrain(x, y);
}

// C display.c:map_object().
export async function map_object(object: FloorObjectGlyphSource | null | undefined, show = true, observe = true) {
    if (!object) return;
    if (observe && cansee(object.ox, object.oy))
        observeNearbyObject(object, object.ox, object.oy);
    const glyph = objectGlyph(object);
    const loc = game.level?.at(object.ox, object.oy);
    if (loc && game.level?.flags?.hero_memory) {
        // While hallucinating, a statue is displayed as a random monster but
        // remembered as a separately randomized object (display.c:map_object).
        loc.remembered_glyph = heroIsHallucinating()
            && object.otyp === STATUE
            ? randomHallucinatedObjectGlyph() : glyph;
    }
    if (show)
        await show_glyph_cell(object.ox, object.oy, glyph.ch, glyph.color, false,
            objectGlyphAttr(glyph), glyph);
}

const TRAP_COLOR = [
    NO_COLOR, CLR_CYAN, CLR_CYAN, CLR_GRAY, CLR_BROWN, CLR_CYAN,
    CLR_RED, CLR_GRAY, CLR_BRIGHT_BLUE, CLR_BLUE, CLR_ORANGE,
    0, 0, CLR_BROWN, CLR_BROWN, CLR_MAGENTA, CLR_MAGENTA,
    CLR_BRIGHT_MAGENTA, CLR_GRAY, CLR_GRAY, CLR_BRIGHT_BLUE,
    CLR_BRIGHT_BLUE, CLR_BRIGHT_GREEN, CLR_MAGENTA, CLR_ORANGE, CLR_ORANGE,
];

// C display.h:trap_to_glyph().
export function transientTrapGlyph(trap: Pick<Trap, 'ttyp'>): DisplayGlyph {
    // Blank replaces every trap symbol including the vibrating square,
    // while RogueEpyx replaces only the twenty-two real traps.
    const set = activeRogueSymset();
    const ch = set?.blank ? BLANK_SYMBOL
        : trap.ttyp === VIBRATING_SQUARE ? '~'
            : set?.trapSymbol
                ?? (trap.ttyp === WEB ? '"' : '^');
    return {
        ch,
        color: TRAP_COLOR[trap.ttyp] ?? NO_COLOR, decgfx: false,
        kind: 'trap', trapType: trap.ttyp,
        glyph: cmapToGlyph(CmapSymbol.arrowTrap + trap.ttyp - 1),
    };
}

// C display.c:flash_glyph_at(). Finish with the remembered background,
// without newsym() or input: the caller owns the subsequent revelation.
export async function flashGlyphAt(x: number, y: number, glyph: TransientGlyph, repeats: number) {
    const location = requireDisplayLocation(x, y);
    const previous: DisplayGlyph = requireGameLevel().flags.hero_memory
        ? location.remembered_glyph || { ch: ' ', color: NO_COLOR, decgfx: false,
            kind: 'nothing', glyph: GlyphOffset.nothing }
        : back_to_glyph(location, x, y);
    for (let frame = 0; frame < repeats * 2; frame++) {
        const shown = frame % 2 ? previous : glyph;
        await show_glyph_cell(x, y, shown.ch, shown.color,
            shown.decgfx ?? shown.dec, 0, shown);
        await flush_screen(1);
        await game.animationFrame?.();
    }
}

export type TrapGlyphSource = Pick<Trap, 'tx' | 'ty' | 'ttyp'> & Partial<Pick<Trap, 'tseen'>>;

// C display.c:map_trap().
export async function map_trap(trap: TrapGlyphSource | null | undefined, show = true) {
    if (!trap) return;
    const glyph = transientTrapGlyph(trap);
    const loc = game.level?.at(trap.tx, trap.ty);
    if (loc && game.level?.flags?.hero_memory)
        loc.remembered_glyph = glyph;
    if (show) await show_glyph_cell(trap.tx, trap.ty, glyph.ch, glyph.color, false, 0, glyph);
}

// C display.c:map_engraving().
export async function map_engraving(engraving: Engraving | null | undefined, show = true) {
    if (!engraving) return;
    const loc = game.level?.at(engraving.x, engraving.y);
    if (!loc) return;
    const ch = loc.typ === CORR ? '#' : '`';
    const glyph: DisplayGlyph = {
        ch, color: CLR_BRIGHT_BLUE, decgfx: false, kind: 'engraving',
        glyph: cmapToGlyph(loc.typ === CORR ? CmapSymbol.engrcorr : CmapSymbol.engroom),
    };
    if (game.level?.flags?.hero_memory) loc.remembered_glyph = glyph;
    if (show)
        await show_glyph_cell(engraving.x, engraving.y, ch, CLR_BRIGHT_BLUE, false, 0, glyph);
}


// C display.c:_map_location(). This direct mapper intentionally bypasses
// line of sight, but object observation and cloud visibility keep their gates.
export async function map_location(x: number, y: number, show = true) {
    const covered = terrainCoversObjectsAt(x, y);
    const level = requireGameLevel();
    const object = level.objects?.[x]?.[y]?.[0];
    const trap = level.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    const engraving = engravingAt(x, y);
    const typ = requireDisplayLocation(x, y).typ;
    if (object && !covered) {
        await map_object(object, show);
    } else if (trap?.tseen && !covered) {
        await map_trap(trap, show);
    } else if (engraving?.erevealed && !covered
        && (typ === ROOM || typ === CORR || typ === ICE)) {
        await map_engraving(engraving, show);
    } else {
        await map_background(x, y, show);
    }
    updateLastSeenTerrain(x, y);
    if (show && !heroIsBlind() && visibleMapRegionAt(x, y)) await showMapRegion(x, y);
}

// C display.c:feel_newsym(). Known terrain changes update memory by touch
// when the hero is blind.
export async function feel_newsym(x: number, y: number) {
    if (heroIsBlind()) await feel_location(x, y);
    else await newsym(x, y);
}

// C display.c:suppress_map_output().
// Native suppress_map_output(): initialization and persistence can leave
// terrain, hero properties, and ownership links temporarily incomplete.
function suppressMapOutput(): boolean {
    return !!(game.in_mklev || game.program_state.saving || game.program_state.restoring);
}

// C display.c:feel_location().  Blind explicit search refreshes each adjacent
// nonliving layer before it tests for a concealed monster or trap.  This is
// why a felt floor object can remain in hero memory after a later invisible
// actor marker is installed elsewhere during the same search.
export async function feel_location(x: number, y: number) {
    if (suppressMapOutput()) return;
    const loc = game.level?.at(x, y);
    if (!loc) return;
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (loc.remembered_glyph?.kind === 'invisible' && monster) return;
    if (restrictedUnderwaterView() && !underwaterTerrain(x, y)) return;
    set_seenv(loc, game.u.ux, game.u.uy, x, y);

    if (heroCanReachFloor(game)) {
        const engraving = engravingAt(x, y);
        if (engraving && [ENGRAVE, BURN, HEADSTONE].includes(engraving.engr_type))
            engraving.erevealed = true;
        await map_location(x, y, true);
        const ball = game.uball || game.u?.uball;
        const chain = game.uchain || game.u?.uchain;
        if (ball) {
            const top = game.level?.objects[x]?.[y]?.[0];
            if (chain?.where === 'floor' && chain.ox === x && chain.oy === y
                && top === chain) game.u.bc_felt = (game.u.bc_felt ?? 0) | BC_CHAIN;
            else game.u.bc_felt = (game.u.bc_felt ?? 0) & ~BC_CHAIN;
            if (ball.where === 'floor' && ball.ox === x && ball.oy === y
                && top === ball) game.u.bc_felt = (game.u.bc_felt ?? 0) | BC_BALL;
            else game.u.bc_felt = (game.u.bc_felt ?? 0) & ~BC_BALL;
        }
        await darkenFeltFloor(x, y, loc);
    } else {
        const boulder = game.level?.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
        const closedDoor = loc.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED));
        if (IS_OBSTRUCTED(loc.typ) || closedDoor) await map_background(x, y, true);
        else if (boulder) await map_object(boulder, true);
        else if (loc.typ === DOOR) await map_background(x, y, true);
        else if (IS_ROOM(loc.typ) || IS_POOL(loc.typ)) {
            const glyph = loc.remembered_glyph;
            // Native touch clears the ordinary boulder glyph, retaining pile memory.
            const forgottenBoulder = glyph?.glyph === objnumToGlyph(BOULDER)
                || glyph?.kind === 'invisible';
            if (forgottenBoulder && loc.typ !== ROOM) await map_background(x, y, true);
            else if (forgottenBoulder || glyph?.kind === 'terrain'
                && glyph.glyph !== undefined && glyph.glyph >= cmapToGlyph(CmapSymbol.stone)
                && glyph.glyph < cmapToGlyph(CmapSymbol.darkroom)) {
                const dark = (game.flags.dark_room ?? true) && game.flags.color !== false
                    && !Is_rogue_level(game.u.uz);
                await rememberFeltRoom(x, y, loc, dark ? CmapSymbol.darkroom
                    : loc.waslit ? CmapSymbol.room : CmapSymbol.stone);
            }
        } else {
            await map_background(x, y, true);
            await darkenFeltFloor(x, y, loc);
        }
    }
    if (monster && (x !== game.u.ux || y !== game.u.uy) && canSenseMonster(monster)) {
        const located = senseWithTelepathy(monster) || heroWarnsOfMonster(monster);
        await displayMonsterAtCell(monster, x, y, {
            wormTail: isWormTail(monster, x, y),
            showAppearance: located, detected: !located,
        });
    }
}

// Part of C display.c:feel_location(): the remembered felt room.
async function rememberFeltRoom(
    x: number, y: number, location: MapLocation,
    symbol: typeof CmapSymbol.stone | typeof CmapSymbol.room | typeof CmapSymbol.darkroom,
): Promise<void> {
    const dark = symbol === CmapSymbol.darkroom;
    // reglyph_darkroom() uses the floor symbol only with dark_room and color.
    const floor = symbol === CmapSymbol.room
        || dark && (game.flags.dark_room ?? true) && game.flags.color !== false;
    const dec = usesDecSymbols();
    const glyph: DisplayGlyph = {
        ch: floor ? dec ? '~' : '.' : ' ',
        color: dark ? 16 : NO_COLOR,
        decgfx: floor && dec,
        kind: 'terrain', terrainName: dark ? 'dark part of a room'
            : floor ? 'floor of a room' : 'stone',
        glyph: cmapToGlyph(symbol),
    };
    location.remembered_glyph = glyph;
    await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
}

// Part of C display.c:feel_location(): the felt dark-room/corridor
// downgrade.
async function darkenFeltFloor(x: number, y: number, location: MapLocation): Promise<void> {
    const glyph = location.remembered_glyph;
    if (location.typ === ROOM && glyph?.glyph === cmapToGlyph(CmapSymbol.room)
        && (!location.waslit || (game.flags.dark_room ?? true) && game.flags.color !== false)) {
        // Grounded touch chooses darkroom even on Rogue levels or without color.
        await rememberFeltRoom(x, y, location,
            (game.flags.dark_room ?? true) ? CmapSymbol.darkroom : CmapSymbol.stone);
    } else if (location.typ === CORR && glyph?.glyph === cmapToGlyph(CmapSymbol.litcorr)
        && !location.waslit) {
        const corridor: DisplayGlyph = glyph.kind === 'terrain'
            ? { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr),
                terrainName: 'corridor' }
            : { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr) };
        location.remembered_glyph = corridor;
        await show_glyph_cell(x, y, corridor.ch, corridor.color, corridor.decgfx, 0, corridor);
    }
}

// C display.c:glyph_at().
// ── show_glyph_cell ──
export function glyphAt(x: number, y: number, state: GameState = game) {
    if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) {
        const appearance = cmapSymbolAppearance(CmapSymbol.room);
        return { ch: appearance.ch, color: NO_COLOR, decgfx: appearance.dec,
            kind: 'terrain', terrainName: 'floor of a room',
            glyph: cmapToGlyph(CmapSymbol.room) } satisfies DisplayGlyph;
    }
    const loc = state.level?.at(x, y);
    if (!loc) return null;
    // Native glyph_at() reads the third screen, even when a memory-only map
    // operation has recorded something which has never been displayed.
    return loc.disp_glyph || { ch: ' ', color: NO_COLOR, decgfx: false,
        kind: 'unexplored', glyph: GlyphOffset.unexplored } satisfies DisplayGlyph;
}
// Part of C display.c:map_glyphinfo(): re-applies the showrace highlight to the hero's
// own glyph after reset_glyphmap() cleared the Rogue level's colors.  The
// hero glyph is the race monster whenever showrace is set (display.h
// hero_glyph).
function isRogueShowraceHeroGlyph(glyph: GlyphMetadata | null, x: number, y: number): boolean {
    if (!game.flags.showrace || Upolyd(game.u) || game.urace === null) return false;
    if (glyph?.kind !== 'monster' || x !== game.u.ux || y !== game.u.uy) return false;
    const heroGlyphNumber = monnumToGlyph(game.urace.mnum,
        game.flags.female ? FEMALE : MALE);
    return glyph.glyph === heroGlyphNumber;
}

// Part of C display.c:reset_glyphmap(): the RogueEpyx color gate.
// HAS_ROGUE_IBM_GRAPHICS with nocolor cleared (only RogueEpyx declares
// `Color: Yes`) keeps color on the Rogue level through cmap_to_roguecolor()
// and the object/monster branches of reset_glyphmap().
export function rogueColorsActive(): boolean {
    const set = activeRogueSymset();
    return Is_rogue_level(game.u?.uz) && game.flags.color !== false
        && set?.ibm === true && set.color === true;
}

// Part of C display.c:reset_glyphmap(), display.c:cmap_to_roguecolor():
// the Rogue color tables.  Null keeps the glyph's own color where the
// native branches have no rogue override (explosions, the branch wall
// ranges).
function rogueLevelGlyphColor(glyph: GlyphMetadata, x: number, y: number): number | null {
    const glyphNumber = glyph.glyph;
    if (glyph.kind === 'object' && typeof glyphNumber === 'number') {
        // Every statue glyph turns red under rogue color, like the four
        // statue ranges of reset_glyphmap().
        if (glyph.statueGlyph) return CLR_RED;
        // reset_glyphmap(): coins yellow, food (including corpses) red,
        // every other class bright blue.
        const oclass = objectClassForType(glyph.otyp);
        // objclass.h indices: coins 12, food 7.
        return oclass === COIN_CLASS ? CLR_YELLOW
            : oclass === FOOD_CLASS ? CLR_RED : CLR_BRIGHT_BLUE;
    }
    if (glyph.kind === 'monster' && typeof glyphNumber === 'number') {
        // map_glyphinfo() yellows the hero's own glyph whatever its sex,
        // while a steed's glyph (not hero_glyph) keeps the ridden branch.
        if (x === game.u?.ux && y === game.u?.uy && !Upolyd(game.u)) {
            const heroNumber = monnumToGlyph(
                (game.flags.showrace ? game.urace?.mnum : game.u.umonnum) ?? 0,
                game.flags.female ? FEMALE : MALE);
            if (glyphNumber === heroNumber) return CLR_YELLOW;
        }
        // Ordinary male monsters are yellow; pets, detected, ridden and
        // female monsters keep no color.
        return glyphIsNormalMaleMonster(glyphNumber)
            ? CLR_YELLOW : NO_COLOR;
    }
    if (typeof glyphNumber !== 'number') return NO_COLOR;
    // reset_glyphmap() leaves explosions to explode_color() and the branch
    // wall ranges to wall_color() even with rogue color on.
    if (glyphIsExplosion(glyphNumber)) return null;
    if (glyphIsCmapSokoban(glyphNumber)) return null;
    // The main wall range colors through cmap_to_roguecolor(); the branch
    // ranges above keep their wall color, and no Rogue level sits in one.
    if (glyphNumber === GlyphOffset.cmapStone) return NO_COLOR;
    if (glyphIsCmapMain(glyphNumber))
        return cmapToRogueColor(glyphNumber - GlyphOffset.cmapMain + CmapSymbol.vwall);
    if (glyphIsCmapA(glyphNumber))
        return cmapToRogueColor(glyphNumber - GlyphOffset.cmapA + CmapSymbol.ndoor);
    if (glyphIsCmapAltar(glyphNumber))
        return cmapToRogueColor(CmapSymbol.altar);
    if (glyphIsCmapB(glyphNumber))
        return cmapToRogueColor(glyphNumber - GlyphOffset.cmapB + CmapSymbol.grave);
    return NO_COLOR;
}

// C display.c:map_glyphinfo(): the per-cell color resolution when a glyph
// reaches the map.  The port resolves each glyph's character and table color
// where the glyph is built (the per-kind resolvers stand in for glyphmap[]),
// so map_glyphinfo's own statements run at paint time: the hero tweaks of its
// is_you branch, and the Rogue-level rules reset_glyphmap() precomputed into
// the table (the RogueEpyx color tables, else the GMAP_ROGUELEVEL clear that
// only the showrace highlight survives).
function mapGlyphInfo(glyph: GlyphMetadata | null, nextGlyph: GlyphMetadata,
    x: number, y: number, color: number): number {
    if (!Is_rogue_level(game.u?.uz)) return color;
    // HAS_ROGUE_IBM_GRAPHICS with `Color: Yes` keeps the level's colors
    // through reset_glyphmap()'s rogue rows; the hero's own glyph turns
    // yellow there whatever its sex (display.c:2624-2627).
    if (rogueColorsActive()) {
        const rogueColor = rogueLevelGlyphColor(nextGlyph, x, y);
        // Glyphs whose native branch has no rogue override (explosions,
        // the branch wall ranges) keep their own color, not the clear.
        return rogueColor !== null ? rogueColor : color;
    }
    // reset_glyphmap() clears every other color on the Rogue level
    // (GMAP_ROGUELEVEL); map_glyphinfo()'s showrace tweak recolors the
    // hero's own glyph HI_DOMESTIC even after that clear.
    return isRogueShowraceHeroGlyph(glyph, x, y) ? color : NO_COLOR;
}

// C display.c:show_glyph().
export async function show_glyph_cell(
    x: number, y: number, ch: string, color: number = NO_COLOR, decgfx = false,
    attr = 0, glyph: GlyphMetadata | null = null,
) {
    if (suppressMapOutput() || x === 0) return;
    const loc = game.level?.at(x, y);
    if (!loc) return;
    const nextGlyph: GlyphMetadata = glyph || { kind: 'effect' };
    // C display.c:show_glyph(): show_glyph_change — announce discoveries and
    // furniture changes, excluding floor, walls, the hero, and disappearing
    // monsters. Monster sightings belong to spot_monsters when that option is
    // also enabled.
    let mentionChange = false;
    if (game.flags.mention_map && !game._monsterNoticesBlocked
        && !game.program_state.in_docrt && !game.program_state.gameover
        && !game.program_state.in_getlev && !game.program_state.stopprint) {
        const old = loc.disp_glyph?.glyph ?? GlyphOffset.unexplored;
        const symbol = nextGlyph.glyph === undefined ? null : glyphToCmapSymbol(nextGlyph.glyph);
        const furniture = symbol !== null
            && symbol >= CmapSymbol.upstair && symbol <= CmapSymbol.fountain;
        const discovered = old === GlyphOffset.nothing || old === GlyphOffset.unexplored;
        mentionChange = nextGlyph.glyph !== undefined
            && (old !== nextGlyph.glyph || !!loc.gnew)
            && (discovered || furniture)
            && !(symbol !== null && (symbol >= CmapSymbol.stone && symbol <= CmapSymbol.trwall
                || symbol >= CmapSymbol.room && symbol <= CmapSymbol.darkroom))
            && !(glyphIsMonster(old) || game.flags.spot_monsters && glyphIsMonster(nextGlyph.glyph))
            && (x !== game.u.ux || y !== game.u.uy);
    }
    color = mapGlyphInfo(glyph, nextGlyph, x, y, color);
    // reset_glyphmap() marks a corridor engraving which shares '#'
    // with corridors; tty_print_glyph() makes that glyph inverse.
    if (nextGlyph.glyph === cmapToGlyph(CmapSymbol.engrcorr) && ch === '#'
        && game.flags.use_inverse !== false && game.iflags.use_inverse !== false
        && game.iflags.wc_inverse !== false) attr |= ATR_INVERSE;
    if (game.flags.color === false) {
        color = NO_COLOR;
        // reset_glyphmap() distinguishes terrain which otherwise shares a
        // monochrome symbol. tty_print_glyph() shows those markers inversely.
        const symbol = nextGlyph.glyph;
        const indistinguishable = symbol === cmapToGlyph(CmapSymbol.ice)
            && ch === cmapSymbolAppearance(CmapSymbol.room).ch
            || (symbol === cmapToGlyph(CmapSymbol.lava) || symbol === cmapToGlyph(CmapSymbol.lavawall))
                && (ch === cmapSymbolAppearance(CmapSymbol.pool).ch
                    || ch === cmapSymbolAppearance(CmapSymbol.water).ch)
            || symbol === cmapToGlyph(CmapSymbol.sink)
                && ch === cmapSymbolAppearance(CmapSymbol.fountain).ch;
        if (indistinguishable
            && game.flags.use_inverse !== false
            && game.iflags.use_inverse !== false && game.iflags.wc_inverse !== false) {
            attr |= ATR_INVERSE;
        }
    }
    // show_glyph() compares glyph identity as well as buffered appearance.
    // Different species can share the same character and color.
    // Once queued, a cell still needs printing if a later update restores it.
    if (loc.disp_glyph?.glyph !== nextGlyph.glyph
        || loc.disp_ch !== ch || loc.disp_color !== color
        || loc.disp_decgfx !== decgfx || loc.disp_attr !== (attr | 0)) {
        loc.gnew = 1;
    }
    loc.disp_glyph = nextGlyph;
    loc.disp_ch = ch;
    loc.disp_color = color;
    loc.disp_decgfx = !!decgfx;
    loc.disp_attr = attr | 0;
    if (mentionChange) {
        const accessible = game.flags.accessiblemsg;
        game.flags.accessiblemsg = true;
        try {
            const description = await describeMapLocation(x, y);
            await pline_xy(x, y, `${description}.`);
        } finally {
            if (accessible === undefined) delete game.flags.accessiblemsg;
            else game.flags.accessiblemsg = accessible;
        }
    }
}

// display.h:glyph_is_monster() (the shared owner in glyph_numbers.ts)
// excludes bodies and statues.

// Part of C display.c:flush_screen(): the cursor after the last printed
// glyph.
// flush_screen() prints queued glyphs in row order. tty_print_glyph() leaves
// the cursor one column after the last printed cell, even when it was
// restored to the glyph already on the terminal before the flush.
export function lastDirtyMapCursor(g: GameState = game): [number, number] | null {
    if (!g.nhDisplay) return null;
    let cursor: [number, number] | null = null;
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            if (g.level?.at(x, y)?.gnew) {
                cursor = [x, y + 1];
            }
        }
    }
    return cursor;
}

export const SHIELD_STATIC = [
    '0', '#', '@', '#', '0', '#', '*',
    '0', '#', '@', '#', '0', '#', '*',
    '0', '#', '@', '#', '0', '#', '*',
];

// C display.c:shieldeff().  Resistance effects own a fixed 21-frame glyph
// cycle at the protected coordinate, then restore the normal map projection.
export async function shieldeff(x: number, y: number, g: GameState = game) {
    if (g.flags.sparkle === false || !cansee(x, y)) return;
    try {
        for (const ch of SHIELD_STATIC) {
            const glyph = shieldGlyph(ch);
            await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
            await flush_screen(1);
            g.nhDisplay?.setCursor(
                (g.u?.ux ?? 1) - 1,
                (g.u?.uy ?? 0) + 1,
            );
            await g.animationFrame?.();
        }
    } finally {
        await newsym(x, y);
    }
}

// C display.c:tether_glyph(): the tether segment from a saved position back
// toward the hero, drawn before the tethered object's next position.
function tether_glyph(x: number, y: number): DisplayGlyph {
    return zapdir_to_glyph(Math.sign(game.u.ux - x), Math.sign(game.u.uy - y), 2);
}

// Each active temporary effect owns its saved positions, so nested effects
// keep independent trails without global display state (native tmp_at()).
export type TemporaryGlyphStyle = 'beam' | 'all' | 'tether' | 'flash' | 'always';

export class TemporaryMapEffect {
    private readonly positions: Position[] = [];

    constructor(private readonly style: TemporaryGlyphStyle, private glyph: DisplayGlyph) {}

    // The DISP_BEAM/DISP_ALL/DISP_TETHER/DISP_FLASH/DISP_ALWAYS open:
    // initialize the glyph, then flush the buffered glyphs.
    async start(): Promise<void> {
        await flush_screen(0);
    }

    // DISP_CHANGE: replace the glyph later positions draw.
    changeGlyph(glyph: DisplayGlyph): void {
        this.glyph = glyph;
    }

    // C display.c:tmp_at(): the default "do it" case — save or restore the
    // previous position per style, show the glyph, then flush_screen(0).
    async tmp_at(x: number, y: number): Promise<void> {
        if (await this.draw(x, y)) await flush_screen(0);
    }

    // The do-it checks and show_glyph() without the closing flush; callers
    // that publish several cells in one frame draw each cell, then flush
    // the frame themselves (tmp_at() always adds its flush_screen(0)).
    async draw(x: number, y: number): Promise<boolean> {
        if (!isok(x, y)) return false;
        if (this.style === 'beam' || this.style === 'all' || this.style === 'tether') {
            if (this.style === 'beam' && !cansee(x, y)) return false;
            if (this.positions.length >= COLNO * 2) return false;
            if (this.style === 'tether') {
                const previous = this.positions.at(-1);
                if (previous) await this.paint(previous.x, previous.y,
                    tether_glyph(previous.x, previous.y));
            }
        } else {
            await this.clear();
            if (this.style === 'flash' && !cansee(x, y)) return false;
        }
        this.positions.push({ x, y });
        await this.paint(x, y, this.glyph);
        return true;
    }

    // A returning tether restores its far end before advancing the weapon.
    async retract(): Promise<boolean> {
        if (this.style !== 'tether' || this.positions.length < 2) return false;
        const end = this.positions.pop();
        const previous = this.positions.at(-1);
        if (!end || !previous) throw new Error('A returning tether needs two saved positions');
        await newsym(end.x, end.y);
        await this.paint(previous.x, previous.y, this.glyph);
        return true;
    }

    // DISP_END, with C's BACKTRACK option for a returning tether.
    async end(backtrack = false): Promise<void> {
        try {
            if (backtrack) {
                while (await this.retract()) {
                    await flush_screen(0);
                    await game.animationFrame?.();
                }
            }
        } finally {
            await this.clear();
        }
    }

    // Erase (reset) from source to end: each saved position is restored,
    // including repeated coordinates with their independent hallucinated
    // map projection.
    async clear(): Promise<void> {
        for (const position of this.positions) await newsym(position.x, position.y);
        this.positions.length = 0;
    }

    private async paint(x: number, y: number, glyph: DisplayGlyph): Promise<void> {
        await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx,
            glyph.attr ?? 0, glyph);
    }
}

// C display.c:map_invisible().  Unlike a transient actor overlay, an unseen
// attacker's `I` is hero memory and must survive later blind redraws until a
// caller explicitly discovers that the square no longer contains that
// threat.  It also remains authoritative on a physically visible square
// whose monster still cannot be spotted.
export async function map_invisible(x: number, y: number) {
    if (game.u?.ux === x && game.u?.uy === y) return;
    const loc = game.level?.at(x, y);
    if (!loc) return;
    if (game.level?.flags?.hero_memory) {
        loc.remembered_glyph = {
            ch: 'I', color: NO_COLOR, decgfx: false, kind: 'invisible', glyph: GlyphOffset.invisible,
        };
    }
    await show_glyph_cell(x, y, 'I', NO_COLOR, false, 0,
        { kind: 'invisible', glyph: GlyphOffset.invisible });
}

// C display.c:unmap_object(). Clearing stale object or invisible-creature
// memory restores a known trap, engraving, or background without revealing
// another floor object that was hidden underneath it.
export async function unmapObject(x: number, y: number) {
    const loc = game.level?.at(x, y);
    if (!loc || !game.level?.flags.hero_memory) return;
    const covered = terrainCoversObjectsAt(x, y);
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && !covered) {
        await map_trap(trap, false);
    } else if (loc.seenv) {
        const engraving = engravingAt(x, y);
        const showsEngraving = loc.typ === ROOM
            || loc.typ === CORR || loc.typ === ICE;
        if (engraving && showsEngraving && !covered) {
            if (cansee(x, y)) engraving.erevealed = true;
            await map_engraving(engraving, false);
        } else {
            await map_background(x, y, false);
            if (!loc.waslit && loc.typ === ROOM)
                loc.remembered_glyph = { ch: ' ', color: NO_COLOR,
                    decgfx: false, kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone };
        }
    } else {
        loc.remembered_glyph = { ch: ' ', color: NO_COLOR,
            decgfx: false, kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone };
    }
}

// C display.c:unmap_invisible().
export async function unmap_invisible(x: number, y: number, show = true) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind !== 'invisible') return false;
    await unmapObject(x, y);
    if (show) await newsym(x, y);
    return true;
}

// C display.c:display_self().
export async function displaySelf() {
    // display.h:maybe_display_usteed() gives a visible steed its own identity.
    const steed = game.u.usteed;
    const glyph = steed && monsterVisible(steed)
        ? displayMonsterGlyph(heroIsHallucinating() ? rn2Display(MONSTER_COLOR.length) : steed.mnum,
            !!steed.female, 'ridden')
        : heroDisplayGlyph();
    await show_glyph_cell(game.u.ux, game.u.uy,
        glyph.ch, glyph.color, glyph.decgfx ?? false, 0, glyph);
}

// C display.c:newsym_force(). A forced redraw prints even an unchanged glyph.
export async function newsym_force(x: number, y: number): Promise<void> {
    await newsym(x, y);
    const location = game.level?.at(x, y);
    if (location) location.gnew = 1;
}

// Part of C wintty.c:tty_print_glyph(): the pet and detected highlighting.
// ── newsym ──
function monsterDisplayAttribute(state: 'normal' | 'pet' | 'detected') {
    // C tty_print_glyph() applies pet highlighting independently of use_inverse.
    if (state === 'pet') return game.flags.hilite_pet
        ? terminalAttrFromCAttr(game.iflags.wc2_petattr ?? C_ATR_INVERSE) : 0;
    const inverse = game.flags?.use_inverse !== false
        && game.iflags?.use_inverse !== false && game.iflags?.wc_inverse !== false;
    return state === 'detected' && inverse ? ATR_INVERSE : 0;
}

// C display.c:show_mon_or_warn(): a located actor replaces remembered
// invisibility, then the glyph reaches the map.
async function showMonsterOrWarning(x: number, y: number, glyph: DisplayGlyph, attr = 0) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind === 'invisible') {
        await unmapObject(x, y);
        const object = game.level?.objects[x]?.[y]?.[0];
        if (cansee(x, y) && object) await map_object(object, false);
    }
    await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, attr, glyph);
}

// Part of C display.c:newsym(): the visible region at a cell.
function visibleMapRegionAt(x: number, y: number) {
    return (game.level?.regions || []).find(region => region.visible
        && region.ttl !== -2 && region.cells?.some(cell =>
            cell.x === x && cell.y === y)) || null;
}

// Part of C display.c:newsym(): displaying a gas cloud.
async function showMapRegion(x: number, y: number) {
    const region = visibleMapRegionAt(x, y);
    if (!region) return;
    const poisonous = region.damage > 0;
    await show_glyph_cell(x, y, '#', poisonous ? CLR_BRIGHT_GREEN : CLR_GRAY, false, 0,
        { kind: 'terrain', terrainName: poisonous ? 'poison cloud' : 'cloud',
            glyph: cmapToGlyph(poisonous ? CmapSymbol.poisoncloud : CmapSymbol.cloud) });
}

// C display.c:mon_overrides_region(). A sensed monster outranks a gas cloud.
function monsterOverridesMapRegion(monster: Monster | null | undefined, x: number, y: number) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind === 'invisible') return true;
    if (!monster) return false;
    if (x === monster.mx && y === monster.my
        && (canSenseMonster(monster) || monsterHasWarningProjection(monster))) return true;

    const blind = !!game.blind;

    const range = Math.max(game.u?.xray_range ?? -1, 1);
    const dx = x - (game.u?.ux ?? x);
    const dy = y - (game.u?.uy ?? y);
    const ordinaryVisible = !blind && monsterVisible(monster)
        && M_AP_TYPE(monster) !== M_AP_FURNITURE
        && M_AP_TYPE(monster) !== M_AP_OBJECT;
    return ordinaryVisible && dx * dx + dy * dy <= range * (range + 1);
}

// C display.c:newsym().
export async function newsym(x: number, y: number) {
    if (suppressMapOutput()) return;
    const loc = game.level?.at(x, y);
    if (!loc) return;
    // C newsym() permits only the hero cell while swallowed.  The stomach
    // renderer bypasses newsym(), so monster movement and memory repairs must
    // not leak ordinary map glyphs back into the cleared viewport.
    if (game.u?.uswallow) {
        if (game.u.ux === x && game.u.uy === y)
            await displaySelf();
        return;
    }
    if (restrictedUnderwaterView()
        && (!underwaterTerrain(x, y)
            || Math.abs(x - game.u.ux) > 1 || Math.abs(y - game.u.uy) > 1)) return;
    const physicallyVisible = cansee(x, y);
    // C newsym() remembers permanent lighting while this square is visible.
    // Temporary light grants sight but must not make a dark room stay lit in
    // memory after the hero leaves it.
    if (physicallyVisible) loc.waslit = !!loc.lit;
    const engraving = engravingAt(x, y);
    // C reveals the map symbol before living and object overlays are chosen.
    if (physicallyVisible && engraving) engraving.erevealed = true;

    const monster = monsterAtPosition(requireGameLevel(), x, y);
    const region = physicallyVisible ? visibleMapRegionAt(x, y) : null;
    if (region && (ACCESSIBLE(loc.typ) || isPoolOrLavaAt(x, y))
        && !monsterOverridesMapRegion(monster, x, y)) {
        // region.c:show_region() uses the gas-cloud cmap glyph.  Visible gas
        // overlays ordinary distant monsters but not sensed/warned or
        // adjacent otherwise-visible actors.
        await showMapRegion(x, y);
        return;
    }

    if (game.u?.ux === x && game.u?.uy === y) {
        // C maps the nonliving layer into memory before optionally drawing
        // the hero.  When canspotself() is false, that layer is also the live
        // projection at the hero's coordinate.
        const spotSelf = canSpotHeroSelf();
        if (physicallyVisible) await map_location(x, y, !spotSelf);
        else await feel_location(x, y);
        if (!spotSelf) return;
        await displaySelf();
        return;
    }

    const projection = monster ? monsterProjectionAtCell(monster, x, y) : null;
    if (projection && monster) {
        // A visible actor overlays rather than replaces the remembered layer.
        if (physicallyVisible) {
            const trap = monster.mtrapped ? game.level?.traps.find(candidate =>
                candidate.tx === x && candidate.ty === y) : undefined;
            // Seeing a monster caught in a physical trap also reveals it.
            if (trap && (trap.ttyp === BEAR_TRAP || is_pit(trap.ttyp) || trap.ttyp === WEB))
                trap.tseen = true;
            await map_location(x, y, false);
        }
        await displayMonsterAtCell(monster, x, y, projection);
        return;
    }
    const warning = isWormTail(monster, x, y) ? null : warningProjection(monster);
    if (warning) {
        await showMonsterOrWarning(x, y, { ...warning, decgfx: false, kind: 'warning',
            glyph: warning.glyph });
        return;
    }
    if (loc.remembered_glyph?.kind === 'invisible') {
        await map_invisible(x, y);
        return;
    }

    // Only update display/memory if cell is IN_SIGHT (lit and visible)
    if (physicallyVisible) {
        await map_location(x, y, true);
    } else if (loc.remembered_glyph) {
        await showRememberedLocation(x, y, loc);
    } else {
        // A living glyph is only an overlay.  When its actor vacates an
        // unseen, never-mapped square, restore unexplored space rather than
        // leaving a presentation-only duplicate behind.
        await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
            { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }
}

// C display.c:display_monster(). Sight updates and touch share this renderer,
// while their callers choose independently which monsters can be projected.
async function displayMonsterAtCell(monster: Monster, x: number, y: number, projection: MonsterProjection): Promise<void> {
    const loc = requireDisplayLocation(x, y);
    // A visible disguise enters memory even when a sense exposes its
    // owner. Reading glyphAt() must not reroll this display-only choice.
    const sensed = canSenseMonster(monster)
        || game.u?.protectionFromShapeChangers
        || game.protectionFromShapeChangers;
    if (projection.showAppearance) {
        if (M_AP_TYPE(monster) === M_AP_OBJECT) {
            await map_object({
                ox: x, oy: y,
                otyp: mimicAppearance(monster),
                // Native uses zeroobj, whose class remains zero. A potion
                // disguise therefore bypasses the generic-potion test.
                oclass: RANDOM_CLASS,
                corpsenm: monster.mcorpsenm ?? MONSTER_NAME.indexOf('tengu'),
                dknown: false,
            }, !sensed);
            if (!sensed) return;
        } else if (M_AP_TYPE(monster) === M_AP_FURNITURE) {
            const glyph = furnitureDisplayGlyph(mimicAppearance(monster));
            loc.remembered_glyph = glyph;
            if (!sensed) {
                await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
                loc.lastseentyp = cmapToType(mimicAppearance(monster));
                return;
            }
        } else if (M_AP_TYPE(monster) === M_AP_MONSTER
            && Number.isInteger(monster.mappearance)) {
            const mnum = heroIsHallucinating()
                ? rn2Display(MONSTER_COLOR.length) : mimicAppearance(monster);
            const glyph = displayMonsterGlyph(mnum, !!monster.female);
            await show_glyph_cell(x, y, glyph.ch, glyph.color, false, 0, glyph);
            if (!sensed) return;
        }
    }
    if (M_AP_TYPE(monster) !== M_AP_NOTHING && !sensed) return;
    const monsterState = (monster.pet || (monster.mtame ?? 0) > 0) && !heroIsHallucinating()
        ? 'pet' : projection.detected ? 'detected' : 'normal';
    if (heroIsHallucinating()) {
        const displayMnum = rn2Display(MONSTER_COLOR.length);
        const glyph = displayMonsterGlyph(displayMnum, !!monster.female, monsterState);
        await showMonsterOrWarning(x, y, glyph, monsterDisplayAttribute(monsterState));
    } else {
        const tailGlyph = projection.wormTail ? displayMonsterGlyph(PM_LONG_WORM_TAIL) : null;
        await showMonsterOrWarning(x, y, {
            ch: (tailGlyph ?? displayMonsterGlyph(monster.mnum)).ch,
            color: tailGlyph ? tailGlyph.color
                : monster.mnum === 102 ? NO_COLOR
                    : monster.mnum === 100 || monster.mnum === 239 ? CLR_BROWN
                    : (MONSTER_COLOR[monster.mnum]
                        ?? monster.color ?? CLR_GRAY),
            decgfx: false, kind: 'monster',
            mnum: projection.wormTail ? PM_LONG_WORM_TAIL : monster.mnum,
            glyph: monsterGlyphNumber(projection.wormTail ? PM_LONG_WORM_TAIL : monster.mnum,
                !!monster.female, monsterState),
        }, monsterDisplayAttribute(monsterState));
    }
    monster.meverseen = 1;
}

// C display.c:see_monsters()
// Warning, telepathy, and visible regions
// can change how a stationary monster is projected when only the hero moves;
// repainting solely on actor movement leaves stale warning numerals behind.
export async function see_monsters({ beforeGlow = null }: RedrawOptions = {}) {
    if (game._deferSeeMonsters) return;
    if (game.u?.usteed) game.u.usteed.meverseen = 1;
    if (game.u?.ustuck) game.u.ustuck.meverseen = 1;
    let count = 0;
    // makemon() links new actors at fmon's head; the live level array retains
    // creation order, so source traversal is its reverse (same as scheduler).
    for (const monster of Array.from(game.level?.monsters || []).reverse()) {
        if (monster.dead || monster.mhp <= 0
            || ((monster.mstate ?? 0) & MON_STILL_ARRIVING)) continue;
        await newsym(monster.mx, monster.my);
        if (monster.wormno) await redrawMonsterWormSegments(monster);
        if (game.u.warnOfMonster
            // C display.c:see_monsters() compares the raw object-warning mask and mflags2.
            && ((game.context.warntype?.obj ?? 0) & (MONSTER_FLAGS2[monster.mnum] ?? 0))) count++;
    }
    if (count !== game.warn_obj_cnt) {
        await artifactWarningFeedback(count, { beforeGlow });
        game.warn_obj_cnt = count;
    }
    if (!game.u?.usteed && game.u?.ux > 0) await newsym(game.u.ux, game.u.uy);
}

// C display.c:mimic_light_blocking(): the iter_mons callback.  An invisible
// mimic of a light-blocking appearance updates the vision block map; C
// branches on See_invisible to block or unblock the point here, while the
// port records the change for the next vision recalc.
function mimic_light_blocking(monster: Monster): void {
    if (monster.minvis && mimicBlocksLight(monster))
        vision_note_blocker_change(monster.mx, monster.my);
}

// C display.c:set_mimic_blocking(). Block/unblock light depending on what a
// mimic is mimicking and if it's invisible or not; only called when the
// state of See_invisible changes.  iter_mons() skips dead monsters.
export function set_mimic_blocking({ state = game } = {}): void {
    requireLiveGame(state);
    for (const monster of requireGameLevel(state).monsters)
        if (!monster.dead) mimic_light_blocking(monster);
}

// Port only: the set_mimic_blocking() + see_monsters() refresh pair.
// Each caller performs this after a See_invisible change; see_monsters()
// includes the hero, so callers that also repaint the hero's own square
// use refreshHeroSeeing() below.
export async function refreshInvisibleMonsters({ state = game } = {}) {
    set_mimic_blocking({ state });
    await see_monsters();
}

// Part of C potion.c:peffect_see_invisible(): its tail runs
// set_mimic_blocking(), see_monsters() and newsym(u.ux, u.uy) in order.
export async function refreshHeroSeeing({ state = game } = {}) {
    await refreshInvisibleMonsters({ state });
    await newsym(state.u.ux, state.u.uy);
}

// Part of C potion.c:peffect_see_invisible(): the blessed/permanent see-invisible
// grant, followed by the same redraw tail.
export async function grantHeroSeeInvisible({
    permanent = false, duration = 0, state = game,
} = {}) {
    requireLiveGame(state);
    if (permanent) grantIntrinsicProperty('seeInvisible', 'outside', state);
    else {
        state.u.seeInvisibleTurns = Math.min(TIMEOUT,
            (state.u.seeInvisibleTurns || 0) + duration);
        refreshProperty('seeInvisible', state);
    }
    await refreshHeroSeeing({ state });
}

// C display.c:see_objects()/see_traps().  fobj is newest-first globally,
// while only each square's pile-top is eligible for a redraw.
export async function see_objects() {
    const objects: GameObject[] = [];
    for (const column of game.level?.objects || []) {
        if (!column) continue;
        for (const pile of column) {
            if (pile?.[0]) objects.push(pile[0]);
        }
    }
    objects.sort((a, b) => (b._fobjOrder ?? 0) - (a._fobjOrder ?? 0));
    for (const object of objects) await newsym(object.ox, object.oy);
}

// C display.c:see_traps().
export async function see_traps() {
    for (const trap of game.level?.traps || []) {
        const loc = game.level?.at?.(trap.tx, trap.ty);
        if (loc?.disp_glyph?.kind === 'trap') await newsym(trap.tx, trap.ty);
    }
}

// C display.c:curs_on_u(). Flush waiting glyphs & put cursor on hero.
export async function curs_on_u(): Promise<void> {
    await flush_screen(1);
}

let lastSwallowedX = 0;
let lastSwallowedY = 0;

// C display.c:swallow_to_glyph(): each border cell is monster<<3 | position,
// with display.h:what_mon resolving a hallucinated species through the
// display RNG.  The stomach color reads the same resolved species back out
// of the glyph number's top bits.  display.c:2441-2444 reports
// impossible("swallow_to_glyph: bad swallow location") before clamping an
// out-of-range location to S_sw_br; this sync encoder clamps without the
// report, which no caller reaches (swallowed() passes S_sw_tl..S_sw_br).
// Its only caller, swallowed(), bypasses ordinary vision/memory projection:
// the first draw clears the map, then eight stomach cells surround the hero,
// and when hallucinating every stomach cell independently chooses a
// display-only monster color.
export function swallowToGlyph(mnum: number, loc: number): number {
    const shown = heroIsHallucinating() ? rn2Display(MONSTER_COLOR.length) : mnum;
    const position = loc < CmapSymbol.swallowTopLeft || CmapSymbol.swallowBottomRight < loc
        ? CmapSymbol.swallowBottomRight : loc;
    return ((shown << 3) | (position - CmapSymbol.swallowTopLeft)) + GlyphOffset.swallow;
}

// C display.c:swallowed().
export async function swallowed(first = false) {
    if (!game.level || !game.u?.uswallow || !game.u?.ustuck) return;
    if (first) {
        for (let y = 0; y < ROWNO; y++)
            for (let x = 1; x < COLNO; x++)
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
                    { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    } else if (lastSwallowedX > 0) {
        for (let y = lastSwallowedY - 1; y <= lastSwallowedY + 1; y++)
            for (let x = lastSwallowedX - 1; x <= lastSwallowedX + 1; x++)
                if (x > 0 && x < COLNO && y >= 0 && y < ROWNO)
                    await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
                        { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }

    const x = game.u.ux, y = game.u.uy;
    const positions: ReadonlyArray<readonly [number, number]> = [
        [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
    ];
    for (const [index, [dx, dy]] of positions.entries()) {
        if (index === 4) await displaySelf();
        const sx = x + dx, sy = y + dy;
        if (sx <= 0 || sx >= COLNO || sy < 0 || sy >= ROWNO) continue;
        const glyphNumber = swallowToGlyph(game.u.ustuck.mnum,
            CmapSymbol.swallowTopLeft + index);
        const mnum = (glyphNumber - GlyphOffset.swallow) >> 3;
        let color = MONSTER_COLOR[mnum] ?? NO_COLOR;
        // tty has no hilite for ordinary gray; black is dark gray (use_darkgray).
        if (color === CLR_GRAY) color = NO_COLOR;
        const appearance = swallowSymbolAppearance(index);
        const glyph: DisplayGlyph = {
            ch: appearance.ch,
            color,
            decgfx: appearance.dec, kind: 'effect',
            glyph: glyphNumber,
        };
        await show_glyph_cell(sx, sy, glyph.ch, color, glyph.decgfx, 0, glyph);
    }
    lastSwallowedX = x;
    lastSwallowedY = y;
}

// Part of C display.c:under_water(): the restricted-view gate.
function restrictedUnderwaterView() {
    return !!(game.u?.uinwater || game.underwater) && !Is_waterlevel(game.u?.uz);
}

// Part of C display.c:under_water(): the underwater terrain test.
function underwaterTerrain(x: number, y: number) {
    return isPoolOrLavaAt(x, y) || isIceAt(x, y);
}

type RestrictedDisplayMode = 0 | 1 | 2;

// C display.c:under_water().
// Mode 2 defers the full clear until the next update; mode 0 clears only
// the previous three-by-three view before drawing the new one.
export async function under_water(mode: RestrictedDisplayMode): Promise<void> {
    if (!game.level || Is_waterlevel(game.u.uz) || game.u.uswallow) return;
    const view = game._underwaterView ??= { position: null, fullRedrawPending: false };
    if (mode === 1 || view.fullRedrawPending) {
        await cls();
        view.fullRedrawPending = false;
    } else if (mode === 2) {
        view.fullRedrawPending = true;
        return;
    } else {
        const previous = view.position ?? { x: 0, y: 0 };
        for (let y = previous.y - 1; y <= previous.y + 1; y++)
            for (let x = previous.x - 1; x <= previous.x + 1; x++)
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
                    { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (!underwaterTerrain(x, y)) continue;
            if (heroIsBlind() && (x !== game.u.ux || y !== game.u.uy))
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
                    { kind: 'unexplored', glyph: GlyphOffset.unexplored });
            else await newsym(x, y);
        }
    }
    view.position = { x: game.u.ux, y: game.u.uy };
}

// C display.c:under_ground().
// A full reset stays blank until the next hero update.
export async function under_ground(mode: RestrictedDisplayMode): Promise<void> {
    if (!game.level || game.u.uswallow) return;
    const view = game._undergroundView ??= { fullRedrawPending: false };
    if (mode === 1 || view.fullRedrawPending) {
        await cls();
        view.fullRedrawPending = false;
    } else if (mode === 2) {
        view.fullRedrawPending = true;
    } else await newsym(game.u.ux, game.u.uy);
}

// Part of C display.c:docrt_flags(), display.c:redraw_map(): the restricted
// redraw dispatch.
async function redrawRestrictedMap(full: boolean): Promise<void> {
    if (restrictedUnderwaterView()) {
        await under_water(full || !game._underwaterView ? 1 : 0);
    } else {
        if (full || !game._undergroundView) await under_ground(1);
        if (!full) await under_ground(0);
    }
}

// C display.c:docrt_flags()
// ── docrt ──
// C display.c:docrt_flags(docrtRecalc). A screen reset pages the old message
// before clearing the terminal, then rebuilds sight and monster overlays.
export async function docrt({ beforeGlow = null }: RedrawOptions = {}) {
    if (!game.level || game.program_state.in_docrt) return;
    game.program_state.in_docrt = true;
    try {
        if (game.u?.uswallow) {
            await cls();
            await swallowed(true);
            return;
        }
        if (restrictedUnderwaterView() || game.u?.uburied) {
            await redrawRestrictedMap(true);
            return;
        }
        await vision_recalc(2);
        await cls();
        for (let y = 0; y < ROWNO; y++)
            for (let x = 1; x < COLNO; x++) {
                const loc = game.level.at(x, y);
                const memory = loc?.remembered_glyph;
                if (memory) {
                    // docrt_flags() displays memory unchanged. newsym() owns
                    // corrections after sight and monster senses are restored.
                    await show_glyph_cell(x, y, memory.ch, memory.color, memory.decgfx,
                        objectGlyphAttr(memory), memory);
                } else {
                    await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
                        { kind: 'unexplored', glyph: GlyphOffset.unexplored });
                }
            }
        await vision_recalc(0);
        await see_monsters({ beforeGlow });
    } finally {
        game.program_state.in_docrt = false;
        game.context.botl = true;
    }
}

// C display.c:redraw_map().
// Refresh map cells after an ordinary vision change or a temporary overlay.
// This does not reset the tty screen or require message acknowledgment.
export async function redrawMap() {
    if (!game.level) return;
    if (game.u?.uswallow) {
        await swallowed(true);
        return;
    }
    if (restrictedUnderwaterView() || game.u?.uburied) {
        await redrawRestrictedMap(false);
        return;
    }
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level.at(x, y);
            // C docrt()/newsym() reconstructs live visible glyphs after a
            // modal window clears the physical map. Hero memory owns only
            // cells outside current sight; it must not erase actors, objects,
            // or traps which did not move while the modal was open.
            const monster = monsterAtPosition(game.level, x, y);
            if (cansee(x, y) || (monster
                && (monsterProjectionAtCell(monster, x, y)
                    || !isWormTail(monster, x, y) && monsterHasWarningProjection(monster)))) {
                // newsym() displays Warning before correcting unseen floor
                // memory, just as it does for an identified monster.
                await newsym(x, y);
            } else if (loc?.remembered_glyph) {
                await showRememberedLocation(x, y, loc);
            } else {
                // Modal redraw reconstructs presentation from visibility and
                // memory.  Clear any old transient actor/warning overlay when
                // neither owner projects this square anymore.
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0,
                    { kind: 'unexplored', glyph: GlyphOffset.unexplored });
            }
        }
    if (game.u?.ux > 0 && canSpotHeroSelf()) {
        await displaySelf();
    }
    // vision_recalc's newly visible cells were projected above; source docrt
    // then overlays fmon once more in linked-list order.
    await see_monsters();
}

// C display.c:get_bkglyph_and_framecolor(): the frame-color half, extracted
// for row_refresh().  The background-glyph half (iflags.use_background_glyph
// merging a dark-room floor under the glyph) is not ported: the tty port
// never renders background glyphs, so tmp_bkglyph stays GLYPH_UNEXPLORED.
// The port models wsettings.map_frame_color with HI_ZAP; mapxy_valid() (the
// installed valid-location callback) decides which cells the frame colors.
function get_bkglyph_and_framecolor(x: number, y: number): { framed: boolean; frameColor: number | null } {
    const highlight = game._mapPositionHighlight;
    const framed = !!highlight?.background && highlight.isValidLocation(x, y);
    return { framed, frameColor: framed && game.flags.color !== false ? HI_ZAP : null };
}

// C display.c:row_refresh(). Repaint the current glyph buffer without
// recomputing vision or choosing new hallucinated appearances.
export function row_refresh(start: number, stop: number, y: number): void {
    const display = game.nhDisplay;
    if (!display || y < 0 || y >= ROWNO) return;
    for (let x = Math.max(1, start); x <= Math.min(stop, COLNO - 1, display.cols - 1); x++) {
        const loc = game.level?.at(x, y);
        if (!loc?.disp_ch) continue;
        const { framed, frameColor } = get_bkglyph_and_framecolor(x, y);
        if (glyphAt(x, y)?.glyph === GlyphOffset.unexplored && !framed) continue;
        writeMapCell(display, x, y, loc, frameColor);
        display.setCursor(x, y + 1);
    }
}

// C display.c:flush_screen().
// ── flush_screen ──
export async function flush_screen(mode?: number) {
    if (suppressMapOutput() || game._suppressMapStatusForFlush) return;
    if (game.program_state?.windows_exited) return;
    // C display.c pauses map updates during level arrival. Message windows
    // still write their own rows while the old map remains on screen.
    if (mode === -1) game._mapFlushPaused = !game._mapFlushPaused;
    if (game._mapFlushPaused) return;
    updateStatusLines();
    const display = game.nhDisplay;
    const mapCursor: [number, number] | null = mode === 0 && display
        ? lastDirtyMapCursor() ?? [display.cursorCol, display.cursorRow] : null;
    _buildScreenOutput();
    if (!display || game.program_state.saving || game._suppressMapStatusForFlush) return;
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level?.at(x, y);
            if (loc) loc.gnew = 0;
        }
    }
    // print_glyph() advances the tty cursor; only a requested curs_on_u()
    // subsequently moves it back to the hero.
    if (mapCursor) display?.setCursor(...mapCursor);
}

// C display.c:cls().  Flush the message window, force the botl update and
// clear the physical screen, then clear_glyph_buffer(): every cell returns
// to unexplored, a buffer reset rather than a discovered glyph change.
export async function cls() {
    await flushPendingTopline();
    game.context.botl = true;
    const display = game?.nhDisplay;
    if (display?.clearScreen) display.clearScreen();
    game._pending_message = '';
    game._retained_message = '';
    game._toplineGlyphPainted = false;
    // clear_glyph_buffer() resets the buffer directly. This is not a
    // discovered glyph change, and default unexplored spaces are not dirty.
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const location = game.level?.at(x, y);
            if (!location) continue;
            location.disp_glyph = { kind: 'unexplored', glyph: GlyphOffset.unexplored };
            location.disp_ch = ' ';
            location.disp_color = NO_COLOR;
            location.disp_decgfx = false;
            location.disp_attr = 0;
            location.gnew = 0;
        }
    }
    game.context.botl = true;
}

// ---------------------------------------------------------------------------
// Rogue-level cmap colors.  C ref: display.c cmap_to_roguecolor(); the
// customization expansion lives in glyphs.ts (glyphs.c).
// ---------------------------------------------------------------------------

// C display.c:cmap_to_roguecolor(), shared with map rendering.
export function cmapToRogueColor(index: number): number {
    if (index >= CmapSymbol.vwall && index <= CmapSymbol.hcdoor) return CLR_BROWN;
    if (index >= CmapSymbol.arrowTrap && index <= CmapSymbol.arrowTrap + 21) return CLR_MAGENTA;
    if (index === CmapSymbol.corr || index === CmapSymbol.litcorr) return CLR_GRAY;
    if (index >= CmapSymbol.room && index <= CmapSymbol.water
        && index !== CmapSymbol.darkroom) return CLR_GREEN;
    return NO_COLOR;
}


// ---------------------------------------------------------------------------
// Wall mode and wall angle.  C ref: display.c check_pos(), more_than_one(),
// set_twall(), set_wall(), set_corn(), set_crosswall(), xy_set_wall_state(),
// set_wall_state() and wall_angle().

// C display.c:check_pos(). Return 'which' if position implies an unfinished
// exterior (outer area is rock or a corridor); zero otherwise.  The low
// wall_info bits later combine with `seenv` in wall_angle() so a hero beside
// a doorway does not see the outside face of the room wall.
function check_pos(x: number, y: number, which: number): number {
    if (!isok(x, y)) return which;
    const typ = requireGameLevel().at(x, y)?.typ ?? STONE;
    return IS_STWALL(typ) || typ === CORR || typ === SCORR || typ === SDOOR
        ? which : 0;
}

// C display.c:more_than_one(). Return TRUE if more than one is non-zero.
function more_than_one(...values: number[]): boolean {
    return values.filter(Boolean).length > 1;
}

// C display.c:set_twall(): wall mode for a T wall from its three arms.
function set_twall(points: readonly (readonly [number, number])[]): number {
    const modes = points.map(([x, y], index) =>
        check_pos(x, y, index + 1));
    return more_than_one(...modes) ? 0 : modes.reduce((sum, value) => sum + value, 0);
}

// C display.c:set_wall(): wall mode for a straight horizontal or vertical
// wall from its two faces.
function set_wall(x: number, y: number, horizontal: boolean): number {
    const first = horizontal
        ? check_pos(x, y - 1, 1) : check_pos(x - 1, y, 1);
    const second = horizontal
        ? check_pos(x, y + 1, 2) : check_pos(x + 1, y, 2);
    return more_than_one(first, second) ? 0 : first + second;
}

// C display.c:set_corn(): corner wall mode; the inner position decides
// between inner and outer, three finished outer faces mean finished.
function set_corn(points: readonly (readonly [number, number])[],
    inner: readonly [number, number]): number {
    const outside = points.map(([x, y]) => check_pos(x, y, 1));
    if (check_pos(inner[0], inner[1], 1)) return 2;
    return outside.every(Boolean) ? 1 : 0;
}

// C display.c:set_crosswall(): crosswall mode from the four quadrants.
function set_crosswall(x: number, y: number): number {
    const quadrants = [
        check_pos(x - 1, y - 1, 1),
        check_pos(x + 1, y - 1, 1),
        check_pos(x + 1, y + 1, 1),
        check_pos(x - 1, y + 1, 1),
    ];
    const present = quadrants.filter(Boolean);
    if (present.length <= 1) {
        if (quadrants[0]) return WM_X_TL;
        if (quadrants[1]) return WM_X_TR;
        if (quadrants[2]) return WM_X_BR;
        if (quadrants[3]) return WM_X_BL;
        return 0;
    }
    if (quadrants[0] && quadrants[2] && !quadrants[1] && !quadrants[3])
        return WM_X_TLBR;
    if (quadrants[1] && quadrants[3] && !quadrants[0] && !quadrants[2])
        return WM_X_BLTR;
    return 0;
}

// C display.c:xy_set_wall_state(). Called for every <x,y> by
// set_wall_state() and for specific <x,y> during vault wall repair.
export function xy_set_wall_state(x: number, y: number): void {
    const loc = requireGameLevel().at(x, y);
    if (!loc) return;
    let mode = -1;
    switch (loc.typ) {
    case SDOOR:
        mode = set_wall(x, y, !!loc.horizontal);
        break;
    case VWALL:
        mode = set_wall(x, y, false);
        break;
    case HWALL:
        mode = set_wall(x, y, true);
        break;
    case TDWALL:
        mode = set_twall([[x, y - 1], [x - 1, y + 1], [x + 1, y + 1]]);
        break;
    case TUWALL:
        mode = set_twall([[x, y + 1], [x + 1, y - 1], [x - 1, y - 1]]);
        break;
    case TLWALL:
        mode = set_twall([[x + 1, y], [x - 1, y - 1], [x - 1, y + 1]]);
        break;
    case TRWALL:
        mode = set_twall([[x - 1, y], [x + 1, y + 1], [x + 1, y - 1]]);
        break;
    case TLCORNER:
        mode = set_corn(
            [[x - 1, y - 1], [x, y - 1], [x - 1, y]], [x + 1, y + 1],
        );
        break;
    case TRCORNER:
        mode = set_corn(
            [[x, y - 1], [x + 1, y - 1], [x + 1, y]], [x - 1, y + 1],
        );
        break;
    case BLCORNER:
        mode = set_corn(
            [[x, y + 1], [x - 1, y + 1], [x - 1, y]], [x + 1, y - 1],
        );
        break;
    case BRCORNER:
        mode = set_corn(
            [[x + 1, y], [x + 1, y + 1], [x, y + 1]], [x - 1, y - 1],
        );
        break;
    case CROSSWALL:
        mode = set_crosswall(x, y);
        break;
    default:
        break;
    }
    if (mode >= 0) loc.wall_info = ((loc.wall_info || 0) & ~WM_MASK) | mode;
}

// C display.c:set_wall_state(). Called from mklev.  Scan the level and set
// the wall modes.
export function set_wall_state(): void {
    if (!game.level) return;
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) xy_set_wall_state(x, y);
    }
}

// C display.c:seenv_matrix; vision.c shares it through an extern.
const seenv_matrix = [
    [SV2, SV1,   SV0],
    [SV3, SVALL, SV7],
    [SV4, SV5,   SV6],
] as const;

// C display.c:set_seenv(). Touch records the same angle as physical sight.
export function set_seenv(location: MapLocation, fromX: number, fromY: number, x: number, y: number): void {
    location.seenv |= seenVector(Math.sign(x - fromX), Math.sign(fromY - y));
}

// Part of C display.c:set_seenv(): select the viewing-angle bit for an adjacent direction.
function seenVector(dx: number, dy: number): number {
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
        throw new RangeError(`Seen direction (${dx}, ${dy}) must be adjacent.`);
    return seenv_matrix[dy < 0 ? 0 : dy > 0 ? 2 : 1][dx < 0 ? 0 : dx > 0 ? 2 : 1];
}

// C display.c:unset_seenv(). The caller supplies the origin or an adjacent cell.
export function unset_seenv(location: MapLocation, fromX: number, fromY: number, x: number, y: number): void {
    const dx = x - fromX;
    const dy = fromY - y;
    location.seenv &= ~seenVector(dx, dy);
}

// Part of C display.c:wall_angle(): straight-wall and corner visibility.
// The SDOOR, straight-wall and corner cases of the angle switch: a
// unfinished exterior face is stored in the low three wall_info bits.  Seen
// vectors which only approach from that rock side project unexplored stone,
// not the nominal line-drawing wall.
function simpleWallVisible(loc: MapLocation) {
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

// Part of C display.c:wall_angle(): the do_twall block (wall_matrix).
// T walls retain their topology type while their visible glyph changes
// with the accumulated seen vector.  This matters when opening a nearby
// door reveals a previously hidden arm: the same TUWALL can project as a
// corner, straight wall, or full tee.  Rows are C's wall_matrix[][],
// columns its T_stone..T_tdwall results.
function projectedTWallType(loc: MapLocation): number {
    let seenv = (loc.seenv || 0) & 0xff;
    let row: readonly [number, number, number, number, number];
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

    const only = (bits: number) => !!(seenv & bits) && !(seenv & ~bits);
    const mode = (loc.wall_info || 0) & 0x07;
    let column: 0 | 1 | 2 | 3 | 4 = 0;
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

// Part of C display.c:wall_angle(): the CROSSWALL case (cross_matrix).
// Cross-wall topology is stable, but its visible glyph is the subset of
// arms approached by the hero.  The wall mode additionally records which
// quadrant(s) remain unfinished rock.  All single-solid quarters rotate to
// the bottom right before the pattern match.
function projectedCrossWallType(loc: MapLocation): number {
    let seenv = (loc.seenv || 0) & 0xff;
    const mode = (loc.wall_info || 0) & 0x07;
    const only = (bits: number) => !(seenv & ~bits);

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
    } as const;
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
        let column: 0 | 1 | 2 | 3 | 4 | 5;
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

// C display.c:wall_angle(): the correct graphics character index using wall
// type, wall mode, and the seen vector.  C returns the cmap symbol index;
// this port returns the projected terrain type, whose symbol
// terrainSymbolIndex() resolves exactly as C's cmap_to_glyph(idx) does.
// The T-wall and crosswall arms keep their pattern-match blocks in the
// helpers above, as C keeps them behind the do_twall/do_crwall labels.
// C's t_warn() diagnostic is not ported: its impossible() reports fire only
// for seen vectors back_to_glyph()'s `seenv ? wall_angle() : S_stone` guard
// keeps unreachable.
function wall_angle(loc: MapLocation): number {
    switch (loc.typ) {
    case TDWALL:
    case TLWALL:
    case TUWALL:
    case TRWALL:
        return projectedTWallType(loc);
    case SDOOR:
    case VWALL:
    case HWALL:
    case TLCORNER:
    case TRCORNER:
    case BLCORNER:
    case BRCORNER:
        // C's set_corner macro and the vwall/hwall mode switches decide
        // between the wall and unseen stone.
        return simpleWallVisible(loc) ? loc.typ : STONE;
    case CROSSWALL:
        return projectedCrossWallType(loc);
    default:
        return loc.typ;
    }
}


// ---------------------------------------------------------------------------
// Object class symbols. C ref: drawing.c def_oc_syms[].
// ---------------------------------------------------------------------------

// C drawing.c:def_oc_syms, indexed by the object class from objclass.h.
export const OBJECT_CLASS_SYMBOLS = [
    '',
    ']',
    ')',
    '[',
    '=',
    '"',
    '(',
    '%',
    '!',
    '?',
    '+',
    '/',
    '$',
    '*',
    '`',
    '0',
    '_',
    '.',
];

// C drawing.c:def_oc_syms[].explain, in object-class order.
export const OBJECT_CLASS_EXPLAIN: readonly string[] = [
    '', 'strange object', 'weapon', 'suit or piece of armor', 'ring',
    'amulet', 'useful item (pick-axe, key, lamp...)', 'piece of food',
    'potion', 'scroll', 'spellbook', 'wand', 'pile of coins', 'gem or rock',
    'boulder or statue', 'iron ball', 'iron chain', 'splash of venom',
];

// C drawing.c:def_oc_syms[].name (defsym.h OBJCLASS names), used by
// detect.c:object_detect() to describe what was detected.
export const OBJECT_CLASS_NAMES: readonly string[] = [
    '', 'illegal objects', 'weapons', 'armor', 'rings', 'amulets', 'tools',
    'food', 'potions', 'scrolls', 'spellbooks', 'wands', 'coins', 'rocks',
    'large stones', 'iron balls', 'chains', 'venoms',
];

// C display.h:covers_objects()/covers_traps(); rm.h:CAN_OVERWRITE_TERRAIN().
// C display.h:covers_objects()/covers_traps(). Unlike is_lava(), the
// lava check here deliberately excludes lava beneath a raised bridge.
export function terrainCoversObjectsAt(x: number, y: number, state = game) {
    const type = state.level?.at(x, y)?.typ;
    return (isPoolAt(x, y, state) && !(state.underwater || state.u.uinwater))
        || type === LAVAPOOL || type === LAVAWALL;
}

// C rm.h:CAN_OVERWRITE_TERRAIN(). Explicit Lua map and feature writes
// have their own native rules and do not use this guard.
export function canOverwriteTerrain(type: number, state = game): boolean {
    return !!state.iflags.debug_overwrite_stairs || (type !== STAIRS && type !== LADDER);
}
