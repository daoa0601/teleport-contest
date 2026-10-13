// display.js — Map rendering and terminal output.
// C ref: display.c — newsym, show_glyph, docrt, cls, flush_screen.
import { game, requireGameLevel } from './gstate.js';
import { monsterHasMapPosition, monsterAtPosition } from './monster_location.js';
import { redrawMonsterWormSegments } from './monster_worm.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { CmapSymbol, GlyphOffset, altarToGlyph, cmapToGlyph } from './glyph_numbers.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { heroWarnsOfMonster } from './hero_species.js';
import { artifactWarningFeedback } from './artifact_warning.js';
import { currentAttribute } from './attrib.js';
import { nhgetch } from './input.js';
import { currentHungerState } from './hunger.js';
import { cansee, couldsee, set_seenv, vision_recalc } from './vision.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, BC_BALL, BC_CHAIN, COLNO, ROWNO, STONE, ROOM, CORR, SCORR, SDOOR, DOOR, STAIRS, FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, TREE, IRONBARS, POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, AIR, CLOUD, IS_POOL, IS_OBSTRUCTED, IS_ROOM, IS_WALL, LADDER, LA_DOWN, DBWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN, SV0, SV1, SV2, SV3, SV4, SV5, SV6, SV7, WM_X_TL, WM_X_TR, WM_X_BL, WM_X_BR, WM_X_TLBR, WM_X_BLTR, BEAR_TRAP, WEB, VIBRATING_SQUARE, CORPSTAT_GENDER, CORPSTAT_FEMALE, ENGRAVE, BURN, HEADSTONE, is_pit, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, def_warnsyms, MON_STILL_ARRIVING, In_endgame, Is_rogue_level, Is_waterlevel, Is_knox_level, In_sokoban, PLNMSG_UNKNOWN, MONSEEN_NORMAL, MONSEEN_SEEINVIS, MONSEEN_INFRAVIS, MONSEEN_TELEPAT, MONSEEN_XRAYVIS, MONSEEN_DETECT, MONSEEN_WARNMON, PICK_NONE, PICK_ONE, Upolyd, ismnum, } from './const.js';
import { NO_COLOR, ATR_INVERSE, CLR_BLACK, CLR_RED, CLR_GREEN, CLR_GRAY, CLR_BROWN, CLR_MAGENTA, CLR_CYAN, CLR_WHITE, CLR_YELLOW, CLR_BLUE, CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, DEC_TO_UNICODE, } from './terminal.js';
import { LARGE_BOX, CHEST, GOLD_PIECE, FOOD_RATION, CORPSE, TOWEL, STATUE, BOULDER, OBJECT_BASES, OBJECT_COLOR, } from './object_data.js';
import { MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM, monsterTypeName, } from './monster_data.js';
import { rn2Display } from './rng.js';
import { BOGUS_MONSTERS, BOGUS_MONSTER_FILE_SIZE, } from './random_text_data.js';
import { depth as dungeonDepth, endgameLevelName } from './hacklib.js';
import { OBJECT_CLASS_SYMBOLS, recordObjectEncounter } from './object_knowledge.js';
import { heroGoldAmount } from './hero_gold.js';
import { encumbranceLabel, nearCapacity } from './weight.js';
import { heroCanReachFloor } from './floor_reach.js';
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
function activeObjectSymbols() {
    return Is_rogue_level(game.u?.uz)
        ? ROGUE_OBJECT_SYMBOLS : OBJECT_CLASS_SYMBOLS;
}
const M3_INFRAVISIBLE = 0x0200;
const M1_FLY = 0x00000001;
const M1_MINDLESS = 0x00010000;
const TELEPATHY_RANGE = 8 * 8; // BOLT_LIM squared
const HELM_OF_TELEPATHY = 100;
const AMULET_OF_ESP = 201;
const PM_LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
function unblindTelepathyRange() {
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
    const range = unblindTelepathyRange();
    if (range < 0)
        return false;
    const dx = monster.mx - game.u.ux;
    const dy = monster.my - game.u.uy;
    return dx * dx + dy * dy <= range;
}
// C mon_visible(): this does not check the square or sensory detection.
export function monsterVisible(monster) {
    const seesInvisible = !!(game.u?.seeInvisible
        || (game.u?.seeInvisibleTurns ?? 0) > 0);
    return (!monster.minvis || seesInvisible) && !monster.mundetected;
}
function seeMonsterWithInfrared(monster) {
    return !game.blind && !!game.u?.infravision
        && !!((MONSTER_FLAGS3[monster.mnum] ?? 0) & M3_INFRAVISIBLE)
        && couldsee(monster.mx, monster.my);
}
function canPhysicallyProjectMonster(monster, x, y) {
    return monsterVisible(monster) && (cansee(x, y) || seeMonsterWithInfrared(monster));
}
// C worm.c:worm_known(). The live head and occupied body share actor identity.
export function wormKnown(monster) {
    return cansee(monster.mx, monster.my)
        || (monster.wormSegments ?? []).some(segment => segment.x && cansee(segment.x, segment.y));
}
// C mon.c:monkilled(). Its death line is square-visible or worm-known,
// independently of whether the actor can be identified.
export function monsterKillLineVisible(monster) {
    return monster.wormno ? wormKnown(monster) : cansee(monster.mx, monster.my);
}
// C display.h:canseemon(), an actor-level optical sight query.
export function canSeeMonster(monster) {
    // While swallowed, the engulfer occupies the hero's coordinate but is
    // not a map-visible monster for canseemon(); attack text can still name
    // it through u.ustuck.
    if ((game.u?.uswallow || game.uswallow)
        && game.u?.ustuck === monster)
        return false;
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
    const sensed = canSenseMonster(monster);
    const located = sensed && (senseWithTelepathy(monster) || heroWarnsOfMonster(monster));
    const detected = sensed && heroDetectsMonsters();
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
        const location = game.level?.at(monster.mx, monster.my);
        if (distance > 2 || !location || !IS_POOL(location.typ))
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
    return def_warnsyms[level];
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
export function see_nearby_objects() {
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
            const wasGeneric = objectUsesGenericGlyph(object);
            // Unlike map_object(), display.c:see_nearby_objects() observes
            // every visible object inside the close-name radius.  Only the
            // repaint is conditional on its old glyph having been generic.
            if (heroIsHallucinating(game))
                continue;
            object.dknown = true;
            recordObjectEncounter(object.otyp);
            if (wasGeneric && object.dknown)
                newsym(x, y);
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
        return { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr) };
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
function showRememberedLocation(x, y, loc) {
    const memory = loc.remembered_glyph;
    if (!memory)
        return;
    const glyph = rememberedGlyph(memory, loc, x, y);
    loc.remembered_glyph = glyph;
    show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, objectGlyphAttr(glyph), glyph);
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
    [CLOUD, 'cloud'], [DRAWBRIDGE_UP, 'raised drawbridge'],
    [DRAWBRIDGE_DOWN, 'lowered drawbridge'],
]);
function terrainGlyphName(loc, x, y, glyph) {
    if (isArborealBackground(loc))
        return 'tree';
    if (IS_WALL(loc.typ) || loc.typ === SDOOR)
        return glyph.ch === ' ' ? 'stone' : 'wall';
    if (loc.typ === DOOR) {
        if (loc.doormask & D_ISOPEN)
            return 'open door';
        if (loc.doormask & (D_CLOSED | D_LOCKED))
            return 'closed door';
        return 'doorway';
    }
    if (loc.typ === STAIRS || loc.typ === LADDER) {
        return stairSymbol(loc, x, y).name;
    }
    if (loc.typ === CORR)
        return (cansee(x, y) ? loc.lit : loc.waslit) || game.flags?.lit_corridor
            ? 'lit corridor' : 'corridor';
    return TERRAIN_NAMES.get(loc.typ) || 'stone';
}
export function terrain_glyph(loc, x, y) {
    const appearance = terrainGlyphAppearance(loc, x, y);
    const typ = projectedTerrainType(loc);
    const symbol = terrainSymbolIndex(loc, x, y, typ, appearance);
    const branch = game.dungeons[game.u.uz?.dnum ?? 0];
    const wallOffset = branch?.dname === 'The Gnomish Mines' ? GlyphOffset.cmapMines
        : branch?.flags.hellish ? GlyphOffset.cmapGehennom
            : Is_knox_level(game.u.uz) ? GlyphOffset.cmapKnox
                : In_sokoban(game.u.uz) ? GlyphOffset.cmapSokoban : GlyphOffset.cmapMain;
    return {
        ...appearance, kind: 'terrain', terrainName: terrainGlyphName(loc, x, y, appearance),
        glyph: typ === ALTAR ? altarToGlyph(loc.flags) : cmapToGlyph(symbol, wallOffset),
    };
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
        return (cansee(x, y) ? loc.lit : loc.waslit) || game.flags.lit_corridor
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
    if (loc.typ === CROSSWALL)
        return projectedCrossWallType(loc);
    return projectedTWallType(loc);
}
function terrainGlyphAppearance(loc, x, y) {
    const typ = projectedTerrainType(loc);
    const rogue = Is_rogue_level(game.u?.uz);
    const dec = !rogue && /^DECgraphics$/i.test(game.symset || '');
    // C selects wall glyphs by branch, independently of puzzle completion.
    // dat/symbols overrides the gray base color with blue for DEC Sokoban walls.
    const inMines = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname
        === 'The Gnomish Mines';
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? -1]?.flags?.hellish;
    const wallColor = rogue ? NO_COLOR
        : In_sokoban(game.u?.uz)
            ? (dec ? CLR_BLUE : NO_COLOR)
            : inMines ? CLR_BROWN
                : inHell ? CLR_RED : NO_COLOR;
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
        // C back_to_glyph(): a corridor currently lit for display uses S_litcorr.
        // tty renders that CLR_GRAY symbol with its bright foreground treatment;
        // CLR_WHITE is the equivalent serialized color in this port.
        case CORR: return {
            ch: '#',
            color: (cansee(x, y) ? loc.lit : loc.waslit)
                || game.flags?.lit_corridor ? CLR_WHITE : NO_COLOR,
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
                : { ch: '.', color: NO_COLOR, dec: false }; // D_NODOOR = floor
        case STAIRS:
        case LADDER: {
            if (typ === STAIRS && rogue)
                return { ch: '%', color: NO_COLOR, dec: false };
            // Ordinary and branch stairs share their direction symbols.
            const symbol = stairSymbol(loc, x, y);
            return { ch: symbol.ch, color: symbol.color, dec: false };
        }
        case FOUNTAIN: return { ch: '{', color: CLR_BRIGHT_BLUE, dec: false };
        case THRONE: return { ch: '\\', color: CLR_YELLOW, dec: false };
        case SINK: return { ch: '{', color: CLR_WHITE, dec: false };
        case GRAVE: return { ch: '|', color: CLR_WHITE, dec: false };
        case ALTAR:
            // DECgraphics uses the altar's pi glyph.  Unaligned altars are red;
            // aligned variants retain the terminal's ordinary foreground until
            // their full alignment-color projection is needed.
            return dec
                ? { ch: '{', color: loc.flags ? NO_COLOR : CLR_RED, dec: true }
                : { ch: '_', color: loc.flags ? NO_COLOR : CLR_RED, dec: false };
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
        ch: MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[mnum] ?? 0] || '?',
        // tty renders black and ordinary gray monster glyphs through its
        // default foreground rather than retaining an explicit color code.
        color: rawColor === CLR_BLACK || rawColor === CLR_GRAY
            ? NO_COLOR : rawColor,
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
    // display.h:hero_glyph and you.h:Ugender select the current body's sex.
    // Hero glyph identity still changes when the tty symbol remains '@'.
    const polymorphed = Upolyd(game.u);
    const mnum = polymorphed || !game.flags.showrace
        ? game.u.umonnum : game.urace?.mnum;
    if (!ismnum(mnum))
        throw new Error('Hero glyph requires an initialized species');
    const glyph = displayMonsterGlyph(mnum, polymorphed ? !!game.u.mfemale : !!game.flags.female);
    return polymorphed ? glyph
        : { ...glyph, ch: game.flags.showrace ? glyph.ch : '@', color: CLR_WHITE };
}
// C display.h:canspotself().  See-invisible does not make the hero's own
// glyph opaque again; ordinary self projection depends on not being
// invisible, while telepathy/detection can supply a sensory projection.
function canSpotHeroSelf() {
    const invisible = !!(game.u?.invisible || game.u?.invis || game.invisible);
    const canSeeSelf = !!(game.blind || game.u?.uswallow
        || (!invisible && !game.u?.uundetected));
    const sensesSelf = unblindTelepathyRange() >= 0 || heroDetectsMonsters();
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
        ch: activeObjectSymbols()[oclass] || '?',
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
        ? MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[object.corpsenm] ?? 0]
        : null;
    const species = (object.otyp === CORPSE || object.otyp === STATUE)
        && object.corpsenm !== undefined ? { corpsenm: object.corpsenm } : {};
    const glyph = objectGlyphNumber(object, piletop);
    // reset_glyphmap() resolves both normal and generic object numbers
    // through objects[].oc_class, including a mimic's zero-class disguise.
    const displayedType = objectUsesGenericGlyph(object) ? object.oclass : object.otyp;
    return statueSymbol
        ? {
            ch: statueSymbol, color: CLR_WHITE, decgfx: false,
            kind: 'object', otyp: object.otyp, ...species, glyph,
            statueGlyph: true, piletop,
        }
        : {
            ch: activeObjectSymbols()[objectClassForType(displayedType)] || '?',
            color: objectColor(object), decgfx: false,
            kind: 'object', otyp: object.otyp, ...species, glyph,
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
export function transientMonsterGlyph(monster) {
    return displayMonsterGlyph(heroIsHallucinating()
        ? rn2Display(MONSTER_COLOR.length) : monster.mnum, !!monster.female);
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
        // tty does not emit explicit black/ordinary-gray foreground unless
        // dark-gray is enabled; those object glyphs use the default color.
        color: glyph.color === CLR_BLACK || glyph.color === CLR_GRAY
            ? NO_COLOR : glyph.color,
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
    return objectGlyph({
        otyp,
        oclass,
        ...(monster.mcorpsenm === undefined ? {} : { corpsenm: monster.mcorpsenm }),
        dknown: true,
    });
}
// C refs: display.c map_background(), map_object(), and map_trap().  These
// update hero memory independently from ordinary line-of-sight newsym().
export function map_background(x, y, show = true) {
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    const glyph = terrain_glyph(loc, x, y);
    if (game.level?.flags?.hero_memory)
        loc.remembered_glyph = {
            ...glyph, decgfx: glyph.dec,
        };
    if (show)
        show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec, 0, glyph);
}
function requireDisplayLocation(x, y) {
    const location = requireGameLevel().at(x, y);
    if (!location)
        throw new RangeError(`Display coordinate (${x}, ${y}) is outside the map`);
    return location;
}
// C display.c:magic_map_background(). Unlike ordinary mapping, this keeps
// remembered objects and invisible markers and corrects never-seen lighting.
export function magic_map_background(x, y, show = true) {
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
        || ['terrain', 'trap', 'engraving'].includes(remembered.kind))) {
        location.remembered_glyph = { ...glyph, decgfx: glyph.dec };
    }
    if (show)
        show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.dec, 0, glyph);
    updateLastSeenTerrain(x, y);
}
export function map_object(object, show = true, observe = true) {
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
        show_glyph_cell(object.ox, object.oy, glyph.ch, glyph.color, false, objectGlyphAttr(glyph), glyph);
}
const TRAP_COLOR = [
    NO_COLOR, CLR_CYAN, CLR_CYAN, CLR_GRAY, CLR_BROWN, CLR_CYAN,
    CLR_RED, CLR_GRAY, CLR_BRIGHT_BLUE, CLR_BLUE, CLR_ORANGE,
    0, 0, CLR_BROWN, CLR_BROWN, CLR_MAGENTA, CLR_MAGENTA,
    CLR_BRIGHT_MAGENTA, CLR_GRAY, CLR_GRAY, CLR_BRIGHT_BLUE,
    CLR_BRIGHT_BLUE, CLR_BRIGHT_GREEN, CLR_MAGENTA, CLR_ORANGE, CLR_ORANGE,
];
export function transientTrapGlyph(trap) {
    return {
        ch: trap.ttyp === WEB ? '"' : trap.ttyp === VIBRATING_SQUARE ? '~' : '^',
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
        show_glyph_cell(x, y, shown.ch, shown.color, shown.decgfx ?? shown.dec, 0, shown);
        await flush_screen(1);
        await game.animationFrame?.();
    }
}
export function map_trap(trap, show = true) {
    if (!trap)
        return;
    trap.tseen = true;
    const glyph = transientTrapGlyph(trap);
    const loc = game.level?.at(trap.tx, trap.ty);
    if (loc && game.level?.flags?.hero_memory)
        loc.remembered_glyph = glyph;
    if (show)
        show_glyph_cell(trap.tx, trap.ty, glyph.ch, glyph.color, false, 0, glyph);
}
export function map_engraving(engraving, show = true) {
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
        show_glyph_cell(engraving.x, engraving.y, ch, CLR_BRIGHT_BLUE, false, 0, glyph);
}
function engravingAt(x, y) {
    return game.level?.engravings?.find(engraving => engraving.x === x && engraving.y === y);
}
function coversNonlivingLocation(x, y) {
    const typ = game.level?.at(x, y)?.typ;
    const underwater = !!(game.underwater || game.u?.uinwater);
    // C display.h:covers_objects()/covers_traps(). Pools cease covering the
    // lower layers while the hero is underwater; lava always covers them.
    return (typ !== undefined && IS_POOL(typ) && !underwater)
        || typ === LAVAPOOL || typ === LAVAWALL;
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
        typ = mimicAppearance(monster);
    }
    location.lastseentyp = typ;
}
// C display.c:_map_location(). This direct mapper intentionally bypasses
// line of sight, but object observation and cloud visibility keep their gates.
export function map_location(x, y, show = true) {
    const covered = coversNonlivingLocation(x, y);
    const level = requireGameLevel();
    const object = level.objects?.[x]?.[y]?.[0];
    const trap = level.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    const engraving = engravingAt(x, y);
    const typ = requireDisplayLocation(x, y).typ;
    if (object && !covered) {
        map_object(object, show);
    }
    else if (trap?.tseen && !covered) {
        map_trap(trap, show);
    }
    else if (engraving?.erevealed && !covered
        && (typ === ROOM || typ === CORR || typ === ICE)) {
        map_engraving(engraving, show);
    }
    else {
        map_background(x, y, show);
    }
    updateLastSeenTerrain(x, y);
    if (show && !heroIsBlind() && visibleMapRegionAt(x, y))
        showMapRegion(x, y);
}
// C display.c:feel_newsym(). Known terrain changes update memory by touch
// when the hero is blind.
export function feel_newsym(x, y) {
    if (heroIsBlind())
        feel_location(x, y);
    else
        newsym(x, y);
}
// C display.c:feel_location().  Blind explicit search refreshes each adjacent
// nonliving layer before it tests for a concealed monster or trap.  This is
// why a felt floor object can remain in hero memory after a later invisible
// actor marker is installed elsewhere during the same search.
export function feel_location(x, y) {
    if (game.in_mklev || game.program_state.saving)
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
        map_location(x, y, true);
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
        darkenFeltFloor(x, y, loc);
    }
    else {
        const boulder = game.level?.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
        const closedDoor = loc.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED));
        if (IS_OBSTRUCTED(loc.typ) || closedDoor)
            map_background(x, y, true);
        else if (boulder)
            map_object(boulder, true);
        else if (loc.typ === DOOR)
            map_background(x, y, true);
        else if (IS_ROOM(loc.typ) || IS_POOL(loc.typ)) {
            const glyph = loc.remembered_glyph;
            // Native touch clears the ordinary boulder glyph, retaining pile memory.
            const forgottenBoulder = glyph?.glyph === GlyphOffset.object + BOULDER
                || glyph?.kind === 'invisible';
            if (forgottenBoulder && loc.typ !== ROOM)
                map_background(x, y, true);
            else if (forgottenBoulder || glyph?.kind === 'terrain'
                && glyph.glyph !== undefined && glyph.glyph >= cmapToGlyph(CmapSymbol.stone)
                && glyph.glyph < cmapToGlyph(CmapSymbol.darkroom)) {
                const dark = (game.flags.dark_room ?? true) && game.flags.color !== false
                    && !Is_rogue_level(game.u.uz);
                rememberFeltRoom(x, y, loc, dark ? CmapSymbol.darkroom
                    : loc.waslit ? CmapSymbol.room : CmapSymbol.stone);
            }
        }
        else {
            map_background(x, y, true);
            darkenFeltFloor(x, y, loc);
        }
    }
    if (monster && (x !== game.u.ux || y !== game.u.uy) && canSenseMonster(monster)) {
        const located = senseWithTelepathy(monster) || heroWarnsOfMonster(monster);
        displayMonsterAtCell(monster, x, y, {
            wormTail: isWormTail(monster, x, y),
            showAppearance: located, detected: !located,
        });
    }
}
function rememberFeltRoom(x, y, location, symbol) {
    const dark = symbol === CmapSymbol.darkroom;
    // reglyph_darkroom() uses the floor symbol only with dark_room and color.
    const floor = symbol === CmapSymbol.room
        || dark && (game.flags.dark_room ?? true) && game.flags.color !== false;
    const dec = /^DECgraphics$/i.test(game.symset || '') && !Is_rogue_level(game.u.uz);
    const glyph = {
        ch: floor ? dec ? '~' : '.' : ' ',
        color: dark ? 16 : NO_COLOR,
        decgfx: floor && dec,
        kind: 'terrain', terrainName: dark ? 'dark part of a room'
            : floor ? 'floor of a room' : 'stone',
        glyph: cmapToGlyph(symbol),
    };
    location.remembered_glyph = glyph;
    show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
}
function darkenFeltFloor(x, y, location) {
    const glyph = location.remembered_glyph;
    if (location.typ === ROOM && glyph?.glyph === cmapToGlyph(CmapSymbol.room)
        && (!location.waslit || (game.flags.dark_room ?? true) && game.flags.color !== false)) {
        // Grounded touch chooses darkroom even on Rogue levels or without color.
        rememberFeltRoom(x, y, location, (game.flags.dark_room ?? true) ? CmapSymbol.darkroom : CmapSymbol.stone);
    }
    else if (location.typ === CORR && glyph?.glyph === cmapToGlyph(CmapSymbol.litcorr)
        && !location.waslit) {
        const corridor = { ...glyph, color: NO_COLOR, glyph: cmapToGlyph(CmapSymbol.corr) };
        location.remembered_glyph = corridor;
        show_glyph_cell(x, y, corridor.ch, corridor.color, corridor.decgfx, 0, corridor);
    }
}
// ── show_glyph_cell ──
export function glyphAt(x, y, state = game) {
    const loc = state.level?.at(x, y);
    return loc?.disp_glyph || loc?.remembered_glyph || null;
}
export function show_glyph_cell(x, y, ch, color = NO_COLOR, decgfx = false, attr = 0, glyph = null) {
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    // symbols.c:assign_graphics(ROGUESET) selects the classic character set
    // and marks it nocolor.  Keep that policy at the final map-cell boundary
    // so hero, monster, object, trap, and remembered overlays agree.
    if (Is_rogue_level(game.u?.uz)) {
        color = NO_COLOR;
        decgfx = false;
    }
    const nextGlyph = glyph || { kind: 'effect' };
    // reset_glyphmap() marks a corridor engraving which shares '#'
    // with corridors; tty_print_glyph() makes that glyph inverse.
    if (nextGlyph.glyph === cmapToGlyph(CmapSymbol.engrcorr) && ch === '#'
        && game.flags.use_inverse !== false && game.iflags.use_inverse !== false
        && game.iflags.wc_inverse !== false)
        attr |= ATR_INVERSE;
    if (game.flags.color === false) {
        color = NO_COLOR;
        // reset_glyphmap() marks ice sharing the floor symbol with MG_BW_ICE.
        // tty_print_glyph() displays that flag inversely when permitted.
        if (nextGlyph.glyph === cmapToGlyph(CmapSymbol.ice)
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
    if (!cansee(x, y))
        return;
    try {
        for (const ch of SHIELD_STATIC) {
            show_glyph_cell(x, y, ch, CLR_BRIGHT_BLUE, false);
            await flush_screen(1);
            g.nhDisplay?.setCursor((g.u?.ux ?? 1) - 1, (g.u?.uy ?? 0) + 1);
            await g.animationFrame?.();
        }
    }
    finally {
        newsym(x, y);
    }
}
// C display.c:map_invisible().  Unlike a transient actor overlay, an unseen
// attacker's `I` is hero memory and must survive later blind redraws until a
// caller explicitly discovers that the square no longer contains that
// threat.  It also remains authoritative on a physically visible square
// whose monster still cannot be spotted.
export function map_invisible(x, y) {
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
    show_glyph_cell(x, y, 'I', NO_COLOR, false, 0, { kind: 'invisible', glyph: GlyphOffset.invisible });
}
// C display.c:unmap_object(). Clearing stale object or invisible-creature
// memory restores a known trap, engraving, or background without revealing
// another floor object that was hidden underneath it.
export function unmapObject(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc || !game.level?.flags.hero_memory)
        return;
    const covered = coversNonlivingLocation(x, y);
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && !covered) {
        map_trap(trap, false);
    }
    else if (loc.seenv) {
        const engraving = engravingAt(x, y);
        const showsEngraving = loc.typ === ROOM
            || loc.typ === CORR || loc.typ === ICE;
        if (engraving && showsEngraving && !covered) {
            if (cansee(x, y))
                engraving.erevealed = true;
            map_engraving(engraving, false);
        }
        else {
            map_background(x, y, false);
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
export function unmap_invisible(x, y, show = true) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind !== 'invisible')
        return false;
    unmapObject(x, y);
    if (show)
        newsym(x, y);
    return true;
}
export function displaySelf() {
    // display.h:maybe_display_usteed() gives a visible steed its own identity.
    const steed = game.u.usteed;
    const glyph = steed && monsterVisible(steed)
        ? displayMonsterGlyph(heroIsHallucinating() ? rn2Display(MONSTER_COLOR.length) : steed.mnum, !!steed.female, 'ridden')
        : heroDisplayGlyph();
    show_glyph_cell(game.u.ux, game.u.uy, glyph.ch, glyph.color, false, 0, glyph);
}
// C display.c:newsym_force(). A forced redraw prints even an unchanged glyph.
export function newsym_force(x, y) {
    newsym(x, y);
    const location = game.level?.at(x, y);
    if (location)
        location.gnew = 1;
}
// ── newsym ──
function monsterDisplayAttribute(monster) {
    if ((monster.pet || (monster.mtame ?? 0) > 0) && !heroIsHallucinating()
        && game.flags?.hilite_pet)
        return 1;
    const inverse = game.flags?.use_inverse !== false
        && game.iflags?.use_inverse !== false && game.iflags?.wc_inverse !== false;
    return howMonsterSeen(monster) === MONSEEN_DETECT && inverse ? 1 : 0;
}
// C show_mon_or_warn(): a located actor replaces remembered invisibility.
// Its departure must reveal the lower layer rather than restore a stale I.
function showMonsterOrWarning(x, y, glyph, attr = 0) {
    if (game.level?.at(x, y)?.remembered_glyph?.kind === 'invisible') {
        unmapObject(x, y);
        const object = game.level?.objects[x]?.[y]?.[0];
        if (cansee(x, y) && object)
            map_object(object, false);
    }
    show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, attr, glyph);
}
function visibleMapRegionAt(x, y) {
    return (game.level?.regions || []).find(region => region.visible
        && region.ttl !== -2 && region.cells?.some(cell => cell.x === x && cell.y === y)) || null;
}
function showMapRegion(x, y) {
    const region = visibleMapRegionAt(x, y);
    if (!region)
        return;
    const poisonous = region.damage > 0;
    show_glyph_cell(x, y, '#', poisonous ? CLR_BRIGHT_GREEN : NO_COLOR, false, 0, { kind: 'terrain', terrainName: poisonous ? 'poison cloud' : 'cloud',
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
    const seesInvisible = !!game.u?.seeInvisible;
    const ordinaryVisible = !blind && !monster.mundetected
        && M_AP_TYPE(monster) !== M_AP_FURNITURE
        && M_AP_TYPE(monster) !== M_AP_OBJECT
        && (!monster.minvis || seesInvisible);
    return ordinaryVisible && dx * dx + dy * dy <= range * (range + 1);
}
export function newsym(x, y) {
    if (game.in_mklev || game.program_state.saving)
        return;
    const loc = game.level?.at(x, y);
    if (!loc)
        return;
    // C newsym() permits only the hero cell while swallowed.  The stomach
    // renderer bypasses newsym(), so monster movement and memory repairs must
    // not leak ordinary map glyphs back into the cleared viewport.
    if (game.u?.uswallow) {
        if (game.u.ux === x && game.u.uy === y)
            displaySelf();
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
    if (region && !monsterOverridesMapRegion(monster, x, y)) {
        // region.c:show_region() uses the gas-cloud cmap glyph.  Visible gas
        // overlays ordinary distant monsters but not sensed/warned or
        // adjacent otherwise-visible actors.
        showMapRegion(x, y);
        return;
    }
    if (game.u?.ux === x && game.u?.uy === y) {
        // C maps the nonliving layer into memory before optionally drawing
        // the hero.  When canspotself() is false, that layer is also the live
        // projection at the hero's coordinate.
        const spotSelf = canSpotHeroSelf();
        if (physicallyVisible)
            map_location(x, y, !spotSelf);
        else
            feel_location(x, y);
        if (!spotSelf)
            return;
        displaySelf();
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
            map_location(x, y, false);
        }
        displayMonsterAtCell(monster, x, y, projection);
        return;
    }
    const warning = isWormTail(monster, x, y) ? null : warningProjection(monster);
    if (warning) {
        showMonsterOrWarning(x, y, { ...warning, decgfx: false, kind: 'warning',
            glyph: GlyphOffset.warning + Number(warning.ch) });
        return;
    }
    if (loc.remembered_glyph?.kind === 'invisible') {
        map_invisible(x, y);
        return;
    }
    // Only update display/memory if cell is IN_SIGHT (lit and visible)
    if (physicallyVisible) {
        map_location(x, y, true);
    }
    else if (loc.remembered_glyph) {
        showRememberedLocation(x, y, loc);
    }
    else {
        // A living glyph is only an overlay.  When its actor vacates an
        // unseen, never-mapped square, restore unexplored space rather than
        // leaving a presentation-only duplicate behind.
        show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'terrain', terrainName: 'stone', glyph: GlyphOffset.cmapStone });
    }
}
// C display.c:display_monster(). Sight updates and touch share this renderer,
// while their callers choose independently which monsters can be projected.
function displayMonsterAtCell(monster, x, y, projection) {
    const loc = requireDisplayLocation(x, y);
    // A visible disguise enters memory even when a sense exposes its
    // owner. Reading glyphAt() must not reroll this display-only choice.
    const sensed = canSenseMonster(monster)
        || game.u?.protectionFromShapeChangers
        || game.protectionFromShapeChangers;
    if (projection.showAppearance) {
        if (M_AP_TYPE(monster) === M_AP_OBJECT) {
            map_object({
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
            const symbol = MAP_SYMBOLS[mimicAppearance(monster)];
            if (symbol) {
                const glyph = {
                    ch: symbol.ch, color: symbol.color, decgfx: false,
                    kind: 'terrain', terrainName: symbol.name,
                    glyph: cmapToGlyph(mimicAppearance(monster)),
                };
                loc.remembered_glyph = glyph;
                if (!sensed) {
                    show_glyph_cell(x, y, glyph.ch, glyph.color, false, 0, glyph);
                    return;
                }
            }
        }
        else if (M_AP_TYPE(monster) === M_AP_MONSTER
            && Number.isInteger(monster.mappearance)) {
            const mnum = heroIsHallucinating()
                ? rn2Display(MONSTER_COLOR.length) : mimicAppearance(monster);
            const glyph = displayMonsterGlyph(mnum, !!monster.female);
            show_glyph_cell(x, y, glyph.ch, glyph.color, false, (monster.pet || (monster.mtame ?? 0) > 0)
                && game.flags?.hilite_pet ? 1 : 0, glyph);
            if (!sensed)
                return;
        }
    }
    const monsterState = (monster.pet || (monster.mtame ?? 0) > 0) && !heroIsHallucinating()
        ? 'pet' : projection.detected ? 'detected' : 'normal';
    if (heroIsHallucinating()) {
        const displayMnum = rn2Display(MONSTER_COLOR.length);
        const glyph = displayMonsterGlyph(displayMnum, !!monster.female, monsterState);
        showMonsterOrWarning(x, y, glyph, monsterDisplayAttribute(monster));
    }
    else {
        const tailGlyph = projection.wormTail ? displayMonsterGlyph(PM_LONG_WORM_TAIL) : null;
        showMonsterOrWarning(x, y, {
            ch: tailGlyph?.ch || monster.symbol || '?',
            color: tailGlyph ? tailGlyph.color
                : monster.mnum === 102 ? NO_COLOR
                    : monster.mnum === 100 || monster.mnum === 239 ? CLR_BROWN
                        : (MONSTER_COLOR[monster.mnum]
                            ?? monster.color ?? CLR_GRAY),
            decgfx: false, kind: 'monster',
            mnum: projection.wormTail ? PM_LONG_WORM_TAIL : monster.mnum,
            glyph: monsterGlyphNumber(projection.wormTail ? PM_LONG_WORM_TAIL : monster.mnum, !!monster.female, monsterState),
        }, monsterDisplayAttribute(monster));
    }
    monster.meverseen = 1;
}
// C ref: display.c:see_monsters(). Warning, telepathy, and visible regions
// can change how a stationary monster is projected when only the hero moves;
// repainting solely on actor movement leaves stale warning numerals behind.
export async function see_monsters({ beforeGlow = null } = {}) {
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
        newsym(monster.mx, monster.my);
        if (monster.wormno)
            redrawMonsterWormSegments(monster);
        if (game.u.warnOfMonster
            && ((game.context.warntype?.obj ?? 0) & (MONSTER_FLAGS2[monster.mnum] ?? 0)))
            count++;
    }
    if (count !== game.warn_obj_cnt) {
        await artifactWarningFeedback(count, { beforeGlow });
        game.warn_obj_cnt = count;
    }
    if (!game.u?.usteed && game.u?.ux > 0)
        newsym(game.u.ux, game.u.uy);
}
// C display.c:see_objects()/see_traps().  fobj is newest-first globally,
// while only each square's pile-top is eligible for a redraw.
export function see_objects() {
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
        newsym(object.ox, object.oy);
}
export function see_traps() {
    for (const trap of game.level?.traps || []) {
        const loc = game.level?.at?.(trap.tx, trap.ty);
        if (loc?.remembered_glyph?.kind === 'trap')
            newsym(trap.tx, trap.ty);
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
    if (!game.level || !game.u?.uswallow || !game.u?.ustuck)
        return;
    if (first) {
        for (let y = 0; y < ROWNO; y++)
            for (let x = 1; x < COLNO; x++)
                show_glyph_cell(x, y, ' ', NO_COLOR, false);
    }
    else if (lastSwallowedX > 0) {
        for (let y = lastSwallowedY - 1; y <= lastSwallowedY + 1; y++)
            for (let x = lastSwallowedX - 1; x <= lastSwallowedX + 1; x++)
                if (x > 0 && x < COLNO && y >= 0 && y < ROWNO)
                    show_glyph_cell(x, y, ' ', NO_COLOR, false);
    }
    const x = game.u.ux, y = game.u.uy;
    const positions = [
        [-1, -1, '/', false], [0, -1, 'o', true], [1, -1, '\\', false],
        [-1, 0, 'x', true], [1, 0, 'x', true],
        [-1, 1, '\\', false], [0, 1, 's', true], [1, 1, '/', false],
    ];
    const hallucinating = heroIsHallucinating(game);
    for (const [dx, dy, ch, decgfx] of positions) {
        const sx = x + dx, sy = y + dy;
        if (sx <= 0 || sx >= COLNO || sy < 0 || sy >= ROWNO)
            continue;
        const mnum = hallucinating
            ? rn2Display(MONSTER_COLOR.length) : game.u.ustuck.mnum;
        let color = MONSTER_COLOR[mnum] ?? NO_COLOR;
        // tty maps black and ordinary gray through its default foreground.
        if (color === CLR_BLACK || color === CLR_GRAY)
            color = NO_COLOR;
        show_glyph_cell(sx, sy, ch, color, decgfx);
    }
    displaySelf();
    lastSwallowedX = x;
    lastSwallowedY = y;
}
function restrictedUnderwaterView() {
    return !!(game.u?.uinwater || game.underwater) && !Is_waterlevel(game.u?.uz);
}
function underwaterTerrain(x, y) {
    const location = game.level?.at(x, y);
    const typ = location?.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location?.typ;
    return (typ !== undefined && IS_POOL(typ)) || typ === LAVAPOOL || typ === LAVAWALL || typ === ICE;
}
// C under_water()/under_ground(): map memory survives while the viewport is
// restricted. A full underground reset is blank until the next hero update.
function redrawRestrictedMap(full) {
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++)
            show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored', glyph: GlyphOffset.unexplored });
    if (!restrictedUnderwaterView()) {
        if (!full)
            newsym(game.u.ux, game.u.uy);
        return;
    }
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (underwaterTerrain(x, y)
                && (!heroIsBlind() || x === game.u.ux && y === game.u.uy))
                newsym(x, y);
        }
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
            swallowed(true);
            return;
        }
        if (restrictedUnderwaterView() || game.u?.uburied) {
            await cls();
            redrawRestrictedMap(true);
            return;
        }
        vision_recalc(2);
        await cls();
        for (let y = 0; y < ROWNO; y++)
            for (let x = 1; x < COLNO; x++) {
                const loc = game.level.at(x, y);
                if (loc?.remembered_glyph) {
                    showRememberedLocation(x, y, loc);
                }
                else {
                    show_glyph_cell(x, y, ' ', NO_COLOR, false);
                }
            }
        vision_recalc(0);
        await see_monsters({ beforeGlow });
    }
    finally {
        game.program_state.in_docrt = false;
    }
}
// Refresh map cells after an ordinary vision change or a temporary overlay.
// This does not reset the tty screen or require message acknowledgment.
export async function redrawMap() {
    if (!game.level)
        return;
    if (game.u?.uswallow) {
        swallowed(true);
        return;
    }
    if (restrictedUnderwaterView() || game.u?.uburied) {
        redrawRestrictedMap(false);
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
                && monsterProjectionAtCell(monster, x, y))) {
                newsym(x, y);
            }
            else if (loc?.remembered_glyph) {
                showRememberedLocation(x, y, loc);
            }
            else {
                // Modal redraw reconstructs presentation from visibility and
                // memory.  Clear any old transient actor/warning overlay when
                // neither owner projects this square anymore.
                show_glyph_cell(x, y, ' ', NO_COLOR, false);
            }
        }
    if (game.u?.ux > 0 && canSpotHeroSelf()) {
        displaySelf();
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
    const name = game.displayName || game.plname || 'Hero';
    const level = u.ulevel ?? 1;
    const rankIndex = level <= 2 ? 0
        : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
    const rank = game.urole?.title?.[rankIndex];
    const monsterTitle = (game.u?.mtimedone ?? 0) > 0
        ? (MONSTER_NAME[game.u.umonnum ?? -1] || 'monster')
            .replace(/\b\w/g, letter => letter.toUpperCase())
        : null;
    const role = monsterTitle || (game.flags?.female
        ? (rank?.f || rank?.m || game.urole?.name?.f || game.urole?.name?.m)
        : (rank?.m || game.urole?.name?.m));
    const title = `${name} the ${role}`;
    const stats = `St:${formatStrength(currentAttribute(A_STR))} `
        + `Dx:${currentAttribute(A_DEX)} Co:${currentAttribute(A_CON)} `
        + `In:${currentAttribute(A_INT)} Wi:${currentAttribute(A_WIS)} `
        + `Ch:${currentAttribute(A_CHA)}`;
    const align = u.ualign?.type === 0 ? 'Neutral' : (u.ualign?.type ?? -1) > 0 ? 'Lawful' : 'Chaotic';
    // C uses cursor-forward for gap between title and stats
    // C pads to align stats starting at a fixed column
    const gap = Math.max(1, 31 - title.length);
    if (gap > 4)
        return `${title}\x1b[${gap}C${stats} ${align}`;
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}
// C ref: botl.c strbuf(): strength values above 18 encode the exceptional
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
export function _statusLine2(refreshLoad = true) {
    const u = game.u;
    if (!u)
        return '';
    const dungeonName = game.dungeons?.[u.uz?.dnum ?? 0]?.dname;
    const endgameLocation = endgameLevelName(u.uz)
        .replace(/^Plane of /, '');
    const location = game._tutorialActive ? `Tutorial:${dungeonDepth(u.uz)}`
        : dungeonName === 'The Quest' ? `Home ${u.uz?.dlevel ?? 1}`
            : In_endgame(u.uz) ? endgameLocation
                : `Dlvl:${dungeonDepth(u.uz)}`;
    const polymorphed = (u.mtimedone ?? 0) > 0;
    // botl.c bounds the printed numbers without changing combat state.
    const currentHp = game._statusHpOverride
        ?? (polymorphed ? u.mh : u.uhp) ?? 0;
    const displayedHp = Math.max(0, Math.min(currentHp, 9999));
    const maximumHp = Math.min((polymorphed ? u.mhmax : u.uhpmax) ?? 0, 9999);
    const displayedPower = Math.min(u.uen ?? 0, 9999);
    const maximumPower = Math.min(u.uenmax ?? 0, 9999);
    const goldSymbol = Is_rogue_level(u.uz) ? '*' : '$';
    const displayedAc = game._statusAcOverride
        ?? game._statusProjectedAc ?? u.uac ?? 10;
    const displayedGold = game._statusGoldOverride
        ?? heroGoldAmount(game);
    let line = `${location} ${goldSymbol}:${displayedGold} HP:${displayedHp}(${maximumHp}) Pw:${displayedPower}(${maximumPower}) AC:${displayedAc}`;
    if (polymorphed) {
        line += ` HD:${MONSTER_LEVEL[u.umonnum ?? -1] ?? 0}`;
    }
    else {
        line += ` Xp:${u.ulevel || 1}`;
        if (game.flags?.showexp)
            line += `/${u.uexp || 0}`;
    }
    if (game.flags?.time)
        line += ` T:${game.moves ?? 1}`;
    if (u.usteed)
        line += ' Ride';
    const hungerLabel = ['Satiated', '', 'Hungry', 'Weak', 'Fainting', 'Fainted', 'Starved'][game._statusHungerOverride ?? u.uhs ?? currentHungerState(game)];
    if (hungerLabel)
        line += ` ${hungerLabel}`;
    const load = refreshLoad ? encumbranceLabel(nearCapacity(game)) : u._encumbrance;
    if (load)
        line += ` ${load}`;
    if (u.strangled || (u.strangledTurns ?? 0) > 0)
        line += ' Strngl';
    if (game.blind)
        line += ' Blind';
    if (polymorphed
        && ((MONSTER_FLAGS1[u.umonnum ?? -1] ?? 0) & M1_FLY))
        line += ' Fly';
    if ((u.confusionTurns ?? 0) > 0)
        line += ' Conf';
    if ((game._statusDeafOverride ?? game.deaf))
        line += ' Deaf';
    if (heroIsHallucinating(game))
        line += ' Hallu';
    if (u.stunned || (u.stunnedTurns ?? 0) > 0)
        line += ' Stun';
    return line;
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
function statusLines(update) {
    // C botl.c:bot() reserves uhp == -1 for saving. It leaves both status
    // rows untouched, even when real damage happens to produce that value.
    if (!update || game._statusUpdatesDisabled || game.u.uhp === -1) {
        const row = (index) => game.nhDisplay?.grid[index]
            ?.map(cell => cell.ch).join('').trimEnd() ?? '';
        return [row(22), row(23)];
    }
    // A map flush retains the displayed load until native code requests bot().
    if (game.context.botl) {
        game.u._encumbrance = encumbranceLabel(nearCapacity(game));
        game.context.botl = false;
    }
    return [_statusLine1(), _statusLine2(false)];
}
function writeStatusLines(display, lines) {
    for (const [index, text] of lines.entries()) {
        const row = 22 + index;
        const plain = text.replace(/\x1b\[(\d+)C/g, (_match, count) => ' '.repeat(Number(count)));
        display.clearRow(row);
        display.putstr(0, row, plain.slice(0, display.cols), NO_COLOR);
    }
}
// ── Build screen output ──
function _buildScreenOutput(updateStatus = true) {
    const display = game?.nhDisplay;
    if (!display)
        return;
    let output = '';
    const blankMainWindow = !!game._suppressMapStatusForFlush;
    // Row 0: message
    const visibleMessage = game._pending_message
        || game._retained_message || '';
    if (game.program_state?.saving) {
        display.clearRow(0);
        display.putstr(0, 0, visibleMessage.slice(0, display.cols), NO_COLOR);
        return;
    }
    output += visibleMessage + '\n';
    // Rows 1-21: map (rendered with DEC + ANSI, per-row SO/SI)
    for (let y = 0; y < ROWNO; y++) {
        output += (blankMainWindow ? '' : render_map_row(y)) + '\n';
    }
    // Row 22-23: status
    const status = statusLines(updateStatus);
    output += (blankMainWindow ? '' : status[0]) + '\n';
    output += blankMainWindow ? '' : status[1];
    game._screen_output = output;
    // Also write to grid for serialize_terminal_grid
    if (display.grid) {
        display.clearScreen();
        // Message line
        const msg = visibleMessage;
        for (let c = 0; c < Math.min(msg.length, display.cols); c++)
            display.setCell(c, 0, msg.charAt(c), NO_COLOR, 0);
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
function writeMapRow(display, y) {
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level?.at(x, y);
        if (!loc?.disp_ch)
            continue;
        const color = loc.disp_color ?? NO_COLOR;
        const attr = loc.disp_attr ?? 0;
        // Plane-of-Air AIR is a cyan space. Preserve its foreground color
        // between cloud glyphs; ordinary default/gray blanks stay sparse.
        if (loc.disp_ch === ' ' && !(attr & 5)
            && (color === NO_COLOR || color === CLR_GRAY))
            continue;
        const ch = loc.disp_decgfx ? (DEC_TO_UNICODE[loc.disp_ch] || loc.disp_ch) : loc.disp_ch;
        display.setCell(x - 1, y + 1, ch, color, attr);
    }
}
// ── flush_screen ──
export async function flush_screen(mode) {
    if (game.program_state?.windows_exited)
        return;
    // C display.c pauses map updates during level arrival. Message windows
    // still write their own rows while the old map remains on screen.
    if (mode === -1)
        game._mapFlushPaused = !game._mapFlushPaused;
    if (game._mapFlushPaused)
        return;
    if (game.context.botl)
        refreshStatusLines();
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
    const display = game?.nhDisplay;
    if (display?.clearScreen)
        display.clearScreen();
    game._pending_message = '';
    game._retained_message = '';
}
// C tty_clear_nhwindow(WIN_MESSAGE). A seen prompt still occupies the
// physical message row; clearing it is separate from acknowledging input.
export function clearMessageWindow(coveredRows) {
    const text = game._pending_message || game._retained_message || '';
    const display = game.nhDisplay;
    // The line editor wraps at character boundaries, unlike update_topl().
    // Its rendered row count is authoritative when clearing its prompt.
    const rows = coveredRows ?? toplineRows(text, display?.cols ?? COLNO).length;
    game._pending_message = '';
    game._retained_message = '';
    if (!display)
        return;
    display.clearRow(0);
    // tty_clear_nhwindow(WIN_MESSAGE) calls docorner() only for rows the
    // message covered. Menus and text windows below those rows stay visible.
    for (let row = 1; row < Math.min(rows, display.rows); row++) {
        display.clearRow(row);
        if (row <= ROWNO && !game._suppressMapStatusForFlush)
            writeMapRow(display, row - 1);
    }
    // docorner() asks bot() to restore covered status rows. getlin() keeps
    // status updates disabled through this cleanup, leaving those rows blank.
    if (rows > ROWNO + 1)
        refreshStatusLines();
    display.setCursor(0, 0);
}
// ── bot ──
export async function bot() {
    refreshStatusLines();
}
function refreshStatusLines() {
    const display = game.nhDisplay;
    if (!display || game._statusUpdatesDisabled || game.u.uhp === -1 || game.program_state.saving
        || game.program_state.windows_exited || game._suppressMapStatusForFlush)
        return;
    game.u._encumbrance = encumbranceLabel(nearCapacity(game));
    delete game._statusHungerOverride;
    game.context.botl = false;
    writeStatusLines(display, statusLines(true));
}
// ── pline ──
export async function pline(msg) {
    if (game.program_state?.windows_exited) {
        if (msg) {
            rawPrint(msg);
            game._lastPlineKind = PLNMSG_UNKNOWN;
        }
        return;
    }
    // C pline.c:vpline() resolves any pending blocker/light change before it
    // flushes the map or negotiates tty's previous-topline pager.
    if (game.vision_full_recalc)
        vision_recalc(0);
    if (game.u.ux)
        await flush_screen(1);
    game._pending_message = msg;
    game._retained_message = '';
    game._last_message = msg;
    game._lastPlineMessage = msg;
    game._lastPlineKind = PLNMSG_UNKNOWN;
}
function decodeMixedTopline(message) {
    const cells = [];
    let dec = false;
    for (let index = 0; index < message.length; index++) {
        const ch = message.charAt(index);
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
            while (end < message.length && /[0-9;]/.test(message.charAt(end)))
                end++;
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
function toplineRows(message, columns) {
    const cells = decodeMixedTopline(message);
    // tty update_topl() replaces a space with a newline. A single oversized
    // word is left intact; topl_putsym() then wraps it at the last column.
    let start = 0;
    while (cells.length - start >= columns) {
        let split = start + columns - 1;
        while (split > start && cells[split]?.ch !== ' ')
            split--;
        if (split === start) {
            split = cells.findIndex((cell, index) => index >= start && cell.ch === ' ');
            if (split < 0)
                break;
        }
        cells[split] = { ch: '\n', dec: false };
        start = split + 1;
    }
    let line = [];
    const lines = [line];
    for (const cell of cells) {
        if (cell.ch === '\n') {
            line = [];
            lines.push(line);
        }
        else {
            if (line.length === columns - 1) {
                line = [];
                lines.push(line);
            }
            line.push(cell);
        }
    }
    return lines;
}
// C update_topl()/topl_putsym(): key queries wrap without a More prompt.
// Return the rows covered so tty_yn_function's cleanup can restore the map.
export function renderKeyPrompt(message, cursorOffset = 0) {
    const display = game.nhDisplay;
    const lines = toplineRows(message, display?.cols ?? COLNO);
    if (!display)
        return lines.length;
    for (const [row, line] of lines.entries()) {
        display.clearRow(row);
        for (const [column, cell] of line.entries())
            display.setCell(column, row, cell.ch, NO_COLOR, 0);
    }
    const lastLine = lines.at(-1) ?? lines[0];
    display.setCursor(lastLine.length + cursorOffset, lines.length - 1);
    return lines.length;
}
export async function moreUntilDismissed(message, { urgent = false } = {}) {
    await pline(message);
    return pageTopline(message, { urgent });
}
// C tty_message_menu(): the preceding prompt has already been answered.
// A selectable singleton uses bare tty output, without pline's status update.
export async function showMessageMenu(letter, pickMode, message) {
    if (pickMode === PICK_NONE) {
        await plineWithContinuation(message);
        return 0;
    }
    game._pending_message = message;
    game._retained_message = '';
    const menuLetter = letter.charCodeAt(0);
    const key = await pageTopline(message, { menuLetter });
    return key === menuLetter || key === 27 ? key : 0;
}
// tty more() acknowledges existing output. A window-only display does not
// call bot(), so it must retain status even if game state changed meanwhile.
async function pageTopline(message, { urgent = false, menuLetter } = {}) {
    const display = game.nhDisplay;
    const columns = display?.cols ?? 80;
    const lines = toplineRows(message, columns);
    const moreCells = [...'--More--'].map(ch => ({ ch, dec: false }));
    const finalMessageLine = lines.at(-1) ?? lines[0];
    let finalLine = finalMessageLine;
    if (finalMessageLine.length + moreCells.length < columns)
        finalMessageLine.push(...moreCells);
    else {
        finalLine = moreCells;
        lines.push(finalLine);
    }
    // tty more() only acknowledges the message window. Map changes queued
    // after that message stay buffered until their caller flushes the map.
    if (display?.grid) {
        for (const [row, line] of lines.entries()) {
            display.clearRow(row);
            for (const [col, cell] of line.entries())
                display.setCell(col, row, cell.ch, NO_COLOR, 0);
        }
        display.setCursor(finalLine.length, lines.length - 1);
    }
    let key;
    do
        key = await nhgetch();
    while (key !== menuLetter && ![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    if (menuLetter !== undefined) {
        // Escape cancels this selection only. Both wrapped text and a More
        // marker pushed onto a map row need native more()'s docorner cleanup.
        game._suppressMessagesUntilInput = false;
        game._retained_message = '';
        if (lines.length > 1)
            _buildScreenOutput(false);
        else
            display?.clearRow(0);
        display?.setCursor(0, 0);
        return key;
    }
    // more() repairs covered map rows after any dismissal. Escape also
    // erases a one-line message; WIN_NOSTOP only prevents output suppression.
    game._retained_message = '';
    if (lines.length > 1) {
        _buildScreenOutput(false);
        display?.setCursor(0, 0);
    }
    else if (key === 27) {
        display?.clearRow(0);
        display?.setCursor(0, 0);
    }
    else {
        game._retained_message = message + '--More--';
    }
    if (key === 27 && !urgent)
        game._suppressMessagesUntilInput = true;
    return key;
}
// Opening a tty text window flushes any older topline before the window is
// displayed.  Quest pages and other modal producers use this boundary when a
// time-consuming command has left ordinary prose pending for the scheduler.
export async function flushPendingTopline() {
    const pending = game._pending_message || '';
    return pending ? pageTopline(pending) : null;
}
// C tty_display_nhwindow(WIN_MESSAGE): unlike a direct more(), the window
// display honors Escape's WIN_STOP/WIN_CANCELLED flag before acknowledging.
export async function displayMessageWindow() {
    if (game._suppressMessagesUntilInput)
        return null;
    const dismissal = await flushPendingTopline();
    clearMessageWindow();
    return dismissal;
}
// C tty topl.c:update_topl().  A later pline either appends to the pending
// topline or owns a --More-- boundary before replacing it.  Keep this policy
// at the terminal layer so source callers can remain ordinary sequential
// pline() producers.
export async function plineWithContinuation(msg, { noRepeat = false, urgent = false } = {}) {
    if (!msg)
        return;
    if (game.program_state?.windows_exited) {
        rawPrint(msg);
        game._lastPlineKind = PLNMSG_UNKNOWN;
        return;
    }
    if (urgent && game._suppressMessagesUntilInput) {
        game._suppressMessagesUntilInput = false;
        game._pending_message = '';
        game._retained_message = '';
    }
    if (!urgent && noRepeat && msg === game._lastPlineMessage)
        return;
    // vpline() flushes the map before tty decides whether older prose needs
    // acknowledgment. Direct message-window display does not do this.
    if (game.vision_full_recalc)
        vision_recalc(0);
    if (game.u.ux)
        await flush_screen(1);
    // Escape stops tty prose after vpline has refreshed the display.
    if (!urgent && game._suppressMessagesUntilInput)
        return;
    const pending = game._pending_message || '';
    const visibleLength = (message) => /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message)
        ? decodeMixedTopline(message).length : message.length;
    const columns = game.nhDisplay?.cols ?? 80;
    const wraps = toplineRows(msg, columns).length > 1;
    let dismissal;
    if (!pending) {
        await pline(msg);
        dismissal = wraps
            ? await pageTopline(msg, { urgent }) : null;
    }
    else if (!msg.startsWith('You die')
        && visibleLength(msg) + visibleLength(pending) + 3 < columns - 8) {
        await pline(`${pending}  ${msg}`);
    }
    else {
        dismissal = await pageTopline(pending, { urgent });
        // Escape suppresses later lines, not the line which forced this pager.
        await pline(msg);
        if ((dismissal !== 27 || urgent) && wraps)
            dismissal = await pageTopline(msg, { urgent });
    }
    // C pline.c tracks the last individual message, not the joined tty line.
    game._lastPlineMessage = msg;
    return dismissal;
}
function writeRawText(text) {
    const display = game.nhDisplay;
    if (!display)
        return;
    for (const ch of text) {
        if (ch === '\r') {
            display.setCursor(0, display.cursorRow);
        }
        else if (ch === '\n') {
            const row = display.cursorRow + 1;
            if (row >= display.rows)
                display.scrollUp();
            display.setCursor(0, Math.min(row, display.rows - 1));
        }
        else {
            if (display.cursorCol >= display.cols)
                writeRawText('\n');
            display.setCell(display.cursorCol, display.cursorRow, ch, NO_COLOR, 0);
            display.setCursor(display.cursorCol + 1, display.cursorRow);
        }
    }
    display.flush();
}
export function rawPrint(message) {
    writeRawText(`${message}\n`);
}
// The browser has no host tty to restore after exit_nhwindows(). Keep the
// terminal diagnostic separate from map/status output, with Native's getret.
export async function beginPanicOutput() {
    if (!game.nhDisplay)
        return;
    rawPrint('\r\nOops...');
    writeRawText('\nHit space to continue: ');
    game._suppressMessagesUntilInput = false;
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay.clearScreen();
    game.program_state.windows_exited = true;
}
//# sourceMappingURL=display.js.map