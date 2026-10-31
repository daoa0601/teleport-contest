// display.js — Map rendering and terminal output.
// C ref: display.c — newsym, show_glyph, docrt, cls, flush_screen.
import { pline_xy } from './pline.js';
import { clipToplineToColumn, decodeMixedTopline, flushPendingTopline } from './tty_topline.js';
import { game, requireGameLevel } from './gstate.js';
import { C_ATR_INVERSE, terminalAttrFromCAttr } from './color_attr.js';
import { monsterHasMapPosition, monsterAtPosition } from './monster_location.js';
import { redrawMonsterWormSegments } from './monster_worm.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { CmapSymbol, GlyphOffset, altarToGlyph, cmapToGlyph } from './glyph_numbers.js';
import { cmapToRogueColor } from './glyph_customizations.js';
import { cmapToType } from './mkroom.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { isIceAt, isPoolAt, isPoolOrLavaAt, terrainCoversObjectsAt } from './terrain_properties.js';
import { heroWarnsOfMonster } from './hero_species.js';
import { artifactWarningFeedback } from './artifact_warning.js';
import { currentAttribute } from './attrib.js';
import { currentHungerState } from './hunger.js';
import { statusTitle } from './status_title.js';
import { statusConditions } from './status_conditions.js';
import { renderStatusLine2 } from './status_layout.js';
import { armorStatus, weaponStatus } from './status_equipment.js';
import { statusVersion } from './status_version.js';
import { statusTerrain } from './status_terrain.js';
import { hitpointBar, hitpointBarFill } from './status_hitpoint_bar.js';
import { firstStatusLineSpans } from './status_highlighting.js';
import { criticallyLowHp } from './prayer_trouble.js';
import { cansee, couldsee, set_seenv, vision_recalc } from './vision.js';
import { describeMapLocation } from './lookaround.js';
import { glyphToCmapSymbol } from './getpos.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, ACCESSIBLE, BC_BALL, BC_CHAIN, COLNO, ROWNO, STONE, ROOM, CORR, SCORR, SDOOR, DOOR, STAIRS, FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, HI_ZAP, TREE, IRONBARS, POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, AIR, CLOUD, IS_POOL, IS_OBSTRUCTED, IS_ROOM, IS_WALL, LADDER, LA_DOWN, DBWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN, SV0, SV1, SV2, SV3, SV4, SV5, SV6, SV7, WM_X_TL, WM_X_TR, WM_X_BL, WM_X_BR, WM_X_TLBR, WM_X_BLTR, BEAR_TRAP, WEB, VIBRATING_SQUARE, CORPSTAT_GENDER, CORPSTAT_FEMALE, ENGRAVE, BURN, HEADSTONE, EXPL_FROSTY, EXPL_MAGICAL, EXPL_WET, EXPL_MUDDY, EXPL_NOXIOUS, EXPL_FIERY, is_pit, M_AP_NOTHING, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, def_warnsyms, MON_STILL_ARRIVING, In_endgame, In_quest, Is_rogue_level, Is_waterlevel, Is_knox_level, In_sokoban, MONSEEN_NORMAL, MONSEEN_SEEINVIS, MONSEEN_INFRAVIS, MONSEEN_TELEPAT, MONSEEN_XRAYVIS, MONSEEN_DETECT, MONSEEN_WARNMON, Upolyd, ismnum, BL_WEAPON, BL_ARMOR, BL_TERRAIN, } from './const.js';
import { NO_COLOR, ATR_INVERSE, CLR_BLACK, CLR_RED, CLR_GREEN, CLR_GRAY, CLR_BROWN, CLR_MAGENTA, CLR_CYAN, CLR_WHITE, CLR_YELLOW, CLR_BLUE, CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, DEC_TO_UNICODE, } from './terminal.js';
import { LARGE_BOX, CHEST, GOLD_PIECE, FOOD_RATION, CORPSE, TOWEL, STATUE, BOULDER, OBJECT_BASES, OBJECT_COLOR, } from './object_data.js';
import { MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM, monsterTypeName, } from './monster_data.js';
import { rn2, rn2Display } from './rng.js';
import { BOGUS_MONSTERS, BOGUS_MONSTER_FILE_SIZE, } from './random_text_data.js';
import { depth as dungeonDepth, endgameLevelName } from './hacklib.js';
import { OBJECT_CLASS_SYMBOLS, recordObjectEncounter } from './object_knowledge.js';
import { heroGoldAmount } from './hero_gold.js';
import { nearCapacity } from './weight.js';
import { heroCanReachFloor } from './floor_reach.js';
import { hasCarriedProperty, hasWornProperty, propertyIsActive } from './properties.js';
import { ATR_BLINK } from './terminal_attributes.js';
const HALLUCINATED_LIQUIDS = [
    'yoghurt', 'oobleck', 'clotted blood', 'diluted water',
    'purified water', 'instant coffee', 'tea', 'herbal infusion',
    'liquid rainbow', 'creamy foam', 'mulled wine', 'bouillon', 'nectar',
    'grog', 'flubber', 'ketchup', 'slow light', 'oil', 'vinaigrette',
    'liquid crystal', 'honey', 'caramel sauce', 'ink', 'aqueous humour',
    'milk substitute', 'fruit juice', 'glowing lava', 'gastric acid',
    'mineral water', 'cough syrup', 'quicksilver', 'sweet vitriol',
    'grey goo', 'pink slime', 'cosmic latte', 'bone oil', 'custard', 'lard',
    'vinegar', 'creosote',
];
export function displayLiquidName(fallback, state = game) {
    if ((!heroIsHallucinating(state) || state.program_state.gameover) && fallback)
        return fallback;
    // do_name.c:hliquid() includes a nonempty fallback as one additional slot.
    const index = rn2Display(HALLUCINATED_LIQUIDS.length + (fallback ? 1 : 0));
    return HALLUCINATED_LIQUIDS[index] ?? fallback;
}
// C drawing.c:def_r_oc_syms.  Rogue deliberately resembles the older game:
// armor uses ']', amulets ',', food ':', and coins share gems' '*'.
const ROGUE_OBJECT_SYMBOLS = ['', ']', ')', ']', '=', ',', '(', ':', '!', '?',
    '+', '/', '*', '*', '`', '0', '_', '.'];
const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];
function shownSymbolSet(state = game) {
    const rogue = Is_rogue_level(state.u?.uz, state);
    return state.shownSymbols ?? {
        rogue, name: (rogue ? state.rogueSymset : state.symset) ?? null,
    };
}
function usesDecSymbols() {
    const symbols = shownSymbolSet();
    return !symbols.rogue && /^DECgraphics$/i.test(symbols.name ?? '');
}
function activeObjectSymbols() {
    const shown = shownSymbolSet();
    if (!shown.rogue)
        return OBJECT_CLASS_SYMBOLS;
    if (shown.name) {
        const key = shown.name.toLowerCase();
        if (ROGUE_SYMSETS[key]?.blank)
            return BLANK_OBJECT_SYMBOLS;
        return ROGUE_SYMSET_OBJECT_TABLES[key] ?? ROGUE_OBJECT_SYMBOLS;
    }
    return ROGUE_OBJECT_SYMBOLS;
}
export function objectClassSymbol(index) {
    return activeObjectSymbols()[index] ?? '';
}
// symbols.c:get_othersym(SYM_BOULDER, which_set): the active set's override,
// else the default rock-class symbol.  optfn_boulder() fills both sets'
// overrides, while the BOULDER= statement (cfgfiles.c) only fills the
// primary one. A named primary selection can display that slot on Rogue.
export function currentBoulderSymbol(state = game) {
    if (shownSymbolSet(state).rogue) {
        const set = activeRogueSymset(state);
        return state.rogueBoulderSym
            || (set?.blank ? BLANK_SYMBOL : '`');
    }
    return state.boulderSym || '`';
}
const M3_INFRAVISIBLE = 0x0200;
const M1_MINDLESS = 0x00010000;
const TELEPATHY_RANGE = 8 * 8; // BOLT_LIM squared
const HELM_OF_TELEPATHY = 100;
const AMULET_OF_ESP = 201;
const PM_LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
export function unblindTelepathyRange() {
    const wornSources = [game.uarmh, game.uamul].filter(object => object
        && (object.otyp === HELM_OF_TELEPATHY
            || object.otyp === AMULET_OF_ESP)).length;
    const liveRange = wornSources * TELEPATHY_RANGE;
    const storedRange = game.u?.unblind_telepat_range ?? -1;
    return Math.max(liveRange || -1, storedRange);
}
export function senseWithTelepathy(monster) {
    if (!monster
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_MINDLESS))
        return false;
    if (game.blind && game.u.telepathy)
        return true;
    // C Unblind_telepat requires an extrinsic source even when worn.c counts
    // a wielded non-weapon telepathy object toward the cached range.
    if (!hasWornProperty('telepathy') && !hasCarriedProperty('telepathy'))
        return false;
    const range = unblindTelepathyRange();
    if (range < 0)
        return false;
    const dx = monster.mx - game.u.ux;
    const dy = monster.my - game.u.uy;
    return dx * dx + dy * dy <= range;
}
// C mon_visible(): this does not check the square or sensory detection.
export function monsterVisible(monster, state = game) {
    const seesInvisible = !!(state.u.seeInvisible
        || (state.u.seeInvisibleTurns ?? 0) > 0);
    return (!monster.minvis || seesInvisible) && !monster.mundetected;
}
export function seeMonsterWithInfrared(monster) {
    return !game.blind && !!game.u?.infravision
        && !!((MONSTER_FLAGS3[monster.mnum] ?? 0) & M3_INFRAVISIBLE)
        && couldsee(monster.mx, monster.my);
}
function canPhysicallyProjectMonster(monster, x, y) {
    return monsterVisible(monster) && (cansee(x, y) || seeMonsterWithInfrared(monster));
}
// C worm.c:worm_known(). A head-only relocation leaves the hidden segment
// behind until worm_move() or place_wsegs() updates it.
export function wormKnown(monster) {
    const head = monster.wormHead;
    return !!head && cansee(head.x, head.y)
        || (monster.wormSegments ?? []).some(segment => segment.x && cansee(segment.x, segment.y));
}
// C mon.c:monkilled(). Its death line is square-visible or worm-known,
// independently of whether the actor can be identified.
export function monsterKillLineVisible(monster) {
    return monster.wormno ? wormKnown(monster) : cansee(monster.mx, monster.my);
}
// C display.h:canseemon(), an actor-level optical sight query.
export function canSeeMonster(monster) {
    return monster.wormno ? wormKnown(monster) && monsterVisible(monster)
        : canPhysicallyProjectMonster(monster, monster.mx, monster.my);
}
// C vision.c:howmonseen(). Direct sight matters to effects such as mirrors;
// detecting an actor does not imply that either creature can see a reflection.
export function howMonsterSeen(monster) {
    const visible = canSeeMonster(monster);
    const hero = game.u;
    let ways = 0;
    if ((monster.wormno ? wormKnown(monster)
        : cansee(monster.mx, monster.my) && couldsee(monster.mx, monster.my))
        && monsterVisible(monster) && !monster.minvis)
        ways |= MONSEEN_NORMAL;
    if (visible && monster.minvis)
        ways |= MONSEEN_SEEINVIS;
    const seesInvisible = hero.seeInvisible || (hero.seeInvisibleTurns ?? 0) > 0;
    if ((!monster.minvis || seesInvisible) && seeMonsterWithInfrared(monster))
        ways |= MONSEEN_INFRAVIS;
    if (senseWithTelepathy(monster))
        ways |= MONSEEN_TELEPAT;
    const range = hero.xray_range ?? -1;
    if (visible && range > 0
        && (monster.mx - hero.ux) ** 2 + (monster.my - hero.uy) ** 2 <= range ** 2)
        ways |= MONSEEN_XRAYVIS;
    if (heroDetectsMonsters())
        ways |= MONSEEN_DETECT;
    if (heroWarnsOfMonster(monster))
        ways |= MONSEEN_WARNMON;
    return ways;
}
function isWormTail(monster, x, y) {
    return !!monster?.wormno && (x !== monster.mx || y !== monster.my);
}
function monsterProjectionAtCell(monster, x, y) {
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
export function canSenseMonster(monster) {
    if (!monster)
        return false;
    if ((game.u?.uswallow || game.uswallow)
        && game.u?.ustuck !== monster)
        return false;
    if (game.u?.uinwater || game.underwater) {
        const distance = (monster.mx - game.u.ux) ** 2
            + (monster.my - game.u.uy) ** 2;
        if (distance > 2 || !isPoolAt(monster.mx, monster.my))
            return false;
    }
    return senseWithTelepathy(monster)
        || heroWarnsOfMonster(monster)
        || heroDetectsMonsters();
}
// C display.h:canspotmon(). Seeing or sensing any part identifies the actor.
// Per-cell projection can still hide its head or other segments.
// Ordinary Warning does not identify the monster.
export function canSpotMonster(monster) {
    return !!monster && (canSeeMonster(monster) || canSenseMonster(monster));
}
export function monsterHasWarningProjection(monster) {
    if (!monster || !game.u?.warning || monster.mpeaceful)
        return null;
    const dx = monster.mx - game.u.ux, dy = monster.my - game.u.uy;
    if (dx * dx + dy * dy >= 100)
        return null;
    const level = Math.min(def_warnsyms.length - 1, Math.trunc((monster.m_lev ?? 0) / 4));
    return level >= (game.context?.warnlevel ?? 1);
}
function warningProjection(monster) {
    if (!monster || !monsterHasWarningProjection(monster))
        return null;
    const level = heroIsHallucinating()
        ? rn2Display(def_warnsyms.length - 1) + 1
        : Math.min(def_warnsyms.length - 1, Math.trunc((monster.m_lev ?? 0) / 4));
    // The map reads showsyms[SYM_OFF_W+n], which symset loading initializes
    // from def_warnsyms; WARNINGS=/warnings: only retarget the pager lookup.
    const warning = def_warnsyms[level];
    return warning ? { ...warning, glyph: GlyphOffset.warning + level } : null;
}
export function objectUsesGenericGlyph(object) {
    if (!object || object.dknown)
        return false;
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
    // STRANGE_OBJECT lies outside C's generic glyph range, so a mimic's
    // zero-class disguise cannot become a known object at close range.
    if (!generic || object.oclass === 0)
        return false;
    const range = Math.max(game.u?.xray_range ?? -1, 2);
    const dx = x - game.u.ux, dy = y - game.u.uy;
    const nearDistance = range * range * 2 - range;
    if (dx * dx + dy * dy > nearDistance)
        return false;
    if (heroIsHallucinating(game))
        return false;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
    return true;
}
// C display.c:see_nearby_objects(), called by dungeon.c:u_on_newpos().  A
// generic object can remain continuously visible while the hero crosses the
// close-observation boundary, so visibility transitions alone cannot own its
// repaint.
// C display.h:glyph_is_generic_object(). Generic object numbers are the
// class slots below MAXOCLASSES; zero is the strange object, not a class.
const MAX_OBJECT_CLASSES = 18;
function rememberedGenericObject(glyph) {
    return glyph?.kind === 'object' && !glyph.statueGlyph
        && glyph.otyp > 0 && glyph.otyp < MAX_OBJECT_CLASSES;
}
export async function see_nearby_objects() {
    const r = Math.max(game.u?.xray_range ?? -1, 2);
    const nearDistance = r * r * 2 - r;
    for (let y = (game.u?.uy ?? 0) - r; y <= (game.u?.uy ?? 0) + r; y++) {
        for (let x = (game.u?.ux ?? 0) - r; x <= (game.u?.ux ?? 0) + r; x++) {
            const object = game.level?.objects?.[x]?.[y]?.[0];
            if (!object || object.dknown || !cansee(x, y))
                continue;
            const dx = x - game.u.ux, dy = y - game.u.uy;
            if (dx * dx + dy * dy > nearDistance)
                continue;
            // Unlike map_object(), display.c:see_nearby_objects() observes
            // every visible object inside the close-name radius.  Only the
            // repaint is conditional, and it tests the remembered glyph: an
            // object first seen under a monster may not be remembered at all.
            if (heroIsHallucinating(game))
                continue;
            object.dknown = true;
            recordObjectEncounter(object.otyp);
            if (rememberedGenericObject(game.level?.at(x, y)?.remembered_glyph))
                await newsym_force(x, y);
        }
    }
}
export function objectColor(object) {
    if (typeof object.color === 'number' && Number.isInteger(object.color))
        return object.color;
    // C obj_is_generic(): hide potion/gem/spellbook appearance until the
    // hero has observed it closely enough. Generic class rows are indexed by
    // oclass and deliberately use the ordinary gray tty foreground.
    if (objectUsesGenericGlyph(object))
        return OBJECT_COLOR[object.oclass] ?? CLR_GRAY;
    // C obj_to_glyph(): a corpse keeps the depicted monster's color; it is
    // not colored as a generic food-class object.
    if (object?.otyp === CORPSE && typeof object.corpsenm === 'number' && Number.isInteger(object.corpsenm))
        return MONSTER_COLOR[object.corpsenm] ?? CLR_BROWN;
    if (object?.otyp === TOWEL)
        return CLR_MAGENTA;
    if (object?.otyp === LARGE_BOX || object?.otyp === CHEST)
        return CLR_BROWN;
    if (object?.otyp === FOOD_RATION)
        return CLR_BROWN;
    if (object?.otyp === GOLD_PIECE)
        return CLR_YELLOW;
    const metadataColor = game.objectColors?.[object?.otyp]
        ?? OBJECT_COLOR[object?.otyp];
    return typeof metadataColor === 'number' && Number.isInteger(metadataColor)
        ? metadataColor : CLR_GRAY;
}
// ── ANSI color codes ──
// Maps CLR_* constants (0-15) to ANSI SGR color codes.
// C ref: wintty.c term_start_color
const ANSI_DEFAULT = 39;
const ANSI_COLOR = [
    90, // CLR_BLACK     0 → tty dark gray when wc2_darkgray is enabled
    31, // CLR_RED       1
    32, // CLR_GREEN     2
    33, // CLR_BROWN     3
    34, // CLR_BLUE      4
    35, // CLR_MAGENTA   5
    36, // CLR_CYAN      6
    39, // CLR_GRAY      7 → tty's ordinary foreground
    39, // NO_COLOR      8 → default
    91, // CLR_ORANGE    9
    92, // CLR_BRIGHT_GREEN  10
    93, // CLR_YELLOW    11
    94, // CLR_BRIGHT_BLUE   12
    95, // CLR_BRIGHT_MAGENTA 13
    96, // CLR_BRIGHT_CYAN   14
    97, // CLR_WHITE     15
    90, // remembered room/corridor while blind (tty dark gray)
];
// C display.c:newsym(): only remembered room and corridor terrain changes
// when it leaves sight. Objects, traps, and engravings retain their glyphs.
function rememberedGlyph(glyph, loc, x, y) {
    if (glyph.kind !== 'terrain' || cansee(x, y))
        return glyph;
    const rogue = Is_rogue_level(game.u.uz);
    const darkRoom = !rogue && (game.flags.dark_room ?? true) && game.flags.color !== false;
    if (loc.typ === CORR && glyph.glyph === cmapToGlyph(CmapSymbol.litcorr)
        && (rogue || !loc.waslit || darkRoom)) {
        // lookat() names the square from the downgraded glyph number.
        return { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr),
            terrainName: 'corridor' };
    }
    if (loc.typ !== ROOM || glyph.glyph !== cmapToGlyph(CmapSymbol.room)
        || loc.waslit && !darkRoom)
        return glyph;
    if (rogue) {
        return { ch: ' ', color: NO_COLOR, decgfx: false, kind: 'terrain',
            terrainName: 'stone', glyph: cmapToGlyph(CmapSymbol.stone) };
    }
    return { ...glyph, ch: darkRoom ? glyph.ch : ' ',
        color: darkRoom ? 16 : NO_COLOR, decgfx: darkRoom && !!glyph.decgfx,
        terrainName: 'dark part of a room', glyph: cmapToGlyph(CmapSymbol.darkroom) };
}
async function showRememberedLocation(x, y, loc) {
    const memory = loc.remembered_glyph;
    if (!memory)
        return;
    const glyph = rememberedGlyph(memory, loc, x, y);
    loc.remembered_glyph = glyph;
    await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, objectGlyphAttr(glyph), glyph);
}
// C display.c:reglyph_darkroom(). Option changes convert stored floor glyphs
// before docrt() displays memory; ordinary redraws must leave memory alone.
export function reglyph_darkroom() {
    if (!game.level)
        return;
    const darkRoom = game.flags.dark_room ?? true;
    const showDarkFloor = darkRoom && game.flags.color !== false
        && !Is_rogue_level(game.u.uz);
    const dec = usesDecSymbols();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            const memory = loc?.remembered_glyph;
            if (!loc || !memory)
                continue;
            if (!darkRoom && loc.waslit && memory.glyph === cmapToGlyph(CmapSymbol.corr)) {
                loc.remembered_glyph = { ...memory, color: CLR_WHITE,
                    glyph: cmapToGlyph(CmapSymbol.litcorr),
                    kind: 'terrain', terrainName: 'lit corridor' };
            }
            else if (darkRoom && !cansee(x, y)
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
            }
            else if (memory.glyph === cmapToGlyph(CmapSymbol.darkroom)
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
// symbols.c:switch_symbols()/assign_graphics() keep every glyph number and
// let doredraw() resolve characters again; mirror that for the map memory,
// which stores its character. Object classes differ on Rogue, and terrain
// characters and branch wall colors also depend on the selected set.
export function reglyphSymbolSet() {
    if (!game.level)
        return;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            const memory = loc?.remembered_glyph;
            if (!loc || !memory)
                continue;
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
                || typeof glyphNumber !== 'number')
                continue;
            const index = rememberedTerrainIndex(glyphNumber);
            if (index === null)
                continue;
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
                if (BRANCH_WALL_COLOR_SYMSETS.test(game.symset ?? ''))
                    color = decWallColors.get(offset) ?? memory.color;
                else if ([CLR_BROWN, CLR_RED, CLR_YELLOW, CLR_BLUE].includes(memory.color))
                    color = NO_COLOR;
            }
            loc.remembered_glyph = { ...memory, ch: appearance.ch,
                color: color ?? memory.color, decgfx: appearance.dec };
        }
    }
}
// optfn_boulder() refreshes showsyms[SYM_BOULDER] mid-game and doredraw()
// repaints every boulder through it, so already-displayed boulders adopt
// the new symbol immediately.
export function reglyphBoulderSymbols() {
    if (!game.level)
        return;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            const memory = loc?.remembered_glyph;
            if (!loc || !memory || memory.kind !== 'object' || memory.otyp !== BOULDER)
                continue;
            loc.remembered_glyph = { ...memory, ch: currentBoulderSymbol() };
        }
    }
}
// glyphs.c:glyph_to_cmap() restricted to the terrain memory can hold; trap,
// beam, and effect glyphs keep set-independent characters.
function rememberedTerrainIndex(glyph) {
    if (glyph === GlyphOffset.cmapStone)
        return CmapSymbol.stone;
    if (glyph >= GlyphOffset.cmapMain && glyph < GlyphOffset.cmapA)
        return (glyph - GlyphOffset.cmapMain) % (CmapSymbol.trwall - CmapSymbol.vwall + 1) + CmapSymbol.vwall;
    if (glyph >= GlyphOffset.cmapA && glyph < GlyphOffset.altar)
        return glyph - GlyphOffset.cmapA + CmapSymbol.ndoor;
    if (glyph >= GlyphOffset.altar && glyph < GlyphOffset.cmapB)
        return CmapSymbol.altar;
    if (glyph >= GlyphOffset.cmapB && glyph < GlyphOffset.zap) {
        const index = glyph - GlyphOffset.cmapB + CmapSymbol.grave;
        // The range continues into trap glyphs, which have no
        // dungeon-symbol table entry and set-independent characters.
        return index < CmapSymbol.arrowTrap ? index : null;
    }
    return null;
}
function roomMemoryGlyph(dark, dec) {
    return {
        ch: dec ? '~' : '.', color: dark ? 16 : NO_COLOR, decgfx: dec,
        kind: 'terrain', terrainName: dark ? 'dark part of a room' : 'floor of a room',
        glyph: cmapToGlyph(dark ? CmapSymbol.darkroom : CmapSymbol.room),
    };
}
function stairGlyphIndex(loc, x, y) {
    // C display.c:back_to_cmap(). Direction belongs to the terrain cell;
    // the traversed stairway determines whether its branch is known.
    let stair = game.stairs;
    while (stair && (stair.sx !== x || stair.sy !== y))
        stair = stair.next;
    const currentDungeon = game.u?.uz?.dnum ?? 0;
    const knownBranch = stair?.u_traversed
        && stair?.tolev?.dnum !== undefined
        && stair.tolev.dnum !== currentDungeon;
    return (knownBranch ? 29 : 25)
        + (loc.typ === LADDER ? 2 : 0) + (((loc.ladder ?? 0) & LA_DOWN) ? 1 : 0);
}
function stairSymbol(loc, x, y) {
    const index = stairGlyphIndex(loc, x, y);
    const symbol = MAP_SYMBOLS[index];
    if (!symbol)
        throw new RangeError(`Missing stair symbol ${index} at (${x}, ${y})`);
    return symbol;
}
// C ref: display.c wall_angle(), straight-wall and corner cases.  A room's
// unfinished exterior face is stored in the low three wall_info bits.  Seen
// vectors which only approach from that rock side project unexplored stone,
// not the nominal line-drawing wall.
function simpleWallVisible(loc) {
    const seenv = (loc.seenv || 0) & 0xff;
    const mode = (loc.wall_info || 0) & 0x07;
    if (!seenv)
        return false;
    switch (loc.typ) {
        case SDOOR:
            if (!loc.horizontal) {
                if (mode === 1)
                    return !!(seenv & (SV1 | SV2 | SV3 | SV4 | SV5));
                if (mode === 2)
                    return !!(seenv & (SV0 | SV1 | SV5 | SV6 | SV7));
            }
            else {
                if (mode === 1)
                    return !!(seenv & (SV3 | SV4 | SV5 | SV6 | SV7));
                if (mode === 2)
                    return !!(seenv & (SV0 | SV1 | SV2 | SV3 | SV7));
            }
            return true;
        case VWALL:
            if (mode === 1)
                return !!(seenv & (SV1 | SV2 | SV3 | SV4 | SV5));
            if (mode === 2)
                return !!(seenv & (SV0 | SV1 | SV5 | SV6 | SV7));
            return true;
        case HWALL:
            if (mode === 1)
                return !!(seenv & (SV3 | SV4 | SV5 | SV6 | SV7));
            if (mode === 2)
                return !!(seenv & (SV0 | SV1 | SV2 | SV3 | SV7));
            return true;
        case TLCORNER:
            if (mode === 1)
                return !!(seenv & (SV3 | SV4 | SV5));
            if (mode === 2)
                return !!(seenv & ~SV4);
            return true;
        case TRCORNER:
            if (mode === 1)
                return !!(seenv & (SV5 | SV6 | SV7));
            if (mode === 2)
                return !!(seenv & ~SV6);
            return true;
        case BLCORNER:
            if (mode === 1)
                return !!(seenv & (SV1 | SV2 | SV3));
            if (mode === 2)
                return !!(seenv & ~SV2);
            return true;
        case BRCORNER:
            if (mode === 1)
                return !!(seenv & (SV7 | SV0 | SV1));
            if (mode === 2)
                return !!(seenv & ~SV0);
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
    const only = (bits) => !!(seenv & bits) && !(seenv & ~bits);
    const mode = (loc.wall_info || 0) & 0x07;
    let column = 0;
    if (mode === 0) {
        if (seenv === SV4)
            column = 1;
        else if (seenv === SV6)
            column = 2;
        else if (seenv & (SV3 | SV5 | SV7)
            || ((seenv & SV4) && (seenv & SV6)))
            column = 4;
        else if (seenv & (SV0 | SV1 | SV2))
            column = seenv & (SV4 | SV6) ? 4 : 3;
    }
    else if (mode === 1) {
        if ((seenv & (SV3 | SV4)) && !(seenv & (SV5 | SV6 | SV7)))
            column = 1;
        else if ((seenv & (SV6 | SV7)) && !(seenv & (SV3 | SV4 | SV5)))
            column = 2;
        else if ((seenv & SV5)
            || ((seenv & (SV3 | SV4)) && (seenv & (SV6 | SV7))))
            column = 4;
    }
    else if (mode === 2) {
        if (only(SV4 | SV5))
            column = 1;
        else if ((seenv & (SV0 | SV1 | SV2 | SV7))
            && !(seenv & (SV3 | SV4 | SV5)))
            column = 3;
        else if (!only(SV6))
            column = 4;
    }
    else if (mode === 3) {
        if (only(SV5 | SV6))
            column = 2;
        else if ((seenv & (SV0 | SV1 | SV2 | SV3))
            && !(seenv & (SV5 | SV6 | SV7)))
            column = 3;
        else if (!only(SV4))
            column = 4;
    }
    return row[column];
}
// C display.c:wall_angle() CROSSWALL case.  Cross-wall topology is stable,
// but its visible glyph is the subset of arms approached by the hero.  The
// wall mode additionally records which quadrant(s) remain unfinished rock.
function projectedCrossWallType(loc) {
    let seenv = (loc.seenv || 0) & 0xff;
    const mode = (loc.wall_info || 0) & 0x07;
    const only = (bits) => !(seenv & ~bits);
    if (mode === 0) {
        if (seenv === SV0)
            return BRCORNER;
        if (seenv === SV2)
            return BLCORNER;
        if (seenv === SV4)
            return TLCORNER;
        if (seenv === SV6)
            return TRCORNER;
        if (!(seenv & ~(SV0 | SV1 | SV2))
            && ((seenv & SV1) || seenv === (SV0 | SV2)))
            return TUWALL;
        if (!(seenv & ~(SV2 | SV3 | SV4))
            && ((seenv & SV3) || seenv === (SV2 | SV4)))
            return TRWALL;
        if (!(seenv & ~(SV4 | SV5 | SV6))
            && ((seenv & SV5) || seenv === (SV4 | SV6)))
            return TDWALL;
        if (!(seenv & ~(SV0 | SV6 | SV7))
            && ((seenv & SV7) || seenv === (SV0 | SV6)))
            return TLWALL;
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
    }
    else if (mode === WM_X_TR) {
        row = rows.tr;
        seenv = ((seenv >> 6) | (seenv << 2)) & 0xff;
    }
    else if (mode === WM_X_BL) {
        row = rows.bl;
        seenv = ((seenv >> 2) | (seenv << 6)) & 0xff;
    }
    else if (mode === WM_X_BR) {
        row = rows.br;
    }
    if (row) {
        if (seenv === SV4)
            return STONE;
        seenv &= ~SV4;
        let column;
        if (seenv === SV0)
            column = 1;
        else if (seenv & (SV2 | SV3)) {
            if (seenv & (SV5 | SV6 | SV7))
                column = 5;
            else if (seenv & (SV0 | SV1))
                column = 4;
            else
                column = 2;
        }
        else if (seenv & (SV5 | SV6)) {
            if (seenv & (SV1 | SV2 | SV3))
                column = 5;
            else if (seenv & (SV0 | SV7))
                column = 3;
            else
                column = 0;
        }
        else if (seenv & SV1)
            column = seenv & SV7 ? 5 : 4;
        else if (seenv & SV7)
            column = seenv & SV1 ? 5 : 3;
        else
            column = 5;
        return row[column];
    }
    if (mode === WM_X_TLBR) {
        if (only(SV1 | SV2 | SV3))
            return BLCORNER;
        if (only(SV5 | SV6 | SV7))
            return TRCORNER;
        if (only(SV0 | SV4))
            return STONE;
        return CROSSWALL;
    }
    if (mode === WM_X_BLTR) {
        if (only(SV0 | SV1 | SV7))
            return BRCORNER;
        if (only(SV3 | SV4 | SV5))
            return TLCORNER;
        if (only(SV2 | SV6))
            return STONE;
        return CROSSWALL;
    }
    return STONE;
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
function terrainGlyphName(loc, x, y, glyph) {
    if (isArborealBackground(loc))
        return 'tree';
    if (loc.typ === DBWALL)
        return 'raised drawbridge';
    if (IS_WALL(loc.typ) || loc.typ === SDOOR)
        return glyph.ch === ' ' ? 'stone' : 'wall';
    if (loc.typ === DOOR) {
        if (!loc.doormask || loc.doormask & D_BROKEN)
            return 'doorway';
        if (loc.doormask & D_ISOPEN)
            return 'open door';
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
export function terrain_glyph(loc, x, y) {
    const appearance = terrainGlyphAppearance(loc, x, y);
    const typ = projectedTerrainType(loc);
    const symbol = terrainSymbolIndex(loc, x, y, typ, appearance);
    return {
        ...appearance, kind: 'terrain', terrainName: terrainGlyphName(loc, x, y, appearance),
        glyph: typ === ALTAR ? altarToGlyph(loc.flags) : cmapToGlyph(symbol, currentWallGlyphOffset()),
    };
}
// display.h:cmap_walls_to_glyph() applies to both real walls and disguises.
function currentWallGlyphOffset() {
    const branch = game.dungeons[game.u.uz?.dnum ?? 0];
    return branch?.dname === 'The Gnomish Mines' ? GlyphOffset.cmapMines
        : branch?.flags.hellish ? GlyphOffset.cmapGehennom
            : Is_knox_level(game.u.uz) ? GlyphOffset.cmapKnox
                : In_sokoban(game.u.uz) ? GlyphOffset.cmapSokoban : GlyphOffset.cmapMain;
}
function terrainSymbolIndex(loc, x, y, typ, appearance) {
    if ((IS_WALL(typ) && typ !== DBWALL) || typ === SDOOR) {
        if (appearance.ch === ' ')
            return CmapSymbol.stone;
        if (typ === SDOOR)
            return loc.horizontal ? CmapSymbol.hwall : CmapSymbol.vwall;
        return typ;
    }
    if (typ === DOOR) {
        if (!loc.doormask || (loc.doormask & D_BROKEN))
            return CmapSymbol.ndoor;
        if (loc.doormask & D_ISOPEN)
            return loc.horizontal ? CmapSymbol.hodoor : CmapSymbol.vodoor;
        return loc.horizontal ? CmapSymbol.hcdoor : CmapSymbol.vcdoor;
    }
    if (typ === STAIRS || typ === LADDER)
        return stairGlyphIndex(loc, x, y);
    if (typ === CORR)
        return loc.waslit || game.flags.lit_corridor
            ? CmapSymbol.litcorr : CmapSymbol.corr;
    if (typ === DBWALL)
        return loc.horizontal ? CmapSymbol.hcdbridge : CmapSymbol.vcdbridge;
    if (typ === DRAWBRIDGE_DOWN)
        return loc.horizontal ? CmapSymbol.hodbridge : CmapSymbol.vodbridge;
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
function projectedTerrainType(loc) {
    // back_to_glyph() shows the exposed surface under a raised bridge.
    // db_under_typ() uses STONE for dry ground, but its map symbol is room.
    if (loc.typ === DRAWBRIDGE_UP) {
        const surface = drawbridgeUnderlyingType(loc.drawbridgemask ?? 0);
        return surface === STONE ? ROOM : surface;
    }
    if (isArborealBackground(loc))
        return TREE;
    if ((IS_WALL(loc.typ) && loc.typ !== DBWALL || loc.typ === SDOOR)
        && !loc.seenv)
        return STONE;
    if (loc.typ === CROSSWALL)
        return projectedCrossWallType(loc);
    return projectedTWallType(loc);
}
function terrainGlyphAppearance(loc, x, y) {
    const appearance = terrainGlyphChars(loc, x, y);
    if (!shownSymbolSet().rogue)
        return appearance;
    // Every terrain character resolves through the displayed rogue set's
    // table layered over the base rogue symbols (showsyms[] after
    // assign_graphics(ROGUESET)): rooms, corridors, unseen-wall stone and
    // everything Blank replaces included.  show_glyph_cell() applies the
    // Rogue color rules at paint time.
    const index = terrainSymbolIndex(loc, x, y, projectedTerrainType(loc), appearance);
    return { ...cmapSymbolAppearance(index), color: NO_COLOR };
}
function terrainGlyphChars(loc, x, y) {
    const typ = projectedTerrainType(loc);
    const rogue = Is_rogue_level(game.u?.uz);
    const dec = usesDecSymbols();
    // symbols.c:load_symset() applies these sets' G_ wall colors independently
    // of character handling; the default set leaves wallcolors[] gray.
    const hasBranchWallColors = BRANCH_WALL_COLOR_SYMSETS.test(game.symset ?? '');
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
        case STONE: return { ch: ' ', color: NO_COLOR, dec: false };
        case SCORR: return { ch: ' ', color: NO_COLOR, dec: false };
        case ROOM: return dec
            ? { ch: '~', color: NO_COLOR, dec: true }
            : { ch: '.', color: NO_COLOR, dec: false };
        case ICE: return dec
            ? { ch: '~', color: CLR_CYAN, dec: true }
            : { ch: '.', color: CLR_CYAN, dec: false };
        case DRAWBRIDGE_DOWN: return dec
            ? { ch: '~', color: CLR_BROWN, dec: true }
            : { ch: '.', color: CLR_BROWN, dec: false };
        case DBWALL: return { ch: '#', color: CLR_BROWN, dec: false };
        // C back_to_glyph(): newsym() records lighting before choosing this glyph.
        // tty renders that CLR_GRAY symbol with its bright foreground treatment;
        // CLR_WHITE is the equivalent serialized color in this port.
        case CORR: return {
            ch: '#',
            color: loc.waslit || game.flags?.lit_corridor ? CLR_WHITE : NO_COLOR,
            dec: false,
        };
        case SDOOR:
            if (!simpleWallVisible(loc))
                return { ch: ' ', color: NO_COLOR, dec: false };
            if (!dec)
                return loc.horizontal
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
        case FOUNTAIN: return { ch: '{', color: CLR_BRIGHT_BLUE, dec: false };
        case THRONE: return { ch: '\\', color: CLR_YELLOW, dec: false };
        case SINK: return { ch: '{', color: CLR_WHITE, dec: false };
        case GRAVE: return { ch: '|', color: CLR_WHITE, dec: false };
        case ALTAR: {
            // reset_glyphmap() colors the selected altar glyph; shrine status
            // does not change alignment, while sanctum status selects "other".
            const altar = altarToGlyph(loc.flags) - GlyphOffset.altar;
            const color = altar === 4 ? CLR_BRIGHT_MAGENTA : altar === 0 ? CLR_RED : NO_COLOR;
            return dec
                ? { ch: '{', color, dec: true }
                : { ch: '_', color, dec: false };
        }
        case TREE: return dec
            ? { ch: 'g', color: CLR_GREEN, dec: true }
            : { ch: '#', color: CLR_GREEN, dec: false };
        case IRONBARS: return dec
            ? { ch: '|', color: CLR_CYAN, dec: true }
            : { ch: '#', color: CLR_CYAN, dec: false };
        case POOL:
        case MOAT: return dec
            ? { ch: '`', color: CLR_BLUE, dec: true }
            : { ch: '}', color: CLR_BLUE, dec: false };
        case WATER: return dec
            ? { ch: '`', color: CLR_BRIGHT_BLUE, dec: true }
            : { ch: '}', color: CLR_BRIGHT_BLUE, dec: false };
        case LAVAPOOL: return dec
            ? { ch: '`', color: CLR_RED, dec: true }
            : { ch: '}', color: CLR_RED, dec: false };
        case LAVAWALL: return dec
            ? { ch: '`', color: CLR_ORANGE, dec: true }
            : { ch: '}', color: CLR_ORANGE, dec: false };
        case AIR: return { ch: ' ', color: CLR_CYAN, dec: false };
        case CLOUD: return { ch: '#', color: CLR_GRAY, dec: false };
        // Wall types → DEC line-drawing characters
        case HWALL:
            if (!simpleWallVisible(loc))
                return { ch: ' ', color: NO_COLOR, dec: false };
            return dec ? { ch: 'q', color: wallColor, dec: true } : { ch: '-', color: wallColor, dec: false };
        case VWALL:
            if (!simpleWallVisible(loc))
                return { ch: ' ', color: NO_COLOR, dec: false };
            return dec ? { ch: 'x', color: wallColor, dec: true } : { ch: '|', color: wallColor, dec: false };
        case TLCORNER:
        case TRCORNER:
        case BLCORNER:
        case BRCORNER:
            if (!simpleWallVisible(loc))
                return { ch: ' ', color: NO_COLOR, dec: false };
            return dec ? { ch: ({ [TLCORNER]: 'l', [TRCORNER]: 'k', [BLCORNER]: 'm', [BRCORNER]: 'j' })[typ], color: wallColor, dec: true } : { ch: '-', color: wallColor, dec: false };
        case CROSSWALL:
        case TUWALL:
        case TDWALL: return dec ? {
            ch: ({ [CROSSWALL]: 'n', [TUWALL]: 'v', [TDWALL]: 'w' })[typ],
            color: wallColor,
            dec: true,
        } : { ch: '-', color: wallColor, dec: false };
        case TLWALL:
        case TRWALL: return dec ? {
            ch: ({ [TLWALL]: 'u', [TRWALL]: 't' })[typ],
            color: wallColor,
            dec: true,
        } : { ch: '|', color: wallColor, dec: false };
        default: return { ch: '?', color: NO_COLOR, dec: false };
    }
}
// C back_to_glyph(): forest rock and forest secret doors share the tree
// projection, including its terrain name for touch and obstacle messages.
function isArborealBackground(loc) {
    return ((loc.typ === STONE || loc.typ === SCORR) && !!game.level?.flags.arboreal)
        || (loc.typ === SDOOR && !!loc.arboreal_sdoor);
}
function objectIsPiletop(object) {
    if (object.ox === undefined || object.oy === undefined)
        return false;
    const pile = game.level?.objects?.[object.ox]?.[object.oy];
    return Array.isArray(pile) && pile[0] === object && pile.length > 1
        && (object.otyp !== BOULDER || pile[1]?.otyp === BOULDER);
}
function objectGlyphAttr(glyph) {
    const useInverse = game.flags?.use_inverse !== false
        && game.iflags?.wc_inverse !== false
        && game.iflags?.use_inverse !== false;
    return glyph.kind === 'object' && glyph.piletop && game.flags?.hilite_pile && useInverse
        ? ATR_INVERSE : 0;
}
function displayMonsterGlyph(mnum, female = false, monsterState = 'normal') {
    const rawColor = MONSTER_COLOR[mnum] ?? CLR_GRAY;
    return {
        ch: monsterClassSymbol(MONSTER_SYMBOL[mnum] ?? 0) || '?',
        // tty has no hilite for ordinary gray; black is dark gray (use_darkgray).
        color: rawColor === CLR_GRAY ? NO_COLOR : rawColor,
        decgfx: false, kind: 'monster', mnum, piletop: false,
        glyph: monsterGlyphNumber(mnum, female, monsterState),
    };
}
function monsterGlyphNumber(mnum, female, state) {
    const offset = state === 'pet' ? GlyphOffset.petMale
        : state === 'detected' ? GlyphOffset.detectMale
            : state === 'ridden' ? GlyphOffset.riddenMale : GlyphOffset.monMale;
    return offset + mnum + (female ? MONSTER_COLOR.length : 0);
}
function heroDisplayGlyph() {
    if (game.u?.m_ap_type === M_AP_OBJECT)
        return apparentObjectGlyph(game.u);
    if (game.u.m_ap_type === M_AP_MONSTER) {
        const appearance = game.u.mappearance;
        if (!ismnum(appearance))
            throw new Error('Hero monster disguise requires a valid species');
        return displayMonsterGlyph(appearance, Upolyd(game.u) ? !!game.u.mfemale : !!game.flags.female);
    }
    if (game.u.m_ap_type === M_AP_FURNITURE) {
        const appearance = game.u.mappearance;
        if (appearance === undefined)
            throw new Error('Hero furniture disguise requires a map symbol');
        return furnitureDisplayGlyph(appearance);
    }
    // display.h:hero_glyph and you.h:Ugender select the current body's sex.
    // Hero glyph identity still changes when the tty symbol remains '@'.
    const polymorphed = Upolyd(game.u);
    const mnum = polymorphed || !game.flags.showrace
        ? game.u.umonnum : game.urace?.mnum;
    if (!ismnum(mnum))
        throw new Error('Hero glyph requires an initialized species');
    const glyph = displayMonsterGlyph(mnum, polymorphed ? !!game.u.mfemale : !!game.flags.female);
    return polymorphed ? glyph
        : { ...glyph, ch: game.flags.showrace ? glyph.ch
                : monsterClassSymbol(HUMAN_CLASS_INDEX) || '@', color: CLR_WHITE };
}
// symbols.c:init_rogue_symbols() changes ordinary stairs and open doorways.
// Branch stairs retain their default symbols.
const rogueFurnitureSymbols = new Map([
    [CmapSymbol.ndoor, '+'], [CmapSymbol.vodoor, '+'], [CmapSymbol.hodoor, '+'],
    [CmapSymbol.upstair, '%'], [CmapSymbol.dnstair, '%'],
]);
const ROGUE_DOUBLE_WALLS = new Map([
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
const IBM_COMMON_SYMBOLS = new Map([
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
const ROGUE_SYMSETS = {
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
            ...['@', '&', '*', '#'].map((ch, index) => [CmapSymbol.shieldFirst + index, ch]),
            ...['\xf4', '\xf5', '\xf6', '\xf7', '\xef', '\xf8', '\xf9', '\xfa']
                .map((ch, index) => [CmapSymbol.swallowTopLeft + index, ch]),
            ...['\xe6', '\xea', '\xe7', '\xec', '\xd4', '\xed', '\xe8', '\xeb', '\xe9']
                .map((ch, index) => [CmapSymbol.explosionTopLeft + index, ch]),
        ]) },
    rogueibm: {
        ibm: true,
        cmap: ROGUE_DOUBLE_WALLS,
        objectClasses: { 2: ')', 5: ',', 7: ':', 8: '\u00ad', 9: '?', 10: '+', 11: '\u00e7' },
    },
    rogueepyx: {
        ibm: true,
        cmap: new Map([...ROGUE_DOUBLE_WALLS, [CmapSymbol.engroom, '\u00ee']]),
        objectClasses: { 2: '\x18', 3: '[', 4: '=', 5: '\x0c', 6: '(',
            7: '\x05', 8: '\u00ad', 9: '\x0e', 10: '+', 11: '\u00e7',
            12: '\x0f', 13: '\x0f', 14: '`', 15: '0', 16: '_', 17: '.' },
        trapSymbol: '\x04',
        humanSymbol: '\x01',
        color: true,
    },
    roguewindows: {
        ibm: true,
        cmap: new Map([...ROGUE_DOUBLE_WALLS, [CmapSymbol.engroom, '\u00ee']]),
        objectClasses: { 2: ')', 5: ',', 7: ':', 8: '\u00ad', 9: '?', 10: '+', 11: '\u00e7' },
    },
};
const BLANK_SYMBOL = '\x1a';
const BLANK_OBJECT_SYMBOLS = ROGUE_OBJECT_SYMBOLS.map(() => BLANK_SYMBOL);
const ROGUE_SYMSET_OBJECT_TABLES = Object.fromEntries(Object.entries(ROGUE_SYMSETS)
    .filter(([, set]) => set.objectClasses !== undefined)
    .map(([name, set]) => [name, ROGUE_OBJECT_SYMBOLS.map((symbol, index) => set.objectClasses?.[index] ?? symbol)]));
function activeRogueSymset(state = game) {
    const shown = shownSymbolSet(state);
    if (!shown.rogue || !shown.name)
        return null;
    return ROGUE_SYMSETS[shown.name.toLowerCase()] ?? null;
}
function rogueCmapSymbol(set, symbol) {
    if (!set)
        return undefined;
    if (set.blank)
        return BLANK_SYMBOL;
    return set.cmap?.get(symbol);
}
// The monster-class tables only change on the Rogue level, where a named
// set can replace the human symbol (RogueEpyx) or every class (Blank).
const HUMAN_CLASS_INDEX = MONSTER_CLASS_SYMBOLS.indexOf('@');
export function monsterClassSymbol(index) {
    const shown = shownSymbolSet();
    if (shown.rogue) {
        const set = shown.name ? ROGUE_SYMSETS[shown.name.toLowerCase()] : undefined;
        if (set?.blank)
            return BLANK_SYMBOL;
        if (set?.humanSymbol && index === HUMAN_CLASS_INDEX)
            return set.humanSymbol;
    }
    return MONSTER_CLASS_SYMBOLS[index] ?? '';
}
// pager.c:is_swallow_sym() and display.c:swallowed() read the same showsyms.
export function swallowSymbolAppearance(index) {
    if (!Number.isInteger(index) || index < 0 || index > 7)
        throw new RangeError(`Unknown swallow border ${index}`);
    return cmapSymbolAppearance(CmapSymbol.swallowTopLeft + index);
}
// defsym.h effect symbols follow terrain and traps in showsyms[].
const DEFAULT_EFFECT_SYMBOLS = new Map([
    [CmapSymbol.vbeam, '|'], [CmapSymbol.hbeam, '-'], [CmapSymbol.lslant, '\\'], [CmapSymbol.rslant, '/'],
    [CmapSymbol.digbeam, '*'], [CmapSymbol.flashbeam, '!'],
    [CmapSymbol.boomleft, ')'], [CmapSymbol.boomright, '('],
    ...['0', '#', '@', '*'].map((ch, index) => [CmapSymbol.shieldFirst + index, ch]),
    ...['/', '-', '\\', '|', '|', '\\', '-', '/']
        .map((ch, index) => [CmapSymbol.swallowTopLeft + index, ch]),
    ...['/', '-', '\\', '|', ' ', '|', '\\', '-', '/']
        .map((ch, index) => [CmapSymbol.explosionTopLeft + index, ch]),
]);
// dat/symbols:DECgraphics overrides dungeon symbols independently of the
// terrain type at the hero's location. Furniture mimicry uses these symbols.
const decFurnitureSymbols = new Map([
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
// symbols.c:assign_graphics() selects the active dungeon symbols. DEC
// characters retain their alternate font so they do not match ASCII letters.
export function cmapSymbolAppearance(symbol) {
    const defaultSymbol = MAP_SYMBOLS[symbol]?.ch ?? DEFAULT_EFFECT_SYMBOLS.get(symbol);
    if (defaultSymbol === undefined)
        throw new RangeError(`Unknown dungeon symbol ${symbol}`);
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
const decWallColors = new Map([
    [GlyphOffset.cmapMines, CLR_BROWN], [GlyphOffset.cmapGehennom, CLR_RED],
    [GlyphOffset.cmapKnox, CLR_YELLOW], [GlyphOffset.cmapSokoban, CLR_BLUE],
]);
// symbols.c:load_symset() applies these sets' G_ wall colors independently
// of character handling; every other set leaves branch walls gray
// (clear_symsetentry() → clear_all_glyphmap_colors()).
const BRANCH_WALL_COLOR_SYMSETS = /^(?:DECgraphics|curses|IBMgraphics(?:_[12])?)$/i;
// wizcmds.c:wizcustom_callback() prints the loaded showsyms byte before
// wintty.c:g_putch() converts high-bit characters to an alternate font.
export function cmapSymbolByte(symbol) {
    const shown = shownSymbolSet();
    const name = shown.name?.toLowerCase();
    if (!shown.rogue && (name === 'decgraphics' || name === 'curses')) {
        const ch = decFurnitureSymbols.get(symbol);
        if (ch !== undefined)
            return ch.charCodeAt(0) | 0x80;
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
    if (ch === undefined)
        throw new RangeError(`Unknown dungeon symbol ${symbol}`);
    return ch.charCodeAt(0);
}
function furnitureDisplayGlyph(appearance) {
    const symbol = MAP_SYMBOLS[appearance];
    if (!symbol)
        throw new RangeError(`Unknown furniture disguise ${appearance}`);
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
    const invisible = !!(game.u?.invisible || game.u?.invis || game.invisible) && !propertyIsActive('seeInvisible', game);
    const canSeeSelf = !!(game.blind || game.u?.uswallow
        || (!invisible && !game.u?.uundetected));
    const sensesSelf = hasWornProperty('telepathy') || hasCarriedProperty('telepathy')
        || heroDetectsMonsters();
    return canSeeSelf || sensesSelf;
}
function objectClassForType(otyp) {
    // objects.h slots 1..17 have matching classes; slot 0 is a strange object.
    const firstRealObject = OBJECT_BASES[2];
    if (firstRealObject !== undefined && otyp > 0 && otyp < firstRealObject)
        return otyp;
    for (let cls = 2; cls < OBJECT_BASES.length - 1; cls++) {
        const first = OBJECT_BASES[cls];
        const next = OBJECT_BASES[cls + 1];
        if (first !== undefined && next !== undefined && otyp >= first && otyp < next)
            return cls;
    }
    return 1;
}
// display.h:random_obj_to_glyph().  Generic object slots 0..17 are excluded;
// a randomly selected corpse consumes a second display draw for its color.
function randomHallucinatedObjectGlyph() {
    const firstObject = OBJECT_BASES[2];
    if (firstObject === undefined)
        throw new Error('Missing first real object class in object data');
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
        color: game.objectColors?.[otyp] ?? OBJECT_COLOR[otyp] ?? CLR_GRAY,
        decgfx: false, kind: 'object', otyp, piletop: false,
        glyph: GlyphOffset.object + otyp,
    };
}
function objectGlyph(object) {
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
// display.h:obj_to_glyph() selects a species range or an object number.
// An unobserved potion uses its class number in the same object range.
function objectGlyphNumber(object, piletop) {
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
export function transientMonsterGlyph(monster, monsterState = 'normal') {
    return displayMonsterGlyph(heroIsHallucinating()
        ? rn2Display(MONSTER_COLOR.length) : monster.mnum, !!monster.female, monsterState);
}
// Native zapdir_to_glyph() and reset_glyphmap(): direction selects one of
// four symbols; the beam type retains a separate glyph even for equal colors.
export function zapdir_to_glyph(dx, dy, beamType) {
    const type = beamType >= 8 ? 0 : beamType;
    const direction = dx === dy ? 2 : dx && dy ? 3 : dx ? 1 : 0;
    const appearance = cmapSymbolAppearance(CmapSymbol.vbeam + direction);
    const color = [CLR_BRIGHT_BLUE, CLR_ORANGE, CLR_WHITE, CLR_BRIGHT_BLUE,
        CLR_BLACK, CLR_WHITE, CLR_GREEN, CLR_YELLOW][type];
    if (color === undefined)
        throw new RangeError(`Unknown beam type ${beamType}`);
    return { ch: appearance.ch, color, decgfx: appearance.dec,
        kind: 'effect', glyph: GlyphOffset.zap + type * 4 + direction };
}
// Native explosion_to_glyph(): rows run from top left to bottom right.
export function explosionGlyph(style, dx, dy) {
    // Native explosion_to_glyph() defaults every other style, including dark, to fiery.
    const type = [EXPL_FROSTY, EXPL_MAGICAL, EXPL_WET, EXPL_MUDDY, EXPL_NOXIOUS]
        .includes(style) ? style : EXPL_FIERY;
    const index = (dy + 1) * 3 + dx + 1;
    const color = [CLR_GREEN, CLR_BROWN, CLR_BLUE,
        CLR_MAGENTA, CLR_ORANGE, CLR_WHITE][type - EXPL_NOXIOUS];
    if (index < 0 || index > 8 || color === undefined)
        throw new RangeError(`Unknown explosion glyph ${style} at offset ${dx},${dy}`);
    const appearance = cmapSymbolAppearance(CmapSymbol.explosionTopLeft + index);
    return { ch: appearance.ch, color, decgfx: appearance.dec,
        kind: 'effect', glyph: GlyphOffset.explodeDark + type * 9 + index };
}
export function shieldGlyph(character) {
    const index = ['0', '#', '@', '*'].indexOf(character);
    if (index < 0)
        throw new RangeError(`Unknown shield symbol ${character}`);
    const appearance = cmapSymbolAppearance(CmapSymbol.shieldFirst + index);
    return { ch: appearance.ch, color: CLR_BRIGHT_BLUE, decgfx: appearance.dec, kind: 'effect',
        glyph: cmapToGlyph(82 + index) };
}
// C display.h:obj_to_glyph(), for tmp_at() callers.  A projectile has already
// been extracted from the floor chain, so this deliberately derives only its
// transient glyph and does not mutate hero memory or object discovery state.
// Hallucination consumes the display RNG once when the flight starts; callers
// reuse the returned glyph for every animation cell.
export function transientObjectGlyph(object) {
    const glyph = objectGlyph(object);
    return {
        ...glyph,
        // tty has no hilite for ordinary gray; black is dark gray (use_darkgray).
        color: glyph.color === CLR_GRAY ? NO_COLOR : glyph.color,
        decgfx: glyph.decgfx ?? false,
        attr: objectGlyphAttr(glyph),
    };
}
// C inventory menus attach obj_to_glyph() metadata to every real item even
// though tty's text presentation does not show a separate glyph column.  The
// metadata construction remains display-RNG-visible under Hallucination.
export function consumeHallucinatedMenuObjectGlyph(object) {
    if (!heroIsHallucinating() || !object)
        return null;
    return objectGlyph(object);
}
function mimicAppearance(monster) {
    if (monster.mappearance === undefined)
        throw new Error('A disguised creature has no appearance');
    return monster.mappearance;
}
function apparentObjectGlyph(monster) {
    const otyp = mimicAppearance(monster);
    const oclass = objectClassForType(otyp);
    // display_self() uses objnum_to_glyph(), including generic corpses and
    // statues. The hero's disguise never uses hallucinated object selection.
    return {
        ch: activeObjectSymbols()[oclass] || '?',
        color: objectColor({ otyp, oclass, dknown: true }),
        decgfx: false, kind: 'object', otyp, glyph: GlyphOffset.object + otyp,
    };
}
// C refs: display.c map_background(), map_object(), and map_trap().  These
// update hero memory independently from ordinary line-of-sight newsym().
export async function map_background(x, y, show = true) {
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    const glyph = terrain_glyph(loc, x, y);
    if (game.level?.flags?.hero_memory)
        loc.remembered_glyph = {
            ...glyph, decgfx: glyph.dec,
        };
    if (show)
        await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec, 0, glyph);
}
function requireDisplayLocation(x, y) {
    const location = requireGameLevel().at(x, y);
    if (!location)
        throw new RangeError(`Display coordinate (${x}, ${y}) is outside the map`);
    return location;
}
// C display.c:magic_map_background(). Unlike ordinary mapping, this keeps
// remembered objects and invisible markers and corrects never-seen lighting.
export async function magic_map_background(x, y, show = true) {
    const location = requireDisplayLocation(x, y);
    let glyph = terrain_glyph(location, x, y);
    if (!cansee(x, y) && !location.waslit) {
        if (location.typ === ROOM) {
            if ((game.flags.dark_room ?? true) && game.flags.color !== false) {
                glyph = Is_rogue_level(game.u.uz)
                    ? { ch: ' ', color: NO_COLOR, dec: false,
                        kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone }
                    : { ...glyph, color: CLR_BLACK, glyph: cmapToGlyph(CmapSymbol.darkroom),
                        terrainName: 'dark part of a room' };
            }
            else {
                glyph = { ch: ' ', color: NO_COLOR, dec: false, kind: 'nothing', glyph: GlyphOffset.nothing };
            }
        }
        else if (location.typ === CORR) {
            glyph = { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr) };
        }
    }
    const remembered = location.remembered_glyph;
    // C's cmap glyph range includes traps and engraved floor glyphs.
    if (requireGameLevel().flags.hero_memory && (!remembered
        || ['unexplored', 'terrain', 'trap', 'engraving'].includes(remembered.kind))) {
        location.remembered_glyph = { ...glyph, decgfx: glyph.dec };
    }
    if (show)
        await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec, 0, glyph);
    updateLastSeenTerrain(x, y);
}
export async function map_object(object, show = true, observe = true) {
    if (!object)
        return;
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
        await show_glyph_cell(object.ox, object.oy, glyph.ch, glyph.color, false, objectGlyphAttr(glyph), glyph);
}
const TRAP_COLOR = [
    NO_COLOR, CLR_CYAN, CLR_CYAN, CLR_GRAY, CLR_BROWN, CLR_CYAN,
    CLR_RED, CLR_GRAY, CLR_BRIGHT_BLUE, CLR_BLUE, CLR_ORANGE,
    0, 0, CLR_BROWN, CLR_BROWN, CLR_MAGENTA, CLR_MAGENTA,
    CLR_BRIGHT_MAGENTA, CLR_GRAY, CLR_GRAY, CLR_BRIGHT_BLUE,
    CLR_BRIGHT_BLUE, CLR_BRIGHT_GREEN, CLR_MAGENTA, CLR_ORANGE, CLR_ORANGE,
];
export function transientTrapGlyph(trap) {
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
export async function flashGlyphAt(x, y, glyph, repeats) {
    const location = requireDisplayLocation(x, y);
    const previous = requireGameLevel().flags.hero_memory
        ? location.remembered_glyph || { ch: ' ', color: NO_COLOR, decgfx: false,
            kind: 'nothing', glyph: GlyphOffset.nothing }
        : terrain_glyph(location, x, y);
    for (let frame = 0; frame < repeats * 2; frame++) {
        const shown = frame % 2 ? previous : glyph;
        await show_glyph_cell(x, y, shown.ch, shown.color, shown.decgfx ?? shown.dec, 0, shown);
        await flush_screen(1);
        await game.animationFrame?.();
    }
}
export async function map_trap(trap, show = true) {
    if (!trap)
        return;
    const glyph = transientTrapGlyph(trap);
    const loc = game.level?.at(trap.tx, trap.ty);
    if (loc && game.level?.flags?.hero_memory)
        loc.remembered_glyph = glyph;
    if (show)
        await show_glyph_cell(trap.tx, trap.ty, glyph.ch, glyph.color, false, 0, glyph);
}
export async function map_engraving(engraving, show = true) {
    if (!engraving)
        return;
    const loc = game.level?.at(engraving.x, engraving.y);
    if (!loc)
        return;
    const ch = loc.typ === CORR ? '#' : '`';
    const glyph = {
        ch, color: CLR_BRIGHT_BLUE, decgfx: false, kind: 'engraving',
        glyph: cmapToGlyph(loc.typ === CORR ? CmapSymbol.engrcorr : CmapSymbol.engroom),
    };
    if (game.level?.flags?.hero_memory)
        loc.remembered_glyph = glyph;
    if (show)
        await show_glyph_cell(engraving.x, engraving.y, ch, CLR_BRIGHT_BLUE, false, 0, glyph);
}
function engravingAt(x, y) {
    return game.level?.engravings?.find(engraving => engraving.x === x && engraving.y === y);
}
function monsterAtMapCell(x, y) {
    // Native m_at() retains a dying actor until remove_monster(), including
    // a vision refresh while its death announcement awaits acknowledgment.
    return game.level ? monsterAtPosition(game.level, x, y) : null;
}
// C dungeon.c:update_lastseentyp(). Terrain memory is independent of the
// remembered glyph: an object can hide the terrain, and a mimic can fake it.
export function updateLastSeenTerrain(x, y) {
    const location = requireDisplayLocation(x, y);
    let typ = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const monster = monsterAtMapCell(x, y);
    if (monster && M_AP_TYPE(monster) === M_AP_FURNITURE
        && canSeeMonster(monster)) {
        typ = cmapToType(mimicAppearance(monster));
    }
    location.lastseentyp = typ;
}
// C display.c:_map_location(). This direct mapper intentionally bypasses
// line of sight, but object observation and cloud visibility keep their gates.
export async function map_location(x, y, show = true) {
    const covered = terrainCoversObjectsAt(x, y);
    const level = requireGameLevel();
    const object = level.objects?.[x]?.[y]?.[0];
    const trap = level.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    const engraving = engravingAt(x, y);
    const typ = requireDisplayLocation(x, y).typ;
    if (object && !covered) {
        await map_object(object, show);
    }
    else if (trap?.tseen && !covered) {
        await map_trap(trap, show);
    }
    else if (engraving?.erevealed && !covered
        && (typ === ROOM || typ === CORR || typ === ICE)) {
        await map_engraving(engraving, show);
    }
    else {
        await map_background(x, y, show);
    }
    updateLastSeenTerrain(x, y);
    if (show && !heroIsBlind() && visibleMapRegionAt(x, y))
        await showMapRegion(x, y);
}
// C display.c:feel_newsym(). Known terrain changes update memory by touch
// when the hero is blind.
export async function feel_newsym(x, y) {
    if (heroIsBlind())
        await feel_location(x, y);
    else
        await newsym(x, y);
}
// Native suppress_map_output(): initialization and persistence can leave
// terrain, hero properties, and ownership links temporarily incomplete.
function suppressMapOutput() {
    return !!(game.in_mklev || game.program_state.saving || game.program_state.restoring);
}
// C display.c:feel_location().  Blind explicit search refreshes each adjacent
// nonliving layer before it tests for a concealed monster or trap.  This is
// why a felt floor object can remain in hero memory after a later invisible
// actor marker is installed elsewhere during the same search.
export async function feel_location(x, y) {
    if (suppressMapOutput())
        return;
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    const monster = monsterAtMapCell(x, y);
    if (loc.remembered_glyph?.kind === 'invisible' && monster)
        return;
    if (restrictedUnderwaterView() && !underwaterTerrain(x, y))
        return;
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
                && top === chain)
                game.u.bc_felt = (game.u.bc_felt ?? 0) | BC_CHAIN;
            else
                game.u.bc_felt = (game.u.bc_felt ?? 0) & ~BC_CHAIN;
            if (ball.where === 'floor' && ball.ox === x && ball.oy === y
                && top === ball)
                game.u.bc_felt = (game.u.bc_felt ?? 0) | BC_BALL;
            else
                game.u.bc_felt = (game.u.bc_felt ?? 0) & ~BC_BALL;
        }
        await darkenFeltFloor(x, y, loc);
    }
    else {
        const boulder = game.level?.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
        const closedDoor = loc.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED));
        if (IS_OBSTRUCTED(loc.typ) || closedDoor)
            await map_background(x, y, true);
        else if (boulder)
            await map_object(boulder, true);
        else if (loc.typ === DOOR)
            await map_background(x, y, true);
        else if (IS_ROOM(loc.typ) || IS_POOL(loc.typ)) {
            const glyph = loc.remembered_glyph;
            // Native touch clears the ordinary boulder glyph, retaining pile memory.
            const forgottenBoulder = glyph?.glyph === GlyphOffset.object + BOULDER
                || glyph?.kind === 'invisible';
            if (forgottenBoulder && loc.typ !== ROOM)
                await map_background(x, y, true);
            else if (forgottenBoulder || glyph?.kind === 'terrain'
                && glyph.glyph !== undefined && glyph.glyph >= cmapToGlyph(CmapSymbol.stone)
                && glyph.glyph < cmapToGlyph(CmapSymbol.darkroom)) {
                const dark = (game.flags.dark_room ?? true) && game.flags.color !== false
                    && !Is_rogue_level(game.u.uz);
                await rememberFeltRoom(x, y, loc, dark ? CmapSymbol.darkroom
                    : loc.waslit ? CmapSymbol.room : CmapSymbol.stone);
            }
        }
        else {
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
async function rememberFeltRoom(x, y, location, symbol) {
    const dark = symbol === CmapSymbol.darkroom;
    // reglyph_darkroom() uses the floor symbol only with dark_room and color.
    const floor = symbol === CmapSymbol.room
        || dark && (game.flags.dark_room ?? true) && game.flags.color !== false;
    const dec = usesDecSymbols();
    const glyph = {
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
async function darkenFeltFloor(x, y, location) {
    const glyph = location.remembered_glyph;
    if (location.typ === ROOM && glyph?.glyph === cmapToGlyph(CmapSymbol.room)
        && (!location.waslit || (game.flags.dark_room ?? true) && game.flags.color !== false)) {
        // Grounded touch chooses darkroom even on Rogue levels or without color.
        await rememberFeltRoom(x, y, location, (game.flags.dark_room ?? true) ? CmapSymbol.darkroom : CmapSymbol.stone);
    }
    else if (location.typ === CORR && glyph?.glyph === cmapToGlyph(CmapSymbol.litcorr)
        && !location.waslit) {
        const corridor = glyph.kind === 'terrain'
            ? { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr),
                terrainName: 'corridor' }
            : { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr) };
        location.remembered_glyph = corridor;
        await show_glyph_cell(x, y, corridor.ch, corridor.color, corridor.decgfx, 0, corridor);
    }
}
// ── show_glyph_cell ──
export function glyphAt(x, y, state = game) {
    if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) {
        const appearance = cmapSymbolAppearance(CmapSymbol.room);
        return { ch: appearance.ch, color: NO_COLOR, decgfx: appearance.dec,
            kind: 'terrain', terrainName: 'floor of a room',
            glyph: cmapToGlyph(CmapSymbol.room) };
    }
    const loc = state.level?.at(x, y);
    if (!loc)
        return null;
    // Native glyph_at() reads the third screen, even when a memory-only map
    // operation has recorded something which has never been displayed.
    return loc.disp_glyph || { ch: ' ', color: NO_COLOR, decgfx: false,
        kind: 'unexplored', glyph: GlyphOffset.unexplored };
}
// display.c:map_glyphinfo() re-applies the showrace highlight to the hero's
// own glyph after reset_glyphmap() cleared the Rogue level's colors.  The
// hero glyph is the race monster whenever showrace is set (display.h
// hero_glyph).
function isRogueShowraceHeroGlyph(glyph, x, y) {
    if (!game.flags.showrace || Upolyd(game.u) || game.urace === null)
        return false;
    if (glyph?.kind !== 'monster' || x !== game.u.ux || y !== game.u.uy)
        return false;
    const heroGlyphNumber = GlyphOffset.monMale + game.urace.mnum
        + (game.flags.female ? MONSTER_COLOR.length : 0);
    return glyph.glyph === heroGlyphNumber;
}
// HAS_ROGUE_IBM_GRAPHICS with nocolor cleared (only RogueEpyx declares
// `Color: Yes`) keeps color on the Rogue level through cmap_to_roguecolor()
// and the object/monster branches of reset_glyphmap().
export function rogueColorsActive() {
    const set = activeRogueSymset();
    return Is_rogue_level(game.u?.uz) && game.flags.color !== false
        && set?.ibm === true && set.color === true;
}
// The Rogue color tables of reset_glyphmap(); null keeps the glyph's own
// color where the native branches have no rogue override (explosions, the
// branch wall ranges).
function rogueLevelGlyphColor(glyph, x, y) {
    const glyphNumber = glyph.glyph;
    if (glyph.kind === 'object' && typeof glyphNumber === 'number') {
        // Every statue glyph turns red under rogue color, like the four
        // statue ranges of reset_glyphmap().
        if (glyph.statueGlyph)
            return CLR_RED;
        // reset_glyphmap(): coins yellow, food (including corpses) red,
        // every other class bright blue.
        const oclass = objectClassForType(glyph.otyp);
        // objclass.h indices: coins 12, food 7.
        return oclass === 12 ? CLR_YELLOW
            : oclass === 7 ? CLR_RED : CLR_BRIGHT_BLUE;
    }
    if (glyph.kind === 'monster' && typeof glyphNumber === 'number') {
        // map_glyphinfo() yellows the hero's own glyph whatever its sex,
        // while a steed's glyph (not hero_glyph) keeps the ridden branch.
        if (x === game.u?.ux && y === game.u?.uy && !Upolyd(game.u)) {
            const heroNumber = GlyphOffset.monMale
                + ((game.flags.showrace ? game.urace?.mnum : game.u.umonnum) ?? 0)
                + (game.flags.female ? MONSTER_COLOR.length : 0);
            if (glyphNumber === heroNumber)
                return CLR_YELLOW;
        }
        // Ordinary male monsters are yellow; pets, detected, ridden and
        // female monsters keep no color.
        return glyphNumber >= GlyphOffset.monMale && glyphNumber < GlyphOffset.monFemale
            ? CLR_YELLOW : NO_COLOR;
    }
    if (typeof glyphNumber !== 'number')
        return NO_COLOR;
    // reset_glyphmap() leaves explosions to explode_color() and the branch
    // wall ranges to wall_color() even with rogue color on.
    if (glyphNumber >= GlyphOffset.explodeDark && glyphNumber < GlyphOffset.warning)
        return null;
    if (glyphNumber >= GlyphOffset.cmapSokoban && glyphNumber < GlyphOffset.cmapA)
        return null;
    // The main wall range colors through cmap_to_roguecolor(); the branch
    // ranges above keep their wall color, and no Rogue level sits in one.
    if (glyphNumber === GlyphOffset.cmapStone)
        return NO_COLOR;
    if (glyphNumber >= GlyphOffset.cmapMain && glyphNumber < GlyphOffset.cmapMines)
        return cmapToRogueColor(glyphNumber - GlyphOffset.cmapMain + CmapSymbol.vwall);
    if (glyphNumber >= GlyphOffset.cmapA && glyphNumber < GlyphOffset.altar)
        return cmapToRogueColor(glyphNumber - GlyphOffset.cmapA + CmapSymbol.ndoor);
    if (glyphNumber >= GlyphOffset.altar && glyphNumber < GlyphOffset.cmapB)
        return cmapToRogueColor(CmapSymbol.altar);
    if (glyphNumber >= GlyphOffset.cmapB && glyphNumber < GlyphOffset.zap)
        return cmapToRogueColor(glyphNumber - GlyphOffset.cmapB + CmapSymbol.grave);
    return NO_COLOR;
}
export async function show_glyph_cell(x, y, ch, color = NO_COLOR, decgfx = false, attr = 0, glyph = null) {
    if (suppressMapOutput() || x === 0)
        return;
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    const nextGlyph = glyph || { kind: 'effect' };
    const mentionChange = shouldMentionGlyphChange(x, y, loc, nextGlyph);
    // display.c:reset_glyphmap() clears every color on the Rogue level
    // (GMAP_ROGUELEVEL) unless the loaded rogue set declares IBM handling
    // with `Color: Yes` (RogueEpyx); then the Rogue color tables apply and
    // the hero turns yellow instead of the showrace highlight.
    if (Is_rogue_level(game.u?.uz)) {
        if (rogueColorsActive()) {
            const rogueColor = rogueLevelGlyphColor(nextGlyph, x, y);
            if (rogueColor !== null)
                color = rogueColor;
        }
        else if (!isRogueShowraceHeroGlyph(glyph, x, y))
            color = NO_COLOR;
    }
    // reset_glyphmap() marks a corridor engraving which shares '#'
    // with corridors; tty_print_glyph() makes that glyph inverse.
    if (nextGlyph.glyph === cmapToGlyph(CmapSymbol.engrcorr) && ch === '#'
        && game.flags.use_inverse !== false && game.iflags.use_inverse !== false
        && game.iflags.wc_inverse !== false)
        attr |= ATR_INVERSE;
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
        }
        finally {
            if (accessible === undefined)
                delete game.flags.accessiblemsg;
            else
                game.flags.accessiblemsg = accessible;
        }
    }
}
// C display.c:show_glyph(). Announce discoveries and furniture changes,
// excluding floor, walls, the hero, and disappearing monsters. Monster
// sightings belong to spot_monsters when that option is also enabled.
function shouldMentionGlyphChange(x, y, location, next) {
    if (!game.flags.mention_map || game._monsterNoticesBlocked
        || game.program_state.in_docrt || game.program_state.gameover
        || game.program_state.in_getlev || game.program_state.stopprint)
        return false;
    const old = location.disp_glyph?.glyph ?? GlyphOffset.unexplored;
    if (next.glyph === undefined || old === next.glyph && !location.gnew)
        return false;
    const symbol = glyphToCmapSymbol(next.glyph);
    const furniture = symbol !== null
        && symbol >= CmapSymbol.upstair && symbol <= CmapSymbol.fountain;
    const discovered = old === GlyphOffset.nothing || old === GlyphOffset.unexplored;
    if (!(discovered || furniture))
        return false;
    if (symbol !== null && (symbol >= CmapSymbol.stone && symbol <= CmapSymbol.trwall
        || symbol >= CmapSymbol.room && symbol <= CmapSymbol.darkroom))
        return false;
    if (glyphIsMonster(old) || game.flags.spot_monsters && glyphIsMonster(next.glyph))
        return false;
    return x !== game.u.ux || y !== game.u.uy;
}
// display.h: glyph_is_monster() excludes bodies and statues.
function glyphIsMonster(glyph) {
    return glyph >= GlyphOffset.monMale && glyph < GlyphOffset.invisible
        || glyph >= GlyphOffset.detectMale && glyph < GlyphOffset.body
        || glyph >= GlyphOffset.riddenMale && glyph < GlyphOffset.object;
}
// flush_screen() prints queued glyphs in row order. tty_print_glyph() leaves
// the cursor one column after the last printed cell, even when it was restored
// to the glyph already on the terminal before the flush.
export function lastDirtyMapCursor(g = game) {
    if (!g.nhDisplay)
        return null;
    let cursor = null;
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
export async function shieldeff(x, y, g = game) {
    if (g.flags.sparkle === false || !cansee(x, y))
        return;
    try {
        for (const ch of SHIELD_STATIC) {
            const glyph = shieldGlyph(ch);
            await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
            await flush_screen(1);
            g.nhDisplay?.setCursor((g.u?.ux ?? 1) - 1, (g.u?.uy ?? 0) + 1);
            await g.animationFrame?.();
        }
    }
    finally {
        await newsym(x, y);
    }
}
// C display.c:map_invisible().  Unlike a transient actor overlay, an unseen
// attacker's `I` is hero memory and must survive later blind redraws until a
// caller explicitly discovers that the square no longer contains that
// threat.  It also remains authoritative on a physically visible square
// whose monster still cannot be spotted.
export async function map_invisible(x, y) {
    if (game.u?.ux === x && game.u?.uy === y)
        return;
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    if (game.level?.flags?.hero_memory) {
        loc.remembered_glyph = {
            ch: 'I', color: NO_COLOR, decgfx: false, kind: 'invisible', glyph: GlyphOffset.invisible,
        };
    }
    await show_glyph_cell(x, y, 'I', NO_COLOR, false, 0, { kind: 'invisible', glyph: GlyphOffset.invisible });
}
// C display.c:unmap_object(). Clearing stale object or invisible-creature
// memory restores a known trap, engraving, or background without revealing
// another floor object that was hidden underneath it.
export async function unmapObject(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc || !game.level?.flags.hero_memory)
        return;
    const covered = terrainCoversObjectsAt(x, y);
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && !covered) {
        await map_trap(trap, false);
    }
    else if (loc.seenv) {
        const engraving = engravingAt(x, y);
        const showsEngraving = loc.typ === ROOM
            || loc.typ === CORR || loc.typ === ICE;
        if (engraving && showsEngraving && !covered) {
            if (cansee(x, y))
                engraving.erevealed = true;
            await map_engraving(engraving, false);
        }
        else {
            await map_background(x, y, false);
            if (!loc.waslit && loc.typ === ROOM)
                loc.remembered_glyph = { ch: ' ', color: NO_COLOR,
                    decgfx: false, kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone };
        }
    }
    else {
        loc.remembered_glyph = { ch: ' ', color: NO_COLOR,
            decgfx: false, kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone };
    }
}
export async function unmap_invisible(x, y, show = true) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind !== 'invisible')
        return false;
    await unmapObject(x, y);
    if (show)
        await newsym(x, y);
    return true;
}
export async function displaySelf() {
    // display.h:maybe_display_usteed() gives a visible steed its own identity.
    const steed = game.u.usteed;
    const glyph = steed && monsterVisible(steed)
        ? displayMonsterGlyph(heroIsHallucinating() ? rn2Display(MONSTER_COLOR.length) : steed.mnum, !!steed.female, 'ridden')
        : heroDisplayGlyph();
    await show_glyph_cell(game.u.ux, game.u.uy, glyph.ch, glyph.color, glyph.decgfx ?? false, 0, glyph);
}
// C display.c:newsym_force(). A forced redraw prints even an unchanged glyph.
export async function newsym_force(x, y) {
    await newsym(x, y);
    const location = game.level?.at(x, y);
    if (location)
        location.gnew = 1;
}
// ── newsym ──
function monsterDisplayAttribute(state) {
    // C tty_print_glyph() applies pet highlighting independently of use_inverse.
    if (state === 'pet')
        return game.flags.hilite_pet
            ? terminalAttrFromCAttr(game.iflags.wc2_petattr ?? C_ATR_INVERSE) : 0;
    const inverse = game.flags?.use_inverse !== false
        && game.iflags?.use_inverse !== false && game.iflags?.wc_inverse !== false;
    return state === 'detected' && inverse ? ATR_INVERSE : 0;
}
// C show_mon_or_warn(): a located actor replaces remembered invisibility.
// Its departure must reveal the lower layer rather than restore a stale I.
async function showMonsterOrWarning(x, y, glyph, attr = 0) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind === 'invisible') {
        await unmapObject(x, y);
        const object = game.level?.objects[x]?.[y]?.[0];
        if (cansee(x, y) && object)
            await map_object(object, false);
    }
    await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, attr, glyph);
}
function visibleMapRegionAt(x, y) {
    return (game.level?.regions || []).find(region => region.visible
        && region.ttl !== -2 && region.cells?.some(cell => cell.x === x && cell.y === y)) || null;
}
async function showMapRegion(x, y) {
    const region = visibleMapRegionAt(x, y);
    if (!region)
        return;
    const poisonous = region.damage > 0;
    await show_glyph_cell(x, y, '#', poisonous ? CLR_BRIGHT_GREEN : CLR_GRAY, false, 0, { kind: 'terrain', terrainName: poisonous ? 'poison cloud' : 'cloud',
        glyph: cmapToGlyph(poisonous ? CmapSymbol.poisoncloud : CmapSymbol.cloud) });
}
function monsterOverridesMapRegion(monster, x, y) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind === 'invisible')
        return true;
    if (!monster)
        return false;
    if (x === monster.mx && y === monster.my
        && (canSenseMonster(monster) || monsterHasWarningProjection(monster)))
        return true;
    const blind = !!game.blind;
    const range = Math.max(game.u?.xray_range ?? -1, 1);
    const dx = x - (game.u?.ux ?? x);
    const dy = y - (game.u?.uy ?? y);
    const ordinaryVisible = !blind && monsterVisible(monster)
        && M_AP_TYPE(monster) !== M_AP_FURNITURE
        && M_AP_TYPE(monster) !== M_AP_OBJECT;
    return ordinaryVisible && dx * dx + dy * dy <= range * (range + 1);
}
export async function newsym(x, y) {
    if (suppressMapOutput())
        return;
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
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
            || Math.abs(x - game.u.ux) > 1 || Math.abs(y - game.u.uy) > 1))
        return;
    const physicallyVisible = cansee(x, y);
    // C newsym() remembers permanent lighting while this square is visible.
    // Temporary light grants sight but must not make a dark room stay lit in
    // memory after the hero leaves it.
    if (physicallyVisible)
        loc.waslit = !!loc.lit;
    const engraving = engravingAt(x, y);
    // C reveals the map symbol before living and object overlays are chosen.
    if (physicallyVisible && engraving)
        engraving.erevealed = true;
    const monster = monsterAtMapCell(x, y);
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
        if (physicallyVisible)
            await map_location(x, y, !spotSelf);
        else
            await feel_location(x, y);
        if (!spotSelf)
            return;
        await displaySelf();
        return;
    }
    const projection = monster ? monsterProjectionAtCell(monster, x, y) : null;
    if (projection && monster) {
        // A visible actor overlays rather than replaces the remembered layer.
        if (physicallyVisible) {
            const trap = monster.mtrapped ? game.level?.traps.find(candidate => candidate.tx === x && candidate.ty === y) : undefined;
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
    }
    else if (loc.remembered_glyph) {
        await showRememberedLocation(x, y, loc);
    }
    else {
        // A living glyph is only an overlay.  When its actor vacates an
        // unseen, never-mapped square, restore unexplored space rather than
        // leaving a presentation-only duplicate behind.
        await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }
}
// C display.c:display_monster(). Sight updates and touch share this renderer,
// while their callers choose independently which monsters can be projected.
async function displayMonsterAtCell(monster, x, y, projection) {
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
                oclass: 0,
                corpsenm: monster.mcorpsenm ?? MONSTER_NAME.indexOf('tengu'),
                dknown: false,
            }, !sensed);
            if (!sensed)
                return;
        }
        else if (M_AP_TYPE(monster) === M_AP_FURNITURE) {
            const glyph = furnitureDisplayGlyph(mimicAppearance(monster));
            loc.remembered_glyph = glyph;
            if (!sensed) {
                await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
                loc.lastseentyp = cmapToType(mimicAppearance(monster));
                return;
            }
        }
        else if (M_AP_TYPE(monster) === M_AP_MONSTER
            && Number.isInteger(monster.mappearance)) {
            const mnum = heroIsHallucinating()
                ? rn2Display(MONSTER_COLOR.length) : mimicAppearance(monster);
            const glyph = displayMonsterGlyph(mnum, !!monster.female);
            await show_glyph_cell(x, y, glyph.ch, glyph.color, false, 0, glyph);
            if (!sensed)
                return;
        }
    }
    if (M_AP_TYPE(monster) !== M_AP_NOTHING && !sensed)
        return;
    const monsterState = (monster.pet || (monster.mtame ?? 0) > 0) && !heroIsHallucinating()
        ? 'pet' : projection.detected ? 'detected' : 'normal';
    if (heroIsHallucinating()) {
        const displayMnum = rn2Display(MONSTER_COLOR.length);
        const glyph = displayMonsterGlyph(displayMnum, !!monster.female, monsterState);
        await showMonsterOrWarning(x, y, glyph, monsterDisplayAttribute(monsterState));
    }
    else {
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
            glyph: monsterGlyphNumber(projection.wormTail ? PM_LONG_WORM_TAIL : monster.mnum, !!monster.female, monsterState),
        }, monsterDisplayAttribute(monsterState));
    }
    monster.meverseen = 1;
}
// C ref: display.c:see_monsters(). Warning, telepathy, and visible regions
// can change how a stationary monster is projected when only the hero moves;
// repainting solely on actor movement leaves stale warning numerals behind.
export async function see_monsters({ beforeGlow = null } = {}) {
    if (game._deferSeeMonsters)
        return;
    if (game.u?.usteed)
        game.u.usteed.meverseen = 1;
    if (game.u?.ustuck)
        game.u.ustuck.meverseen = 1;
    let count = 0;
    // makemon() links new actors at fmon's head; the live level array retains
    // creation order, so source traversal is its reverse (same as scheduler).
    for (const monster of Array.from(game.level?.monsters || []).reverse()) {
        if (monster.dead || monster.mhp <= 0
            || ((monster.mstate ?? 0) & MON_STILL_ARRIVING))
            continue;
        await newsym(monster.mx, monster.my);
        if (monster.wormno)
            await redrawMonsterWormSegments(monster);
        if (game.u.warnOfMonster
            && ((game.context.warntype?.obj ?? 0) & (MONSTER_FLAGS2[monster.mnum] ?? 0)))
            count++;
    }
    if (count !== game.warn_obj_cnt) {
        await artifactWarningFeedback(count, { beforeGlow });
        game.warn_obj_cnt = count;
    }
    if (!game.u?.usteed && game.u?.ux > 0)
        await newsym(game.u.ux, game.u.uy);
}
// C display.c:see_objects()/see_traps().  fobj is newest-first globally,
// while only each square's pile-top is eligible for a redraw.
export async function see_objects() {
    const objects = [];
    for (const column of game.level?.objects || []) {
        if (!column)
            continue;
        for (const pile of column) {
            if (pile?.[0])
                objects.push(pile[0]);
        }
    }
    objects.sort((a, b) => (b._fobjOrder ?? 0) - (a._fobjOrder ?? 0));
    for (const object of objects)
        await newsym(object.ox, object.oy);
}
export async function see_traps() {
    for (const trap of game.level?.traps || []) {
        const loc = game.level?.at?.(trap.tx, trap.ty);
        if (loc?.disp_glyph?.kind === 'trap')
            await newsym(trap.tx, trap.ty);
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
            const width = Math.max(19, (BOGUS_MONSTERS[index] ?? '').length) + 1;
            if (offset < start + width) {
                landed = index;
                const remaining = start + width - offset;
                if (remaining <= 21)
                    tries = 10;
                break;
            }
            start += width;
        }
        if (tries === 10)
            break;
    }
    const selected = BOGUS_MONSTERS[(landed + 1) % BOGUS_MONSTERS.length]
        || 'bogon';
    const first = selected.charAt(0);
    const code = '-_+|='.includes(first) ? first : '';
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
export function randomDisplayMonsterIdentity() {
    let mnum;
    do {
        mnum = rn2Display(SPECIAL_PM + BOGUSMONSIZE);
    } while (mnum < SPECIAL_PM
        && (((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME)
            || ((MONSTER_GENO[mnum] ?? 0) & G_NOGEN)));
    if (mnum >= SPECIAL_PM)
        return randomBogusMonsterIdentity();
    const female = rn2Display(2) !== 0; // pmname(..., random gender)
    const name = monsterTypeName(mnum, female);
    if (name === undefined)
        throw new RangeError(`Missing display monster name ${mnum}`);
    return { name, personal: false };
}
export function randomDisplayMonsterName() {
    return randomDisplayMonsterIdentity().name;
}
// C do_name.c:bogusmon(), for descriptions that require a fictitious species.
export function randomBogusMonsterName() {
    return randomBogusMonsterIdentity().name;
}
const HALLUCINATED_COLORS = [
    'ultraviolet', 'infrared', 'bluish-orange', 'reddish-green', 'dark white',
    'light black', 'sky blue-pink', 'pinkish-cyan', 'indigo-chartreuse',
    'salty', 'sweet', 'sour', 'bitter', 'umami',
    'striped', 'spiral', 'swirly', 'plaid', 'checkered', 'argyle', 'paisley',
    'blotchy', 'guernsey-spotted', 'polka-dotted', 'square', 'round',
    'triangular', 'cabernet', 'sangria', 'fuchsia', 'wisteria', 'lemon-lime',
    'strawberry-banana', 'peppermint', 'romantic', 'incandescent', 'octarine',
    'excitingly dull', 'mauve', 'electric', 'neon', 'fluorescent',
    'phosphorescent', 'translucent', 'opaque', 'psychedelic', 'iridescent',
    'rainbow-colored', 'polychromatic', 'colorless', 'colorless green',
    'dancing', 'singing', 'loving', 'loudy', 'noisy', 'clattery', 'silent',
    'apocyan', 'infra-pink', 'opalescent', 'violant', 'tuneless',
    'viridian', 'aureolin', 'cinnabar', 'purpurin', 'gamboge', 'madder',
    'bistre', 'ecru', 'fulvous', 'tekhelet', 'selective yellow',
];
// C do_name.c:hcolor(). Hallucinated color names use the display RNG.
export function displayColorName(preferred, state = game) {
    if (preferred != null && !heroIsHallucinating(state))
        return preferred;
    const color = HALLUCINATED_COLORS[rn2Display(HALLUCINATED_COLORS.length)];
    if (color === undefined)
        throw new Error('Display RNG returned an invalid color index');
    return color;
}
const OBJECT_COLOR_NAMES = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'colorless', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];
// C do_name.c:rndcolor() draws an ordinary color even when hcolor() will
// replace it with a hallucinated color from the display stream.
export function randomColorName(state = game, random = rn2) {
    const color = OBJECT_COLOR_NAMES[random(OBJECT_COLOR_NAMES.length)];
    if (color === undefined)
        throw new RangeError('Random color selection is outside the color table');
    return displayColorName(color, state);
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
export async function swallowed(first = false) {
    if (!game.level || !game.u?.uswallow || !game.u?.ustuck)
        return;
    if (first) {
        for (let y = 0; y < ROWNO; y++)
            for (let x = 1; x < COLNO; x++)
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }
    else if (lastSwallowedX > 0) {
        for (let y = lastSwallowedY - 1; y <= lastSwallowedY + 1; y++)
            for (let x = lastSwallowedX - 1; x <= lastSwallowedX + 1; x++)
                if (x > 0 && x < COLNO && y >= 0 && y < ROWNO)
                    await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }
    const x = game.u.ux, y = game.u.uy;
    const positions = [
        [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
    ];
    const hallucinating = heroIsHallucinating(game);
    for (const [index, [dx, dy]] of positions.entries()) {
        if (index === 4)
            await displaySelf();
        const sx = x + dx, sy = y + dy;
        if (sx <= 0 || sx >= COLNO || sy < 0 || sy >= ROWNO)
            continue;
        const mnum = hallucinating
            ? rn2Display(MONSTER_COLOR.length) : game.u.ustuck.mnum;
        let color = MONSTER_COLOR[mnum] ?? NO_COLOR;
        // tty has no hilite for ordinary gray; black is dark gray (use_darkgray).
        if (color === CLR_GRAY)
            color = NO_COLOR;
        const appearance = swallowSymbolAppearance(index);
        const glyph = {
            ch: appearance.ch,
            color,
            decgfx: appearance.dec, kind: 'effect',
            glyph: GlyphOffset.swallow + mnum * 8 + index,
        };
        await show_glyph_cell(sx, sy, glyph.ch, color, glyph.decgfx, 0, glyph);
    }
    lastSwallowedX = x;
    lastSwallowedY = y;
}
function restrictedUnderwaterView() {
    return !!(game.u?.uinwater || game.underwater) && !Is_waterlevel(game.u?.uz);
}
function underwaterTerrain(x, y) {
    return isPoolOrLavaAt(x, y) || isIceAt(x, y);
}
// Native under_water(): mode 2 defers the full clear until the next update;
// mode 0 clears only the previous three-by-three view before drawing the new one.
export async function under_water(mode) {
    if (!game.level || Is_waterlevel(game.u.uz) || game.u.uswallow)
        return;
    const view = game._underwaterView ??= { position: null, fullRedrawPending: false };
    if (mode === 1 || view.fullRedrawPending) {
        await cls();
        view.fullRedrawPending = false;
    }
    else if (mode === 2) {
        view.fullRedrawPending = true;
        return;
    }
    else {
        const previous = view.position ?? { x: 0, y: 0 };
        for (let y = previous.y - 1; y <= previous.y + 1; y++)
            for (let x = previous.x - 1; x <= previous.x + 1; x++)
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    }
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (!underwaterTerrain(x, y))
                continue;
            if (heroIsBlind() && (x !== game.u.ux || y !== game.u.uy))
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
            else
                await newsym(x, y);
        }
    }
    view.position = { x: game.u.ux, y: game.u.uy };
}
// Native under_ground(): a full reset stays blank until the next hero update.
export async function under_ground(mode) {
    if (!game.level || game.u.uswallow)
        return;
    const view = game._undergroundView ??= { fullRedrawPending: false };
    if (mode === 1 || view.fullRedrawPending) {
        await cls();
        view.fullRedrawPending = false;
    }
    else if (mode === 2) {
        view.fullRedrawPending = true;
    }
    else
        await newsym(game.u.ux, game.u.uy);
}
async function redrawRestrictedMap(full) {
    if (restrictedUnderwaterView()) {
        await under_water(full || !game._underwaterView ? 1 : 0);
    }
    else {
        if (full || !game._undergroundView)
            await under_ground(1);
        if (!full)
            await under_ground(0);
    }
}
// ── docrt ──
// C display.c:docrt_flags(docrtRecalc). A screen reset pages the old message
// before clearing the terminal, then rebuilds sight and monster overlays.
export async function docrt({ beforeGlow = null } = {}) {
    if (!game.level || game.program_state.in_docrt)
        return;
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
                    await show_glyph_cell(x, y, memory.ch, memory.color, memory.decgfx, objectGlyphAttr(memory), memory);
                }
                else {
                    await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
                }
            }
        await vision_recalc(0);
        await see_monsters({ beforeGlow });
    }
    finally {
        game.program_state.in_docrt = false;
        game.context.botl = true;
    }
}
// Refresh map cells after an ordinary vision change or a temporary overlay.
// This does not reset the tty screen or require message acknowledgment.
export async function redrawMap() {
    if (!game.level)
        return;
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
            const monster = monsterAtMapCell(x, y);
            if (cansee(x, y) || (monster
                && (monsterProjectionAtCell(monster, x, y)
                    || !isWormTail(monster, x, y) && monsterHasWarningProjection(monster)))) {
                // newsym() displays Warning before correcting unseen floor
                // memory, just as it does for an identified monster.
                await newsym(x, y);
            }
            else if (loc?.remembered_glyph) {
                await showRememberedLocation(x, y, loc);
            }
            else {
                // Modal redraw reconstructs presentation from visibility and
                // memory.  Clear any old transient actor/warning overlay when
                // neither owner projects this square anymore.
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
            }
        }
    if (game.u?.ux > 0 && canSpotHeroSelf()) {
        await displaySelf();
    }
    // vision_recalc's newly visible cells were projected above; source docrt
    // then overlays fmon once more in linked-list order.
    await see_monsters();
}
// ── Serialize a map row with DEC line-drawing and ANSI colors ──
function render_map_row(y) {
    if (!game.level)
        return '';
    let firstCol = -1, lastCol = -1;
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level.at(x, y);
        if (loc?.disp_ch && loc.disp_ch !== ' ') {
            if (firstCol < 0)
                firstCol = x;
            lastCol = x;
        }
    }
    if (firstCol < 0)
        return '';
    let output = '';
    let activeColor = ANSI_DEFAULT; // default
    let activeDec = false;
    // Leading gap
    const gap = firstCol - 1;
    if (gap > 4)
        output += `\x1b[${gap}C`;
    else if (gap > 0)
        output += ' '.repeat(gap);
    for (let x = firstCol; x <= lastCol; x++) {
        const loc = game.level.at(x, y);
        const ch = loc?.disp_ch ?? ' ';
        const color = loc?.disp_color ?? NO_COLOR;
        const dec = !!loc?.disp_decgfx;
        if (ch === ' ') {
            // Space runs
            let run = 1;
            while (x + run <= lastCol && (game.level.at(x + run, y)?.disp_ch ?? ' ') === ' ')
                run++;
            if (activeDec) {
                output += '\x0f';
                activeDec = false;
            }
            if (run > 4)
                output += `\x1b[${run}C`;
            else
                output += ' '.repeat(run);
            x += run - 1;
            continue;
        }
        let wantAnsi = ANSI_COLOR[color] ?? ANSI_DEFAULT;
        if (wantAnsi !== activeColor) {
            output += `\x1b[${wantAnsi}m`;
            activeColor = wantAnsi;
        }
        // DEC mode switching
        if (dec && !activeDec) {
            output += '\x0e';
            activeDec = true;
        }
        else if (!dec && activeDec) {
            output += '\x0f';
            activeDec = false;
        }
        output += ch;
    }
    // Reset state at end of row (C does per-row SO/SI)
    if (activeColor !== ANSI_DEFAULT)
        output += `\x1b[${ANSI_DEFAULT}m`;
    if (activeDec)
        output += '\x0f';
    return output;
}
// ── Status lines ──
export function _statusLine1() {
    const u = game.u;
    if (!u)
        return '';
    const title = statusTitle(game);
    const stats = `St:${formatStrength(currentAttribute(A_STR))} `
        + `Dx:${currentAttribute(A_DEX)} Co:${currentAttribute(A_CON)} `
        + `In:${currentAttribute(A_INT)} Wi:${currentAttribute(A_WIS)} `
        + `Ch:${currentAttribute(A_CHA)}`;
    const align = u.ualign?.type === -1 ? 'Chaotic' : u.ualign?.type === 0 ? 'Neutral' : 'Lawful';
    if (game.flags.hitpointbar) {
        // wintty.c:4612 refreshes hpbar_crit_hp only when the HP field is
        // updated, so the dashes follow the sticky state; without a display
        // there is no sticky state yet.
        const highlights = game.nhDisplay?.statusHighlights;
        const critical = highlights
            ? highlights.barCritical
            : !!game.level && !!game.urole && !!game.urace && criticallyLowHp(true, game);
        return `${hitpointBar(title, critical)} ${stats} ${align}`;
    }
    // C uses cursor-forward for gap between title and stats
    // C pads to align stats starting at a fixed column
    const gap = Math.max(1, 31 - title.length);
    if (gap > 4)
        return `${title}\x1b[${gap}C${stats} ${align}`;
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}
// C ref: botl.c:get_strength_str(): strength values above 18 encode the exceptional
// 18/xx range; 118 is the traditional 18/** maximum.
export function formatStrength(value) {
    if (value == null)
        return '?';
    if (value <= 18)
        return String(value);
    if (value >= 119)
        return String(value - 100);
    if (value === 118)
        return '18/**';
    return `18/${String(value - 18).padStart(2, '0')}`;
}
export function _statusLine2() {
    const fields = statusLine2Fields(nearCapacity(game));
    return fields ? renderStatusLine2(fields, game.nhDisplay?.cols ?? COLNO).text : '';
}
// botl.c:check_gold_symbol(). This process flag changes at explicit
// option and level-change boundaries; dorecover() leaves it alone.
export function checkGoldSymbol() {
    game.iflags.invis_goldsym = objectClassSymbol(objectClassForType(GOLD_PIECE)) <= ' ';
}
function statusLine2Fields(capacity) {
    const u = game.u;
    if (!u)
        return null;
    const dungeonName = game.dungeons?.[u.uz?.dnum ?? 0]?.dname;
    const endgameLocation = endgameLevelName(u.uz)
        .replace(/^Plane of /, '');
    const location = Is_knox_level(u.uz) ? dungeonName ?? ''
        : In_quest(u.uz) ? `Home ${u.uz?.dlevel ?? 1}`
            : In_endgame(u.uz) ? endgameLocation
                : `${game._tutorialActive ? 'Tutorial' : 'Dlvl'}:${dungeonDepth(u.uz)}`;
    const polymorphed = Upolyd(u);
    // botl.c bounds the printed numbers without changing combat state.
    const currentHp = (polymorphed ? u.mh : u.uhp) ?? 0;
    const displayedHp = Math.max(0, Math.min(currentHp, 9999));
    const maximumHp = Math.min((polymorphed ? u.mhmax : u.uhpmax) ?? 0, 9999);
    const displayedPower = Math.min(u.uen ?? 0, 9999);
    const maximumPower = Math.min(u.uenmax ?? 0, 9999);
    const goldSymbol = activeObjectSymbols()[objectClassForType(GOLD_PIECE)] ?? '$';
    const goldLabel = game.iflags.invis_goldsym ? '$' : goldSymbol;
    const displayedAc = u.uac ?? 10;
    const displayedGold = Math.max(0, Math.min(999999, game._statusGoldOverride ?? heroGoldAmount(game)));
    const experience = polymorphed ? `HD:${MONSTER_LEVEL[u.umonnum ?? -1] ?? 0}`
        : `Xp:${u.ulevel || 1}${game.flags.showexp ? `/${u.uexp || 0}` : ''}`;
    const hungerLabel = ['Satiated', '', 'Hungry', 'Weak', 'Fainting', 'Fainted', 'Starved'][u.uhs ?? currentHungerState(game)];
    return {
        location, gold: `${goldLabel}:${displayedGold}`,
        health: { hitpoints: displayedHp, maximumHitpoints: maximumHp,
            power: displayedPower, maximumPower, armorClass: displayedAc },
        experience, moves: game.flags.time ? game.moves : null,
        hunger: hungerLabel ?? '',
        capacity,
        conditions: statusConditions(game),
        equipment: [
            { field: BL_WEAPON, text: game.flags.weaponstatus ? weaponStatus(game) : '' },
            { field: BL_ARMOR, text: game.flags.armorstatus ? armorStatus(game) : '' },
            { field: BL_TERRAIN, text: game.flags.terrainstatus ? statusTerrain(game) : '' },
        ].filter(entry => entry.text.length > 0),
        version: game.flags.showvers ? statusVersion(game.flags.versinfo) : '',
    };
}
// ── Serialize terminal grid for screen comparison ──
export function serialize_terminal_grid(display) {
    function characterAt(row, column) {
        const cell = display.grid[row]?.[column];
        if (!cell)
            throw new RangeError(`Missing terminal cell (${column}, ${row})`);
        return cell.ch;
    }
    let output = '';
    let lastRow = 0;
    for (let r = 0; r < display.rows; r++) {
        for (let c = 0; c < display.cols; c++) {
            if (characterAt(r, c) !== ' ') {
                lastRow = r;
                break;
            }
        }
    }
    for (let r = 0; r <= lastRow; r++) {
        let lastCol = -1;
        for (let c = display.cols - 1; c >= 0; c--) {
            if (characterAt(r, c) !== ' ') {
                lastCol = c;
                break;
            }
        }
        if (lastCol < 0) {
            if (r < lastRow)
                output += '\n';
            continue;
        }
        let firstCol = 0;
        for (let c = 0; c <= lastCol; c++) {
            if (characterAt(r, c) !== ' ') {
                firstCol = c;
                break;
            }
        }
        if (firstCol > 4)
            output += `\x1b[${firstCol}C`;
        else if (firstCol > 0)
            output += ' '.repeat(firstCol);
        for (let c = firstCol; c <= lastCol; c++)
            output += characterAt(r, c);
        if (r < lastRow)
            output += '\n';
    }
    return output;
}
function displayedStatusLines() {
    const display = game.nhDisplay;
    if (display?.statusVisible && !game._statusUpdatesDisabled)
        return display.statusLines ?? ['', ''];
    const row = (index) => game.nhDisplay?.grid[index]
        ?.map(cell => cell.ch).join('').trimEnd() ?? '';
    return [row(22), row(23)];
}
export function writeStatusLines(display, lines) {
    for (const [index, text] of lines.entries()) {
        const row = 22 + index;
        const plain = text.replace(/\x1b\[(\d+)C/g, (_match, count) => ' '.repeat(Number(count)));
        display.clearRow(row);
        let column = 0, attr = 0;
        for (const part of plain.split(/(\x1b\[[0-9;]+m)/)) {
            if (part.startsWith('\x1b[')) {
                if (part === '\x1b[7m')
                    attr |= ATR_INVERSE;
                else if (part === '\x1b[5m')
                    attr |= ATR_BLINK;
                else if (part === '\x1b[0m')
                    attr = 0;
                continue;
            }
            const visible = part.slice(0, Math.max(0, display.cols - 1 - column));
            display.putstr(column, row, visible, NO_COLOR, attr);
            column += visible.length;
        }
        if (display.statusVisible) {
            for (const span of display.statusHighlights.spans[index] ?? []) {
                if (span.hitpointBar) {
                    // wintty.c:5231-5253: the lit cells take the title
                    // cell's colour and attribute; the unlit tail keeps only
                    // the blink bit, and an empty bar (0 HP) keeps none.
                    const bar = display.statusHighlights.barSpanStyle();
                    const fill = span.fill ?? 0;
                    const blink = fill > 0 && bar.attr & ATR_BLINK ? ATR_BLINK : 0;
                    for (let col = span.start; col < Math.min(span.end, display.cols - 1); col++) {
                        const cell = display.grid[row]?.[col];
                        if (!cell)
                            continue;
                        const lit = col < span.start + fill;
                        display.setCell(col, row, cell.ch, lit ? bar.color : NO_COLOR, lit ? bar.attr : blink);
                    }
                    continue;
                }
                const style = display.statusHighlights.style(span);
                for (let col = span.start; col < Math.min(span.end, display.cols - 1); col++) {
                    const cell = display.grid[row]?.[col];
                    if (!cell)
                        continue;
                    display.setCell(col, row, cell.ch, style.color, style.attr);
                }
            }
        }
    }
}
// ── Build screen output ──
export function _buildScreenOutput() {
    const display = game?.nhDisplay;
    if (!display)
        return;
    let output = '';
    const blankMainWindow = !!game._suppressMapStatusForFlush;
    // Row 0: message
    const preserveMessageRow = display.preserveEmptyMessageRow
        && !game._pending_message && !game._retained_message && !game._promptOwnsTopline;
    const visibleMessage = game._pending_message
        || game._retained_message
        || (preserveMessageRow ? display.grid[0]?.map(cell => cell.ch).join('').trimEnd() : '')
        || '';
    // A corner window's docorner() erased the physical top line past its
    // left edge; the full-screen repaint must not restore it while the
    // clipped message still owns the row. Every topline writer resets the
    // clip when it repaints; the preserve cache holds the row otherwise.
    const messageText = preserveMessageRow || display.toplineClipColumn === null
        ? visibleMessage : clipToplineToColumn(visibleMessage, display.toplineClipColumn);
    if (game.program_state?.saving) {
        if (!preserveMessageRow) {
            display.clearRow(0);
            display.putstr(0, 0, messageText.slice(0, display.cols), NO_COLOR);
        }
        return;
    }
    output += messageText + '\n';
    // Rows 1-21: map (rendered with DEC + ANSI, per-row SO/SI)
    for (let y = 0; y < ROWNO; y++) {
        output += (blankMainWindow ? '' : render_map_row(y)) + '\n';
    }
    // Row 22-23: status
    const status = displayedStatusLines();
    output += (blankMainWindow ? '' : status[0]) + '\n';
    output += blankMainWindow ? '' : status[1];
    game._screen_output = output;
    // Also write to grid for serialize_terminal_grid
    if (display.grid) {
        if (preserveMessageRow) {
            for (let row = 1; row < display.rows; row++)
                display.repaintRow(row);
        }
        else {
            display.repaintScreen();
            // tty_putmixed() folds DEC markers before update_topl() paints.
            // Only the graphics kludge paints the leading glyph cell.
            const msg = messageText;
            if (msg.includes('\x0e')) {
                const cells = decodeMixedTopline(msg);
                for (const [c, cell] of cells.entries()) {
                    if (c >= display.cols)
                        break;
                    display.setCell(c, 0, cell.dec && !game._toplineGlyphPainted ? ' ' : cell.ch, NO_COLOR, 0);
                }
            }
            else {
                for (let c = 0; c < Math.min(msg.length, display.cols); c++)
                    display.setCell(c, 0, msg.charAt(c), NO_COLOR, 0);
            }
        }
        if (!blankMainWindow) {
            // Map — write characters to grid (DEC → Unicode for browser display)
            for (let y = 0; y < ROWNO; y++)
                writeMapRow(display, y);
            // Status lines
            writeStatusLines(display, status);
            const cursorOverride = game._cursorOverride;
            if (Array.isArray(cursorOverride)) {
                display.setCursor(cursorOverride[0], cursorOverride[1]);
            }
            else if (game.u?.ux > 0) {
                display.setCursor(game.u.ux - 1, game.u.uy + 1);
            }
        }
    }
}
export function writeMapRow(display, y) {
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level?.at(x, y);
        if (!loc?.disp_ch)
            continue;
        const color = loc.disp_color ?? NO_COLOR;
        const attr = loc.disp_attr ?? 0;
        const highlight = game._mapPositionHighlight;
        const frameColor = highlight?.background && game.flags.color !== false
            && highlight.isValidLocation(x, y) ? HI_ZAP : null;
        // Plain blanks erase retained tty glyphs. Colored AIR spaces still
        // use map painting so their foreground color survives.
        if (loc.disp_ch === ' ' && frameColor === null && !(attr & 5)
            && (color === NO_COLOR || color === CLR_GRAY)) {
            display.setCell(x - 1, y + 1, ' ', color, attr);
            continue;
        }
        writeMapCell(display, x, y, loc, frameColor);
    }
}
// C display.c:row_refresh(). Repaint the current glyph buffer without
// recomputing vision or choosing new hallucinated appearances.
export function row_refresh(start, stop, y) {
    const display = game.nhDisplay;
    if (!display || y < 0 || y >= ROWNO)
        return;
    const highlight = game._mapPositionHighlight;
    for (let x = Math.max(1, start); x <= Math.min(stop, COLNO - 1, display.cols - 1); x++) {
        const loc = game.level?.at(x, y);
        if (!loc?.disp_ch)
            continue;
        const framed = !!highlight?.background && highlight.isValidLocation(x, y);
        const frameColor = framed && game.flags.color !== false ? HI_ZAP : null;
        if (glyphAt(x, y)?.glyph === GlyphOffset.unexplored && !framed)
            continue;
        writeMapCell(display, x, y, loc, frameColor);
        display.setCursor(x, y + 1);
    }
}
function writeMapCell(display, x, y, loc, frameColor) {
    const ch = loc.disp_decgfx ? (DEC_TO_UNICODE[loc.disp_ch] || loc.disp_ch) : loc.disp_ch;
    const name = shownSymbolSet().name?.toLowerCase() ?? '';
    const byteGlyph = !loc.disp_decgfx && ROGUE_SYMSETS[name]?.ibm === true;
    display.setMapCell(x - 1, y + 1, ch, loc.disp_color ?? NO_COLOR, loc.disp_attr ?? 0, frameColor, byteGlyph);
}
// ── flush_screen ──
export async function flush_screen(mode) {
    if (suppressMapOutput() || game._suppressMapStatusForFlush)
        return;
    if (game.program_state?.windows_exited)
        return;
    // C display.c pauses map updates during level arrival. Message windows
    // still write their own rows while the old map remains on screen.
    if (mode === -1)
        game._mapFlushPaused = !game._mapFlushPaused;
    if (game._mapFlushPaused)
        return;
    updateStatusLines();
    const display = game.nhDisplay;
    const mapCursor = mode === 0 && display
        ? lastDirtyMapCursor() ?? [display.cursorCol, display.cursorRow] : null;
    _buildScreenOutput();
    if (!display || game.program_state.saving || game._suppressMapStatusForFlush)
        return;
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level?.at(x, y);
            if (loc)
                loc.gnew = 0;
        }
    }
    // print_glyph() advances the tty cursor; only a requested curs_on_u()
    // subsequently moves it back to the hero.
    if (mapCursor)
        display?.setCursor(...mapCursor);
}
export function clearMapDisplay() {
    for (let row = 1; row <= ROWNO; row++)
        game.nhDisplay?.clearRow(row);
}
// ── cls ──
export async function cls() {
    await flushPendingTopline();
    game.context.botl = true;
    const display = game?.nhDisplay;
    if (display?.clearScreen)
        display.clearScreen();
    game._pending_message = '';
    game._retained_message = '';
    game._toplineGlyphPainted = false;
    // clear_glyph_buffer() resets the buffer directly. This is not a
    // discovered glyph change, and default unexplored spaces are not dirty.
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const location = game.level?.at(x, y);
            if (!location)
                continue;
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
// ── bot ──
export async function bot() {
    refreshStatusLines();
}
// C botl.c:status_initialize(REASSESS_ONLY) resends every enabled field,
// replacing tty's shortened level label and empty capacity separator.
export function reassessStatusFields(state = game) {
    const display = state.nhDisplay;
    if (display) {
        display.statusLine2Fields = null;
        display.statusCapacityBlank = false;
        display.statusLevelPrefixChanged = false;
        display.statusHighlights.reset();
    }
    state.context.botl = true;
}
export function refreshStatusLines() {
    const display = game.nhDisplay;
    if (!display || game._statusUpdatesDisabled || game.program_state.saving
        || game.program_state.windows_exited || game._suppressMapStatusForFlush)
        return;
    // Native bot() needs youmonst.data, installed with the hero's species.
    if (game.u.uhp === -1 || game.u.umonnum === undefined) {
        game.context.botl = false;
        game.context.time_botl = false;
        return;
    }
    const capacity = nearCapacity(game);
    // botl.c notifies BL_CAP when its value changes; tty_status_update()
    // then clears any blank left by earlier encumbrance shortening.
    const capacityBlank = display.statusLine2Fields?.capacity === capacity
        && display.statusCapacityBlank;
    const fields = statusLine2Fields(capacity);
    const levelPrefixChanged = display.statusLine2Fields?.location === fields?.location
        && display.statusLevelPrefixChanged;
    display.statusLine2Fields = fields;
    const layout = display.statusLine2Fields
        ? renderStatusLine2(display.statusLine2Fields, display.cols, capacityBlank, levelPrefixChanged) : null;
    display.statusCapacityBlank = layout?.capacityBlank ?? false;
    display.statusLevelPrefixChanged = layout?.levelPrefixChanged ?? false;
    // The tty stores the hitpoint bar style while processing status updates
    // (wintty.c tty_status_update), so the title line is built afterwards.
    if (fields)
        display.statusHighlights.update(game, fields, objectClassSymbol(objectClassForType(GOLD_PIECE)));
    const firstLine = _statusLine1();
    const barFill = game.flags.hitpointbar
        ? hitpointBarFill(Upolyd(game.u) ? game.u.mh ?? 0 : game.u.uhp ?? 0, Upolyd(game.u) ? game.u.mhmax ?? 0 : game.u.uhpmax ?? 0)
        : 0;
    display.statusHighlights.spans = [firstStatusLineSpans(firstLine, !!game.flags.hitpointbar, barFill),
        layout?.spans ?? []];
    display.statusLines = [firstLine, layout?.text ?? ''];
    display.statusVisible = true;
    writeStatusLines(display, display.statusLines);
    game.context.botl = false;
    game.context.time_botl = false;
}
// C allmain.c once-per-input bot()/timebot(): the status window updates
// while map changes stay in the glyph buffer until the next flush_screen().
export function updateStatusLines() {
    if (game.context.botl || game.nhDisplay?.statusLines === null)
        refreshStatusLines();
    else if (game.context.time_botl)
        timebot();
}
// C calls this once per time-taking hero action, before the next bot().
// Zero-time menus and message flushes must not extend temporary highlights.
export function statusEvalNextUnhilite() {
    if (game.iflags.hiliteDelta && game.nhDisplay?.statusHighlights.evaluateNextUnhilite(game))
        game.context.botl = true;
}
// C botl.c:stat_update_time() notifies only BL_TIME. Other fields keep the
// values from the last bot(), even if game state changed during an occupation.
export function timebot() {
    if (game._statusUpdatesDisabled)
        return;
    game.context.time_botl = false;
    const display = game.nhDisplay;
    if (!display?.statusLines || !display.statusLine2Fields || !game.flags.time
        || game.program_state.saving || game.program_state.windows_exited
        || game._suppressMapStatusForFlush)
        return;
    const [first] = display.statusLines;
    display.statusLine2Fields = { ...display.statusLine2Fields, moves: game.moves };
    const layout = renderStatusLine2(display.statusLine2Fields, display.cols, display.statusCapacityBlank, display.statusLevelPrefixChanged);
    display.statusCapacityBlank = layout.capacityBlank;
    display.statusLevelPrefixChanged = layout.levelPrefixChanged;
    display.statusHighlights.updateTime(game);
    display.statusHighlights.spans = [display.statusHighlights.spans[0], layout.spans];
    display.statusLines = [first, layout.text];
    display.statusVisible = true;
    writeStatusLines(display, display.statusLines);
}
//# sourceMappingURL=display.js.map