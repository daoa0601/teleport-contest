// mklev.js — Level generation.
// C ref: mklev.c — makelevel, makerooms, makecorridors, generate_stairs.
// Also includes parts of sp_lev.c (create_room) and mkmap.c (litstate_rnd).
// Stripped-down version for contest: generates regular dungeon levels with
// room placement, corridors, doors, stairs, niches, and fill.
// Uses the real game PRNG (not a separate layout PRNG) for bit-exact parity.

import { game } from './gstate.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import {
    createDesBindings, mapOrigin, objectTypeForName, regionCoordinates,
} from './lua/des.js';
import { createSelectionApi } from './lua/selection.js';
import {
    LuaUserdata, luaTableToArray, objectToLuaTable,
} from './lua/runtime.js';
import { nextIdent } from './ident.js';
import { GameMap } from './game.js';
import { rn2, rnd, rn1, rne, rnz, d } from './rng.js';
import { init_rect, rnd_rect, get_rect, split_rects } from './rect.js';
import {
    depth as depth_of_level, ledgerNo, maxLedgerNo,
} from './hacklib.js';
import { level_difficulty } from './dungeon.js';
import { mkmap } from './mkmap.js';
import {
    COLNO, ROWNO, STONE, ROOM, CORR, DOOR, STAIRS, LADDER,
    HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    D_NODOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED,
    OROOM, VAULT, COURT, SWAMP, BEEHIVE, MORGUE, BARRACKS, ZOO,
    TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, DELPHI, THEMEROOM,
    SHOPBASE, ROOMOFFSET, MAXNROFROOMS, SHARED,
    SDOOR, SCORR, IRONBARS, FOUNTAIN, SINK, ALTAR, GRAVE, THRONE,
    HEADSTONE, ENGRAVE, BURN, MARK, DUST, ENGR_BLOOD,
    DIR_N, DIR_S, DIR_E, DIR_W, DIR_180,
    XL_UP, XL_DOWN, XL_LEFT, XL_RIGHT,
    ACCESSIBLE, IS_WALL, IS_STWALL, IS_DOOR, IS_ROOM, IS_OBSTRUCTED,
    IS_FURNITURE, IS_POOL,
    IS_AIR, IS_LAVA, In_endgame, Is_earthlevel, Is_botlevel, Is_stronghold,
    Invocation_lev, Is_rogue_level,
    SPACE_POS, isok, W_NONDIGGABLE, W_NONPASSWALL, FILL_NORMAL,
    ICE, MOAT, POOL, WATER, LAVAPOOL, LAVAWALL,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DBWALL,
    ICED_POOL, ICED_MOAT,
    DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_MOAT, DB_LAVA,
    TREE, AIR, CLOUD,
    A_NONE, A_CHAOTIC, A_NEUTRAL, A_LAWFUL,
    AM_SHRINE, AM_SANCTUM, Align2amask,
    LR_DOWNSTAIR, LR_UPSTAIR, LR_UPTELE, LR_DOWNTELE,
    M_AP_FURNITURE, M_AP_OBJECT, M_AP_MONSTER,
    MM_ANGRY, MM_ASLEEP, MM_NONAME, MM_NOGRP, MM_EMIN, MM_EPRI,
    MM_NOWAIT, MM_NOTAIL, MM_IGNOREWATER, MM_ADJACENTOK,
    MM_NOCOUNTBIRTH, MM_NOMSG, MM_MALE, MM_FEMALE, MM_EDOG, NO_MINVENT,
    G_EXTINCT, G_GENOD, G_NOCORPSE,
    W_AMUL, CORPSTAT_FEMALE, CORPSTAT_MALE, CORPSTAT_HISTORIC, CORPSTAT_INIT,
    STRAT_APPEARMSG, STRAT_CLOSE, STRAT_WAITFORU,
    WM_X_BL, WM_X_BLTR, WM_X_BR, WM_X_TL, WM_X_TLBR, WM_X_TR,
} from './const.js';
import {
    OBJECT_BASES, OBJECT_PROB, OBJECT_MATERIAL, OBJECT_DIR,
    OBJECT_SPELL_LEVEL,
    OBJECT_SUBTYPE, OBJECT_MERGE, OBJECT_USES_KNOWN, OBJECT_WEIGHT,
    CHARGED_OBJECTS,
    WORM_TOOTH, UNICORN_HORN, HELM_OF_OPPOSITE_ALIGNMENT,
    GAUNTLETS_OF_FUMBLING, FUMBLE_BOOTS, LEVITATION_BOOTS,
    AMULET_OF_STRANGULATION, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_CHANGE,
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR,
    LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
    BAG_OF_TRICKS, TALLOW_CANDLE, WAX_CANDLE, BRASS_LANTERN,
    OIL_LAMP,
    MAGIC_LAMP, EXPENSIVE_CAMERA,
    CRYSTAL_BALL, TINNING_KIT, CAN_OF_GREASE, FIGURINE, MAGIC_MARKER,
    LAND_MINE, BEARTRAP,
    MAGIC_FLUTE, FROST_HORN, FIRE_HORN, HORN_OF_PLENTY, MAGIC_HARP,
    DRUM_OF_EARTHQUAKE, CORPSE, EGG, MEAT_RING,
    GLOB_OF_GRAY_OOZE, GLOB_OF_BLACK_PUDDING, KELP_FROND,
    SLIME_MOLD, MELON, CREAM_PIE, CANDY_BAR, TIN, GOLD_PIECE, NOVEL,
    DILITHIUM_CRYSTAL, LUCKSTONE, LOADSTONE, TOUCHSTONE,
    ROCK, BOULDER, STATUE, DART, DAGGER, SPEAR, SLING, ORCISH_DAGGER, MACE,
    QUARTERSTAFF,
    BULLWHIP, FEDORA,
    ELVEN_ARROW, ELVEN_SPEAR, ELVEN_DAGGER, ELVEN_SHORT_SWORD,
    ELVEN_BROADSWORD, ELVEN_BOW, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT,
    ELVEN_CLOAK, ELVEN_SHIELD, ELVEN_BOOTS,
    ORCISH_ARROW, ORCISH_SHORT_SWORD, ORCISH_BOW, ORCISH_HELM,
    ORCISH_CHAIN_MAIL, ORCISH_CLOAK, URUK_HAI_SHIELD, ORCISH_SHIELD,
    SCIMITAR, AXE, PICK_AXE, DWARVISH_SPEAR, DWARVISH_SHORT_SWORD,
    DWARVISH_MATTOCK, DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT,
    DWARVISH_CLOAK, DWARVISH_ROUNDSHIELD, IRON_SHOES,
    HELMET, SPLINT_MAIL, RING_MAIL, SMALL_SHIELD, ROBE,
    CLOAK_OF_PROTECTION, CLOAK_OF_MAGIC_RESISTANCE,
    LEATHER_ARMOR, LEATHER_JACKET, LEATHER_GLOVES,
    MIRROR, POT_OBJECT_DETECTION, SHIELD_OF_REFLECTION,
    SPE_BOOK_OF_THE_DEAD,
    AMULET_OF_LIFE_SAVING, SADDLE,
    WAN_CANCELLATION, WAN_LIGHT, WAN_LIGHTNING,
} from './object_data.js';
import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_DIFFICULTY, MONSTER_GENO,
    MONSTER_ALIGNMENT, MONSTER_LEVEL,
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3,
    MONSTER_SYMBOL, MONSTER_SIZE, MONSTER_MOVE,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_COLOR, MONSTER_NAME, MONSTER_RESISTS,
    SPECIAL_PM, monsterIsNonliving,
} from './monster_data.js';
import { petLifeSavingGap } from './mondeath.js';
import { nhgetch } from './input.js';
import { flush_screen, newsym, pline } from './display.js';
import { premap_detect } from './detect.js';
import {
    TRUE_RUMORS, FALSE_RUMORS, RANDOM_ENGRAVINGS, RANDOM_EPITAPHS,
} from './random_text_data.js';
import { makeEngravingAt, wipeoutText } from './engrave.js';
import { registerQuestLeader } from './quest.js';
import { armorBonus } from './armor.js';
import { initializeMonsterArmor } from './monworn.js';
import { artifactByName, nameArtifact } from './artifacts.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory,
} from './monster_inventory.js';
import { setupElementalBubbles } from './elemental.js';
import { putSaddleOnMonster } from './steed.js';
import { roomForIndex, roomsAt } from './room.js';
import {
    occupied, somex, somey, somexy, somexyspace,
} from './mkroom.js';
import { createHarmlessGasCloudSelection } from './regions.js';
import { beginObjectBurn } from './light.js';
import {
    claimNextDueObjectTimer, LEVEL_TIMER_KIND, OBJECT_TIMER_KIND,
    objectTimers, objectsInTimerGraph, peekNextDueObjectTimer,
    scheduleLevelTimer, scheduleObjectTimer, stopAllObjectTimers,
    stopLevelTimer, stopObjectTimer,
} from './object_timers.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { objectWeight } from './weight.js';
import { curseObjectState } from './object_state.js';
import {
    mergable as objectsMergable, mergeObjectStacks,
} from './object_merge.js';
import { vision_note_blocker_change } from './vision.js';
import { monsterGoodPosition } from './teleport_rules.js';
import {
    randomDefensiveMonsterItem, randomMiscMonsterItem,
    randomOffensiveMonsterItem,
} from './muse.js';
import {
    SpecialSelection,
    match_maptyps,
    mapCharacterType,
    specialSelectionFillRect,
    specialSelectionMatch,
} from './selvar.js';

// Object/class constants (normally from objects.js, not in contest template)
const RANDOM_CLASS = 0;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const M2_DOMESTIC = 0x00400000;
const G_NOGEN = 0x0200;
const G_IGNORE = 0x8000;
const MAXMONNO = 120;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
// shknam.c's health-food pseudo-class lives just above the real object
// classes and is resolved by shkveg(), not by mkobj().
const VEGETARIAN_CLASS = 15;
const PLACEHOLDER_MONSTERS = new Set([72, 169, 260, 264]);
const SCR_TELEPORTATION = 333;
const RIN_TELEPORTATION = 194;
const SCR_LIGHT = 332;
const CROSSBOW_BOLT = 23;
const ARROW = 18;
const KNIFE = 40;
const ATHAME = 38;
const BATTLE_AXE = 45;
const SHORT_SWORD = 46;
const SILVER_SABER = 51;
const SILVER_MACE = 74;
const TWO_HANDED_SWORD = 55;
const STILETTO = 41;
const PARTISAN = 59;
const RANSEUR = 60;
const SPETUM = 61;
const GLAIVE = 62;
const LUCERN_HAMMER = 69;
const AKLYS = 80;
const CLUB = 77;
const BOW = 83;
const CROSSBOW = 88;
const PLATE_MAIL = 121;
const CRYSTAL_PLATE_MAIL = 122;
const DENTED_POT = 95;
const BANDED_MAIL = 125;
const STUDDED_LEATHER_ARMOR = 131;
const LARGE_SHIELD = 156;
const LOW_BOOTS = 163;
const HIGH_BOOTS = 165;
const LEATHER_CLOAK = 146;
const MUMMY_WRAPPING = 138;
const TIN_WHISTLE = 245;
const SPE_LIGHT = 372;
const POT_OIL = 321;
const BELL = 255;
const CANDELABRUM_OF_INVOCATION = 262;
const BELL_OF_OPENING = 263;
const LONG_SWORD = 54;
const SPBOOK_no_NOVEL = -SPBOOK_CLASS;

// Supply chest items
const POT_HEALING = 307;
const POT_EXTRA_HEALING = 308;
const POT_SPEED = 302;
const POT_GAIN_ENERGY = 313;
const POT_FULL_HEALING = 315;
const SCR_ENCHANT_WEAPON = 328;
const SCR_ENCHANT_ARMOR = 323;
const SCR_CONFUSE_MONSTER = 325;
const SCR_SCARE_MONSTER = 326;
const WAN_DIGGING = 428;
const SPE_HEALING = 374;
const FOOD_RATION = 293;
const CRAM_RATION = 292;
const LEMBAS_WAFER = 291;
const SKELETON_KEY = 221;
const SCR_CHARGING = 342;
const WAN_STRIKING = 417;
const WAN_TELEPORTATION = 424;
const WAN_MAGIC_MISSILE = 429;
const WAN_NOTHING = 416;
const WAN_FIRE = 430;
const WAN_COLD = 431;
const WAN_SLEEP = 432;
const WAN_DEATH = 433;
const PM_SHOPKEEPER = 271;
const PM_GUARD = 272;
const PM_HORNED_DEVIL = 291;
const PM_ERINYS = 292;
const PM_BALROG = 302;
const PM_YEENOGHU = 304;
const PM_ORCUS = 305;
const PM_DISPATER = 307;
const PM_ASMODEUS = 309;
const PM_GIANT_SPIDER = 96;
const PM_MINOTAUR = 177;
const PM_ETTIN = 174;
const PM_ALIGNED_CLERIC = 275;
const PM_HIGH_CLERIC = 276;
const PM_ARCH_PRIEST = 350;
const PM_ACOLYTE = 375;
const PM_HUMAN_ZOMBIE = 244;
const PM_WRAITH = 230;
const PM_DWARF = 44;
const PM_MORDOR_ORC = 74;
const PM_URUK_HAI = 75;
const PM_ORC_SHAMAN = 76;
const PM_ORC_CAPTAIN = 77;
const PM_GNOME = 165;
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;
const K_RATION = 294;
const C_RATION = 295;
const BUGLE = 256;
const PM_WOLF = 20;
const PM_FOG_CLOUD = 106;
const PM_FIRE_ELEMENTAL = 155;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_VLAD_THE_IMPALER = 228;
const PM_VAMPIRE_BAT = 129;
const PM_JABBERWOCK = 178;
const PM_ARCHON = 125;
const PM_DOPPELGANGER = 270;
const PM_SANDESTIN = 301;
const PM_CHAMELEON = 327;
const PM_ARCHAEOLOGIST = 331;
const PM_WIZARD_OF_YENDOR = 285;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const PM_WIZARD = 343;
const PM_STUDENT = 369;
const PM_CHIEFTAIN = 370;
const PM_APPRENTICE = 382;
const PM_SALAMANDER = 329;
const S_MIMIC = 13;
const G_UNIQ_MASK = 0x1000;
const FLINT = 473;
const PM_HOBBIT = 43;
const PM_GNOME_RULER = 168;
const PM_GIANT_EEL = 319;
const PM_WUMPUS = 84;
const PM_LONG_WORM = 114;
const PM_BLACK_LIGHT = 119;
const PM_STALKER = 153;
const PM_BLACK_PUDDING = 209;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
const LUMP_OF_ROYAL_JELLY = 286;
const CHAIN_MAIL = 128;

// artifact.c:mk_artifact() candidates which are eligible for random object
// conversion (SPFX_NOGEN quest/invocation artifacts are deliberately absent).
// The selection draw still occurs for a one-entry candidate list.
const RANDOM_ARTIFACTS_BY_BASE = new Map([
    [58, 1], // Stormbringer (runesword)
    [76, 2], // Mjollnir, Ogresmasher (war hammer)
    [45, 1], // Cleaver (battle-axe)
    [36, 1], // Grimtooth (orcish dagger)
    [53, 1], // Orcrist (elven broadsword)
    [35, 1], // Sting (elven dagger)
    [38, 1], // Magicbane (athame)
    [54, 5], // brands, Giantslayer, Vorpal Blade, Sunsword
    [52, 1], // Dragonbane (broadsword)
    [74, 1], // Demonbane (silver mace)
    [51, 2], // Werebane, Grayswandir (silver saber)
    [75, 1], // Trollsbane (morning star)
    [56, 1], // Snickersnee (katana)
]);

// C ref: shknam.c shtypes[].  The random-shop prefix ends before the
// zero-probability unique shops.  mkshop() only needs probability and symbol
// at selection time; stocking consumes the richer item tables later.
const RANDOM_SHOP_TYPES = [
    { probability: 42, symbol: RANDOM_CLASS },
    { probability: 14, symbol: ARMOR_CLASS },
    { probability: 10, symbol: SCROLL_CLASS },
    { probability: 10, symbol: POTION_CLASS },
    { probability: 5, symbol: WEAPON_CLASS },
    { probability: 5, symbol: FOOD_CLASS },
    { probability: 3, symbol: RING_CLASS },
    { probability: 3, symbol: WAND_CLASS },
    { probability: 3, symbol: TOOL_CLASS },
    { probability: 3, symbol: SPBOOK_CLASS },
    { probability: 2, symbol: FOOD_CLASS },
];

const XLIM = 4;
const YLIM = 3;

// Direction deltas
const xdir = [-1, -1, 0, 1, 1, 1, 0, -1];
const ydir = [0, -1, -1, -1, 0, 1, 1, 1];

// Trap constants
const NO_TRAP = 0;
const TRAPNUM = 26;
const ARROW_TRAP = 1;
const DART_TRAP = 2;
const ROCKTRAP = 3;
const SQKY_BOARD = 4;
const BEAR_TRAP = 5;
const LANDMINE = 6;
const ROLLING_BOULDER_TRAP = 7;
const SLP_GAS_TRAP = 8;
const RUST_TRAP = 9;
const FIRE_TRAP = 10;
const PIT = 11;
const SPIKED_PIT = 12;
const HOLE = 13;
const TRAPDOOR = 14;
const TELEP_TRAP = 15;
const LEVEL_TELEP = 16;
const MAGIC_PORTAL = 17;
const WEB = 18;
const STATUE_TRAP = 19;
const MAGIC_TRAP = 20;
const POLY_TRAP = 22;
const VIBRATING_SQUARE = 23;
const TRAPPED_DOOR = 24;
const TRAPPED_CHEST = 25;

function is_hole(t) { return t === HOLE || t === TRAPDOOR; }
function is_pit(t) { return t === PIT || t === SPIKED_PIT; }

function canMonsterHideUnderFloorObject(x, y) {
    const pile = game.level?.objects?.[x]?.[y] || [];
    if (!pile.length) return false;
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (trap && !is_pit(trap.ttyp)) return false;
    let coinQuantity = 0;
    for (const object of pile) {
        if (object.oclass !== COIN_CLASS) return true;
        coinQuantity += object.quan ?? object.quantity ?? 1;
        if (coinQuantity >= 10) return true;
    }
    return false;
}

// Stairway list management
function stairway_add(x, y, up, isladder, dest) {
    const currentDungeon = game.u?.uz?.dnum ?? 0;
    const currentLevel = game.u?.uz?.dlevel ?? 1;
    // mklev.c marks the main-dungeon level-one entrance as traversed: the
    // hero conceptually began by coming down it, so its branch identity is
    // already known even before the first player command.
    const initialEntrance = !!up && currentDungeon === 0 && currentLevel === 1
        && dest?.dnum !== undefined && dest.dnum !== currentDungeon;
    const node = {
        sx: x, sy: y, up, isladder, tolev: { ...dest },
        u_traversed: initialEntrance,
        next: game.stairs,
    };
    game.stairs = node;
}

// ── Stairway lookup ──

function stairway_find_dir(up) {
    for (let s = game.stairs; s; s = s.next)
        if (s.up === up) return s;
    return null;
}

function stairway_find_special_dir(up) {
    for (let s = game.stairs; s; s = s.next)
        if (s.tolev.dnum !== (game.u?.uz?.dnum ?? 0) && s.up !== up) return s;
    return null;
}

// ── Hero placement (C ref: stairs.c, mkmaze.c) ──

function u_on_newpos(x, y) {
    game.u.ux = x;
    game.u.uy = y;
}

// C refs: dungeon.c Can_dig_down()/Can_fall_thru().  A level's hard-floor
// flag is only one of the gates: bottom levels and the invocation level also
// reject holes, while the Castle is an explicit exception because its
// trapdoors lead into the Valley.
function canDigDown(uz = game.u?.uz) {
    if (!uz) return false;
    return !game.level?.flags?.hardfloor
        && !Is_botlevel(uz)
        && !Invocation_lev(uz);
}

function canFallThrough(uz = game.u?.uz) {
    return canDigDown(uz) || Is_stronghold(uz);
}

// C refs: mklev.c occupied(), mkmaze.c bad_location().  Exclusion zones and
// the invocation position are modeled by their owning special levels; the
// shared terrain/feature gate belongs here.
function bad_location(x, y, nlx, nly, nhx, nhy) {
    const loc = game.level?.at(x, y);
    if (!loc) return true;
    if (occupied(x, y)) return true;
    // Excluded region
    if (nlx && x >= nlx && x <= nhx && y >= nly && y <= nhy) return true;
    // Must be ROOM, literal AIR, or CORR on a maze level.  IS_AIR also
    // includes CLOUD for movement/vision, but C's bad_location() deliberately
    // rejects clouds when placing a portal, stair, branch, or hero region.
    if (loc.typ !== ROOM && loc.typ !== AIR
        && !(loc.typ === CORR && game.level?.flags?.is_maze_lev))
        return true;
    return false;
}

// C ref: mkmaze.c place_lregion — place hero (LR_UPTELE/LR_DOWNTELE)
export function place_lregion(lx, ly, hx, hy, nlx, nly, nhx, nhy, rtype, lev) {
    if (!lx) {
        lx = 1; hx = COLNO - 1; ly = 0; hy = ROWNO - 1;
    }
    if (lx < 1) lx = 1;
    if (hx > COLNO - 1) hx = COLNO - 1;
    if (ly < 0) ly = 0;
    if (hy > ROWNO - 1) hy = ROWNO - 1;

    // Probabilistic search
    for (let trycnt = 0; trycnt < 200; trycnt++) {
        const x = rn1((hx - lx) + 1, lx);
        const y = rn1((hy - ly) + 1, ly);
        if (!bad_location(x, y, nlx, nly, nhx, nhy)) {
            if (rtype === LR_DOWNSTAIR || rtype === LR_UPSTAIR)
                mkstairs(x, y, rtype === LR_UPSTAIR, null);
            else
                u_on_newpos(x, y);
            return;
        }
    }
    // Deterministic fallback
    for (let x = lx; x <= hx; x++)
        for (let y = ly; y <= hy; y++)
            if (!bad_location(x, y, nlx, nly, nhx, nhy)) {
                if (rtype === LR_DOWNSTAIR || rtype === LR_UPSTAIR)
                    mkstairs(x, y, rtype === LR_UPSTAIR, null);
                else
                    u_on_newpos(x, y);
                return;
            }
}

// C ref: stairs.c u_on_upstairs — place hero on upstairs or fallback
export function u_on_upstairs() {
    const stway = stairway_find_dir(true);
    if (stway) { u_on_newpos(stway.sx, stway.sy); return; }
    // No upstair — try special stairs, then random
    const special = stairway_find_special_dir(0);
    if (special) { u_on_newpos(special.sx, special.sy); return; }
    // Random placement via place_lregion
    place_lregion(0, 0, 0, 0, 0, 0, 0, 0, LR_UPTELE, null);
}

// C ref: stairs.c u_on_dnstairs — ascending arrives on the destination's
// downstairs, its upward special stair, or a random legal location.
export function u_on_downstairs() {
    const stway = stairway_find_dir(false);
    if (stway) { u_on_newpos(stway.sx, stway.sy); return; }
    const special = stairway_find_special_dir(1);
    if (special) { u_on_newpos(special.sx, special.sy); return; }
    place_lregion(0, 0, 0, 0, 0, 0, 0, 0, LR_DOWNTELE, null);
}

// Object probabilities are mutable because gemstone rarity changes with
// dungeon depth.  This is the level-dependent half of o_init.c.
let objectProb = OBJECT_PROB.slice();
function oinit() {
    const firstGem = OBJECT_BASES[GEM_CLASS];
    const lastRealGem = 460;
    const ledger = Math.min(
        ledgerNo(game.u?.uz),
        maxLedgerNo(),
    );
    let first = firstGem;
    for (let j = 0; j < 9 - Math.trunc(ledger / 3); j++) {
        objectProb[first++] = 0;
    }
    for (let j = first; j <= lastRealGem; j++) {
        objectProb[j] = Math.trunc((171 + j - first)
            / (lastRealGem + 1 - first));
    }
}

// C ref: mkobj.c blessorcurse — rn2(4) BUC selection
function blessorcurse(otmp, chance = 10) {
    if (!otmp || otmp.blessed || otmp.cursed) return;
    if (!rn2(chance)) {
        if (!rn2(2)) otmp.cursed = true;
        else otmp.blessed = true;
    }
}

// C ref: mkobj.c mksobj — create a specific object.
export function mksobj(otyp, init, artif) {
    const oclass = objectClass(otyp);
    const startsDescriptionUnknown = oclass === WAND_CLASS
        || oclass === RING_CLASS || oclass === POTION_CLASS
        || oclass === SCROLL_CLASS || oclass === GEM_CLASS
        || oclass === SPBOOK_CLASS || oclass === WEAPON_CLASS
        || oclass === TOOL_CLASS || oclass === 17; // VENOM_CLASS
    // mkobj.c:clear_dknown().  Ordinary armor starts description-known, but
    // appearance-sharing shields and every mergeable type must be observed.
    const dknown = !startsDescriptionUnknown
        && !(otyp >= ELVEN_SHIELD && otyp <= ORCISH_SHIELD)
        && otyp !== SHIELD_OF_REFLECTION && !OBJECT_MERGE[otyp];
    const otmp = { otyp, oclass, o_id: nextIdent(), ox: 0, oy: 0, quan: 1,
        age: Math.max(game.moves ?? 0, 1),
        owt: OBJECT_WEIGHT[otyp] ?? 1,
        dknown, known: !OBJECT_USES_KNOWN[otyp],
        cursed: false, blessed: false, olocked: false, spe: 0,
        artifact: false };
    if (init) {
        mksobj_init(otmp, artif);
    }
    if (otyp === CORPSE || otyp === STATUE || otyp === FIGURINE) {
        // mk_trap_statue() owns its adjusted visible-monster choice before
        // mkcorpstat() is entered.  mksobj() itself always initializes an
        // otherwise unidentified corpse/statue/figurine with rndmonnum();
        // mkcorpstat() can then overwrite that temporary identity.
        if (otmp.corpsenm == null) otmp.corpsenm = rndmonnum();
        const genderFlags = MONSTER_FLAGS2[otmp.corpsenm] || 0;
        if (genderFlags & 0x20000) otmp.female = true;
        else if (genderFlags & (0x10000 | 0x40000)) otmp.female = false;
        else otmp.female = !!rn2(2);
        if (otyp === CORPSE) startCorpseTimeout(otmp);
    }
    if (otyp === EGG && (otmp.corpsenm ?? -1) >= 0) {
        // timeout.c attach_egg_hatch_timeout(): reproduce the legacy
        // per-turn hatch trial beginning at age 151.
        for (let age = 151; age <= 200; age++) {
            if (rnd(age) > 150) {
                scheduleObjectTimer(
                    otmp, OBJECT_TIMER_KIND.HATCH_EGG,
                    (game.moves ?? 0) + age, game,
                );
                break;
            }
        }
    }
    if (otyp === NOVEL) {
        // mkobj.c:mksobj() names every novel after class initialization.
        // The title index is persistent object identity even when only the
        // floor glyph is currently visible.
        otmp.novelidx = rn2(41);
    }
    // C mkobj.c:mksobj() computes weight only after type-specific state,
    // quantities, corpse identity, timers, and generated contents are final.
    otmp.owt = objectWeight(otmp);
    return otmp;
}

function objectClass(otyp) {
    for (let cls = 2; cls < OBJECT_BASES.length - 1; cls++) {
        if (otyp >= OBJECT_BASES[cls] && otyp < OBJECT_BASES[cls + 1])
            return cls;
    }
    return 1;
}

// C ref: objnam.c rnd_class().  Object probabilities are absolute weights
// within the requested inclusive type range rather than a uniform index.
export function rndClass(first, last) {
    let total = 0;
    for (let otyp = first; otyp <= last; otyp++)
        total += OBJECT_PROB[otyp] ?? 0;
    let roll = rnd(total);
    for (let otyp = first; otyp <= last; otyp++) {
        roll -= OBJECT_PROB[otyp] ?? 0;
        if (roll <= 0) return otyp;
    }
    return last;
}

function bcsign(otmp) {
    return Number(!!otmp.blessed) - Number(!!otmp.cursed);
}

function isMultigen(otmp) {
    const skill = OBJECT_SUBTYPE[otmp.otyp];
    return otmp.oclass === WEAPON_CLASS && skill >= -24 && skill <= -20;
}

function isPoisonable(otmp) {
    return isMultigen(otmp);
}

function mayGenerateEroded(otmp) {
    // C ref: may_generate_eroded(): starting inventory is pristine, while
    // objects produced by mklev on move zero may still be damaged.
    if ((game.moves ?? 0) <= 1 && !game.in_mklev) return false;
    if (otmp.artifact || otmp.otyp === WORM_TOOTH || otmp.otyp === UNICORN_HORN)
        return false;
    const matters = otmp.oclass === WEAPON_CLASS
        || otmp.oclass === ARMOR_CLASS
        || otmp.oclass === 15 || otmp.oclass === 16
        || (otmp.oclass === TOOL_CLASS && OBJECT_SUBTYPE[otmp.otyp] !== 0);
    if (!matters) return false;
    const material = OBJECT_MATERIAL[otmp.otyp];
    return material === 11 || material === 13 || material === 18
        || material === 19 || material === 10
        || (material <= 8 && material !== 1);
}

function mkobjErosions(otmp) {
    if (!mayGenerateEroded(otmp)) return;
    const material = OBJECT_MATERIAL[otmp.otyp];
    if (!rn2(100)) {
        otmp.oerodeproof = true;
    } else {
        const primary = !rn2(80);
        if (primary && (material <= 8 && material !== 1
            || material === 11 || material === 19)) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9)) erosion++;
        }
        const secondary = !rn2(80);
        if (secondary && ((material <= 8 && material !== 1)
            || material === 10 || material === 11 || material === 13)) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9)) erosion++;
        }
    }
    rn2(1000);
}

// C ref: mkobj.c mksobj_init().  Object state is deliberately small, but
// every decision is driven by the real object class/type metadata.
function mksobj_init(otmp, artif) {
    const otyp = otmp.otyp;
    switch (otmp.oclass) {
    case WEAPON_CLASS:
        if (isMultigen(otmp)) otmp.quan = rn1(6, 6);
        if (!rn2(11)) {
            otmp.spe = rne(3);
            otmp.blessed = !!rn2(2);
        } else if (!rn2(10)) {
            otmp.cursed = true;
            otmp.spe = -rne(3);
        } else {
            blessorcurse(otmp, 10);
        }
        if (isPoisonable(otmp)) otmp.opoisoned = rn2(100) === 0;
        // The artifact roll can succeed for a base weapon which has no
        // matching artifact entry; mk_artifact() then leaves it ordinary.
        if (artif
            && !rn2(20 + 10 * (game._artifactExistCount ?? 0))
            && otyp !== 73) {
            const generatedByBase = game._artifactExistByBase || new Map();
            game._artifactExistByBase = generatedByBase;
            const eligible = (RANDOM_ARTIFACTS_BY_BASE.get(otyp) || 0)
                - (generatedByBase.get(otyp) || 0);
            if (eligible > 0) {
                rn2(eligible);
                otmp.artifact = true;
                generatedByBase.set(otyp,
                    (generatedByBase.get(otyp) || 0) + 1);
                game._artifactExistCount =
                    (game._artifactExistCount ?? 0) + 1;
            }
        }
        break;
    case ARMOR_CLASS:
        if (rn2(10)
            && (otyp === FUMBLE_BOOTS || otyp === LEVITATION_BOOTS
                || otyp === HELM_OF_OPPOSITE_ALIGNMENT
                || otyp === GAUNTLETS_OF_FUMBLING || !rn2(11))) {
            otmp.cursed = true;
            otmp.spe = -rne(3);
        } else if (!rn2(10)) {
            otmp.blessed = !!rn2(2);
            otmp.spe = rne(3);
        } else {
            blessorcurse(otmp, 10);
        }
        if (artif) {
            // C still performs the artifact chance for armor, but every
            // armor-based artifact in this version is non-generatable.  A
            // successful roll therefore leaves the ordinary armor intact.
            rn2(40 + 10 * (game._artifactExistCount ?? 0));
        }
        break;
    case RING_CLASS:
        if (CHARGED_OBJECTS.has(otyp)) {
            blessorcurse(otmp, 3);
            if (rn2(10)) {
                if (rn2(10) && bcsign(otmp)) {
                    otmp.spe = bcsign(otmp) * rne(3);
                } else {
                    otmp.spe = (rn2(2) ? 1 : -1) * rne(3);
                }
            }
            if (otmp.spe === 0) otmp.spe = rn2(4) - rn2(3);
            if (otmp.spe < 0 && rn2(5)) otmp.cursed = true;
        } else if (rn2(10)
            && (otyp === 194 || otyp === 196 || otyp === 185
                || otyp === 184 || !rn2(9))) {
            otmp.cursed = true;
        }
        break;
    case AMULET_CLASS:
        if (rn2(10) && (otyp === AMULET_OF_STRANGULATION
            || otyp === AMULET_OF_CHANGE
            || otyp === AMULET_OF_RESTFUL_SLEEP)) otmp.cursed = true;
        else blessorcurse(otmp, 10);
        break;
    case FOOD_CLASS:
        if (otyp === CORPSE) {
            let tries = 50;
            do {
                otmp.corpsenm = undeadToCorpse(rndmonnum());
            } while ((MONSTER_GENO[otmp.corpsenm] & 0x0010)
                && --tries > 0);
            if (!tries) otmp.corpsenm = 260; // PM_HUMAN fallback
        } else if (otyp === EGG) {
            otmp.corpsenm = -1; // NON_PM: generic egg
            if (!rn2(3)) {
                // C ref: mkobj.c EGG initialization. Try up to 200 random
                // monsters. Every failed rndmonnum() call still advances the
                // gameplay RNG.
                for (let tries = 200; tries > 0; tries--) {
                    const mndx = rndmonnum();
                    if (MONSTER_FLAGS1[mndx] & 0x00400000) { // M1_OVIPAROUS
                        rn2(77); // can_be_hatched(): BREEDER_EGG
                        otmp.corpsenm = mndx;
                        break;
                    }
                }
            }
        } else if (otyp === TIN) {
            otmp.corpsenm = -1;
            if (rn2(6)) {
                // mkobj.c retries up to 200 times until the selected corpse
                // has nutrition and is allowed to leave a corpse.
                for (let tries = 200; tries > 0; tries--) {
                    const mndx = undeadToCorpse(rndmonnum());
                    const nutrition = MONSTER_BODY_META[mndx]?.[1] ?? 0;
                    if (!nutrition || (MONSTER_GENO[mndx] & 0x0010))
                        continue;
                    otmp.corpsenm = mndx;
                    // eat.c:set_tin_variety(RANDOM_TIN) stores the
                    // preparation as a negative, one-based index; it is
                    // durable object identity, not a disposable roll.
                    otmp.spe = -(rn2(15) + 1);
                    break;
                }
            } else otmp.spe = 1;
            blessorcurse(otmp, 10);
        } else if (otyp >= GLOB_OF_GRAY_OOZE
            && otyp <= GLOB_OF_BLACK_PUDDING) {
            // mkobj.c:mksobj_init() constructs globs as one variable-weight
            // identity and immediately starts their first 23..27-turn timer.
            otmp.globby = true;
            otmp.quan = otmp.quantity = 1;
            otmp.owt = OBJECT_WEIGHT[otyp];
            otmp.known = otmp.dknown = true;
            otmp.corpsenm = 206 + (otyp - GLOB_OF_GRAY_OOZE);
            scheduleObjectTimer(
                otmp, OBJECT_TIMER_KIND.SHRINK_GLOB,
                (game.moves ?? 0) + 23 + rn2(5), game,
            );
        } else if (otyp === KELP_FROND) {
            otmp.quan = rnd(2);
        } else if (otyp === CANDY_BAR) {
            // C ref: read.c assign_candy_wrapper().  Index zero is the
            // deliberately-unused blank wrapper.
            otmp.spe = 1 + rn2(12);
        }
        if (otyp !== CORPSE && otyp !== MEAT_RING && otyp !== KELP_FROND
            && !(otyp >= GLOB_OF_GRAY_OOZE
                && otyp <= GLOB_OF_BLACK_PUDDING))
            if (!rn2(6)) otmp.quan = 2;
        break;
    case GEM_CLASS:
        if (otyp === LOADSTONE) otmp.cursed = true;
        else if (otyp === ROCK) otmp.quan = rn1(6, 6);
        else if (otyp !== LUCKSTONE && !rn2(6)) otmp.quan = 2;
        break;
    case TOOL_CLASS:
        initTool(otmp);
        break;
    case POTION_CLASS:
    case SCROLL_CLASS:
        // MAIL_STRUCTURES: stamped scrolls of mail bypass ordinary random BUC
        // initialization; readobjnam() marks a wished one via spe afterward.
        if (otyp !== 364) blessorcurse(otmp, 4);
        break;
    case SPBOOK_CLASS:
        blessorcurse(otmp, 17);
        break;
    case WAND_CLASS:
        if (otyp === 414) otmp.spe = 1;
        else if (otyp === 415) otmp.spe = rn1(4, 3);
        else otmp.spe = rn1(5, OBJECT_DIR[otyp] === 1 ? 11 : 4);
        blessorcurse(otmp, 17);
        break;
    case ROCK_CLASS:
        if (otyp === STATUE) {
            otmp.corpsenm = rndmonnum();
            if ((MONSTER_SIZE[otmp.corpsenm] || 0) >= 1
                && rn2(Math.trunc(level_difficulty() / 2) + 10) > 10) {
                // Ordinary initialized statues can contain one non-novel
                // spellbook.  A Lua `contents` field clears this object only
                // after its complete constructor has consumed RNG.
                otmp.contents = [mkobj(SPBOOK_no_NOVEL, false)];
            }
        }
        break;
    }
    mkobjErosions(otmp);
}

function initTool(otmp) {
    const otyp = otmp.otyp;
    if (otyp === TALLOW_CANDLE || otyp === WAX_CANDLE) {
        otmp.quan = 1 + (rn2(2) ? rn2(7) : 0);
        blessorcurse(otmp, 5);
    } else if (otyp === BRASS_LANTERN || otyp === OIL_LAMP) {
        otmp.spe = 1;
        otmp.age = rn1(500, 1000);
        otmp.lamplit = false;
        blessorcurse(otmp, 5);
    } else if (otyp === MAGIC_LAMP) {
        otmp.spe = 1;
        otmp.lamplit = false;
        blessorcurse(otmp, 2);
    } else if (otyp === CHEST || otyp === LARGE_BOX) {
        otmp.olocked = !!rn2(5);
        const trapped = !rn2(10);
        otmp.otrapped = trapped;
        if (trapped) rn2(100);
        mkboxCnts(otmp);
    } else if (otyp === ICE_BOX || otyp === SACK || otyp === OILSKIN_SACK
        || otyp === BAG_OF_HOLDING) {
        mkboxCnts(otmp);
    } else if (otyp === EXPENSIVE_CAMERA || otyp === TINNING_KIT
        || otyp === MAGIC_MARKER) {
        otmp.spe = rn1(70, 30);
    } else if (otyp === CAN_OF_GREASE) {
        otmp.spe = rn1(21, 5);
        blessorcurse(otmp, 10);
    } else if (otyp === CRYSTAL_BALL) {
        otmp.spe = rn1(5, 3);
        blessorcurse(otmp, 2);
    } else if (otyp === HORN_OF_PLENTY || otyp === BAG_OF_TRICKS) {
        otmp.spe = rn1(18, 3);
    } else if (otyp === FIGURINE) {
        // C mkobj.c:mksobj_init(): figurines deliberately select from a
        // harder band than ordinary corpses/statues and reject human forms
        // through a bounded post-check retry.  Store the chosen identity so
        // mksobj()'s shared corpse/statue/figurine tail only assigns gender.
        let tryCount = 0;
        do {
            otmp.corpsenm = rndmonnumAdj(5, 10);
        } while ((MONSTER_FLAGS2[otmp.corpsenm] & M2_HUMAN)
            && tryCount++ < 30);
        blessorcurse(otmp, 4);
    } else if (otyp === MAGIC_FLUTE || otyp === MAGIC_HARP
        || otyp === FROST_HORN || otyp === FIRE_HORN
        || otyp === DRUM_OF_EARTHQUAKE) {
        otmp.spe = rn1(5, 4);
    }
}

// C ref: mkobj.c mkbox_cnts().
function mkboxCnts(box) {
    let maximum;
    if (box.otyp === ICE_BOX) maximum = 20;
    else if (box.otyp === CHEST) maximum = box.olocked ? 7 : 5;
    else if (box.otyp === LARGE_BOX) maximum = box.olocked ? 5 : 3;
    else if (box.otyp === SACK || box.otyp === OILSKIN_SACK) {
        maximum = ((game.moves ?? 0) <= 1 && !game.in_mklev) ? 0 : 1;
    } else if (box.otyp === BAG_OF_HOLDING) maximum = 1;
    else maximum = 0;

    box.contents = [];
    const classProbs = [[18, GEM_CLASS], [15, FOOD_CLASS], [18, POTION_CLASS],
        [18, SCROLL_CLASS], [12, SPBOOK_CLASS], [7, COIN_CLASS],
        [6, WAND_CLASS], [5, RING_CLASS], [1, AMULET_CLASS]];
    for (let count = rn2(maximum + 1); count > 0; count--) {
        let content;
        if (box.otyp === ICE_BOX) {
            content = mksobj(CORPSE, true, false);
            content.age = 0;
            stopAllObjectTimers(content);
        } else {
            let roll = rnd(100);
            let objectClass = AMULET_CLASS;
            for (const [probability, candidate] of classProbs) {
                roll -= probability;
                if (roll <= 0) {
                    objectClass = candidate;
                    break;
                }
            }
            content = mkobj(objectClass, false);
            if (content.oclass === COIN_CLASS) {
                content.quan = rnd(level_difficulty() + 2) * rnd(75);
                content.quantity = content.quan;
                content.owt = objectWeight(content);
            } else while (content.otyp === ROCK) {
                content.otyp = rndClass(DILITHIUM_CRYSTAL, LOADSTONE);
                if (content.quan > 2) content.quan = 1;
                content.quantity = content.quan;
                content.owt = objectWeight(content);
            }
            if (box.otyp === BAG_OF_HOLDING) {
                if (content.otyp === BAG_OF_HOLDING
                    || content.otyp === BAG_OF_TRICKS) {
                    content.otyp = SACK;
                    content.spe = 0;
                    content.owt = objectWeight(content);
                } else {
                    while (content.otyp === WAN_CANCELLATION) {
                        content.otyp = rndClass(WAN_LIGHT, WAN_LIGHTNING);
                        content.owt = objectWeight(content);
                    }
                }
            }
        }
        addToContainer(box, content);
    }
}

function mksobj_at(otyp, x, y, init, artif) {
    return place_object(mksobj(otyp, init, artif), x, y);
}

export function mkobj(oclass, artif) {
    if (oclass === RANDOM_CLASS) {
        // mkobj.c:mkobj() switches the RANDOM_CLASS reservoir in Gehennom.
        // Keep that shared constructor policy here; hellfill.lua merely asks
        // for des.object() and does not own the resulting class weights.
        const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
        const classProbs = inHell
            ? [[20, WEAPON_CLASS], [20, ARMOR_CLASS],
                [16, FOOD_CLASS], [12, TOOL_CLASS], [10, GEM_CLASS],
                [1, POTION_CLASS], [1, SCROLL_CLASS], [8, WAND_CLASS],
                [8, RING_CLASS], [4, AMULET_CLASS]]
            : [[10, WEAPON_CLASS], [11, ARMOR_CLASS],
                [20, FOOD_CLASS], [8, TOOL_CLASS], [7, GEM_CLASS],
                [16, POTION_CLASS], [16, SCROLL_CLASS], [4, SPBOOK_CLASS],
                [4, WAND_CLASS], [3, RING_CLASS], [1, AMULET_CLASS]];
        let roll = rnd(100);
        for (const [probability, cls] of classProbs) {
            roll -= probability;
            if (roll <= 0) { oclass = cls; break; }
        }
    }
    let first = OBJECT_BASES[oclass];
    let last = OBJECT_BASES[oclass + 1] - 1;
    if (oclass === SPBOOK_no_NOVEL) {
        oclass = SPBOOK_CLASS;
        first = OBJECT_BASES[SPBOOK_CLASS];
        last = 407; // SPE_BLANK_PAPER
    }
    let total = 0;
    for (let i = first; i <= last; i++) total += objectProb[i];
    let roll = rnd(total);
    let otyp = first;
    while ((roll -= objectProb[otyp]) > 0) otyp++;
    return mksobj(otyp, true, artif);
}

function mkobj_at(oclass, x, y, artif) {
    return place_object(mkobj(oclass, artif), x, y);
}

function coinStackWeight(quantity) {
    return Math.max(1, Math.trunc((quantity + 50) / 100));
}

export function mkgold(amount, x, y) {
    // C ref: mkobj.c mkgold()
    if (amount <= 0) {
        // C ref: mkobj.c:2008-2010
        const depthVal = depth_of_level(game.u?.uz);
        const mul = rnd(Math.trunc(30 / Math.max(12 - depthVal, 2)));
        amount = 1 + rnd(level_difficulty() + 2) * mul;
    }
    const existing = game.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === GOLD_PIECE);
    if (existing) {
        existing.quan += amount;
        existing.quantity = existing.quan;
        existing.owt = coinStackWeight(existing.quan);
        return existing;
    }
    // mksobj_at(GOLD_PIECE) calls next_ident. Gold skips normal object
    // initialization but is still linked into the floor-object chain.
    const objectId = nextIdent();
    return place_object({
        otyp: GOLD_PIECE, oclass: COIN_CLASS, o_id: objectId, ox: x, oy: y,
        quan: amount, quantity: amount, owt: coinStackWeight(amount),
        cursed: false, blessed: false,
    }, x, y);
}

export function place_object(otmp, x, y) {
    if (!otmp || !game.level) return otmp;
    otmp.ox = x;
    otmp.oy = y;
    otmp.where = 'floor';
    // C place_object() links the same identity at the head of both the
    // square's nexthere pile and the level-wide fobj chain.  The arrays below
    // retain the local projection; a monotonic serial retains global
    // newest-first traversal for dog_goal() and other fobj consumers.
    game._fobjSerial = (game._fobjSerial || 0) + 1;
    otmp._fobjOrder = game._fobjSerial;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
    // C links newly placed objects at the head of the square's object chain.
    game.level.objects[x][y].unshift(otmp);
    updateCorpseIceTimer(otmp, x, y, game.level.at(x, y)?.typ === ICE);
    return otmp;
}

// C ref: invent.c:mergable().  Floor stacking is an object-lifecycle
// operation, not a presentation shortcut: the surviving identity is the
// newly placed object passed to stackobj(), while a compatible older identity
// is extracted from the pile.
export function mergable(otmp, obj, state = game) {
    return objectsMergable(otmp, obj, state);
}

// C ref: invent.c:merged()/stackobj().  `obj` remains the live identity
// because place_object() linked it at the head before this scan.
export function stack_object(obj, state = game) {
    const pile = state?.level?.objects?.[obj?.ox]?.[obj?.oy];
    if (!obj || !pile) return obj;
    const existing = pile.find(candidate =>
        candidate !== obj && mergable(obj, candidate, state));
    if (!existing) return obj;

    const index = pile.indexOf(existing);
    if (index >= 0) pile.splice(index, 1);
    return mergeObjectStacks(obj, existing, state) || obj;
}

// C ref: mkobj.c:remove_object().  Extract one floor-object identity while
// retaining its coordinates for callers which are about to move and re-place
// it.  Keeping this paired with place_object() gives ball/chain movement and
// later floor transactions one authoritative pile-lifecycle boundary.
export function remove_object(otmp) {
    if (!otmp || !game.level) return otmp;
    const pile = game.level.objects?.[otmp.ox]?.[otmp.oy];
    const index = pile?.indexOf(otmp) ?? -1;
    if (index >= 0) pile.splice(index, 1);
    otmp.where = 'free';
    updateCorpseIceTimer(otmp, otmp.ox, otmp.oy, false);
    return otmp;
}
const PM_LICHEN = 158;
const PM_LIZARD = 326;

const UNDEAD_CORPSE_TYPES = new Map([
    [239, 59], [187, 59],   // kobold zombie/mummy -> kobold
    [242, 44], [190, 44],   // dwarf zombie/mummy -> dwarf
    [240, 165], [188, 165], // gnome zombie/mummy -> gnome
    [241, 72], [189, 72],   // orc zombie/mummy -> orc
    [243, 264], [191, 264], // elf zombie/mummy -> elf
    [226, 260], [227, 260], [244, 260], [192, 260],
    [247, 169], [194, 169], // giant zombie/mummy -> giant
    [245, 174], [193, 174], // ettin zombie/mummy -> ettin
]);

export function undeadToCorpse(mndx) {
    return UNDEAD_CORPSE_TYPES.get(mndx) ?? mndx;
}

function isSpecialCorpse(mndx) {
    return mndx === PM_LICHEN || mndx === PM_LIZARD;
}

// C ref: mkobj.c start_corpse_timeout().  Ordinary corpses use rnz() to
// vary their rot time; lichen and lizard corpses never receive a timer.
function startCorpseTimeout(body) {
    if (!body || isSpecialCorpse(body.corpsenm)) return;
    const rotAdjust = game.in_mklev ? 25 : 10;
    const currentMove = Math.max(game.moves ?? 1, 1);
    if (body.age == null) body.age = currentMove;
    const age = currentMove - body.age;
    const baseDelay = age > 250 ? rotAdjust : 250 - age;
    scheduleObjectTimer(
        body, OBJECT_TIMER_KIND.ROT_CORPSE,
        currentMove + baseDelay + rnz(rotAdjust) - rotAdjust,
        game,
    );
}

// C ref: mkobj.c:obj_timer_checks(). Corpse rot/revival time doubles while a
// floor or buried corpse is on ice and contracts by the inverse adjustment
// when it leaves. Stopping and restarting also assigns a new source timer id.
function updateCorpseIceTimer(body, x, y, isOnIce, state = game) {
    if (!body || body.otyp !== CORPSE) return false;
    const timer = objectTimers(body).find(candidate =>
        candidate.kind === OBJECT_TIMER_KIND.ROT_CORPSE);
    if (!timer) return false;
    const currentMove = state.moves ?? 0;
    if (isOnIce && !body.on_ice) {
        const remaining = Math.max(0, timer.deadline - currentMove);
        stopObjectTimer(body, OBJECT_TIMER_KIND.ROT_CORPSE);
        body.on_ice = true;
        const age = currentMove - (body.age ?? currentMove);
        body.age = currentMove - age * 2;
        scheduleObjectTimer(
            body, OBJECT_TIMER_KIND.ROT_CORPSE,
            currentMove + remaining * 2, state,
        );
        return true;
    }
    if (!isOnIce && body.on_ice) {
        const remaining = Math.max(0, timer.deadline - currentMove);
        stopObjectTimer(body, OBJECT_TIMER_KIND.ROT_CORPSE);
        body.on_ice = false;
        const age = currentMove - (body.age ?? currentMove);
        body.age += Math.trunc(age / 2);
        scheduleObjectTimer(
            body, OBJECT_TIMER_KIND.ROT_CORPSE,
            currentMove + Math.trunc(remaining / 2), state,
        );
        return true;
    }
    return false;
}

function set_corpsenm(otmp, pm) {
    if (!otmp) return;
    // C stops every existing corpse timer before replacing its species.
    stopAllObjectTimers(otmp);
    otmp.corpsenm = pm;
    if (otmp.otyp === CORPSE) {
        startCorpseTimeout(otmp);
        otmp.owt = objectWeight(otmp);
    }
}

// C ref: mkobj.c mkcorpstat().
export function mkcorpstat(objtyp, mtmp, pm, x, y, flags) {
    // C ref: mkcorpstat() creates and initializes a statue, including its
    // random monster identity and possible container roll.
    const otmp = mksobj(objtyp, !!(flags & 0x08), false);
    // mkobj.c records gender and historic-statue bits in the overloaded spe
    // field after mksobj() initialization and before the species override.
    otmp.spe = flags & 0x07;
    if (pm != null) {
        const oldCorpsenm = otmp.corpsenm;
        otmp.corpsenm = pm;
        // Replacing a timerless/specially-timed corpse requires rebuilding
        // its timer for the overriding species.
        if (objtyp === CORPSE
            && (isSpecialCorpse(oldCorpsenm) || isSpecialCorpse(pm))) {
            startCorpseTimeout(otmp);
        }
    }
    return place_object(otmp, x, y);
}

// C ref: makemon.c adj_lev() and mkclass_aligned().  mkclass does not pick
// directly from the source-table order: NetHack first sorts every regular
// monster by class and difficulty.  The original index is the stable tie
// breaker for the generated monster table used by this version.
export function adjustedMonsterLevel(mndx) {
    // attrib.c:adjalign() calls mon.c:adj_erinys() after every new negative
    // alignment adjustment.  Erinys' live species level is 7 + accumulated
    // abuse, capped at 50; it is then passed through ordinary adj_lev().
    const baseLevel = mndx === PM_ERINYS
        ? Math.min(50, (MONSTER_LEVEL[mndx] || 0)
            + (game.u?.ualign?.abuse ?? 0))
        : MONSTER_LEVEL[mndx] || 0;
    // makemon.c:adj_lev() gives the Wizard a separate resurrection curve:
    // his base level rises once per recorded death and is not constrained by
    // ordinary dungeon/hero adjustment or the 3/2 species cap.
    if (mndx === PM_WIZARD_OF_YENDOR) {
        const deaths = game._vanquishedCounts?.get?.(mndx)?.count || 0;
        return Math.min(49, baseLevel + deaths);
    }
    if (baseLevel > 49) return 50;
    let adjusted = baseLevel;
    const depthDelta = level_difficulty() - baseLevel;
    if (depthDelta < 0) adjusted--;
    else adjusted += Math.trunc(depthDelta / 5);
    const heroDelta = (game.u?.ulevel || 1) - baseLevel;
    if (heroDelta > 0) adjusted += Math.trunc(heroDelta / 4);
    const upperLimit = Math.min(49, Math.trunc(3 * baseLevel / 2));
    return Math.min(upperLimit, Math.max(0, adjusted));
}

const monsterGenerationOrder = Array.from(
    { length: SPECIAL_PM }, (_, mndx) => mndx,
).sort((left, right) => {
    const leftKey = (MONSTER_SYMBOL[left] << 8) | MONSTER_DIFFICULTY[left];
    const rightKey = (MONSTER_SYMBOL[right] << 8) | MONSTER_DIFFICULTY[right];
    return leftKey - rightKey || left - right;
});

function mkclassAligned(monsterClass, spc = 0, atyp = A_NONE) {
    const G_FREQ = 0x0007;
    const G_HELL = 0x0400;
    const G_NOHELL = 0x0800;
    const G_UNIQ = 0x1000;
    const S_LICH = 38;
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const inHell = !!currentDungeon?.flags?.hellish;
    const maxMonsterLevel = level_difficulty() >> 1;
    const heroLevel = game.u?.ulevel || 1;
    const classMembers = monsterGenerationOrder.filter(
        mndx => MONSTER_SYMBOL[mndx] === monsterClass,
    );
    if (!classMembers.length) return null;
    const zeroFrequencyClass = !MONSTER_GENO.some(
        (geno, mndx) => MONSTER_SYMBOL[mndx] === monsterClass
            && (geno & G_FREQ),
    );
    const weights = new Map();
    let totalWeight = 0;
    let lastCandidate = null;
    let ignoreGone = false;

    if (spc & G_IGNORE) {
        ignoreGone = true;
        spc &= ~G_IGNORE;
    }
    for (const mndx of classMembers) {
        if (atyp !== A_NONE
            && Math.sign(MONSTER_ALIGNMENT[mndx]) !== Math.sign(atyp)) {
            continue;
        }
        let generationMask = G_NOGEN | G_UNIQ;
        if (rn2(9) || monsterClass === S_LICH)
            generationMask |= inHell ? G_NOHELL : G_HELL;
        generationMask &= ~spc;
        const geno = MONSTER_GENO[mndx];
        const gone = !!((game.mvitals?.[mndx]?.mvflags ?? 0) & 0x03);
        if (!(geno & generationMask)
            && (ignoreGone || !gone)
            && !PLACEHOLDER_MONSTERS.has(mndx)) {
            if (totalWeight
                && MONSTER_DIFFICULTY[mndx] > maxMonsterLevel
                && MONSTER_DIFFICULTY[mndx]
                    > MONSTER_DIFFICULTY[lastCandidate]
                && rn2(2)) {
                break;
            }
            const frequency = geno & G_FREQ;
            if (frequency || zeroFrequencyClass) {
                const weight = (frequency || 1) + 1
                    - Number(adjustedMonsterLevel(mndx) > heroLevel * 2);
                weights.set(mndx, weight);
                totalWeight += weight;
            }
        }
        lastCandidate = mndx;
    }
    if (!totalWeight) return null;
    let choice = rnd(totalWeight);
    for (const mndx of classMembers) {
        const weight = weights.get(mndx) || 0;
        if ((choice -= weight) <= 0) return mndx;
    }
    return null;
}

function mkclass(monsterClass, spc = 0) {
    return mkclassAligned(monsterClass, spc, A_NONE);
}

// C makemon.c:align_shift() caches Is_special(&u.uz) until svm.moves
// changes.  Zero-time wizard level travel can therefore construct more than
// one level on the same move while retaining the first level's alignment.
// Keep that source lifetime explicit instead of reading the destination
// descriptor afresh for every reservoir candidate.
function rndmonstAlignment() {
    const moves = game.moves ?? 0;
    if (game._rndmonstAlignmentMove !== moves) {
        game._rndmonstAlignmentMove = moves;
        game._rndmonstAlignment = game._activeSpecialLevel?.monsterAlignment
            ?? game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.alignment
            ?? null;
    }
    return game._rndmonstAlignment;
}

function rndmonnumReservoir(minAdjustment = 0, maxAdjustment = 0) {
    const zlevel = level_difficulty();
    const heroLevel = game.u?.ulevel || 1;
    const minDifficulty = Math.trunc(zlevel / 6) + minAdjustment;
    const maxDifficulty = Math.trunc((zlevel + heroLevel) / 2)
        + maxAdjustment;
    let totalWeight = 0;
    let selected = -1;
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const inHell = !!currentDungeon?.flags?.hellish;
    for (let mndx = 0; mndx < SPECIAL_PM; mndx++) {
        const difficulty = MONSTER_DIFFICULTY[mndx];
        const geno = MONSTER_GENO[mndx];
        if (difficulty < minDifficulty || difficulty > maxDifficulty) continue;
        if (geno & (0x0200 | 0x1000)) continue; // G_NOGEN | G_UNIQ
        if (inHell) {
            if ((MONSTER_ALIGNMENT[mndx] || 0) > A_NEUTRAL
                || (geno & 0x0800)) continue; // lawful or G_NOHELL
        } else if (geno & 0x0400) continue; // G_HELL
        let weight = geno & 0x0007;
        // C align_shift(): a special level's fixed alignment changes the
        // selection weights before the caller can replace the species.
        const levelAlign = rndmonstAlignment();
        const monsterAlign = MONSTER_ALIGNMENT[mndx] || 0;
        if (levelAlign === 'law')
            weight += Math.trunc((monsterAlign + 20) / 8);
        else if (levelAlign === 'neutral')
            weight += Math.trunc((20 - Math.abs(monsterAlign)) / 4);
        else if (levelAlign === 'chaos')
            weight += Math.trunc((20 - monsterAlign) / 8);
        // makemon.c:temperature_shift().  Gehennom begins hot in
        // mklev.c and cold special levels can override that inherited flag.
        const temperature = game.level?.flags?.temperature || 0;
        const preferredResistance = temperature > 0 ? 0x01
            : temperature < 0 ? 0x02 : 0; // MR_FIRE / MR_COLD
        if (preferredResistance
            && (MONSTER_RESISTS[mndx] & preferredResistance)) {
            weight += 3;
        }
        if (weight > 0) {
            totalWeight += weight;
            if (rn2(totalWeight) < weight) selected = mndx;
        }
    }
    return selected >= 0 ? selected : 322; // newt is the safe C fallback
}

export function rndmonnum() {
    return rndmonnumAdj(0, 0);
}

function questMonsterType() {
    const role = game.urole || {};
    if (rn2(5)) {
        const qpm = role.enemy1num
            ?? (role.filecode === 'Pri' ? PM_HUMAN_ZOMBIE : null);
        if (qpm != null && rn2(5)) return qpm;
        return mkclass(role.enemy1sym ?? 52, 0);
    }
    const qpm = role.enemy2num
        ?? (role.filecode === 'Pri' ? 230 : null);
    if (qpm != null && rn2(5)) return qpm;
    return mkclass(role.enemy2sym ?? 49, 0);
}

function rndmonnumAdj(minAdjustment = 0, maxAdjustment = 0) {
    const dnum = game.u?.uz?.dnum ?? 0;
    if (game.dungeons?.[dnum]?.dname === 'The Quest' && rn2(7)) {
        const questMonster = questMonsterType();
        if (questMonster != null) return questMonster;
    }
    return rndmonnumReservoir(minAdjustment, maxAdjustment);
}

const M2_HUMAN = 0x00000008;
const M2_ELF = 0x00000010;
const M2_DWARF = 0x00000020;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
const M2_NOPOLY = 0x00000001;
const M2_DEMON = 0x00000100;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_MINION = 0x00001000;
const M2_GIANT = 0x00002000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_HOSTILE = 0x00100000;
const M2_PEACEFUL = 0x00200000;
const M2_NASTY = 0x02000000;
const M2_STRONG = 0x04000000;
const M2_GREEDY = 0x10000000;
const M1_HUMANOID = 0x00020000;
const M1_ANIMAL = 0x00040000;
const G_LGROUP = 0x0040;
const G_SGROUP = 0x0080;

const GOLEM_HIT_POINTS = new Map([
    ['straw golem', 20], ['paper golem', 20], ['rope golem', 30],
    ['leather golem', 40], ['gold golem', 60], ['wood golem', 50],
    ['flesh golem', 40], ['clay golem', 70], ['stone golem', 100],
    ['glass golem', 80], ['iron golem', 120],
]);

function golemHitPoints(mndx) {
    if (MONSTER_SYMBOL[mndx] !== 55) return null;
    return GOLEM_HIT_POINTS.get(MONSTER_NAME[mndx]) ?? null;
}

// C ref: makemon.c peace_minded().  Random level monsters must resolve their
// attitude before inventory creation; the live hero alignment record is an
// input, so prayer and other alignment mutations remain observable here.
export function peaceMinded(mndx) {
    const flags = MONSTER_FLAGS2[mndx] || 0;
    if (flags & M2_PEACEFUL) return true;
    if (flags & M2_HOSTILE) return false;
    // Erinyes are the one species whose attitude is controlled directly by
    // alignment abuse instead of the ordinary co-aligned random chance.
    if (mndx === PM_ERINYS) return !(game.u?.ualign?.abuse ?? 0);

    const race = game.urace?.noun || game.urace?.name || 'human';
    const loveMask = race === 'elf' ? M2_ELF
        : race === 'dwarf' ? M2_DWARF | M2_GNOME
        : race === 'gnome' ? M2_DWARF | M2_GNOME : 0;
    const hateMask = race === 'elf' || race === 'dwarf' ? M2_ORC
        : race === 'gnome' ? M2_HUMAN
        : race === 'orc' ? M2_HUMAN | M2_ELF | M2_DWARF
        : M2_GNOME | M2_ORC;
    if (flags & loveMask) return true;
    if (flags & hateMask) return false;

    const monsterAlignment = MONSTER_ALIGNMENT[mndx] || 0;
    const heroAlignment = game.u?.ualign?.type || 0;
    if (Math.sign(monsterAlignment) !== Math.sign(heroAlignment)) return false;
    if (monsterAlignment < 0 && game.u?.uhave?.amulet) return false;

    const record = Math.max(-15, game.u?.ualign?.record ?? 0);
    // Deity minions use a deterministic straying check.  This gate precedes
    // the ordinary two-roll co-aligned attitude calculation.
    if (flags & M2_MINION) return record >= 0;
    return !!rn2(16 + record) && !!rn2(2 + Math.abs(monsterAlignment));
}

// C ref: makemon.c's post-placement species switch.  This runs after
// peace_minded() and before shapechanging, group construction, and inventory.
// Keep it shared with ambient births: leprechauns always start asleep, while
// nymphs and jabberwocks own the same conditional sleep roll everywhere.
export function initialMonsterSleepState(mndx, forceAsleep = false) {
    let sleeping = forceAsleep ? 1 : 0;
    const monsterClass = MONSTER_SYMBOL[mndx];
    if (monsterClass === 12) { // S_LEPRECHAUN
        sleeping = 1;
    } else if (monsterClass === 14
        || monsterClass === 36) { // S_NYMPH or S_JABBERWOCK
        if (rn2(5) && !game.u?.uhave?.amulet) sleeping = 1;
    }
    return sleeping;
}

async function initMonsterGroup(mndx, x, y, countRange, mmflags) {
    let count = Math.trunc(rnd(countRange) / ((game.u?.ulevel ?? 1) < 3 ? 4
        : (game.u?.ulevel ?? 1) < 5 ? 2 : 1));
    if (!count) count = 1;
    let centerX = x, centerY = y;
    while (count-- > 0) {
        // m_initgrp() screens attitude before asking enexto() for a member.
        if (peaceMinded(mndx)) continue;
        const member = await makemonNear(
            mndx, centerX, centerY, mmflags | MM_NOGRP,
        );
        if (member) {
            member.mpeaceful = 0;
            centerX = member.mx;
            centerY = member.my;
        }
    }
}

const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];
// makemon.c:m_initweap() classes with an explicit switch arm.  Even when a
// particular arm gives no weapon, it skips the default rnd(14-2*bias) table
// and proceeds directly to the common rn2(75) tail.
const M_INITWEAP_SWITCH_CLASSES = new Set([
    34, // S_GIANT
    53, // S_HUMAN
    27, // S_ANGEL
    8,  // S_HUMANOID
    37, // S_KOP
    15, // S_ORC
    41, // S_OGRE
    46, // S_TROLL
    11, // S_KOBOLD
    29, // S_CENTAUR
    49, // S_WRAITH
    52, // S_ZOMBIE
    57, // S_LIZARD
    56, // S_DEMON
]);

// C ref: makemon.c newmonhp().  Shapechanging calls the same constructor a
// second time, so keep the dice policy in one owner rather than duplicating a
// partial mplayer-only branch inside makemon().
export function newMonsterHitPoints(mndx) {
    const rawLevel = MONSTER_LEVEL[mndx] ?? 0;
    let level = adjustedMonsterLevel(mndx);
    const fixedGolemHp = golemHitPoints(mndx);
    let hp, minimumBase = 0;
    if (fixedGolemHp != null) {
        hp = fixedGolemHp;
    } else if (mndx >= 311 && mndx <= 313) {
        // Riders retain their high attack level but use deliberately low HP.
        minimumBase = 10;
        hp = d(10, 8);
    } else if (rawLevel > 49) {
        // Special fixed-HP monsters encode their HP in the permonst level.
        hp = 2 * (rawLevel - 6);
        level = Math.trunc(hp / 4);
    } else if (MONSTER_SYMBOL[mndx] === 30 && mndx >= 143) {
        // Adult dragons use N*(4+d4) in the dungeon and fixed N*8 in
        // the endgame rather than the ordinary Nd8 roll.
        minimumBase = level;
        hp = In_endgame(game.u?.uz) ? 8 * level : 4 * level + d(level, 4);
    } else if (!level) {
        minimumBase = 1;
        hp = rnd(4);
    } else {
        minimumBase = level;
        hp = d(level, 8);
    }
    // newmonhp() guarantees at least one point above the theoretical
    // all-ones minimum.  For a level-zero monster that minimum is one.
    if (minimumBase && hp === minimumBase) hp++;
    return { level, hp };
}

function monsterIndexByName(name) {
    const mndx = MONSTER_NAME.indexOf(name);
    if (mndx < 0) throw new Error(`Unknown monster identity: ${name}`);
    return mndx;
}

// C ref: wizard.c nasties[].  Sandestins and doppelgangers share this
// reservoir when choosing a difficult initial form.
const NASTY_MONSTERS = [
    'cockatrice', 'ettin', 'stalker', 'minotaur',
    'owlbear', 'purple worm', 'xan', 'umber hulk',
    'xorn', 'zruty', 'leocrotta', 'baluchitherium',
    'carnivorous ape', 'fire elemental', 'jabberwock',
    'iron golem', 'ochre jelly', 'green slime',
    'displacer beast', 'genetic engineer',
    'black dragon', 'red dragon', 'arch-lich', 'vampire leader',
    'master mind flayer', 'disenchanter', 'winged gargoyle',
    'storm giant', 'Olog-hai', 'elf-noble', 'elven monarch',
    'ogre tyrant', 'captain', 'gremlin',
    'silver dragon', 'orange dragon', 'green dragon', 'yellow dragon',
    'guardian naga', 'fire giant', 'Aleax', 'couatl',
    'horned devil', 'barbed devil',
].map(monsterIndexByName);

// The subset of mondata.c grownups[] reachable from nasties[].  C only
// accepts a demotion whose name is not a juvenile form.
const NASTY_BIG_TO_LITTLE = new Map([
    ['cockatrice', 'chickatrice'],
    ['purple worm', 'baby purple worm'],
    ['black dragon', 'baby black dragon'],
    ['red dragon', 'baby red dragon'],
    ['silver dragon', 'baby silver dragon'],
    ['orange dragon', 'baby orange dragon'],
    ['green dragon', 'baby green dragon'],
    ['yellow dragon', 'baby yellow dragon'],
    ['arch-lich', 'master lich'],
    ['vampire leader', 'vampire'],
    ['master mind flayer', 'mind flayer'],
    ['elf-noble', 'elf'],
    ['elven monarch', 'elf-noble'],
    ['ogre tyrant', 'ogre leader'],
    ['captain', 'lieutenant'],
].map(([large, small]) => [
    monsterIndexByName(large), monsterIndexByName(small),
]));

function monsterClassSymbol(mndx) {
    return MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[mndx] || 0] || '?';
}

function monsterIsGenocided(mndx) {
    return !!((game.mvitals?.[mndx]?.mvflags ?? 0) & 0x02);
}

function pickNastyShape(difficultyCap) {
    let result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    if (Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(result))) {
        result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    }

    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const outOfPlaceMask = inHell ? 0x0800 : 0x0400; // G_NOHELL : G_HELL
    const shouldDemote = monsterIsGenocided(result)
        || (difficultyCap > 0
            && (MONSTER_DIFFICULTY[result] ?? 0) >= difficultyCap)
        || !!((MONSTER_GENO[result] ?? 0) & outOfPlaceMask);
    const alternate = shouldDemote
        ? (NASTY_BIG_TO_LITTLE.get(result) ?? result) : result;
    if (alternate !== result && !monsterIsGenocided(alternate)) {
        const name = MONSTER_NAME[alternate] ?? '';
        if (!name.startsWith('baby ')
            && !/(?: hatchling| pup| cub)$/.test(name)) {
            result = alternate;
        }
    }
    return result;
}

function isPlayerMonster(mndx) {
    return mndx >= PM_ARCHAEOLOGIST && mndx <= PM_WIZARD;
}

function acceptsShapechangerForm(baseMndx, targetMndx) {
    if (!Number.isInteger(targetMndx) || targetMndx < 0
        || monsterIsGenocided(targetMndx)) return false;
    if (isPlayerMonster(targetMndx) || targetMndx === baseMndx) return true;
    return !((MONSTER_FLAGS2[targetMndx] ?? 0) & M2_NOPOLY);
}

function randomDoppelgangerFallback(baseMndx) {
    let targetMndx = -1;
    let tryCount = 50;
    do {
        targetMndx = rn2(SPECIAL_PM);
        --tryCount;
    } while (tryCount > 0
        && !acceptsShapechangerForm(baseMndx, targetMndx)
        && tryCount > 40
        && Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(targetMndx)));
    return targetMndx;
}

function selectDoppelgangerFormOnce() {
    let targetMndx = -1;
    if (!rn2(7)) {
        targetMndx = pickNastyShape(
            (MONSTER_DIFFICULTY[PM_JABBERWOCK] ?? 0) - 1,
        );
    } else if (rn2(3)) {
        // topten.c tt_doppel().  The contest recorder and sandbox expose an
        // empty RECORD file: every observed get_rnd_toptenentry() consumes
        // its rank roll, then returns NULL and takes the role fallback.
        if (rn2(13)) rnd(10);
        targetMndx = rn1(
            PM_WIZARD - PM_ARCHAEOLOGIST + 1, PM_ARCHAEOLOGIST,
        );
    } else if (!rn2(3)) {
        targetMndx = rn1(
            PM_APPRENTICE - PM_STUDENT + 1, PM_STUDENT,
        );
        if (targetMndx === game.urole?.guardnum) targetMndx = -1;
    } else {
        let tryCount = 5;
        do {
            targetMndx = rn2(SPECIAL_PM);
            if ((MONSTER_FLAGS1[targetMndx] ?? 0) & M1_HUMANOID
                && !((MONSTER_FLAGS2[targetMndx] ?? 0) & M2_NOPOLY)) {
                break;
            }
            targetMndx = -1;
        } while (--tryCount > 0);
    }
    if (targetMndx < 0)
        targetMndx = randomDoppelgangerFallback(PM_DOPPELGANGER);
    return targetMndx;
}

function selectDoppelgangerForm() {
    // newcham() retries select_newcham_form()/accept_newcham_form() up to
    // twenty times.  The natural form is an accepted result: callers decide
    // whether it is a no-op from the monster's current form.
    for (let tryCount = 20; tryCount > 0; --tryCount) {
        const targetMndx = selectDoppelgangerFormOnce();
        if (acceptsShapechangerForm(PM_DOPPELGANGER, targetMndx))
            return targetMndx;
    }
    return null;
}

function selectChameleonForm() {
    // mon.c select_newcham_form(): one third of chameleon changes use the
    // process-global animal table; the others enter the ordinary random-form
    // path.  newcham() retries rejected forms up to twenty times.
    // mon.c:mon_animal_list() walks mons[] in PM index order.  This is not
    // mkclass()'s class/difficulty generation order; the distinction is
    // observable whenever the chosen animal has different hit dice.
    const animals = Array.from({ length: SPECIAL_PM }, (_, mndx) => mndx)
        .filter(mndx => (MONSTER_FLAGS1[mndx] ?? 0) & M1_ANIMAL);
    for (let tryCount = 20; tryCount > 0; --tryCount) {
        const targetMndx = !rn2(3)
            ? animals[rn2(animals.length)]
            : randomDoppelgangerFallback(PM_CHAMELEON);
        if (acceptsShapechangerForm(PM_CHAMELEON, targetMndx))
            return targetMndx;
    }
    return null;
}

function selectInitialDoppelgangerForm() {
    const targetMndx = selectDoppelgangerForm();
    return targetMndx === PM_DOPPELGANGER ? null : targetMndx;
}

function selectInitialChameleonForm() {
    const targetMndx = selectChameleonForm();
    return targetMndx === PM_CHAMELEON ? null : targetMndx;
}

function selectInitialSandestinForm() {
    // mon.c:select_newcham_form() normally chooses from pick_nasty(), but a
    // one-in-seven result falls through to the ordinary random-form picker.
    // newcham() repeats rejected forms up to twenty times.
    for (let tryCount = 20; tryCount > 0; --tryCount) {
        const targetMndx = rn2(7)
            ? pickNastyShape((MONSTER_DIFFICULTY[PM_ARCHON] ?? 0) - 1)
            : randomDoppelgangerFallback(PM_SANDESTIN);
        if (acceptsShapechangerForm(PM_SANDESTIN, targetMndx))
            return targetMndx === PM_SANDESTIN ? null : targetMndx;
    }
    return null;
}

function shapechangerGender(baseMndx, targetMndx, female) {
    const flags = MONSTER_FLAGS2[targetMndx] ?? 0;
    if (flags & M2_MALE) return false;
    if (flags & M2_FEMALE) return true;
    if (flags & M2_NEUTER) return female;

    // mgender_from_permonst() evaluates the roll before suppressing a
    // vampire's actual toggle, so vampshifters still consume rn2(10).
    const toggle = !rn2(10);
    const vampireShape = targetMndx === PM_VAMPIRE
        || targetMndx === PM_VAMPIRE_LEADER
        || targetMndx === PM_VLAD_THE_IMPALER;
    const vampireBase = baseMndx === PM_VAMPIRE
        || baseMndx === PM_VAMPIRE_LEADER
        || baseMndx === PM_VLAD_THE_IMPALER;
    return toggle && !(vampireShape || vampireBase) ? !female : female;
}

// C ref: mon.c:pickvampshape().  Live vampire shifters select from their
// natural form, wolf (leaders), fog cloud, and vampire bat, then sometimes
// revert to the natural form instead of oscillating between two alternates.
// Keep this separate from birth selection because the final rn2(4) depends
// on the monster's current form.
function pickVampireShape(monster) {
    const baseMndx = monster.cham;
    const uppercaseOnly = Is_rogue_level(game.u?.uz);
    let targetMndx = baseMndx;
    let wolfChance = 10;

    if (baseMndx === PM_VLAD_THE_IMPALER) {
        const inventory = monster.minvent || monster.inventory || [];
        if (inventory.some(object =>
            object.otyp === CANDELABRUM_OF_INVOCATION)) return baseMndx;
        wolfChance = 3;
    }
    if (baseMndx === PM_VAMPIRE_LEADER
        || baseMndx === PM_VLAD_THE_IMPALER) {
        const loc = game.level?.at?.(monster.mx, monster.my);
        if (!rn2(wolfChance) && !uppercaseOnly
            && !IS_POOL(loc?.typ) && !IS_LAVA(loc?.typ)) {
            targetMndx = PM_WOLF;
        }
    }
    if (targetMndx === baseMndx) {
        targetMndx = !rn2(4) && !uppercaseOnly
            ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
    }
    if (monsterIsGenocided(targetMndx)
        || (monster.mnum !== baseMndx && !rn2(4))) return baseMndx;
    return targetMndx;
}

function initialShapechangedMonster({
    monsterId, baseMndx, targetMndx, x, y, female, sleeping, peaceful,
}) {
    const shapedFemale = shapechangerGender(baseMndx, targetMndx, female);
    const { level, hp } = newMonsterHitPoints(targetMndx);
    const permanentlyInvisible = targetMndx === PM_STALKER
        || targetMndx === PM_BLACK_LIGHT;
    return {
        m_id: monsterId, mnum: targetMndx, cham: baseMndx,
        mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: level, female: shapedFemale,
        msleeping: sleeping, mpeaceful: peaceful ? 1 : 0, mcanmove: 1,
        minvis: permanentlyInvisible, perminvis: permanentlyInvisible,
        movement: 0, mmove: MONSTER_MOVE[targetMndx] ?? 0, mspeed: 0,
        symbol: monsterClassSymbol(targetMndx),
        color: MONSTER_COLOR[targetMndx], hasInventory: false,
        minvent: [], inventory: [], weaponCheck: 0,
    };
}

// C refs: makemon.c:pm_to_cham()/newcham().  Monster births outside mklev
// enter the same initial shapechange transaction as level-construction
// births: retain the already-allocated identity and attitude, choose a form,
// reroll gender/HP for that form, and suppress all starting inventory.
export function initialShapechangedBirth(monster) {
    const baseMndx = monster?.mnum;
    let targetMndx = null;
    if (baseMndx === PM_DOPPELGANGER) {
        targetMndx = selectInitialDoppelgangerForm();
    } else if (baseMndx === PM_CHAMELEON) {
        targetMndx = selectInitialChameleonForm();
    } else if (baseMndx === PM_SANDESTIN) {
        targetMndx = selectInitialSandestinForm();
    } else if (baseMndx === PM_VAMPIRE || baseMndx === PM_VAMPIRE_LEADER) {
        if (baseMndx === PM_VAMPIRE_LEADER && !rn2(10))
            targetMndx = PM_WOLF;
        else
            targetMndx = !rn2(4) ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
    }
    if (targetMndx == null) return null;
    return initialShapechangedMonster({
        monsterId: monster.m_id,
        baseMndx,
        targetMndx,
        x: monster.mx,
        y: monster.my,
        female: monster.female,
        sleeping: monster.msleeping ?? 0,
        peaceful: !!monster.mpeaceful,
    });
}

// C refs: mon.c:decide_to_shapeshift()/newcham().  Birth-time and live
// shapechanging share form selection, gender, and newmonhp(), but a live
// monster keeps its identity, inventory, and current HP fraction.
export function shapechangeMonster(monster, forcedTargetMndx = null) {
    const baseMndx = monster?.cham;
    let targetMndx = forcedTargetMndx;
    if (targetMndx == null && baseMndx === PM_DOPPELGANGER) {
        targetMndx = selectDoppelgangerForm();
    } else if (targetMndx == null && baseMndx === PM_CHAMELEON) {
        targetMndx = selectChameleonForm();
    } else if (targetMndx == null && (
        baseMndx === PM_VAMPIRE
        || baseMndx === PM_VAMPIRE_LEADER
        || baseMndx === PM_VLAD_THE_IMPALER
    )) {
        targetMndx = pickVampireShape(monster);
    }
    if (targetMndx == null || targetMndx === monster.mnum) return false;

    const oldHp = Math.max(1, monster.mhp ?? 1);
    const oldMax = Math.max(1, monster.mhpmax ?? oldHp);
    const shapedFemale = shapechangerGender(
        baseMndx, targetMndx, !!monster.female,
    );
    const { level, hp } = newMonsterHitPoints(targetMndx);
    const scaledHp = Math.trunc(oldHp * hp / oldMax);
    const permanentlyInvisible = targetMndx === PM_STALKER
        || targetMndx === PM_BLACK_LIGHT;

    monster.mnum = targetMndx;
    monster.m_lev = level;
    monster.mhpmax = hp;
    monster.mhp = Math.max(1, Math.min(hp, scaledHp));
    monster.female = shapedFemale;
    monster.mmove = MONSTER_MOVE[targetMndx] ?? monster.mmove ?? 0;
    monster.symbol = monsterClassSymbol(targetMndx);
    monster.color = MONSTER_COLOR[targetMndx];
    monster.perminvis = permanentlyInvisible;
    monster.minvis = monster.invis_blkd ? 0 : permanentlyInvisible;
    monster.meverseen = 0;
    return true;
}

function monsterOccupiesPosition(monster, x, y) {
    return !!monster && (monster.mhp ?? 1) > 0 && (
        (monster.mx === x && monster.my === y)
        || monster.wormSegments?.some(segment =>
            segment.x === x && segment.y === y)
    );
}

function levelMonsterAt(x, y, ignore = null) {
    return game.level?.monsters?.find(monster => monster !== ignore
        && monsterOccupiesPosition(monster, x, y));
}

// C ref: makemon.c makemon_rnd_goodpos().  The random phase owns a complete
// x/y pair for every rejected candidate.  Level generation skips the
// visibility-avoidance pass, then falls back to a deterministic wrapped scan
// only if all fifty random candidates fail.
function randomMonsterPosition(mndx) {
    let x = 0, y = 0, good = false, tryCount = 0;
    do {
        x = rn1(COLNO - 3, 2);
        y = rn2(ROWNO);
        good = (!game.in_mklev
            && !!(game.viz_array?.[y]?.[x] & 0x02))
            ? false : monsterGoodPosition(mndx, x, y, true);
    } while (++tryCount < 50 && !good);
    if (good) return { x, y };

    // gi.in_mklev makes C start directly with the second, visibility-agnostic
    // scan.  Runtime callers first scan unseen squares; the compact vision
    // bit mirrors cansee() without introducing a level-generation cycle.
    const firstPass = game.in_mklev || game.blind ? 1 : 0;
    for (let visiblePass = firstPass; visiblePass < 2; visiblePass++) {
        for (let dx = 0; dx < COLNO; dx++) {
            for (let dy = 0; dy < ROWNO; dy++) {
                const candidateX = ((dx + x) % (COLNO - 1)) + 1;
                const candidateY = ((dy + y) % (ROWNO - 1)) + 1;
                if (!visiblePass
                    && !!(game.viz_array?.[candidateY]?.[candidateX] & 0x02)) {
                    continue;
                }
                if (monsterGoodPosition(
                    mndx, candidateX, candidateY, true,
                ))
                    return { x: candidateX, y: candidateY };
            }
        }
    }
    return null;
}

// C refs: makemon.c initworm() and worm.c place_worm_tail_randomly().
// A long worm owns one head actor plus lightweight occupied tail cells.  Each
// requested segment shuffles every direction before choosing the first legal
// adjacent square; the complete shuffle remains observable even when its
// first candidate succeeds.
function initializeLongWormTail(monster, allowTail) {
    const used = new Set((game.level?.monsters || [])
        .map(candidate => candidate.wormno)
        .filter(Boolean));
    let wormno = 1;
    while (wormno < 32 && used.has(wormno)) wormno++;
    if (wormno >= 32) return;

    monster.wormno = wormno;
    monster.wormSegments = [];
    const requestedSegments = allowTail ? rn2(5) : 0;
    let ox = monster.mx, oy = monster.my;
    for (let segment = 0; segment < requestedSegments; segment++) {
        const directions = Array.from({ length: 8 }, (_, index) => index);
        for (let remaining = 8; remaining > 0; remaining--) {
            const selected = rn2(remaining);
            [
                directions[selected],
                directions[remaining - 1],
            ] = [
                directions[remaining - 1],
                directions[selected],
            ];
        }
        let next = null;
        for (const direction of directions) {
            const x = ox + xdir[direction], y = oy + ydir[direction];
            if (monsterGoodPosition(PM_LONG_WORM, x, y)) {
                next = { x, y };
                break;
            }
        }
        if (!next) break;
        monster.wormSegments.push(next);
        ox = next.x;
        oy = next.y;
    }
}

async function makemon(mdat, x, y, mmflags, requestedByHero = false) {
    if (x === 0 && y === 0) {
        const point = randomMonsterPosition(mdat);
        if (!point) return null;
        x = point.x;
        y = point.y;
    }
    // C makemon() rejects an occupied explicit coordinate before choosing a
    // species or allocating an id.  Callers which permit displacement choose
    // the adjacent square before entering this constructor.
    if (levelMonsterAt(x, y)) return null;
    let mndx = mdat;
    if (mndx == null) {
        // C accepts the 51st result even if every preceding type was
        // unsuitable; the bound prevents an impossible map from looping.
        let tryCount = 0;
        do {
            mndx = rndmonnum();
            ++tryCount;
        } while (tryCount <= 50 && !monsterGoodPosition(mndx, x, y));
    }
    const monsterId = nextIdent();
    const { level: baseLevel, hp } = newMonsterHitPoints(mndx);

    const genderFlags = MONSTER_FLAGS2[mndx] || 0;
    const isNeutralDemon = !!(genderFlags & M2_DEMON)
        && !(genderFlags & (M2_LORD | M2_PRINCE));
    const isQuestLeaderType = mndx === game.urole?.ldrnum;
    const isQuestNemesis = mndx === game.urole?.neminum;
    const femaleOk = !(genderFlags & (M2_MALE | M2_NEUTER));
    const maleOk = !(genderFlags & (M2_FEMALE | M2_NEUTER));
    const monsterFemale = (genderFlags & M2_FEMALE) ? true
        : ((mmflags & MM_FEMALE) && femaleOk) ? true
            : (genderFlags & M2_MALE) ? false
                : ((mmflags & MM_MALE) && maleOk) ? false
                    : (genderFlags & M2_NEUTER) ? false
                        : isQuestLeaderType
                            ? game.quest_status?.ldrgend === 1
                            : isQuestNemesis
                                ? game.quest_status?.nemgend === 1
                                : !!rn2(2);
    // makemon.c honors MM_ANGRY before consulting peace_minded().  This is
    // RNG-visible for co-aligned neutral species such as fallback garter
    // snakes; hostile ant summons happened to short-circuit the same helper.
    const peaceful = (mmflags & MM_ANGRY) ? false : peaceMinded(mndx);
    let monsterSleeping = initialMonsterSleepState(
        mndx, !!(mmflags & MM_ASLEEP),
    );
    if (game.in_mklev
        && (mndx === PM_GIANT_EEL || mndx === PM_WUMPUS
            || mndx === PM_LONG_WORM
            || (isNeutralDemon && !isQuestNemesis))
        && !game.u?.uhave?.amulet && rn2(5)) {
        monsterSleeping = 1;
    }

    // C links the primary actor before group construction.  Reserve its
    // creation-order slot now so enexto() sees the occupied center and the
    // final JS array retains primary-then-members order.
    if (!game.level.monsters) game.level.monsters = [];
    const monsterInventory = [];
    const pendingMonster = {
        m_id: monsterId,
        mnum: mndx, mx: x, my: y, mhp: hp,
        m_lev: baseLevel, mpeaceful: peaceful ? 1 : 0,
        minvent: monsterInventory,
        inventory: monsterInventory,
        hasInventory: false,
    };
    const monsterIndex = game.level.monsters.push(pendingMonster) - 1;

    let generatedGhostName = null;
    if (mndx === 287 && !(mmflags & MM_NONAME)) { // PM_GHOST
        const useGhostList = rn2(7);
        generatedGhostName = useGhostList ? rn2(34) : -1;
    }

    let initialShape = null;
    if (mndx === PM_DOPPELGANGER) {
        initialShape = selectInitialDoppelgangerForm();
    } else if (mndx === PM_CHAMELEON) {
        initialShape = selectInitialChameleonForm();
    } else if (mndx === PM_SANDESTIN) {
        initialShape = selectInitialSandestinForm();
    } else if (mndx === PM_VAMPIRE || mndx === PM_VAMPIRE_LEADER) {
        // mon.c pickvampshape()/newcham(): initial vampire shapechanging
        // happens after birth gender but suppresses all starting inventory.
        if (mndx === PM_VAMPIRE_LEADER && !rn2(10))
            initialShape = PM_WOLF;
        else
            initialShape = !rn2(4) ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
    }
    if (initialShape != null) {
        const shaped = initialShapechangedMonster({
            monsterId, baseMndx: mndx, targetMndx: initialShape,
            x, y, female: monsterFemale, sleeping: monsterSleeping,
            peaceful,
        });
        if (requestedByHero)
            setMonsterApparentHeroPosition(shaped, game, rn2);
        game.level.monsters[monsterIndex] = shaped;
        return shaped;
    }

    // makemon.c owns this initialization when its original requested
    // coordinate was the hero's occupied square.  enexto() has already moved
    // the actor, so preserve that caller fact separately from final x/y.
    if (requestedByHero)
        setMonsterApparentHeroPosition(pendingMonster, game, rn2);

    if (mndx === PM_LONG_WORM)
        initializeLongWormTail(pendingMonster, !(mmflags & MM_NOTAIL));

    // C makemon() type setup: spiders and snakes born during level creation
    // receive a random floor object before they hide beneath it.
    if (game.in_mklev
        && (MONSTER_SYMBOL[mndx] === 19 || MONSTER_SYMBOL[mndx] === 45)
        && x && y) {
        mkobj_at(RANDOM_CLASS, x, y, true);
    }

    // C makemon.c creates an ordinary aligned/high cleric without MM_EPRI or
    // MM_EMIN as a roaming minion before group and inventory initialization.
    // create_particular() applies an explicit hostile disposition only after
    // this constructor returns, so both alignment/renegade draws remain live.
    let clericMinion = null;
    if ([PM_ALIGNED_CLERIC, PM_HIGH_CLERIC].includes(mndx)
        && !(mmflags & (MM_EPRI | MM_EMIN))) {
        const minAlign = rn2(3) - 1;
        const renegade = !!(mmflags & MM_ANGRY) || rn2(3) === 0;
        const minionPeaceful = minAlign === (game.u?.ualign?.type ?? 0)
            ? !renegade : renegade;
        clericMinion = {
            min_align: minAlign,
            renegade,
            mpeaceful: minionPeaceful ? 1 : 0,
        };
        pendingMonster.mpeaceful = clericMinion.mpeaceful;
    }

    if (mdat == null && !(mmflags & MM_NOGRP)) {
        const geno = MONSTER_GENO[mndx] || 0;
        if ((geno & G_SGROUP) && rn2(2)) {
            await initMonsterGroup(mndx, x, y, 3, mmflags);
        } else if (geno & G_LGROUP) {
            await initMonsterGroup(mndx, x, y, rn2(3) ? 10 : 3, mmflags);
        }
    }

    let monsterWeaponQuantity;
    let hasMonsterInventory = false;
    const allowMonsterInventory = !(mmflags & NO_MINVENT);
    let skipCommonMonsterInventory = Is_rogue_level(game.u?.uz);
    const mongets = otyp => {
        const object = mksobj(otyp, true, false);
        // makemon.c:mongets(): demons never retain blessed objects; a raw
        // blessing becomes a curse before the identity enters minvent.
        if (MONSTER_SYMBOL[mndx] === 56 && object.blessed) {
            object.blessed = false;
            object.cursed = true;
        }
        addObjectToMonsterInventory(pendingMonster, object, game);
        hasMonsterInventory = true;
        return object;
    };
    const mkmonmoney = amount => {
        const gold = mksobj(GOLD_PIECE, false, false);
        gold.quan = amount;
        gold.quantity = amount;
        linkObjectToMonsterInventory(pendingMonster, gold);
        hasMonsterInventory = true;
        return gold;
    };
    const giveOffensiveMonsterItem = () => {
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) mongets(offensiveItem);
        }
    };
    const giveGeneralMonsterWeapon = () => {
        const bias = ((genderFlags & M2_LORD) ? 1 : 0)
            + ((genderFlags & M2_PRINCE) ? 2 : 0)
            + ((genderFlags & M2_NASTY) ? 1 : 0);
        const initThrow = (otyp, quantityRange) => {
            const object = mongets(otyp);
            object.quan = 3 + rn2(quantityRange);
            object.quantity = object.quan;
            object.owt = (OBJECT_WEIGHT[otyp] ?? 1) * object.quan;
        };
        switch (rnd(14 - 2 * bias)) {
        case 1:
            if (genderFlags & M2_STRONG) mongets(BATTLE_AXE);
            else initThrow(DART, 12);
            break;
        case 2:
            if (genderFlags & M2_STRONG) mongets(TWO_HANDED_SWORD);
            else {
                mongets(CROSSBOW);
                initThrow(CROSSBOW_BOLT, 12);
            }
            break;
        case 3:
            mongets(BOW);
            initThrow(18, 12); // ARROW
            break;
        case 4:
            if (genderFlags & M2_STRONG) mongets(LONG_SWORD);
            else initThrow(DAGGER, 3);
            break;
        case 5:
            mongets((genderFlags & M2_STRONG) ? LUCERN_HAMMER : AKLYS);
            break;
        default:
            break;
        }
        giveOffensiveMonsterItem();
    };
    if (allowMonsterInventory && mndx === PM_VLAD_THE_IMPALER)
        mongets(CANDELABRUM_OF_INVOCATION);
    if (isQuestNemesis) {
        // makemon() gives MS_NEMESIS the Bell before its level-generation
        // sleep gate and normal weapon/inventory initialization.
        if (allowMonsterInventory) mongets(BELL_OF_OPENING);
        if (game.in_mklev && isNeutralDemon
            && !game.u?.uhave?.amulet && rn2(5)) {
            monsterSleeping = 1;
        }
    }
    // C makemon.c's allow_minvent gate surrounds m_initweap() but not birth
    // state such as mimic appearance, sleep, peacefulness, or shapechanging.
    if (!allowMonsterInventory) {
        // The caller requires an empty initial inventory.
    } else if (mndx === PM_VLAD_THE_IMPALER) {
        // Vlad is a vampire prince and extra-nasty, reducing the ordinary
        // armament table to rnd(8).  His fixed Candelabrum above exists
        // before this shared weapon/offensive-item tail.
        giveGeneralMonsterWeapon();
    } else if (mndx >= 59 && mndx <= 61) { // kobold through kobold leader
        // C ref: makemon.c m_initweap(), S_KOBOLD.
        if (!rn2(4)) {
            const darts = mongets(DART);
            // mksobj() first initializes an ordinary multigen stack, then
            // m_initthrow() deliberately replaces that quantity.
            darts.quan = 3 + rn2(12); // rn1(12, 3)
            darts.quantity = darts.quan;
            darts.owt = (OBJECT_WEIGHT[DART] ?? 1) * darts.quan;
        }
        rn2(75); // final m_initweap() offensive-item check
    } else if (mndx >= 70 && mndx <= 73) {
        // C ref: makemon.c m_initweap(), S_ORC.  Goblins, hobgoblins,
        // corpses-only base orcs, and hill orcs all use the default armament
        // branch; the goblin form short-circuits the dagger/scimitar choice.
        if (rn2(2)) mongets(ORCISH_HELM);
        if (rn2(2)) {
            const weapon = mndx === 70 || rn2(2) === 0
                ? ORCISH_DAGGER : SCIMITAR;
            mongets(weapon);
        }
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 27
        && (MONSTER_FLAGS1[mndx] & 0x00020000)
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C ref: m_initweap(), humanoid S_ANGEL.  Minion weapons and shields
        // deliberately bypass mongets()/ordinary object initialization.
        const isLord = !!(genderFlags & 0x00000400);
        const weapon = mksobj(rn2(3) ? LONG_SWORD : SILVER_MACE, false, false);
        const promote = !rn2(20) || isLord;
        if (promote && MONSTER_ALIGNMENT[mndx] > 0) {
            weapon.oextra = {
                ...(weapon.oextra || {}),
                oname: weapon.otyp === LONG_SWORD ? 'Sunsword' : 'Demonbane',
            };
            weapon.artifact = true;
        }
        weapon.blessed = true;
        weapon.cursed = false;
        weapon.oerodeproof = true;
        weapon.spe = rn2(4) + (weapon.otyp === SILVER_MACE ? 3 : 0);
        addObjectToMonsterInventory(pendingMonster, weapon, game);
        hasMonsterInventory = true;

        const shield = mksobj(
            !rn2(4) || isLord ? 158 : LARGE_SHIELD,
            false, false,
        );
        shield.oerodeproof = true;
        shield.spe = 0;
        addObjectToMonsterInventory(pendingMonster, shield, game);
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 8 && mndx === PM_HOBBIT) {
        // C ref: makemon.c m_initweap(), S_HUMANOID/PM_HOBBIT.
        const weaponRoll = rn2(3);
        if (weaponRoll === 0) mongets(DAGGER);
        else if (weaponRoll === 1) mongets(ELVEN_DAGGER);
        else {
            mongets(SLING);
            const missile = mongets(!rn2(4) ? FLINT : ROCK);
            missile.quan = 3 + rn2(6);
            missile.quantity = missile.quan;
        }
        if (!rn2(10)) mongets(ELVEN_MITHRIL_COAT);
        if (!rn2(10)) mongets(DWARVISH_CLOAK);
        rn2(75);
    } else if (MONSTER_SYMBOL[mndx] === 8
        && (genderFlags & M2_DWARF)) {
        // C ref: makemon.c m_initweap(), S_HUMANOID/is_dwarf().  Keep the
        // complete equipment tree together because every optional item feeds
        // the same ordinary object constructor and erosion rules.
        if (rn2(7)) mongets(DWARVISH_CLOAK);
        if (rn2(7)) mongets(IRON_SHOES);
        if (!rn2(4)) {
            mongets(DWARVISH_SHORT_SWORD);
            if (rn2(2)) {
                mongets(DWARVISH_MATTOCK);
            } else {
                mongets(rn2(2) ? AXE : DWARVISH_SPEAR);
                mongets(DWARVISH_ROUNDSHIELD);
            }
            mongets(DWARVISH_IRON_HELM);
            if (!rn2(3)) mongets(DWARVISH_MITHRIL_COAT);
        } else {
            mongets(!rn2(3) ? PICK_AXE : DAGGER);
        }
        giveOffensiveMonsterItem();
    } else if (mndx >= 264 && mndx <= 269) { // ordinary elf species
        // C ref: makemon.c m_initweap(), is_elf().  Clothing probes precede
        // the mutually exclusive primary loadout; monarchs then receive two
        // extra utility probes before the common offensive-item tail.
        if (rn2(2))
            mongets(rn2(2) ? ELVEN_MITHRIL_COAT : ELVEN_CLOAK);
        if (rn2(2)) mongets(ELVEN_LEATHER_HELM);
        else if (!rn2(4)) mongets(ELVEN_BOOTS);
        if (rn2(2)) mongets(ELVEN_DAGGER);
        switch (rn2(3)) {
        case 0: {
            if (!rn2(4)) mongets(ELVEN_SHIELD);
            if (rn2(3)) mongets(ELVEN_SHORT_SWORD);
            mongets(ELVEN_BOW);
            const arrows = mongets(ELVEN_ARROW);
            arrows.quan = 3 + rn2(12);
            arrows.quantity = arrows.quan;
            break;
        }
        case 1:
            mongets(ELVEN_BROADSWORD);
            if (rn2(2)) mongets(ELVEN_SHIELD);
            break;
        case 2:
            if (rn2(2)) {
                mongets(ELVEN_SPEAR);
                mongets(ELVEN_SHIELD);
            }
            break;
        }
        if (mndx === 269) { // PM_ELVEN_MONARCH
            if (rn2(3) || (game.in_mklev && Is_earthlevel(game.u?.uz)))
                mongets(PICK_AXE);
            if (!rn2(50)) mongets(CRYSTAL_BALL);
        }
        giveOffensiveMonsterItem();
    } else if ([
        PM_SOLDIER, PM_SERGEANT, PM_LIEUTENANT, PM_CAPTAIN,
        PM_WATCHMAN, PM_WATCH_CAPTAIN,
    ].includes(mndx)) {
        // C ref: makemon.c m_initweap()/m_initinv(), human mercenaries.
        // Soldiers and Minetown's watch share one equipment constructor;
        // armor gained in each round gates whether later slots are attempted.
        let primaryWeapon = 0;
        let secondaryWeapon = 0;
        if (mndx === PM_SOLDIER || mndx === PM_WATCHMAN) {
            if (!rn2(3)) {
                primaryWeapon = PARTISAN + rn2(12);
                secondaryWeapon = rn2(2) ? DAGGER : KNIFE;
            } else {
                primaryWeapon = rn2(2) ? SPEAR : SHORT_SWORD;
            }
        } else if (mndx === PM_SERGEANT) {
            primaryWeapon = rn2(2) ? 81 : MACE; // FLAIL
        } else if (mndx === PM_LIEUTENANT) {
            primaryWeapon = rn2(2) ? 52 : LONG_SWORD; // BROADSWORD
        } else {
            primaryWeapon = rn2(2) ? LONG_SWORD : SILVER_SABER;
        }
        if (primaryWeapon) mongets(primaryWeapon);
        if (!secondaryWeapon && primaryWeapon !== DAGGER && !rn2(4))
            secondaryWeapon = KNIFE;
        if (secondaryWeapon) mongets(secondaryWeapon);
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) mongets(offensiveItem);
        }

        let mercenaryAc = (mndx === PM_SOLDIER || mndx === PM_WATCHMAN) ? 3
            : mndx === PM_SERGEANT ? 0
                : (mndx === PM_LIEUTENANT
                    || mndx === PM_WATCH_CAPTAIN) ? -2 : -3;
        const addArmor = otyp => {
            const object = mongets(otyp);
            mercenaryAc += armorBonus(object);
        };
        if (mercenaryAc < -1 && rn2(5))
            addArmor(rn2(5) ? PLATE_MAIL : CRYSTAL_PLATE_MAIL);
        else if (mercenaryAc < 3 && rn2(5))
            addArmor(rn2(3) ? SPLINT_MAIL : BANDED_MAIL);
        else if (rn2(5))
            addArmor(rn2(3) ? RING_MAIL : STUDDED_LEATHER_ARMOR);
        else
            addArmor(LEATHER_ARMOR);

        if (mercenaryAc < 10 && rn2(3)) addArmor(HELMET);
        else if (mercenaryAc < 10 && rn2(2)) addArmor(DENTED_POT);

        if (mercenaryAc < 10 && rn2(3)) addArmor(SMALL_SHIELD);
        else if (mercenaryAc < 10 && rn2(2)) addArmor(LARGE_SHIELD);

        if (mercenaryAc < 10 && rn2(3)) addArmor(LOW_BOOTS);
        else if (mercenaryAc < 10 && rn2(2)) addArmor(HIGH_BOOTS);

        if (mercenaryAc < 10 && rn2(3)) addArmor(LEATHER_GLOVES);
        else if (mercenaryAc < 10 && rn2(2)) addArmor(LEATHER_CLOAK);

        if (mndx === PM_WATCHMAN) {
            if (rn2(3)) mongets(TIN_WHISTLE);
        } else if (mndx !== PM_WATCH_CAPTAIN) {
            if (!rn2(3)) mongets(K_RATION);
            if (!rn2(2)) mongets(C_RATION);
            if (mndx !== PM_SOLDIER && !rn2(3)) mongets(BUGLE);
            // Ordinary soldiers usually stop before the defensive and
            // miscellaneous magic-item reservoirs.
            if (mndx === PM_SOLDIER && rn2(13))
                skipCommonMonsterInventory = true;
        }
    } else if (mndx === PM_GUARD) {
        // C refs: makemon.c:m_initweap()/m_initinv(), PM_GUARD.  Vault
        // guards use the default mercenary weapon branch, five sequential
        // armor rounds, then receive a cursed tin whistle.
        let primaryWeapon = 0;
        let secondaryWeapon = 0;
        if (!rn2(4)) primaryWeapon = DAGGER;
        if (!rn2(7)) secondaryWeapon = SPEAR;
        if (primaryWeapon) mongets(primaryWeapon);
        if (!secondaryWeapon && primaryWeapon !== DAGGER && !rn2(4))
            secondaryWeapon = KNIFE;
        if (secondaryWeapon) mongets(secondaryWeapon);
        rn2(75);

        if (rn2(5)) mongets(rn2(3) ? SPLINT_MAIL : BANDED_MAIL);
        else mongets(LEATHER_ARMOR);

        if (rn2(3)) mongets(HELMET);
        else if (rn2(2)) mongets(DENTED_POT);

        if (rn2(3)) mongets(SMALL_SHIELD);
        else if (rn2(2)) mongets(LARGE_SHIELD);

        if (rn2(3)) mongets(LOW_BOOTS);
        else if (rn2(2)) mongets(HIGH_BOOTS);

        if (rn2(3)) mongets(LEATHER_GLOVES);
        else if (rn2(2)) mongets(LEATHER_CLOAK);

        const whistle = mksobj(TIN_WHISTLE, true, false);
        whistle.cursed = true;
        whistle.buc = 'cursed';
        addObjectToMonsterInventory(pendingMonster, whistle, game);
        hasMonsterInventory = true;
    } else if (mndx === PM_SHOPKEEPER) {
        // C refs: makemon.c m_initweap() and m_initinv().  Shopkeepers have
        // no class-specific weapon, but are armed and therefore still reach
        // the final offensive-item roll before receiving their fixed kit.
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) mongets(offensiveItem);
        }
        mongets(SKELETON_KEY);
        switch (rn2(4)) {
        case 0:
            mongets(WAN_MAGIC_MISSILE);
            // fall through
        case 1:
            mongets(POT_EXTRA_HEALING);
            // fall through
        case 2:
            mongets(POT_HEALING);
            // fall through
        case 3:
            mongets(WAN_STRIKING);
            break;
        }
    } else if (MONSTER_SYMBOL[mndx] === 56
        && (genderFlags & M2_DEMON)
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C m_initweap(), S_DEMON: fixed demon weapons are added before the
        // same bias-sensitive general armament table used by normal monsters.
        if (mndx === PM_BALROG) {
            mongets(BULLWHIP);
            mongets(52); // BROADSWORD
        } else if (mndx === PM_ORCUS) {
            mongets(WAN_DEATH);
        } else if (mndx === PM_HORNED_DEVIL) {
            mongets(rn2(4) ? 33 : BULLWHIP); // TRIDENT
        } else if (mndx === PM_DISPATER) {
            mongets(WAN_STRIKING);
        } else if (mndx === PM_YEENOGHU) {
            mongets(81); // FLAIL
        }
        giveGeneralMonsterWeapon();
    } else if (mndx === PM_ARCH_PRIEST || mndx === PM_ALIGNED_CLERIC
        || mndx === PM_HIGH_CLERIC) {
        // C ref: makemon.c m_initweap(), Priest/Cleric quest-leader branch.
        // This intentionally bypasses ordinary object initialization.
        const mace = mksobj(MACE, false, false);
        mace.spe = rnd(3);
        if (!rn2(2)) {
            mace.cursed = true;
            mace.buc = 'cursed';
        }
        addObjectToMonsterInventory(pendingMonster, mace, game);
        hasMonsterInventory = true;
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) mongets(offensiveItem);
        }
    } else if (mndx === PM_STUDENT || mndx === PM_ACOLYTE
        || mndx === PM_APPRENTICE) {
        // C ref: makemon.c m_initweap(), MS_GUARDIAN novice equipment.
        // Students, acolytes, and apprentices share the same low-tier
        // guardian armament graph; keeping it constructor-owned also covers
        // their respective quest-start level programs.
        if (rn2(2)) mongets(rn2(3) ? DAGGER : KNIFE);
        if (rn2(5)) mongets(rn2(3) ? LEATHER_JACKET : LEATHER_CLOAK);
        if (rn2(3)) mongets(rn2(3) ? LOW_BOOTS : HIGH_BOOTS);
        if (rn2(3)) mongets(POT_HEALING);
        giveOffensiveMonsterItem();
    } else if (mndx === PM_CHIEFTAIN) {
        // C ref: makemon.c m_initweap(), the armed MS_GUARDIAN tier used by
        // chieftains, pages, roshi, and warriors.
        mongets(rn2(3) ? LONG_SWORD : SHORT_SWORD);
        mongets(rn2(3) ? CHAIN_MAIL : LEATHER_ARMOR);
        if (rn2(2)) mongets(rn2(2) ? LOW_BOOTS : HIGH_BOOTS);
        if (!rn2(3)) mongets(LEATHER_CLOAK);
        if (!rn2(3)) {
            mongets(BOW);
            const arrows = mongets(ARROW);
            arrows.quan = 3 + rn2(12);
            arrows.quantity = arrows.quan;
            arrows.owt = (OBJECT_WEIGHT[ARROW] ?? 1) * arrows.quan;
        }
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 15
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_ORC
        // C ref: makemon.c m_initweap(), S_ORC.  The common helm probe
        // precedes a subtype-specific equipment graph; an orc captain chooses
        // one of the two ranked subtypes before entering the same graph.
        if (rn2(2)) mongets(ORCISH_HELM);
        const orcSubtype = mndx === 77 // PM_ORC_CAPTAIN
            ? (rn2(2) ? 74 : 75) : mndx;
        if (orcSubtype === 74) { // PM_MORDOR_ORC
            if (!rn2(3)) mongets(SCIMITAR);
            if (!rn2(3)) mongets(ORCISH_SHIELD);
            if (!rn2(3)) mongets(KNIFE);
            if (!rn2(3)) mongets(ORCISH_CHAIN_MAIL);
        } else if (orcSubtype === 75) { // PM_URUK_HAI
            if (!rn2(3)) mongets(ORCISH_CLOAK);
            if (!rn2(3)) mongets(ORCISH_SHORT_SWORD);
            if (!rn2(3)) mongets(IRON_SHOES);
            if (!rn2(3)) {
                mongets(ORCISH_BOW);
                const arrows = mongets(ORCISH_ARROW);
                arrows.quan = 3 + rn2(12);
                arrows.quantity = arrows.quan;
            }
            if (!rn2(3)) mongets(URUK_HAI_SHIELD);
        } else if (mndx !== 76 && rn2(2)) { // not PM_ORC_SHAMAN
            mongets(mndx === 70 || !rn2(2) ? ORCISH_DAGGER : SCIMITAR);
        }
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 46) { // S_TROLL
        if (!rn2(2)) {
            const polearms = [RANSEUR, PARTISAN, GLAIVE, SPETUM];
            mongets(polearms[rn2(polearms.length)]);
        }
        // The class switch only chooses the ordinary weapon.  Every armed
        // troll still reaches m_initweap()'s shared level-versus-rn2(75)
        // offensive-item tail; high-level Olog-hai make the winning branch
        // observable during summon-nasties.
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 49
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_WRAITH
        // C ref: makemon.c:m_initweap().  Armed wraith-class monsters receive
        // both fixed weapons before the shared offensive-item reservoir.
        mongets(KNIFE);
        mongets(LONG_SWORD);
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 52
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_ZOMBIE
        // C ref: makemon.c m_initweap(), S_ZOMBIE.  Armed skeletons first
        // probe for leather armor and a knife/short sword, then rejoin the
        // shared offensive-item tail.
        if (!rn2(4)) mongets(LEATHER_ARMOR);
        if (!rn2(4)) mongets(rn2(3) ? KNIFE : SHORT_SWORD);
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 34
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_GIANT
        // C ref: makemon.c m_initweap().  Giants independently probe for a
        // throwing boulder (ettins get a club) and, except for ettins, a
        // heavy melee weapon before the common offensive-item reservoir.
        if (rn2(2))
            mongets(mndx === PM_ETTIN ? CLUB : BOULDER);
        if (mndx !== PM_ETTIN && !rn2(5))
            mongets(rn2(2) ? TWO_HANDED_SWORD : BATTLE_AXE);
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 41) { // S_OGRE
        const range = mndx === 205 ? 3 : mndx === 204 ? 6 : 12;
        mongets(!rn2(range) ? BATTLE_AXE : CLUB);
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 29) { // S_CENTAUR
        // Forest centaurs use bows; the other two species use crossbows.
        // The missile stack is created only when the class probe succeeds.
        if (rn2(2)) {
            const forest = mndx === 131;
            mongets(forest ? BOW : CROSSBOW);
            const missiles = mongets(forest ? 18 : CROSSBOW_BOLT); // ARROW
            missiles.quan = 3 + rn2(12);
            missiles.quantity = missiles.quan;
        }
        giveOffensiveMonsterItem();
    } else if (mndx === PM_SALAMANDER) {
        // C ref: makemon.c m_initweap(), S_LIZARD/PM_SALAMANDER.  The fixed
        // polearm choice replaces the generic bias-sensitive weapon table,
        // then rejoins its ordinary offensive-item tail.
        mongets(rn2(7) ? SPEAR : rn2(3) ? 33 : STILETTO);
        giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 33 // S_GNOME
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C ref: makemon.c m_initweap(), default class armament.  Gnomes do
        // not have a dedicated switch case, so armed gnomes reach this table;
        // leader/ruler ranks narrow it through the lord/prince bias.
        const bias = ((genderFlags & 0x00000400) ? 1 : 0)
            + ((genderFlags & 0x00000800) ? 2 : 0)
            + ((genderFlags & M2_NASTY) ? 1 : 0);
        const weaponRoll = rnd(14 - (2 * bias));
        const initThrow = (otyp, quantityRange) => {
            const object = mongets(otyp);
            object.quan = 3 + rn2(quantityRange);
            object.quantity = object.quan;
        };
        switch (weaponRoll) {
        case 1:
            if (genderFlags & M2_STRONG) mongets(BATTLE_AXE);
            else initThrow(DART, 12);
            break;
        case 2:
            if (genderFlags & M2_STRONG) mongets(TWO_HANDED_SWORD);
            else {
                mongets(CROSSBOW);
                initThrow(CROSSBOW_BOLT, 12);
            }
            break;
        case 3:
            mongets(BOW);
            initThrow(18, 12); // ARROW
            break;
        case 4:
            if (genderFlags & M2_STRONG) mongets(LONG_SWORD);
            else initThrow(DAGGER, 3);
            break;
        case 5:
            mongets((genderFlags & M2_STRONG) ? LUCERN_HAMMER : AKLYS);
            break;
        default:
            break;
        }
        giveOffensiveMonsterItem();
    } else if (MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        if (M_INITWEAP_SWITCH_CLASSES.has(MONSTER_SYMBOL[mndx])) {
            // This explicit class arm has no additional behavior in the
            // currently ported constructor, but it still bypasses default.
            giveOffensiveMonsterItem();
        } else {
            // C m_initweap()'s default switch arm first runs the
            // bias-sensitive general weapon table; the rn2(75) probe is its
            // tail, not a replacement for that table.
            giveGeneralMonsterWeapon();
        }
    }

    // C ref: makemon.c set_mimic_sym().  A mimic chooses its initial
    // disguise before the common inventory reservoir rolls.  Lua can replace
    // that appearance after makemon() returns, but not skip this transaction.
    const isMimic = MONSTER_SYMBOL[mndx] === S_MIMIC;
    const floorObject = game.level.objects?.[x]?.[y]?.[0];
    const mimicHasFloorObject = !!floorObject;
    const mimicLocation = game.level.at(x, y);
    const mimicRoomIndex = (mimicLocation?.roomno ?? 0) - ROOMOFFSET;
    // C's `svr.rooms` and `gs.subrooms` share the encoded room-number
    // namespace.  Room-form special levels put shops in subrooms, so resolve
    // the MAXNROFROOMS offset before set_mimic_sym() inspects their type.
    const mimicRoom = roomForIndex(game.level, mimicRoomIndex);
    const mimicRoomType = mimicRoom?.rtype ?? null;
    let mimicInitialAppearance = 0;
    let mimicAppearanceMonster = null;
    const mazeMimicCandidate = isMimic && !mimicHasFloorObject
        && game.level.flags.is_maze_lev
        && !(game.dungeons?.[game.u?.uz?.dnum ?? 0]?.dname
            === 'The Gnomish Mines' && game.level.flags.has_town)
        && !game.level.flags.sokoban_rules;
    // set_mimic_sym() tests the maze-statue branch before room-type branches,
    // including shops.  Preserve the draw even when it fails and the mimic
    // subsequently chooses a shop disguise.
    const mazeMimicStatue = mazeMimicCandidate ? !!rn2(2) : false;
    if (isMimic && !mimicHasFloorObject && mazeMimicStatue) {
        mimicInitialAppearance = STATUE;
        mimicAppearanceMonster = rndmonnum();
    } else if (isMimic && (mimicHasFloorObject
        || mimicRoomType == null || mimicRoomType < SHOPBASE)) {
        const hasTrap = game.level.traps?.some(trap =>
            trap.tx === x && trap.ty === y);
        if (floorObject) {
            mimicInitialAppearance = floorObject.otyp;
        } else if (mimicRoomIndex < 0 && !hasTrap) {
            mimicInitialAppearance = BOULDER;
        } else if (mimicRoomType === ZOO || mimicRoomType === VAULT) {
            mimicInitialAppearance = GOLD_PIECE;
        } else {
            // makemon.c:set_mimic_sym() `syms`.  The first two entries are
            // furniture, the last two are STRANGE_OBJECT, and the middle
            // entries are concrete object classes.  The observed trapped
            // Sokoban mimic selects GEM_CLASS and constructs then frees it.
            const disguiseClasses = [
                null, null, RING_CLASS, WAND_CLASS, WEAPON_CLASS,
                FOOD_CLASS, COIN_CLASS, SCROLL_CLASS, POTION_CLASS,
                ARMOR_CLASS, AMULET_CLASS, TOOL_CLASS, ROCK_CLASS,
                GEM_CLASS, SPBOOK_CLASS, 0, 0,
            ];
            const disguiseClass = disguiseClasses[rn2(disguiseClasses.length)];
            if (disguiseClass === COIN_CLASS)
                mimicInitialAppearance = GOLD_PIECE;
            else if (disguiseClass > 0)
                mimicInitialAppearance = mkobj(disguiseClass, false).otyp;
            else if (disguiseClass === null)
                rn2(8); // select one of set_mimic_sym()'s furniture entries
        }
        // set_mimic_sym() gives object appearances which depict a creature
        // their own represented-monster identity after the temporary object
        // (if any) has been completely constructed and freed.
        if (mimicInitialAppearance === STATUE
            || mimicInitialAppearance === FIGURINE
            || mimicInitialAppearance === CORPSE
            || mimicInitialAppearance === EGG
            || mimicInitialAppearance === TIN) {
            mimicAppearanceMonster = rndmonnum();
        }
    } else if (isMimic && !game.level.flags.sokoban_rules
        && !mimicHasFloorObject && mimicRoomType >= SHOPBASE) {
        // C set_mimic_sym() uses the live shop table after its depth gate.
        // Health-food stores deliberately keep VEGETARIAN_CLASS abstract and
        // choose one of two recognizable vegetarian object appearances.
        if (rn2(10) < depth_of_level(game.u?.uz)) {
            const shopIndex = mimicRoomType - SHOPBASE;
            let disguiseClass = getShopItem(shopIndex);
            if (disguiseClass < 0) {
                mimicInitialAppearance = -disguiseClass;
            } else if (shopIndex === 10
                && disguiseClass === VEGETARIAN_CLASS) {
                mimicInitialAppearance = rn2(2)
                    ? LUMP_OF_ROYAL_JELLY : SLIME_MOLD;
            } else {
                if (disguiseClass === RANDOM_CLASS
                    || disguiseClass >= VEGETARIAN_CLASS) {
                    const disguiseClasses = [
                        RING_CLASS, WAND_CLASS, WEAPON_CLASS, FOOD_CLASS,
                        COIN_CLASS, SCROLL_CLASS, POTION_CLASS, ARMOR_CLASS,
                        AMULET_CLASS, TOOL_CLASS, ROCK_CLASS, GEM_CLASS,
                        SPBOOK_CLASS, 0, 0,
                    ];
                    disguiseClass = disguiseClasses[rn2(disguiseClasses.length)];
                }
                if (disguiseClass === COIN_CLASS)
                    mimicInitialAppearance = GOLD_PIECE;
                else if (disguiseClass > 0)
                    mimicInitialAppearance = mkobj(disguiseClass, false).otyp;
            }
        }
        if (mimicInitialAppearance === STATUE
            || mimicInitialAppearance === FIGURINE
            || mimicInitialAppearance === CORPSE
            || mimicInitialAppearance === EGG
            || mimicInitialAppearance === TIN) {
            mimicAppearanceMonster = rndmonnum();
        }
    }

    // m_initinv(), m_dowear(), and the domestic-saddle probe share the same
    // allow_minvent gate.  NO_MINVENT must consume none of their RNG and must
    // leave an empty minvent even for species with fixed starting objects.
    if (allowMonsterInventory
        && (mndx === PM_ARCH_PRIEST || mndx === PM_ALIGNED_CLERIC
            || mndx === PM_HIGH_CLERIC)) {
        // C ref: makemon.c m_initinv(), Priest/Cleric quest-leader branch.
        mongets(rn2(7) ? ROBE
            : rn2(3) ? CLOAK_OF_PROTECTION : CLOAK_OF_MAGIC_RESISTANCE);
        mongets(SMALL_SHIELD);
        mkmonmoney(rn1(10, 20));
    }

    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 14) { // S_NYMPH
        // C ref: makemon.c m_initinv(), S_NYMPH.
        if (!rn2(2)) mongets(MIRROR);
        if (!rn2(2)) mongets(POT_OBJECT_DETECTION);
    }
    if (allowMonsterInventory && mndx === PM_MINOTAUR) {
        // C ref: makemon.c:m_initinv(), S_GIANT.  This probe belongs to the
        // explicit minotaur constructor, before the common defensive and
        // miscellaneous inventory reservoirs.
        if (!rn2(8) || (game.in_mklev && Is_earthlevel(game.u?.uz)))
            mongets(WAN_DIGGING);
    } else if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 34
        && (genderFlags & M2_GIANT)) {
        // C ref: makemon.c m_initinv(), is_giant().  Each iteration chooses
        // one weighted gem/glass type, creates it without ordinary object
        // initialization, and replaces its stack size with rn1(2,3).
        for (let count = rn2(Math.trunc(baseLevel / 2));
            count > 0; count--) {
            const gem = mksobj(
                rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1), false, false,
            );
            gem.quan = rn1(2, 3);
            gem.quantity = gem.quan;
            gem.owt = (OBJECT_WEIGHT[gem.otyp] ?? 1) * gem.quan;
            addObjectToMonsterInventory(pendingMonster, gem, game);
            hasMonsterInventory = true;
        }
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 12) { // S_LEPRECHAUN
        mkmonmoney(d(level_difficulty(), 30));
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 39) { // S_MUMMY
        if (rn2(7)) mongets(MUMMY_WRAPPING);
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 38) { // S_LICH
        if (mndx === 185 && !rn2(13)) { // PM_MASTER_LICH
            mongets(rn2(7) ? ATHAME : WAN_NOTHING);
        } else if (mndx === 186 && !rn2(3)) { // PM_ARCH_LICH
            const weapon = mksobj(
                rn2(3) ? ATHAME : QUARTERSTAFF,
                true, !rn2(13),
            );
            if (weapon.spe < 2) weapon.spe = rnd(3);
            if (!rn2(4)) weapon.oerodeproof = true;
            addObjectToMonsterInventory(pendingMonster, weapon, game);
            hasMonsterInventory = true;
        }
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 33) { // S_GNOME
        // C ref: makemon.c m_initinv(), S_GNOME.  During Mines generation
        // the candle chance is 1/20 (1/60 elsewhere).
        const dungeonName = game.dungeons?.[game.u?.uz?.dnum ?? 0]?.dname;
        const candleChance = game.in_mklev
            && dungeonName === 'The Gnomish Mines' ? 20 : 60;
        if (!rn2(candleChance)) {
            const candle = mongets(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE);
            candle.quan = 1;
            candle.quantity = 1;
            // levl is addressed by map coordinates; Level.at() is the shared
            // accessor for ordinary and Lua-special maps, whose backing
            // storage need not expose a column at map[x].
            candle.lamplit = !game.level.at(x, y)?.lit;
        }
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 43) { // S_QUANTMECH
        // C ref: makemon.c m_initinv().  The class switch evaluates the rare
        // Schrödinger-box probe before its PM_QUANTUM_MECHANIC species test,
        // so genetic engineers consume the same rn2(20) even though they can
        // never receive the box.  Keep the success path as a real contained-
        // object transaction so later discovery can observe the same owner.
        if (!rn2(20) && mndx === 210) { // PM_QUANTUM_MECHANIC
            const box = mksobj(LARGE_BOX, false, false);
            const cat = mksobj(CORPSE, true, false);
            box.spe = 1;
            cat.corpsenm = 33; // PM_HOUSECAT
            stopObjectTimer(cat, OBJECT_TIMER_KIND.ROT_CORPSE);
            cat.otrapped = false;
            box.contents = [cat];
            addObjectToMonsterInventory(pendingMonster, box, game);
            hasMonsterInventory = true;
        }
    }

    if (allowMonsterInventory && mndx === 298 && !rn2(4))
        mongets(SPEAR); // PM_ICE_DEVIL
    if (allowMonsterInventory && mndx === PM_ASMODEUS) {
        // C makemon.c:m_initinv(), S_DEMON.  Asmodeus has no weapon attack,
        // so his fixed cold/fire wands are inventory declarations rather
        // than m_initweap() gear and precede both common magic reservoirs.
        mongets(WAN_COLD);
        mongets(WAN_FIRE);
    }

    // m_initinv() finishes with level-gated defensive and miscellaneous item
    // choices for every monster.
    if (allowMonsterInventory && !skipCommonMonsterInventory) {
        const defensiveRoll = rn2(50);
        if (baseLevel > defensiveRoll) {
            const defensiveItem = randomDefensiveMonsterItem(pendingMonster);
            if (defensiveItem) mongets(defensiveItem);
        }
        const miscellaneousRoll = rn2(100);
        if (baseLevel > miscellaneousRoll) {
            const miscellaneousItem = randomMiscMonsterItem(pendingMonster);
            if (miscellaneousItem) mongets(miscellaneousItem);
        }
    }
    // C ref: makemon.c m_initinv().  Greedy monsters get a final gold gate
    // after the defensive and miscellaneous reservoirs.  Amount dice depend
    // on whether class-specific equipment already populated the inventory.
    if (allowMonsterInventory && (genderFlags & M2_GREEDY)
        && !monsterInventory.some(object => object.otyp === GOLD_PIECE)
        && !rn2(5)) {
        const amount = d(level_difficulty(), hasMonsterInventory ? 5 : 10);
        if (amount > 0) {
            mkmonmoney(amount);
        }
    }
    // makemon()'s rare domestic-saddle check is likewise unconditional on
    // the random roll and short-circuits only after it fails.
    if (allowMonsterInventory) rn2(100);
    const classIndex = MONSTER_SYMBOL[mndx] || 0;
    // C makemon.c: during level creation, M1_CONCEAL actors hide under an
    // object already present on their square and eel-class actors hide in
    // pools.  Concealment is producer state: display may reveal it through
    // telepathy, but must not infer the state from species at paint time.
    const monsterUndetected = !!(game.in_mklev
        && ((((MONSTER_FLAGS1[mndx] ?? 0) & 0x00000080)
                && canMonsterHideUnderFloorObject(x, y))
            || (classIndex === 57
                && IS_POOL(game.level?.at?.(x, y)?.typ)))); // M1_CONCEAL/S_EEL
    // Stalkers and black lights are permanently invisible from birth.  Keep
    // both the current and permanent bits because later reveal/re-hide paths
    // distinguish them even though their initial projection is identical.
    const monsterInvisible = mndx === PM_STALKER || mndx === PM_BLACK_LIGHT;
    // C makemon.c initializes strategic presentation state for waiting and
    // covetous species unless the caller explicitly supplies MM_NOWAIT.
    // STRAT_APPEARMSG is consumed by the first visible relocation message;
    // it cannot be reconstructed later from the monster's current species.
    const flags3 = MONSTER_FLAGS3[mndx] || 0;
    let monsterStrategy = 0;
    if (!(mmflags & MM_NOWAIT)) {
        if (flags3 & 0x0040) monsterStrategy |= STRAT_WAITFORU;
        if (flags3 & 0x0080) monsterStrategy |= STRAT_CLOSE;
        if (flags3 & (0x00c0 | 0x001f))
            monsterStrategy |= STRAT_APPEARMSG;
    }
    // makemon.c's S_BAT type initialization calls
    // mon_adjust_speed(MFAST) for native bats born in Gehennom.  This is a
    // permanent-speed property of the actor, not a projection of its current
    // species; vampire bases which immediately shapechange into a bat do not
    // pass through this birth-time branch.
    const hellishNativeBat = classIndex === 28
        && !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const monster = {
        m_id: monsterId,
        mnum: mndx, mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: baseLevel, female: monsterFemale,
        msleeping: monsterSleeping,
        mpeaceful: clericMinion?.mpeaceful ?? (peaceful ? 1 : 0),
        mcanmove: 1,
        mux: pendingMonster.mux, muy: pendingMonster.muy,
        mundetected: monsterUndetected,
        minvis: monsterInvisible,
        perminvis: monsterInvisible,
        movement: 0, mmove: MONSTER_MOVE[mndx] ?? 0,
        permspeed: hellishNativeBat ? 2 : 0,
        mspeed: hellishNativeBat ? 2 : 0,
        symbol: MONSTER_CLASS_SYMBOLS[classIndex] || '?',
        color: MONSTER_COLOR[mndx],
        hasInventory: hasMonsterInventory,
        minvent: monsterInventory,
        inventory: monsterInventory,
        mstrategy: monsterStrategy,
        // makemon() allocates weapon_check as NO_WEAPON_WANTED (zero).
        // m_initweap() only supplies inventory; the first AT_WEAP slot will
        // request NEED_HTH_WEAPON if no weapon is currently wielded.  Later
        // pickup, polymorph, and loss paths explicitly set NEED_WEAPON.
        weaponCheck: 0,
    };
    if (clericMinion) {
        monster.isminion = 1;
        monster.emin = {
            min_align: clericMinion.min_align,
            renegade: clericMinion.renegade,
        };
        monster.maligntyp = clericMinion.min_align;
    }
    if (pendingMonster.wormno) {
        monster.wormno = pendingMonster.wormno;
        monster.wormSegments = pendingMonster.wormSegments;
    }
    if (mndx === PM_DOPPELGANGER) monster.cham = PM_DOPPELGANGER;
    if (mndx === PM_WIZARD_OF_YENDOR) {
        monster.iswiz = true;
        game.context.no_of_wizards =
            (game.context.no_of_wizards || 0) + 1;
    }
    initializeMonsterArmor(monster);
    if (typeof monsterWeaponQuantity !== 'undefined') {
        monster.weaponQuantity = monsterWeaponQuantity;
        monster.weaponReady = false;
    }
    if (isMimic) {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = mimicInitialAppearance;
        if (mimicAppearanceMonster != null)
            monster.mcorpsenm = mimicAppearanceMonster;
    }
    if (game.level.flags.sokoban_rules) {
        // C makemon(): non-mindless Sokoban monsters know pits and holes from
        // birth.  Giant mimics are not mindless.
        monster.mtrapseen = (1 << (PIT - 1)) | (1 << (HOLE - 1));
    }
    if (mndx === PM_SHOPKEEPER) {
        monster.mpeaceful = 1;
    }
    if (generatedGhostName != null) monster.ghostNameIndex = generatedGhostName;
    registerQuestLeader(monster);
    game.level.monsters[monsterIndex] = monster;
    return monster;
}

// Direct-coordinate creation for source callers which deliberately bypass
// enexto(), such as savebones() creating the dead hero's ghost on u.ux/u.uy.
export async function makemonAt(mnum, x, y, flags = 0) {
    return makemon(mnum, x, y, flags);
}

// C teleport.c:collect_coords().  Each square ring is completely collected
// and shuffled before the next ring begins.  A zero maximum means the whole
// usable map, excluding the center and unused column zero.
function collectShuffledMonsterCoordinates(centerX, centerY, maxRadius = 0) {
    const candidates = [];
    const rowRange = centerY < ROWNO / 2
        ? ROWNO - 1 - centerY : centerY;
    const columnRange = centerX < COLNO / 2
        ? COLNO - 1 - centerX : centerX;
    const finalRadius = maxRadius
        ? Math.min(maxRadius, Math.max(rowRange, columnRange))
        : Math.max(rowRange, columnRange);
    for (let radius = 1; radius <= finalRadius; radius++) {
        const ring = [];
        const lowx = centerX - radius, highx = centerX + radius;
        const lowy = centerY - radius, highy = centerY + radius;
        for (let y = Math.max(lowy, 0); y <= Math.min(highy, ROWNO - 1); y++) {
            for (let x = Math.max(lowx, 1); x <= Math.min(highx, COLNO - 1); x++) {
                if (x !== lowx && x !== highx && y !== lowy && y !== highy)
                    continue;
                ring.push({ x, y });
            }
        }
        for (let i = 0, remaining = ring.length; remaining > 1;
            i++, remaining--) {
            const pick = rn2(remaining);
            if (pick) [ring[i], ring[i + pick]] = [ring[i + pick], ring[i]];
        }
        candidates.push(...ring);
    }
    return candidates;
}

function findMonsterNearPositionCore(
    mnum, centerX, centerY, checkScary, ignoreWater, state,
) {
    const nearby = collectShuffledMonsterCoordinates(centerX, centerY, 3);
    for (const pos of nearby) {
        if (monsterGoodPosition(
            mnum, pos.x, pos.y, false, checkScary, ignoreWater, state,
        ))
            return pos;
    }

    // NEW_ENEXTO deliberately reshuffles the near rings while collecting the
    // complete map, then skips their count because they were already tested.
    const all = collectShuffledMonsterCoordinates(centerX, centerY, 0);
    for (let index = nearby.length; index < all.length; index++) {
        const pos = all[index];
        if (monsterGoodPosition(
            mnum, pos.x, pos.y, false, checkScary, ignoreWater, state,
        ))
            return pos;
    }
    return null;
}

// C teleport.c:enexto().  The first complete search avoids scary squares;
// only total failure triggers an independently shuffled unrestricted search.
// Exposing selection separately lets callbacks distinguish enexto failure
// from a later makemon()/make_familiar() construction failure.
export function findMonsterNearPosition(
    mnum, centerX, centerY, { ignoreWater = false, state = game } = {},
) {
    return findMonsterNearPositionCore(
        mnum, centerX, centerY, true, ignoreWater, state,
    ) || findMonsterNearPositionCore(
        mnum, centerX, centerY, false, ignoreWater, state,
    );
}

function heroCloneBirthLimit(mnum) {
    const name = String(MONSTER_NAME[mnum] || '').toLowerCase();
    return name === 'nazgul' ? 9 : name === 'erinys' ? 3 : MAXMONNO;
}

function recordHeroCloneBirth(mnum, state) {
    if (!Array.isArray(state.mvitals)) state.mvitals = [];
    const vital = state.mvitals[mnum]
        || (state.mvitals[mnum] = { mvflags: 0, born: 0 });
    if ((vital.born ?? 0) < 255) vital.born = (vital.born ?? 0) + 1;
    if ((vital.born ?? 0) >= heroCloneBirthLimit(mnum)
        && !((MONSTER_GENO[mnum] ?? 0) & G_NOGEN)) {
        vital.mvflags = (vital.mvflags ?? 0) | G_EXTINCT;
    }
}

// C refs: mhitu.c:cloneu(), potion.c:split_mon(), dog.c:initedog().
// The actor is a fresh makemon birth rather than a copy of youmonst: it owns
// ordinary placement, HP, gender, attitude, and identity RNG before cloneu()
// replaces its level/HP and initializes a named tame companion.  split_mon()
// then halves maximum form HP separately, leaving odd points with the hero.
export async function splitHeroMonsterForm(state = game) {
    if (state !== game)
        throw new Error('hero clone owner requires live game state');
    const u = state.u || {};
    if (Number.isFinite(u.mh) && Number.isFinite(u.mhmax)
        && u.mh > u.mhmax) u.mh = u.mhmax;
    const mnum = u.umonnum;
    const vitalFlags = state.mvitals?.[mnum]?.mvflags ?? 0;
    if (!Number.isInteger(mnum) || !Number.isFinite(u.mh)
        || !Number.isFinite(u.mhmax) || u.mh <= 1
        || (vitalFlags & (G_EXTINCT | G_GENOD))) return null;

    const clone = await makemonNear(
        mnum, u.ux, u.uy, NO_MINVENT | MM_EDOG | MM_NOMSG, true,
    );
    if (!clone) return null;
    recordHeroCloneBirth(mnum, state);

    const name = state.plname || 'player';
    const edog = {
        parentmid: clone.m_id,
        droptime: 0,
        dropdist: 10000,
        apport: u.acurr?.a?.[5] ?? 3,
        whistletime: 0,
        hungrytime: (state.moves ?? 0) + 1000,
        ogoal: { x: -1, y: -1 },
        abuse: 0,
        revivals: 0,
        mhpmax_penalty: 0,
        killed_by_u: 0,
    };
    clone.mcloned = 1;
    clone.name = name;
    clone.mgivenname = name;
    clone.m_lev = MONSTER_LEVEL[mnum] ?? clone.m_lev;
    clone.mtame = Math.max(
        (MONSTER_FLAGS2[mnum] ?? 0) & M2_DOMESTIC ? 10 : 5,
        clone.mtame ?? 0,
    );
    clone.mpeaceful = 1;
    clone.mavenge = 0;
    clone.mleashed = 0;
    clone.meating = 0;
    clone.pet = true;
    clone.minvent = [];
    clone.inventory = clone.minvent;
    clone.hasInventory = false;
    clone.edog = edog;
    clone.mextra = { ...(clone.mextra || {}), mgivenname: name, edog };
    delete clone.malign;

    clone.mhpmax = u.mhmax;
    clone.mhp = Math.trunc(u.mh / 2);
    u.mh -= clone.mhp;
    clone.mhpmax = Math.trunc(u.mhmax / 2);
    u.mhmax -= clone.mhpmax;
    if (!u.uconduct) u.uconduct = {};
    u.uconduct.pets = (u.uconduct.pets ?? 0) + 1;
    newsym(clone.mx, clone.my);
    return clone;
}

// C refs: teleport.c enexto()/collect_coords() and makemon.c makemon().
export async function makemonNear(
    mnum, centerX, centerY, flags = 0,
    requestedByHero = centerX === game.u?.ux && centerY === game.u?.uy,
) {
    const pos = findMonsterNearPosition(mnum, centerX, centerY, {
        ignoreWater: !!(flags & MM_IGNOREWATER),
    });
    if (!pos) return null;
    // teleport.c:enexto_core() tests every shuffled coordinate through
    // goodpos() for the requested species before makemon() owns construction.
    return makemon(mnum, pos.x, pos.y, flags, requestedByHero);
}

// C mcastu.c:mcast_insects().  enexto() tests positions using the caster's
// species before mkclass() chooses each summoned insect.  Keep both private
// constructor owners in this module so the spell layer receives only actors.
export async function summonInsectsForMonster(summoner) {
    const created = [];
    let insect = mkclass(1, 0); // S_ANT
    const monsterClass = insect == null ? 45 : 1; // fallback S_SNAKE
    let quantity = (summoner.m_lev ?? 0) < 2
        ? 1 : rnd(Math.trunc((summoner.m_lev ?? 0) / 2));
    if (quantity < 3) quantity = 3;

    for (let count = 0; count <= quantity; count++) {
        const centerX = summoner.mux ?? game.u?.ux ?? summoner.mx;
        const centerY = summoner.muy ?? game.u?.uy ?? summoner.my;
        const candidates = [];
        for (let radius = 1; radius <= 3; radius++) {
            const ring = [];
            const lowx = centerX - radius, highx = centerX + radius;
            const lowy = centerY - radius, highy = centerY + radius;
            for (let y = Math.max(lowy, 0);
                y <= Math.min(highy, ROWNO - 1); y++) {
                for (let x = Math.max(lowx, 1);
                    x <= Math.min(highx, COLNO - 1); x++) {
                    if (x !== lowx && x !== highx
                        && y !== lowy && y !== highy) continue;
                    ring.push({ x, y });
                }
            }
            for (let index = 0, remaining = ring.length;
                remaining > 1; index++, remaining--) {
                const pick = rn2(remaining);
                if (pick) {
                    [ring[index], ring[index + pick]]
                        = [ring[index + pick], ring[index]];
                }
            }
            candidates.push(...ring);
        }
        const position = candidates.find(({ x, y }) =>
            monsterGoodPosition(summoner.mnum, x, y));
        if (!position) return { created, monsterClass };
        insect = mkclass(monsterClass, 0);
        if (insect == null) continue;
        const monster = await makemon(
            insect, position.x, position.y, MM_ANGRY | MM_NOMSG, false,
        );
        if (!monster) continue;
        monster.msleeping = 0;
        monster.mpeaceful = 0;
        monster.mtame = 0;
        created.push(monster);
    }
    return { created, monsterClass };
}

// C refs: wizard.c:nasty()/pick_nasty() and mcastu.c:mcast_summon_mons().
// A monster-cast summon deliberately chooses an explicit high-difficulty
// species, asks enexto() for a square around the caster's apparent hero
// position, then runs the ordinary makemon() constructor.  The created
// actors are returned so the caller can repaint them at the same runtime
// boundary where C's makemon() calls newsym().
export async function summonNastyMonsters(
    summoner, { onCreate = null } = {},
) {
    const created = [];
    const inHell = !!game.dungeons?.[
        game.u?.uz?.dnum ?? 0
    ]?.flags?.hellish;

    // wizard.c:nasty() occasionally delegates to demon.c:msummon().  The
    // caller handles that different summoning path.
    if (!rn2(10) && inHell) {
        return {
            count: 0,
            created,
            deferredDemonSummon: true,
        };
    }

    const summonerClass = MONSTER_SYMBOL[summoner?.mnum] ?? 0;
    let difficultyCap = MONSTER_DIFFICULTY[summoner?.mnum] ?? 0;
    const casterAlignment = Math.sign(
        MONSTER_ALIGNMENT[summoner?.mnum] ?? 0,
    );
    const outerLimit = (game.u?.ulevel ?? 1) > 3
        ? Math.trunc((game.u?.ulevel ?? 1) / 3) : 1;
    const outerCount = rnd(outerLimit);
    const archLich = monsterIndexByName('arch-lich');
    const archon = monsterIndexByName('Archon');
    const lowerArchDifficulty = Math.min(
        MONSTER_DIFFICULTY[archon] ?? 0,
        MONSTER_DIFFICULTY[archLich] ?? 0,
    );

    for (let i = outerCount; i > 0 && created.length < 10; --i) {
        for (let j = 0; j < 20; ++j) {
            let makeindex = null;
            let candidateClass = 0;
            let tryLimit = 11;
            do {
                if (!--tryLimit) {
                    makeindex = null;
                    break;
                }
                makeindex = pickNastyShape(difficultyCap);
                candidateClass = MONSTER_SYMBOL[makeindex] ?? 0;
            } while (
                (difficultyCap > 0
                    && (MONSTER_DIFFICULTY[makeindex] ?? 0)
                        >= difficultyCap
                    && (MONSTER_ATTACKS[makeindex] || []).some(
                        ([attackType]) => attackType === 255,
                    ))
                || (summonerClass === 56 && candidateClass === 30)
                || (summonerClass === 30 && candidateClass === 56)
            );
            if (makeindex == null) continue;

            const monster = await makemonNear(
                makeindex,
                summoner?.mux ?? game.u?.ux ?? 0,
                summoner?.muy ?? game.u?.uy ?? 0,
                MM_NOMSG,
            );
            if (!monster) {
                // C tries a random replacement only when direct construction
                // fails (normally because the chosen species was genocided).
                // The current constructor does not yet expose that distinct
                // failure reason, so leave the replacement cone explicit.
                continue;
            }

            // C makemon() calls newsym() before nasty() overrides attitude.
            // Preserve that birth-time projection state for the spell owner;
            // the actor becomes hostile below without an immediate repaint.
            monster._nastyBirthPeaceful = monster.mpeaceful;
            if (onCreate) await onCreate(monster);
            monster.msleeping = 0;
            monster.mpeaceful = 0;
            monster.mtame = 0;
            monster.mspec_used = rnd(4);
            created.push(monster);

            if (monster.mnum === archLich || monster.mnum === archon) {
                if (!difficultyCap || difficultyCap > lowerArchDifficulty)
                    difficultyCap = lowerArchDifficulty;
            }
            const monsterAlignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
            if (created.length >= 10
                || monsterAlignment === 0
                || Math.sign(monsterAlignment) === casterAlignment) {
                break;
            }
        }
    }

    return { count: created.length, created };
}

async function maketrap(x, y, typ) {
    // trap.c:maketrap() treats the two pseudo-types returned by rndtrap()
    // as failed constructions.  They describe trapped furniture rather than
    // floor traps and must not occupy the coordinate for later lregions.
    if (typ === TRAPPED_DOOR || typ === TRAPPED_CHEST) return null;
    if (!game.level) {
        return {
            ttyp: typ, tx: x, ty: y, tseen: typ === HOLE, once: false,
            launch: { x: 0, y: 0 },
        };
    }
    if (!game.level.traps) game.level.traps = [];
    const oldTrap = game.level.traps.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    // C reinitializes a destroyable trap in place.  This matters when a Lua
    // random trap lands on a fixed one: t_at() must expose the replacement,
    // not an older duplicate.  Portals and the vibrating square are the two
    // undestroyable floor traps and reject replacement.
    if (oldTrap
        && (oldTrap.ttyp === MAGIC_PORTAL
            || oldTrap.ttyp === VIBRATING_SQUARE)) return null;
    if (!oldTrap) {
        const terrain = game.level.at(x, y)?.typ;
        // trap.c:maketrap() rejects terrain before allocating a trap.  In
        // particular, Wiz-strt's random trap can land in a cloud: the Lua
        // location owner accepts that dry square, but maketrap() rejects
        // IS_AIR and its caller must not run the later victim-chance draw.
        if (terrain === STAIRS || terrain === LADDER
            || IS_POOL(terrain) || IS_LAVA(terrain)
            || (IS_FURNITURE(terrain)
                && typ !== PIT && typ !== HOLE)
            || (terrain === DRAWBRIDGE_UP && typ === MAGIC_PORTAL)
            || (IS_AIR(terrain) && typ !== MAGIC_PORTAL)) {
            return null;
        }
    }
    const trap = oldTrap || {};
    if (oldTrap) {
        for (const key of Object.keys(trap)) {
            if (key !== 'tx' && key !== 'ty') delete trap[key];
        }
    }
    Object.assign(trap, {
        // trap.c:maketrap() initializes the one unhideable floor trap as
        // already seen; ordinary trap doors remain concealed.
        ttyp: typ, tx: x, ty: y, tseen: typ === HOLE, once: false,
        launch: { x: 0, y: 0 },
    });
    if (is_hole(typ)) {
        // C ref: trap.c hole_destination().  Ordinary holes and trapdoors
        // advance at least one level, then have a 3/4 chance to stop at each
        // level until the current dungeon's bottom is reached.
        const dnum = game.u?.uz?.dnum ?? 0;
        const bottom = game.dungeons?.[dnum]?.num_dunlevs
            ?? (game.u?.uz?.dlevel ?? 1);
        let dlevel = game.u?.uz?.dlevel ?? 1;
        while (dlevel < bottom) {
            dlevel++;
            if (rn2(4)) break;
        }
        trap.dst = { dnum, dlevel };
    }
    if (!oldTrap) game.level.traps.push(trap);
    if (typ === STATUE_TRAP) {
        // trap.c mk_trap_statue(): avoid a co-aligned unicorn whose eventual
        // attitude would contradict the trap, then let mkcorpstat() perform
        // its independent initialized-statue identity before overwriting it.
        let statueMonster;
        let tryCount = 10;
        do {
            statueMonster = rndmonnumAdj(3, 6);
        } while (--tryCount > 0
            && MONSTER_SYMBOL[statueMonster] === 21
            && Math.sign(game.u?.ualign?.type ?? 0)
                === Math.sign(MONSTER_ALIGNMENT[statueMonster] ?? 0));
        const statue = mkcorpstat(STATUE, null, statueMonster, x, y, 0);
        const temporary = await makemon(
            statue.corpsenm, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG,
        );
        if (temporary) {
            const existingContents = statue.contents || [];
            const monsterContents = temporary.minvent || [];
            statue.contents = [...monsterContents, ...existingContents];
            for (const object of monsterContents) {
                object.where = 'contained';
                object.ox = object.oy = 0;
                object.owornmask = 0;
            }
            temporary.minvent = [];
            temporary.inventory = temporary.minvent;
            temporary.hasInventory = false;
            statue.owt = objectWeight(statue);
            game.level.monsters = game.level.monsters.filter(
                monster => monster !== temporary,
            );
        }
    } else if (typ === SQKY_BOARD) {
        const used = new Set(game.level.traps
            .filter(candidate => candidate !== trap && candidate.ttyp === SQKY_BOARD)
            .map(candidate => candidate.tnote));
        const available = [];
        for (let note = 0; note < 12; note++)
            if (!used.has(note)) available.push(note);
        trap.tnote = available.length
            ? available[rn2(available.length)] : rn2(12);
    } else if (typ === ROLLING_BOULDER_TRAP
        && game.level.flags.sokoban_rules) {
        // Sokoban has no rolling-boulder launchers. The trap stays in place
        // without creating another boulder.
        trap.launch = { x, y };
        trap.launch2 = { x, y };
    } else if (typ === ROLLING_BOULDER_TRAP) {
        // C ref: trap.c find_random_launch_coord()/mkroll_launch().  A
        // rolling-boulder trap chooses one distance and starting direction,
        // then searches all eight directions at decreasing distances until
        // both sides of the trigger have a clear path.
        let distance = rn1(5, 4);
        let direction = rn2(8);
        let tries = 0;
        const clearPath = (dx, dy, length) => {
            for (let step = 1; step <= length; step++) {
                const px = x + step * dx, py = y + step * dy;
                const loc = game.level.at(px, py);
                if (!isok(px, py) || !loc || IS_OBSTRUCTED(loc.typ)
                    || IS_WALL(loc.typ) || IS_POOL(loc.typ)) return false;
                const blockingTrap = game.level.traps.some(candidate =>
                    candidate !== trap && candidate.tx === px
                    && candidate.ty === py
                    && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)
                        || candidate.ttyp === TELEP_TRAP
                        || candidate.ttyp === LEVEL_TELEP
                        || candidate.ttyp === MAGIC_PORTAL));
                if (blockingTrap) return false;
            }
            return true;
        };
        let launch = null;
        while (distance >= 2) {
            const dx = xdir[direction], dy = ydir[direction];
            if (clearPath(dx, dy, distance)
                && clearPath(-dx, -dy, distance)) {
                launch = { x: x + distance * dx, y: y + distance * dy };
                break;
            }
            direction = (direction + 1) % 8;
            if (++tries % 8 === 0) distance--;
        }
        if (launch) {
            const boulder = mksobj(BOULDER, true, false);
            place_object(boulder, launch.x, launch.y);
            trap.launch = launch;
            trap.launch2 = {
                x: x - (launch.x - x), y: y - (launch.y - y),
            };
        } else {
            trap.launch = { x, y };
            trap.launch2 = { x, y };
        }
    }
    return trap;
}

const ZOMBIE_FORM_BY_LIVING_CORPSE = new Map([
    [59, 239], [165, 240], [72, 241], [44, 242],
    [264, 243], [260, 244], [174, 245], [169, 247],
]);

export function hasDueBuriedZombieTimer(
    state = game, currentTurn = state.moves ?? 0,
) {
    return !!peekNextDueObjectTimer(
        state, currentTurn,
        new Set([OBJECT_TIMER_KIND.ZOMBIFY_MON]),
    );
}

function removeBuriedCorpse(corpse, state = game) {
    const index = state.level?.buriedObjects?.indexOf(corpse) ?? -1;
    if (index >= 0) state.level.buriedObjects.splice(index, 1);
    stopAllObjectTimers(corpse);
    corpse.where = 'gone';
    corpse.buried = false;
    corpse.ox = corpse.oy = 0;
}

const RIDER_CORPSE_TYPES = new Set([
    MONSTER_NAME.indexOf('Death'),
    MONSTER_NAME.indexOf('Pestilence'),
    MONSTER_NAME.indexOf('Famine'),
]);

function objectResists(object, ordinaryChance, artifactChance) {
    if (object.otyp === AMULET_OF_YENDOR
        || object.otyp === SPE_BOOK_OF_THE_DEAD
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === BELL_OF_OPENING
        || (object.otyp === CORPSE
            && RIDER_CORPSE_TYPES.has(object.corpsenm))) return true;
    const chance = rn2(100);
    return chance < (object.artifact || object.oartifact
        ? artifactChance : ordinaryChance);
}

function containingObject(target, state = game) {
    return objectsInTimerGraph(state).find(object =>
        object !== target && object.contents?.includes(target));
}

function extractObjectFromGraph(object, state = game) {
    const where = object.where;
    const x = object.ox, y = object.oy;
    let removed = false;
    if (where === 'floor') {
        const pile = state.level?.objects?.[x]?.[y];
        const index = pile?.indexOf(object) ?? -1;
        if (index >= 0) {
            pile.splice(index, 1);
            removed = true;
        }
    } else if (where === 'buried') {
        const index = state.level?.buriedObjects?.indexOf(object) ?? -1;
        if (index >= 0) {
            state.level.buriedObjects.splice(index, 1);
            removed = true;
        }
    } else if (where === 'contained') {
        const container = containingObject(object, state);
        const index = container?.contents?.indexOf(object) ?? -1;
        if (index >= 0) {
            container.contents.splice(index, 1);
            container.owt = objectWeight(container);
            removed = true;
        }
    } else if (where === 'inventory') {
        const index = state.inventory?.indexOf(object) ?? -1;
        if (index >= 0) {
            state.inventory.splice(index, 1);
            removed = true;
        }
    } else if (where === 'minvent') {
        for (const monster of state.level?.monsters || []) {
            const lists = new Set([monster.minvent, monster.inventory]);
            for (const list of lists) {
                const index = list?.indexOf(object) ?? -1;
                if (index >= 0) {
                    list.splice(index, 1);
                    removed = true;
                }
            }
        }
    }
    stopAllObjectTimers(object);
    object.where = 'gone';
    object.buried = false;
    object.ox = object.oy = 0;
    return { removed, where, x, y };
}

function buryContainedObject(object, container, x, y, state = game) {
    if (objectResists(object, 0, 0)) return false;
    const index = container.contents?.indexOf(object) ?? -1;
    if (index >= 0) container.contents.splice(index, 1);
    container.owt = objectWeight(container);
    object.where = 'free';
    object.ox = x;
    object.oy = y;

    if (object.lamplit && object.otyp !== POT_OIL) {
        object.lamplit = false;
        stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
        state.vision_full_recalc = 1;
    }
    if (object.otyp === ROCK || object.otyp === BOULDER) {
        extractObjectFromGraph(object, state);
        return true;
    }
    if (object.otyp !== CORPSE
        && (OBJECT_MATERIAL[object.otyp] ?? Infinity) <= 8
        && !objectResists(object, 5, 95)) {
        scheduleObjectTimer(
            object, OBJECT_TIMER_KIND.ROT_ORGANIC,
            (state.moves ?? 0) + 250 + rnd(250), state,
        );
    }
    addBuriedObject(object, x, y);
    return true;
}

function buryFloorObject(object, state = game) {
    if (!object || object.where !== 'floor' || objectResists(object, 0, 0))
        return false;

    const x = object.ox;
    const y = object.oy;
    const pile = state.level?.objects?.[x]?.[y];
    const index = pile?.indexOf(object) ?? -1;
    if (index >= 0) pile.splice(index, 1);

    if (object.lamplit && object.otyp !== POT_OIL) {
        object.lamplit = false;
        stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
        state.vision_full_recalc = 1;
    }

    const underIce = state.level?.at?.(x, y)?.typ === ICE;
    if ((object.otyp === ROCK && !underIce) || object.otyp === BOULDER) {
        stopAllObjectTimers(object);
        object.where = 'gone';
        object.buried = false;
        object.ox = object.oy = 0;
        return null;
    }

    if (object.otyp !== CORPSE
        && (underIce
            ? object.oclass === POTION_CLASS
            : (OBJECT_MATERIAL[object.otyp] ?? Infinity) <= 8)
        && !objectResists(object, 5, 95)) {
        scheduleObjectTimer(
            object, OBJECT_TIMER_KIND.ROT_ORGANIC,
            (underIce ? 0 : 250) + rnd(250) + (state.moves ?? 0), state,
        );
    }

    object.where = 'buried';
    object.buried = true;
    if (!state.level.buriedObjects) state.level.buriedObjects = [];
    state.level.buriedObjects.unshift(object);
    updateCorpseIceTimer(object, x, y, underIce, state);
    return true;
}

function buryFloorObjectsAt(x, y, state = game) {
    const buried = [];
    const pile = state.level?.objects?.[x]?.[y];
    for (const object of [...(pile || [])]) {
        if (buryFloorObject(object, state) === true) buried.push(object);
    }
    return buried;
}

// C ref: trap.c:fill_pit() -> do.c:flooreffects().  The new pit survives
// unless a floor boulder settles into it; that consumes the boulder, removes
// the pit, and buries the rest of the floor pile.  revive_corpse() calls this
// only after its visible/audible presentation has completed.
export function finishBuriedZombieTimer(event, state = game) {
    if (!event || event.kind !== 'revived' || event.finished) return event;
    const x = event.monster?.mx, y = event.monster?.my;
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y
        && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)));
    const boulder = state.level?.objects?.[x]?.[y]?.find(object =>
        object.otyp === BOULDER);
    event.finished = true;
    event.pitFilled = false;
    event.filledByBoulder = null;
    event.buriedFloorObjects = [];
    if (!trap || !boulder) return event;

    const pile = state.level.objects[x][y];
    const boulderIndex = pile.indexOf(boulder);
    if (boulderIndex >= 0) pile.splice(boulderIndex, 1);
    stopAllObjectTimers(boulder);
    boulder.where = 'gone';
    boulder.buried = false;
    boulder.ox = boulder.oy = 0;
    const trapIndex = state.level.traps.indexOf(trap);
    if (trapIndex >= 0) state.level.traps.splice(trapIndex, 1);
    event.pitFilled = true;
    event.filledByBoulder = boulder;
    event.buriedFloorObjects = buryFloorObjectsAt(x, y, state);
    return event;
}

function iceMeltTrapEffects(x, y, state = game) {
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (!trap) return { trap: null, removed: false, converted: null };
    const monster = levelMonsterAt(x, y);
    if (monster?.mtrapped) monster.mtrapped = 0;
    if (state.u?.ux === x && state.u?.uy === y) {
        state.u.utrap = 0;
        state.u.utraptype = 0;
    }

    let converted = null;
    if (trap.ttyp === LANDMINE || trap.ttyp === BEAR_TRAP) {
        converted = mksobj(
            trap.ttyp === LANDMINE ? LAND_MINE : BEARTRAP,
            true, false,
        );
        place_object(converted, x, y);
        // trap.c:cnv_trap_obj(..., bury_it=TRUE) delegates to bury_an_obj();
        // even a non-resistant ordinary tool owns obj_resists(0,0)'s draw.
        rn2(100);
        addBuriedObject(converted, x, y);
    }
    const removable = trap.ttyp !== MAGIC_PORTAL
        && trap.ttyp !== VIBRATING_SQUARE;
    if (removable) {
        const index = state.level.traps.indexOf(trap);
        if (index >= 0) state.level.traps.splice(index, 1);
    }
    return { trap, removed: removable, converted };
}

function unearthObjectsAt(x, y, state = game) {
    const unearthed = [];
    for (const object of [...(state.level?.buriedObjects || [])]) {
        if (object.ox !== x || object.oy !== y) continue;
        const index = state.level.buriedObjects.indexOf(object);
        if (index >= 0) state.level.buriedObjects.splice(index, 1);
        stopObjectTimer(object, OBJECT_TIMER_KIND.ROT_ORGANIC);
        object.where = 'free';
        object.buried = false;
        place_object(object, x, y);
        stack_object(object);
        unearthed.push(object);
    }
    if (state.level?.engravings) {
        state.level.engravings = state.level.engravings.filter(engraving =>
            engraving.x !== x || engraving.y !== y);
    }
    return unearthed;
}

function meltLevelHasCeiling(state = game) {
    const flags = state.level?.flags || {};
    if (typeof flags.has_ceiling === 'boolean') return flags.has_ceiling;
    return state === game
        ? !(In_endgame(state.u?.uz) && !Is_earthlevel(state.u?.uz))
        : !(flags.is_endgame && !flags.is_earthlevel);
}

function monsterInAir(monster, state = game) {
    if (!monster) return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    return !!(flags & 0x00000001) || symbol === 5 || symbol === 25
        || !!(flags & 0x00000010)
            && meltLevelHasCeiling(state) && !!monster.mundetected;
}

function monsterSafelySurvivesMeltedIce(monster, state = game) {
    if (!monster) return true;
    const name = MONSTER_NAME[monster.mnum];
    // minliquid() gives these two species separate split/rust transactions.
    if (name === 'gremlin' || name === 'iron golem') return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return monsterInAir(monster, state)
        || !!(flags & (0x00000002 | 0x00000010
            | 0x00000200 | 0x00000400));
}

const MELT_SPECIAL_CORPSE_NAMES = new Set([
    'white unicorn', 'gray unicorn', 'black unicorn', 'long worm',
    'vampire', 'vampire leader',
    'gray ooze', 'brown pudding', 'green slime', 'black pudding',
]);

function meltSpecialDeathFamily(monster) {
    const name = MONSTER_NAME[monster.mnum] || '';
    return MELT_SPECIAL_CORPSE_NAMES.has(name)
        || (name.endsWith(' dragon') && !name.startsWith('baby '))
        || name.endsWith(' mummy') || name.endsWith(' zombie')
        || name.endsWith(' golem')
        || name === 'lich' || name.endsWith('lich')
        || name === 'troll' || name.endsWith(' troll')
        || (MONSTER_ATTACKS[monster.mnum] || [])
            .some(attack => attack[0] === 14
                || attack[1] === 22 || attack[1] === 35); // BOOM/SEDU/SSEX
}

function wornMeltMonsterLifeSaver(monster) {
    if (monsterIsNonliving(monster.mnum)) return null;
    return (monster.minvent || monster.inventory || []).find(object =>
        object.otyp === AMULET_OF_LIFE_SAVING
        && ((object.owornmask ?? 0) & W_AMUL)) || null;
}

function meltOccupantDeathGap(
    monster, state = game, { afterFailedLifeSaving = false } = {},
) {
    if (state !== game) return 'custom-state death projection';
    if (Number.isInteger(monster.cham) && monster.cham >= 0)
        return 'shapechanging';
    const lifeSaver = wornMeltMonsterLifeSaver(monster);
    if (lifeSaver && !afterFailedLifeSaving) {
        const genocided = !!((state.mvitals?.[monster.mnum]?.mvflags ?? 0)
            & G_GENOD);
        const petGap = petLifeSavingGap(monster, { genocided, state });
        if (petGap) return `pet life-saving ${petGap}`;
        if (genocided) {
            return meltOccupantDeathGap(
                monster, state, { afterFailedLifeSaving: true },
            );
        }
        return null;
    }
    if (monster.mtame || monster.pet) return 'pet traits';
    if (state.u?.ustuck === monster || state.u?.usteed === monster)
        return 'hero attachment';
    // trap_ice_effects() runs before any boulder-fill death.  It clears
    // mtrapped and destroys ordinary pits/holes, so mon_leaving_level() has
    // no pit left to fill for this callback.  Do not guard on the stale
    // pre-melt trap state inspected by runClaimedMeltIceTimer().
    if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ_MASK)
        return 'unique monster bookkeeping';
    if (monster.isgd || monster.iswiz || monster.isshk || monster.ispriest
        || monster.wormno || monster.mleashed
        || monster.isQuestLeader || monster.isQuestNemesis) {
        return 'special monster detachment';
    }
    const leaderId = state.quest_status?.leader_m_id
        ?? state.u?.quest_status?.leader_m_id;
    if (leaderId != null && monster.m_id === leaderId)
        return 'quest leader bookkeeping';
    if (meltSpecialDeathFamily(monster)) return 'special corpse/death effects';
    return null;
}

function recordMeltMonsterDeath(monster, state = game) {
    if (!state._vanquishedCounts) state._vanquishedCounts = new Map();
    const mnum = monster.mnum ?? -1;
    const prior = state._vanquishedCounts.get(mnum) || {
        mnum, name: MONSTER_NAME[mnum] || 'monster', count: 0,
        difficulty: MONSTER_DIFFICULTY[mnum] ?? 0,
    };
    prior.count = Math.min(255, prior.count + 1);
    state._vanquishedCounts.set(mnum, prior);
}

function releaseMeltMonsterInventory(monster, state = game) {
    const x = monster.mx, y = monster.my;
    const carried = monster.minvent?.length
        ? monster.minvent : monster.inventory || monster.minvent || [];
    const released = [];
    for (const object of carried) {
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        object.wielded = false;
        object.alternate = false;
        object.ready = false;
        place_object(object, x, y);
        stack_object(object, state);
        released.push(object);
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
    monster.misc_worn_check = 0;
    return released;
}

function meltLevelSpecificNoCorpse(monster, state = game) {
    const flags = state.level?.flags || {};
    if (flags.rogue_level || flags.is_rogue_level
        || flags.deathdrops === false) return true;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x2);
    return !!(flags.graveyard && undead && rn2(3));
}

function createMeltMonsterCorpse(monster, state = game) {
    if (meltLevelSpecificNoCorpse(monster, state)) return null;
    const mnum = monster.mnum;
    const guaranteed = (((MONSTER_SIZE[mnum] ?? 2) >= 3
            || mnum === PM_LIZARD) && !monster.mcloned)
        || (mnum >= PM_ARCHAEOLOGIST && mnum <= PM_WIZARD)
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE);
    const frequency = (MONSTER_GENO[mnum] ?? 0) & 0x7;
    const range = 2 + Number(frequency < 2)
        + Number((MONSTER_SIZE[mnum] ?? 2) === 0);
    if (!guaranteed && rn2(range) !== 0) return null;
    if ((MONSTER_GENO[mnum] ?? 0) & G_NOCORPSE) return null;

    let flags = CORPSTAT_INIT;
    if (monster.female) flags |= CORPSTAT_FEMALE;
    else if (!((MONSTER_FLAGS2[mnum] ?? 0) & M2_NEUTER))
        flags |= CORPSTAT_MALE;
    const corpse = mkcorpstat(CORPSE, null, mnum,
        monster.mx, monster.my, flags);
    corpse.name = `${MONSTER_NAME[mnum] || 'monster'} corpse`;
    if (monster.name) corpse.oname = monster.name;
    return stack_object(corpse, state);
}

function meltAppearanceBlocksLight(monster) {
    const type = monster.m_ap_type ?? 0;
    const appearance = monster.mappearance ?? 0;
    if (type === M_AP_OBJECT) return appearance === BOULDER;
    if (type !== M_AP_FURNITURE) return false;
    // The port persists special-level furniture in the terrain namespace,
    // while ordinary C mimic state uses cmap indices.  Accept both encodings:
    // C walls are below S_ndoor=12, closed doors are 15/16, and tree is 18.
    return (appearance >= 0 && appearance < 12)
        || appearance === 15 || appearance === 16 || appearance === 18
        || appearance === TREE || appearance === SDOOR
        || appearance === DOOR || IS_WALL(appearance);
}

function revealMeltMonsterAppearance(monster, state = game) {
    const type = monster.m_ap_type ?? 0;
    const appearance = monster.mappearance ?? 0;
    if (type === 0 || type === M_AP_MONSTER) {
        return {
            revealed: false, type, appearance, lightBlocker: false,
        };
    }

    const lightBlocker = meltAppearanceBlocksLight(monster);
    const corpsenm = monster.mcorpsenm
        ?? monster.mextra?.mcorpsenm ?? null;
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    delete monster.mcorpsenm;
    if (monster.mextra) delete monster.mextra.mcorpsenm;
    if (lightBlocker)
        vision_note_blocker_change(monster.mx, monster.my);
    newsym(monster.mx, monster.my);
    return {
        revealed: true, type, appearance, corpsenm, lightBlocker,
    };
}

function resolveMeltMonsterDeath(monster, state = game) {
    const gap = meltOccupantDeathGap(monster, state);
    if (gap) throw new Error(`unsupported melt-ice occupant ${gap}`);
    monster.mhp = 0;
    recordMeltMonsterDeath(monster, state);
    monster.dead = true;
    monster.mundetected = 0;
    state.level.monsters = state.level.monsters.filter(candidate =>
        candidate !== monster);
    const appearanceReveal = revealMeltMonsterAppearance(monster, state);
    newsym(monster.mx, monster.my);
    const releasedInventory = releaseMeltMonsterInventory(monster, state);
    const corpse = createMeltMonsterCorpse(monster, state);
    return {
        kind: 'melt-ice-occupant-death', monster,
        releasedInventory, appearanceReveal,
        corpse, corpseCreated: !!corpse,
    };
}

// C ref: hack.c:disturb_buried_zombies().  wake_nearto() shortens each
// adjacent ZOMBIFY_MON timer to two thirds of its remaining duration, then
// restarts it in the shared queue with a fresh insertion id.
export function disturbBuriedZombieTimers(x, y, state = game) {
    const disturbed = [];
    const currentMove = state.moves ?? 0;
    for (const corpse of state.level?.buriedObjects || []) {
        if (corpse.otyp !== CORPSE || !corpse.timed
            || corpse.ox < x - 1 || corpse.ox > x + 1
            || corpse.oy < y - 1 || corpse.oy > y + 1) continue;
        const timer = objectTimers(corpse).find(candidate =>
            candidate.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
        if (!timer || timer.deadline <= 0) continue;
        const remaining = timer.deadline - currentMove;
        stopObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON);
        const delay = Math.max(1, Math.trunc(remaining * 2 / 3));
        const replacement = scheduleObjectTimer(
            corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON,
            currentMove + delay, state,
        );
        disturbed.push({ corpse, prior: timer, replacement, delay });
    }
    return disturbed;
}

function floorBoulderAt(x, y, state = game) {
    return state.level?.objects?.[x]?.[y]?.find(object =>
        object.otyp === BOULDER) || null;
}

function finishMeltIceBoulderOutcome(event, outcome, state = game) {
    if (!outcome || outcome.boulderFinalized) return outcome;
    if (outcome.pendingOccupantLifeSaving) {
        throw new Error('melt-ice boulder life-saving is still pending');
    }
    const { x, y, boulder, fillsUp } = outcome;
    let removedTrap = null;
    let buriedFloorObjects = [];
    if (fillsUp) {
        removedTrap = state.level?.traps?.find(trap =>
            trap.tx === x && trap.ty === y) || null;
        if (removedTrap) {
            const trapIndex = state.level.traps.indexOf(removedTrap);
            if (trapIndex >= 0) state.level.traps.splice(trapIndex, 1);
        }
        buriedFloorObjects = buryFloorObjectsAt(x, y, state);
    }

    stopAllObjectTimers(boulder);
    boulder.where = 'gone';
    boulder.buried = false;
    boulder.ox = boulder.oy = 0;
    const pendingBoulder = fillsUp ? null : floorBoulderAt(x, y, state);
    event.pendingBoulder = pendingBoulder;
    event.pendingBoulderOutcome = null;
    event.boulderComplete = !pendingBoulder;
    Object.assign(outcome, {
        removedTrap, buriedFloorObjects, pendingBoulder,
        boulderFinalized: true,
    });
    return outcome;
}

export function finishMeltIceBoulderLifeSaving(
    event, outcome, resolution, state = game,
) {
    const pending = outcome?.pendingOccupantLifeSaving;
    if (!pending || pending.monster !== resolution?.monster
        || pending.amulet !== resolution?.amulet
        || pending.genocided !== !!resolution.genocided
        || resolution.survived !== !pending.genocided
        || (resolution.survived
            ? (pending.monster.mhp ?? 0) <= 0
            : (pending.monster.mhp ?? 0) > 0)) {
        throw new Error('invalid melt-ice monster life-saving resolution');
    }
    outcome.pendingOccupantLifeSaving = null;
    outcome.occupantLifeSaving = resolution;
    event.occupantLifeSaving = resolution;
    if (!resolution.survived) {
        const occupantDeath = resolveMeltMonsterDeath(
            pending.monster, state,
        );
        outcome.occupantDeath = occupantDeath;
        event.occupantDeath = occupantDeath;
    }
    return finishMeltIceBoulderOutcome(event, outcome, state);
}

// C refs: do.c:boulder_hits_pool() and dig.c:bury_objs().  This is one
// resumable iteration after melt_ice()'s initial and "settles" messages have
// returned.  Melted ICE can only expose ordinary POOL/MOAT here, so the
// native fill rule is rn2(10) != 0; a zero sinks this boulder and leaves the
// next boulder for another iteration.
export function runNextMeltIceBoulder(event, state = game) {
    if (event?.kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || event.boulderComplete) return null;
    if (event.pendingBoulderOutcome) return event.pendingBoulderOutcome;
    const { x, y } = event;
    const loc = state.level?.at?.(x, y);
    if (!loc || !IS_POOL(loc.typ)) {
        throw new Error(`melt-ice boulder at non-pool position ${x},${y}`);
    }
    const boulder = floorBoulderAt(x, y, state);
    if (!boulder) {
        event.pendingBoulder = null;
        event.boulderComplete = true;
        return null;
    }

    const pile = state.level.objects[x][y];
    const index = pile.indexOf(boulder);
    if (index >= 0) pile.splice(index, 1);
    boulder.where = 'free';
    const chance = rn2(10);
    const fillsUp = chance !== 0;
    const waterType = loc.typ;
    let occupantDeath = null;
    let pendingOccupantLifeSaving = null;
    if (fillsUp) {
        loc.typ = ROOM;
        loc.flags = 0;
        loc.icedpool = 0;
        const occupant = event.occupant;
        if (occupant && (occupant.mhp ?? 1) > 0
            && !monsterInAir(occupant, state)) {
            const lifeSaver = wornMeltMonsterLifeSaver(occupant);
            if (lifeSaver) {
                occupant.mhp = 0;
                pendingOccupantLifeSaving = {
                    kind: 'melt-ice-occupant-life-saving',
                    monster: occupant, amulet: lifeSaver,
                    genocided: !!((state.mvitals?.[occupant.mnum]?.mvflags
                        ?? 0) & G_GENOD),
                };
            } else {
                occupantDeath = resolveMeltMonsterDeath(occupant, state);
                event.occupantDeath = occupantDeath;
            }
        }
    }

    const outcome = {
        kind: 'melt-ice-boulder', x, y, boulder, chance, fillsUp,
        waterType, waterBody: waterType === POOL ? 'pool' : 'moat',
        removedTrap: null, buriedFloorObjects: [], pendingBoulder: boulder,
        occupantDeath, pendingOccupantLifeSaving,
        occupantLifeSaving: null, boulderFinalized: false,
    };
    if (!event.boulderOutcomes) event.boulderOutcomes = [];
    event.boulderOutcomes.push(outcome);
    if (pendingOccupantLifeSaving) {
        event.pendingBoulderOutcome = outcome;
        return outcome;
    }
    return finishMeltIceBoulderOutcome(event, outcome, state);
}

// C refs: zap.c:melt_ice_away()/melt_ice(), trap.c:trap_ice_effects(),
// mkobj.c:obj_ice_effects(), and dig.c:unearth_objs(). The shared timer has
// already been claimed, so this callback owns terrain, trap, corpse-timer,
// burial, engraving, and repaint state before its conditional message.
export function runClaimedMeltIceTimer(claimed, state = game) {
    if (claimed?.timer?.kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !claimed.position) return null;
    const { x, y } = claimed.position;
    const loc = state.level?.at?.(x, y);
    if (!loc || loc.typ !== ICE) {
        throw new Error(`melt-ice timer at non-ice position ${x},${y}`);
    }
    const pile = state.level?.objects?.[x]?.[y] || [];
    const boulder = pile.find(object => object.otyp === BOULDER) || null;
    if (state.u?.ux === x && state.u?.uy === y) {
        throw new Error(
            `melt-ice hero liquid lifecycle is not implemented at ${x},${y}`,
        );
    }
    const occupant = levelMonsterAt(x, y);
    if (occupant && !monsterSafelySurvivesMeltedIce(occupant, state)) {
        throw new Error(
            `melt-ice monster liquid lifecycle is not implemented at ${x},${y}`,
        );
    }
    if (boulder && occupant && !monsterInAir(occupant, state)) {
        const gap = meltOccupantDeathGap(occupant, state);
        if (gap) {
            throw new Error(
                `melt-ice boulder occupant ${gap} is not implemented at ${x},${y}`,
            );
        }
    }

    const icedpool = loc.icedpool ?? loc.flags ?? ICED_MOAT;
    const meltInto = icedpool === ICED_POOL ? POOL : MOAT;
    loc.typ = meltInto;
    loc.flags = 0;
    loc.icedpool = 0;
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    const trap = iceMeltTrapEffects(x, y, state);
    for (const object of state.level?.objects?.[x]?.[y] || [])
        updateCorpseIceTimer(object, x, y, false, state);
    const unearthed = unearthObjectsAt(x, y, state);
    if (state === game) newsym(x, y);
    return {
        kind: LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        x, y, meltInto, trap, unearthed, occupant,
        pendingBoulder: floorBoulderAt(x, y, state),
        boulderComplete: !floorBoulderAt(x, y, state),
        boulderOutcomes: [],
    };
}

export function runClaimedObjectRotTimer(claimed, state = game) {
    const object = claimed?.object;
    const kind = claimed?.timer?.kind;
    if (!object || ![
        OBJECT_TIMER_KIND.ROT_CORPSE,
        OBJECT_TIMER_KIND.ROT_ORGANIC,
    ].includes(kind)) return null;

    if (kind === OBJECT_TIMER_KIND.ROT_ORGANIC) {
        while (object.contents?.length) {
            const content = object.contents[0];
            if (!buryContainedObject(
                content, object, object.ox, object.oy, state,
            )) {
                return { kind: 'blocked-organic-rot', object };
            }
        }
    }
    const location = extractObjectFromGraph(object, state);
    return { kind, object, ...location };
}

// C refs: timeout.c:run_timers(), do.c:zombify_mon()/revive_mon(), and
// zap.c:revive().  Claiming removes the ZOMBIFY_MON timer before its callback;
// a failed dig or birth retains the replacement zombie corpse and its newly
// installed ROT_CORPSE timer.
export async function runClaimedBuriedZombieTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    const corpse = claimed?.object;
    if (!corpse || claimed?.timer?.kind !== OBJECT_TIMER_KIND.ZOMBIFY_MON)
        return null;

    const zombieForm = ZOMBIE_FORM_BY_LIVING_CORPSE.get(corpse.corpsenm);
    if (zombieForm == null
        || ((state.mvitals?.[zombieForm]?.mvflags ?? 0) & G_GENOD)) {
        removeBuriedCorpse(corpse, state);
        return { kind: 'rotted', corpse, monster: null, trap: null };
    }

    set_corpsenm(corpse, zombieForm);
    const x = corpse.ox, y = corpse.oy;
    const location = state.level?.at(x, y);
    const hasTrap = state.level?.traps?.some(trap =>
        trap.tx === x && trap.ty === y);
    if (!location || hasTrap
        || ![ROOM, CORR, GRAVE].includes(location.typ)) {
        return { kind: 'failed', corpse, monster: null, trap: null };
    }

    const flags = NO_MINVENT | MM_NOWAIT | MM_NOMSG | MM_NOCOUNTBIRTH
        | (corpse.female ? MM_FEMALE : MM_MALE);
    const occupied = !!levelMonsterAt(x, y);
    const monster = occupied
        ? await makemonNear(zombieForm, x, y, flags)
        : await makemonAt(zombieForm, x, y, flags);
    if (!monster)
        return { kind: 'failed', corpse, monster: null, trap: null };

    monster.mrevived = 1;
    removeBuriedCorpse(corpse, state);
    const trap = await maketrap(monster.mx, monster.my, PIT);
    return { kind: 'revived', corpse, monster, trap };
}

export async function runNextBuriedZombieTimer(
    state = game, currentTurn = state.moves ?? 0,
) {
    const claimed = claimNextDueObjectTimer(
        state, currentTurn,
        new Set([OBJECT_TIMER_KIND.ZOMBIFY_MON]),
    );
    if (!claimed) return null;
    const event = await runClaimedBuriedZombieTimer(
        claimed, state, currentTurn,
    );
    return finishBuriedZombieTimer(event, state);
}

function make_engr_at(
    x, y, text, pristine, epoch, engr_type, options = undefined,
) {
    return makeEngravingAt(
        x, y, text, pristine, epoch, engr_type, options,
    );
}

function make_grave(x, y, text) {
    const loc = game.level?.at(x, y);
    const trapped = game.level?.traps?.some(trap => trap.tx === x && trap.ty === y);
    if (!loc || (loc.typ !== ROOM && loc.typ !== GRAVE) || trapped) return;
    loc.typ = GRAVE;
    const epitaph = text ?? getRandomTextLine(RANDOM_EPITAPHS);
    make_engr_at(x, y, epitaph, null, 0, HEADSTONE);
}

// C ref: rumors.c get_rnd_line().  makedefs pads each source line to a
// minimum of 59 text bytes plus its newline.  Selection deliberately seeks
// into one line and returns the following line.
function getRandomTextLine(lines) {
    const sizes = lines.map(line => Math.max(line.length, 59) + 1);
    const fileSize = sizes.reduce((sum, size) => sum + size, 0);
    let picked = 0;
    for (let tries = 10; tries > 0; tries--) {
        let offset = rn2(fileSize);
        picked = 0;
        while (offset >= sizes[picked]) offset -= sizes[picked++];
        const remainder = sizes[picked] - offset;
        if (remainder <= 61) break;
    }
    return lines[(picked + 1) % lines.length];
}

export function getRumor(excludeCookie, exerciseWisdom = false, truth = 0) {
    let rumor = '';
    let count = 0;
    do {
        rumor = getRandomTextLine(truth + rn2(2) > 0
            ? TRUE_RUMORS : FALSE_RUMORS);
    } while (count++ < 50 && excludeCookie && rumor.startsWith('[cookie] '));
    if (exerciseWisdom) rn2(19);
    if (!excludeCookie && rumor.startsWith('[cookie] '))
        rumor = rumor.slice('[cookie] '.length);
    return rumor;
}

// C ref: engrave.c random_engraving().
function random_engraving() {
    let pristine;
    if (!rn2(4)) pristine = getRandomTextLine(RANDOM_ENGRAVINGS);
    else pristine = getRumor(true);
    return {
        pristine,
        text: wipeoutText(pristine, Math.trunc(pristine.length / 4)),
    };
}

const BONES_VERSION = 1;

function bonesStorageKey(level = game.u?.uz) {
    return `teleport-bones:${level?.dnum ?? 0}:${level?.dlevel ?? 1}`;
}

function storageGet(storage, key) {
    if (storage?.getItem) return storage.getItem(key);
    if (storage?.get) return storage.get(key) ?? null;
    return null;
}

function storageSet(storage, key, value) {
    if (storage?.setItem) storage.setItem(key, value);
    else storage?.set?.(key, value);
}

export function bonesLevelExists(level = game.u?.uz) {
    return storageGet(game.storage, bonesStorageKey(level)) != null;
}

async function bonesPrompt(message, displayLevel = null) {
    await pline(message);
    const restoredLevel = game.level;
    if (displayLevel) game.level = displayLevel;
    await flush_screen(1);
    if (displayLevel) game.level = restoredLevel;
    game.nhDisplay?.setCursor(message.length, 0);
    return String.fromCharCode(await nhgetch()).toLowerCase();
}

function eachObjectInBonesGraph(level, visit) {
    const walk = object => {
        if (!object) return;
        visit(object);
        for (const content of object.contents || []) walk(content);
    };
    for (const monster of level?.monsters || []) {
        for (const object of monster.minvent || monster.inventory || [])
            walk(object);
    }
    for (const column of level?.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || []) walk(object);
        }
    }
    for (const object of level?.buriedObjects || []) walk(object);
}

// C refs: bones.c savebones()/resetobjs(FALSE).  The persistent payload owns
// the level graph only; the next hero, RNG, terminal, and command state remain
// process-local.  JSON is sufficient for the current plain-data graph and the
// GameMap prototype is restored explicitly in getbones().
export function saveBonesLevel() {
    const storage = game.storage;
    if (!storage || !game.level) return false;

    let payload;
    try {
        payload = JSON.parse(JSON.stringify({
            version: BONES_VERSION,
            level: game.level,
            stairs: game.stairs || null,
            heroTrack: (game._heroTrack || []).map(point => ({
                x: point.x, y: point.y,
            })),
        }));
    } catch (_error) {
        return false;
    }

    for (const monster of payload.level.monsters || []) {
        monster.mlstmv = 0;
        if (!Number.isFinite(monster.mux)) monster.mux = game.u?.ux ?? 0;
        if (!Number.isFinite(monster.muy)) monster.muy = game.u?.uy ?? 0;
        if (monster.mtame || monster.pet) {
            monster.mtame = 0;
            monster.mpeaceful = 0;
            monster.pet = false;
        }
        monster.seen_resistance = 0;
    }
    for (const trap of payload.level.traps || []) {
        trap.madeby_u = 0;
    }
    eachObjectInBonesGraph(payload.level, object => {
        object.ghostly = true;
        object.o_id = 0;
    });

    // savebones() removes the dead hero and all of their remembered glyphs
    // before savelev(). Terrain lighting itself remains part of the level.
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = payload.level.locations?.[x]?.[y];
            if (!location) continue;
            location.seenv = 0;
            location.waslit = false;
            location.disp_ch = ' ';
            location.disp_color = 0;
            location.disp_decgfx = false;
            location.disp_attr = 0;
            location.glyph_symidx = -1;
            delete location.remembered_glyph;
        }
    }

    try {
        storageSet(storage, bonesStorageKey(), JSON.stringify(payload));
        return true;
    } catch (_error) {
        return false;
    }
}

function renewBonesIdentities(level) {
    // restmonchn() assigns every monster a fresh id; each monster inventory
    // is restored immediately afterward. getlev() then restores floor and
    // buried object chains. All three paths share next_ident().
    for (const monster of level?.monsters || []) {
        nextIdent();
        for (const object of monster.minvent || monster.inventory || []) {
            const walk = current => {
                if (!current) return;
                nextIdent();
                for (const content of current.contents || []) walk(content);
            };
            walk(object);
        }
    }
    const walk = object => {
        if (!object) return;
        nextIdent();
        for (const content of object.contents || []) walk(content);
    };
    for (const column of level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || []) walk(object);
    for (const object of level?.buriedObjects || []) walk(object);
}

// C refs: restore.c:getlev(ghostly) and makemon.c:set_malign().  Bones retain
// the deceased hero's live attitude bits on disk, then reinterpret every
// non-shopkeeper for the new hero after all level chains and identities have
// been restored.  This must happen before the first scheduler pass: peaceful
// item search and directed movement own different RNG transactions.
function setMonsterMalign(monster) {
    let alignment = MONSTER_ALIGNMENT[monster?.mnum] ?? 0;
    if (monster?.ispriest || monster?.isminion) {
        if (monster.ispriest && monster.epri)
            alignment = monster.epri.shralign;
        else if (monster.isminion && monster.emin)
            alignment = monster.emin.min_align;
        if (alignment !== A_NONE) alignment *= 5;
    }

    const peaceful = !!monster?.mpeaceful;
    const coaligned = Math.sign(alignment)
        === Math.sign(game.u?.ualign?.type ?? 0);
    const absoluteAlignment = Math.abs(alignment);
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;

    if (monster?.mnum === game.urole?.ldrnum) {
        monster.malign = -20;
    } else if (alignment === A_NONE) {
        monster.malign = peaceful ? 0 : 20;
    } else if (flags & M2_PEACEFUL) {
        monster.malign = (peaceful ? -3 : 3)
            * Math.max(5, absoluteAlignment);
    } else if (flags & M2_HOSTILE) {
        monster.malign = coaligned ? 0 : Math.max(5, absoluteAlignment);
    } else if (coaligned) {
        monster.malign = peaceful
            ? -3 * Math.max(3, absoluteAlignment)
            : Math.max(3, absoluteAlignment);
    } else {
        monster.malign = absoluteAlignment;
    }
}

function restoreBonesMonsterAttitudes(level) {
    for (const monster of level?.monsters || []) {
        if (!monster.isshk) {
            const alignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
            const isUnicorn = monster.mnum >= 101 && monster.mnum <= 103;
            const coalignedUnicorn = isUnicorn
                && Math.sign(game.u?.ualign?.type ?? 0)
                    === Math.sign(alignment);
            monster.mpeaceful = coalignedUnicorn || peaceMinded(monster.mnum)
                ? 1 : 0;
        }
        setMonsterMalign(monster);
    }
}

// C refs: bones.c:getbones() and restore.c:getlev(ghostly).
async function getbones() {
    const flags = game.flags || {};
    if (flags.explore) return false;
    if (flags.bones === false) return false;
    if (rn2(3) && !game.flags?.debug) return false;

    const encoded = storageGet(game.storage, bonesStorageKey());
    if (!encoded) return false;
    // keepdogs() has already detached a migrating companion from the source
    // monster chain. Clear its glyph before the wizard query, while retaining
    // the rest of the already-painted source tty map.
    if (game.startingPet
        && !game.level?.monsters?.includes(game.startingPet)) {
        const petLocation = game.level?.at?.(
            game.startingPet.mx, game.startingPet.my,
        );
        if (petLocation
            && Object.hasOwn(petLocation, '_followerDepartureUnderlay')) {
            const underlay = petLocation._followerDepartureUnderlay;
            delete petLocation._followerDepartureUnderlay;
            if (underlay) petLocation.remembered_glyph = underlay;
            else delete petLocation.remembered_glyph;
        } else if (petLocation?.remembered_glyph?.kind === 'monster') {
            delete petLocation.remembered_glyph;
        }
        newsym(game.startingPet.mx, game.startingPet.my);
    }
    if (game.flags?.debug
        && await bonesPrompt('Get bones? [yn] (n) ') !== 'y') return false;

    let payload;
    try {
        payload = JSON.parse(encoded);
    } catch (_error) {
        return false;
    }
    if (payload?.version !== BONES_VERSION || !payload.level) return false;

    const sourceDisplayLevel = game.level;
    game.level = payload.level;
    Object.setPrototypeOf(game.level, GameMap.prototype);
    game.stairs = payload.stairs || null;
    game._heroTrack = (payload.heroTrack || []).map(point => ({
        x: point.x, y: point.y,
    }));
    renewBonesIdentities(game.level);
    restoreBonesMonsterAttitudes(game.level);
    game.fmon = game.level.monsters?.[0] || null;
    game._restoredBones = true;

    if (game.flags?.debug) {
        const unlink = await bonesPrompt(
            'Unlink bones? [yn] (n) ', sourceDisplayLevel,
        );
        if (unlink === 'y') game.storage?.removeItem?.(bonesStorageKey());
    } else {
        game.storage?.removeItem?.(bonesStorageKey());
    }
    return true;
}

// C ref: allmain.c l_nhcore_init()
export function l_nhcore_init() {
    currentLuaLifecycle().startCore(game);
}

// C ref: mklev.c mklev()
export async function mklev() {
    const g = game;
    if (await getbones()) return;
    g.in_mklev = true;
    await makelevel();
    recount_level_features();
    level_finalize_topology();
    g.in_mklev = false;
}

function recount_level_features() {
    const lvl = game.level;
    if (!lvl?.flags) return;
    let nfountains = 0, nsinks = 0;
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++) {
            const typ = lvl.at(x, y)?.typ;
            if (typ === FOUNTAIN) nfountains++;
            if (typ === SINK) nsinks++;
        }
    lvl.flags.nfountains = nfountains;
    lvl.flags.nsinks = nsinks;
}

function fillVault(room) {
    if (!room) return;
    const amountRange = Math.abs(depth_of_level(game.u?.uz)) * 100;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            mkgold(51 + rn2(amountRange), x, y);
        }
    }
}

// C ref: mklev.c clear_level_structures()
function clear_level_structures() {
    const g = game;
    g.fmon = null;
    g.level = new GameMap();
    g.level.nroom = 0;
    g.level.rooms = [];
    g.level.nsubroom = 0;
    g.level.subrooms = [];
    g.made_branch = false;
    g.smeq = new Array(MAXNROFROOMS + 1).fill(0);
    g.level.doorindex = 0;
    g.level.doors = [];
    g.stairs = null;
    g.vault_x = -1;
    const lf = g.level.flags;
    lf.nfountains = 0;
    lf.nsinks = 0;
    lf.has_shop = false;
    lf.has_vault = false;
    lf.has_zoo = false;
    lf.has_court = false;
    lf.has_morgue = false;
    lf.graveyard = false;
    lf.has_beehive = false;
    lf.has_barracks = false;
    lf.has_temple = false;
    lf.has_swamp = false;
    lf.noteleport = false;
    lf.hardfloor = false;
    lf.nommap = false;
    lf.hero_memory = true;
    lf.shortsighted = false;
    lf.sokoban_rules = false;
    lf.is_maze_lev = false;
    lf.is_cavernous_lev = false;
    lf.is_rogue_level = false;
    lf.rogue_level = false;
    lf.arboreal = false;
    lf.has_town = false;
    lf.wizard_bones = false;
    lf.corrmaze = false;
    lf.temperature = 0;
    lf.rndmongen = true;
    lf.deathdrops = true;
    lf.noautosearch = false;
    lf.fumaroles = false;
    lf.stormy = false;
    lf.stasis_until = 0;
    init_rect();
}

// C ref: mkmap.c litstate_rnd()
function litstate_rnd(litstate) {
    if (litstate < 0) {
        const d = depth_of_level(game.u?.uz);
        return (rnd(1 + Math.abs(d)) < 11 && rn2(77)) ? true : false;
    }
    return !!litstate;
}

// ── Special-level operations ──────────────────────────────────────────────
//
// C refs: sp_lev.c lspo_map(), get_location(), l_create_stairway(), and
// create_object().  Keep these operations independent of any one Lua file:
// the file-specific runner below should describe operation order and data,
// while this layer owns C coordinate and engine-object semantics.

function centeredSpecialMap(width, height) {
    // sp_lev.c centers against x_maze_max/y_maze_max, then forces an odd
    // origin so wall glyphs line up with the maze grid.
    const mazeMaxX = (COLNO - 1) & ~1;
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = 2 + Math.trunc((mazeMaxX - 2 - width) / 2);
    let ystart = 2 + Math.trunc((mazeMaxY - 2 - height) / 2);
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    // sp_lev.c permits full-height maps: after the ordinary odd-origin
    // alignment overflows ROWNO, it retries two rows upward and finally
    // anchors a ROWNO-tall fragment at row zero.
    if (ystart < 0 || ystart + height > ROWNO) {
        ystart += ystart > 0 ? -2 : 2;
        if (height === ROWNO) ystart = 0;
        if (ystart < 0 || ystart + height > ROWNO) ystart = 0;
    }
    return { xstart, ystart, width, height };
}

function halfLeftSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_H_LEFT, SPLEV_CENTER).  Vlad's Tower is
    // deliberately placed one quarter of the available horizontal span from
    // the left edge rather than centered with most special maps.
    const mazeMaxX = (COLNO - 1) & ~1;
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = 2 + Math.trunc((mazeMaxX - 2 - width) / 4);
    let ystart = 2 + Math.trunc((mazeMaxY - 2 - height) / 2);
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    return { xstart, ystart, width, height };
}

function halfRightSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_H_RIGHT, SPLEV_CENTER).  Named Gehennom
    // levels use this to reserve the right quarter for a mapped fragment
    // while leaving the center maze grid available to des.mazewalk().
    const mazeMaxX = (COLNO - 1) & ~1;
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = 2
        + Math.trunc((mazeMaxX - 2 - width) * 3 / 4);
    let ystart = 2 + Math.trunc((mazeMaxY - 2 - height) / 2);
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    return { xstart, ystart, width, height };
}

function leftBottomSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_LEFT, BOTTOM).  An explicit level_init makes
    // the left anchor column 1; the bottom anchor is relative to the even
    // maze limit.  Both coordinates are then advanced to odd map-grid cells.
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = 1;
    let ystart = mazeMaxY - height - 1;
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    return { xstart, ystart, width, height };
}

function rightTopSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_RIGHT, TOP).
    const mazeMaxX = (COLNO - 1) & ~1;
    let xstart = mazeMaxX - width - 1;
    let ystart = 3;
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    return { xstart, ystart, width, height };
}

function rightCenterSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_RIGHT, SPLEV_CENTER).  Baalzebub's beetle
    // occupies the far-right map band rather than the half-right quarter
    // used by Asmodeus's exit fragment.
    const mazeMaxX = (COLNO - 1) & ~1;
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = mazeMaxX - width - 1;
    let ystart = 2 + Math.trunc((mazeMaxY - 2 - height) / 2);
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    return { xstart, ystart, width, height };
}

function specialRandomLocation(context, acceptable = loc => SPACE_POS(loc.typ),
    { allowWalls = false } = {}) {
    // get_location() draws both axes on every attempt, including rejected
    // wall or special-terrain locations.  When a mkroom owns the coordinate,
    // get_location() delegates each attempt to somexy(), which also excludes
    // the walls and one-cell boundary of every immediate subroom.
    for (let attempts = 0; attempts < 100; attempts++) {
        const x = context.xstart + rn2(context.width);
        const y = context.ystart + rn2(context.height);
        const loc = game.level.at(x, y);
        const inSubroom = context._room?.sbrooms?.some(subroom =>
            x >= subroom.lx - 1 && x <= subroom.hx + 1
            && y >= subroom.ly - 1 && y <= subroom.hy + 1);
        if (loc && (allowWalls || !IS_WALL(loc.typ))
            && !inSubroom && acceptable(loc, x, y))
            return { x, y };
    }
    for (let dx = 0; dx < context.width; dx++) {
        for (let dy = 0; dy < context.height; dy++) {
            const x = context.xstart + dx, y = context.ystart + dy;
            const loc = game.level.at(x, y);
            if (loc && acceptable(loc, x, y)) return { x, y };
        }
    }
    return null;
}

// C ref: mkmaze.c set_levltyp().  Terrain mutation owns persistent tile
// side-effects; in particular, every lava form becomes lit even when the Lua
// terrain operation requested SET_LIT_NOCHANGE.  Callers may subsequently
// replace the terrain again without implicitly clearing that light bit.
function setLevelTerrainType(x, y, typ) {
    const loc = game.level?.at?.(x, y);
    if (!loc) return false;
    if (loc.typ === SDOOR && typ === AIR) {
        loc.arboreal_sdoor = 1;
        return true;
    }
    loc.typ = typ;
    if (IS_LAVA(typ)) loc.lit = true;
    if (typ === ICE && game._activeSpecialLevel?.levelInitialized) {
        loc.icedpool = game._activeSpecialLevel.icedPools
            ? ICED_POOL : ICED_MOAT;
    }
    return true;
}

function setLevelTerrainLit(x, y, typ, lit = -2) {
    if (!setLevelTerrainType(x, y, typ)) return false;
    if (lit !== -2) {
        game.level.at(x, y).lit = IS_LAVA(typ)
            ? true
            : lit === -1 ? !!rn2(2) : !!lit;
    }
    return true;
}

function specialSelectionTerrain(selection, typ, lit = -2) {
    selection.forEachXMajor((x, y) => {
        if (!setLevelTerrainLit(x, y, typ, lit)) return;
        if (typ === IRONBARS || typ === HWALL)
            game.level.at(x, y).horizontal = true;
    });
}

function carveSpecialMazeFrom(x, y, passageType, mazeXMax, mazeYMax) {
    const directions = [
        [0, -1], [1, 0], [0, 1], [-1, 0],
    ];
    const start = game.level.at(x, y);
    if (start && !IS_DOOR(start.typ)) {
        start.typ = passageType;
        start.flags = 0;
    }
    for (;;) {
        const available = [];
        for (let direction = 0; direction < directions.length; direction++) {
            const [dx, dy] = directions[direction];
            const nx = x + 2 * dx, ny = y + 2 * dy;
            if (nx >= 3 && ny >= 3 && nx <= mazeXMax && ny <= mazeYMax
                && game.level.at(nx, ny)?.typ === STONE) {
                available.push(direction);
            }
        }
        if (!available.length) return;
        const direction = available[rn2(available.length)];
        const [dx, dy] = directions[direction];
        x += dx;
        y += dy;
        const between = game.level.at(x, y);
        if (between) between.typ = passageType;
        x += dx;
        y += dy;
        carveSpecialMazeFrom(
            x, y, passageType, mazeXMax, mazeYMax,
        );
        // mkmaze.c's non-MICRO walkfrom() has already mutated its local
        // coordinates to the recursive child.  It deliberately resumes
        // there rather than restoring the parent coordinates.
    }
}

function specialMazeWalk(context, mapX, mapY, direction,
    passageType = ROOM) {
    // sp_lev.c:lspo_mazewalk() first opens the square just outside the
    // mapped fragment, then adjusts to an odd maze coordinate and delegates
    // to mkmaze.c:walkfrom().  The recursive walker uses native whole-level
    // maze bounds, not the Lua map rectangle.
    let x = context.xstart + mapX;
    let y = context.ystart + mapY;
    if (direction === 'north') y--;
    else if (direction === 'south') y++;
    else if (direction === 'east') x++;
    else if (direction === 'west') x--;

    const opening = game.level.at(x, y);
    if (opening && !IS_DOOR(opening.typ)) {
        opening.typ = passageType;
        opening.flags = 0;
    }
    if (!(x % 2)) {
        x += direction === 'east' ? 1 : -1;
        const parityOpening = game.level.at(x, y);
        if (parityOpening) {
            parityOpening.typ = passageType;
            parityOpening.flags = 0;
        }
    }
    if (!(y % 2)) y += direction === 'south' ? 1 : -1;

    carveSpecialMazeFrom(
        x, y, passageType,
        (COLNO - 1) & ~1, (ROWNO - 1) & ~1,
    );
}

function specialMazeStockPoint(context, mappedContexts = [context]) {
    // sp_lev.c:maze1xy().  The stock reservoir is outside every square
    // touched by des.map(), on an odd-coordinate dry passage carved by the
    // preceding mazewalk.
    let point = { x: 3, y: 3 };
    let tries = 2000;
    do {
        point = {
            x: rn1(((COLNO - 1) & ~1) - 3, 3),
            y: rn1(((ROWNO - 1) & ~1) - 3, 3),
        };
        const mapped = mappedContexts.some(mappedContext =>
            point.x >= mappedContext.xstart
            && point.x < mappedContext.xstart + mappedContext.width
            && point.y >= mappedContext.ystart
            && point.y < mappedContext.ystart + mappedContext.height);
        const loc = game.level.at(point.x, point.y);
        const hasBoulder = game.level.objects?.[point.x]?.[point.y]
            ?.some(object => object.otyp === BOULDER);
        if ((point.x % 2) && (point.y % 2) && !mapped
            && loc && SPACE_POS(loc.typ) && !hasBoulder) {
            break;
        }
    } while (--tries >= 0);
    return point;
}

function randomSpecialTrapType() {
    let typ;
    do {
        typ = rnd(TRAPNUM - 1);
        if (typ === HOLE || typ === VIBRATING_SQUARE
            || typ === MAGIC_PORTAL) {
            typ = NO_TRAP;
        } else if (typ === TRAPDOOR && !canDigDown()) {
            typ = NO_TRAP;
        } else if ((typ === LEVEL_TELEP || typ === TELEP_TRAP)
            && game.level.flags.noteleport) {
            typ = NO_TRAP;
        } else if ((typ === ROLLING_BOULDER_TRAP || typ === ROCKTRAP)
            && In_endgame(game.u?.uz)) {
            typ = NO_TRAP;
        }
    } while (typ === NO_TRAP);
    return typ;
}

async function fillEmptySpecialMaze(context, mappedContexts = [context]) {
    // sp_lev.c:fill_empty_maze().  mapcount intentionally begins at the
    // complete rectangle while only mapcountmax is halved; this historical
    // asymmetry leaves Castle with a 43-percent stock budget.
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    let mapcount = (mazeXMax - 2) * (mazeYMax - 2);
    const mapcountmax = Math.trunc(mapcount / 2);
    for (let x = 2; x < mazeXMax; x++) {
        for (let y = 0; y < mazeYMax; y++) {
            if (mappedContexts.some(mappedContext =>
                x >= mappedContext.xstart
                && x < mappedContext.xstart + mappedContext.width
                && y >= mappedContext.ystart
                && y < mappedContext.ystart + mappedContext.height)) {
                mapcount--;
            }
        }
    }
    if (mapcount <= Math.trunc(mapcountmax / 10)) return;
    const mapfact = Math.trunc(mapcount * 100 / mapcountmax);

    for (let count = rnd(Math.trunc(20 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(context, mappedContexts);
        mkobj_at(
            rn2(2) ? GEM_CLASS : RANDOM_CLASS,
            point.x, point.y, true,
        );
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(context, mappedContexts);
        const trap = game.level.traps?.find(candidate =>
            candidate.tx === point.x && candidate.ty === point.y);
        if (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) continue;
        mksobj_at(BOULDER, point.x, point.y, true, false);
    }
    for (let count = rn2(2); count > 0; count--) {
        const point = specialMazeStockPoint(context, mappedContexts);
        await makemon(PM_MINOTAUR, point.x, point.y, 0);
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(context, mappedContexts);
        await makemon(null, point.x, point.y, 0);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(context, mappedContexts);
        mkgold(0, point.x, point.y);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(context, mappedContexts);
        let typ = randomSpecialTrapType();
        if (game.level.objects?.[point.x]?.[point.y]
            ?.some(object => object.otyp === BOULDER)) {
            while (is_pit(typ) || is_hole(typ))
                typ = randomSpecialTrapType();
        }
        await maketrap(point.x, point.y, typ);
    }
}

function createSpecialMaze(corridorWidth = -1, wallThickness = -1,
    removeDeadEnds = false) {
    // C mkmaze.c:create_maze().  The native maze bounds are the largest even
    // coordinates inside the 80x21 map.
    const nativeXMax = (COLNO - 1) & ~1;
    const nativeYMax = (ROWNO - 1) & ~1;
    let corrwid = corridorWidth === -1 ? rnd(4) : corridorWidth;
    let wallthick = wallThickness === -1 ? rnd(4) - corrwid : wallThickness;
    wallthick = Math.max(1, Math.min(5, wallthick));
    corrwid = Math.max(1, Math.min(5, corrwid));
    const scale = corrwid + wallthick;
    const rdx = Math.trunc(nativeXMax / scale);
    const rdy = Math.trunc(nativeYMax / scale);
    const mazeXMax = rdx * 2, mazeYMax = rdy * 2;

    for (let x = 2; x <= mazeXMax; x++) {
        for (let y = 2; y <= mazeYMax; y++) {
            const loc = game.level.at(x, y);
            if (!loc) continue;
            loc.typ = game.level.flags.corrmaze
                ? STONE : ((x % 2) && (y % 2)) ? STONE : HWALL;
            loc.horizontal = true;
            loc.flags = 0;
        }
    }

    const startX = 3 + 2 * rn2((mazeXMax >> 1) - 1);
    const startY = 3 + 2 * rn2((mazeYMax >> 1) - 1);
    const passageType = game.level.flags.corrmaze ? CORR : ROOM;
    carveSpecialMazeFrom(
        startX, startY, passageType, mazeXMax, mazeYMax,
    );

    if (removeDeadEnds) {
        const directions = [
            [0, -1], [1, 0], [0, 1], [-1, 0],
        ];
        const inMaze = (x, y) => x >= 2 && y >= 2
            && x < mazeXMax && y < mazeYMax && isok(x, y);
        for (let x = 2; x < mazeXMax; x++) {
            for (let y = 2; y < mazeYMax; y++) {
                if (!(x % 2) || !(y % 2)
                    || !SPACE_POS(game.level.at(x, y)?.typ)) continue;
                const openings = [];
                let blockedOrEdge = 0;
                for (const [dx, dy] of directions) {
                    const nearX = x + dx, nearY = y + dy;
                    const farX = x + 2 * dx, farY = y + 2 * dy;
                    if (!inMaze(nearX, nearY) || !inMaze(farX, farY)) {
                        blockedOrEdge++;
                        continue;
                    }
                    if (!SPACE_POS(game.level.at(nearX, nearY)?.typ)
                        && SPACE_POS(game.level.at(farX, farY)?.typ)) {
                        openings.push([nearX, nearY]);
                        blockedOrEdge++;
                    }
                }
                if (blockedOrEdge >= 3 && openings.length) {
                    const [openX, openY] = openings[rn2(openings.length)];
                    game.level.at(openX, openY).typ = passageType;
                }
            }
        }
    }

    if (scale > 2) {
        const saved = Array.from({ length: COLNO }, (_, x) =>
            Array.from({ length: ROWNO }, (_, y) =>
                game.level.at(x, y)?.typ ?? STONE));
        let rx = 2, x = 2;
        while (rx < nativeXMax) {
            const mx = x % 2 ? corrwid
                : (x === 2 || x === rdx * 2) ? 1 : wallthick;
            let ry = 2, y = 2;
            while (ry < nativeYMax) {
                const my = y % 2 ? corrwid
                    : (y === 2 || y === rdy * 2) ? 1 : wallthick;
                for (let dx = 0; dx < mx; dx++) {
                    for (let dy = 0; dy < my; dy++) {
                        if (rx + dx >= nativeXMax
                            || ry + dy >= nativeYMax) break;
                        game.level.at(rx + dx, ry + dy).typ = saved[x][y];
                    }
                }
                ry += my;
                y++;
            }
            rx += mx;
            x++;
        }
    }
}

function specialMonsterLocationAcceptable(mndx, loc, x = -1, y = -1,
    allowDryFallback = false) {
    if (!loc) return false;
    const flags = MONSTER_FLAGS1[mndx] || 0;
    const flies = !!(flags & 0x00000001);
    const symbol = MONSTER_SYMBOL[mndx];
    const floats = symbol === 5 || symbol === 25; // S_EYE / S_LIGHT
    const waterOnly = symbol === 57
        || !!(flags & (0x00000002 | 0x00000200)); // eel/swim/amphibious
    const wet = waterOnly || flies || floats;
    const hot = flies || floats
        || mndx === 30 || mndx === 110
        || mndx === PM_FIRE_ELEMENTAL || mndx === PM_SALAMANDER;
    // pm_to_humidity() starts with DRY, but amphibious/swimming species
    // replace it with WET before flying/floating adds HOT|WET.  Floating
    // eyes are amphibious floaters, so their first two 100-location scans on
    // the all-Air map must fail before create_monster() adds DRY as fallback.
    const dry = !waterOnly || allowDryFallback;
    const boulder = x >= 0 && y >= 0
        && game.level.objects?.[x]?.[y]?.some(object => object.otyp === BOULDER);
    if (dry && SPACE_POS(loc.typ) && !boulder) return true;
    if (wet && IS_POOL(loc.typ)) return true;
    if (hot && (loc.typ === LAVAPOOL || loc.typ === LAVAWALL)) return true;
    if ((flags & 0x00000008) || symbol === 54)
        return IS_OBSTRUCTED(loc.typ);
    return false;
}

function specialStair(context, up) {
    const point = specialRandomLocation(context,
        loc => loc.typ === ROOM || loc.typ === CORR || loc.typ === ICE);
    if (point) mkstairs(point.x, point.y, up, null);
}

function specialNonDiggable(context = null) {
    const xstart = context?.xstart ?? 0;
    const ystart = context?.ystart ?? 0;
    const width = context?.width ?? COLNO;
    const height = context?.height ?? ROWNO;
    for (let dx = 0; dx < width; dx++) {
        for (let dy = 0; dy < height; dy++) {
            const loc = game.level.at(xstart + dx, ystart + dy);
            // sp_lev.c:sel_set_wall_property() marks solid rock too.  A later
            // des.wallify() can turn that rock into a boundary wall without
            // losing the property established by des.non_diggable().
            if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
                || loc.typ === IRONBARS)) {
                loc.wall_info |= W_NONDIGGABLE;
            }
        }
    }
}

function specialSelectionNonDiggable(selection) {
    selection.forEachXMajor((x, y) => {
        const loc = game.level.at(x, y);
        if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
            || loc.typ === IRONBARS)) loc.wall_info |= W_NONDIGGABLE;
    });
}

function specialObject(context) {
    const point = specialRandomLocation(context, (loc, x, y) =>
        SPACE_POS(loc.typ)
        && !game.level.objects?.[x]?.[y]?.some(
            object => object.otyp === BOULDER,
        ));
    if (point) return mkobj_at(RANDOM_CLASS, point.x, point.y, true);
    return null;
}

function specialObjectOfClass(context, objectClass) {
    const point = specialRandomLocation(context, (loc, x, y) =>
        SPACE_POS(loc.typ)
        && !game.level.objects?.[x]?.[y]?.some(
            object => object.otyp === BOULDER,
        ));
    if (point) return mkobj_at(objectClass, point.x, point.y, true);
    return null;
}

function specialCorpseOf(context, mndx) {
    const point = specialRandomLocation(context);
    if (!point) return null;
    const corpse = mksobj_at(CORPSE, point.x, point.y, true, false);
    set_corpsenm(corpse, mndx);
    return corpse;
}

function specialObjectOfType(context, otyp) {
    const point = specialRandomLocation(context);
    return point ? mksobj_at(otyp, point.x, point.y, true, true) : null;
}

function specialFeatureOfType(context, typ) {
    const point = specialRandomLocation(context, loc =>
        SPACE_POS(loc.typ) && !IS_FURNITURE(loc.typ));
    if (!point) return null;
    const loc = game.level.at(point.x, point.y);
    if (!loc || IS_FURNITURE(loc.typ)) return null;
    loc.typ = typ;
    return point;
}

function specialDoorAt(context, mask, x, y) {
    const doorX = context.xstart + x, doorY = context.ystart + y;
    const loc = game.level.at(doorX, doorY);
    if (!loc) return null;
    if (!IS_DOOR(loc.typ) && loc.typ !== SDOOR) loc.typ = DOOR;
    const wallOrDoor = candidate => candidate
        && (IS_WALL(candidate.typ) || IS_DOOR(candidate.typ)
            || candidate.typ === SDOOR);
    const wleft = wallOrDoor(game.level.at(doorX - 1, doorY));
    const wright = wallOrDoor(game.level.at(doorX + 1, doorY));
    const wup = wallOrDoor(game.level.at(doorX, doorY - 1));
    const wdown = wallOrDoor(game.level.at(doorX, doorY + 1));
    loc.horizontal = !!((wleft || wright) && !(wup && wdown));
    loc.doormask = mask;
    return { x: doorX, y: doorY };
}

function specialRandomDoorAt(context, x, y) {
    rn2(5);
    let mask = D_NODOOR;
    if (rn2(3) === 0) {
        if (rn2(5) === 0) mask = D_ISOPEN;
        else if (rn2(6) === 0) mask = D_LOCKED;
        else mask = D_CLOSED;
        if (mask !== D_ISOPEN && rn2(25) === 0) mask |= D_TRAPPED;
    }
    return specialDoorAt(context, mask, x, y);
}

function specialIrregularRoom(context, x, y, rtype, lit, needfill) {
    // sp_lev.c lspo_region() delegates irregular rooms to flood_fill_rm().
    // That scanline flood includes diagonally touching runs of the same
    // terrain, then marks neighboring walls and doors as the room's edge.
    const seedX = context.xstart + x, seedY = context.ystart + y;
    const seedType = game.level.at(seedX, seedY)?.typ;
    const roomNumber = game.level.nroom + ROOMOFFSET;
    const pending = [[seedX, seedY]], visited = new Set();
    let lx = seedX, hx = seedX, ly = seedY, hy = seedY;
    while (pending.length) {
        const [roomX, roomY] = pending.pop();
        const key = `${roomX},${roomY}`;
        if (visited.has(key)) continue;
        const loc = game.level.at(roomX, roomY);
        if (!loc || loc.typ !== seedType) continue;
        visited.add(key);
        loc.roomno = roomNumber;
        loc.lit = !!lit;
        lx = Math.min(lx, roomX); hx = Math.max(hx, roomX);
        ly = Math.min(ly, roomY); hy = Math.max(hy, roomY);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx || dy) pending.push([roomX + dx, roomY + dy]);
            }
        }
    }
    for (const key of visited) {
        const [roomX, roomY] = key.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const loc = game.level.at(roomX + dx, roomY + dy);
                if (!loc || !(IS_WALL(loc.typ) || IS_DOOR(loc.typ)
                    || loc.typ === SDOOR)) continue;
                loc.edge = true;
                if (lit) loc.lit = true;
                loc.roomno = loc.roomno && loc.roomno !== roomNumber
                    ? SHARED : roomNumber;
            }
        }
    }
    add_room(lx, ly, hx, hy, lit, rtype, true);
    const room = game.level.rooms[game.level.nroom - 1];
    room.irregular = true;
    room.needjoining = true;
    room.needfill = needfill;
    for (let doorX = room.lx - 1; doorX <= room.hx + 1; doorX++) {
        for (let doorY = room.ly - 1; doorY <= room.hy + 1; doorY++) {
            const loc = game.level.at(doorX, doorY);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                add_door(doorX, doorY, room);
        }
    }
    return room;
}

function getSpecialLevelExtents() {
    const map = game.level;
    const findColumn = (start, step) => {
        for (let x = start; x >= 0 && x < COLNO; x += step) {
            let nonwall = false, found = false;
            for (let y = 0; y < ROWNO; y++) {
                const typ = map.at(x, y).typ;
                if (typ === STONE) continue;
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
            if (found) return { coordinate: x, nonwall };
        }
        return { coordinate: start, nonwall: false };
    };
    const left = findColumn(0, 1), right = findColumn(COLNO - 1, -1);
    // The C scanning loops post-increment/decrement once on the iteration
    // which finds an edge.  Reproduce that loop cursor before applying the
    // one- or two-cell wall/nonwall adjustment.
    let minx = Math.max(0, left.coordinate + 1
        - (left.nonwall || !map.flags.is_maze_lev ? 2 : 1));
    let maxx = Math.min(COLNO - 1, right.coordinate - 1
        + (right.nonwall || !map.flags.is_maze_lev ? 2 : 1));
    const findRow = (start, step) => {
        for (let y = start; y >= 0 && y < ROWNO; y += step) {
            let nonwall = false, found = false;
            for (let x = minx; x <= maxx; x++) {
                const typ = map.at(x, y).typ;
                if (typ === STONE) continue;
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
            if (found) return { coordinate: y, nonwall };
        }
        return { coordinate: start, nonwall: false };
    };
    const top = findRow(0, 1), bottom = findRow(ROWNO - 1, -1);
    let miny = top.coordinate + 1
        - (top.nonwall || !map.flags.is_maze_lev ? 2 : 1);
    let maxy = bottom.coordinate - 1
        + (bottom.nonwall || !map.flags.is_maze_lev ? 2 : 1);
    minx = Math.max(1, minx); maxx = Math.min(COLNO - 1, maxx);
    miny = Math.max(0, miny); maxy = Math.min(ROWNO - 1, maxy);
    return { minx, miny, maxx, maxy };
}

function flipSpecialLevel(flp) {
    if (!(flp & 3)) return;
    const { minx, miny, maxx, maxy } = getSpecialLevelExtents();
    const inArea = (x, y) => x >= minx && x <= maxx
        && y >= miny && y <= maxy;
    const flipX = x => maxx - x + minx;
    const flipY = y => maxy - y + miny;
    const transform = (x, y, requireArea = true) => {
        if (requireArea && !inArea(x, y)) return { x, y };
        return { x: flp & 2 ? flipX(x) : x, y: flp & 1 ? flipY(y) : y };
    };

    // sp_lev.c flips wall glyph topology along with coordinates.  The raw
    // map has already been wallified, so corners and T-junctions must change
    // orientation before their location records move.
    const verticalWallFlip = new Map([
        [TLCORNER, BLCORNER], [BLCORNER, TLCORNER],
        [TRCORNER, BRCORNER], [BRCORNER, TRCORNER],
        [TUWALL, TDWALL], [TDWALL, TUWALL],
    ]);
    const horizontalWallFlip = new Map([
        [TLCORNER, TRCORNER], [TRCORNER, TLCORNER],
        [BLCORNER, BRCORNER], [BRCORNER, BLCORNER],
        [TLWALL, TRWALL], [TRWALL, TLWALL],
    ]);
    for (let x = minx; x <= maxx; x++) {
        for (let y = miny; y <= maxy; y++) {
            const loc = game.level.at(x, y);
            if (flp & 1) loc.typ = verticalWallFlip.get(loc.typ) ?? loc.typ;
            if (flp & 2) loc.typ = horizontalWallFlip.get(loc.typ) ?? loc.typ;
        }
    }

    for (let stair = game.stairs; stair; stair = stair.next) {
        const point = transform(stair.sx, stair.sy, false);
        stair.sx = point.x; stair.sy = point.y;
    }
    if (game.level.upstair) game.level.upstair = transform(
        game.level.upstair.x, game.level.upstair.y, false);
    if (game.level.dnstair) game.level.dnstair = transform(
        game.level.dnstair.x, game.level.dnstair.y, false);
    for (const trap of game.level.traps || []) {
        const flipTrap = inArea(trap.tx, trap.ty);
        const point = transform(trap.tx, trap.ty);
        trap.tx = point.x; trap.ty = point.y;
        if (flipTrap && trap.ttyp === ROLLING_BOULDER_TRAP) {
            trap.launch = transform(trap.launch.x, trap.launch.y, false);
            trap.launch2 = transform(trap.launch2.x, trap.launch2.y, false);
        }
    }
    const movedObjects = [];
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const pile = game.level.objects?.[x]?.[y];
            if (!pile) continue;
            const point = transform(x, y);
            for (const object of pile) {
                object.ox = point.x; object.oy = point.y;
            }
            if (!movedObjects[point.x]) movedObjects[point.x] = [];
            movedObjects[point.x][point.y] = pile;
        }
    }
    game.level.objects = movedObjects;
    for (const monster of game.level.monsters || []) {
        const point = transform(monster.mx, monster.my);
        monster.mx = point.x; monster.my = point.y;
        if (monster.wormSegments) {
            monster.wormSegments = monster.wormSegments.map(segment =>
                transform(segment.x, segment.y));
        }
    }
    for (const engraving of game.level.engravings || []) {
        const point = transform(engraving.x, engraving.y, false);
        engraving.x = point.x; engraving.y = point.y;
    }
    for (const room of game.level.rooms.slice(0, game.level.nroom)) {
        if (!room) continue;
        const low = transform(room.lx, room.ly, false);
        const high = transform(room.hx, room.hy, false);
        room.lx = Math.min(low.x, high.x); room.hx = Math.max(low.x, high.x);
        room.ly = Math.min(low.y, high.y); room.hy = Math.max(low.y, high.y);
    }
    for (const room of game.level.subrooms || []) {
        if (!room) continue;
        const low = transform(room.lx, room.ly, false);
        const high = transform(room.hx, room.hy, false);
        room.lx = Math.min(low.x, high.x); room.hx = Math.max(low.x, high.x);
        room.ly = Math.min(low.y, high.y); room.hy = Math.max(low.y, high.y);
    }
    for (const door of game.level.doors || []) {
        const point = transform(door.x, door.y);
        door.x = point.x; door.y = point.y;
    }
    for (const zone of game.level.exclusionZones || []) {
        const low = transform(zone.lx, zone.ly, false);
        const high = transform(zone.hx, zone.hy, false);
        zone.lx = Math.min(low.x, high.x);
        zone.hx = Math.max(low.x, high.x);
        zone.ly = Math.min(low.y, high.y);
        zone.hy = Math.max(low.y, high.y);
    }
    if (flp & 1) {
        for (let x = minx; x <= maxx; x++) {
            for (let y = miny; y < miny + Math.trunc((maxy - miny + 1) / 2); y++) {
                const otherY = flipY(y), swap = game.level.locations[x][y];
                game.level.locations[x][y] = game.level.locations[x][otherY];
                game.level.locations[x][otherY] = swap;
            }
        }
    }
    if (flp & 2) {
        for (let x = minx; x < minx + Math.trunc((maxx - minx + 1) / 2); x++) {
            const otherX = flipX(x);
            for (let y = miny; y <= maxy; y++) {
                const swap = game.level.locations[x][y];
                game.level.locations[x][y] = game.level.locations[otherX][y];
                game.level.locations[otherX][y] = swap;
            }
        }
    }
    game.level._flip = { flp, minx, miny, maxx, maxy };
}

function flipSpecialLevelRandom(allowed) {
    let flp = 0;
    if ((allowed & 1) && rn2(2)) flp |= 1;
    if ((allowed & 2) && rn2(2)) flp |= 2;
    flipSpecialLevel(flp);
}

async function fillZooRoom(room) {
    // C ref: mkroom.c fill_zoo(), ZOO branch.  Irregular-room membership and
    // the first linked door determine the traversal and its three-cell
    // entrance exclusion.  Monster and gold creation remain shared owners.
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    const entrance = game.level.doors[room.fdoor];
    let goldlim = 500 * level_difficulty();
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = game.level.at(x, y);
            const entranceDistance = entrance
                ? Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y))
                : Infinity;
            if (room.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (room.doorct && entranceDistance <= 1)) continue;
            } else if (!SPACE_POS(loc.typ)
                || (room.doorct && entrance
                    && ((x === room.lx && entrance.x === x - 1)
                        || (x === room.hx && entrance.x === x + 1)
                        || (y === room.ly && entrance.y === y - 1)
                        || (y === room.hy && entrance.y === y + 1)))) {
                continue;
            }

            const monster = await makemon(null, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster) monster.msleeping = 1;

            let amountRange = goldlim;
            if (room.doorct) {
                const dx = x - entrance.x, dy = y - entrance.y;
                const distanceSquared = dx * dx + dy * dy;
                amountRange = distanceSquared * distanceSquared;
            }
            if (amountRange >= goldlim)
                amountRange = 5 * level_difficulty();
            goldlim -= amountRange;
            mkgold(rn1(amountRange, 10), x, y);
        }
    }
    game.level.flags.has_zoo = true;
}

function courtMonsterType() {
    const roll = rn2(60) + rn2(3 * level_difficulty());
    if (roll > 100) return mkclass(30, 0); // S_DRAGON
    if (roll > 95) return mkclass(34, 0); // S_GIANT
    if (roll > 85) return mkclass(46, 0); // S_TROLL
    if (roll > 75) return mkclass(29, 0); // S_CENTAUR
    if (roll > 60) return mkclass(15, 0); // S_ORC
    if (roll > 45) return 45; // PM_BUGBEAR
    if (roll > 30) return 71; // PM_HOBGOBLIN
    if (roll > 15) return mkclass(33, 0); // S_GNOME
    return mkclass(11, 0); // S_KOBOLD
}

async function fillCourtRoom(room) {
    // C mkroom.c:fill_zoo(COURT).  Maze courts use the throne already drawn
    // on the map; ordinary courts choose a free square for a new throne.
    const throne = { x: 0, y: 0 };
    let mappedThrone = false;
    if (game.level.flags.is_maze_lev) {
        for (let x = room.lx; x <= room.hx && !mappedThrone; x++) {
            for (let y = room.ly; y <= room.hy; y++) {
                if (game.level.at(x, y)?.typ !== THRONE) continue;
                throne.x = x;
                throne.y = y;
                mappedThrone = true;
                break;
            }
        }
    }
    if (!mappedThrone) {
        for (let attempts = 100; attempts > 0; attempts--) {
            somexyspace(room, throne);
            if (!occupied(throne.x, throne.y)) break;
        }
    }
    const difficulty = level_difficulty();
    const rulerRoll = rnd(difficulty);
    const rulerType = rulerRoll > 9 ? 205 // PM_OGRE_TYRANT
        : rulerRoll > 5 ? 269 // PM_ELVEN_MONARCH
            : rulerRoll > 2 ? 47 // PM_DWARF_RULER
                : PM_GNOME_RULER;
    const ruler = await makemon(rulerType, throne.x, throne.y, 0);
    if (ruler) {
        ruler.msleeping = 1;
        ruler.mpeaceful = 0;
        const mace = mksobj(MACE, true, false);
        addObjectToMonsterInventory(ruler, mace, game, { atFront: true });
    }

    const entrance = room.doorct
        ? game.level.doors?.[room.fdoor] : null;
    const roomNumber = game.level.rooms.indexOf(room) + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = game.level.at(x, y);
            if (room.irregular) {
                if (!loc || loc.roomno !== roomNumber || loc.edge
                    || (entrance
                        && Math.max(Math.abs(x - entrance.x),
                            Math.abs(y - entrance.y)) <= 1))
                    continue;
            } else if (!loc || !SPACE_POS(loc.typ)
                || (entrance
                    && ((x === room.lx && entrance.x === x - 1)
                        || (x === room.hx && entrance.x === x + 1)
                        || (y === room.ly && entrance.y === y - 1)
                        || (y === room.hy && entrance.y === y + 1)))) {
                continue;
            }
            // Non-maze courts do not change the chosen square to THRONE
            // until after this scan.  courtmon() still runs for that occupied
            // square and makemon() then rejects it without constructor RNG.
            if (loc.typ === THRONE) continue;
            const mndx = courtMonsterType();
            const monster = mndx == null ? null
                : await makemon(mndx, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster) {
                monster.msleeping = 1;
                monster.mpeaceful = 0;
            }
        }
    }

    const throneLoc = game.level.at(throne.x, throne.y);
    if (throneLoc) throneLoc.typ = THRONE;
    const cofferPosition = { x: 0, y: 0 };
    somexyspace(room, cofferPosition);
    const gold = mksobj(GOLD_PIECE, true, false);
    gold.quan = rn1(50 * difficulty, 10);
    gold.quantity = gold.quan;
    gold.owt = (OBJECT_WEIGHT[GOLD_PIECE] ?? 0) * gold.quan;
    const chest = mksobj_at(
        CHEST, cofferPosition.x, cofferPosition.y, true, false,
    );
    chest.contents = [gold];
    chest.spe = 2;
    game.level.flags.has_court = true;
}

function loadSpecialAsciiMap(rows, defaultLit, origin = null) {
    const width = Math.max(...rows.map(row => row.length));
    const context = origin
        ? { ...origin, width, height: rows.length }
        : centeredSpecialMap(width, rows.length);
    for (let dy = 0; dy < rows.length; dy++) {
        const row = rows[dy].padEnd(width, ' ');
        for (let dx = 0; dx < width; dx++) {
            // `x` is NetHack's INVALID_TYPE map glyph: it is transparent and
            // preserves the terrain established by level_init.
            if (row[dx] === 'x') continue;
            const loc = game.level.at(context.xstart + dx, context.ystart + dy);
            // lspo_map() clips a fragment at COLNO/ROWNO while retaining its
            // declared coordinate frame.  water.lua deliberately supplies an
            // 80-column fragment beginning at column one, so its last source
            // column lies beyond NetHack's usable map and is ignored.
            if (!loc) continue;
            loc.lit = defaultLit;
            loc.horizontal = row[dx] === '-';
            if (row[dx] === '.') loc.typ = ROOM;
            else if (row[dx] === '#') loc.typ = CORR;
            else if (row[dx] === '-') loc.typ = HWALL;
            else if (row[dx] === '|') loc.typ = VWALL;
            else if (row[dx] === '+') {
                loc.typ = DOOR;
                loc.doormask = D_NODOOR;
            } else if (row[dx] === 'S') {
                loc.typ = SDOOR;
                loc.doormask = D_CLOSED;
            } else if (row[dx] === 'F') loc.typ = IRONBARS;
            else if (row[dx] === 'B') loc.typ = CROSSWALL;
            else if (row[dx] === 'P') loc.typ = POOL;
            else if (row[dx] === 'I') setLevelTerrainType(
                context.xstart + dx, context.ystart + dy, ICE,
            );
            else if (row[dx] === '{') loc.typ = FOUNTAIN;
            else if (row[dx] === '}') loc.typ = MOAT;
            else if (row[dx] === 'W') loc.typ = WATER;
            else if (row[dx] === 'A') {
                loc.typ = AIR;
                loc.lit = true;
            }
            else if (row[dx] === 'L') {
                loc.typ = LAVAPOOL;
                loc.lit = true;
            } else if (row[dx] === 'Z') {
                loc.typ = LAVAWALL;
                loc.lit = true;
            }
            else if (row[dx] === 'C') loc.typ = CLOUD;
            else if (row[dx] === 'T') loc.typ = TREE;
            else if (row[dx] === '\\') loc.typ = THRONE;
            else loc.typ = STONE;
        }
    }
    // sp_lev.c orients mapped doors only after the whole fragment exists, so
    // neighboring walls and other doors are all available to the decision.
    for (let dy = 0; dy < rows.length; dy++) {
        const row = rows[dy].padEnd(width, ' ');
        for (let dx = 0; dx < width; dx++) {
            if (row[dx] !== '+' && row[dx] !== 'S') continue;
            const loc = game.level.at(context.xstart + dx, context.ystart + dy);
            if (!loc) continue;
            specialDoorAt(context, loc.doormask, dx, dy);
        }
    }
    return context;
}

function specialStairAt(context, x, y, up) {
    mkstairs(context.xstart + x, context.ystart + y, up, null);
}

function specialLadderAt(context, x, y, up) {
    const ladderX = context.xstart + x;
    const ladderY = context.ystart + y;
    const loc = game.level.at(ladderX, ladderY);
    if (!loc) return;
    loc.typ = LADDER;
    loc.ladder = up ? 1 : 2;
    const currentLevel = game.u?.uz?.dlevel ?? 1;
    const destination = {
        dnum: game.u?.uz?.dnum ?? 0,
        dlevel: currentLevel + (up ? -1 : 1),
    };
    stairway_add(ladderX, ladderY, !!up, true, destination);
}

function specialObjectAt(context, otyp, x, y, { named = false } = {}) {
    // sp_lev.c:create_object() passes `!named` as mksobj_at()'s artifact
    // eligibility.  This matters even when no artifact can be produced:
    // unnamed armor still consumes its source-owned rn2(40) chance.
    return mksobj_at(
        otyp, context.xstart + x, context.ystart + y, true, !named,
    );
}

function specialRandomObjectAt(context, x, y) {
    return mkobj_at(
        RANDOM_CLASS, context.xstart + x, context.ystart + y, true,
    );
}

function specialObjectClassAt(context, objectClass, x, y) {
    return mkobj_at(
        objectClass, context.xstart + x, context.ystart + y, true,
    );
}

function applyMinesSameRaceMonsterGate(mndx) {
    const dungeonName = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname;
    const prototype = game._activeSpecialLevel?.prototype;
    const inMines = dungeonName === 'The Gnomish Mines'
        || prototype === 'minefill'
        || prototype === 'minetn'
        || prototype === 'minend';
    if (mndx == null || !inMines) return mndx;
    const race = game.urace?.noun || game.urace?.name;
    const selfMask = race === 'dwarf' ? M2_DWARF
        : race === 'gnome' ? M2_GNOME : 0;
    if (!selfMask || !((MONSTER_FLAGS2[mndx] || 0) & selfMask))
        return mndx;
    // sp_lev.c:create_monster(): Mines levels usually replace a requested
    // monster of the dwarf/gnome hero's own race with a random species.
    return rn2(3) ? null : mndx;
}

function finishSpecialRoamer(monster, alignment, peaceful) {
    const coaligned = alignment === (game.u?.ualign?.type ?? A_NEUTRAL);
    monster.ispriest = 0;
    monster.isminion = 1;
    monster.emin = {
        min_align: alignment,
        renegade: coaligned && !peaceful,
    };
    monster.maligntyp = alignment;
    monster.mpeaceful = peaceful ? 1 : 0;
    monster.msleeping = 0;
    monster.mtrapseen = 0x7fffffff;
    setMonsterMalign(monster);
}

async function specialMonsterAt(context, mndx, x, y,
    {
        randomGender = true,
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    } = {}) {
    // Lua's find_montype() resolves a requested gender before
    // create_monster() resolves random alignment.  Fixed-sex monsters skip
    // the former draw; makemon() still performs its own independent gender
    // initialization before the explicit value is restored.
    const requestedFemale = randomGender ? !!rn2(2) : null;
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const monster = await makemon(
        mndx, context.xstart + x, context.ystart + y, mmflags,
    );
    if (monster && randomGender) monster.female = requestedFemale;
    if (monster && peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null) monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}

async function specialMonsterClassAt(context, monsterClass, x, y,
    appearance = null,
    {
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    } = {}) {
    // A class request resolves random alignment and mkclass(), but unlike a
    // named species it has no separate find_montype() gender draw.  Explicit
    // coordinates also bypass get_location()'s two-axis sampling.
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    let mndx = mkclass(monsterClass, 0x0200);
    if (mndx == null) return null;
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const absoluteX = context.xstart + x, absoluteY = context.ystart + y;
    const occupied = game.level.monsters?.some(candidate => candidate.mhp > 0
        && candidate.mx === absoluteX && candidate.my === absoluteY);
    const monster = occupied
        ? await makemonNear(mndx, absoluteX, absoluteY, mmflags)
        : await makemon(mndx, absoluteX, absoluteY, mmflags);
    if (monster && peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null) monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    if (monster && appearance?.kind === 'object') {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = appearance.otyp;
    }
    return monster;
}

function discardSpecialMonsterInventory(monster) {
    // discard_minvent(..., TRUE) protects each object with obj_resists()
    // before deallocating it.  These ordinary generated items cannot resist,
    // but the draws remain part of the constructor boundary.
    for (const object of monster?.minvent || []) rn2(100);
    if (!monster) return;
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.misc_worn_check = 0;
    monster.mw = null;
}

export function giveSpecialMonsterObject(context, monster, otyp, spe) {
    const point = specialRandomLocation(context);
    if (!point || !monster) return null;
    const object = mksobj_at(otyp, point.x, point.y, true, true);
    if (spe != null) object.spe = spe;
    const pile = game.level.objects?.[point.x]?.[point.y];
    const index = pile?.indexOf(object) ?? -1;
    if (index >= 0) pile.splice(index, 1);
    return addObjectToMonsterInventory(
        monster, object, game, { atFront: true },
    );
}

function specialNonPasswall(context) {
    for (let dx = 0; dx < context.width; dx++) {
        for (let dy = 0; dy < context.height; dy++) {
            const loc = game.level.at(context.xstart + dx, context.ystart + dy);
            if (loc && IS_WALL(loc.typ)) loc.wall_info |= W_NONPASSWALL;
        }
    }
}

function specialMonsterRandomLocation(context, mndx) {
    const nativeHumidity = (loc, x, y) =>
        specialMonsterLocationAcceptable(mndx, loc, x, y);
    const locationOptions = { allowWalls: true };
    let point = specialRandomLocation(
        context, nativeHumidity, locationOptions,
    );
    // get_location_coord() repeats a failed random coordinate with the same
    // supplied humidity before create_monster() sees (-1,-1).
    if (!point) {
        point = specialRandomLocation(
            context, nativeHumidity, locationOptions,
        );
    }
    // create_monster() then adds DRY and calls get_location_coord() again.
    if (!point) {
        point = specialRandomLocation(
            context,
            (loc, x, y) =>
                specialMonsterLocationAcceptable(mndx, loc, x, y, true),
            locationOptions,
        );
    }
    return point;
}

async function specialExplicitMonster(context, mndx, appearance = null,
    {
        randomGender = true,
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    } = {}) {
    // sp_lev.c find_montype() resolves a legal gender while parsing the Lua
    // table.  makemon() independently initializes gender, then
    // create_monster() restores this explicit value after construction.
    const requestedFemale = randomGender
        ? (namedMonsterNeedsGenderDraw(mndx)
            ? !!rn2(2)
            : !!((MONSTER_FLAGS2[mndx] || 0) & 0x00020000))
        : null;
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const point = specialMonsterRandomLocation(context, mndx);
    if (!point) return null;
    const occupied = game.level.monsters?.some(candidate => candidate.mhp > 0
        && candidate.mx === point.x && candidate.my === point.y);
    const monster = occupied
        ? await makemonNear(mndx, point.x, point.y, mmflags)
        : await makemon(mndx, point.x, point.y, mmflags);
    if (!monster) return null;
    if (requestedFemale != null) monster.female = requestedFemale;
    if (peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (asleep != null) monster.msleeping = asleep ? 1 : 0;
    if (alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    if (appearance?.kind === 'object') {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = appearance.otyp;
    }
    return monster;
}

async function specialMonsterOfClass(
    context, monsterClass,
    {
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    } = {},
) {
    // create_monster() resolves its random alignment before a one-character
    // monster id is expanded through mkclass_aligned().
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    // find_montype() allows class requests to select species which carry
    // G_NOGEN; explicit special-level population is the exception encoded
    // by mkclass(class, G_NOGEN).
    let mndx = mkclass(monsterClass, 0x0200);
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const point = specialMonsterRandomLocation(context, mndx);
    if (!point || mndx == null) return null;
    const occupied = game.level.monsters?.some(candidate => candidate.mhp > 0
        && candidate.mx === point.x && candidate.my === point.y);
    const monster = occupied
        ? makemonNear(mndx, point.x, point.y, mmflags)
        : makemon(mndx, point.x, point.y, mmflags);
    const resolved = await monster;
    if (resolved && peaceful != null)
        resolved.mpeaceful = peaceful ? 1 : 0;
    if (resolved && asleep != null)
        resolved.msleeping = asleep ? 1 : 0;
    if (resolved && alignment != null)
        finishSpecialRoamer(resolved, alignment, peaceful ?? true);
    return resolved;
}

async function finishSpecialTrapConstruction(
    trap, { spiderOnWeb = true, seen = false, victim = true } = {},
) {
    if (!trap) return null;
    const kind = trap.ttyp;
    if (seen) trap.tseen = true;
    if (kind === MAGIC_PORTAL && !trap.dst)
        trap.dst = { ...(game.u?.ucamefrom || {}) };
    // mklev.c:mktrap() owns the web's resident spider before evaluating the
    // shallow-level dead-predecessor gate.
    if (kind === WEB && spiderOnWeb)
        await makemon(PM_GIANT_SPIDER, trap.tx, trap.ty, 0);

    if (!game.in_mklev || kind === NO_TRAP || !victim) return trap;
    const predecessorRoll = rnd(4);
    if (level_difficulty() <= predecessorRoll
        && kind !== SQKY_BOARD && kind !== RUST_TRAP
        && !(kind === ROLLING_BOULDER_TRAP
            && trap.launch?.x === trap.tx && trap.launch?.y === trap.ty)
        && !is_pit(kind) && (kind < HOLE || kind === MAGIC_TRAP)) {
        if (kind === LANDMINE) {
            trap.ttyp = PIT;
            trap.tseen = true;
        }
        mktrap_victim(trap);
    }
    return trap;
}

async function specialTrapOfType(context, typ, options = undefined) {
    const point = specialRandomLocation(context, (loc, x, y) =>
        SPACE_POS(loc.typ)
        && loc.typ !== STAIRS
        && !game.level.objects?.[x]?.[y]?.some(
            object => object.otyp === BOULDER,
        ));
    if (!point) return null;
    const trap = await maketrap(point.x, point.y, typ);
    return finishSpecialTrapConstruction(trap, options);
}

async function specialTrapAt(context, typ, x, y, options = undefined) {
    const trap = await maketrap(
        context.xstart + x, context.ystart + y, typ,
    );
    return finishSpecialTrapConstruction(trap, options);
}

function specialRandomTrapType(inHell = false) {
    const level = level_difficulty();
    const noTeleport = !!game.level?.flags?.noteleport;
    const singleLevelBranch = game.dungeons?.[
        game.u?.uz?.dnum ?? 0
    ]?.dname === 'Fort Ludios';
    for (;;) {
        let type = rnd(TRAPNUM - 1);
        if (type === TRAPPED_DOOR || type === TRAPPED_CHEST
            || type === MAGIC_PORTAL || type === VIBRATING_SQUARE) {
            type = NO_TRAP;
        } else if ((type === ROLLING_BOULDER_TRAP || type === SLP_GAS_TRAP)
            && level < 2) {
            type = NO_TRAP;
        } else if (type === LEVEL_TELEP
            && (level < 5 || noTeleport || singleLevelBranch)) {
            type = NO_TRAP;
        } else if (type === SPIKED_PIT && level < 5) {
            type = NO_TRAP;
        } else if (type === LANDMINE && level < 6) {
            type = NO_TRAP;
        } else if (type === WEB && level < 7) {
            type = NO_TRAP;
        } else if ((type === STATUE_TRAP || type === POLY_TRAP) && level < 8) {
            type = NO_TRAP;
        } else if (type === FIRE_TRAP && !inHell) {
            type = NO_TRAP;
        } else if (type === TELEP_TRAP && noTeleport) {
            type = NO_TRAP;
        } else if (type === HOLE && rn2(7)) {
            type = NO_TRAP;
        }
        if (type !== NO_TRAP) return type;
    }
}

async function specialTrap(context, options = undefined) {
    const point = specialRandomLocation(context,
        (loc, x, y) => SPACE_POS(loc.typ)
            && loc.typ !== STAIRS && loc.typ !== LADDER
            && !game.level.objects?.[x]?.[y]?.some(
                object => object.otyp === BOULDER,
            ));
    if (!point) return;
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    let type = inHell && !rn2(5)
        ? FIRE_TRAP : specialRandomTrapType(inHell);
    if (is_hole(type) && !canFallThrough()) type = ROCKTRAP;
    const trap = await maketrap(point.x, point.y, type);
    await finishSpecialTrapConstruction(trap, options);
}

async function specialMonster(context, {
    randomAlignment = true,
    peaceful = null,
    asleep = null,
    mmflags = 0,
    roamerAlignment = null,
} = {}) {
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const point = specialRandomLocation(context);
    if (!point) return;
    const occupiedPoint = game.level.monsters?.some(monster => monster.mhp > 0
        && monster.mx === point.x && monster.my === point.y);
    const monster = occupiedPoint
        ? await makemonNear(null, point.x, point.y, mmflags)
        : await makemon(null, point.x, point.y, mmflags);
    if (monster && peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null) monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}

function setSpecialRegionLighting(context, x1, y1, x2, y2, lit) {
    // sp_lev.c's two-argument des.region(selection, "lit") grows the cloned
    // selection one cell in every direction before applying light.  "unlit"
    // applies to the literal selection without growth.
    const halo = lit ? 1 : 0;
    for (let x = x1 - halo; x <= x2 + halo; x++) {
        for (let y = y1 - halo; y <= y2 + halo; y++) {
            const loc = game.level.at(context.xstart + x, context.ystart + y);
            if (loc) loc.lit = lit;
        }
    }
}


async function generateMineFiller(active) {
    active.file = 'minefill.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

export async function generateVladsTowerLevel(active) {
    if (!/^tower[1-3]$/.test(active?.prototype))
        throw new RangeError(`unknown Vlad tower level ${active?.prototype}`);
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

export async function generateMinesEnd(active) {
    if (active?.variant < 1 || active?.variant > 3) {
        throw new RangeError(`unknown Mines' End layout ${active?.variant}`);
    }
    active.file = `minend-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function specialRoomContext(room) {
    const context = {
        xstart: room.lx,
        ystart: room.ly,
        width: room.hx - room.lx + 1,
        height: room.hy - room.ly + 1,
    };
    Object.defineProperty(context, '_room', {
        value: room, enumerable: false, configurable: false,
    });
    return context;
}

function addDoorsToSpecialRoom(room) {
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const loc = game.level.at(x, y);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                add_door(x, y, room);
        }
    }
    for (const subroom of room.sbrooms || []) addDoorsToSpecialRoom(subroom);
}

async function buildSpecialRoom(spec, parent = null, contents = null) {
    const chance = spec.chance ?? 100;
    const requestedType = spec.rtype ?? OROOM;
    const rtype = !chance || rn2(100) < chance ? requestedType : OROOM;
    let room;
    if (parent) {
        room = create_subroom(
            parent,
            spec.x ?? -1, spec.y ?? -1,
            spec.w ?? -1, spec.h ?? -1,
            rtype, spec.lit ?? -1,
        );
    } else {
        const made = create_room(
            spec.x ?? -1, spec.y ?? -1,
            spec.w ?? -1, spec.h ?? -1,
            spec.xalign ?? -1, spec.yalign ?? -1,
            rtype, spec.lit ?? -1,
        );
        room = made ? game.level.rooms[game.level.nroom - 1] : null;
    }
    if (!room) return null;
    // Lua lspo_room() marks the current parent irregular as soon as a child
    // room is accepted.  Runtime inside_room() queries must then use map
    // room-number ownership rather than the parent's rectangular boundary.
    if (parent) parent.irregular = true;
    topologize(room);
    room.needfill = spec.filled ?? FILL_NORMAL;
    room.needjoining = spec.joined ?? true;
    if (contents) await contents(room);
    addDoorsToSpecialRoom(room);
    return room;
}

function createSpecialRoomDoor(room, state, wall, position = -1) {
    const wantedDirection = wall === 'all' ? null
        : wall === 'north' ? 0
            : wall === 'south' ? 1
                : wall === 'west' ? 2 : 3;
    let secret = state === 'secret';
    let mask;
    if (state === 'random') {
        // lspo_door() calls rnddoor() once to derive only the temporary
        // `typ`/secret bit, but passes the original -1 mask to create_door(),
        // which performs the actual state selection.
        rn2(5);
        if (rn2(3) === 0) {
            if (rn2(5) === 0) {
                mask = D_ISOPEN;
            } else if (rn2(6) === 0) {
                mask = D_LOCKED;
            } else {
                mask = D_CLOSED;
            }
            if (mask !== D_ISOPEN && rn2(25) === 0)
                mask |= D_TRAPPED;
        } else {
            mask = D_NODOOR;
        }
    } else {
        mask = state === 'secret' ? D_NODOOR
            : state === 'nodoor' ? D_NODOOR
            : state === 'locked' ? D_LOCKED
                : state === 'open' ? D_ISOPEN : D_CLOSED;
    }
    let x = 0, y = 0;
    let found = false;
    for (let trycnt = 0; trycnt < 100; trycnt++) {
        const direction = rn2(4);
        if (wantedDirection != null && direction !== wantedDirection) continue;
        if (direction === 0) {
            y = room.ly - 1;
            x = room.lx + (position < 0
                ? rn2(1 + room.hx - room.lx) : position);
            if (!isok(x, y - 1) || IS_OBSTRUCTED(game.level.at(x, y - 1).typ))
                continue;
        } else if (direction === 1) {
            y = room.hy + 1;
            x = room.lx + (position < 0
                ? rn2(1 + room.hx - room.lx) : position);
            if (!isok(x, y + 1) || IS_OBSTRUCTED(game.level.at(x, y + 1).typ))
                continue;
        } else if (direction === 2) {
            x = room.lx - 1;
            y = room.ly + (position < 0
                ? rn2(1 + room.hy - room.ly) : position);
            if (!isok(x - 1, y) || IS_OBSTRUCTED(game.level.at(x - 1, y).typ))
                continue;
        } else {
            x = room.hx + 1;
            y = room.ly + (position < 0
                ? rn2(1 + room.hy - room.ly) : position);
            if (!isok(x + 1, y) || IS_OBSTRUCTED(game.level.at(x + 1, y).typ))
                continue;
        }
        if (okdoor(x, y)) {
            found = true;
            break;
        }
    }
    if (!found) return;
    const loc = game.level.at(x, y);
    if (!loc) return;
    loc.typ = secret ? SDOOR : DOOR;
    loc.doormask = mask;
}

export async function generateMinetown(active) {
    if (active?.variant < 1 || active?.variant > 7) {
        throw new RangeError(`unknown Minetown layout ${active?.variant}`);
    }
    active.file = `minetn-${active.variant}.lua`;
    game.level.flags.is_maze_lev = true;
    game.level.flags.has_town = true;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of game.level.rooms.slice(0, game.level.nroom))
        await fillSpecialRoom(room);
}

function isLuaQuestPrototype(prototype) {
    return /^[A-Z][a-z]{2}-(strt|loca|goal|fila|filb)$/.test(prototype);
}

async function generateLuaQuestLevel(active) {
    if (!isLuaQuestPrototype(active?.prototype))
        throw new RangeError(`unknown quest level ${active?.prototype}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of game.level.rooms.slice(0, game.level.nroom))
        await fillSpecialRoom(room);
}

export async function generateOracleLevel(active) {
    if (active?.prototype !== 'oracle')
        throw new RangeError(`unknown Oracle level ${active?.prototype}`);
    active.file = 'oracle.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function specialRectangularRoom(context, x1, y1, x2, y2, rtype, lit,
    needfill) {
    const room = add_room(
        context.xstart + x1, context.ystart + y1,
        context.xstart + x2, context.ystart + y2,
        lit, rtype, true,
    );
    room.needjoining = true;
    room.needfill = needfill;
    topologize(room);
    // sp_lev.c:add_doors_to_room() runs as soon as each Lua region closes.
    // For rectangular rooms inside_room() includes the one-cell perimeter,
    // so every mapped door in that ring is linked in x-major/y-minor order.
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const loc = game.level.at(x, y);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                add_door(x, y, room);
        }
    }
    return room;
}

async function specialShrinePriest(temple, altarX, altarY, altarAlignment,
    { sanctum = false } = {}) {
    const startDirection = rn2(8);
    let priestX = altarX, priestY = altarY;
    for (let offset = 0; offset < 8; offset++) {
        const direction = (startDirection + offset) % 8;
        const x = altarX + xdir[direction];
        const y = altarY + ydir[direction];
        const loc = game.level.at(x, y);
        if (loc && SPACE_POS(loc.typ)
            && !game.level.monsters?.some(monster => monster.mhp > 0
                && monster.mx === x && monster.my === y)) {
            priestX = x;
            priestY = y;
            break;
        }
    }

    const priest = await makemon(
        sanctum ? PM_HIGH_CLERIC : PM_ALIGNED_CLERIC,
        priestX, priestY, MM_EPRI,
    );
    if (!priest) return null;
    priest.ispriest = 1;
    priest.isminion = 0;
    priest.mpeaceful = 1;
    priest.msleeping = 0;
    priest.epri = {
        shroom: (temple?.roomnoidx ?? 0) + ROOMOFFSET,
        shralign: altarAlignment,
        shrpos: { x: altarX, y: altarY },
        shrlevel: { ...(game.u?.uz || {}) },
        parentmid: priest.m_id,
        intone_time: 0,
        enter_time: 0,
        peaceful_time: 0,
        hostile_time: 0,
    };
    priest.mtrapseen = 0x7fffffff;

    if (sanctum && altarAlignment === A_NONE) {
        const amulet = mksobj(AMULET_OF_YENDOR, true, false);
        addObjectToMonsterInventory(
            priest, amulet, game, { atFront: true },
        );
    }

    const spellbookCount = 2 + rn2(3);
    for (let count = 0; count < spellbookCount; count++) {
        const spellbook = mkobj(SPBOOK_no_NOVEL, false);
        addObjectToMonsterInventory(
            priest, spellbook, game, { atFront: true },
        );
    }
    // which_armor(W_ARMC) only mutates the generated robe or cloak; the
    // alignment-based curse/uncurse operation itself consumes no RNG.
    if (rn2(2)) {
        const cloak = priest.minvent.find(object => [
            ROBE, CLOAK_OF_PROTECTION, CLOAK_OF_MAGIC_RESISTANCE,
        ].includes(object.otyp));
        if (cloak) {
            const coaligned = altarAlignment !== A_NONE
                && game.u?.ualign?.type === altarAlignment;
            cloak.cursed = !coaligned;
            if (!coaligned) cloak.blessed = false;
        }
    }
    return priest;
}

function morgueMonsterType() {
    const roll = rn2(100);
    const hitDice = rn2(level_difficulty());
    if (hitDice > 10 && roll < 10) {
        // Non-Hell morgues may choose a neutral demon.
        return mkclass(56, 0);
    }
    if (hitDice > 8 && roll > 85) return mkclass(48, 0);
    if (roll < 20) return 287; // PM_GHOST
    if (roll < 40) return 230; // PM_WRAITH
    return mkclass(52, 0); // S_ZOMBIE
}

function makeToptenCorpse(x, y) {
    const body = mksobj_at(CORPSE, x, y, true, false);
    // get_rnd_toptenentry() first chooses one of ten score-table offsets.
    // With no usable entry, tt_oname() then falls back to a uniformly chosen
    // player role and forces the corpse identity to that role monster.
    rnd(10);
    const playerRole = 330 + rn2(13); // Archeologist through Wizard
    set_corpsenm(body, playerRole);
    return body;
}

async function fillMorgueRoom(room) {
    const entrance = room.doorct ? game.level.doors[room.fdoor] : null;
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = game.level.at(x, y);
            const entranceDistance = entrance
                ? Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y))
                : Infinity;
            const entranceEdge = entrance && (
                (x === room.lx && entrance.x === x - 1)
                || (x === room.hx && entrance.x === x + 1)
                || (y === room.ly && entrance.y === y - 1)
                || (y === room.hy && entrance.y === y + 1)
            );
            if (!loc) continue;
            if (room.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (room.doorct && entranceDistance <= 1)) continue;
            } else if (!SPACE_POS(loc.typ) || entranceEdge) continue;
            const monster = await makemon(
                morgueMonsterType(), x, y, MM_ASLEEP | MM_NOGRP,
            );
            if (monster) monster.msleeping = 1;
            if (!rn2(5)) makeToptenCorpse(x, y);
            if (!rn2(10))
                mksobj_at(rn2(3) ? LARGE_BOX : CHEST, x, y, true, false);
            if (!rn2(5)) make_grave(x, y, null);
        }
    }
    game.level.flags.has_morgue = true;
}

function specialMapRows(source) {
    const rows = source.split('\n');
    if (rows.at(-1) === '') rows.pop();
    return rows;
}

function fillSpecialLevel(options, active) {
    active.levelInitialized = true;
    if (options.style === 'mines') {
        const foreground = mapCharacterType(options.fg ?? '.');
        const background = mapCharacterType(options.bg ?? ' ');
        if (foreground === undefined || background === undefined)
            throw new Error('unknown Lua mines terrain');
        const lit = options.lit == null ? !!rn2(2) : !!options.lit;
        mkmap({
            lit,
            foreground,
            background,
            smoothed: options.smoothed ?? false,
            joined: options.joined ?? false,
            walled: options.walled ?? false,
            icedPools: !!active.icedPools,
        });
        active.defaultLit = lit;
        return {
            xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
        };
    }
    if (options.style === 'swamp') {
        const foreground = mapCharacterType(options.fg ?? '.');
        const background = mapCharacterType(options.bg ?? '}');
        if (foreground === undefined || background === undefined)
            throw new Error('unknown Lua swamp terrain');
        const lit = !!options.lit;
        fillSpecialSwamp(foreground, background, lit);
        active.defaultLit = lit;
        return {
            xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
        };
    }
    if (options.style === 'mazegrid') {
        const type = mapCharacterType(options.bg ?? '-');
        if (type === undefined)
            throw new Error(`unknown Lua map character ${options.bg}`);
        fillSpecialMazeGrid(type);
        active.defaultLit = false;
        return {
            xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
        };
    }
    if (options.style === 'maze') {
        createSpecialMaze(
            options.corrwid ?? -1,
            options.wallthick ?? -1,
            options.deadends === false,
        );
        active.defaultLit = false;
        return { xstart: 0, ystart: 0, width: 76, height: 19 };
    }
    if (options.style !== 'solidfill')
        throw new Error(`unsupported Lua level style ${options.style}`);
    const type = mapCharacterType(options.filling ?? options.fg ?? '.');
    if (type === undefined)
        throw new Error(`unknown Lua map character ${options.fg}`);
    active.defaultLit = options.lit == null ? !!rn2(2) : !!options.lit;
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            setLevelTerrainType(x, y, type);
            game.level.at(x, y).lit = active.defaultLit;
        }
    }
    return null;
}

function setLuaLevelFlags(active, flags) {
    for (const flag of flags) {
        if (flag === 'mazelevel') game.level.flags.is_maze_lev = true;
        else if (flag === 'noteleport') game.level.flags.noteleport = true;
        else if (flag === 'hardfloor') game.level.flags.hardfloor = true;
        else if (flag === 'nommap') game.level.flags.nommap = true;
        else if (flag === 'shortsighted') game.level.flags.shortsighted = true;
        else if (flag === 'arboreal') game.level.flags.arboreal = true;
        else if (flag === 'graveyard') game.level.flags.graveyard = true;
        else if (flag === 'corrmaze') game.level.flags.corrmaze = true;
        else if (flag === 'sokoban') game.level.flags.sokoban_rules = true;
        else if (flag === 'premapped') active.premapped = true;
        else if (flag === 'solidify') active.solidify = true;
        else if (flag === 'inaccessibles') active.checkInaccessibles = true;
        else if (flag === 'noflipx') active.allowFlips &= ~2;
        else if (flag === 'noflipy') active.allowFlips &= ~1;
        else if (flag === 'noflip') active.allowFlips = 0;
        else if (flag === 'temperate') game.level.flags.temperature = 0;
        else if (flag === 'hot') game.level.flags.temperature = 1;
        else if (flag === 'cold') game.level.flags.temperature = -1;
        else if (flag === 'nomongen') game.level.flags.rndmongen = false;
        else if (flag === 'nodeathdrops') game.level.flags.deathdrops = false;
        else if (flag === 'noautosearch') game.level.flags.noautosearch = true;
        else if (flag === 'fumaroles') game.level.flags.fumaroles = true;
        else if (flag === 'stormy') game.level.flags.stormy = true;
        else if (flag === 'icedpools') active.icedPools = true;
        else if (flag !== 'shroud')
            throw new Error(`unknown Lua level flag ${flag}`);
    }
}

function replaceLuaTerrain(context, options) {
    let selection = options.selection;
    if (!selection && Array.isArray(options.region)) {
        selection = specialSelectionFillRect(context, ...options.region);
    }
    if (!selection) {
        selection = specialSelectionFillRect(
            { xstart: 0, ystart: 0 }, 1, 0, COLNO - 1, ROWNO - 1,
        );
    }
    const fromType = mapCharacterType(options.fromterrain);
    const toType = mapCharacterType(options.toterrain);
    const fragment = fromType === undefined && options.mapfragment != null
        ? specialSelectionMatch(String(options.mapfragment)) : null;
    if ((!fragment && fromType === undefined) || toType === undefined)
        throw new Error('unknown Lua replacement terrain');
    const chance = options.chance ?? 100;
    const lit = options.lit ?? -2;
    selection.forEachXMajor((x, y) => {
        const loc = game.level.at(x, y);
        const matches = fragment
            ? fragment.has(x, y)
            : loc && match_maptyps(fromType, loc.typ);
        if (!matches || rn2(100) >= chance) return;
        setLevelTerrainLit(x, y, toType, lit);
        if (toType === IRONBARS || toType === HWALL) loc.horizontal = true;
    });
}

function createLuaFeature(context, { type, point }) {
    const types = {
        fountain: FOUNTAIN, sink: SINK, pool: POOL,
        throne: THRONE, tree: TREE,
    };
    const featureType = types[type];
    if (featureType === undefined)
        throw new Error(`unknown Lua feature ${type}`);
    if (point) {
        const loc = game.level.at(
            context.xstart + point.x, context.ystart + point.y,
        );
        if (loc) {
            loc.typ = featureType;
            if (featureType === FOUNTAIN) game.level.flags.nfountains++;
            else if (featureType === SINK) game.level.flags.nsinks++;
        }
        return;
    }
    if (specialFeatureOfType(context, featureType)) {
        if (featureType === FOUNTAIN) game.level.flags.nfountains++;
        else if (featureType === SINK) game.level.flags.nsinks++;
    }
}

function noncoalignedSpecialAlignment() {
    const original = game.u?.ualignbase?.[1]
        ?? game.u?.ualign?.type ?? A_NEUTRAL;
    const choice = rn2(2);
    if (original === A_NEUTRAL)
        return choice ? A_CHAOTIC : A_LAWFUL;
    return choice ? -original : A_NEUTRAL;
}

function luaSpecialAlignment(value = 'random') {
    if (value === 'noalign') return A_NONE;
    if (value === 'law') return A_LAWFUL;
    if (value === 'neutral') return A_NEUTRAL;
    if (value === 'chaos') return A_CHAOTIC;
    if (value === 'coaligned') {
        return game.u?.ualignbase?.[1]
            ?? game.u?.ualign?.type ?? A_NEUTRAL;
    }
    if (value === 'noncoaligned') return noncoalignedSpecialAlignment();
    if (value === 'random') return inducedAlignment(80);
    throw new Error(`unsupported Lua alignment ${value}`);
}

function specialRoomAt(x, y, roomType) {
    const roomNumber = game.level.at(x, y)?.roomno ?? 0;
    const direct = roomNumber >= ROOMOFFSET
        ? game.level.rooms?.[roomNumber - ROOMOFFSET] : null;
    if (direct?.rtype === roomType) return direct;
    return game.level.rooms
        ?.slice(0, game.level.nroom)
        .find(room => room?.rtype === roomType
            && x >= room.lx && x <= room.hx
            && y >= room.ly && y <= room.hy) ?? null;
}

function luaCoordinate(options) {
    if (Array.isArray(options.coord))
        return { x: options.coord[0], y: options.coord[1] };
    if (Number.isInteger(options.coord?.x)
        && Number.isInteger(options.coord?.y)) return options.coord;
    if (Number.isInteger(options.x) && Number.isInteger(options.y))
        return { x: options.x, y: options.y };
    return null;
}

async function createLuaAltar(context, options) {
    const coordinate = luaCoordinate(options);
    const point = coordinate
        ? {
            x: context.xstart + coordinate.x,
            y: context.ystart + coordinate.y,
        }
        : specialRandomLocation(context);
    if (!point) return;
    const altar = game.level.at(point.x, point.y);
    if (!altar || IS_FURNITURE(altar.typ)) return;
    const alignment = luaSpecialAlignment(options.align);
    altar.typ = ALTAR;
    altar.flags = Align2amask(alignment);
    const altarType = options.type ?? 'altar';
    if (!['altar', 'shrine', 'sanctum'].includes(altarType))
        throw new Error(`unsupported Lua altar type ${altarType}`);
    const temple = specialRoomAt(point.x, point.y, TEMPLE);
    if (!temple || altarType === 'altar') return;
    const sanctum = altarType === 'sanctum';
    await specialShrinePriest(
        temple, point.x, point.y, alignment, { sanctum },
    );
    altar.flags |= AM_SHRINE;
    if (sanctum) altar.flags |= AM_SANCTUM;
    game.level.flags.has_temple = true;
}

function luaRoomLighting(value) {
    if (value !== -1) return !!value;
    return rnd(1 + Math.abs(depth_of_level(game.u?.uz))) < 11
        && rn2(77) !== 0;
}

function luaRoomType(name = 'ordinary') {
    const roomTypes = {
        ordinary: OROOM,
        zoo: ZOO,
        beehive: BEEHIVE,
        morgue: MORGUE,
        barracks: BARRACKS,
        court: COURT,
        throne: COURT,
        swamp: SWAMP,
        temple: TEMPLE,
        delphi: DELPHI,
        themed: THEMEROOM,
        shop: SHOPBASE,
        'armor shop': SHOPBASE + 1,
        'scroll shop': SHOPBASE + 2,
        'potion shop': SHOPBASE + 3,
        'weapon shop': SHOPBASE + 4,
        'food shop': SHOPBASE + 5,
        'ring shop': SHOPBASE + 6,
        'wand shop': SHOPBASE + 7,
        'tool shop': SHOPBASE + 8,
        'book shop': SHOPBASE + 9,
        'health food shop': SHOPBASE + 10,
        'candle shop': SHOPBASE + 11,
    };
    const roomType = roomTypes[name];
    if (roomType == null)
        throw new Error(`unsupported Lua room type ${name}`);
    return roomType;
}

function luaRoomTable(room) {
    const names = new Map([
        [OROOM, 'ordinary'], [THEMEROOM, 'themed'], [COURT, 'throne'],
        [SWAMP, 'swamp'], [VAULT, 'vault'], [BEEHIVE, 'beehive'],
        [MORGUE, 'morgue'], [BARRACKS, 'barracks'], [ZOO, 'zoo'],
        [DELPHI, 'delphi'], [TEMPLE, 'temple'], [ANTHOLE, 'anthole'],
        [COCKNEST, 'cocknest'], [LEPREHALL, 'leprehall'],
    ]);
    const shopNames = [
        'shop', 'armor shop', 'scroll shop', 'potion shop', 'weapon shop',
        'food shop', 'ring shop', 'wand shop', 'tool shop', 'book shop',
        'health food shop', 'candle shop',
    ];
    const type = room.rtype >= SHOPBASE
        ? shopNames[room.rtype - SHOPBASE] : names.get(room.rtype);
    return objectToLuaTable({
        width: room.hx - room.lx + 1,
        height: room.hy - room.ly + 1,
        region: { x1: room.lx, y1: room.ly, x2: room.hx, y2: room.hy },
        lit: !!room.rlit,
        irregular: !!room.irregular,
        needjoining: !!room.needjoining,
        type: type ?? 'ordinary',
    });
}

function createLuaRoomRegion(context, options) {
    const region = Array.isArray(options.region)
        ? options.region
        : [options.x1, options.y1, options.x2, options.y2];
    if (!region.every(Number.isInteger))
        throw new TypeError('des.region requires four coordinates');
    const roomType = luaRoomType(options.type);
    const lit = luaRoomLighting(options.lit ?? -1);
    if (roomType === OROOM && !options.irregular && !options.arrival_room) {
        lightSpecialArea(context, ...region, lit);
        return null;
    }
    const needFill = options.filled ?? 0;
    const room = options.irregular
        ? specialIrregularRoom(
            context, region[0], region[1],
            roomType, lit, needFill,
        )
        : specialRectangularRoom(
            context, ...region, roomType, lit, needFill,
        );
    if (room && options.arrival_room) room.arrival_room = true;
    return room;
}

function luaRoomSpec(options) {
    const coordinate = luaCoordinate(options);
    const xalign = {
        left: 1, 'half-left': 2, center: 3, 'half-right': 4, right: 5,
        none: -1, random: -1,
    }[options.xalign ?? 'random'];
    const yalign = {
        top: 1, center: 3, bottom: 5, none: -1, random: -1,
    }[options.yalign ?? 'random'];
    if (xalign == null || yalign == null)
        throw new Error('unsupported Lua room alignment');
    return {
        ...options,
        x: coordinate?.x ?? -1,
        y: coordinate?.y ?? -1,
        rtype: luaRoomType(options.type),
        xalign,
        yalign,
    };
}

function createLuaStair(context, { direction, point }) {
    const up = direction === 'up';
    if (point) specialStairAt(context, point.x, point.y, up);
    else specialStair(context, up);
}

function createLuaDoor(context, {
    state, point, wall = 'all', pos = -1,
}) {
    if (!point) {
        if (!context?._room)
            throw new TypeError('des.door without coordinates needs a room');
        return createSpecialRoomDoor(context._room, state, wall, pos);
    }
    if (state === 'random')
        return specialRandomDoorAt(context, point.x, point.y);
    const masks = {
        nodoor: D_NODOOR,
        broken: D_BROKEN,
        open: D_ISOPEN,
        closed: D_CLOSED,
        locked: D_LOCKED,
    };
    if (state === 'secret') {
        const door = specialDoorAt(context, D_CLOSED, point.x, point.y);
        const loc = door && game.level.at(door.x, door.y);
        if (loc) loc.typ = SDOOR;
        return door;
    }
    if (!(state in masks)) throw new Error(`unknown Lua door state ${state}`);
    return specialDoorAt(context, masks[state], point.x, point.y);
}

function createLuaDrawbridge(context, options) {
    const coordinate = luaCoordinate(options);
    if (!coordinate)
        throw new TypeError('des.drawbridge requires coordinates');
    const directions = {
        north: DB_NORTH, south: DB_SOUTH,
        east: DB_EAST, west: DB_WEST,
    };
    const direction = options.dir === 'random' || options.dir == null
        ? [DB_NORTH, DB_SOUTH, DB_WEST, DB_EAST][rn2(4)]
        : directions[options.dir];
    if (direction == null)
        throw new Error(`unknown Lua drawbridge direction ${options.dir}`);
    const open = options.state === 'random' || options.state == null
        ? !rn2(2) : options.state === 'open';
    if (!['open', 'closed', 'random', undefined].includes(options.state))
        throw new Error(`unknown Lua drawbridge state ${options.state}`);
    makeSpecialDrawbridge(
        context, coordinate.x, coordinate.y, direction, open,
    );
}

function createLuaEngraving(context, options) {
    const point = options.point
        ? {
            x: context.xstart + options.point.x,
            y: context.ystart + options.point.y,
        }
        : specialRandomLocation(context);
    if (!point) return null;
    const types = {
        dust: DUST,
        engrave: ENGRAVE,
        burn: BURN,
        mark: MARK,
        blood: ENGR_BLOOD,
    };
    const type = types[options.type];
    if (type == null)
        throw new Error(`unknown Lua engraving type ${options.type}`);
    return make_engr_at(
        point.x, point.y, options.text, null, 0, type,
        {
            nowipeout: options.degrade === false,
            guardobjects: !!options.guardobjects,
        },
    );
}

function createLuaGold(context, options) {
    const point = options.point
        ? {
            x: context.xstart + options.point.x,
            y: context.ystart + options.point.y,
        }
        : specialRandomLocation(context);
    if (!point) return null;
    const amount = (options.amount ?? -1) < 0
        ? rnd(200) : options.amount;
    return mkgold(amount, point.x, point.y);
}

async function createLuaObject(
    context, options, parentContainer, parentMonster, invokeContents,
) {
    const { point, objectClass, objectType } = options;
    let object;
    const randomMedusaStatue = objectType === STATUE
        && game._activeSpecialLevel?.prototype === 'medusa'
        && options.montype == null;
    if (randomMedusaStatue) {
        object = await medusaEmptyStatue(context, point);
    } else if (objectType != null) {
        object = point
            ? specialObjectAt(
                context, objectType, point.x, point.y,
                { named: !!options.name },
            )
            : specialObjectOfType(context, objectType);
    } else if (objectClass != null) {
        object = point
            ? specialObjectClassAt(context, objectClass, point.x, point.y)
            : specialObjectOfClass(context, objectClass);
    } else {
        object = point
            ? specialRandomObjectAt(context, point.x, point.y)
            : specialObject(context);
    }
    if (!object) return null;

    if (options.buc === 'blessed') {
        object.blessed = true;
        object.cursed = false;
    } else if (options.buc === 'uncursed') {
        object.blessed = false;
        object.cursed = false;
    } else if (options.buc === 'cursed') {
        object.blessed = false;
        object.cursed = true;
    } else if (options.buc === 'not-cursed') {
        object.cursed = false;
    } else if (options.buc === 'not-uncursed') {
        blessorcurse(object, 1);
    } else if (options.buc === 'not-blessed') {
        object.blessed = false;
    }
    if (Number.isInteger(options.spe)) object.spe = options.spe;
    if (options.spinachTin) {
        object.corpsenm = -1;
        object.spe = 1;
    }
    if (options.eroded) {
        if (options.eroded < 0) {
            object.oerodeproof = true;
        } else {
            object.oeroded = options.eroded % 4;
            object.oeroded2 = (options.eroded >> 2) % 4;
        }
    } else {
        object.oeroded = 0;
        object.oeroded2 = 0;
        object.oerodeproof = false;
    }
    if (options.recharged)
        object.recharged = options.recharged % 8;
    if (Object.hasOwn(options, 'trapped'))
        object.otrapped = !!options.trapped;
    if (Object.hasOwn(options, 'locked')) object.olocked = !!options.locked;
    else if (options.broken) {
        object.obroken = true;
        object.olocked = false;
    }
    if (options.trapped && Object.hasOwn(options, 'tknown'))
        object.tknown = !!options.tknown;
    object.greased = !!options.greased;
    if (options.monsterType != null)
        set_corpsenm(object, options.monsterType);
    else if (options.monsterClass != null)
        set_corpsenm(object, mkclass(
            options.monsterClass, G_NOGEN | G_IGNORE,
        ));
    if (object.otyp === STATUE || object.otyp === CORPSE) {
        object.spe = (options.historic ? CORPSTAT_HISTORIC : 0)
            | (options.male ? CORPSTAT_MALE : 0)
            | (options.female ? CORPSTAT_FEMALE : 0);
    }
    if (options.name) {
        const artifact = artifactByName(options.name);
        if (artifact?.baseType === object.otyp) {
            if (nameArtifact(object, artifact) && artifact.questArtifact)
                object.questArtifact = true;
        } else {
            object.oextra = {
                ...(object.oextra || {}), oname: String(options.name),
            };
        }
    }
    if (Number.isInteger(options.quantity) && options.quantity > 0
        && OBJECT_MERGE[object.otyp]) {
        object.quan = object.quantity = options.quantity;
        object.owt = objectWeight(object);
    }
    if (options.achievement) {
        object.achievement = true;
        object.nomerge = true;
        if (!game.context) game.context = {};
        if (!game.context.achieveo) game.context.achieveo = {};
        const prototype = game._activeSpecialLevel?.prototype;
        const prefix = prototype === 'minend' ? 'mines'
            : prototype === 'soko1' ? 'soko' : null;
        if (prefix && !game.context.achieveo[`${prefix}_prize_oid`]) {
            game.context.achieveo[`${prefix}_prize_oid`] = object.o_id;
            game.context.achieveo[`${prefix}_prize_otyp`] = object.otyp;
        }
    }
    if (Object.hasOwn(options, 'contents')) object.contents = [];
    if (parentContainer) {
        addToContainer(parentContainer, object);
        parentContainer.owt = objectWeight(parentContainer);
    } else if (parentMonster) {
        removeFloorObject(object);
        if (object.otyp !== SADDLE
            || !putSaddleOnMonster(object, parentMonster))
            addObjectToMonsterInventory(parentMonster, object, game);
    } else {
        if (options.lit) beginObjectBurn(object);
        if (options.buried && buryFloorObject(object) === null) object = null;
    }
    if (!object) return null;
    if (options.contents && typeof options.contents === 'object')
        await invokeContents(options.contents, object);
    return object;
}

function applyLuaMonsterAppearance(monster, appearance) {
    if (!monster || !appearance) return;
    if (appearance.kind === 'object') {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = appearance.type;
        return;
    }
    if (appearance.kind === 'monster') {
        monster.m_ap_type = M_AP_MONSTER;
        monster.mappearance = appearance.type;
        return;
    }
    const terrain = {
        fountain: FOUNTAIN,
        'staircase down': STAIRS,
    }[appearance.name];
    if (appearance.kind !== 'terrain' || terrain == null)
        throw new Error(`unsupported Lua monster appearance ${appearance.name}`);
    monster.m_ap_type = M_AP_FURNITURE;
    monster.mappearance = terrain;
}

async function createLuaMonster(context, options) {
    const { point, monsterClass, monsterType } = options;
    const peaceful = options.peaceful == null ? null : !!options.peaceful;
    const asleep = options.asleep == null ? null : !!options.asleep;
    let mmflags = 0;
    if (options.tail === false) mmflags |= MM_NOTAIL;
    if (options.group === false) mmflags |= MM_NOGRP;
    if (options.adjacentok) mmflags |= MM_ADJACENTOK;
    if (options.ignorewater) mmflags |= MM_IGNOREWATER;
    if (options.countbirth === false) mmflags |= MM_NOCOUNTBIRTH;
    const explicitAlignment = options.align != null
        && options.align !== 'random';
    const creation = explicitAlignment ? {
        randomAlignment: false,
        mmflags: mmflags | MM_ADJACENTOK | MM_EMIN | MM_NOMSG,
        roamerAlignment: () => luaSpecialAlignment(options.align),
    } : { mmflags };
    let monster;
    if (monsterType != null) {
        const settings = {
            randomGender: options.nameFemale == null
                && namedMonsterNeedsGenderDraw(monsterType),
            peaceful,
            asleep,
            ...creation,
        };
        monster = point
            ? await specialMonsterAt(
                context, monsterType, point.x, point.y, settings,
            )
            : await specialExplicitMonster(
                context, monsterType, null, settings,
            );
        if (monster && options.nameFemale != null)
            monster.female = options.nameFemale;
    } else if (monsterClass != null) {
        monster = point
            ? await specialMonsterClassAt(
                context, monsterClass, point.x, point.y,
                null, { peaceful, asleep, ...creation },
            )
            : await specialMonsterOfClass(
                context, monsterClass, { peaceful, asleep, ...creation },
            );
    } else {
        monster = point
            ? await specialRandomMonsterAt(
                context, point.x, point.y,
                { peaceful, asleep, ...creation },
            )
            : await specialMonster(context, {
                peaceful, asleep, ...creation,
            });
    }
    applyLuaMonsterAppearance(monster, options.appearance);
    if (monster && options.name != null)
        monster.name = String(options.name);
    if (monster && options.waiting) {
        monster.mstrategy = (monster.mstrategy ?? 0) | STRAT_WAITFORU;
        monster.waiting = true;
        if (monster.cham === PM_VAMPIRE_LEADER
            && monster.mnum !== PM_VAMPIRE_LEADER
            && options.appearance?.kind !== 'monster') {
            shapechangeMonster(monster, PM_VAMPIRE_LEADER);
        }
    }
    if (monster && options.seentraps)
        monster.mtrapseen = options.seentraps;
    if (monster && options.cancelled) monster.mcan = 1;
    if (monster && options.revived) monster.mrevived = 1;
    if (monster && options.avenge) monster.mavenge = 1;
    if (monster && options.stunned) monster.mstun = 1;
    if (monster && options.confused) monster.mconf = 1;
    if (monster && options.invisible)
        monster.minvis = monster.perminvis = 1;
    if (monster && options.blinded) {
        monster.mcansee = 0;
        monster.mblinded = options.blinded % 127;
    }
    if (monster && options.paralyzed) {
        monster.mcanmove = 0;
        monster.mfrozen = options.paralyzed % 127;
    }
    if (monster && options.fleeing) {
        monster.mflee = 1;
        monster.mfleetim = options.fleeing % 127;
    }
    if (monster && options.m_lev_adj) {
        monster.m_lev = Math.max(
            0, Math.min(49, monster.m_lev + options.m_lev_adj),
        );
    }
    if (monster && peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null) monster.msleeping = asleep ? 1 : 0;
    return monster;
}

async function createLuaTrap(context, options) {
    const { trapType, point } = options;
    const construction = {
        seen: !!options.seen,
        victim: options.victim !== false,
        spiderOnWeb: options.spider_on_web !== false,
    };
    let trap;
    if (trapType == null) {
        trap = await specialTrap(context, construction);
    } else if (point) {
        trap = await specialTrapAt(
            context, trapType, point.x, point.y, construction,
        );
    } else {
        trap = await specialTrapOfType(context, trapType, construction);
    }
    const teleportDestination = luaCoordinate({ coord: options.teledest });
    if (trap && teleportDestination) {
        trap.teledest = {
            x: context.xstart + teleportDestination.x,
            y: context.ystart + teleportDestination.y,
        };
    }
    return trap;
}

function createLuaExclusion(context, options) {
    const validTypes = new Set([
        'teleport', 'teleport-up', 'teleport-down', 'monster-generation',
    ]);
    const type = options.type ?? 'teleport';
    if (!validTypes.has(type))
        throw new Error(`unsupported Lua exclusion ${type}`);
    const region = regionCoordinates(
        context, options.region, options.region_islev,
    );
    game.level.exclusionZones.push({ type, ...region });
}

function solidifyLuaMap(mappedCells) {
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = game.level.at(x, y);
            if (IS_STWALL(location?.typ) && !mappedCells.has(x, y))
                location.wall_info |= W_NONDIGGABLE | W_NONPASSWALL;
        }
    }
}

function flipLuaRegions(active) {
    for (const field of [
        'upTeleportRegion', 'upTeleportExclude',
        'downTeleportRegion', 'downTeleportExclude',
        'explicitUpStairRegion', 'explicitDownStairRegion',
        'explicitBranchRegion', 'explicitBranchExclude',
        'explicitPortalRegion', 'explicitPortalExclude',
    ]) active[field] = flipSpecialRegion(active[field]);
}

function accessibleSpecialTerrain(x, y) {
    const type = game.level.at(x, y)?.typ;
    return ACCESSIBLE(type) || type === SDOOR || type === SCORR;
}

function floodAccessibleArea(selection, x, y) {
    selection.floodFill(x, y, true, accessibleSpecialTerrain);
}

async function addWayOut(x, y, reachable) {
    const component = new SpecialSelection();
    floodAccessibleArea(component, x, y);

    const doorCandidates = component.clone();
    for (let point = doorCandidates.randomCoordinate(true); point;
        point = doorCandidates.randomCoordinate(true)) {
        for (const [wallX, wallY, beyondX, beyondY] of [
            [point.x + 1, point.y, point.x + 2, point.y],
            [point.x - 1, point.y, point.x - 2, point.y],
            [point.x, point.y + 1, point.x, point.y + 2],
            [point.x, point.y - 1, point.x, point.y - 2],
        ]) {
            if (!isok(wallX, wallY) || reachable.has(wallX, wallY)
                || !IS_WALL(game.level.at(wallX, wallY)?.typ)
                || !isok(beyondX, beyondY) || !reachable.has(beyondX, beyondY)
                || !ACCESSIBLE(game.level.at(beyondX, beyondY)?.typ)) continue;
            game.level.at(wallX, wallY).typ = SDOOR;
            return;
        }
    }

    if (canFallThrough()) {
        const trapCandidates = component.clone();
        for (let point = trapCandidates.randomCoordinate(true); point;
            point = trapCandidates.randomCoordinate(true)) {
            const trap = await maketrap(
                point.x, point.y, rn2(2) ? HOLE : TRAPDOOR,
            );
            if (trap) return;
        }
    }

    const point = component.randomCoordinate();
    if (!point) return;
    const escapeItems = [
        PICK_AXE, DWARVISH_MATTOCK, WAN_DIGGING,
        WAN_TELEPORTATION, SCR_TELEPORTATION, RIN_TELEPORTATION,
    ];
    mksobj_at(escapeItems[rn2(escapeItems.length)], point.x, point.y, true, false);
}

async function ensureWaysOut() {
    const reachable = new SpecialSelection();
    const currentDungeon = game.u?.uz?.dnum ?? 0;
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.tolev?.dnum === currentDungeon)
            floodAccessibleArea(reachable, stair.sx, stair.sy);
    }
    for (const trap of game.level.traps || []) {
        if ((trap.ttyp === MAGIC_PORTAL
            || trap.ttyp === VIBRATING_SQUARE
            || is_hole(trap.ttyp))
            && !reachable.has(trap.tx, trap.ty)) {
            floodAccessibleArea(reachable, trap.tx, trap.ty);
        }
    }

    for (;;) {
        let unreachable = null;
        for (let x = 1; x < COLNO && !unreachable; x++) {
            for (let y = 0; y < ROWNO; y++) {
                if (ACCESSIBLE(game.level.at(x, y)?.typ)
                    && !reachable.has(x, y)) {
                    unreachable = { x, y };
                    break;
                }
            }
        }
        if (!unreachable) return;
        await addWayOut(unreachable.x, unreachable.y, reachable);
        floodAccessibleArea(reachable, unreachable.x, unreachable.y);
    }
}

function luaObjectValue(object) {
    if (!object) return null;
    const rawObject = value => value instanceof LuaUserdata
        ? value.value : value;
    return new LuaUserdata(object, {
        __index: {
            addcontent: (self, value) => addToContainer(
                rawObject(self), rawObject(value),
            ),
            class: self => objectToLuaTable({
                material: OBJECT_MATERIAL[rawObject(self).otyp] === 19
                    ? 'glass' : 'other',
            }),
            start_timer: (self, kind, timeout) => scheduleObjectTimer(
                rawObject(self), String(kind),
                (game.moves ?? 0) + Number(timeout), game,
            ),
            stop_timer: (self, kind) => stopObjectTimer(
                rawObject(self), String(kind),
            ),
            totable: self => objectToLuaTable({
                ox: rawObject(self).ox,
                oy: rawObject(self).oy,
            }),
        },
    });
}

function newLuaObject(name) {
    const type = objectTypeForName(String(name));
    rn2((OBJECT_PROB[type] || 0) + 1);
    return luaObjectValue(mksobj(type, true, false));
}

function createLuaLevelSession() {
    const wholeLevel = {
        xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
    };
    let active = null;
    let context = wholeLevel;
    let luaState = null;
    const containers = [];
    const monsterInventories = [];
    const mappedContexts = [];
    let mappedCells = new SpecialSelection();
    let roomFailed = false;
    const invokeObjectContents = async (callback, object) => {
        containers.push(object);
        try {
            await luaState.callValueAsync(callback, [luaObjectValue(object)]);
        } finally {
            containers.pop();
        }
    };
    const operations = {
        levelInit: options => {
            const initializedContext = fillSpecialLevel(options, active);
            if (initializedContext) {
                context = initializedContext;
                active.context = context;
            }
        },
        levelFlags: flags => setLuaLevelFlags(active, flags),
        message: value => {
            if (!active.specialMessages) active.specialMessages = [];
            const originalAlignment = game.u?.ualignbase?.[0]
                ?? game.u?.ualign?.type ?? A_NONE;
            const godKey = originalAlignment > 0 ? 'lawful'
                : originalAlignment < 0 ? 'chaotic' : 'neutral';
            const deity = game.urole?.gods?.[godKey] || 'your god';
            active.specialMessages.push(String(value).replaceAll('%d', deity));
        },
        map: async value => {
            const rows = specialMapRows(
                typeof value === 'string' ? value : value.map,
            );
            const width = Math.max(...rows.map(row => row.length));
            const unplacedThemedMap = active.prototype === 'themerms'
                && typeof value !== 'string'
                && value.x == null && value.y == null
                && value.coord == null
                && value.halign == null && value.valign == null;
            let mapContext;
            if (unplacedThemedMap) {
                mapContext = placeThemedMap(rows);
                if (!mapContext) {
                    roomFailed = true;
                    return new SpecialSelection();
                }
            } else {
                const origin = typeof value === 'string'
                    ? centeredSpecialMap(width, rows.length)
                    : mapOrigin(
                        value, width, rows.length, active.levelInitialized,
                    );
                mapContext = loadSpecialAsciiMap(
                    rows,
                    typeof value === 'string'
                        ? active.defaultLit : !!value.lit,
                    origin,
                );
            }
            mappedContexts.push(mapContext);
            const mapSelection = specialMapSelection(mapContext, rows);
            mappedCells = mappedCells.union(mapSelection);
            context = mapContext;
            active.context = context;
            if (typeof value !== 'string' && value.contents) {
                try {
                    await luaState.callValueAsync(value.contents, [
                        objectToLuaTable({
                            width: context.width, height: context.height,
                        }),
                    ]);
                } finally {
                    context = wholeLevel;
                    active.context = context;
                }
            }
            return mapSelection;
        },
        terrain: (selection, character, lit = -2) => {
            const type = mapCharacterType(character);
            if (type === undefined)
                throw new Error(`unknown Lua terrain ${character}`);
            specialSelectionTerrain(selection, type, lit ?? -2);
        },
        terrainAt: (x, y, character, lit = -2) => {
            const type = mapCharacterType(character);
            if (type === undefined)
                throw new Error(`unknown Lua terrain ${character}`);
            setLevelTerrainLit(
                context.xstart + x, context.ystart + y, type, lit ?? -2,
            );
        },
        replaceTerrain: options => replaceLuaTerrain(context, options),
        region: (selection, lighting) => {
            const lit = lighting === 'lit';
            const area = lit ? selection.grow() : selection;
            area.forEachXMajor((x, y) => {
                const loc = game.level.at(x, y);
                if (loc) loc.lit = lit;
            });
        },
        roomRegion: async options => {
            if (roomFailed) return null;
            const room = createLuaRoomRegion(context, options);
            if (!room || !options.contents) return room;
            const parent = context;
            context = specialRoomContext(room);
            try {
                await luaState.callValueAsync(options.contents, [
                    luaRoomTable(room),
                ]);
            } finally {
                context = parent;
            }
            addDoorsToSpecialRoom(room);
            return room;
        },
        room: async options => {
            if (roomFailed) return null;
            const parent = context;
            const room = await buildSpecialRoom(
                luaRoomSpec(options), context._room ?? null,
                options.contents ? async builtRoom => {
                    context = specialRoomContext(builtRoom);
                    try {
                        await luaState.callValueAsync(options.contents, [
                            luaRoomTable(builtRoom),
                        ]);
                    } finally {
                        context = parent;
                    }
                } : null,
            );
            if (!room && active.prototype === 'themerms') roomFailed = true;
            context = parent;
            return room;
        },
        stair: options => createLuaStair(context, options),
        ladder: options => {
            const up = options.direction === 'up';
            if (!options.point)
                throw new TypeError('des.ladder requires coordinates');
            specialLadderAt(
                context, options.point.x, options.point.y, up,
            );
        },
        door: options => createLuaDoor(context, options),
        drawbridge: options => createLuaDrawbridge(context, options),
        engraving: options => createLuaEngraving(context, options),
        gold: options => createLuaGold(context, options),
        feature: options => createLuaFeature(context, options),
        altar: options => createLuaAltar(context, options),
        nonDiggable: selection => selection
            ? specialSelectionNonDiggable(selection)
            : specialNonDiggable(),
        nonPasswall: selection => selection
            ? markSpecialSelectionWallProperty(selection, W_NONPASSWALL)
            : specialNonPasswall(context),
        wallify: () => wallifyMap(
            context.xstart - 1,
            context.ystart - 1,
            context.xstart + context.width + 1,
            context.ystart + context.height + 1,
        ),
        teleportRegion: options => {
            const region = regionCoordinates(
                context, options.region, options.region_islev,
            );
            const exclude = options.exclude
                ? regionCoordinates(
                    context, options.exclude, options.exclude_islev,
                )
                : null;
            if (options.dir === 'up') {
                active.upTeleportRegion = region;
                active.upTeleportExclude = exclude;
            } else if (options.dir === 'down') {
                active.downTeleportRegion = region;
                active.downTeleportExclude = exclude;
            } else {
                active.upTeleportRegion = { ...region };
                active.downTeleportRegion = { ...region };
                active.upTeleportExclude = exclude ? { ...exclude } : null;
                active.downTeleportExclude = exclude ? { ...exclude } : null;
            }
        },
        levelRegion: options => {
            const region = regionCoordinates(
                context, options.region, options.region_islev,
            );
            const exclude = options.exclude
                ? regionCoordinates(
                    context, options.exclude, options.exclude_islev,
                )
                : null;
            const value = {
                ...region,
                ...(exclude ? {
                    nlx: exclude.lx, nly: exclude.ly,
                    nhx: exclude.hx, nhy: exclude.hy,
                } : {}),
            };
            if (options.type === 'stair-up')
                active.explicitUpStairRegion = value;
            else if (options.type === 'stair-down')
                active.explicitDownStairRegion = value;
            else if (options.type === 'branch') {
                active.explicitBranchRegion = region;
                active.explicitBranchExclude = exclude;
            }
            else if (options.type === 'portal') {
                active.explicitPortalRegion = region;
                active.explicitPortalExclude = exclude;
                active.portalDestinationName = options.name;
            }
            else throw new Error(`unsupported Lua level region ${options.type}`);
        },
        exclusion: options => createLuaExclusion(context, options),
        gasCloud: options => createHarmlessGasCloudSelection(
            game, luaSelectionCoordinates(options.selection), { ttl: -1 },
        ),
        randomCorridors: () => makecorridors(),
        mazeWalk: async options => {
            const directions = ['north', 'south', 'east', 'west'];
            const direction = options.dir === 'random'
                ? directions[rn2(directions.length)] : options.dir;
            specialMazeWalk(
                context, options.x, options.y, direction,
                mapCharacterType(options.typ ?? '.'),
            );
            if (options.stocked)
                await fillEmptySpecialMaze(context, mappedContexts);
        },
        object: async options => luaObjectValue(await createLuaObject(
            context,
            options,
            containers.at(-1) ?? null,
            monsterInventories.at(-1) ?? null,
            invokeObjectContents,
        )),
        trap: options => createLuaTrap(context, options),
        monster: async options => {
            const monster = await createLuaMonster(context, options);
            if (monster && (options.inventory
                || options.keep_default_invent === false)
                && options.keep_default_invent !== true)
                discardSpecialMonsterInventory(monster);
            if (options.inventory) {
                monsterInventories.push(monster);
                try {
                    await luaState.callValueAsync(options.inventory, []);
                } finally {
                    monsterInventories.pop();
                }
                if (monster) initializeMonsterArmor(monster);
            }
            return monster;
        },
    };
    const selectionApi = createSelectionApi(
        () => context,
        (callable, args) => luaState.callValueAsync(callable, args),
    );
    const bindings = {
        nh: {
            debug_themerm: () => null,
            impossible: message => {
                throw new Error(String(message));
            },
            is_genocided: name => {
                const target = String(name).toLowerCase();
                const mndx = MONSTER_NAME.findIndex(candidate =>
                    candidate?.toLowerCase() === target);
                return mndx >= 0
                    && !!((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GENOD);
            },
            level_difficulty: () => level_difficulty(),
            start_timer_at: (x, y, kind, timeout) => {
                const timerKind = String(kind) === 'melt-ice'
                    ? LEVEL_TIMER_KIND.MELT_ICE_AWAY : String(kind);
                return scheduleLevelTimer(
                    context.xstart + Number(x),
                    context.ystart + Number(y),
                    timerKind,
                    (game.moves ?? 0) + Number(timeout),
                    game,
                );
            },
        },
        des: createDesBindings(operations, selectionApi.wrap),
        obj: { new: name => newLuaObject(name) },
        selection: selectionApi.bindings,
    };
    return {
        bindings,
        beginLevel(nextActive, { special = true } = {}) {
            active = nextActive;
            context = wholeLevel;
            containers.length = 0;
            monsterInventories.length = 0;
            mappedContexts.length = 0;
            mappedCells = new SpecialSelection();
            roomFailed = false;
            active.allowFlips = 3;
            if (!special) return;
            game.level.flags.is_special = true;
            const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
            game.level.flags.temperature = currentDungeon?.flags?.hellish
                ? 1 : 0;
        },
        bindState(state) {
            luaState = state;
            active.align = luaTableToArray(state.getGlobal('align'));
        },
        beginRoom() {
            roomFailed = false;
            context = wholeLevel;
        },
        roomFailed() {
            return roomFailed;
        },
        async finishSpecialLevel() {
            if (active.checkInaccessibles) await ensureWaysOut();
            if (!game.level.flags.corrmaze)
                wallification(1, 0, COLNO - 1, ROWNO - 1);
            flipSpecialLevelRandom(active.allowFlips);
            if (active.solidify) solidifyLuaMap(mappedCells);
            flipLuaRegions(active);
        },
    };
}

async function generateLuaSpecialLevel(active) {
    const session = createLuaLevelSession();
    session.beginLevel(active);
    await currentLuaLifecycle().executeSpecial(
        game, active.file, session.bindings,
        state => session.bindState(state),
    );
    await session.finishSpecialLevel();
}

const themedLuaSessions = new WeakMap();
const activeThemes = new WeakMap();

async function beginLuaThemerooms() {
    const lifecycle = currentLuaLifecycle();
    const dungeonNumber = game.u?.uz?.dnum ?? 0;
    let state = lifecycle.getThemedState(game, dungeonNumber);
    let session = state ? themedLuaSessions.get(state) : null;
    const active = { prototype: 'themerms', file: 'themerms.lua' };

    if (!session) {
        session = createLuaLevelSession();
        session.beginLevel(active, { special: false });
        state = lifecycle.createThemedState(
            game, dungeonNumber, 'themerms.lua', session.bindings,
            created => session.bindState(created),
        );
        themedLuaSessions.set(state, session);
    } else {
        lifecycle.refreshUser(state, game);
        session.beginLevel(active, { special: false });
    }

    activeThemes.set(game, { state, session });
    await state.callValueAsync(state.getGlobal('pre_themerooms_generate'), []);
}

async function callLuaThemerooms(name, args = []) {
    const state = activeThemes.get(game)?.state;
    if (!state) throw new Error('themed rooms are not active');
    return state.callValueAsync(state.getGlobal(name), args);
}

async function specialRandomMonsterAt(context, x, y, {
    randomAlignment = true,
    peaceful = null,
    asleep = null,
    mmflags = 0,
    roamerAlignment = null,
} = {}) {
    // A coordinate-only des.monster() resolves random alignment before
    // makemon(NULL, x, y).  Unlike a named species, it has no find_montype()
    // gender draw and unlike des.monster() without coordinates it performs no
    // get_location() sampling.
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const absoluteX = context.xstart + x;
    const absoluteY = context.ystart + y;
    const occupied = game.level.monsters?.some(monster => monster.mhp > 0
        && monster.mx === absoluteX && monster.my === absoluteY);
    const monster = occupied
        ? await makemonNear(null, absoluteX, absoluteY, mmflags)
        : await makemon(null, absoluteX, absoluteY, mmflags);
    if (monster && peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null) monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}

export async function generateBigRoom(active) {
    if (active?.variant < 1 || active?.variant > 13)
        throw new RangeError(`unknown Big Room variant ${active?.variant}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function removeFloorObject(object) {
    const pile = game.level.objects?.[object?.ox]?.[object?.oy];
    const index = pile?.indexOf(object) ?? -1;
    if (index >= 0) pile.splice(index, 1);
}

function addToContainer(container, object) {
    if (!container || !object) return object;
    removeFloorObject(object);
    if (!container.contents) container.contents = [];
    const existing = container.contents.find(candidate =>
        objectsMergable(candidate, object, game));
    if (existing) return mergeObjectStacks(existing, object, game);
    object.where = 'contained';
    object.container = container;
    object.ox = object.oy = 0;
    container.contents.unshift(object);
    return object;
}

function addBuriedObject(object, x, y) {
    if (!object) return object;
    removeFloorObject(object);
    object.where = 'buried';
    object.buried = true;
    object.ox = x;
    object.oy = y;
    if (!game.level.buriedObjects) game.level.buriedObjects = [];
    game.level.buriedObjects.unshift(object);
    updateCorpseIceTimer(object, x, y, game.level.at(x, y)?.typ === ICE);
    return object;
}

function consumeSpecialMonsterAlignment() {
    inducedAlignment(80);
}

function namedMonsterNeedsGenderDraw(mndx) {
    const flags = MONSTER_FLAGS2[mndx] || 0;
    // sp_lev.c:find_montype() suppresses the parser draw only for explicitly
    // male or female species.  A neuter species still resolves rn2(2), even
    // though makemon() later stores the neutral gender independently.
    return !(flags & (0x10000 | 0x20000));
}

function medusaPetrifiable(mndx) {
    const stoneResistant = !!((MONSTER_RESISTS[mndx] || 0) & 0x80);
    const changesToStoneGolem = MONSTER_SYMBOL[mndx] === 55 && mndx !== 257;
    return !stoneResistant && !changesToStoneGolem;
}

async function medusaEmptyStatue(context, fixedPoint = null) {
    const point = fixedPoint
        ? {
            x: context.xstart + fixedPoint.x,
            y: context.ystart + fixedPoint.y,
        }
        : specialRandomLocation(context);
    if (!point) return null;
    const statue = mksobj_at(STATUE, point.x, point.y, true, true);
    // `contents=0` removes any randomly initialized spellbook before the
    // Medusa petrified-monster special case creates the temporary actor.
    statue.contents = [];

    let mndx = statue.corpsenm;
    for (let attempt = 0; attempt < 1000; attempt++, mndx = rndmonnum()) {
        let monsterPoint = null;
        for (let locations = 0; locations < 100; locations++) {
            const x = rn2(COLNO - 3) + 2;
            const y = rn2(ROWNO);
            if (monsterGoodPosition(mndx, x, y)) {
                monsterPoint = { x, y };
                break;
            }
        }
        if (!monsterPoint) continue;
        const was = await makemon(mndx, monsterPoint.x, monsterPoint.y, 0);
        if (!was) continue;
        game.level.monsters = game.level.monsters.filter(monster => monster !== was);
        if (!medusaPetrifiable(mndx)) continue;
        statue.corpsenm = mndx;
        for (const object of was.minvent || []) {
            object.where = 'contained';
            object.ox = object.oy = 0;
            statue.contents.unshift(object);
        }
        break;
    }
    return statue;
}

function markSpecialSelectionWallProperty(selection, property) {
    selection.forEachXMajor((x, y) => {
        const loc = game.level.at(x, y);
        if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
            || loc.typ === IRONBARS))
            loc.wall_info |= property;
    });
}

async function generateElementalPlane(active) {
    active.file = `${active.prototype}.lua`;
    if (active.prototype === 'air' || active.prototype === 'water')
        active.elementalBubbles = true;
    if (active.prototype === 'water') game.level.flags.waterlevel = true;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

export async function generateEarthLevel(active) {
    if (active?.prototype !== 'earth')
        throw new RangeError(`unknown earth level ${active?.prototype}`);
    await generateElementalPlane(active);
}

export async function generateWaterLevel(active) {
    if (active?.prototype !== 'water')
        throw new RangeError(`unknown water level ${active?.prototype}`);
    await generateElementalPlane(active);
}

export async function generateAstralLevel(active) {
    if (active?.prototype !== 'astral')
        throw new RangeError(`unknown Astral level ${active?.prototype}`);
    active.file = 'astral.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function specialMapSelection(context, rows = null) {
    // sp_lev.c:lspo_map() returns only cells whose glyph decoded to real
    // terrain.  In particular, `x` is MAX_TYPE/transparent: it leaves both
    // SpLev_Map and the returned selection clear at that coordinate.
    const selection = new SpecialSelection();
    for (let dy = 0; dy < context.height; dy++) {
        const row = rows?.[dy]?.padEnd(context.width, ' ');
        for (let dx = 0; dx < context.width; dx++) {
            if (row?.[dx] === 'x') continue;
            selection.add(context.xstart + dx, context.ystart + dy);
        }
    }
    return selection;
}

function lightSpecialArea(context, x1, y1, x2, y2, lit) {
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            const loc = game.level.at(
                context.xstart + x, context.ystart + y,
            );
            if (loc) loc.lit = lit;
        }
    }
}

function fillSpecialSolid(filling = STONE, lit = false) {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            if (!loc) continue;
            loc.typ = filling;
            loc.lit = !!lit;
            loc.flags = 0;
            loc.roomno = 0;
            loc.edge = false;
            loc.horizontal = false;
        }
    }
}

function fillSpecialSwamp(fg = ROOM, bg = MOAT, lit = false) {
    // sp_lev.c:lvlfill_swamp().  First establish the full moat background,
    // then run the x-major relaxed blockwise maze over even coordinates.
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    for (let x = 2; x <= mazeXMax; x++) {
        for (let y = 0; y <= mazeYMax; y++) {
            const loc = game.level.at(x, y);
            if (!loc) continue;
            loc.typ = bg;
            loc.lit = !!lit;
            loc.flags = 0;
            loc.horizontal = false;
            loc.roomno = 0;
            loc.edge = false;
        }
    }
    for (let x = 2; x <= Math.min(mazeXMax, COLNO - 2); x += 2) {
        for (let y = 0; y <= Math.min(mazeYMax, ROWNO - 2); y += 2) {
            setLevelTerrainType(x, y, fg);
            const east = game.level.at(x + 1, y);
            const south = game.level.at(x, y + 1);
            const diagonal = game.level.at(x + 1, y + 1);
            const untouched = Number(east?.typ === bg)
                + Number(south?.typ === bg)
                + Number(diagonal?.typ === bg);
            if (untouched !== 3) continue;
            const chosen = rn2(3);
            const point = chosen === 0 ? east
                : chosen === 1 ? south : diagonal;
            if (point) {
                point.typ = fg;
                point.lit = !!lit;
            }
        }
    }
}

async function generateWizardLevel(active) {
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of game.level.rooms.slice(0, game.level.nroom))
        await fillSpecialRoom(room);
}

export async function generateWizard3Level(active) {
    if (active?.prototype !== 'wizard3')
        throw new RangeError(`unknown Wizard level ${active?.prototype}`);
    await generateWizardLevel(active);
}

export async function generateFakeWizardLevel(active) {
    if (!['fakewiz1', 'fakewiz2'].includes(active?.prototype)) {
        throw new RangeError(`unknown false Wizard level ${active?.prototype}`);
    }
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function makeSpecialDrawbridge(context, x, y, direction, open = false) {
    const bridgeX = context.xstart + x;
    const bridgeY = context.ystart + y;
    const bridge = game.level.at(bridgeX, bridgeY);
    if (!bridge) return;
    const under = bridge.typ === LAVAPOOL ? DB_LAVA : DB_MOAT;
    const offsets = {
        [DB_NORTH]: [0, -1], [DB_SOUTH]: [0, 1],
        [DB_EAST]: [1, 0], [DB_WEST]: [-1, 0],
    };
    const [dx, dy] = offsets[direction];
    bridge.typ = open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    bridge.horizontal = direction === DB_EAST || direction === DB_WEST;
    bridge.drawbridgemask = direction | under;
    const wall = game.level.at(bridgeX + dx, bridgeY + dy);
    if (wall) {
        wall.typ = open ? DOOR : DBWALL;
        if (open) wall.doormask = D_NODOOR;
        wall.horizontal = direction === DB_NORTH || direction === DB_SOUTH;
        if (!open) wall.wall_info |= W_NONDIGGABLE;
    }
}

export async function generateHellFillerLevel(active) {
    if (active?.prototype !== 'hellfill')
        throw new RangeError(`unknown Hell filler ${active?.prototype}`);
    active.file = 'hellfill.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of game.level.rooms.slice(0, game.level.nroom))
        await fillSpecialRoom(room);
}

function flipSpecialRegion(region) {
    const flip = game.level._flip;
    if (!region || !flip) return region;
    let { lx, ly, hx, hy } = region;
    if (flip.flp & 2) [lx, hx] = [flip.maxx - hx + flip.minx,
        flip.maxx - lx + flip.minx];
    if (flip.flp & 1) [ly, hy] = [flip.maxy - hy + flip.miny,
        flip.maxy - ly + flip.miny];
    const result = { ...region, lx, ly, hx, hy };
    if (region.nlx != null) {
        let { nlx, nly, nhx, nhy } = region;
        if (flip.flp & 2) [nlx, nhx] = [
            flip.maxx - nhx + flip.minx,
            flip.maxx - nlx + flip.minx,
        ];
        if (flip.flp & 1) [nly, nhy] = [
            flip.maxy - nhy + flip.miny,
            flip.maxy - nly + flip.miny,
        ];
        Object.assign(result, { nlx, nly, nhx, nhy });
    }
    return result;
}

export async function generateMedusaLevel(active) {
    if (active?.variant < 1 || active?.variant > 4) {
        throw new RangeError(`unknown Medusa variant ${active?.variant}`);
    }
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function makeToptenStatue(x, y) {
    const statue = mksobj_at(STATUE, x, y, false, false);
    rnd(10);
    set_corpsenm(statue, 330 + rn2(13));
    return statue;
}

function medusaRoomPoint(room) {
    return {
        x: room.lx + rn2(room.hx - room.lx + 1),
        y: room.ly + rn2(room.hy - room.ly + 1),
    };
}

async function fixupMedusa(active) {
    if (active?.prototype !== 'medusa') return;
    const room = game.level.rooms?.[0];
    if (!room) return;
    for (let count = rnd(4); count > 0; count--) {
        const point = medusaRoomPoint(room);
        const loc = game.level.at(point.x, point.y);
        if (!loc || !SPACE_POS(loc.typ)) continue;
        const statue = makeToptenStatue(point.x, point.y);
        for (let tries = 0; tries < 99
            && !medusaPetrifiable(statue.corpsenm); tries++)
            set_corpsenm(statue, rndmonnum());
    }
    const topTen = !!rn2(2);
    const point = medusaRoomPoint(room);
    const statue = topTen
        ? makeToptenStatue(point.x, point.y)
        : mkcorpstat(STATUE, null, null, point.x, point.y, 0);
    for (let tries = 0; tries < 99
        && statue && !medusaPetrifiable(statue.corpsenm); tries++)
        set_corpsenm(statue, rndmonnum());
}

function relocateBaalzFixupMonster(monster) {
    // teleport.c:rloc() first owns 50 whole-level random probes.  The two
    // temporary pool markers are not legal random Lua locations, so this is
    // normally dormant; retain the source path for a future occupied marker.
    for (let attempt = 0; attempt < 50; attempt++) {
        const x = rnd(COLNO - 1);
        const y = rn2(ROWNO);
        if (!monsterGoodPosition(monster.mnum, x, y)) continue;
        monster.mx = x;
        monster.my = y;
        return true;
    }
    return false;
}

function fixupBaalz() {
    // mkmaze.c:baalz_fixup().  Corrmaze suppresses ordinary wallification so
    // the nondiggable perimeter can define the protected beetle interior.
    let lastx = 0;
    const inarea = { x1: 0, y1: 0, x2: 0, y2: 0 };
    const middleY = Math.trunc(ROWNO / 2);
    let scanX;
    for (scanX = 0; scanX < COLNO; scanX++) {
        if ((game.level.at(scanX, middleY)?.wall_info
            & W_NONDIGGABLE) !== 0) {
            if (!lastx) inarea.x1 = scanX + 1;
            lastx = scanX;
        }
    }
    inarea.x2 = (lastx > inarea.x1 ? lastx : scanX) - 1;

    let lasty = 0;
    let scanY;
    for (scanY = 0; scanY < ROWNO; scanY++) {
        if ((game.level.at(inarea.x1, scanY)?.wall_info
            & W_NONDIGGABLE) !== 0) {
            if (!lasty) inarea.y1 = scanY + 1;
            lasty = scanY;
        }
    }
    inarea.y2 = (lasty > inarea.y1 ? lasty : scanY) - 1;

    const poolMarkers = [];
    for (let x = inarea.x1; x <= inarea.x2; x++) {
        for (let y = inarea.y1; y <= inarea.y2; y++) {
            const loc = game.level.at(x, y);
            if (loc?.typ === POOL) {
                loc.typ = HWALL;
                loc.horizontal = true;
                poolMarkers.push({ x, y });
            } else if (loc?.typ === IRONBARS) {
                if ((game.level.at(x - 1, y)?.wall_info
                    & W_NONDIGGABLE) !== 0) {
                    game.level.at(x - 1, y).wall_info &= ~W_NONDIGGABLE;
                    if (isok(x - 2, y))
                        game.level.at(x - 2, y).wall_info &= ~W_NONDIGGABLE;
                } else if ((game.level.at(x + 1, y)?.wall_info
                    & W_NONDIGGABLE) !== 0) {
                    game.level.at(x + 1, y).wall_info &= ~W_NONDIGGABLE;
                    if (isok(x + 2, y))
                        game.level.at(x + 2, y).wall_info &= ~W_NONDIGGABLE;
                }
            }
        }
    }

    wallification(
        Math.max(inarea.x1 - 2, 1),
        Math.max(inarea.y1 - 2, 0),
        Math.min(inarea.x2 + 2, COLNO - 1),
        Math.min(inarea.y2 + 2, ROWNO - 1),
        inarea,
    );

    const repairMarker = (marker, verticalDelta, jointType, upper) => {
        if (!marker) return;
        const loc = game.level.at(marker.x, marker.y);
        const joint = game.level.at(
            marker.x, marker.y + verticalDelta,
        );
        if (!loc || !joint
            || (loc.typ !== TLWALL && loc.typ !== TRWALL)
            || joint.typ !== jointType) return;
        if (upper)
            loc.typ = loc.typ === TLWALL ? BRCORNER : BLCORNER;
        else
            loc.typ = loc.typ === TLWALL ? TRCORNER : TLCORNER;
        joint.typ = HWALL;
        joint.horizontal = true;
        const monster = game.level.monsters.find(candidate =>
            candidate.mx === marker.x && candidate.my === marker.y);
        if (monster) relocateBaalzFixupMonster(monster);
    };
    repairMarker(poolMarkers[0], 1, TUWALL, true);
    repairMarker(poolMarkers[1], -1, TDWALL, false);

    game._activeSpecialLevel.baalzFixupArea = { ...inarea };
    game._activeSpecialLevel.baalzPoolMarkers = poolMarkers.map(
        marker => ({ ...marker }),
    );
}

// C ref: mkmaze.c fixup_special() LR_PORTAL case.  Named Lua portals are
// level regions rather than dungeon branches: after every script operation
// has completed, place_lregion() samples the declared area, rejects its
// exclusion rectangle and occupied terrain, then installs a magic portal
// whose destination is the named special level.
async function fixupSpecialPortal(active) {
    const region = active?.explicitPortalRegion;
    if (!region) return;
    const exclude = active.explicitPortalExclude || {
        lx: -1, ly: -1, hx: -1, hy: -1,
    };
    const lx = Math.max(1, region.lx);
    const hx = Math.min(COLNO - 1, region.hx);
    const ly = Math.max(0, region.ly);
    const hy = Math.min(ROWNO - 1, region.hy);
    const destination = game.specialLevels?.get?.(
        active.portalDestinationName,
    );
    if (!destination) return;

    let point = null;
    for (let attempt = 0; attempt < 200; attempt++) {
        const x = rn1(hx - lx + 1, lx);
        const y = rn1(hy - ly + 1, ly);
        if (!bad_location(x, y,
            exclude.lx, exclude.ly, exclude.hx, exclude.hy)) {
            point = { x, y };
            break;
        }
    }
    if (!point) {
        for (let x = lx; x <= hx && !point; x++) {
            for (let y = ly; y <= hy; y++) {
                if (!bad_location(x, y,
                    exclude.lx, exclude.ly, exclude.hx, exclude.hy)) {
                    point = { x, y };
                    break;
                }
            }
        }
    }
    if (!point) return;
    const portal = await maketrap(point.x, point.y, MAGIC_PORTAL);
    portal.dst = { ...destination };
}

function fixupSpecialStair(active) {
    // Preserve Lua declaration order for the common paired regions: Juiblex
    // declares its down stair before its up stair.
    for (const [field, type] of [
        ['explicitDownStairRegion', LR_DOWNSTAIR],
        ['explicitUpStairRegion', LR_UPSTAIR],
    ]) {
        const region = active?.[field];
        if (!region) continue;
        place_lregion(
            region.lx, region.ly, region.hx, region.hy,
            region.nlx ?? -1, region.nly ?? -1,
            region.nhx ?? -1, region.nhy ?? -1,
            type, null,
        );
    }
}

// C mkmaze.c:fixup_special() owns implicit dungeon-branch placement after a
// special-level Lua script finishes.  An explicit branch region (Pri-strt)
// has already set made_branch; an unadorned special map such as Big Room uses
// place_lregion() over the whole level before hero arrival begins.
async function fixupSpecialBranch(active) {
    if (game.made_branch) return;
    const branch = is_branchlev();

    if (active?.explicitBranchRegion) {
        const region = active.explicitBranchRegion;
        const exclude = active.explicitBranchExclude || {};
        const lx = Math.max(1, region.lx), hx = Math.min(COLNO - 1, region.hx);
        const ly = Math.max(0, region.ly), hy = Math.min(ROWNO - 1, region.hy);
        let point = null;
        for (let attempt = 0; attempt < 200; attempt++) {
            const x = lx + rn2(hx - lx + 1);
            const y = ly + rn2(hy - ly + 1);
            if (!bad_location(x, y,
                exclude.lx, exclude.ly, exclude.hx, exclude.hy)) {
                point = { x, y };
                break;
            }
        }
        if (point && branch) await placeBranchAt(branch, point.x, point.y);
        return;
    }

    if (!branch) return;

    if ((game.level?.nroom ?? 0) > 0) {
        await place_branch(branch);
        return;
    }

    let point = null;
    for (let attempt = 0; attempt < 200; attempt++) {
        const x = 1 + rn2(COLNO - 1);
        const y = rn2(ROWNO);
        if (!bad_location(x, y, 0, 0, 0, 0)) {
            point = { x, y };
            break;
        }
    }
    if (!point) {
        for (let x = 1; x < COLNO && !point; x++) {
            for (let y = 0; y < ROWNO; y++) {
                if (!bad_location(x, y, 0, 0, 0, 0)) {
                    point = { x, y };
                    break;
                }
            }
        }
    }
    if (point) await placeBranchAt(branch, point.x, point.y);
}

async function generateSpecialAndFixup(generator, active) {
    await generator(active);
    const arrivalRegion = (region, exclude) => {
        if (!region) return null;
        const embeddedExclude = Number.isInteger(region.nlx)
            ? {
                lx: region.nlx, ly: region.nly,
                hx: region.nhx, hy: region.nhy,
            }
            : null;
        const exclusion = exclude || embeddedExclude;
        return {
            ...region,
            ...(exclusion ? { exclude: { ...exclusion } } : {}),
        };
    };
    game.level.upTeleportRegion = arrivalRegion(
        active?.upTeleportRegion, active?.upTeleportExclude,
    );
    game.level.downTeleportRegion = arrivalRegion(
        active?.downTeleportRegion, active?.downTeleportExclude,
    );
    // mkmaze.c:fixup_special() must allocate and initially paint Air/Water
    // bubbles before named portals and arrival regions are materialized.
    if (active?.elementalBubbles) setupElementalBubbles();
    await fixupSpecialPortal(active);
    fixupSpecialStair(active);
    await fixupSpecialBranch(active);
    if (active?.baalzFixup) fixupBaalz();
    // sp_lev.c explicitly places deferred portals, stairs, and branches
    // before premap_detect(); otherwise their remembered glyphs retain the
    // underlying terrain even though the live level cell was updated.
    if (active?.premapped) premap_detect();
    await fixupMedusa(active);
}

async function generateSokobanLevel(active) {
    if (!/^soko[1-4]$/.test(active?.prototype)
        || active?.variant < 1 || active?.variant > 2) {
        throw new RangeError(
            `unknown Sokoban level ${active?.prototype}-${active?.variant}`,
        );
    }
    active.file = `${active.prototype}-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of game.level.rooms.slice(0, game.level.nroom))
        await fillSpecialRoom(room);
}

export async function generateSokobanLevel2(active) {
    if (active?.prototype !== 'soko2') {
        throw new RangeError(`unknown Sokoban level 2 ${active?.prototype}`);
    }
    await generateSokobanLevel(active);
}

function fillSpecialMazeGrid(filling = HWALL) {
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    for (let x = 2; x <= mazeXMax; x++) {
        for (let y = 0; y <= mazeYMax; y++) {
            const loc = game.level.at(x, y);
            if (loc) {
                loc.typ = game.level.flags.corrmaze
                    ? STONE
                    : (y < 2 || ((x % 2) && (y % 2)))
                        ? STONE : filling;
            }
        }
    }
}

export async function generateKnoxLevel(active) {
    if (active?.prototype !== 'knox')
        throw new RangeError(`unknown Knox level ${active?.prototype}`);
    active.file = 'knox.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of game.level.rooms.slice(0, game.level.nroom))
        await fillSpecialRoom(room);
}

// C ref: mklev.c makelevel()
async function makelevel() {
    const g = game;
    oinit();
    clear_level_structures();
    // dungeon.lua supplies Rogue through the named-level descriptor.  The JS
    // dungeon loader does not yet materialize C's global rogue_level d_level,
    // so bind that canonical identity when the descriptor reaches makelevel.
    const requestedRogue = g._specialLevelPrototype === 'rogue';
    if (requestedRogue)
        g.rogue_level = { dnum: g.u.uz.dnum, dlevel: g.u.uz.dlevel };
    const isRogueLevel = Is_rogue_level(g.u?.uz);
    // C's Is_special(&u.uz) is derived from the destination level on every
    // makelevel call.  JS carries the parsed Lua descriptor explicitly, so a
    // newly generated regular level must not inherit the source level's
    // alignment, coordinate context, or other special-level metadata.
    if (!g._specialLevelPrototype || isRogueLevel)
        g._activeSpecialLevel = null;
    // Rogue is listed in dungeon.lua like a named special level, but C
    // handles it in the legacy regular-level branch below rather than through
    // the Lua special-level interpreter.
    if (isRogueLevel && g._specialLevelPrototype === 'rogue')
        g._specialLevelPrototype = null;

    // C mklev.c -> mkmaze.c: a named special level chooses its Lua variant.
    // Lua-owned variants perform the nhlib shuffle and level_init lighting
    // draw inside the interpreter.  The remaining handwritten variants keep
    // the equivalent preamble until their scripts replace them.
    if (g._specialLevelPrototype) {
        const prototype = g._specialLevelPrototype;
        const variants = prototype === 'bigrm' ? 13
            : prototype.startsWith('soko') ? 2
                : prototype === 'minetn' ? 7
                    : prototype === 'minend' ? 3
                        : prototype === 'medusa' ? 4 : 1;
        const variant = variants > 1 ? rnd(variants) : 1;
        const luaOwnedSpecial = prototype === 'bigrm'
            || prototype === 'minend'
            || prototype === 'minetn'
            || isLuaQuestPrototype(prototype)
            || prototype.startsWith('soko')
            || /^tower[1-3]$/.test(prototype)
            || prototype === 'oracle'
            || prototype === 'medusa'
            || prototype === 'castle'
            || prototype === 'knox'
            || prototype === 'fakewiz1'
            || prototype === 'fakewiz2'
            || prototype === 'wizard1'
            || prototype === 'wizard2'
            || prototype === 'wizard3'
            || prototype === 'asmodeus'
            || prototype === 'baalz'
            || prototype === 'orcus'
            || prototype === 'juiblex'
            || prototype === 'valley'
            || prototype === 'sanctum'
            || prototype === 'earth'
            || prototype === 'air'
            || prototype === 'fire'
            || prototype === 'water'
            || prototype === 'astral'
            || /^tut-[12]$/.test(prototype);
        const align = ['law', 'neutral', 'chaos'];
        if (!luaOwnedSpecial) {
            for (let i = align.length; i > 1; i--) {
                const j = rn2(i);
                [align[i - 1], align[j]] = [align[j], align[i - 1]];
            }
        }
        // Room-form scripts do not call des.level_init(); their first
        // operation is des.room, so no splev_initlev lighting draw belongs
        // between nhlib's shuffle and build_room().
        const roomForm = (prototype === 'minetn'
            && [2, 3, 4, 7].includes(variant))
            || prototype === 'oracle'
            || /-fil[ab]$/.test(prototype);
        // LVLINIT_MAZEGRID ignores its random-light field.  Named Gehennom
        // fortresses share that initializer with Castle, so classify the
        // Lua operation rather than special-casing whichever file was ported
        // first.
        const mazeGridPrototype = new Set([
            'castle', 'asmodeus', 'fakewiz1', 'fakewiz2',
            'orcus', 'wizard1', 'wizard2', 'wizard3',
        ]);
        // Juiblex uses LVLINIT_SWAMP with `lit=0`, so its explicit lighting
        // likewise bypasses BOOL_RANDOM.
        const fixedLightingPrototype = prototype === 'juiblex'
            || prototype === 'baalz';
        const defaultLit = luaOwnedSpecial ? null
            : roomForm || mazeGridPrototype.has(prototype)
                || fixedLightingPrototype
                ? false : !!rn2(2);
        g._activeSpecialLevel = {
            prototype, variant,
            file: prototype === 'tut-1'
                ? 'tut-1.lua'
                : variants > 1 ? `${prototype}-${variant}.lua`
                    : `${prototype}.lua`,
            align, defaultLit,
            // dungeon.lua owns fixed special-level alignment independently
            // of nhlib's shuffled alignment list.  Monster reservoirs use
            // this descriptor through C's align_shift().
            ...(prototype === 'medusa'
                ? { monsterAlignment: 'chaos' } : {}),
        };
        g._specialLevelPrototype = null;

        if (prototype === 'castle') {
            await generateSpecialAndFixup(generateLuaSpecialLevel,
                g._activeSpecialLevel);
            for (const room of g.level.rooms.slice(0, g.level.nroom))
                await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'knox') {
            await generateKnoxLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'asmodeus') {
            await generateSpecialAndFixup(
                generateLuaSpecialLevel, g._activeSpecialLevel,
            );
            return;
        }
        if (prototype === 'juiblex') {
            await generateSpecialAndFixup(
                generateLuaSpecialLevel, g._activeSpecialLevel,
            );
            for (const room of g.level.rooms.slice(0, g.level.nroom))
                await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'baalz') {
            g._activeSpecialLevel.baalzFixup = true;
            await generateSpecialAndFixup(
                generateLuaSpecialLevel, g._activeSpecialLevel,
            );
            return;
        }
        if (prototype === 'orcus') {
            await generateSpecialAndFixup(
                generateLuaSpecialLevel, g._activeSpecialLevel,
            );
            for (const room of g.level.rooms.slice(0, g.level.nroom))
                await fillSpecialRoom(room);
            return;
        }
        if (['wizard1', 'wizard2', 'wizard3'].includes(prototype)) {
            await generateWizardLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'fakewiz1' || prototype === 'fakewiz2') {
            await generateFakeWizardLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'bigrm') {
            await generateBigRoom(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'medusa') {
            await generateMedusaLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'valley') {
            await generateSpecialAndFixup(generateLuaSpecialLevel,
                g._activeSpecialLevel);
            for (const room of g.level.rooms.slice(0, g.level.nroom))
                await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'sanctum') {
            await generateSpecialAndFixup(generateLuaSpecialLevel,
                g._activeSpecialLevel);
            for (const room of g.level.rooms.slice(0, g.level.nroom))
                await fillSpecialRoom(room);
            return;
        }
        if (['earth', 'air', 'fire', 'water'].includes(prototype)) {
            await generateElementalPlane(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'astral') {
            await generateAstralLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype.startsWith('soko')) {
            await generateSokobanLevel(g._activeSpecialLevel);
            return;
        }
        if (/^tut-[12]$/.test(prototype)) {
            await generateSpecialAndFixup(generateLuaSpecialLevel,
                g._activeSpecialLevel);
            return;
        }
        if (isLuaQuestPrototype(prototype)) {
            await generateLuaQuestLevel(g._activeSpecialLevel);
            return;
        }
        if (/^tower[1-3]$/.test(prototype)) {
            await generateVladsTowerLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'minetn') {
            await generateMinetown(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'minend') {
            await generateMinesEnd(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'oracle') {
            await generateOracleLevel(g._activeSpecialLevel);
            return;
        }
    }

    const currentDungeon = g.dungeons?.[g.u?.uz?.dnum ?? 0];
    if (currentDungeon?.dname === 'The Gnomish Mines') {
        const active = {
            prototype: 'minefill', file: 'minefill.lua',
        };
        g._activeSpecialLevel = active;
        await generateMineFiller(active);
        return;
    }
    if (currentDungeon?.flags?.hellish) {
        const active = {
            prototype: 'hellfill', file: 'hellfill.lua',
        };
        g._activeSpecialLevel = active;
        await generateHellFillerLevel(active);
        return;
    }

    // C ref: mklev.c:1295 — check for below-Medusa maze level
    // This rn2(5) is consumed even when the condition fails (short-circuit)
    const medusa = g.medusa_level;
    if (rn2(5) && g.u?.uz?.dnum === medusa?.dnum
        && (g.u?.uz?.dlevel ?? 1) > (medusa?.dlevel ?? 999)) {
        // Would generate maze — not applicable for contest level 1
    }

    // C ref: mklev.c makelevel() -> extralev.c.  Rogue owns a legacy 3x3
    // room/intersection graph and deliberately skips themed rooms, ordinary
    // corridors, niches, vaults, and random special-room selection.
    if (isRogueLevel) {
        g.level.flags.is_rogue_level = true;
        g.level.flags.rogue_level = true;
        makeroguerooms();
        await makerogueghost();
        if (g.level.nroom <= 0) return;
        sort_rooms();
        await generate_stairs();

        const branchp = is_branchlev();
        if (branchp) await place_branch(branchp);

        for (const croom of g.level.rooms.slice(0, g.level.nroom))
            await fill_ordinary_room(croom, false);
        for (const croom of g.level.rooms.slice(0, g.level.nroom))
            await fillSpecialRoom(croom);
        return;
    }

    // Regular level generation
    await beginLuaThemerooms();
    await makerooms();

    if (g.level.nroom <= 0) return;
    sort_rooms();
    await generate_stairs();

    // Branch check
    const branchp = is_branchlev();
    let roomThreshold = branchp ? 4 : 3;

    makecorridors();
    await make_niches();

    // Vault creation (simplified for contest)
    if (g.vault_x !== -1) {
        const vw = { v: 1 }, vh = { v: 1 };
        const vx = { v: g.vault_x }, vy = { v: g.vault_y };
        const finishVault = async () => {
            add_room(vx.v, vy.v, vx.v + vw.v, vy.v + vh.v, true, VAULT, false);
            g.level.flags.has_vault = true;
            roomThreshold++;
            const vaultRoom = g.level.rooms[g.level.nroom - 1];
            if (vaultRoom) {
                vaultRoom.needfill = FILL_NORMAL;
                fillVault(vaultRoom);
            }
            await maybePlaceKnoxPortal(vx.v + vw.v, vy.v + vh.v);
            if (!rn2(3)) await makeniche(TELEP_TRAP);
        };
        if (check_room(vx, vw, vy, vh, true)) {
            await finishVault();
        } else if (rnd_rect()) {
            // C retries the reserved vault in the remaining free rectangle.
            // A successful reservation is only provisional: makelevel copies
            // its coordinates and re-enters the same check/fill block.
            const reserved = create_room(
                -1, -1, 2, 2, -1, -1, VAULT, true,
            );
            if (reserved) {
                const candidate = g.level.rooms[g.level.nroom];
                vx.v = g.vault_x = candidate?.lx ?? -1;
                vy.v = g.vault_y = candidate?.ly ?? -1;
                if (check_room(vx, vw, vy, vh, true)) await finishVault();
                else if (candidate) candidate.hx = -1;
            }
        }
    }

    // C ref: mklev.c makelevel() -> mkroom.c mkshop().  On shallow regular
    // levels the only eligible random special room is a shop.  Selecting it
    // here is stateful: it changes topology and excludes the room from the
    // ordinary-room bonus and filling passes below.
    await maybeMakeSpecialRoom(roomThreshold);

    // Place dungeon branch
    if (branchp) await place_branch(branchp);

    // Choose one ordinary room for a level-specific bonus item, then fill all
    // ordinary rooms.  The choice uses the rooms on this level.
    const fillableRooms = g.level.rooms
        .slice(0, g.level.nroom)
        .filter(room => room
            && (room.rtype === OROOM || room.rtype === THEMEROOM)
            && room.needfill === FILL_NORMAL);
    let bonusItemRoomCountdown = fillableRooms.length
        ? rn2(fillableRooms.length) : -1;
    for (const croom of g.level.rooms.slice(0, g.level.nroom)) {
        const fillable = croom
            && (croom.rtype === OROOM || croom.rtype === THEMEROOM)
            && croom.needfill === FILL_NORMAL;
        await fill_ordinary_room(croom,
            fillable && bonusItemRoomCountdown === 0);
        if (fillable) bonusItemRoomCountdown--;
    }

    // C defers all special-room stocking until ordinary rooms are filled.
    // Room order matters: this level's shop is stocked before the vault's
    // second fill pass, and both precede mineralization.
    for (const croom of g.level.rooms.slice(0, g.level.nroom))
        await fillSpecialRoom(croom);

    await callLuaThemerooms('post_level_generate');
    // A loaded theme interpreter always wallifies the complete level, not
    // only rooms created from des.map().  Dynamic terrain callbacks such as
    // "Pillars" rely on this pass for their internal wall spines.
    wallification(1, 0, COLNO - 1, ROWNO - 1);
}

// C ref: mklev.c mk_knox_portal().  Fort Ludios starts with an out-of-range
// source dnum.  Each otherwise eligible vault owns one deferral draw until a
// deep main-dungeon vault resolves that source; subsequent vaults skip it.
async function maybePlaceKnoxPortal(x, y) {
    const dungeons = game.dungeons || [];
    const branch = game.branches?.find(candidate =>
        dungeons[candidate?.end2?.dnum]?.dname === 'Fort Ludios');
    if (!branch) return false;

    const onKnoxSourceEnd = game.knox_level
        && branch.end1?.dnum === game.knox_level.dnum
        && branch.end1?.dlevel === game.knox_level.dlevel;
    const source = onKnoxSourceEnd ? branch.end2 : branch.end1;
    if (!onKnoxSourceEnd && is_branchlev()) return false;
    if ((source?.dnum ?? -1) < dungeons.length) return false;

    const deferred = rn2(3);
    if (deferred && !game.flags?.debug) return false;

    const here = game.u?.uz || { dnum: 0, dlevel: 1 };
    const hereDepth = depth_of_level(here);
    const medusaDepth = depth_of_level(game.medusa_level);
    if (here.dnum !== game.oracle_level?.dnum
        || hereDepth <= 10 || hereDepth >= medusaDepth)
        return false;

    if (onKnoxSourceEnd) branch.end2 = { ...here };
    else branch.end1 = { ...here };
    await placeBranchAt(branch, x, y);
    return true;
}

function roomHasStair(croom, up) {
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (!!stair.up !== !!up) continue;
        if (stair.sx >= croom.lx && stair.sx <= croom.hx
            && stair.sy >= croom.ly && stair.sy <= croom.hy)
            return true;
    }
    return false;
}

// C ref: mkroom.c invalid_shop_shape().  A shopkeeper must have more than a
// one-square cul-de-sac immediately inside the selected room's only door.
function invalidShopShape(croom) {
    const door = game.level?.doors?.[croom.fdoor];
    if (!door) return true;
    let inside = null;
    let insideCount = 0;
    for (let x = Math.max(door.x - 1, croom.lx);
        x <= Math.min(door.x + 1, croom.hx); x++) {
        for (let y = Math.max(door.y - 1, croom.ly);
            y <= Math.min(door.y + 1, croom.hy); y++) {
            if (game.level.at(x, y)?.typ === ROOM) {
                inside = { x, y };
                insideCount++;
            }
        }
    }
    if (insideCount < 1) return true;
    if (insideCount > 1) return false;

    let exits = 0;
    for (let x = Math.max(inside.x - 1, croom.lx);
        x <= Math.min(inside.x + 1, croom.hx); x++) {
        for (let y = Math.max(inside.y - 1, croom.ly);
            y <= Math.min(inside.y + 1, croom.hy); y++) {
            if (x === inside.x && y === inside.y) continue;
            if (game.level.at(x, y)?.typ === ROOM) exits++;
        }
    }
    return exits === 1;
}

function mkshop() {
    const rooms = game.level?.rooms?.slice(0, game.level.nroom) ?? [];
    const sroom = rooms.find(room => room?.rtype === OROOM
        && !roomHasStair(room, false)
        && !roomHasStair(room, true)
        && room.doorct === 1
        && !invalidShopShape(room));
    if (!sroom) return false;

    if (!sroom.rlit) {
        for (let x = sroom.lx - 1; x <= sroom.hx + 1; x++)
            for (let y = sroom.ly - 1; y <= sroom.hy + 1; y++) {
                const loc = game.level.at(x, y);
                if (loc) loc.lit = true;
            }
        sroom.rlit = 1;
    }

    let roll = rnd(100);
    let shopIndex = 0;
    while (shopIndex < RANDOM_SHOP_TYPES.length - 1
        && (roll -= RANDOM_SHOP_TYPES[shopIndex].probability) > 0)
        shopIndex++;
    const area = (sroom.hx - sroom.lx + 1) * (sroom.hy - sroom.ly + 1);
    const symbol = RANDOM_SHOP_TYPES[shopIndex].symbol;
    if (area > 20 && (symbol === WAND_CLASS || symbol === SPBOOK_CLASS))
        shopIndex = 0;

    sroom.rtype = SHOPBASE + shopIndex;
    topologize(sroom);
    sroom.needfill = FILL_NORMAL;
    return true;
}

// C refs: mkroom.c pick_room()/mkzoo()/mktemple().  Random special rooms use
// a randomized starting room, then walk the stable room array with exact
// stair and door eligibility gates.
function pickSpecialRoom(strict) {
    const rooms = game.level?.rooms?.slice(0, game.level.nroom) ?? [];
    if (!rooms.length) return null;
    let index = rn2(rooms.length);
    for (let remaining = rooms.length; remaining > 0; remaining--) {
        const room = rooms[index];
        index = (index + 1) % rooms.length;
        if (!room || room.hx < 0) return null;
        if (room.rtype !== OROOM) continue;
        if (!strict) {
            if (roomHasStair(room, true)
                || (roomHasStair(room, false) && rn2(3)))
                continue;
        } else if (roomHasStair(room, true)
            || roomHasStair(room, false)) {
            continue;
        }
        if (room.doorct === 1) return room;
        // `wizard` is the last operand in C, so debug mode still consumes
        // the door-preference draw before accepting a multi-door room.
        if (!rn2(5) || game.flags?.debug) return room;
    }
    return null;
}

function alignmentType(value) {
    if (value === 'law' || value === A_LAWFUL) return A_LAWFUL;
    if (value === 'neutral' || value === A_NEUTRAL) return A_NEUTRAL;
    if (value === 'chaos' || value === A_CHAOTIC) return A_CHAOTIC;
    return null;
}

// C ref: dungeon.c induced_align().  Each fixed descriptor gets its own
// percentage probe; the unaligned Dungeons of Doom proceed directly to the
// uniformly selected lawful/neutral/chaotic fallback.
function inducedAlignment(percent) {
    const specialAlignment = alignmentType(
        game._activeSpecialLevel?.monsterAlignment,
    );
    if (specialAlignment != null && rn2(100) < percent)
        return specialAlignment;

    const dungeonAlignment = alignmentType(
        game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.alignment,
    );
    if (dungeonAlignment != null && rn2(100) < percent)
        return dungeonAlignment;

    return rn2(3) - 1;
}

// C ref: mkroom.c shrine_pos().  Even-width or even-height interiors have
// two central squares, and each such axis owns one independent tie-breaker.
function shrinePosition(room) {
    const xDelta = room.hx - room.lx;
    let x = room.lx + Math.trunc(xDelta / 2);
    if ((xDelta % 2) && rn2(2)) x++;

    const yDelta = room.hy - room.ly;
    let y = room.ly + Math.trunc(yDelta / 2);
    if ((yDelta % 2) && rn2(2)) y++;
    return { x, y };
}

// C ref: mkroom.c mktemple().  Unlike zoo-family rooms, a temple is fully
// constructed at selection time; ordinary-room filling must observe both its
// changed room type and its resident priest.
async function makeRandomTemple(room) {
    room.rtype = TEMPLE;
    room.needfill = FILL_NORMAL;

    const shrine = shrinePosition(room);
    const altar = game.level.at(shrine.x, shrine.y);
    if (!altar) return false;
    altar.typ = ALTAR;
    const alignment = inducedAlignment(80);
    altar.flags = Align2amask(alignment);
    await specialShrinePriest(
        room, shrine.x, shrine.y, alignment,
    );
    altar.flags |= AM_SHRINE;
    game.level.flags.has_temple = true;
    return true;
}

async function markRandomSpecialRoom(roomType) {
    // All zoo-family rooms use pick_room(FALSE); temples use the stricter
    // stair exclusion.  Swamps have their own multi-room terrain transaction
    // and remain a distinct downstream owner.
    if (roomType === SWAMP) return false;
    const room = pickSpecialRoom(roomType === TEMPLE);
    if (!room) return false;
    if (roomType === TEMPLE) return makeRandomTemple(room);
    room.rtype = roomType;
    room.needfill = FILL_NORMAL;
    return true;
}

// C ref: mklev.c makelevel() random-special-room else-if chain.  Every failed
// depth-eligible predicate owns its draw; once one type is selected, room
// picking becomes mkroom.c's responsibility and later predicates are skipped.
async function maybeMakeSpecialRoom(roomThreshold) {
    const uDepth = depth_of_level(game.u?.uz);
    const medusaDepth = depth_of_level(game.medusa_level);
    if (uDepth > 1 && uDepth < medusaDepth
        && game.level.nroom >= roomThreshold && rn2(uDepth) < 3)
        return mkshop();
    if (uDepth > 4 && !rn2(6))
        return markRandomSpecialRoom(COURT);
    if (uDepth > 5 && !rn2(8))
        return markRandomSpecialRoom(LEPREHALL);
    if (uDepth > 6 && !rn2(7))
        return markRandomSpecialRoom(ZOO);
    if (uDepth > 8 && !rn2(5))
        return markRandomSpecialRoom(TEMPLE);
    if (uDepth > 9 && !rn2(5))
        return markRandomSpecialRoom(BEEHIVE);
    if (uDepth > 11 && !rn2(6))
        return markRandomSpecialRoom(MORGUE);
    if (uDepth > 12 && !rn2(8))
        return markRandomSpecialRoom(ANTHOLE);
    if (uDepth > 14 && !rn2(4))
        return markRandomSpecialRoom(BARRACKS);
    if (uDepth > 15 && !rn2(6))
        return markRandomSpecialRoom(SWAMP);
    if (uDepth > 16 && !rn2(8))
        return markRandomSpecialRoom(COCKNEST);
    return false;
}

function goodShopDoor(sroom) {
    for (let i = 0; i < sroom.doorct; i++) {
        const doorIndex = sroom.fdoor + i;
        const door = game.level?.doors?.[doorIndex];
        if (!door) continue;
        let { x, y } = door;
        if (sroom.irregular) {
            const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
            const candidates = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            const inside = candidates.find(([cx, cy]) => {
                const loc = game.level.at(cx, cy);
                return loc && !loc.edge && loc.roomno === roomno;
            });
            if (!inside) continue;
            [x, y] = inside;
        } else if (x === sroom.lx - 1) x++;
        else if (x === sroom.hx + 1) x--;
        else if (y === sroom.ly - 1) y++;
        else if (y === sroom.hy + 1) y--;
        else continue;
        return { doorIndex, door, x, y };
    }
    return null;
}

function stockRoomGoodPos(sroom, shopDoor, x, y) {
    const loc = game.level.at(x, y);
    if (!loc || loc.typ !== ROOM) return false;
    if (sroom.irregular) {
        const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
        return !loc.edge && loc.roomno === roomno
            && Math.max(Math.abs(x - shopDoor.door.x),
                Math.abs(y - shopDoor.door.y)) > 1;
    }
    return !((x === sroom.lx && shopDoor.door.x === x - 1)
        || (x === sroom.hx && shopDoor.door.x === x + 1)
        || (y === sroom.ly && shopDoor.door.y === y - 1)
        || (y === sroom.hy && shopDoor.door.y === y + 1));
}

const SHOP_ITEM_TABLES = [
    [[100, RANDOM_CLASS]],
    [[90, ARMOR_CLASS], [10, WEAPON_CLASS]],
    [[90, SCROLL_CLASS], [10, SPBOOK_CLASS]],
    [[100, POTION_CLASS]],
    [[90, WEAPON_CLASS], [10, ARMOR_CLASS]],
    [[83, FOOD_CLASS], [5, -319], [4, -317], [5, -322], [3, -ICE_BOX]],
    [[85, RING_CLASS], [10, GEM_CLASS], [5, AMULET_CLASS]],
    [[90, WAND_CLASS], [5, -LEATHER_GLOVES], [5, -140]],
    [[100, TOOL_CLASS]],
    [[90, SPBOOK_CLASS], [10, SCROLL_CLASS]],
    [[70, VEGETARIAN_CLASS], [20, -319], [4, -POT_HEALING],
        [3, -POT_FULL_HEALING], [2, -336], [1, -286]],
    [[30, -WAX_CANDLE], [44, -TALLOW_CANDLE], [5, -BRASS_LANTERN],
        [9, -OIL_LAMP], [3, -MAGIC_LAMP], [5, -POT_OIL],
        [2, -WAN_LIGHT], [1, -SCR_LIGHT], [1, -SPE_LIGHT]],
];

const GENERAL_SHOPKEEPER_NAMES = [
    'Hebiwerie', 'Possogroenoe', 'Asidonhopo', 'Manlobbi', 'Adjama',
    'Pakka Pakka', 'Kabalebo', 'Wonotobo', 'Akalapi', 'Sipaliwini',
    'Annootok', 'Upernavik', 'Angmagssalik', 'Aklavik', 'Inuvik',
    'Tuktoyaktuk', 'Chicoutimi', 'Ouiatchouane', 'Chibougamau', 'Matagami',
    'Kipawa', 'Kinojevis', 'Abitibi', 'Maganasipi', 'Akureyri', 'Kopasker',
    'Budereyri', 'Akranes', 'Bordeyri', 'Holmavik',
];

const ARMOR_SHOPKEEPER_NAMES = [
    'Demirci', 'Kalecik', 'Boyabai', 'Yildizeli', 'Gaziantep', 'Siirt',
    'Akhalataki', 'Tirebolu', 'Aksaray', 'Ermenak', 'Iskenderun', 'Kadirli',
    'Siverek', 'Pervari', 'Malasgirt', 'Bayburt', 'Ayancik', 'Zonguldak',
    'Balya', 'Tefenni', 'Artvin', 'Kars', 'Makharadze', 'Malazgirt',
    'Midyat', 'Birecik', 'Kirikkale', 'Alaca', 'Polatli', 'Nallihan',
];

const LIQUOR_SHOPKEEPER_NAMES = [
    'Njezjin', 'Tsjernigof', 'Ossipewsk', 'Gorlowka', 'Gomel', 'Konosja',
    'Weliki Oestjoeg', 'Syktywkar', 'Sablja', 'Narodnaja', 'Kyzyl',
    'Walbrzych', 'Swidnica', 'Klodzko', 'Raciborz', 'Gliwice', 'Brzeg',
    'Krnov', 'Hradec Kralove', 'Leuk', 'Brig', 'Brienz', 'Thun', 'Sarnen',
    'Burglen', 'Elm', 'Flims', 'Vals', 'Schuls', 'Zum Loch',
];

const TOOL_SHOPKEEPER_NAMES = [
    'Ymla', 'Eed-morra', 'Elan Lapinski', 'Cubask', 'Nieb', 'Bnowr Falr',
    'Sperc', 'Noskcirdneh', 'Yawolloh', 'Hyeghu', 'Niskal', 'Trahnil',
    'Htargcm', 'Enrobwem', 'Kachzi Rellim', 'Regien', 'Donmyar', 'Yelpur',
    'Nosnehpets', 'Stewe', 'Renrut', 'Senna Hut', '-Zlaw', 'Nosalnef',
    'Rewuorb', 'Rellenk', 'Yad', 'Cire Htims', 'Y-crad', 'Nenilukah',
    'Corsh', 'Aned', 'Dark Eery', 'Niknar', 'Lapu', 'Lechaim',
    'Rebrol-nek', 'AlliWar Wickson', 'Oguhmk', 'Telloc Cyaj',
];

const SHOPKEEPER_NAMES = [
    GENERAL_SHOPKEEPER_NAMES,
    ARMOR_SHOPKEEPER_NAMES,
    undefined,
    LIQUOR_SHOPKEEPER_NAMES,
];

function recorderLocalEpochSeconds(datetime) {
    if (!/^\d{14}$/.test(datetime || '')) return 0;
    const values = [
        Number(datetime.slice(0, 4)), Number(datetime.slice(4, 6)),
        Number(datetime.slice(6, 8)), Number(datetime.slice(8, 10)),
        Number(datetime.slice(10, 12)), Number(datetime.slice(12, 14)),
    ];
    const target = Date.UTC(values[0], values[1] - 1, values[2],
        values[3], values[4], values[5]);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    // The deterministic-recorder patch copies localtime(now) into struct tm
    // and then overwrites the fixed calendar fields without resetting
    // tm_isdst.  Preserve that inherited current New York offset rather than
    // applying the fixed date's historically correct DST offset.
    const currentEpoch = Math.trunc(Date.now() / 1000) * 1000;
    const currentParts = Object.fromEntries(
        formatter.formatToParts(new Date(currentEpoch))
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)]),
    );
    const currentLocalProjection = Date.UTC(
        currentParts.year, currentParts.month - 1, currentParts.day,
        currentParts.hour, currentParts.minute, currentParts.second,
    );
    const inheritedOffset = currentLocalProjection - currentEpoch;
    return Math.trunc((target - inheritedOffset) / 1000);
}

function shopkeeperIdentity(monster, names) {
    const ledger = ledgerNo(game.u?.uz);
    const nseed = Math.trunc(recorderLocalEpochSeconds(game.datetime) / 257);
    let wanted = (monster.m_id || 0) + ledger
        + (nseed % 13) - (nseed % 5);
    if (wanted < 0) wanted += 18;
    monster.female = !!(wanted & 1);
    const index = ((wanted % names.length) + names.length) % names.length;
    return names[index];
}

function getShopItem(shopIndex) {
    const table = SHOP_ITEM_TABLES[shopIndex] ?? SHOP_ITEM_TABLES[0];
    let roll = rnd(100);
    for (const [probability, itemType] of table) {
        roll -= probability;
        if (roll <= 0) return itemType;
    }
    return table[table.length - 1][1];
}

function vegetarianMonster(mndx) {
    const symbol = MONSTER_SYMBOL[mndx];
    return symbol === 2 // S_BLOB
        || symbol === 10 // S_JELLY
        || symbol === 22 // S_VORTEX
        || symbol === 25 // S_LIGHT
        || symbol === 32 // S_FUNGUS
        || symbol === 54 // S_GHOST/noncorporeal in this generated table
        || (symbol === 31 && mndx !== PM_STALKER) // S_ELEMENTAL
        || (symbol === 55
            && mndx !== PM_FLESH_GOLEM && mndx !== PM_LEATHER_GOLEM)
        || (symbol === 42 && mndx !== PM_BLACK_PUDDING); // S_PUDDING
}

function nonrottingTinContents(mndx) {
    return mndx === 6 // PM_ACID_BLOB
        || mndx === PM_LICHEN || mndx === PM_LIZARD
        || (mndx >= 311 && mndx <= 313); // Riders
}

function tinVarietyForStock(tin) {
    let variety;
    if (tin.spe === 1) return -1; // SPINACH_TIN
    if (tin.cursed) variety = 0;
    else if (tin.spe < 0) variety = -tin.spe - 1;
    else variety = rn2(15);
    if (variety === 1 && !tin.blessed && !rn2(7)) variety = 0;
    if (variety === 0 && nonrottingTinContents(tin.corpsenm)) variety = 1;
    return variety;
}

function makeHealthyTin(tin) {
    if ((tin.corpsenm ?? -1) < 0 || !vegetarianMonster(tin.corpsenm)) {
        tin.corpsenm = -1;
        tin.spe = 1;
        return;
    }
    const fodder = new Set([1, 2, 4, 5, 6, 7, 9, 13, 14]);
    let variety = tinVarietyForStock(tin);
    if (variety < 0 || variety >= 16) variety = 0;
    while ((variety === 0 && !tin.cursed) || !fodder.has(variety))
        variety = rn2(15);
    tin.spe = -(variety + 1);
}

// C ref: shknam.c shkveg()/mkveggy_at().  Corpses and tins use a vegetarian
// lichen stand-in while selecting an object type; actual tin contents are
// repaired after normal mksobj initialization.
function mkveggy_at(x, y) {
    const eligible = [];
    let totalProbability = 0;
    const first = OBJECT_BASES[FOOD_CLASS];
    const last = OBJECT_BASES[FOOD_CLASS + 1] - 1;
    for (let otyp = first; otyp <= last; otyp++) {
        if (OBJECT_MATERIAL[otyp] !== 3 // VEGGY
            && otyp !== EGG && otyp !== TIN && otyp !== CORPSE) continue;
        eligible.push(otyp);
        totalProbability += OBJECT_PROB[otyp];
    }
    let choice = rnd(totalProbability);
    let selected = eligible[0];
    for (const otyp of eligible) {
        selected = otyp;
        choice -= OBJECT_PROB[otyp];
        if (choice <= 0) break;
    }
    const object = mksobj_at(selected, x, y, true, true);
    if (object?.otyp === TIN) makeHealthyTin(object);
    return object;
}

async function stockShopRoom(sroom) {
    const shopDoor = goodShopDoor(sroom);
    if (!shopDoor) return;
    const shopIndex = sroom.rtype - SHOPBASE;
    const shopkeeper = await makemon(PM_SHOPKEEPER, shopDoor.x, shopDoor.y, 0);
    if (!shopkeeper) return;
    shopkeeper.eshk = {
        shoproom: (sroom.roomnoidx ?? -1) + ROOMOFFSET,
        shoptype: sroom.rtype,
        shoplevel: { ...game.u.uz },
        shd: { ...shopDoor.door },
        shk: { x: shopDoor.x, y: shopDoor.y },
    };
    // C isshk() is resident-extension identity, not species identity.  A
    // Wizard-forced out-of-context shopkeeper has no eshk and remains an
    // ordinary humanoid observer; shkinit() establishes both together here.
    shopkeeper.isshk = 1;
    sroom.resident = shopkeeper;

    // C ref: shkinit().  The gold object and possible charging scroll live
    // in the shopkeeper's inventory even though only their RNG-visible
    // initialization is needed by the current session.
    shopkeeper.gold = 1000 + 30 * rnd(100);
    linkObjectToMonsterInventory(
        shopkeeper, mksobj(GOLD_PIECE, false, false), { atFront: true },
    );
    if (shopIndex === 6)
        addObjectToMonsterInventory(
            shopkeeper, mksobj(TOUCHSTONE, true, false), game,
            { atFront: true },
        );
    if (shopIndex === 8 || shopIndex === 7
        || (shopIndex === 6 && rn2(2))
        || (shopIndex === 0 && rn2(5)))
        addObjectToMonsterInventory(
            shopkeeper, mksobj(SCR_CHARGING, true, false), game,
            { atFront: true },
        );
    const shopkeeperNames = SHOPKEEPER_NAMES[shopIndex];
    if (shopIndex === 8) {
        // nameshk() deliberately randomizes hardware-store names instead of
        // deriving one from birthday/ledger identity.  Leading '-' and '_'
        // encode a female shopkeeper; the other tool names encode male.
        const toolName = TOOL_SHOPKEEPER_NAMES[
            rn2(TOOL_SHOPKEEPER_NAMES.length)
        ];
        shopkeeper.female = toolName.startsWith('-')
            || toolName.startsWith('_');
        shopkeeper.eshk.shknam = toolName;
    } else if (shopkeeperNames) {
        shopkeeper.eshk.shknam = shopkeeperIdentity(shopkeeper, shopkeeperNames);
    }

    const doorLoc = game.level.at(shopDoor.door.x, shopDoor.door.y);
    if (doorLoc?.doormask === D_NODOOR) doorLoc.doormask = D_ISOPEN;
    if (doorLoc?.typ === SDOOR) doorLoc.typ = DOOR;
    if (doorLoc && (doorLoc.doormask & D_TRAPPED)) doorLoc.doormask = D_LOCKED;

    const stockPositions = [];
    for (let x = sroom.lx; x <= sroom.hx; x++)
        for (let y = sroom.ly; y <= sroom.hy; y++)
            if (stockRoomGoodPos(sroom, shopDoor, x, y))
                stockPositions.push({ x, y });

    // Tribute support begins enabled, but stock_room() stops selecting a
    // special square after the first bookstore successfully places a novel.
    // Non-book shops can consume this draw without satisfying bookstock.
    const specialSpot = !game._tributeBookstock && stockPositions.length
        ? rnd(stockPositions.length) : 0;
    let stockCount = 0;
    for (const pos of stockPositions) {
        stockCount++;
        // Tribute stocking is the first per-square branch in stock_room().
        // A selected book-shop square constructs its novel before the mimic
        // and ordinary shop-item reservoirs which begin with the next square.
        if (stockCount === specialSpot
            && (shopIndex === 2 || shopIndex === 9)) {
            mksobj_at(NOVEL, pos.x, pos.y, false, false);
            game._tributeBookstock = true;
            continue;
        }
        if (rn2(100) < depth_of_level(game.u?.uz)
            && !game.level.monsters?.some(mon => mon.mx === pos.x && mon.my === pos.y)) {
            const mimic = mkclass(S_MIMIC, 0);
            if (mimic != null) {
                await makemon(mimic, pos.x, pos.y, 0);
                continue;
            }
        }
        const atype = getShopItem(shopIndex);
        if (atype === VEGETARIAN_CLASS) {
            mkveggy_at(pos.x, pos.y);
        } else if (atype < 0) {
            mksobj_at(-atype, pos.x, pos.y, true, true);
        } else {
            mkobj_at(atype, pos.x, pos.y, true);
        }
    }
    // shknam.c:stock_room() makes Orcus's two shops into a ghost town after
    // stocking.  mongone() first probes every carried item for protected
    // objects, then discards the inventory and detaches the shopkeeper.
    if (game._activeSpecialLevel?.prototype === 'orcus') {
        discardSpecialMonsterInventory(shopkeeper);
        shopkeeper.mhp = 0;
        game.level.monsters = game.level.monsters.filter(
            monster => monster !== shopkeeper,
        );
        sroom.resident = null;
    }
    game.level.flags.has_shop = true;
}

async function fillSpecialRoom(croom) {
    if (!croom) return;
    for (const subroom of croom.sbrooms || [])
        await fillSpecialRoom(subroom);
    if (croom.needfill === FILL_NORMAL) {
        if (croom.rtype >= SHOPBASE) await stockShopRoom(croom);
        else if (croom.rtype === VAULT) fillVault(croom);
        else if (croom.rtype === COURT) await fillCourtRoom(croom);
        else if (croom.rtype === ZOO) await fillZooRoom(croom);
        else if (croom.rtype === BEEHIVE) await fillBeehiveRoom(croom);
        else if (croom.rtype === MORGUE) await fillMorgueRoom(croom);
        else if (croom.rtype === BARRACKS) await fillBarracksRoom(croom);
    }
    // FILL_LVFLAGS suppresses stocking but still publishes the special-room
    // level flag; FILL_NORMAL constructors above publish the same flag.
    if (croom.rtype === VAULT) game.level.flags.has_vault = true;
    else if (croom.rtype === COURT) game.level.flags.has_court = true;
    else if (croom.rtype === ZOO) game.level.flags.has_zoo = true;
    else if (croom.rtype === BEEHIVE)
        game.level.flags.has_beehive = true;
    else if (croom.rtype === MORGUE) game.level.flags.has_morgue = true;
    else if (croom.rtype === BARRACKS)
        game.level.flags.has_barracks = true;
    else if (croom.rtype === TEMPLE) game.level.flags.has_temple = true;
    else if (croom.rtype === SWAMP) game.level.flags.has_swamp = true;
}

function barracksMonsterType() {
    const probabilities = [
        [PM_SOLDIER, 80], [PM_SERGEANT, 15],
        [PM_LIEUTENANT, 4], [PM_CAPTAIN, 1],
    ];
    const selected = rnd(80 + level_difficulty());
    let cumulative = 0;
    let mndx = null;
    for (const [candidate, probability] of probabilities) {
        cumulative += probability;
        if (cumulative > selected) {
            mndx = candidate;
            break;
        }
    }
    if (mndx == null)
        mndx = probabilities[rn2(probabilities.length)][0];
    return ((game.mvitals?.[mndx]?.mvflags ?? 0) & 0x03)
        ? null : mndx;
}

async function fillBarracksRoom(room) {
    const entrance = room.doorct ? game.level.doors?.[room.fdoor] : null;
    const roomNumber = game.level.rooms.indexOf(room) + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = game.level.at(x, y);
            if (!loc) continue;
            if (room.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (entrance
                        && Math.max(Math.abs(x - entrance.x),
                            Math.abs(y - entrance.y)) <= 1))
                    continue;
            } else if (!SPACE_POS(loc.typ)
                || (entrance
                    && ((x === room.lx && entrance.x === x - 1)
                        || (x === room.hx && entrance.x === x + 1)
                        || (y === room.ly && entrance.y === y - 1)
                        || (y === room.hy && entrance.y === y + 1)))) {
                continue;
            }
            const mndx = barracksMonsterType();
            const monster = mndx == null ? null
                : await makemon(mndx, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster) monster.msleeping = 1;
            if (!rn2(20)) {
                mksobj_at(
                    rn2(3) ? LARGE_BOX : CHEST,
                    x, y, true, false,
                );
            }
        }
    }
    game.level.flags.has_barracks = true;
}

// C ref: mkroom.c fill_zoo(BEEHIVE).  The queen occupies the geometric
// center; every other eligible room square receives a sleeping, ungrouped
// killer bee, followed by that square's independent royal-jelly probe.
async function fillBeehiveRoom(croom) {
    const centerX = croom.lx + Math.trunc((croom.hx - croom.lx + 1) / 2);
    const centerY = croom.ly + Math.trunc((croom.hy - croom.ly + 1) / 2);
    const door = croom.doorct ? game.level.doors?.[croom.fdoor] : null;
    for (let x = croom.lx; x <= croom.hx; x++) {
        for (let y = croom.ly; y <= croom.hy; y++) {
            const loc = game.level.at(x, y);
            if (!loc || !SPACE_POS(loc.typ)) continue;
            if (door && ((x === croom.lx && door.x === x - 1)
                || (x === croom.hx && door.x === x + 1)
                || (y === croom.ly && door.y === y - 1)
                || (y === croom.hy && door.y === y + 1)))
                continue;
            const mndx = x === centerX && y === centerY ? 5 : 1;
            const monster = await makemon(
                mndx, x, y, MM_ASLEEP | MM_NOGRP,
            );
            if (monster) monster.msleeping = 1;
            if (!rn2(3))
                mksobj_at(LUMP_OF_ROYAL_JELLY, x, y, true, false);
        }
    }
    game.level.flags.has_beehive = true;
}

// ============================================================
// Rogue level generation (C: extralev.c)
// ============================================================

function rogueCorrCell(x, y) {
    const loc = game.level?.at(x, y);
    if (loc) loc.typ = rn2(50) ? CORR : SCORR;
}

function roguejoin(x1, y1, x2, y2, horiz) {
    if (horiz) {
        const middle = x1 + rn2(x2 - x1 + 1);
        for (let x = Math.min(x1, middle); x <= Math.max(x1, middle); x++)
            rogueCorrCell(x, y1);
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
            rogueCorrCell(middle, y);
        for (let x = Math.min(middle, x2); x <= Math.max(middle, x2); x++)
            rogueCorrCell(x, y2);
    } else {
        const middle = y1 + rn2(y2 - y1 + 1);
        for (let y = Math.min(y1, middle); y <= Math.max(y1, middle); y++)
            rogueCorrCell(x1, y);
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
            rogueCorrCell(x, middle);
        for (let y = Math.min(middle, y2); y <= Math.max(middle, y2); y++)
            rogueCorrCell(x2, y);
    }
}

function roguecorr(grid, x, y, dir) {
    let fromx, fromy, tox, toy;
    const source = grid[x][y];
    if (dir === XL_DOWN) {
        source.doortable &= ~XL_DOWN;
        if (!source.real) {
            fromx = source.rlx + 1 + 26 * x;
            fromy = source.rly + 7 * y;
        } else {
            fromx = source.rlx + rn2(source.dx) + 1 + 26 * x;
            fromy = source.rly + source.dy + 7 * y;
            dodoor(fromx, fromy, game.level.rooms[source.nroom]);
            game.level.at(fromx, fromy).doormask = D_NODOOR;
            fromy++;
        }
        if (y >= 2) return;
        const dest = grid[x][++y];
        dest.doortable &= ~XL_UP;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        } else {
            tox = dest.rlx + rn2(dest.dx) + 1 + 26 * x;
            toy = dest.rly - 1 + 7 * y;
            dodoor(tox, toy, game.level.rooms[dest.nroom]);
            game.level.at(tox, toy).doormask = D_NODOOR;
            toy--;
        }
        roguejoin(fromx, fromy, tox, toy, false);
        return;
    }
    if (dir === XL_RIGHT) {
        source.doortable &= ~XL_RIGHT;
        if (!source.real) {
            fromx = source.rlx + 1 + 26 * x;
            fromy = source.rly + 7 * y;
        } else {
            fromx = source.rlx + source.dx + 1 + 26 * x;
            fromy = source.rly + rn2(source.dy) + 7 * y;
            dodoor(fromx, fromy, game.level.rooms[source.nroom]);
            game.level.at(fromx, fromy).doormask = D_NODOOR;
            fromx++;
        }
        if (x >= 2) return;
        const dest = grid[++x][y];
        dest.doortable &= ~XL_LEFT;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        } else {
            tox = dest.rlx - 1 + 1 + 26 * x;
            toy = dest.rly + rn2(dest.dy) + 7 * y;
            dodoor(tox, toy, game.level.rooms[dest.nroom]);
            game.level.at(tox, toy).doormask = D_NODOOR;
            tox--;
        }
        roguejoin(fromx, fromy, tox, toy, true);
    }
}

// Modified walkfrom() from mkmaze.c.  Preserve the recursive walk and its
// left/right/up/down candidate order: revisiting a cell can add the intended
// one-in-ten extra connection and therefore owns observable RNG calls.
function rogueMiniwalk(grid, x, y) {
    while (true) {
        const dirs = [];
        const here = grid[x][y];
        if (x > 0 && !(here.doortable & XL_LEFT)
            && (!grid[x - 1][y].doortable || !rn2(10)))
            dirs.push(XL_LEFT);
        if (x < 2 && !(here.doortable & XL_RIGHT)
            && (!grid[x + 1][y].doortable || !rn2(10)))
            dirs.push(XL_RIGHT);
        if (y > 0 && !(here.doortable & XL_UP)
            && (!grid[x][y - 1].doortable || !rn2(10)))
            dirs.push(XL_UP);
        if (y < 2 && !(here.doortable & XL_DOWN)
            && (!grid[x][y + 1].doortable || !rn2(10)))
            dirs.push(XL_DOWN);
        if (!dirs.length) return;

        const dir = dirs[rn2(dirs.length)];
        if (dir === XL_LEFT) {
            here.doortable |= XL_LEFT;
            grid[--x][y].doortable |= XL_RIGHT;
        } else if (dir === XL_RIGHT) {
            here.doortable |= XL_RIGHT;
            grid[++x][y].doortable |= XL_LEFT;
        } else if (dir === XL_UP) {
            here.doortable |= XL_UP;
            grid[x][--y].doortable |= XL_DOWN;
        } else {
            here.doortable |= XL_DOWN;
            grid[x][++y].doortable |= XL_UP;
        }
        rogueMiniwalk(grid, x, y);
    }
}

function makeroguerooms() {
    const g = game;
    const grid = Array.from({ length: 3 }, () => new Array(3));
    let realRooms = 0;

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const room = { doortable: 0 };
            grid[x][y] = room;
            if (!rn2(5) && (realRooms || (x < 2 && y < 2))) {
                room.real = false;
                room.rlx = rn1(22, 2);
                room.rly = rn1(y === 2 ? 4 : 3, 2);
            } else {
                room.real = true;
                room.dx = rn1(22, 2);
                room.dy = rn1(y === 2 ? 4 : 3, 2);
                room.rlx = rnd(23 - room.dx + 1);
                room.rly = rnd((y === 2 ? 5 : 4) - room.dy + 1);
                realRooms++;
            }
        }
    }

    rogueMiniwalk(grid, rn2(3), rn2(3));
    g.level.nroom = 0;
    g.level.rooms = [];
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const room = grid[x][y];
            if (!room.real) continue;
            room.nroom = g.level.nroom;
            g.smeq[g.level.nroom] = g.level.nroom;
            const lowx = 1 + 26 * x + room.rlx;
            const lowy = 7 * y + room.rly;
            add_room(
                lowx, lowy,
                lowx + room.dx - 1, lowy + room.dy - 1,
                !rn2(7), OROOM, false,
            );
        }
    }

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const room = grid[x][y];
            if (room.doortable & XL_DOWN)
                roguecorr(grid, x, y, XL_DOWN);
            if (room.doortable & XL_RIGHT)
                roguecorr(grid, x, y, XL_RIGHT);
        }
    }
}

function roguename() {
    return rn2(3)
        ? (rn2(2) ? 'Michael Toy' : 'Kenneth Arnold')
        : 'Glenn Wichman';
}

async function makerogueghost() {
    const g = game;
    if (!g.level.nroom) return;
    const croom = g.level.rooms[rn2(g.level.nroom)];
    const x = somex(croom), y = somey(croom);
    const ghost = await makemon(287, x, y, 0); // PM_GHOST
    if (!ghost) return;
    ghost.msleeping = 1;
    ghost.name = roguename();

    let ghostobj;
    if (rn2(4)) {
        ghostobj = mksobj_at(FOOD_RATION, x, y, false, false);
        ghostobj.quan = rnd(7);
        ghostobj.quantity = ghostobj.quan;
        ghostobj.owt = (OBJECT_WEIGHT[FOOD_RATION] ?? 1) * ghostobj.quan;
    }
    if (rn2(2)) {
        ghostobj = mksobj_at(MACE, x, y, false, false);
        ghostobj.spe = rnd(3);
        if (rn2(4)) curseObjectState(ghostobj);
    } else {
        ghostobj = mksobj_at(TWO_HANDED_SWORD, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (rn2(4)) curseObjectState(ghostobj);
    }
    ghostobj = mksobj_at(BOW, x, y, false, false);
    ghostobj.spe = 1;
    if (rn2(4)) curseObjectState(ghostobj);

    ghostobj = mksobj_at(ARROW, x, y, false, false);
    ghostobj.spe = 0;
    ghostobj.quan = rn1(10, 25);
    ghostobj.quantity = ghostobj.quan;
    ghostobj.owt = (OBJECT_WEIGHT[ARROW] ?? 1) * ghostobj.quan;
    if (rn2(4)) curseObjectState(ghostobj);

    if (rn2(2)) {
        ghostobj = mksobj_at(RING_MAIL, x, y, false, false);
        ghostobj.spe = rn2(3);
        if (!rn2(3)) ghostobj.oerodeproof = true;
        if (rn2(4)) curseObjectState(ghostobj);
    } else {
        ghostobj = mksobj_at(PLATE_MAIL, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (!rn2(3)) ghostobj.oerodeproof = true;
        if (rn2(4)) curseObjectState(ghostobj);
    }
    if (rn2(2)) {
        ghostobj = mksobj_at(
            FAKE_AMULET_OF_YENDOR, x, y, true, false,
        );
        ghostobj.known = true;
    }
}

// C ref: mklev.c makerooms()
async function makerooms() {
    const g = game;
    let tried_vault = false;
    let themeroom_tries = 0;

    while (g.level.nroom < (MAXNROFROOMS - 1) && rnd_rect()) {
        if (g.level.nroom >= Math.trunc(MAXNROFROOMS / 6) && rn2(2) && !tried_vault) {
            tried_vault = true;
            if (create_vault()) {
                g.vault_x = g.level.rooms[g.level.nroom]?.lx ?? -1;
                g.vault_y = g.level.rooms[g.level.nroom]?.ly ?? -1;
                if (g.level.rooms[g.level.nroom]) g.level.rooms[g.level.nroom].hx = -1;
            }
        } else {
            g.in_mk_themerooms = true;
            const generated = await themerooms_generate();
            g.in_mk_themerooms = false;
            if (!generated) {
                if (themeroom_tries++ > 10
                    || g.level.nroom >= Math.trunc(MAXNROFROOMS / 6))
                    break;
            }
        }
    }
    g.in_mk_themerooms = false;
    await callLuaThemerooms('post_themerooms_generate');
}

function themedMapTerrain(ch) {
    if (ch === '.') return ROOM;
    if (ch === '-') return HWALL;
    if (ch === '|') return VWALL;
    if (ch === 'L') return LAVAPOOL;
    if (ch === 'P') return POOL;
    if (ch === '}') return MOAT;
    if (ch === ' ') return STONE;
    return null; // 'x' and any unsupported map character are see-through
}

function themedMapFits(rows, xstart, ystart) {
    const width = Math.max(...rows.map(row => row.length));
    const height = rows.length;
    for (let y = ystart - 1; y <= ystart + height; y++) {
        for (let x = xstart - 1; x <= xstart + width; x++) {
            if (!isok(x, y)) return false;
            const loc = game.level?.at(x, y);
            if (!loc) return false;
            const outside = x < xstart || x >= xstart + width
                || y < ystart || y >= ystart + height;
            if (outside) {
                if (loc.typ !== STONE || loc.roomno) return false;
                continue;
            }
            const terrain = themedMapTerrain(rows[y - ystart]?.[x - xstart]);
            if (terrain == null) continue;
            if ((loc.typ !== STONE && loc.typ !== terrain) || loc.roomno)
                return false;
        }
    }
    return true;
}

function placeThemedMap(rows) {
    const width = Math.max(...rows.map(row => row.length));
    const height = rows.length;
    let xstart = 0, ystart = 0;
    for (let tryct = 0; tryct <= 100; tryct++) {
        xstart = 1 + rn2(COLNO - 1 - width);
        ystart = rn2(ROWNO - height);
        if (themedMapFits(rows, xstart, ystart)) break;
        if (tryct === 100) return null;
    }
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const terrain = themedMapTerrain(rows[row]?.[col]);
            if (terrain == null) continue;
            const loc = game.level.at(xstart + col, ystart + row);
            loc.typ = terrain;
            loc.flags = 0;
            // sp_lev.c:lspo_map() clears the record, then sel_set_ter()
            // restores orientation for horizontal walls.  A later dosdoor()
            // can turn this wall into an SDOOR and deliberately retain it.
            loc.horizontal = terrain === HWALL;
            loc.roomno = 0;
            loc.edge = false;
            loc.lit = false;
        }
    }
    return { xstart, ystart, width, height };
}

function luaSelectionCoordinates(selection) {
    const coordinates = [];
    selection.forEachLua((x, y) => coordinates.push({ x, y }));
    return coordinates;
}

async function themerooms_generate() {
    const session = activeThemes.get(game)?.session;
    session?.beginRoom();
    const roomsBefore = game.level.nroom;
    const subroomsBefore = game.level.nsubroom;
    await callLuaThemerooms('themerooms_generate');
    if (session?.roomFailed()) return false;
    return game.level.nroom !== roomsBefore
        || game.level.nsubroom !== subroomsBefore;
}

// C ref: sp_lev.c check_room()
function check_room(lowx, ddx, lowy, ddy, vault) {
    const map = game.level;
    let hix = lowx.v + ddx.v, hiy = lowy.v + ddy.v;
    const xlim = XLIM + (vault ? 1 : 0);
    const ylim = YLIM + (vault ? 1 : 0);
    const s_lowx = lowx.v, s_ddx = ddx.v;
    const s_lowy = lowy.v, s_ddy = ddy.v;
    if (lowx.v < 3) lowx.v = 3;
    if (lowy.v < 2) lowy.v = 2;
    if (hix > COLNO - 3) hix = COLNO - 3;
    if (hiy > ROWNO - 3) hiy = ROWNO - 3;
    for (;;) {
        if (hix <= lowx.v || hiy <= lowy.v) return false;
        if (game.in_mk_themerooms
            && s_lowx !== lowx.v && s_ddx !== ddx.v
            && s_lowy !== lowy.v && s_ddy !== ddy.v) {
            return false;
        }
        let retry = false;
        for (let x = lowx.v - xlim; x <= hix + xlim && !retry; x++) {
            if (x <= 0 || x >= COLNO) continue;
            let y = Math.max(lowy.v - ylim, 0);
            const ymax = Math.min(hiy + ylim, ROWNO - 1);
            for (; y <= ymax; y++) {
                const loc = map.at(x, y);
                if (loc && loc.typ !== STONE) {
                    if (!rn2(3)) return false;
                    if (game.in_mk_themerooms) return false;
                    if (x < lowx.v) lowx.v = x + xlim + 1;
                    else hix = x - xlim - 1;
                    if (y < lowy.v) lowy.v = y + ylim + 1;
                    else hiy = y - ylim - 1;
                    retry = true;
                    break;
                }
            }
        }
        if (!retry) break;
    }
    ddx.v = hix - lowx.v;
    ddy.v = hiy - lowy.v;
    if (game.in_mk_themerooms
        && s_lowx !== lowx.v && s_ddx !== ddx.v
        && s_lowy !== lowy.v && s_ddy !== ddy.v) {
        return false;
    }
    return true;
}

// C ref: sp_lev.c create_room()
function create_room(x, y, w, h, xal, yal, rtype, rlit) {
    const g = game;
    let xabs = 0, yabs = 0;
    let r1 = null, r2 = null;
    let wtmp, htmp;
    let trycnt = 0;
    let vault = false;
    let xlim = XLIM, ylim = YLIM;
    if (rtype === -1) rtype = OROOM;
    if (rtype === VAULT) {
        vault = true;
        xlim++;
        ylim++;
    }
    rlit = litstate_rnd(rlit);
    do {
        wtmp = w; htmp = h;
        let xtmp = x, ytmp = y;
        let xaltmp = xal, yaltmp = yal;
        if ((xtmp < 0 && ytmp < 0 && wtmp < 0 && xaltmp < 0 && yaltmp < 0) || vault) {
            r1 = rnd_rect();
            if (!r1) return false;
            const hx = r1.hx, hy = r1.hy, lx = r1.lx, ly = r1.ly;
            let dx, dy;
            if (vault) {
                dx = dy = 1;
            } else {
                dx = 2 + rn2((hx - lx > 28) ? 12 : 8);
                dy = 2 + rn2(4);
                if (dx * dy > 50) dy = Math.trunc(50 / dx);
            }
            const xborder = (lx > 0 && hx < COLNO - 1) ? 2 * xlim : xlim + 1;
            const yborder = (ly > 0 && hy < ROWNO - 1) ? 2 * ylim : ylim + 1;
            if (hx - lx < dx + 3 + xborder || hy - ly < dy + 3 + yborder) {
                r1 = null;
                continue;
            }
            xabs = lx + (lx > 0 ? xlim : 3)
                   + rn2(hx - (lx > 0 ? lx : 3) - dx - xborder + 1);
            yabs = ly + (ly > 0 ? ylim : 2)
                   + rn2(hy - (ly > 0 ? ly : 2) - dy - yborder + 1);
            if (ly === 0 && hy >= ROWNO - 1
                && (!g.level.nroom || !rn2(g.level.nroom))
                && (yabs + dy > Math.trunc(ROWNO / 2))) {
                yabs = rn1(3, 2);
                if (g.level.nroom < 4 && dy > 1) dy--;
            }
            const lowx = { v: xabs }, ddx = { v: dx };
            const lowy = { v: yabs }, ddy = { v: dy };
            if (!check_room(lowx, ddx, lowy, ddy, vault)) {
                r1 = null;
                continue;
            }
            xabs = lowx.v;
            yabs = lowy.v;
            wtmp = ddx.v + 1;
            htmp = ddy.v + 1;
            r2 = { lx: xabs - 1, ly: yabs - 1, hx: xabs + wtmp, hy: yabs + htmp };
        } else {
            let rndpos = 0;
            if (xtmp < 0 && ytmp < 0) {
                xtmp = rnd(5);
                ytmp = rnd(5);
                rndpos = 1;
            }
            if (wtmp < 0 || htmp < 0) {
                wtmp = rn1(15, 3);
                htmp = rn1(8, 2);
            }
            if (xaltmp < 0) xaltmp = rnd(3);
            if (yaltmp < 0) yaltmp = rnd(3);

            xabs = Math.trunc(((xtmp - 1) * COLNO) / 5) + 1;
            yabs = Math.trunc(((ytmp - 1) * ROWNO) / 5) + 1;
            if (xaltmp === 5) xabs += Math.trunc(COLNO / 5) - wtmp;
            else if (xaltmp === 3)
                xabs += Math.trunc((Math.trunc(COLNO / 5) - wtmp) / 2);
            if (yaltmp === 5) yabs += Math.trunc(ROWNO / 5) - htmp;
            else if (yaltmp === 3)
                yabs += Math.trunc((Math.trunc(ROWNO / 5) - htmp) / 2);

            if (xabs + wtmp - 1 > COLNO - 2) xabs = COLNO - wtmp - 3;
            if (xabs < 2) xabs = 2;
            if (yabs + htmp - 1 > ROWNO - 2) yabs = ROWNO - htmp - 3;
            if (yabs < 2) yabs = 2;

            r2 = {
                lx: xabs - 1, ly: yabs - 1,
                hx: xabs + wtmp + rndpos,
                hy: yabs + htmp + rndpos,
            };
            r1 = get_rect(r2);
            const lowx = { v: xabs }, ddx = { v: wtmp };
            const lowy = { v: yabs }, ddy = { v: htmp };
            if (r1 && !check_room(lowx, ddx, lowy, ddy, vault)) r1 = null;
        }
    } while (++trycnt <= 100 && !r1);
    if (!r1) return false;
    split_rects(r1, r2);
    if (!vault) {
        g.smeq[g.level.nroom] = g.level.nroom;
        add_room(xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1, rlit, rtype, false);
    } else {
        if (!g.level.rooms[g.level.nroom]) g.level.rooms[g.level.nroom] = {};
        g.level.rooms[g.level.nroom].lx = xabs;
        g.level.rooms[g.level.nroom].ly = yabs;
    }
    return true;
}

// C refs: sp_lev.c create_subroom() and mklev.c add_subroom().  Subrooms
// share their parent's rectangle allocation but retain distinct room
// identity for shop/temple membership and recursive special-room filling.
function add_subroom(proom, lowx, lowy, hix, hiy, lit, rtype, special) {
    const g = game;
    const subroomIndex = g.level.nsubroom || 0;
    const croom = {
        lx: lowx, ly: lowy, hx: hix, hy: hiy,
        rtype, rlit: lit ? 1 : 0,
        doorct: 0, fdoor: g.level.doorindex,
        irregular: false, needjoining: !special,
        nsubrooms: 0, sbrooms: [],
        roomnoidx: MAXNROFROOMS + subroomIndex,
        needfill: 0,
    };
    do_room_or_subroom(
        croom, lowx, lowy, hix, hiy, lit, rtype, special, false,
    );
    proom.sbrooms[proom.nsubrooms++] = croom;
    g.level.subrooms[subroomIndex] = croom;
    g.level.nsubroom = subroomIndex + 1;
    return croom;
}

function create_subroom(proom, x, y, w, h, rtype, rlit) {
    const width = proom.hx - proom.lx + 1;
    const height = proom.hy - proom.ly + 1;
    if (width < 4 || height < 4) return null;
    if (w < 0) w = rnd(width - 3);
    if (h < 0) h = rnd(height - 3);
    if (x < 0) x = rnd(width - w);
    if (y < 0) y = rnd(height - h);
    if (x === 1) x = 0;
    if (y === 1) y = 0;
    if (x + w + 1 === width) x++;
    if (y + h + 1 === height) y++;
    if (rtype < 0) rtype = OROOM;
    rlit = litstate_rnd(rlit);
    return add_subroom(
        proom,
        proom.lx + x, proom.ly + y,
        proom.lx + x + w - 1, proom.ly + y + h - 1,
        rlit, rtype, false,
    );
}

function create_vault() {
    return create_room(-1, -1, 2, 2, -1, -1, VAULT, true);
}

// C ref: mklev.c add_room()
function add_room(lowx, lowy, hix, hiy, lit, rtype, special) {
    const g = game;
    const croom = {
        lx: lowx, ly: lowy, hx: hix, hy: hiy,
        rtype, rlit: lit ? 1 : 0,
        doorct: 0, fdoor: g.level.doorindex,
        irregular: false, needjoining: !special,
        nsubrooms: 0, sbrooms: [],
        roomnoidx: g.level.nroom,
        needfill: 0,
    };
    do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special, true);
    g.level.rooms[g.level.nroom] = croom;
    g.level.nroom++;
    if (g.level.nroom < MAXNROFROOMS) {
        g.level.rooms[g.level.nroom] = { hx: -1 };
    }
    return croom;
}

// C ref: mklev.c do_room_or_subroom()
function do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, _rtype, special, is_room) {
    const map = game.level;
    if (!lowx) lowx++;
    if (!lowy) lowy++;
    if (hix >= COLNO - 1) hix = COLNO - 2;
    if (hiy >= ROWNO - 1) hiy = ROWNO - 2;
    if (lit) {
        for (let x = lowx - 1; x <= hix + 1; x++)
            for (let y = Math.max(lowy - 1, 0); y <= hiy + 1; y++)
                if (map.at(x, y)) map.at(x, y).lit = true;
        croom.rlit = 1;
    } else {
        croom.rlit = 0;
    }
    croom.lx = lowx; croom.hx = hix;
    croom.ly = lowy; croom.hy = hiy;
    croom.rtype = _rtype;
    croom.doorct = 0;
    croom.fdoor = game.level.doorindex;
    croom.irregular = false;
    croom.nsubrooms = 0;
    croom.sbrooms = [];
    if (!special) {
        croom.needjoining = true;
        for (let x = lowx - 1; x <= hix + 1; x++)
            for (let y = lowy - 1; y <= hiy + 1; y += (hiy - lowy + 2)) {
                const loc = map.at(x, y);
                if (loc) { loc.typ = HWALL; loc.horizontal = true; }
            }
        for (let x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2))
            for (let y = lowy; y <= hiy; y++) {
                const loc = map.at(x, y);
                if (loc) { loc.typ = VWALL; loc.horizontal = false; }
            }
        for (let x = lowx; x <= hix; x++)
            for (let y = lowy; y <= hiy; y++) {
                const loc = map.at(x, y);
                if (loc) loc.typ = ROOM;
            }
        if (is_room) {
            const tl = map.at(lowx - 1, lowy - 1);
            const tr = map.at(hix + 1, lowy - 1);
            const bl = map.at(lowx - 1, hiy + 1);
            const br = map.at(hix + 1, hiy + 1);
            if (tl) tl.typ = TLCORNER;
            if (tr) tr.typ = TRCORNER;
            if (bl) bl.typ = BLCORNER;
            if (br) br.typ = BRCORNER;
        } else {
            wallification(lowx - 1, lowy - 1, hix + 1, hiy + 1);
        }
    }
}

// C ref: mklev.c sort_rooms()
function sort_rooms() {
    const g = game;
    const n = g.level.nroom;
    const oldToNew = new Array(n).fill(0);
    const liveRooms = g.level.rooms.slice(0, n)
        .sort((a, b) => (a?.lx || 0) - (b?.lx || 0));
    g.level.rooms = liveRooms;
    if (n < MAXNROFROOMS) g.level.rooms[n] = { hx: -1 };
    for (let i = 0; i < n; i++) {
        if (g.level.rooms[i]) {
            oldToNew[g.level.rooms[i].roomnoidx] = i;
            g.level.rooms[i].roomnoidx = i;
        }
    }
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const loc = g.level.at(x, y);
            const rno = loc?.roomno ?? 0;
            if (rno >= ROOMOFFSET && rno < MAXNROFROOMS + 1) {
                loc.roomno = oldToNew[rno - ROOMOFFSET] + ROOMOFFSET;
            }
        }
}

// C ref: mklev.c topologize()
function topologize(croom) {
    if (!croom || croom.irregular) return;
    const roomno = (croom.roomnoidx ?? -1) + ROOMOFFSET;
    const lowx = croom.lx, lowy = croom.ly;
    const hix = croom.hx, hiy = croom.hy;
    if (!game.level || roomno < ROOMOFFSET) return;
    if ((game.level.at(lowx, lowy)?.roomno ?? 0) === roomno) return;
    const interiorRoomno = Is_rogue_level(game.u?.uz)
        && croom.rtype === OROOM ? 0 : roomno;
    for (let x = lowx; x <= hix; x++)
        for (let y = lowy; y <= hiy; y++) {
            const loc = game.level.at(x, y);
            if (loc) loc.roomno = interiorRoomno;
        }
    for (let x = lowx - 1; x <= hix + 1; x++)
        for (let y = lowy - 1; y <= hiy + 1; y += (hiy - lowy + 2)) {
            const loc = game.level.at(x, y);
            if (loc) { loc.edge = true; loc.roomno = loc.roomno ? SHARED : roomno; }
        }
    for (let x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2))
        for (let y = lowy; y <= hiy; y++) {
            const loc = game.level.at(x, y);
            if (loc) { loc.edge = true; loc.roomno = loc.roomno ? SHARED : roomno; }
        }
}

// ============================================================
// Corridors
// ============================================================

function good_rm_wall_doorpos(x, y, dir, room) {
    const map = game.level;
    const rmno = game.level.rooms.indexOf(room) + ROOMOFFSET;
    if (!isok(x, y) || !room.needjoining) return false;
    const loc = map.at(x, y);
    if (!loc) return false;
    if (!(loc.typ === HWALL || loc.typ === VWALL || IS_DOOR(loc.typ) || loc.typ === SDOOR))
        return false;
    if (bydoor(x, y)) return false;
    const tx = x + xdir[dir], ty = y + ydir[dir];
    if (!isok(tx, ty)) return false;
    const tloc = map.at(tx, ty);
    if (!tloc || IS_OBSTRUCTED(tloc.typ)) return false;
    if (rmno !== tloc.roomno) return false;
    return true;
}

function finddpos_shift(xp, yp, dir, aroom) {
    const rdir = DIR_180(dir);
    if (good_rm_wall_doorpos(xp.v, yp.v, rdir, aroom)) return true;
    // An irregular room's actual wall can sit inside its rectangular bounds.
    // Walk inward across untouched stone/corridor cells until that wall is
    // reached, exactly as mklev.c finddpos_shift() does.
    if (aroom.irregular) {
        const dx = xdir[rdir], dy = ydir[rdir];
        let rx = xp.v, ry = yp.v;
        let fail = false;
        while (!fail && isok(rx, ry)) {
            const current = game.level.at(rx, ry);
            if (!current || (current.typ !== STONE && current.typ !== CORR)) break;
            rx += dx;
            ry += dy;
            if (good_rm_wall_doorpos(rx, ry, rdir, aroom)) {
                xp.v = rx;
                yp.v = ry;
                return true;
            }
            const advanced = game.level.at(rx, ry);
            if (!advanced || (advanced.typ !== STONE && advanced.typ !== CORR))
                fail = true;
            if (rx < aroom.lx || rx > aroom.hx
                || ry < aroom.ly || ry > aroom.hy)
                fail = true;
        }
    }
    return false;
}

// C ref: mklev.c finddpos()
function finddpos(cc, dir, aroom) {
    let x1, y1, x2, y2;
    switch (dir) {
    case DIR_N: x1 = aroom.lx; x2 = aroom.hx; y1 = y2 = aroom.ly - 1; break;
    case DIR_S: x1 = aroom.lx; x2 = aroom.hx; y1 = y2 = aroom.hy + 1; break;
    case DIR_W: x1 = x2 = aroom.lx - 1; y1 = aroom.ly; y2 = aroom.hy; break;
    case DIR_E: x1 = x2 = aroom.hx + 1; y1 = aroom.ly; y2 = aroom.hy; break;
    default: return false;
    }
    let tryct = 0;
    let x, y;
    do {
        x = (x2 - x1) ? rn1(x2 - x1 + 1, x1) : x1;
        y = (y2 - y1) ? rn1(y2 - y1 + 1, y1) : y1;
        const xp = { v: x }, yp = { v: y };
        if (finddpos_shift(xp, yp, dir, aroom)) {
            cc.x = xp.v; cc.y = yp.v;
            return true;
        }
    } while (++tryct < 20);
    for (x = x1; x <= x2; x++)
        for (y = y1; y <= y2; y++) {
            const xp = { v: x }, yp = { v: y };
            if (finddpos_shift(xp, yp, dir, aroom)) {
                cc.x = xp.v; cc.y = yp.v;
                return true;
            }
        }
    cc.x = x1; cc.y = y1;
    return false;
}

function maybe_sdoor(chance) {
    const d = depth_of_level(game.u?.uz);
    return (d > 2) && !rn2(Math.max(2, chance));
}

// C ref: sp_lev.c dig_corridor()
export function dig_corridor(org, dest, npoints_out, nxcor, ftyp, btyp) {
    const map = game.level;
    let dx = 0, dy = 0;
    let xx = org.x, yy = org.y;
    const tx = dest.x, ty = dest.y;
    let npoints = 0;
    if (npoints_out) npoints_out.v = 0;
    if (xx <= 0 || yy <= 0 || tx <= 0 || ty <= 0
        || xx > COLNO - 1 || tx > COLNO - 1 || yy > ROWNO - 1 || ty > ROWNO - 1)
        return false;
    if (tx > xx) dx = 1;
    else if (ty > yy) dy = 1;
    else if (tx < xx) dx = -1;
    else dy = -1;
    xx -= dx; yy -= dy;
    let cct = 0;
    while (xx !== tx || yy !== ty) {
        if (cct++ > 500 || (nxcor && !rn2(35))) return false;
        xx += dx; yy += dy;
        if (xx >= COLNO - 1 || xx <= 0 || yy <= 0 || yy >= ROWNO - 1) return false;
        const crm = map.at(xx, yy);
        if (!crm) return false;
        if (crm.typ === btyp) {
            if (ftyp === CORR && maybe_sdoor(100)) {
                npoints++;
                if (npoints_out) npoints_out.v = npoints;
                crm.typ = SCORR;
            } else {
                npoints++;
                if (npoints_out) npoints_out.v = npoints;
                crm.typ = ftyp;
                if (nxcor && !rn2(50)) {
                    mksobj_at(BOULDER, xx, yy, true, false);
                }
            }
        } else if (crm.typ !== ftyp && crm.typ !== SCORR) {
            return false;
        }
        let dix = Math.abs(xx - tx);
        let diy = Math.abs(yy - ty);
        if ((dix > diy) && diy && !rn2(dix - diy + 1)) dix = 0;
        else if ((diy > dix) && dix && !rn2(diy - dix + 1)) diy = 0;
        if (dy && dix > diy) {
            const ddx = (xx > tx) ? -1 : 1;
            const ncr = map.at(xx + ddx, yy);
            if (ncr && (ncr.typ === btyp || ncr.typ === ftyp || ncr.typ === SCORR)) {
                dx = ddx; dy = 0; continue;
            }
        } else if (dx && diy > dix) {
            const ddy = (yy > ty) ? -1 : 1;
            const ncr = map.at(xx, yy + ddy);
            if (ncr && (ncr.typ === btyp || ncr.typ === ftyp || ncr.typ === SCORR)) {
                dy = ddy; dx = 0; continue;
            }
        }
        const straight = map.at(xx + dx, yy + dy);
        if (straight && (straight.typ === btyp || straight.typ === ftyp || straight.typ === SCORR))
            continue;
        if (dx) { dx = 0; dy = (ty < yy) ? -1 : 1; }
        else { dy = 0; dx = (tx < xx) ? -1 : 1; }
        const alt = map.at(xx + dx, yy + dy);
        if (alt && (alt.typ === btyp || alt.typ === ftyp || alt.typ === SCORR)) continue;
        dy = -dy; dx = -dx;
    }
    if (npoints_out) npoints_out.v = npoints;
    return true;
}

// C ref: mklev.c dosdoor()
function dosdoor(x, y, aroom, type) {
    const map = game.level;
    const loc = map.at(x, y);
    if (!loc) return;
    const shdoor = roomsAt(game.level, x, y).length > 0;
    if (!IS_WALL(loc.typ)) type = DOOR;
    loc.typ = type;
    if (type === DOOR) {
        if (!rn2(3)) {
            if (!rn2(5)) loc.doormask = D_ISOPEN;
            else if (!rn2(6)) loc.doormask = D_LOCKED;
            else loc.doormask = D_CLOSED;
            if (loc.doormask !== D_ISOPEN && !shdoor
                && level_difficulty() >= 5 && !rn2(25))
                loc.doormask |= D_TRAPPED;
        } else {
            loc.doormask = shdoor ? D_ISOPEN : D_NODOOR;
        }
        // Rogue doors are always open doorways.  This happens before the
        // trapped-door mimic check in C, suppressing that later constructor
        // without changing the door-state RNG sequence above.
        if (Is_rogue_level(game.u?.uz)) loc.doormask = D_NODOOR;
        if (loc.doormask & D_TRAPPED) {
            if (level_difficulty() >= 9 && !rn2(5)) {
                loc.doormask = D_NODOOR;
            }
        }
    } else {
        if (shdoor || !rn2(5)) loc.doormask = D_LOCKED;
        else loc.doormask = D_CLOSED;
        if (!shdoor && level_difficulty() >= 4 && !rn2(20))
            loc.doormask |= D_TRAPPED;
    }
    add_door(x, y, aroom);
}

function dodoor(x, y, aroom) {
    dosdoor(x, y, aroom, maybe_sdoor(8) ? SDOOR : DOOR);
}

function add_door(x, y, aroom) {
    const g = game;
    if (!g.level.doors) g.level.doors = [];
    for (let i = 0; i < aroom.doorct; i++) {
        const d = g.level.doors[aroom.fdoor + i];
        if (d && d.x === x && d.y === y) return;
    }
    if (aroom.doorct === 0) aroom.fdoor = g.level.doorindex;
    aroom.doorct++;
    for (let tmp = g.level.doorindex; tmp > aroom.fdoor; tmp--)
        g.level.doors[tmp] = g.level.doors[tmp - 1];
    for (const broom of g.level.rooms || []) {
        if (!broom || broom.hx <= 0 || broom === aroom || !(broom.doorct > 0)) continue;
        if ((broom.fdoor ?? 0) >= aroom.fdoor) broom.fdoor++;
    }
    g.level.doors[aroom.fdoor] = { x, y };
    g.level.doorindex++;
}

function bydoor(x, y) {
    const map = game.level;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!isok(x + dx, y + dy)) continue;
        const loc = map.at(x + dx, y + dy);
        if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR)) return true;
    }
    return false;
}

function okdoor(x, y) {
    const map = game.level;
    const loc = map.at(x, y);
    if (!loc) return false;
    if (!(loc.typ === HWALL || loc.typ === VWALL)) return false;
    if (bydoor(x, y)) return false;
    return (
        (isok(x - 1, y) && !IS_OBSTRUCTED(map.at(x - 1, y).typ))
        || (isok(x + 1, y) && !IS_OBSTRUCTED(map.at(x + 1, y).typ))
        || (isok(x, y - 1) && !IS_OBSTRUCTED(map.at(x, y - 1).typ))
        || (isok(x, y + 1) && !IS_OBSTRUCTED(map.at(x, y + 1).typ))
    );
}

// C ref: mklev.c join()
function join(a, b, nxcor) {
    const g = game;
    const croom = g.level.rooms[a];
    const troom = g.level.rooms[b];
    if (!croom || !troom) return;
    if (!croom.needjoining || !troom.needjoining) return;
    if (troom.hx < 0 || croom.hx < 0) return;
    let dx, dy;
    const cc = { x: 0, y: 0 }, tt = { x: 0, y: 0 };
    if (troom.lx > croom.hx) {
        dx = 1; dy = 0;
        if (!finddpos(cc, DIR_E, croom)) return;
        if (!finddpos(tt, DIR_W, troom)) return;
    } else if (troom.hy < croom.ly) {
        dy = -1; dx = 0;
        if (!finddpos(cc, DIR_N, croom)) return;
        if (!finddpos(tt, DIR_S, troom)) return;
    } else if (troom.hx < croom.lx) {
        dx = -1; dy = 0;
        if (!finddpos(cc, DIR_W, croom)) return;
        if (!finddpos(tt, DIR_E, troom)) return;
    } else {
        dy = 1; dx = 0;
        if (!finddpos(cc, DIR_S, croom)) return;
        if (!finddpos(tt, DIR_N, troom)) return;
    }
    const xx = cc.x, yy = cc.y;
    const tx = tt.x - dx, ty = tt.y - dy;
    if (nxcor) {
        const loc = game.level.at(xx + dx, yy + dy);
        if (loc && loc.typ !== STONE) return;
    }
    const org = { x: xx + dx, y: yy + dy };
    const dest = { x: tx, y: ty };
    const npoints = { v: 0 };
    const ftyp = CORR;
    const dig_result = dig_corridor(org, dest, npoints, nxcor, ftyp, STONE);
    if ((npoints.v > 0) && (okdoor(xx, yy) || !nxcor))
        dodoor(xx, yy, croom);
    if (!dig_result) return;
    if (okdoor(tt.x, tt.y) || !nxcor)
        dodoor(tt.x, tt.y, troom);
    if (g.smeq[a] < g.smeq[b]) g.smeq[b] = g.smeq[a];
    else g.smeq[a] = g.smeq[b];
}

// C ref: mklev.c makecorridors()
function makecorridors() {
    const g = game;
    let any = true;
    for (let i = 0; i < g.level.nroom; i++) g.smeq[i] = i;
    for (let a = 0; a < g.level.nroom - 1; a++) {
        join(a, a + 1, false);
        if (!rn2(50)) break;
    }
    for (let a = 0; a < g.level.nroom - 2; a++)
        if (g.smeq[a] !== g.smeq[a + 2]) join(a, a + 2, false);
    for (let a = 0; any && a < g.level.nroom; a++) {
        any = false;
        for (let b = 0; b < g.level.nroom; b++)
            if (g.smeq[a] !== g.smeq[b]) { join(a, b, false); any = true; }
    }
    if (g.level.nroom > 2) {
        const count = rn2(g.level.nroom) + 4;
        for (let i = 0; i < count; i++) {
            let a = rn2(g.level.nroom);
            let b = rn2(g.level.nroom - 2);
            if (b >= a) b += 2;
            join(a, b, true);
        }
    }
}

// ============================================================
// Stairs
// ============================================================

function generate_stairs_room_good(croom, phase) {
    if (!croom || croom.hx < 0) return false;
    if (!croom.needjoining && phase >= 0) return false;
    let hasDown = false, hasUp = false;
    for (let st = game.stairs; st; st = st.next) {
        const inRoom = st.sx >= croom.lx && st.sx <= croom.hx
            && st.sy >= croom.ly && st.sy <= croom.hy;
        if (!inRoom) continue;
        if (st.up) hasUp = true; else hasDown = true;
    }
    if (phase >= 1 && (hasDown || hasUp)) return false;
    if (croom.rtype !== OROOM && !(phase < 2 && croom.rtype === THEMEROOM)) return false;
    return true;
}

function generate_stairs_find_room() {
    const g = game;
    if (!g.level.nroom) return null;
    for (let phase = 2; phase > -1; phase--) {
        const candidates = [];
        for (let i = 0; i < g.level.nroom; i++)
            if (generate_stairs_room_good(g.level.rooms[i], phase))
                candidates.push(i);
        if (candidates.length > 0) {
            return g.level.rooms[candidates[rn2(candidates.length)]];
        }
    }
    return g.level.rooms[rn2(g.level.nroom)];
}

function mkstairs(x, y, up, croom) {
    const g = game;
    const currentLevel = g.u?.uz?.dlevel ?? 1;
    const dungeonLevels = g.dungeons?.[g.u?.uz?.dnum ?? 0]?.num_dunlevs
        ?? currentLevel;
    // Regular stairs cannot leave a dungeon at either end.  Branch
    // placement later installs the cross-dungeon stair on an entry level.
    if ((up && currentLevel === 1)
        || (!up && currentLevel === dungeonLevels))
        return;
    const loc = g.level.at(x, y);
    if (loc) {
        loc.typ = STAIRS;
        loc.ladder = up ? 1 : 2;
    }
    const dest = {
        dnum: g.u?.uz?.dnum ?? 0,
        dlevel: currentLevel + (up ? -1 : 1),
    };
    stairway_add(x, y, !!up, false, dest);
    if (up) g.level.upstair = { x, y };
    else g.level.dnstair = { x, y };
}

async function generate_stairs() {
    const g = game;
    const pos = { x: 0, y: 0 };
    // Down stairs
    {
        const croom = generate_stairs_find_room();
        if (croom) {
            if (!somexyspace(croom, pos)) {
                pos.x = somex(croom);
                pos.y = somey(croom);
            }
            mkstairs(pos.x, pos.y, 0, croom);
        }
    }
    // Up stairs only if not level 1
    if ((g.u?.uz?.dlevel ?? 1) !== 1) {
        const croom = generate_stairs_find_room();
        if (croom) {
            if (!somexyspace(croom, pos)) {
                pos.x = somex(croom);
                pos.y = somey(croom);
            }
            mkstairs(pos.x, pos.y, 1, croom);
        }
    }
}

// ============================================================
// Niches
// ============================================================

function cardinal_nextto_room(aroom, x, y) {
    const map = game.level;
    const rmno = game.level.rooms.indexOf(aroom) + ROOMOFFSET;
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        if (!isok(x + dx, y + dy)) continue;
        const loc = map.at(x + dx, y + dy);
        if (loc && !loc.edge && loc.roomno === rmno) return true;
    }
    return false;
}

function place_niche(aroom) {
    let dy;
    const dd = { x: 0, y: 0 };
    if (rn2(2)) {
        dy = 1;
        if (!finddpos(dd, DIR_S, aroom)) return null;
    } else {
        dy = -1;
        if (!finddpos(dd, DIR_N, aroom)) return null;
    }
    const xx = dd.x, yy = dd.y;
    const niche = game.level.at(xx, yy + dy);
    const back = game.level.at(xx, yy - dy);
    if (!niche || niche.typ !== STONE) return null;
    if (!back || IS_POOL(back.typ) || IS_FURNITURE(back.typ)) return null;
    if (!cardinal_nextto_room(aroom, xx, yy)) return null;
    return { dy, xx, yy };
}

async function makeniche(trap_type) {
    const g = game;
    let vct = 8;
    while (vct--) {
        const aroom = g.level.rooms[rn2(g.level.nroom)];
        if (!aroom || aroom.rtype !== OROOM) continue;
        if (aroom.doorct === 1 && rn2(5)) continue;
        const niche = place_niche(aroom);
        if (!niche) continue;
        const { dy, xx, yy } = niche;
        const rm = g.level.at(xx, yy + dy);
        if (!rm) continue;
        if (trap_type || !rn2(4)) {
            rm.typ = SCORR;
            if (trap_type) {
                let actualTrap = trap_type;
                if (is_hole(actualTrap) && !canFallThrough())
                    actualTrap = ROCKTRAP;
                const trap = await maketrap(xx, yy + dy, actualTrap);
                if (trap && actualTrap !== ROCKTRAP) trap.once = true;
                const trapEngraving = actualTrap === TRAPDOOR
                    ? 'Vlad was here'
                    : (actualTrap === TELEP_TRAP || actualTrap === LEVEL_TELEP)
                        ? 'ad aerarium' : null;
                if (trapEngraving) {
                    // C creates the niche warning first, then immediately ages
                    // it by five wipeout attempts.  Keep both the RNG ownership
                    // and the resulting engraving identity: monsters can erode
                    // this same text much later when they cross the square.
                    const wornText = wipeoutText(trapEngraving, 5)
                        .replace(/^ +/, '');
                    if (wornText) {
                        makeEngravingAt(
                            xx, yy - dy, wornText, null, 0, DUST,
                        );
                    }
                }
            }
            dosdoor(xx, yy, aroom, SDOOR);
        } else {
            rm.typ = CORR;
            if (rn2(7)) {
                dosdoor(xx, yy, aroom, rn2(5) ? SDOOR : DOOR);
            } else {
                const loc = g.level.at(xx, yy);
                if (!rn2(5) && loc && IS_WALL(loc.typ)) {
                    loc.typ = IRONBARS;
                    if (rn2(3)) {
                        const S_HUMAN = 53;
                        const human = mkclass(S_HUMAN, 0);
                        mkcorpstat(CORPSE, null, human, xx, yy + dy, 1);
                    }
                }
                if (!g.level.flags.noteleport) {
                    mksobj_at(SCR_TELEPORTATION, xx, yy + dy, true, false);
                }
                if (!rn2(3)) {
                    mkobj_at(RANDOM_CLASS, xx, yy + dy, true);
                }
            }
        }
        return;
    }
}

async function make_niches() {
    const g = game;
    let ct = rnd(Math.trunc(g.level.nroom / 2) + 1);
    let ltptr = ((g.u?.uz?.dlevel ?? 1) > 15);
    let vamp = ((g.u?.uz?.dlevel ?? 1) > 5 && (g.u?.uz?.dlevel ?? 1) < 25);
    while (ct--) {
        if (ltptr && !rn2(6)) {
            ltptr = false;
            await makeniche(LEVEL_TELEP);
        } else if (vamp && !rn2(6)) {
            vamp = false;
            await makeniche(TRAPDOOR);
        } else {
            await makeniche(NO_TRAP);
        }
    }
}

// ============================================================
// Branch placement
// ============================================================

function is_branchlev() {
    const g = game;
    if (!g.branches) return null;
    for (const br of g.branches) {
        if (br?.end1?.dnum === (g.u?.uz?.dnum ?? 0) && br?.end1?.dlevel === (g.u?.uz?.dlevel ?? 1)) return br;
        if (br?.end2?.dnum === (g.u?.uz?.dnum ?? 0) && br?.end2?.dlevel === (g.u?.uz?.dlevel ?? 1)) return br;
    }
    return null;
}

function find_branch_room(mp) {
    const croom = generate_stairs_find_room();
    if (croom) somexyspace(croom, mp);
    return croom;
}

async function placeBranchAt(branchp, x, y) {
    const g = game;
    if (!branchp || g.made_branch) return;
    const on_end1 = branchp.end1?.dnum === g.u?.uz?.dnum
        && branchp.end1?.dlevel === g.u?.uz?.dlevel;
    const dest = on_end1 ? branchp.end2 : branchp.end1;
    if (branchp.portal) {
        const portal = await maketrap(x, y, MAGIC_PORTAL);
        portal.dst = { ...(dest || { dnum: 0, dlevel: 0 }) };
    } else {
        const goes_up = on_end1 ? !!branchp.end1_up : !branchp.end1_up;
        const loc = g.level?.at(x, y);
        if (loc) {
            loc.typ = STAIRS;
            loc.ladder = goes_up ? 1 : 2;
        }
        stairway_add(x, y, goes_up, false,
            dest || { dnum: 0, dlevel: 0 });
        if (goes_up) g.level.upstair = { x, y };
        else g.level.dnstair = { x, y };
    }
    g.made_branch = true;
}

async function place_branch(branchp) {
    const g = game;
    const mp = { x: 0, y: 0 };
    const croom = find_branch_room(mp);
    if (croom && mp.x > 0) {
        await placeBranchAt(branchp, mp.x, mp.y);
        return;
    }
    g.made_branch = true;
}

// ============================================================
// Wallification
// ============================================================

function isSolidTile(x, y) {
    if (!isok(x, y)) return true;
    return IS_STWALL(game.level?.at(x, y)?.typ ?? STONE);
}
function isWallOrStone(x, y) {
    if (!isok(x, y)) return 1;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (typ === STONE || isWallTile(x, y)) ? 1 : 0;
}
function isWallTile(x, y) {
    if (!isok(x, y)) return 0;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (IS_WALL(typ) || IS_DOOR(typ) || typ === LAVAWALL
        || typ === WATER || typ === SDOOR || typ === IRONBARS) ? 1 : 0;
}
function extend_spine(locale, wall_there, dx, dy) {
    const nx = 1 + dx, ny = 1 + dy;
    if (!wall_there) return 0;
    if (dx) {
        if (locale[1][0] && locale[1][2] && locale[nx][0] && locale[nx][2]) return 0;
        return 1;
    }
    if (locale[0][1] && locale[2][1] && locale[0][ny] && locale[2][ny]) return 0;
    return 1;
}
function withinArea(x, y, area) {
    return !!area && x >= area.x1 && x <= area.x2
        && y >= area.y1 && y <= area.y2;
}

function wall_cleanup(x1, y1, x2, y2, protectedArea = null) {
    const map = game.level;
    if (!map) return;
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
            if (withinArea(x, y, protectedArea)) continue;
            const loc = map.at(x, y);
            const typ = loc?.typ ?? STONE;
            if (!(IS_WALL(typ) && typ !== DBWALL)) continue;
            if (isSolidTile(x-1,y-1) && isSolidTile(x-1,y) && isSolidTile(x-1,y+1)
                && isSolidTile(x,y-1) && isSolidTile(x,y+1)
                && isSolidTile(x+1,y-1) && isSolidTile(x+1,y) && isSolidTile(x+1,y+1))
                loc.typ = STONE;
        }
}
function fix_wall_spines(x1, y1, x2, y2, wallOnlyArea = null) {
    const spineArray = [VWALL, HWALL, HWALL, HWALL,
        VWALL, TRCORNER, TLCORNER, TDWALL,
        VWALL, BRCORNER, BLCORNER, TUWALL,
        VWALL, TLWALL, TRWALL, CROSSWALL];
    const map = game.level;
    if (!map) return;
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
            const loc = map.at(x, y);
            const typ = loc?.typ ?? STONE;
            if (!(IS_WALL(typ) && typ !== DBWALL)) continue;
            const probe = withinArea(x, y, wallOnlyArea)
                ? isWallTile : isWallOrStone;
            const locale = [
                [probe(x-1,y-1), probe(x-1,y), probe(x-1,y+1)],
                [probe(x,y-1), 0, probe(x,y+1)],
                [probe(x+1,y-1), probe(x+1,y), probe(x+1,y+1)],
            ];
            const bits = (extend_spine(locale, isWallTile(x,y-1), 0, -1) << 3)
                | (extend_spine(locale, isWallTile(x,y+1), 0, 1) << 2)
                | (extend_spine(locale, isWallTile(x+1,y), 1, 0) << 1)
                | extend_spine(locale, isWallTile(x-1,y), -1, 0);
            if (bits) loc.typ = spineArray[bits];
        }
}
function wallification(x1, y1, x2, y2, protectedArea = null) {
    wall_cleanup(x1, y1, x2, y2, protectedArea);
    fix_wall_spines(x1, y1, x2, y2, protectedArea);
}

// C ref: sp_lev.c wallify_map().  This is the producer half of Lua's
// des.wallify(): turn solid rock touching room terrain (including diagonals)
// into a provisional straight wall.  The ordinary wallification pass below
// then resolves corners and junctions.  Iterate y-major to preserve C's
// mutation order, although newly created walls do not themselves propagate.
export function wallifyMap(x1, y1, x2, y2) {
    const lowX = Math.max(x1, 1);
    const lowY = Math.max(y1, 0);
    const highX = Math.min(x2, COLNO - 1);
    const highY = Math.min(y2, ROWNO - 1);
    for (let y = lowY; y <= highY; y++) {
        const neighborLowY = y > 0 ? y - 1 : 0;
        const neighborHighY = y < highY ? y + 1 : highY;
        for (let x = lowX; x <= highX; x++) {
            const loc = game.level.at(x, y);
            if (loc?.typ !== STONE) continue;
            const neighborLowX = x > 1 ? x - 1 : 1;
            const neighborHighX = x < highX ? x + 1 : highX;
            let wallType = null;
            for (let yy = neighborLowY; yy <= neighborHighY
                && wallType == null; yy++) {
                for (let xx = neighborLowX; xx <= neighborHighX; xx++) {
                    const neighborType = game.level.at(xx, yy)?.typ ?? STONE;
                    if (IS_ROOM(neighborType) || neighborType === CROSSWALL) {
                        wallType = yy !== y ? HWALL : VWALL;
                        break;
                    }
                }
            }
            if (wallType != null) {
                loc.typ = wallType;
                loc.horizontal = wallType === HWALL;
            }
        }
    }
}

// ============================================================
// Fill ordinary room
// ============================================================

function traptype_rnd() {
    const lvl = game.u?.uz?.dlevel ?? 1;
    let kind = rnd(TRAPNUM - 1);
    switch (kind) {
    case TRAPPED_DOOR: case TRAPPED_CHEST: case MAGIC_PORTAL: case VIBRATING_SQUARE:
        kind = NO_TRAP; break;
    case ROLLING_BOULDER_TRAP: case SLP_GAS_TRAP:
        if (lvl < 2) kind = NO_TRAP; break;
    case LEVEL_TELEP:
        if (lvl < 5 || game.level?.flags?.noteleport) kind = NO_TRAP; break;
    case SPIKED_PIT:
        if (lvl < 5) kind = NO_TRAP; break;
    case LANDMINE:
        if (lvl < 6) kind = NO_TRAP; break;
    case WEB:
        if (lvl < 7) kind = NO_TRAP; break;
    case STATUE_TRAP: case POLY_TRAP:
        if (lvl < 8) kind = NO_TRAP; break;
    case FIRE_TRAP:
        kind = NO_TRAP; break; // not hellish
    case TELEP_TRAP:
        if (game.level?.flags?.noteleport) kind = NO_TRAP; break;
    case HOLE:
        if (rn2(7)) kind = NO_TRAP; break;
    }
    return kind;
}

function find_okay_roompos(croom, crd) {
    let tryct = 0;
    do {
        if (++tryct > 200) return false;
        if (!somexyspace(croom, crd)) return false;
    } while (occupied(crd.x, crd.y) || bydoor(crd.x, crd.y));
    return true;
}

function mktrap_victim(trap) {
    const lvl = game.u?.uz?.dlevel ?? 1;
    const kind = trap.ttyp;
    const x = trap.tx, y = trap.ty;
    // Object based on trap type.  These are floor objects, not just an RNG
    // side effect: a later pet, pickup, or display pass can observe the pile.
    let trapObject = null;
    switch (kind) {
    case ARROW_TRAP:
        trapObject = mksobj(18, true, false);
        trapObject.opoisoned = 0;
        break;
    case DART_TRAP: trapObject = mksobj(24, true, false); break;
    case ROCKTRAP: trapObject = mksobj(ROCK, true, false); break;
    default: break;
    }
    if (trapObject) place_object(trapObject, x, y);
    // Random items on victim
    do {
        const cls = [WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS][rn2(4)];
        const otmp = mkobj(cls, false);
        curseObjectState(otmp);
        // mktrap_victim() treats PIT as an exploded landmine.  Its impact
        // test consumes obj_resists() before deciding whether a fragile item
        // survives, so both the call and the floor-chain mutation belong here.
        if (!(kind === PIT && trapVictimObjectBreaks(otmp))) {
            place_object(otmp, x, y);
        }
    } while (!rn2(5));
    // Victim type
    const PM_ELF = 264, PM_DWARF = 44, PM_ORC = 72,
        PM_GNOME = 165, PM_HUMAN = 260;
    let victim_mnum;
    switch (rn2(15)) {
    case 0:
        victim_mnum = PM_ELF;
        if (kind === SLP_GAS_TRAP && !(lvl <= 2 && rn2(2))) victim_mnum = PM_HUMAN;
        break;
    case 1: case 2: victim_mnum = PM_DWARF; break;
    case 3: case 4: case 5: victim_mnum = PM_ORC; break;
    case 6: case 7: case 8: case 9:
        victim_mnum = PM_GNOME;
        if (!rn2(10)) {
            const otmp = mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
            otmp.quan = 1;
            curseObjectState(otmp);
            place_object(otmp, x, y);
        }
        break;
    default: victim_mnum = PM_HUMAN; break;
    }
    if (victim_mnum === PM_HUMAN && rn2(25))
        victim_mnum = rn1(
            PM_WIZARD - PM_ARCHAEOLOGIST, PM_ARCHAEOLOGIST,
        );
    const corpse = mkcorpstat(
        CORPSE, null, victim_mnum, x, y, 8,
    ); // CORPSTAT_INIT
    // C makes every trap-victim corpse older than TAINT_AGE after creating
    // it.  The existing rot timer is intentionally left unchanged; dogfood()
    // observes the backdated age immediately and classifies it as unsafe.
    corpse.age -= 51; // TAINT_AGE + 1
}

// C refs: zap.c obj_resists() and dothrow.c breaktest().  This helper is
// private to the trap-victim generation block; its inputs are freshly made,
// non-invocation objects from the four possession classes above.
function trapVictimObjectBreaks(object) {
    const material = OBJECT_MATERIAL[object.otyp];
    const ordinaryResistance = object.oclass === ARMOR_CLASS && material === 19
        ? 90 : 1; // GLASS == 19
    if (rn2(100) < (object.artifact ? 99 : ordinaryResistance)) return false;
    if (material === 19 && !object.artifact && object.oclass !== GEM_CLASS)
        return true;
    return object.oclass === POTION_CLASS
        || object.otyp === EXPENSIVE_CAMERA
        || object.otyp === EGG
        || object.otyp === CREAM_PIE
        || object.otyp === MELON
        || object.otyp === 479 // BLINDING_VENOM
        || object.otyp === 480; // ACID_VENOM
}

async function mktrap_room(croom) {
    let kind;
    do { kind = traptype_rnd(); } while (kind === NO_TRAP);
    if (is_hole(kind) && !canFallThrough()) kind = ROCKTRAP;
    const pos = { x: 0, y: 0 };
    if (!somexyspace(croom, pos)) return;
    const trap = await maketrap(pos.x, pos.y, kind);
    kind = trap ? trap.ttyp : NO_TRAP;
    // C mktrap(), not maketrap(), owns the web's resident spider.  Its
    // constructor runs before the shallow trap-victim rnd(4) gate.
    if (kind === WEB)
        await makemon(PM_GIANT_SPIDER, pos.x, pos.y, 0);
    const lvl = game.u?.uz?.dlevel ?? 1;
    if (game.in_mklev && kind !== NO_TRAP
        && lvl <= rnd(4)
        && kind !== SQKY_BOARD && kind !== RUST_TRAP
        && !(kind === ROLLING_BOULDER_TRAP && trap.launch?.x === trap.tx && trap.launch?.y === trap.ty)
        && !is_pit(kind) && (kind < HOLE || kind === MAGIC_TRAP)) {
        if (kind === LANDMINE) { trap.ttyp = PIT; trap.tseen = true; }
        mktrap_victim(trap);
    }
}

function mkfount(croom) {
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos)) return;
    const loc = game.level?.at(pos.x, pos.y);
    if (loc) {
        loc.typ = FOUNTAIN;
        if (!rn2(7)) loc.blessedftn = 1;
        game.level.flags.nfountains++;
    }
}

function mkaltar(croom) {
    if (!croom || croom.rtype !== OROOM) return;
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos)) return;
    const loc = game.level?.at(pos.x, pos.y);
    if (!loc) return;
    loc.typ = ALTAR;
    const al = rn2(A_LAWFUL + 2) - 1;
    loc.flags = Align2amask(al);
}

function mkgrave_room(croom) {
    const dobell = !rn2(10);
    if (croom.rtype !== OROOM) return;
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos)) return;
    make_grave(pos.x, pos.y, dobell ? 'Saved by the bell!' : null);
    if (!rn2(3)) {
        const gold = mksobj(GOLD_PIECE, true, false);
        if (gold) {
            gold.quan = gold.quantity = rnd(20)
                + level_difficulty() * rnd(5);
            gold.owt = objectWeight(gold);
            addBuriedObject(gold, pos.x, pos.y);
        }
    }
    for (let tryct = rn2(5); tryct > 0; tryct--) {
        const otmp = mkobj(RANDOM_CLASS, true);
        curseObjectState(otmp);
        addBuriedObject(otmp, pos.x, pos.y);
    }
    if (dobell) mksobj_at(BELL, pos.x, pos.y, true, false);
}

function fillRandomRoomObjects(croom, pos) {
    if (!rn2(3) && somexyspace(croom, pos)) {
        mkobj_at(RANDOM_CLASS, pos.x, pos.y, true);
        let objTrycnt = 0;
        while (!rn2(5)) {
            if (++objTrycnt > 100) break;
            if (somexyspace(croom, pos))
                mkobj_at(RANDOM_CLASS, pos.x, pos.y, true);
        }
    }
}

export async function fill_ordinary_room(croom, bonus_items) {
    const g = game;
    if (!croom || (croom.rtype !== OROOM && croom.rtype !== THEMEROOM)) return;
    // C fills descendants before their parent and does so even when the
    // parent itself is marked unfilled.
    for (const subroom of croom.sbrooms || [])
        await fill_ordinary_room(subroom, false);
    if (croom.needfill !== FILL_NORMAL) return;

    const pos = { x: 0, y: 0 };
    // With the Amulet, every ordinary room receives a monster and the
    // one-in-three selection draw is short-circuited.  A generated giant
    // spider owns a co-located web if no prior furniture or trap occupies it.
    if ((g.u?.uhave?.amulet || !rn2(3)) && somexyspace(croom, pos)) {
        const tmonst = await makemon(null, pos.x, pos.y, MM_NOGRP);
        if (tmonst?.mnum === PM_GIANT_SPIDER
            && !occupied(pos.x, pos.y)) {
            await maketrap(pos.x, pos.y, WEB);
        }
    }
    // Traps
    let x = 8 - Math.trunc(level_difficulty() / 6);
    if (x <= 1) x = 2;
    let trycnt = 0;
    while (!rn2(x) && ++trycnt < 1000) {
        await mktrap_room(croom);
    }
    // Gold
    if (!rn2(3) && somexyspace(croom, pos)) {
        mkgold(0, pos.x, pos.y);
    }
    // Rogue levels skip furniture, statues, bonus/chest construction, and
    // graffiti, then rejoin the ordinary random-object tail.
    if (Is_rogue_level(g.u?.uz)) {
        fillRandomRoomObjects(croom, pos);
        return;
    }
    // Fountain
    if (!rn2(10)) mkfount(croom);
    // Sink
    if (!rn2(60)) {
        if (find_okay_roompos(croom, pos)) {
            const loc = g.level?.at(pos.x, pos.y);
            if (loc) { loc.typ = SINK; g.level.flags.nsinks = (g.level.flags.nsinks || 0) + 1; }
        }
    }
    // Altar
    if (!rn2(60)) mkaltar(croom);
    // Grave
    x = 80 - (depth_of_level(g.u?.uz) * 2);
    if (x < 2) x = 2;
    if (!rn2(x)) mkgrave_room(croom);
    // Statue
    if (!rn2(20) && somexyspace(croom, pos)) {
        mkcorpstat(STATUE, null, null, pos.x, pos.y, 8);
    }
    // Bonus items
    let skip_chests = false;
    if (bonus_items && somexyspace(croom, pos)) {
        const branchp = is_branchlev();
        const oracle_dlevel = g.oracle_level?.dlevel ?? 5;
        const minesDnum = g.dungeons?.findIndex(dungeon =>
            dungeon?.dname === 'The Gnomish Mines') ?? -1;
        const entersMines = branchp && (g.u?.uz?.dnum ?? 0) !== minesDnum
            && (branchp.end1?.dnum === minesDnum
                || branchp.end2?.dnum === minesDnum);
        if (entersMines) {
            // Mines entrance bonus food
            mksobj_at((rn2(5) < 3) ? FOOD_RATION : rn2(2) ? CRAM_RATION : LEMBAS_WAFER,
                pos.x, pos.y, true, false);
        } else if ((g.u?.uz?.dnum ?? 0) === (g.oracle_level?.dnum ?? 0)
            && (g.u?.uz?.dlevel ?? 1) < oracle_dlevel && rn2(3)) {
            // Supply chest
            const supply_chest = mksobj_at(rn2(3) ? CHEST : LARGE_BOX, pos.x, pos.y, false, false);
            if (supply_chest) {
                supply_chest.olocked = !!rn2(6);
                let tryct2 = 0;
                let cursed_item;
                do {
                    let otyp;
                    const supply_items = [POT_EXTRA_HEALING, POT_SPEED, POT_GAIN_ENERGY,
                        SCR_ENCHANT_WEAPON, SCR_ENCHANT_ARMOR, SCR_CONFUSE_MONSTER,
                        SCR_SCARE_MONSTER, WAN_DIGGING, SPE_HEALING];
                    if (rn2(2)) otyp = POT_HEALING;
                    else otyp = supply_items[rn2(supply_items.length)];
                    const otmp = mksobj(otyp, true, false);
                    if (otmp && otyp === POT_HEALING && rn2(2)) {
                        otmp.quan = otmp.quantity = 2;
                    }
                    cursed_item = otmp?.cursed ?? false;
                    addToContainer(supply_chest, otmp);
                    if (++tryct2 >= 50) break;
                } while (cursed_item || !rn2(5));
                if (rn2(3)) {
                    const extra_classes = [FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS,
                        SCROLL_CLASS, POTION_CLASS, RING_CLASS,
                        SPBOOK_no_NOVEL, SPBOOK_no_NOVEL, SPBOOK_no_NOVEL];
                    const oclass = extra_classes[rn2(extra_classes.length)];
                    let otmp = mkobj(oclass, false);
                    if (oclass === SPBOOK_no_NOVEL && otmp) {
                        const depth = g.u?.uz?.dlevel ?? 1;
                        const maxpass = (depth > 2) ? 2 : 3;
                        for (let pass = 1; pass <= maxpass; pass++) {
                            const candidate = mkobj(oclass, false);
                            if ((OBJECT_SPELL_LEVEL[candidate.otyp] ?? 0)
                                < (OBJECT_SPELL_LEVEL[otmp.otyp] ?? 0)) {
                                otmp = candidate;
                            }
                        }
                    }
                    addToContainer(supply_chest, otmp);
                }
                supply_chest.owt = objectWeight(supply_chest);
            }
            skip_chests = true;
        }
    }
    // Box/chest check
    if (!skip_chests && !rn2(Math.trunc(g.level.nroom * 5 / 2)) && somexyspace(croom, pos)) {
        mksobj_at(rn2(3) ? LARGE_BOX : CHEST, pos.x, pos.y, true, false);
    }
    // Graffiti
    const depth = g.u?.uz?.dlevel ?? 1;
    if (!rn2(27 + 3 * Math.abs(depth))) {
        const { text: engrText, pristine } = random_engraving();
        if (engrText) {
            do {
                somexyspace(croom, pos);
                if (g.level?.at(pos.x, pos.y)?.typ === ROOM) break;
            } while (!rn2(40));
            if (g.level?.at(pos.x, pos.y)?.typ === ROOM)
                make_engr_at(pos.x, pos.y, engrText, pristine, 0, MARK);
        }
    }
    fillRandomRoomObjects(croom, pos);
}

// ============================================================
// Mineralize
// ============================================================

function water_has_kelp(x, y, kelp_pool, kelp_moat) {
    const loc = game.level.at(x, y);
    if (!loc) return false;
    if (kelp_pool && (loc.typ === POOL || loc.typ === WATER) && !rn2(kelp_pool)) return true;
    if (kelp_moat && loc.typ === MOAT && !rn2(kelp_moat)) return true;
    return false;
}

function mineralize_kelp(kelp_pool, kelp_moat) {
    if (kelp_pool < 0) kelp_pool = 10;
    if (kelp_moat < 0) kelp_moat = 30;
    for (let x = 2; x < COLNO - 2; x++)
        for (let y = 1; y < ROWNO - 1; y++)
            if (water_has_kelp(x, y, kelp_pool, kelp_moat))
                mksobj_at(KELP_FROND, x, y, true, false);
}

function mineralize(kelp_pool, kelp_moat, goldprob, gemprob, skip_lvl_checks) {
    const map = game.level;
    mineralize_kelp(kelp_pool, kelp_moat);
    // C excludes almost every named special level after the kelp pass.  The
    // Oracle and non-town Mines End are deliberate exceptions: both receive
    // normal buried gold and gems in the surrounding rock.
    if (!skip_lvl_checks && map?.flags?.is_special
        && game._activeSpecialLevel?.prototype !== 'oracle'
        && game._activeSpecialLevel?.prototype !== 'minend') return;
    if (!skip_lvl_checks && Is_rogue_level(game.u?.uz)) return;
    const absDepth = depth_of_level(game.u?.uz);
    const dunLevel = game.u?.uz?.dlevel ?? 1;
    if (goldprob < 0) goldprob = 20 + Math.trunc(absDepth / 3);
    if (gemprob < 0) gemprob = Math.trunc(goldprob / 4);
    if (!skip_lvl_checks) {
        const dungeonName = game.dungeons?.[game.u?.uz?.dnum ?? 0]?.dname;
        if (dungeonName === 'The Gnomish Mines') {
            goldprob *= 2;
            gemprob *= 3;
        } else if (dungeonName === 'The Quest') {
            goldprob = Math.trunc(goldprob / 4);
            gemprob = Math.trunc(gemprob / 6);
        }
    }
    for (let x = 2; x < COLNO - 2; x++) {
        for (let y = 1; y < ROWNO - 1; y++) {
            const loc = map.at(x, y);
            const locBelow = map.at(x, y + 1);
            if (!loc || !locBelow) continue;
            if (locBelow.typ !== STONE) { y += 2; continue; }
            if (loc.typ !== STONE) { y += 1; continue; }
            const n = (d) => { const l = map.at(x + d[0], y + d[1]); return l && l.typ === STONE; };
            if (!(loc.wall_info & W_NONDIGGABLE)
                && n([0,-1]) && n([1,-1]) && n([-1,-1])
                && n([1,0]) && n([-1,0])
                && n([1,1]) && n([-1,1])) {
                if (rn2(1000) < goldprob) {
                    const otmp = mksobj(GOLD_PIECE, false, false);
                    otmp.quan = 1 + rnd(goldprob * 3);
                    otmp.quantity = otmp.quan;
                    otmp.ox = x;
                    otmp.oy = y;
                    if (rn2(3) === 0) {
                        otmp.buried = true;
                        if (!map.buriedObjects) map.buriedObjects = [];
                        map.buriedObjects.unshift(otmp);
                    } else {
                        place_object(otmp, x, y);
                    }
                }
                if (rn2(1000) < gemprob) {
                    const cnt = rnd(2 + Math.trunc(dunLevel / 3));
                    for (let i = 0; i < cnt; i++) {
                        const gem = mkobj(GEM_CLASS, false);
                        // Rocks selected from GEM_CLASS are discarded rather
                        // than buried or placed.
                        if (gem.otyp !== ROCK) {
                            gem.ox = x;
                            gem.oy = y;
                            if (rn2(3) === 0) {
                                gem.buried = true;
                                if (!map.buriedObjects) map.buriedObjects = [];
                                map.buriedObjects.unshift(gem);
                            } else {
                                place_object(gem, x, y);
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// Level finalize topology
// ============================================================

function get_level_extends() {
    const map = game.level;
    let xmin = 0, xmax = COLNO - 1, ymin = 0, ymax = ROWNO - 1;
    let found = false, nonwall = false;
    for (xmin = 0; !found && xmin <= COLNO - 1; xmin++) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmin, y)?.typ ?? STONE;
            if (typ !== STONE) { found = true; if (!IS_WALL(typ)) nonwall = true; }
        }
    }
    xmin -= (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    found = false; nonwall = false;
    for (xmax = COLNO - 1; !found && xmax >= 0; xmax--) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmax, y)?.typ ?? STONE;
            if (typ !== STONE) { found = true; if (!IS_WALL(typ)) nonwall = true; }
        }
    }
    xmax += (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    found = false; nonwall = false;
    for (ymin = 0; !found && ymin <= ROWNO - 1; ymin++) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.at(x, ymin)?.typ ?? STONE;
            if (typ !== STONE) { found = true; if (!IS_WALL(typ)) nonwall = true; }
        }
    }
    ymin -= (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    found = false; nonwall = false;
    for (ymax = ROWNO - 1; !found && ymax >= 0; ymax--) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.at(x, ymax)?.typ ?? STONE;
            if (typ !== STONE) { found = true; if (!IS_WALL(typ)) nonwall = true; }
        }
    }
    ymax += (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    return { xmin, xmax, ymin, ymax };
}

function bound_digging() {
    const map = game.level;
    const { xmin, xmax, ymin, ymax } = get_level_extends();
    for (let x = 0; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (!loc) continue;
            if (IS_STWALL(loc.typ) && (y <= ymin || y >= ymax || x <= xmin || x >= xmax)) {
                loc.wall_info = (loc.wall_info || 0) | W_NONDIGGABLE;
            }
        }
}

// C ref: display.c set_wall_state()/xy_set_wall_state().  Wall topology and
// visibility are separate: the terrain type supplies the nominal junction,
// while the low three wall_info bits say which side is unfinished exterior.
// back_to_glyph()/wall_angle() later combines that mode with `seenv` so a
// hero beside a doorway does not see the outside face of the room wall.
function wallCheckPos(x, y, which) {
    if (!isok(x, y)) return which;
    const typ = game.level.at(x, y)?.typ ?? STONE;
    return IS_STWALL(typ) || typ === CORR || typ === SCORR || typ === SDOOR
        ? which : 0;
}

function moreThanOne(...values) {
    return values.filter(Boolean).length > 1;
}

function straightWallMode(x, y, horizontal) {
    const first = horizontal
        ? wallCheckPos(x, y - 1, 1) : wallCheckPos(x - 1, y, 1);
    const second = horizontal
        ? wallCheckPos(x, y + 1, 2) : wallCheckPos(x + 1, y, 2);
    return moreThanOne(first, second) ? 0 : first + second;
}

function cornerWallMode(points, inner) {
    const outside = points.map(([x, y]) => wallCheckPos(x, y, 1));
    if (wallCheckPos(inner[0], inner[1], 1)) return 2;
    return outside.every(Boolean) ? 1 : 0;
}

function tWallMode(points) {
    const modes = points.map(([x, y], index) =>
        wallCheckPos(x, y, index + 1));
    return moreThanOne(...modes) ? 0 : modes.reduce((sum, value) => sum + value, 0);
}

function crossWallMode(x, y) {
    const quadrants = [
        wallCheckPos(x - 1, y - 1, 1),
        wallCheckPos(x + 1, y - 1, 1),
        wallCheckPos(x + 1, y + 1, 1),
        wallCheckPos(x - 1, y + 1, 1),
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

function set_wall_state() {
    const level = game.level;
    if (!level) return;
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.at(x, y);
            if (!loc) continue;
            let mode = -1;
            switch (loc.typ) {
            case SDOOR:
                mode = straightWallMode(x, y, !!loc.horizontal);
                break;
            case VWALL:
                mode = straightWallMode(x, y, false);
                break;
            case HWALL:
                mode = straightWallMode(x, y, true);
                break;
            case TDWALL:
                mode = tWallMode([[x, y - 1], [x - 1, y + 1], [x + 1, y + 1]]);
                break;
            case TUWALL:
                mode = tWallMode([[x, y + 1], [x + 1, y - 1], [x - 1, y - 1]]);
                break;
            case TLWALL:
                mode = tWallMode([[x + 1, y], [x - 1, y - 1], [x - 1, y + 1]]);
                break;
            case TRWALL:
                mode = tWallMode([[x - 1, y], [x + 1, y + 1], [x + 1, y - 1]]);
                break;
            case TLCORNER:
                mode = cornerWallMode(
                    [[x - 1, y - 1], [x, y - 1], [x - 1, y]], [x + 1, y + 1],
                );
                break;
            case TRCORNER:
                mode = cornerWallMode(
                    [[x, y - 1], [x + 1, y - 1], [x + 1, y]], [x - 1, y + 1],
                );
                break;
            case BLCORNER:
                mode = cornerWallMode(
                    [[x, y + 1], [x - 1, y + 1], [x - 1, y]], [x + 1, y - 1],
                );
                break;
            case BRCORNER:
                mode = cornerWallMode(
                    [[x + 1, y], [x + 1, y + 1], [x, y + 1]], [x - 1, y - 1],
                );
                break;
            case CROSSWALL:
                mode = crossWallMode(x, y);
                break;
            default:
                break;
            }
            if (mode >= 0) loc.wall_info = ((loc.wall_info || 0) & ~0x07) | mode;
        }
    }
}

function level_finalize_topology() {
    bound_digging();
    mineralize(-1, -1, -1, -1, false);
    game.in_mklev = false;
    if (game.level?.flags?.has_morgue)
        game.level.flags.graveyard = true;
    if (!game.level?.flags?.is_maze_lev) {
        const nroom = game.level?.nroom ?? 0;
        for (let i = 0; i < nroom; i++)
            topologize(game.level.rooms?.[i]);
    }
    set_wall_state();
    const rooms = game.level?.rooms ?? [];
    for (let i = 0; i < rooms.length; i++) {
        const rm = rooms[i];
        if (rm && rm.rtype != null) rm.orig_rtype = rm.rtype;
    }
}
