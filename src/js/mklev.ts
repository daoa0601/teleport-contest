import { rotCorpse } from './corpse_rot.js';
// mklev.js — Level generation.
// C ref: mklev.c — makelevel, makerooms, makecorridors, generate_stairs.
// Also includes parts of sp_lev.c (create_room) and mkmap.c (litstate_rnd).
// Level construction uses the game's main random-number stream.

import type { GameObject, ObjectTimerKind, ObjectWhere } from './object_types.js';
import type { Monster, MonsterBirthState, PetData } from './monster_types.js';
import type { Position, MapLocation, Room, SpecialLevelContext, FloorObjects, Trap, ActiveSpecialLevel } from './map_types.js';
import { isRoom } from './map_types.js';
import type { GameState, Fruit } from './game_state.js';
import type { DungeonBranch, DungeonLocation } from './dungeon_types.js';
import type { ArrivalRegion, Rectangle, StairRegion, Stairway } from './map_types.js';
import type { LuaState, LuaValues } from './lua/runtime.js';
import type { DueObjectTimer } from './object_timers.js';
import type { ObjectDefinition } from './object_data.js';
import { createObjectBase } from './object_constructor.js';
import { deleteTrap, finishSokobanIfSolved } from './trap_lifecycle.js';
import { randomGhostName, setMonsterGivenName } from './monster_given_name.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { novelTitle } from './novel_titles.js';
import { addFruit } from './fruit.js';
import { setTinVariety } from './tin.js';
import { setWallState } from './wall_topology.js';
import { monsterHasMapPosition, monsterAtPosition, monsterOccupiesPosition } from './monster_location.js';
import { finishMonsterBirth } from './monster_birth.js';
import { nameObjectFromTopten } from './topten.js';
import { normalDemon } from './minion.js';
import { randomMonsterRelocation } from './teleport.js';

import { relocateObjectRandomly } from './object_teleport.js';
import { discardMonsterInventory, dropSpecialMonsterObjects } from './monster_drop.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { exerciseWisdom } from './attrib.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { impossible } from './diagnostics.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import {
    createDesBindings, mapOrigin, objectTypeForName, regionCoordinates,
} from './lua/des.js';
import type {
    DesOperations, DesOptions, DesObjectOptions, DesMonsterOptions,
    DesSelectionOptions, PositionedDesOptions, MonsterAppearance,
} from './lua/des.js';
import type { LuaBindings, LuaGameState } from './lua/lifecycle.js';
import type { LuaValue } from './lua/runtime.js';
import { luaInteger, luaString } from './lua/arguments.js';
import { createSelectionApi } from './lua/selection.js';
import {
    luaTableToArray, objectToLuaTable,
} from './lua/runtime.js';
import { nextIdent } from './ident.js';
import { erosionMatters, objectIsVulnerableToErosion } from './object_erosion.js';
import { deallocateObject, deleteObject } from './object_delete.js';
import { eggSpeciesIsDead, hatchableEggSpecies } from './egg_species.js';
import {
    placeCreatedObject, remove_object, stack_object, updateIceObjectTimersAt,
} from './floor_object.js';
import {
    addBuriedObject, buryObject, unearthFloorObjectsAt,
} from './buried_object.js';
import { resetHeroTrap } from './terrain_movement.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { addShopDamage } from './shop_damage.js';
import { GameMap } from './game.js';
import { restoreBonesMonsters } from './bones_monster.js';
import { propagateMonsterSpecies } from './monster_population.js';
import {
    prepareBonesObjectForRestore, prepareBonesObjectForSave,
} from './bones_object.js';
import { encodeSavedGraph } from './saved_graph.js';
import { decodeBonesPayload } from './bones_validation.js';
import type { BonesPayload } from './bones_validation.js';
import { rn2, rnd, rn1, rne, rnz, d } from './rng.js';
import { SHOP_TYPES, RANDOM_SHOP_TYPES } from './shop_data.js';
import { GP_AVOID_MONPOS, GP_CHECKSCARY, RLOC_ERR, RLOC_NOMSG, In_mines, PL_NSIZ } from './const.js';
import { init_rect, rnd_rect, get_rect, split_rects } from './rect.js';
import {
    depth as depth_of_level, ledgerNo, maxLedgerNo,
} from './hacklib.js';
import { inducedAlignment, level_difficulty, specialLevelAt } from './dungeon.js';
import { mkmap } from './mkmap.js';
import { carveMazeFrom, createMaze } from './maze_terrain.js';
import { DRY, HOT, NO_LOC_WARN, SOLID, WET, getLocationCoord } from './special_location.js';
import { cleanupSpecialLevelMap, removeSpecialLevelBoundaries } from './special_level_cleanup.js';
import {
    A_CHA,
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
    ACCESSIBLE, IS_WALL, IS_STWALL, IS_DOOR, IS_ROOM, IS_OBSTRUCTED, ZAP_POS,
    IS_FURNITURE, IS_POOL,
    IS_AIR, IS_LAVA, In_endgame, Is_earthlevel, Is_botlevel, Is_stronghold,
    Invocation_lev, In_hell, In_quest, In_V_tower, Is_oracle_level,
    Is_waterlevel, Is_knox_level, Is_rogue_level, In_sokoban,
    SPACE_POS, isok, W_NONDIGGABLE, W_NONPASSWALL, FILL_NONE, FILL_NORMAL,
    ICE, MOAT, POOL, WATER, LAVAPOOL, LAVAWALL,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DBWALL,
    ICED_POOL, ICED_MOAT,
    DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_MOAT, DB_LAVA,
    DB_UNDER, DB_FLOOR, SHOP_HOLE_COST,
    TREE, AIR, CLOUD,
    A_NONE, A_CHAOTIC, A_NEUTRAL, A_LAWFUL, P_SHORT_SWORD, P_SABER,
    AM_SHRINE, AM_SANCTUM, Align2amask,
    LR_DOWNSTAIR, LR_UPSTAIR, LR_UPTELE, LR_DOWNTELE,
    M_AP_NOTHING, M_AP_FURNITURE, M_AP_OBJECT, M_AP_MONSTER, M_AP_TYPE,
    MM_ANGRY, MM_ASLEEP, MM_NONAME, MM_NOGRP, MM_EMIN, MM_EPRI,
    MM_NOWAIT, MM_NOTAIL, MM_IGNOREWATER, MM_ADJACENTOK,
    MM_NOCOUNTBIRTH, MM_NOMSG, MM_MALE, MM_FEMALE, MM_EDOG, NO_MINVENT,
    G_EXTINCT, G_GENOD, G_GONE, G_NOCORPSE,
    ROT_AGE, TROLL_REVIVE_CHANCE, HEALTHY_TIN, RANDOM_TIN,
    CORPSTAT_FEMALE, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_HISTORIC, CORPSTAT_INIT, CORPSTAT_SPE_VAL,
    STRAT_APPEARMSG, STRAT_CLOSE, STRAT_WAITFORU,
    ANTI_MAGIC, TT_BURIEDBALL, TT_BEARTRAP, TT_WEB, TT_PIT, TT_LAVA,
} from './const.js';
import {
    getObjectClassBounds, getObjectDefinition, requireObjectData,
    OBJECT_BASES, OBJECT_PROB, OBJECT_MATERIAL,
    OBJECT_SPELL_LEVEL,
    OBJECT_MERGE, OBJECT_WEIGHT, OBJECT_COST, OBJECT_SUBTYPE,
    WORM_TOOTH, UNICORN_HORN, HELM_OF_OPPOSITE_ALIGNMENT,
    GAUNTLETS_OF_FUMBLING, FUMBLE_BOOTS, LEVITATION_BOOTS,
    AMULET_OF_STRANGULATION, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_CHANGE,
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR,
    LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
    BAG_OF_TRICKS, TALLOW_CANDLE, WAX_CANDLE, BRASS_LANTERN,
    OIL_LAMP,
    MAGIC_LAMP, EXPENSIVE_CAMERA,
    CRYSTAL_BALL, TINNING_KIT, CAN_OF_GREASE, FIGURINE, MAGIC_MARKER,
    MAGIC_FLUTE, FROST_HORN, FIRE_HORN, HORN_OF_PLENTY, MAGIC_HARP,
    DRUM_OF_EARTHQUAKE, CORPSE, EGG, MEAT_RING,
    GLOB_OF_GRAY_OOZE, GLOB_OF_BLACK_PUDDING, KELP_FROND,
    SLIME_MOLD, MELON, LUMP_OF_ROYAL_JELLY, CREAM_PIE, CANDY_BAR,
    TIN, GOLD_PIECE, SPE_NOVEL, SPE_BOOK_OF_THE_DEAD,
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
    SADDLE,
    WAN_CANCELLATION, WAN_LIGHT, WAN_LIGHTNING,
} from './object_data.js';
import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_DIFFICULTY, MONSTER_GENO,
    MONSTER_ALIGNMENT, MONSTER_LEVEL,
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3,
    MONSTER_SYMBOL, MONSTER_SIZE, MONSTER_MOVE, MONSTER_SOUND,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_COLOR, MONSTER_NAME, MONSTER_RESISTS,
    SPECIAL_PM, monsterClassSymbol, monsterIsPlayerMonster, requireMonsterData,
} from './monster_data.js';
import {
    isReviver, isRider, ZOMBIE_FORM_BY_LIVING_CORPSE,
} from './corpse_species.js';
import {
    adjustedMonsterLevel, newMonsterHitPoints,
} from './monster_hit_points.js';
import {
    changeMonsterForm, initialShapechangedBirth, pickNastyShape,
} from './monster_polymorph.js';
import {
    initializeMonsterWormBody, restoreMonsterWormHeads, validMonsterWormBodies,
} from './monster_worm.js';
import { monsterAlignmentType, setMonsterMalign } from './monster_alignment.js';
import { saveMonsterTraits } from './monster_traits.js';

import { nhgetch } from './input.js';
import {
    canSeeMonster, canSenseMonster, flush_screen, newsym, pline,
} from './display.js';
import { premap_detect } from './detect.js';
import {
    TRUE_RUMORS, FALSE_RUMORS, RANDOM_ENGRAVINGS, RANDOM_EPITAPHS,
} from './random_text_data.js';
import { makeEngravingAt, wipeEngravingAt, wipeoutText } from './engrave.js';
import { registerQuestLeader } from './quest.js';
import { armorBonus } from './armor.js';
import { initializeMonsterArmor } from './monworn.js';
import { artifactByName, artifactExistCount, createRandomArtifact, nameArtifact } from './artifacts.js';
import {
    addCreatedObjectToMonsterInventory, addObjectToMonsterInventory,
    linkCreatedObjectToMonsterInventory, linkObjectToMonsterInventory,
    restoreMonsterInventoryOwnership, unlinkMonsterObject,
} from './monster_inventory.js';
import { setupElementalBubbles } from './elemental.js';
import { maybeGiveDomesticSaddle, putSaddleOnMonster } from './steed.js';
import { inTown, roomForIndex, roomsAt } from './room.js';
import {
    occupied, somex, somey, somexy, somexyspace,
} from './mkroom.js';
import { createHarmlessGasCloudSelection } from './regions.js';
import { beginObjectBurn } from './light.js';
import {
    LEVEL_TIMER_KIND, OBJECT_TIMER_KIND,
    objectTimers, objectsInTimerGraph,
    scheduleLevelTimer, scheduleObjectTimer, stopAllObjectTimers,
    stopObjectTimer, stopLevelTimer,
} from './object_timers.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { objectWeight } from './weight.js';
import {
    curseObjectState, objectResistsDestruction,
} from './object_state.js';
import {
    isMultiGeneratedWeapon, isPoisonableObject,
} from './object_properties.js';
import { addCreatedObjectToContainer, addObjectToContainer } from './object_container.js';
import { vision_note_blocker_change } from './vision.js';
import { goodPosition } from './teleport_rules.js';
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
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';

// Object/class constants (normally from objects.js, not in contest template)
const RANDOM_CLASS = 0;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const M1_MINDLESS = 0x00010000;
const M2_DOMESTIC = 0x00400000;
const G_NOGEN = 0x0200;
const G_IGNORE = 0x8000;
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
const VEGETARIAN_CLASS = 19;
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
const BEC_DE_CORBIN = 70;
const PM_RAVEN = 128;
const MS_BRIBE = 33;
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
const PM_FIRE_ELEMENTAL = 155;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_VLAD_THE_IMPALER = 228;
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
const CHAIN_MAIL = 128;


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

function is_hole(t: number): boolean { return t === HOLE || t === TRAPDOOR; }
function is_pit(t: number): boolean { return t === PIT || t === SPIKED_PIT; }

function canMonsterHideUnderFloorObject(x: number, y: number): boolean {
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
function stairway_add(x: number, y: number, up: boolean, isladder: boolean, dest: DungeonLocation): void {
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

function stairway_find_dir(up: boolean): Stairway | null {
    for (let s = game.stairs; s; s = s.next)
        if (s.up === up) return s;
    return null;
}

function stairway_find_special_dir(up: boolean): Stairway | null {
    for (let s = game.stairs; s; s = s.next)
        if (s.tolev.dnum !== (game.u?.uz?.dnum ?? 0) && s.up !== up) return s;
    return null;
}

// ── Hero placement (C ref: stairs.c, mkmaze.c) ──

function u_on_newpos(x: number, y: number): void {
    game.u.ux = x;
    game.u.uy = y;
}

// C refs: dungeon.c Can_dig_down()/Can_fall_thru().  A level's hard-floor
// flag is only one of the gates: bottom levels and the invocation level also
// reject holes, while the Castle is an explicit exception because its
// trapdoors lead into the Valley.
export function canDigDown(uz: DungeonLocation | undefined = game.u.uz): boolean {
    // C dungeon.c:Can_dig_down() pairs the current level's hard-floor flag
    // with the destination depth checks in the level argument.
    if (!uz) return false;
    return !game.level?.flags?.hardfloor
        && !Is_botlevel(uz)
        && !Invocation_lev(uz);
}

export function canFallThrough(uz: DungeonLocation | undefined = game.u.uz): boolean {
    return canDigDown(uz) || (uz !== undefined && Is_stronghold(uz));
}

// C refs: mklev.c occupied(), mkmaze.c bad_location().  Exclusion zones and
// the invocation position are modeled by their owning special levels; the
// shared terrain/feature gate belongs here.
function bad_location(x: number, y: number, nlx: number, nly: number, nhx: number, nhy: number): boolean {
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
export function place_lregion(
    lx: number, ly: number, hx: number, hy: number,
    nlx: number, nly: number, nhx: number, nhy: number,
    rtype: number, _lev: DungeonLocation | null,
): void {
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
export function u_on_upstairs(): void {
    const stway = stairway_find_dir(true);
    if (stway) { u_on_newpos(stway.sx, stway.sy); return; }
    // No upstair — try special stairs, then random
    const special = stairway_find_special_dir(false);
    if (special) { u_on_newpos(special.sx, special.sy); return; }
    // Random placement via place_lregion
    place_lregion(0, 0, 0, 0, 0, 0, 0, 0, LR_UPTELE, null);
}

// C ref: stairs.c u_on_dnstairs — ascending arrives on the destination's
// downstairs, its upward special stair, or a random legal location.
export function u_on_downstairs(): void {
    const stway = stairway_find_dir(false);
    if (stway) { u_on_newpos(stway.sx, stway.sy); return; }
    const special = stairway_find_special_dir(true);
    if (special) { u_on_newpos(special.sx, special.sy); return; }
    place_lregion(0, 0, 0, 0, 0, 0, 0, 0, LR_DOWNTELE, null);
}

// Object probabilities are mutable because gemstone rarity changes with
// dungeon depth.  This is the level-dependent half of o_init.c.
let objectProb = OBJECT_PROB.slice();
function oinit(): void {
    const firstGem = getObjectClassBounds(GEM_CLASS).first;
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
function blessorcurse(otmp: GameObject | null | undefined, chance = 10): void {
    if (!otmp || otmp.blessed || otmp.cursed) return;
    if (!rn2(chance)) {
        if (!rn2(2)) otmp.cursed = true;
        else otmp.blessed = true;
    }
}

// C ref: mkobj.c mksobj — create a specific object.
export async function mksobj(
    otyp: number, init: boolean, artif: boolean, { zombify = false } = {},
): Promise<GameObject> {
    const definition = getObjectDefinition(otyp);
    const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0);
    if (init) {
        await mksobj_init(otmp, artif, definition);
    }
    if (otyp === CORPSE || otyp === STATUE || otyp === FIGURINE) {
        if (otmp.corpsenm == null) {
            otmp.corpsenm = rndmonnum();
            if (otyp === CORPSE) {
                otmp.corpsenm = undeadToCorpse(otmp.corpsenm);
                if ((game.mvitals?.[otmp.corpsenm]?.mvflags ?? 0) & (G_NOCORPSE | G_GONE)) {
                    if (!game.urole) throw new Error('Corpse fallback requires the hero role');
                    otmp.corpsenm = SPECIAL_PM + 1 + game.urole.mnum;
                }
            }
        }
        // mkobj.c:mksobj() stores corpse sex in spe. Stack admission and
        // later revival both read those bits, including for statues/figurines.
        const species = otmp.corpsenm;
        if (species === undefined) throw new Error('Body object requires a monster species');
        const genderFlags = MONSTER_FLAGS2[species] || 0;
        otmp.spe = genderFlags & 0x40000 ? CORPSTAT_NEUTER
            : genderFlags & 0x20000 ? CORPSTAT_FEMALE
            : genderFlags & 0x10000 ? CORPSTAT_MALE
            : rn2(2) ? CORPSTAT_FEMALE : CORPSTAT_MALE;
        if (otyp === CORPSE) startCorpseTimeout(otmp, { zombify });
    }
    if (otyp === EGG && (otmp.corpsenm ?? -1) >= 0) {
        attachEggHatchTimer(otmp);
    }
    if (otyp === SPE_NOVEL) {
        // mkobj.c:mksobj() names every novel after class initialization.
        // The title index is persistent object identity even when only the
        // floor glyph is currently visible.
        otmp.novelidx = -1;
        const title = novelTitle(otmp);
        if (title === undefined) throw new Error('Novel title selection requires a title');
        otmp.oextra = { ...(otmp.oextra || {}), oname: title };
    }
    // C mkobj.c:mksobj() computes weight only after type-specific state,
    // quantities, corpse identity, timers, and generated contents are final.
    otmp.owt = objectWeight(otmp);
    return otmp;
}

// C ref: objnam.c rnd_class().  Object probabilities are absolute weights
// within the requested inclusive type range rather than a uniform index.
export function rndClass(first: number, last: number): number {
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

function bcsign(otmp: GameObject): number {
    return Number(!!otmp.blessed) - Number(!!otmp.cursed);
}

function mayGenerateEroded(otmp: GameObject): boolean {
    // C ref: may_generate_eroded(): starting inventory is pristine, while
    // objects produced by mklev on move zero may still be damaged.
    if ((game.moves ?? 0) <= 1 && !game.in_mklev) return false;
    if (otmp.oerodeproof || otmp.oartifact || otmp.otyp === WORM_TOOTH || otmp.otyp === UNICORN_HORN)
        return false;
    if (!erosionMatters(otmp)) return false;
    return objectIsVulnerableToErosion(otmp, 'rust')
        || objectIsVulnerableToErosion(otmp, 'burn')
        || objectIsVulnerableToErosion(otmp, 'rot')
        || objectIsVulnerableToErosion(otmp, 'corrosion')
        || objectIsVulnerableToErosion(otmp, 'crack');
}

function mkobjErosions(otmp: GameObject): void {
    if (!mayGenerateEroded(otmp)) return;
    if (!rn2(100)) {
        otmp.oerodeproof = true;
    } else {
        const primary = !rn2(80);
        if (primary && (objectIsVulnerableToErosion(otmp, 'burn')
            || objectIsVulnerableToErosion(otmp, 'rust')
            || objectIsVulnerableToErosion(otmp, 'crack'))) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9)) erosion++;
            otmp.oeroded = erosion;
        }
        const secondary = !rn2(80);
        if (secondary && (objectIsVulnerableToErosion(otmp, 'rot')
            || objectIsVulnerableToErosion(otmp, 'corrosion'))) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9)) erosion++;
            otmp.oeroded2 = erosion;
        }
    }
    if (!rn2(1000)) otmp.greased = true;
}

// C ref: mkobj.c mksobj_init().  Object state is deliberately small, but
// every decision is driven by the real object class/type metadata.
async function mksobj_init(
    otmp: GameObject, artif: boolean, definition: ObjectDefinition,
): Promise<void> {
    const otyp = otmp.otyp;
    switch (otmp.oclass) {
    case WEAPON_CLASS:
        if (isMultiGeneratedWeapon(otmp)) otmp.quan = rn1(6, 6);
        if (!rn2(11)) {
            otmp.spe = rne(3);
            otmp.blessed = !!rn2(2);
        } else if (!rn2(10)) {
            otmp.cursed = true;
            otmp.spe = -rne(3);
        } else {
            blessorcurse(otmp, 10);
        }
        if (isPoisonableObject(otmp)) otmp.opoisoned = rn2(100) === 0;
        if (artif && !rn2(20 + 10 * artifactExistCount()))
            createRandomArtifact(otmp);
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
        if (artif && !rn2(40 + 10 * artifactExistCount()))
            createRandomArtifact(otmp);
        // Native lacquer protects Samurai armor created at startup or
        // anywhere in the hero's quest, including armor carried by monsters.
        if (game.urole?.key === 'samurai' && otmp.otyp === SPLINT_MAIL
            && (game.moves <= 1 || In_quest(game.u.uz))) {
            otmp.oerodeproof = true;
            otmp.rknown = true;
        }
        break;
    case RING_CLASS:
        if (definition.charged) {
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
            } while (((MONSTER_GENO[otmp.corpsenm] ?? 0) & 0x0010)
                && --tries > 0);
            if (!tries) otmp.corpsenm = 260; // PM_HUMAN fallback
        } else if (otyp === EGG) {
            otmp.corpsenm = -1; // NON_PM: generic egg
            if (!rn2(3)) {
                // C ref: mkobj.c EGG initialization. Try up to 200 random
                // monsters. Every failed rndmonnum() call still advances the
                // gameplay RNG.
                for (let tries = 200; tries > 0; tries--) {
                    const mndx = hatchableEggSpecies(rndmonnum());
                    if (mndx !== -1 && !eggSpeciesIsDead(mndx)) {
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
                    if (!nutrition || ((MONSTER_GENO[mndx] ?? 0) & 0x0010))
                        continue;
                    otmp.corpsenm = mndx;
                    setTinVariety(otmp, RANDOM_TIN);
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
            otmp.owt = definition.weight;
            otmp.known = otmp.dknown = true;
            otmp.corpsenm = 206 + (otyp - GLOB_OF_GRAY_OOZE);
            scheduleObjectTimer(
                otmp, OBJECT_TIMER_KIND.SHRINK_GLOB,
                (game.moves ?? 0) + 23 + rn2(5), game,
            );
        } else if (otyp === SLIME_MOLD) {
            const fruit = game.context.current_fruit;
            if (fruit === undefined) throw new Error('Slime mold creation requires a current fruit');
            otmp.spe = fruit;
            game.flags.made_fruit = true;
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
        await initTool(otmp);
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
        else otmp.spe = rn1(5, definition.direction === 1 ? 11 : 4);
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
                otmp.contents = [await mkobj(SPBOOK_no_NOVEL, false)];
            }
        }
        break;
    }
    mkobjErosions(otmp);
}

async function initTool(otmp: GameObject): Promise<void> {
    const otyp = otmp.otyp;
    if (otyp === TALLOW_CANDLE || otyp === WAX_CANDLE) {
        otmp.spe = 1;
        otmp.age = 20 * requireObjectData(OBJECT_COST, otyp);
        otmp.lamplit = false;
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
        otmp.otrapped = !rn2(10);
        otmp.tknown = otmp.otrapped && !rn2(100);
        await mkboxCnts(otmp);
    } else if (otyp === ICE_BOX || otyp === SACK || otyp === OILSKIN_SACK
        || otyp === BAG_OF_HOLDING) {
        await mkboxCnts(otmp);
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
        } while (((MONSTER_FLAGS2[otmp.corpsenm] ?? 0) & M2_HUMAN)
            && tryCount++ < 30);
        blessorcurse(otmp, 4);
    } else if (otyp === MAGIC_FLUTE || otyp === MAGIC_HARP
        || otyp === FROST_HORN || otyp === FIRE_HORN
        || otyp === DRUM_OF_EARTHQUAKE) {
        otmp.spe = rn1(5, 4);
    }
}

// C ref: mkobj.c mkbox_cnts().
async function mkboxCnts(box: GameObject): Promise<void> {
    let maximum;
    if (box.otyp === ICE_BOX) maximum = 20;
    else if (box.otyp === CHEST) maximum = box.olocked ? 7 : 5;
    else if (box.otyp === LARGE_BOX) maximum = box.olocked ? 5 : 3;
    else if (box.otyp === SACK || box.otyp === OILSKIN_SACK) {
        maximum = ((game.moves ?? 0) <= 1 && !game.in_mklev) ? 0 : 1;
    } else if (box.otyp === BAG_OF_HOLDING) maximum = 1;
    else maximum = 0;

    box.contents = [];
    const classProbs: readonly (readonly [number, number])[] = [[18, GEM_CLASS], [15, FOOD_CLASS], [18, POTION_CLASS],
        [18, SCROLL_CLASS], [12, SPBOOK_CLASS], [7, COIN_CLASS],
        [6, WAND_CLASS], [5, RING_CLASS], [1, AMULET_CLASS]];
    for (let count = rn2(maximum + 1); count > 0; count--) {
        let content;
        if (box.otyp === ICE_BOX) {
            content = await mksobj(CORPSE, true, false);
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
            content = await mkobj(objectClass, false);
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
        await addToContainer(box, content);
    }
}

async function mksobj_at(
    otyp: number, x: number, y: number, init: boolean, artif: boolean,
): Promise<GameObject> {
    return placeCreatedObject(await mksobj(otyp, init, artif), x, y);
}

export async function mkobj(oclass: number, artif: boolean): Promise<GameObject> {
    if (oclass === RANDOM_CLASS) {
        // mkobj.c:mkobj() switches the RANDOM_CLASS reservoir in Gehennom.
        // Keep that shared constructor policy here; hellfill.lua merely asks
        // for des.object() and does not own the resulting class weights.
        const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
        const classProbs: readonly (readonly [number, number])[] = inHell
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
    const excludeNovel = oclass === SPBOOK_no_NOVEL;
    const { first, last: classLast } = getObjectClassBounds(
        excludeNovel ? SPBOOK_CLASS : oclass,
    );
    const last = excludeNovel ? 407 : classLast; // SPE_BLANK_PAPER
    let total = 0;
    for (let i = first; i <= last; i++) total += requireObjectData(objectProb, i);
    let roll = rnd(total);
    let otyp = first;
    while ((roll -= requireObjectData(objectProb, otyp)) > 0) otyp++;
    return await mksobj(otyp, true, artif);
}

async function mkobj_at(
    oclass: number, x: number, y: number, artif: boolean,
): Promise<GameObject> {
    return placeCreatedObject(await mkobj(oclass, artif), x, y);
}

function coinStackWeight(quantity: number): number {
    return Math.max(1, Math.trunc((quantity + 50) / 100));
}

export async function mkgold(
    amount: number, x: number, y: number, state: GameState = game,
): Promise<GameObject> {
    // C ref: mkobj.c mkgold()
    if (amount <= 0) {
        // C ref: mkobj.c:2008-2010
        const depthVal = depth_of_level(game.u?.uz);
        const mul = rnd(Math.trunc(30 / Math.max(12 - depthVal, 2)));
        amount = 1 + rnd(level_difficulty() + 2) * mul;
    }
    const existing = state.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === GOLD_PIECE);
    if (existing) {
        existing.quan += amount;
        existing.quantity = existing.quan;
        existing.owt = coinStackWeight(existing.quan);
        return existing;
    }
    const gold = await mksobj(GOLD_PIECE, true, false);
    gold.quan = gold.quantity = amount;
    gold.owt = coinStackWeight(amount);
    return placeCreatedObject(gold, x, y, state);
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

export function undeadToCorpse(mndx: number): number {
    return UNDEAD_CORPSE_TYPES.get(mndx) ?? mndx;
}

function corpseHasNoTimer(mndx: number | undefined): boolean {
    return mndx === PM_LICHEN || mndx === PM_LIZARD;
}

function corpseHasSpecialTiming(mndx: number | undefined): boolean {
    return corpseHasNoTimer(mndx) || isReviver(mndx);
}

export function riderRevivalTime(body: GameObject, retry = false): number {
    const firstTurn = retry ? 3 : body.corpsenm === PM_DEATH ? 6 : 12;
    let turn = firstTurn;
    while (turn < 67 && rn2(3)) turn++;
    return turn;
}

// C mkobj.c:start_corpse_timeout(). Troll and Rider corpses can revive;
// other corpses rot unless their creator requested zombification.
export function startCorpseTimeout(body: GameObject | null | undefined, { zombify = false } = {}): void {
    if (!body || corpseHasNoTimer(body.corpsenm)) return;
    const species = body.corpsenm;
    if (species === undefined) throw new Error('Corpse timer requires a monster species');
    const rotAdjust = game.in_mklev ? 25 : 10;
    const currentMove = Math.max(game.moves ?? 1, 1);
    if (body.age == null) body.age = currentMove;
    const age = currentMove - body.age;
    const baseDelay = age > ROT_AGE ? rotAdjust : ROT_AGE - age;
    let kind: ObjectTimerKind = OBJECT_TIMER_KIND.ROT_CORPSE;
    let delay = baseDelay + rnz(rotAdjust) - rotAdjust;

    if (species >= PM_DEATH && species <= PM_FAMINE) {
        kind = OBJECT_TIMER_KIND.REVIVE_MON;
        delay = riderRevivalTime(body);
    } else if (MONSTER_SYMBOL[species] === 46) { // S_TROLL
        for (let turn = 2; turn <= 50; turn++) {
            if (rn2(TROLL_REVIVE_CHANCE)) continue;
            kind = OBJECT_TIMER_KIND.REVIVE_MON;
            delay = turn;
            break;
        }
    } else if (zombify && ZOMBIE_FORM_BY_LIVING_CORPSE.has(species)
        && !body.norevive) {
        kind = OBJECT_TIMER_KIND.ZOMBIFY_MON;
        delay = rn1(15, 5);
    }
    // start_timer() counts from svm.moves itself, which is still 0 while
    // the first level is built; only the age above uses max(moves, 1).
    scheduleObjectTimer(
        body, kind, (game.moves ?? 0) + delay, game,
    );
}

function attachEggHatchTimer(egg: GameObject, remaining = 0): void {
    if (remaining > 0) {
        scheduleObjectTimer(
            egg, OBJECT_TIMER_KIND.HATCH_EGG,
            (game.moves ?? 0) + remaining, game,
        );
        return;
    }
    // timeout.c attach_egg_hatch_timeout(): reproduce the legacy per-turn
    // hatch trial beginning at age 151.
    for (let age = 151; age <= 200; age++) {
        if (rnd(age) <= 150) continue;
        scheduleObjectTimer(
            egg, OBJECT_TIMER_KIND.HATCH_EGG,
            (game.moves ?? 0) + age, game,
        );
        return;
    }
}

export function restartEggHatchTimer(egg: GameObject | null | undefined) {
    if (!egg || egg.otyp !== EGG) return null;
    stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
    attachEggHatchTimer(egg);
    return objectTimers(egg).find(timer =>
        timer.kind === OBJECT_TIMER_KIND.HATCH_EGG) || null;
}

export function set_corpsenm(otmp: GameObject | null | undefined, pm: number): void {
    if (!otmp) return;
    const existingEggTimer = otmp.otyp === EGG
        ? objectTimers(otmp).find(timer =>
            timer.kind === OBJECT_TIMER_KIND.HATCH_EGG)
        : null;
    const remainingEggTime = existingEggTimer
        ? Math.max(0, existingEggTimer.deadline - (game.moves ?? 0))
        : 0;
    // set_corpsenm() replaces timers which depend on the object's species.
    stopAllObjectTimers(otmp);
    otmp.corpsenm = pm;
    if (otmp.otyp === CORPSE) {
        startCorpseTimeout(otmp);
        otmp.owt = objectWeight(otmp);
    } else if (otmp.otyp === EGG && pm >= 0) {
        attachEggHatchTimer(otmp, remainingEggTime);
    }
}

// C mkobj.c:mkcorpstat(). Generation uses an explicit square; live callers
// may request <0,0>, whose relocation can run floor effects and show messages.
export async function createCorpstatAt(
    objtyp: number, mtmp: Monster | null, pm: number | null,
    x: number, y: number, flags: number, { zombify = false, noRevive = false } = {},
): Promise<GameObject> {
    if (!isok(x, y)) throw new RangeError('Corpstat creation needs an explicit map square');
    const object = await mksobj(objtyp, !!(flags & CORPSTAT_INIT), false, { zombify });
    placeCreatedObject(object, x, y);
    return finishCorpstat(object, mtmp, pm, flags, zombify, noRevive);
}

export async function mkcorpstat(
    objtyp: number, mtmp: Monster | null, pm: number | null,
    x: number, y: number, flags: number,
    { state = game, zombify = false, noRevive = false }: {
        state?: GameState; zombify?: boolean; noRevive?: boolean;
    } = {},
): Promise<GameObject> {
    requireLiveGame(state);
    if (x !== 0 || y !== 0)
        return await createCorpstatAt(objtyp, mtmp, pm, x, y, flags, { zombify, noRevive });
    const object = await mksobj(objtyp, !!(flags & CORPSTAT_INIT), false, { zombify });
    await relocateObjectRandomly(object, { state });
    return finishCorpstat(object, mtmp, pm, flags, zombify, noRevive);
}

function finishCorpstat(
    otmp: GameObject, mtmp: Monster | null, pm: number | null,
    flags: number, zombify: boolean, noRevive: boolean,
): GameObject {
    // Placement sees mksobj's temporary identity, not the caller's override.
    otmp.spe = flags & CORPSTAT_SPE_VAL;
    if (noRevive) otmp.norevive = true;
    if (mtmp) {
        otmp.oextra = {
            ...(otmp.oextra || {}),
            omonst: saveMonsterTraits(mtmp),
        };
        if (pm == null) pm = mtmp.mnum;
        if (mtmp.mcan && !isRider(pm)) otmp.norevive = true;
    }
    if (pm != null) {
        const oldCorpsenm = otmp.corpsenm;
        otmp.corpsenm = pm;
        otmp.owt = objectWeight(otmp);
        if (otmp.otyp === CORPSE
            && (zombify
                || corpseHasSpecialTiming(oldCorpsenm)
                || corpseHasSpecialTiming(pm))) {
            stopAllObjectTimers(otmp);
            startCorpseTimeout(otmp, { zombify });
        }
    }
    return otmp;
}

const monsterGenerationOrder = Array.from(
    { length: SPECIAL_PM }, (_, mndx) => mndx,
).sort((left, right) => {
    const leftKey = (requireMonsterData(MONSTER_SYMBOL, left) << 8)
        | requireMonsterData(MONSTER_DIFFICULTY, left);
    const rightKey = (requireMonsterData(MONSTER_SYMBOL, right) << 8)
        | requireMonsterData(MONSTER_DIFFICULTY, right);
    return leftKey - rightKey || left - right;
});

export function mkclassAligned(monsterClass: number, spc = 0, atyp = A_NONE): number | null {
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
    const weights = new Map<number, number>();
    let totalWeight = 0;
    let previousDifficulty = 0;
    let ignoreGone = false;

    if (spc & G_IGNORE) {
        ignoreGone = true;
        spc &= ~G_IGNORE;
    }
    for (const mndx of classMembers) {
        const difficulty = requireMonsterData(MONSTER_DIFFICULTY, mndx);
        const strongerThanPrevious = difficulty > previousDifficulty;
        previousDifficulty = difficulty;
        if (atyp !== A_NONE
            && Math.sign(requireMonsterData(MONSTER_ALIGNMENT, mndx)) !== Math.sign(atyp)) {
            continue;
        }
        let generationMask = G_NOGEN | G_UNIQ;
        if (rn2(9) || monsterClass === S_LICH)
            generationMask |= inHell ? G_NOHELL : G_HELL;
        generationMask &= ~spc;
        const geno = requireMonsterData(MONSTER_GENO, mndx);
        const gone = !!((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE);
        if (!(geno & generationMask)
            && (ignoreGone || !gone)
            && !PLACEHOLDER_MONSTERS.has(mndx)
            && MONSTER_NAME[mndx] !== 'mail daemon') {
            if (totalWeight && difficulty > maxMonsterLevel
                && strongerThanPrevious
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
    }
    if (!totalWeight) return null;
    let choice = rnd(totalWeight);
    for (const mndx of classMembers) {
        const weight = weights.get(mndx) || 0;
        if ((choice -= weight) <= 0) return mndx;
    }
    return null;
}

function mkclass(monsterClass: number, spc = 0): number | null {
    return mkclassAligned(monsterClass, spc, A_NONE);
}

// C makemon.c:align_shift() caches Is_special(&u.uz) until svm.moves
// changes.  Zero-time wizard level travel can therefore construct more than
// one level on the same move while retaining the first level's alignment.
// Keep that source lifetime explicit instead of reading the destination
// descriptor afresh for every reservoir candidate.
function rndmonstAlignment(): number | null {
    const moves = game.moves ?? 0;
    if (game._rndmonstAlignmentMove !== moves) {
        game._rndmonstAlignmentMove = moves;
        game._rndmonstAlignment = specialLevelAt();
    }
    // C caches only the special-level descriptor. For an ordinary level it
    // reads the current dungeon on each call, even within the same move.
    return game._rndmonstAlignment
        ? game._rndmonstAlignment.alignment
        : game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.alignment ?? null;
}

function rndmonstReservoir(minAdjustment = 0, maxAdjustment = 0): number | null {
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
        const difficulty = requireMonsterData(MONSTER_DIFFICULTY, mndx);
        const geno = requireMonsterData(MONSTER_GENO, mndx);
        if (difficulty < minDifficulty || difficulty > maxDifficulty) continue;
        if (geno & (0x0200 | 0x1000)) continue; // G_NOGEN | G_UNIQ
        if ((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE) continue;
        if (inHell) {
            if ((MONSTER_ALIGNMENT[mndx] || 0) > A_NEUTRAL
                || (geno & 0x0800)) continue; // lawful or G_NOHELL
        } else if (geno & 0x0400) continue; // G_HELL
        let weight = geno & 0x0007;
        // C align_shift(): a special level's fixed alignment changes the
        // selection weights before the caller can replace the species.
        const levelAlign = rndmonstAlignment();
        const monsterAlign = MONSTER_ALIGNMENT[mndx] || 0;
        if (levelAlign === A_LAWFUL)
            weight += Math.trunc((monsterAlign + 20) / 8);
        else if (levelAlign === A_NEUTRAL)
            weight += Math.trunc((20 - Math.abs(monsterAlign)) / 4);
        else if (levelAlign === A_CHAOTIC)
            weight += Math.trunc((20 - monsterAlign) / 8);
        // makemon.c:temperature_shift().  Gehennom begins hot in
        // mklev.c and cold special levels can override that inherited flag.
        const temperature = game.level?.flags?.temperature || 0;
        const preferredResistance = temperature > 0 ? 0x01
            : temperature < 0 ? 0x02 : 0; // MR_FIRE / MR_COLD
        if (preferredResistance
            && (requireMonsterData(MONSTER_RESISTS, mndx) & preferredResistance)) {
            weight += 3;
        }
        if (weight > 0) {
            totalWeight += weight;
            if (rn2(totalWeight) < weight) selected = mndx;
        }
    }
    return selected >= 0 ? selected : null;
}

export function rndmonnum(): number {
    return rndmonnumAdj(0, 0);
}

// C mkobj.c:rndmonnum_adj(). Object identities still need a species when
// no level-appropriate living monster can be generated. Its fallback
// deliberately ignores extinction and genocide, as well as difficulty.
function rndmonnumAdj(minAdjustment = 0, maxAdjustment = 0): number {
    const selected = rndmonstAdj(minAdjustment, maxAdjustment);
    if (selected != null) return selected;

    const G_UNIQ = 0x1000;
    const G_HELL = 0x0400;
    const G_NOHELL = 0x0800;
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const excluded = G_UNIQ | G_NOGEN | (inHell ? G_NOHELL : G_HELL);
    let species;
    do {
        species = rn2(SPECIAL_PM);
    } while (requireMonsterData(MONSTER_GENO, species) & excluded);
    return species;
}

function questMonsterType(): number | null {
    const role = game.urole;
    if (rn2(5)) {
        const qpm = role?.enemy1num
            ?? (role?.filecode === 'Pri' ? PM_HUMAN_ZOMBIE : null);
        if (qpm != null && qpm >= 0 && rn2(5)
            && !((game.mvitals?.[qpm]?.mvflags ?? 0) & G_GENOD)) return qpm;
        return mkclass(role?.enemy1sym ?? 52, 0);
    }
    const qpm = role?.enemy2num
        ?? (role?.filecode === 'Pri' ? 230 : null);
    if (qpm != null && qpm >= 0 && rn2(5)
        && !((game.mvitals?.[qpm]?.mvflags ?? 0) & G_GENOD)) return qpm;
    return mkclass(role?.enemy2sym ?? 49, 0);
}

export function rndmonstAdj(minAdjustment = 0, maxAdjustment = 0): number | null {
    const dnum = game.u?.uz?.dnum ?? 0;
    if (game.dungeons?.[dnum]?.dname === 'The Quest' && rn2(7)) {
        const questMonster = questMonsterType();
        if (questMonster != null) return questMonster;
    }
    return rndmonstReservoir(minAdjustment, maxAdjustment);
}

const M2_HUMAN = 0x00000008;
const M2_ELF = 0x00000010;
const M2_DWARF = 0x00000020;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
const M2_DEMON = 0x00000100;
const M2_JEWELS = 0x20000000;
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
const G_LGROUP = 0x0040;
const G_SGROUP = 0x0080;

// C ref: makemon.c peace_minded().  Random level monsters must resolve their
// attitude before inventory creation; the live hero alignment record is an
// input, so prayer and other alignment mutations remain observable here.
export function peaceMinded(mndx: number): boolean {
    const flags = MONSTER_FLAGS2[mndx] || 0;
    if (flags & M2_PEACEFUL) return true;
    if (flags & M2_HOSTILE) return false;
    // Erinyes are the one species whose attitude is controlled directly by
    // alignment abuse instead of the ordinary co-aligned random chance.
    if (mndx === PM_ERINYS) return !(game.u?.ualign?.abuse ?? 0);

    const race = game.urace;
    if (!race) throw new Error('monster attitude requires a chosen hero race');
    if (flags & race.lovemask) return true;
    if (flags & race.hatemask) return false;

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
export function initialMonsterSleepState(mndx: number, forceAsleep = false): 0 | 1 {
    let sleeping: 0 | 1 = forceAsleep ? 1 : 0;
    const monsterClass = MONSTER_SYMBOL[mndx];
    if (monsterClass === 12) { // S_LEPRECHAUN
        sleeping = 1;
    } else if (monsterClass === 14
        || monsterClass === 36) { // S_NYMPH or S_JABBERWOCK
        if (rn2(5) && !game.u?.uhave?.amulet) sleeping = 1;
    }
    return sleeping;
}

async function initMonsterGroup(
    mndx: number, x: number, y: number, countRange: number, mmflags: number,
): Promise<void> {
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

function levelMonsterAt(x: number, y: number, ignore: Monster | null = null): Monster | undefined {
    return game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) && monster !== ignore
        && (monster?.mhp ?? 1) > 0 && monsterOccupiesPosition(monster, x, y));
}

// C ref: makemon.c makemon_rnd_goodpos().  The random phase owns a complete
// x/y pair for every rejected candidate.  Level generation skips the
// visibility-avoidance pass, then falls back to a deterministic wrapped scan
// only if all fifty random candidates fail.
function randomMonsterPosition(mndx: number | null): Position | null {
    const subject = mndx == null ? null : { kind: 'species' as const, mnum: mndx };
    let x = 0, y = 0, good = false, tryCount = 0;
    do {
        x = rn1(COLNO - 3, 2);
        y = rn2(ROWNO);
        good = (!game.in_mklev
            && !!((game.viz_array?.[y]?.[x] ?? 0) & 0x02))
            ? false : goodPosition(x, y, subject, { gpflags: GP_AVOID_MONPOS });
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
                    && !!((game.viz_array?.[candidateY]?.[candidateX] ?? 0) & 0x02)) {
                    continue;
                }
                if (goodPosition(candidateX, candidateY, subject, { gpflags: GP_AVOID_MONPOS }))
                    return { x: candidateX, y: candidateY };
            }
        }
    }
    return null;
}

// C makemon.c:set_mimic_sym(). Selection precedes inventory generation;
// object-backed disguises also own their represented species or fruit.
export async function setMimicAppearance(monster: Monster): Promise<void> {
    if (game.u?.protectionFromShapeChangers || game.protectionFromShapeChangers)
        return;
    const { type, appearance } = await chooseMimicAppearance(monster.mx, monster.my);
    monster.m_ap_type = type;
    monster.mappearance = appearance;
    if (type === M_AP_OBJECT
        && [STATUE, FIGURINE, CORPSE, EGG, TIN].includes(appearance)) {
        let represented = rndmonnum();
        const vital = game.mvitals?.[represented];
        if (!vital) throw new Error(`missing species history for mimic appearance ${represented}`);
        const noCorpse = !!(vital.mvflags & G_NOCORPSE);
        if (appearance === CORPSE && noCorpse)
            represented = rn1(PM_WIZARD - PM_ARCHAEOLOGIST + 1, PM_ARCHAEOLOGIST);
        else if ((appearance === EGG && !hatchableEggSpecies(represented))
            || (appearance === TIN && noCorpse)) {
            // The pinned C tests the integer hatch result for zero here,
            // rather than comparing it with NON_PM (-1).
            represented = -1;
        }
        monster.mcorpsenm = represented;
    } else if (type === M_AP_OBJECT && appearance === SLIME_MOLD) {
        const fruit = game.context.current_fruit;
        if (fruit === undefined) throw new Error('fruit history must precede mimic creation');
        monster.mcorpsenm = fruit;
        game.flags.made_fruit = true;
    } else if (type === M_AP_FURNITURE && appearance === 33) { // S_altar
        const alignment = rn2(3) - 1;
        monster.mcorpsenm = In_hell(game.u.uz) && rn2(3)
            ? 0 : Align2amask(alignment);
    } else if (monster.mcorpsenm != null) monster.mcorpsenm = -1;
    vision_note_blocker_change(monster.mx, monster.my);
}

async function chooseMimicAppearance(x: number, y: number): Promise<{ type: number; appearance: number }> {
    const level = requireGameLevel();
    const object = (appearance: number) => ({ type: M_AP_OBJECT, appearance });
    const furniture = (appearance: number) => ({ type: M_AP_FURNITURE, appearance });
    const floorObject = level.objects[x]?.[y]?.[0];
    if (floorObject) return object(floorObject.otyp);

    const location = level.at(x, y);
    if (!location) throw new RangeError(`mimic position (${x}, ${y}) is outside its level`);
    if (IS_DOOR(location.typ) || IS_WALL(location.typ)
        || location.typ === SDOOR || location.typ === SCORR) {
        const left = level.at(x - 1, y)?.typ;
        const horizontal = x !== 0 && left !== undefined
            && [HWALL, TLCORNER, TRWALL, BLCORNER, TDWALL, CROSSWALL, TUWALL].includes(left);
        if (Is_rogue_level(game.u.uz)) return furniture(horizontal ? 2 : 1);
        return furniture(horizontal ? 16 : 15); // S_hcdoor / S_vcdoor
    }
    if (level.flags.is_maze_lev
        && !(In_mines(game.u.uz) && inTown(level, game.u.ux, game.u.uy))
        && !In_sokoban(game.u.uz) && rn2(2)) return object(STATUE);

    const roomIndex = location.roomno - ROOMOFFSET;
    if (roomIndex < 0 && !level.traps.some(trap => trap.tx === x && trap.ty === y))
        return object(BOULDER);
    const roomType = roomForIndex(level, roomIndex)?.rtype ?? 0;
    if (roomType === ZOO || roomType === VAULT) return object(GOLD_PIECE);
    if (roomType === DELPHI) return rn2(2) ? object(STATUE) : furniture(37); // S_fountain
    if (roomType === TEMPLE) return furniture(33); // S_altar

    // C's first two syms entries choose furniture; the last two choose the
    // generic strange object. Shops exclude the furniture entries.
    const furnitureClass = 18; // MAXOCLASSES
    const classes = [
        furnitureClass, furnitureClass, RING_CLASS, WAND_CLASS, WEAPON_CLASS,
        FOOD_CLASS, COIN_CLASS, SCROLL_CLASS, POTION_CLASS, ARMOR_CLASS,
        AMULET_CLASS, TOOL_CLASS, ROCK_CLASS, GEM_CLASS, SPBOOK_CLASS, 0, 0,
    ];
    let objectClass;
    if (roomType >= SHOPBASE) {
        if (rn2(10) >= depth_of_level(game.u.uz)) return object(0);
        objectClass = getShopItem(roomType - SHOPBASE);
        if (objectClass < 0) return object(-objectClass);
        if (roomType - SHOPBASE === 10 && objectClass > furnitureClass)
            return object(rn2(2) ? LUMP_OF_ROYAL_JELLY : SLIME_MOLD);
        if (objectClass === RANDOM_CLASS || objectClass >= furnitureClass)
            objectClass = classes[rn2(classes.length - 2) + 2];
    } else objectClass = classes[rn2(classes.length)];

    if (objectClass === undefined)
        throw new RangeError('mimic object-class selection exceeded its table');
    if (objectClass === furnitureClass) {
        const appearance = [25, 25, 26, 26, 33, 34, 35, 36][rn2(8)];
        if (appearance === undefined)
            throw new RangeError('mimic furniture selection exceeded its table');
        return furniture(appearance);
    }
    if (objectClass === 0) return object(0);
    if (objectClass === COIN_CLASS) return object(GOLD_PIECE);
    const temporary = await mkobj(objectClass, false);
    const appearance = temporary.otyp;
    await deleteObject(temporary);
    return object(appearance);
}

async function makemon(
    mdat: number | null, x: number, y: number, mmflags: number, requestedByHero = false,
): Promise<MonsterBirthState | null> {
    const level = requireGameLevel();
    if (mdat == null && level?.flags?.rndmongen === false) return null;
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
            mndx = rndmonstAdj();
            if (mndx == null) return null;
            ++tryCount;
        } while (tryCount <= 50
            && !goodPosition(x, y, { kind: 'species', mnum: mndx }));
    }
    if (mdat != null
        && ((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GENOD)) return null;
    propagateMonsterSpecies(mndx, !(mmflags & MM_NOCOUNTBIRTH), false);
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
    let peaceful = (mmflags & MM_ANGRY) ? false : peaceMinded(mndx);
    // makemon.c species switch: elves meet orcs hostile, and a unicorn
    // sharing the sign of the hero's alignment is peaceful.
    if (MONSTER_SYMBOL[mndx] === 15 && game.urace?.name === 'elf') { // S_ORC
        peaceful = false;
    } else if (MONSTER_SYMBOL[mndx] === 21 // S_UNICORN
        && (genderFlags & M2_JEWELS) !== 0
        && Math.sign(game.u?.ualign?.type ?? 0)
            === Math.sign(MONSTER_ALIGNMENT[mndx] ?? 0)) {
        peaceful = true;
    }
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
    if (!level.monsters) level.monsters = [];
    const monsterInventory: GameObject[] = [];
    const pendingMonster: MonsterBirthState = {
        m_id: monsterId, cham: -1,
        mnum: mndx, mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: baseLevel, female: monsterFemale,
        mcanmove: 1, mcansee: 1, mgenmklev: !!game.in_mklev,
        mux: 0, muy: 0,
        msleeping: monsterSleeping, mpeaceful: peaceful ? 1 : 0,
        minvent: monsterInventory,
        inventory: monsterInventory,
        hasInventory: false,
    };
    const monsterIndex = level.monsters.push(pendingMonster) - 1;
    const isMimic = MONSTER_SYMBOL[mndx] === S_MIMIC;
    if (isMimic) await setMimicAppearance(pendingMonster);

    let generatedGhostName = null;
    if (mndx === 287 && !(mmflags & MM_NONAME)) { // PM_GHOST
        generatedGhostName = randomGhostName();
    }

    const shaped = await initialShapechangedBirth(pendingMonster);
    if (shaped) {
        if (requestedByHero)
            setMonsterApparentHeroPosition(shaped, game, rn2);
        level.monsters[monsterIndex] = shaped;
        return finishMonsterBirth(shaped, mmflags);
    }

    // makemon.c owns this initialization when its original requested
    // coordinate was the hero's occupied square.  enexto() has already moved
    // the actor, so preserve that caller fact separately from final x/y.
    if (requestedByHero)
        setMonsterApparentHeroPosition(pendingMonster, game, rn2);

    if (mndx === PM_LONG_WORM)
        initializeMonsterWormBody(pendingMonster, {
            allowTail: !(mmflags & MM_NOTAIL),
        });

    // C makemon() type setup: spiders and snakes born during level creation
    // receive a random floor object before they hide beneath it.
    if (game.in_mklev
        && (MONSTER_SYMBOL[mndx] === 19 || MONSTER_SYMBOL[mndx] === 45)
        && x && y) {
        await mkobj_at(RANDOM_CLASS, x, y, true);
    }

    // C makemon.c creates an ordinary aligned/high cleric without MM_EPRI or
    // MM_EMIN as a roaming minion before group and inventory initialization.
    // create_particular() applies an explicit hostile disposition only after
    // this constructor returns, so both alignment/renegade draws remain live.
    let clericMinion: { min_align: number; renegade: boolean; mpeaceful: 0 | 1 } | null = null;
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

    let hasMonsterInventory = false;
    const allowMonsterInventory = !(mmflags & NO_MINVENT);
    let skipCommonMonsterInventory = Is_rogue_level(game.u?.uz);
    // C makemon.c:mongets(). Normalize birth equipment before mpickobj().
    const mongets = async (otyp: number): Promise<GameObject | null> => {
        if (!otyp) return null;
        const object = await mksobj(otyp, true, false);
        if (MONSTER_SYMBOL[mndx] === 56) {
            if (object.blessed) {
                object.blessed = false;
                object.cursed = true;
            }
        } else if ((genderFlags & M2_MINION)
            && (clericMinion?.min_align ?? monsterAlignmentType(pendingMonster)) === A_LAWFUL) {
            object.cursed = false;
            object.spe = Math.max(0, object.spe);
            object.oerodeproof = true;
            object.oeroded = object.oeroded2 = 0;
        } else if (monsterIsPlayerMonster(mndx)
            && object.oclass === WEAPON_CLASS
            && (OBJECT_SUBTYPE[otyp] ?? 0) >= P_SHORT_SWORD
            && (OBJECT_SUBTYPE[otyp] ?? 0) <= P_SABER) {
            object.spe = 3 + rn2(4);
        }

        if (otyp === CANDELABRUM_OF_INVOCATION) {
            object.spe = 0;
            object.age = 0;
            object.lamplit = false;
            object.blessed = object.cursed = false;
        } else if (otyp === BELL_OF_OPENING) {
            object.blessed = object.cursed = false;
        } else if (otyp === SPE_BOOK_OF_THE_DEAD) {
            object.blessed = false;
            object.cursed = true;
        }

        if (genderFlags & M2_PRINCE) {
            if (object.oclass === WEAPON_CLASS) object.spe = Math.max(1, object.spe);
            else if (object.oclass === ARMOR_CLASS) object.spe = Math.max(0, object.spe);
        }

        await addCreatedObjectToMonsterInventory(pendingMonster, object, game);
        hasMonsterInventory = true;
        return object.where === 'gone' ? null : object;
    };
    // C makemon.c:m_initthrow(). Throwing stacks bypass mongets(): the raw
    // mksobj() result goes straight into the inventory, so demons keep any
    // blessing, the quantity is replaced with rn1(oquan, 3), and orcish
    // arrows are always created poisoned.
    const mInitthrow = async (otyp: number, oquan: number): Promise<void> => {
        const object = await mksobj(otyp, true, false);
        object.quan = 3 + rn2(oquan);
        object.quantity = object.quan;
        object.owt = (OBJECT_WEIGHT[otyp] ?? 1) * object.quan;
        if (otyp === ORCISH_ARROW) object.opoisoned = true;
        await addCreatedObjectToMonsterInventory(pendingMonster, object, game);
        hasMonsterInventory = true;
    };
    const mkmonmoney = async (amount: number): Promise<GameObject> => {
        const gold = await mksobj(GOLD_PIECE, false, false);
        gold.quan = amount;
        gold.quantity = amount;
        await linkCreatedObjectToMonsterInventory(pendingMonster, gold);
        hasMonsterInventory = true;
        return gold;
    };
    const giveOffensiveMonsterItem = async () => {
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) await mongets(offensiveItem);
        }
    };
    const giveGeneralMonsterWeapon = async () => {
        const bias = ((genderFlags & M2_LORD) ? 1 : 0)
            + ((genderFlags & M2_PRINCE) ? 2 : 0)
            + ((genderFlags & M2_NASTY) ? 1 : 0);
        switch (rnd(14 - 2 * bias)) {
        case 1:
            if (genderFlags & M2_STRONG) await mongets(BATTLE_AXE);
            else await mInitthrow(DART, 12);
            break;
        case 2:
            if (genderFlags & M2_STRONG) await mongets(TWO_HANDED_SWORD);
            else {
                await mongets(CROSSBOW);
                await mInitthrow(CROSSBOW_BOLT, 12);
            }
            break;
        case 3:
            await mongets(BOW);
            await mInitthrow(18, 12); // ARROW
            break;
        case 4:
            if (genderFlags & M2_STRONG) await mongets(LONG_SWORD);
            else await mInitthrow(DAGGER, 3);
            break;
        case 5:
            await mongets((genderFlags & M2_STRONG) ? LUCERN_HAMMER : AKLYS);
            break;
        default:
            break;
        }
        await giveOffensiveMonsterItem();
    };
    if (allowMonsterInventory && mndx === PM_VLAD_THE_IMPALER)
        await mongets(CANDELABRUM_OF_INVOCATION);
    if (isQuestNemesis) {
        // makemon() gives MS_NEMESIS the Bell before its level-generation
        // sleep gate and normal weapon/inventory initialization.
        if (allowMonsterInventory) await mongets(BELL_OF_OPENING);
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
        await giveGeneralMonsterWeapon();
    } else if (mndx >= 59 && mndx <= 61) { // kobold through kobold leader
        // C ref: makemon.c m_initweap(), S_KOBOLD.
        if (!rn2(4)) await mInitthrow(DART, 12);
        rn2(75); // final m_initweap() offensive-item check
    } else if (mndx >= 70 && mndx <= 73) {
        // C ref: makemon.c m_initweap(), S_ORC.  Goblins, hobgoblins,
        // corpses-only base orcs, and hill orcs all use the default armament
        // branch; the goblin form short-circuits the dagger/scimitar choice.
        if (rn2(2)) await mongets(ORCISH_HELM);
        if (rn2(2)) {
            const weapon = mndx === 70 || rn2(2) === 0
                ? ORCISH_DAGGER : SCIMITAR;
            await mongets(weapon);
        }
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 27
        && (requireMonsterData(MONSTER_FLAGS1, mndx) & 0x00020000)
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C ref: m_initweap(), humanoid S_ANGEL.  Minion weapons and shields
        // deliberately bypass mongets()/ordinary object initialization.
        const isLord = !!(genderFlags & 0x00000400);
        const weapon = await mksobj(rn2(3) ? LONG_SWORD : SILVER_MACE, false, false);
        const promote = !rn2(20) || isLord;
        if (promote && requireMonsterData(MONSTER_ALIGNMENT, mndx) > 0) {
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
        await addCreatedObjectToMonsterInventory(pendingMonster, weapon, game);
        hasMonsterInventory = true;

        const shield = await mksobj(
            !rn2(4) || isLord ? 158 : LARGE_SHIELD,
            false, false,
        );
        shield.oerodeproof = true;
        shield.spe = 0;
        await addCreatedObjectToMonsterInventory(pendingMonster, shield, game);
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 8 && mndx === PM_HOBBIT) {
        // C ref: makemon.c m_initweap(), S_HUMANOID/PM_HOBBIT.
        const weaponRoll = rn2(3);
        if (weaponRoll === 0) await mongets(DAGGER);
        else if (weaponRoll === 1) await mongets(ELVEN_DAGGER);
        else {
            await mongets(SLING);
            await mInitthrow(!rn2(4) ? FLINT : ROCK, 6);
        }
        if (!rn2(10)) await mongets(ELVEN_MITHRIL_COAT);
        if (!rn2(10)) await mongets(DWARVISH_CLOAK);
        rn2(75);
    } else if (MONSTER_SYMBOL[mndx] === 8
        && (genderFlags & M2_DWARF)) {
        // C ref: makemon.c m_initweap(), S_HUMANOID/is_dwarf().  Keep the
        // complete equipment tree together because every optional item feeds
        // the same ordinary object constructor and erosion rules.
        if (rn2(7)) await mongets(DWARVISH_CLOAK);
        if (rn2(7)) await mongets(IRON_SHOES);
        if (!rn2(4)) {
            await mongets(DWARVISH_SHORT_SWORD);
            if (rn2(2)) {
                await mongets(DWARVISH_MATTOCK);
            } else {
                await mongets(rn2(2) ? AXE : DWARVISH_SPEAR);
                await mongets(DWARVISH_ROUNDSHIELD);
            }
            await mongets(DWARVISH_IRON_HELM);
            if (!rn2(3)) await mongets(DWARVISH_MITHRIL_COAT);
        } else {
            await mongets(!rn2(3) ? PICK_AXE : DAGGER);
        }
        await giveOffensiveMonsterItem();
    } else if (mndx >= 264 && mndx <= 269) { // ordinary elf species
        // C ref: makemon.c m_initweap(), is_elf().  Clothing probes precede
        // the mutually exclusive primary loadout; monarchs then receive two
        // extra utility probes before the common offensive-item tail.
        if (rn2(2))
            await mongets(rn2(2) ? ELVEN_MITHRIL_COAT : ELVEN_CLOAK);
        if (rn2(2)) await mongets(ELVEN_LEATHER_HELM);
        else if (!rn2(4)) await mongets(ELVEN_BOOTS);
        if (rn2(2)) await mongets(ELVEN_DAGGER);
        switch (rn2(3)) {
        case 0: {
            if (!rn2(4)) await mongets(ELVEN_SHIELD);
            if (rn2(3)) await mongets(ELVEN_SHORT_SWORD);
            await mongets(ELVEN_BOW);
            await mInitthrow(ELVEN_ARROW, 12);
            break;
        }
        case 1:
            await mongets(ELVEN_BROADSWORD);
            if (rn2(2)) await mongets(ELVEN_SHIELD);
            break;
        case 2:
            if (rn2(2)) {
                await mongets(ELVEN_SPEAR);
                await mongets(ELVEN_SHIELD);
            }
            break;
        }
        if (mndx === 269) { // PM_ELVEN_MONARCH
            if (rn2(3) || (game.in_mklev && Is_earthlevel(game.u?.uz)))
                await mongets(PICK_AXE);
            if (!rn2(50)) await mongets(CRYSTAL_BALL);
        }
        await giveOffensiveMonsterItem();
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
        if (primaryWeapon) await mongets(primaryWeapon);
        if (!secondaryWeapon && primaryWeapon !== DAGGER && !rn2(4))
            secondaryWeapon = KNIFE;
        if (secondaryWeapon) await mongets(secondaryWeapon);
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) await mongets(offensiveItem);
        }

        let mercenaryAc = (mndx === PM_SOLDIER || mndx === PM_WATCHMAN) ? 3
            : mndx === PM_SERGEANT ? 0
                : (mndx === PM_LIEUTENANT
                    || mndx === PM_WATCH_CAPTAIN) ? -2 : -3;
        const addArmor = async (otyp: number): Promise<void> => {
            const object = await mongets(otyp);
            mercenaryAc += armorBonus(object);
        };
        if (mercenaryAc < -1 && rn2(5))
            await addArmor(rn2(5) ? PLATE_MAIL : CRYSTAL_PLATE_MAIL);
        else if (mercenaryAc < 3 && rn2(5))
            await addArmor(rn2(3) ? SPLINT_MAIL : BANDED_MAIL);
        else if (rn2(5))
            await addArmor(rn2(3) ? RING_MAIL : STUDDED_LEATHER_ARMOR);
        else
            await addArmor(LEATHER_ARMOR);

        if (mercenaryAc < 10 && rn2(3)) await addArmor(HELMET);
        else if (mercenaryAc < 10 && rn2(2)) await addArmor(DENTED_POT);

        if (mercenaryAc < 10 && rn2(3)) await addArmor(SMALL_SHIELD);
        else if (mercenaryAc < 10 && rn2(2)) await addArmor(LARGE_SHIELD);

        if (mercenaryAc < 10 && rn2(3)) await addArmor(LOW_BOOTS);
        else if (mercenaryAc < 10 && rn2(2)) await addArmor(HIGH_BOOTS);

        if (mercenaryAc < 10 && rn2(3)) await addArmor(LEATHER_GLOVES);
        else if (mercenaryAc < 10 && rn2(2)) await addArmor(LEATHER_CLOAK);

        if (mndx === PM_WATCHMAN) {
            if (rn2(3)) await mongets(TIN_WHISTLE);
        } else if (mndx !== PM_WATCH_CAPTAIN) {
            if (!rn2(3)) await mongets(K_RATION);
            if (!rn2(2)) await mongets(C_RATION);
            if (mndx !== PM_SOLDIER && !rn2(3)) await mongets(BUGLE);
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
        if (primaryWeapon) await mongets(primaryWeapon);
        if (!secondaryWeapon && primaryWeapon !== DAGGER && !rn2(4))
            secondaryWeapon = KNIFE;
        if (secondaryWeapon) await mongets(secondaryWeapon);
        rn2(75);

        if (rn2(5)) await mongets(rn2(3) ? SPLINT_MAIL : BANDED_MAIL);
        else await mongets(LEATHER_ARMOR);

        if (rn2(3)) await mongets(HELMET);
        else if (rn2(2)) await mongets(DENTED_POT);

        if (rn2(3)) await mongets(SMALL_SHIELD);
        else if (rn2(2)) await mongets(LARGE_SHIELD);

        if (rn2(3)) await mongets(LOW_BOOTS);
        else if (rn2(2)) await mongets(HIGH_BOOTS);

        if (rn2(3)) await mongets(LEATHER_GLOVES);
        else if (rn2(2)) await mongets(LEATHER_CLOAK);

        const whistle = await mksobj(TIN_WHISTLE, true, false);
        whistle.cursed = true;
        whistle.buc = 'cursed';
        await addCreatedObjectToMonsterInventory(pendingMonster, whistle, game);
        hasMonsterInventory = true;
    } else if (mndx === PM_SHOPKEEPER) {
        // C refs: makemon.c m_initweap() and m_initinv().  Shopkeepers have
        // no class-specific weapon, but are armed and therefore still reach
        // the final offensive-item roll before receiving their fixed kit.
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) await mongets(offensiveItem);
        }
        await mongets(SKELETON_KEY);
        const firstKitItem = rn2(4);
        if (firstKitItem === 0) await mongets(WAN_MAGIC_MISSILE);
        if (firstKitItem <= 1) await mongets(POT_EXTRA_HEALING);
        if (firstKitItem <= 2) await mongets(POT_HEALING);
        await mongets(WAN_STRIKING);
    } else if (MONSTER_SYMBOL[mndx] === 56
        && (genderFlags & M2_DEMON)
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C m_initweap(), S_DEMON: fixed demon weapons are added before the
        // same bias-sensitive general armament table used by normal monsters.
        if (mndx === PM_BALROG) {
            await mongets(BULLWHIP);
            await mongets(52); // BROADSWORD
        } else if (mndx === PM_ORCUS) {
            await mongets(WAN_DEATH);
        } else if (mndx === PM_HORNED_DEVIL) {
            await mongets(rn2(4) ? 33 : BULLWHIP); // TRIDENT
        } else if (mndx === PM_DISPATER) {
            await mongets(WAN_STRIKING);
        } else if (mndx === PM_YEENOGHU) {
            await mongets(81); // FLAIL
        }
        await giveGeneralMonsterWeapon();
    } else if (mndx === PM_ARCH_PRIEST || mndx === PM_ALIGNED_CLERIC
        || mndx === PM_HIGH_CLERIC) {
        // C ref: makemon.c m_initweap(), Priest/Cleric quest-leader branch.
        // This intentionally bypasses ordinary object initialization.
        const mace = await mksobj(MACE, false, false);
        mace.spe = rnd(3);
        if (!rn2(2)) {
            mace.cursed = true;
            mace.buc = 'cursed';
        }
        await addCreatedObjectToMonsterInventory(pendingMonster, mace, game);
        hasMonsterInventory = true;
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem) await mongets(offensiveItem);
        }
    } else if (mndx === PM_STUDENT || mndx === PM_ACOLYTE
        || mndx === PM_APPRENTICE) {
        // C ref: makemon.c m_initweap(), MS_GUARDIAN novice equipment.
        // Students, acolytes, and apprentices share the same low-tier
        // guardian armament graph; keeping it constructor-owned also covers
        // their respective quest-start level programs.
        if (rn2(2)) await mongets(rn2(3) ? DAGGER : KNIFE);
        if (rn2(5)) await mongets(rn2(3) ? LEATHER_JACKET : LEATHER_CLOAK);
        if (rn2(3)) await mongets(rn2(3) ? LOW_BOOTS : HIGH_BOOTS);
        if (rn2(3)) await mongets(POT_HEALING);
        await giveOffensiveMonsterItem();
    } else if (mndx === PM_CHIEFTAIN) {
        // C ref: makemon.c m_initweap(), the armed MS_GUARDIAN tier used by
        // chieftains, pages, roshi, and warriors.
        await mongets(rn2(3) ? LONG_SWORD : SHORT_SWORD);
        await mongets(rn2(3) ? CHAIN_MAIL : LEATHER_ARMOR);
        if (rn2(2)) await mongets(rn2(2) ? LOW_BOOTS : HIGH_BOOTS);
        if (!rn2(3)) await mongets(LEATHER_CLOAK);
        if (!rn2(3)) {
            await mongets(BOW);
            await mInitthrow(ARROW, 12);
        }
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 15
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_ORC
        // C ref: makemon.c m_initweap(), S_ORC.  The common helm probe
        // precedes a subtype-specific equipment graph; an orc captain chooses
        // one of the two ranked subtypes before entering the same graph.
        if (rn2(2)) await mongets(ORCISH_HELM);
        const orcSubtype = mndx === 77 // PM_ORC_CAPTAIN
            ? (rn2(2) ? 74 : 75) : mndx;
        if (orcSubtype === 74) { // PM_MORDOR_ORC
            if (!rn2(3)) await mongets(SCIMITAR);
            if (!rn2(3)) await mongets(ORCISH_SHIELD);
            if (!rn2(3)) await mongets(KNIFE);
            if (!rn2(3)) await mongets(ORCISH_CHAIN_MAIL);
        } else if (orcSubtype === 75) { // PM_URUK_HAI
            if (!rn2(3)) await mongets(ORCISH_CLOAK);
            if (!rn2(3)) await mongets(ORCISH_SHORT_SWORD);
            if (!rn2(3)) await mongets(IRON_SHOES);
            if (!rn2(3)) {
                await mongets(ORCISH_BOW);
                await mInitthrow(ORCISH_ARROW, 12);
            }
            if (!rn2(3)) await mongets(URUK_HAI_SHIELD);
        } else if (mndx !== 76 && rn2(2)) { // not PM_ORC_SHAMAN
            await mongets(mndx === 70 || !rn2(2) ? ORCISH_DAGGER : SCIMITAR);
        }
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 46) { // S_TROLL
        if (!rn2(2)) {
            const polearms = [RANSEUR, PARTISAN, GLAIVE, SPETUM];
            const polearm = polearms[rn2(polearms.length)];
            if (polearm === undefined)
                throw new RangeError('troll polearm selection exceeded its table');
            await mongets(polearm);
        }
        // The class switch only chooses the ordinary weapon.  Every armed
        // troll still reaches m_initweap()'s shared level-versus-rn2(75)
        // offensive-item tail; high-level Olog-hai make the winning branch
        // observable during summon-nasties.
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 49
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_WRAITH
        // C ref: makemon.c:m_initweap().  Armed wraith-class monsters receive
        // both fixed weapons before the shared offensive-item reservoir.
        await mongets(KNIFE);
        await mongets(LONG_SWORD);
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 52
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_ZOMBIE
        // C ref: makemon.c m_initweap(), S_ZOMBIE.  Armed skeletons first
        // probe for leather armor and a knife/short sword, then rejoin the
        // shared offensive-item tail.
        if (!rn2(4)) await mongets(LEATHER_ARMOR);
        if (!rn2(4)) await mongets(rn2(3) ? KNIFE : SHORT_SWORD);
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 34
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_GIANT
        // C ref: makemon.c m_initweap().  Giants independently probe for a
        // throwing boulder (ettins get a club) and, except for ettins, a
        // heavy melee weapon before the common offensive-item reservoir.
        if (rn2(2))
            await mongets(mndx === PM_ETTIN ? CLUB : BOULDER);
        if (mndx !== PM_ETTIN && !rn2(5))
            await mongets(rn2(2) ? TWO_HANDED_SWORD : BATTLE_AXE);
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 41) { // S_OGRE
        const range = mndx === 205 ? 3 : mndx === 204 ? 6 : 12;
        await mongets(!rn2(range) ? BATTLE_AXE : CLUB);
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 29) { // S_CENTAUR
        // Forest centaurs use bows; the other two species use crossbows.
        // The missile stack is created only when the class probe succeeds.
        if (rn2(2)) {
            const forest = mndx === 131;
            await mongets(forest ? BOW : CROSSBOW);
            await mInitthrow(forest ? 18 : CROSSBOW_BOLT, 12); // ARROW
        }
        await giveOffensiveMonsterItem();
    } else if (mndx === PM_SALAMANDER) {
        // C ref: makemon.c m_initweap(), S_LIZARD/PM_SALAMANDER.  The fixed
        // polearm choice replaces the generic bias-sensitive weapon table,
        // then rejoins its ordinary offensive-item tail.
        await mongets(rn2(7) ? SPEAR : rn2(3) ? 33 : STILETTO);
        await giveOffensiveMonsterItem();
    } else if (MONSTER_SYMBOL[mndx] === 33 // S_GNOME
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C ref: makemon.c m_initweap(), default class armament.  Gnomes do
        // not have a dedicated switch case, so armed gnomes reach this table;
        // leader/ruler ranks narrow it through the lord/prince bias.
        const bias = ((genderFlags & 0x00000400) ? 1 : 0)
            + ((genderFlags & 0x00000800) ? 2 : 0)
            + ((genderFlags & M2_NASTY) ? 1 : 0);
        const weaponRoll = rnd(14 - (2 * bias));
        switch (weaponRoll) {
        case 1:
            if (genderFlags & M2_STRONG) await mongets(BATTLE_AXE);
            else await mInitthrow(DART, 12);
            break;
        case 2:
            if (genderFlags & M2_STRONG) await mongets(TWO_HANDED_SWORD);
            else {
                await mongets(CROSSBOW);
                await mInitthrow(CROSSBOW_BOLT, 12);
            }
            break;
        case 3:
            await mongets(BOW);
            await mInitthrow(18, 12); // ARROW
            break;
        case 4:
            if (genderFlags & M2_STRONG) await mongets(LONG_SWORD);
            else await mInitthrow(DAGGER, 3);
            break;
        case 5:
            await mongets((genderFlags & M2_STRONG) ? LUCERN_HAMMER : AKLYS);
            break;
        default:
            break;
        }
        await giveOffensiveMonsterItem();
    } else if (MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        if (M_INITWEAP_SWITCH_CLASSES.has(requireMonsterData(MONSTER_SYMBOL, mndx))) {
            // This explicit class arm has no additional behavior in the
            // currently ported constructor, but it still bypasses default.
            await giveOffensiveMonsterItem();
        } else {
            // C m_initweap()'s default switch arm first runs the
            // bias-sensitive general weapon table; the rn2(75) probe is its
            // tail, not a replacement for that table.
            await giveGeneralMonsterWeapon();
        }
    }

    // m_initinv(), m_dowear(), and the domestic-saddle probe share the same
    // allow_minvent gate.  NO_MINVENT must consume none of their RNG and must
    // leave an empty minvent even for species with fixed starting objects.
    if (allowMonsterInventory
        && (mndx === PM_ARCH_PRIEST || mndx === PM_ALIGNED_CLERIC
            || mndx === PM_HIGH_CLERIC)) {
        // C ref: makemon.c m_initinv(), Priest/Cleric quest-leader branch.
        await mongets(rn2(7) ? ROBE
            : rn2(3) ? CLOAK_OF_PROTECTION : CLOAK_OF_MAGIC_RESISTANCE);
        await mongets(SMALL_SHIELD);
        await mkmonmoney(rn1(10, 20));
    }

    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 14) { // S_NYMPH
        // C ref: makemon.c m_initinv(), S_NYMPH.
        if (!rn2(2)) await mongets(MIRROR);
        if (!rn2(2)) await mongets(POT_OBJECT_DETECTION);
    }
    if (allowMonsterInventory && mndx === PM_MINOTAUR) {
        // C ref: makemon.c:m_initinv(), S_GIANT.  This probe belongs to the
        // explicit minotaur constructor, before the common defensive and
        // miscellaneous inventory reservoirs.
        if (!rn2(8) || (game.in_mklev && Is_earthlevel(game.u?.uz)))
            await mongets(WAN_DIGGING);
    } else if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 34
        && (genderFlags & M2_GIANT)) {
        // C ref: makemon.c m_initinv(), is_giant().  Each iteration chooses
        // one weighted gem/glass type, creates it without ordinary object
        // initialization, and replaces its stack size with rn1(2,3).
        for (let count = rn2(Math.trunc(baseLevel / 2));
            count > 0; count--) {
            const gem = await mksobj(
                rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1), false, false,
            );
            gem.quan = rn1(2, 3);
            gem.quantity = gem.quan;
            gem.owt = (OBJECT_WEIGHT[gem.otyp] ?? 1) * gem.quan;
            await addCreatedObjectToMonsterInventory(pendingMonster, gem, game);
            hasMonsterInventory = true;
        }
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 12) { // S_LEPRECHAUN
        await mkmonmoney(d(level_difficulty(), 30));
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 39) { // S_MUMMY
        if (rn2(7)) await mongets(MUMMY_WRAPPING);
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 38) { // S_LICH
        if (mndx === 185 && !rn2(13)) { // PM_MASTER_LICH
            await mongets(rn2(7) ? ATHAME : WAN_NOTHING);
        } else if (mndx === 186 && !rn2(3)) { // PM_ARCH_LICH
            const weapon = await mksobj(
                rn2(3) ? ATHAME : QUARTERSTAFF,
                true, !rn2(13),
            );
            if (weapon.spe < 2) weapon.spe = rnd(3);
            if (!rn2(4)) weapon.oerodeproof = true;
            await addCreatedObjectToMonsterInventory(pendingMonster, weapon, game);
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
            const candle = await mongets(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE);
            if (candle) {
                candle.quan = 1;
                candle.quantity = 1;
                candle.lamplit = !level.at(x, y)?.lit;
            }
        }
    }
    if (allowMonsterInventory && MONSTER_SYMBOL[mndx] === 43) { // S_QUANTMECH
        // C ref: makemon.c m_initinv().  The class switch evaluates the rare
        // Schrödinger-box probe before its PM_QUANTUM_MECHANIC species test,
        // so genetic engineers consume the same rn2(20) even though they can
        // never receive the box.  Keep the success path as a real contained-
        // object transaction so later discovery can observe the same owner.
        if (!rn2(20) && mndx === 210) { // PM_QUANTUM_MECHANIC
            const box = await mksobj(LARGE_BOX, false, false);
            const cat = await mksobj(CORPSE, true, false);
            box.spe = 1;
            cat.corpsenm = 33; // PM_HOUSECAT
            stopObjectTimer(cat, OBJECT_TIMER_KIND.ROT_CORPSE);
            cat.otrapped = false;
            box.contents = [cat];
            await addCreatedObjectToMonsterInventory(pendingMonster, box, game);
            hasMonsterInventory = true;
        }
    }

    if (allowMonsterInventory && mndx === 298 && !rn2(4))
        await mongets(SPEAR); // PM_ICE_DEVIL
    if (allowMonsterInventory && mndx === PM_ASMODEUS) {
        // C makemon.c:m_initinv(), S_DEMON.  Asmodeus has no weapon attack,
        // so his fixed cold/fire wands are inventory declarations rather
        // than m_initweap() gear and precede both common magic reservoirs.
        await mongets(WAN_COLD);
        await mongets(WAN_FIRE);
    }

    // m_initinv() finishes with level-gated defensive and miscellaneous item
    // choices for every monster.
    if (allowMonsterInventory && !skipCommonMonsterInventory) {
        const defensiveRoll = rn2(50);
        if (baseLevel > defensiveRoll) {
            const defensiveItem = randomDefensiveMonsterItem(pendingMonster);
            if (defensiveItem) await mongets(defensiveItem);
        }
        const miscellaneousRoll = rn2(100);
        if (baseLevel > miscellaneousRoll) {
            const miscellaneousItem = randomMiscMonsterItem(pendingMonster);
            if (miscellaneousItem) await mongets(miscellaneousItem);
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
            await mkmonmoney(amount);
        }
    }
    const classIndex = MONSTER_SYMBOL[mndx] || 0;
    // C makemon.c: during level creation, M1_CONCEAL actors hide under an
    // object already present on their square and eel-class actors hide in
    // pools.  Concealment is producer state: display may reveal it through
    // telepathy, but must not infer the state from species at paint time.
    const birthTerrain = level.at(x, y)?.typ;
    const monsterUndetected = !!(game.in_mklev
        && ((((MONSTER_FLAGS1[mndx] ?? 0) & 0x00000080)
                && canMonsterHideUnderFloorObject(x, y))
            || (classIndex === 57
                && birthTerrain !== undefined && IS_POOL(birthTerrain)))); // M1_CONCEAL/S_EEL
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
    // makemon.c: a bribe-demanding demon prince is born peaceful and
    // permanently invisible unless the hero wields Excalibur or Demonbane;
    // a raven is peaceful toward a hero wielding a bec de corbin.
    const bribingPrince = (genderFlags & M2_DEMON) !== 0 && (genderFlags & M2_PRINCE) !== 0
        && MONSTER_SOUND[mndx] === MS_BRIBE;
    const wieldedArtifact = game.uwep?.oartifact;
    const baneWielded = wieldedArtifact !== undefined
        && (wieldedArtifact === artifactByName('Excalibur')?.id || wieldedArtifact === artifactByName('Demonbane')?.id);
    const birthPeaceful = bribingPrince ? !baneWielded
        : mndx === PM_RAVEN && game.uwep?.otyp === BEC_DE_CORBIN ? true : peaceful;
    const birthInvisible = monsterInvisible || bribingPrince;
    const monster: MonsterBirthState = {
        m_id: monsterId,
        mnum: mndx, cham: pendingMonster.cham ?? -1,
        mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: baseLevel, female: monsterFemale,
        msleeping: monsterSleeping,
        mpeaceful: clericMinion?.mpeaceful ?? (birthPeaceful ? 1 : 0),
        mcanmove: 1, mcansee: 1,
        mgenmklev: !!game.in_mklev,
        seen_resistance: 0,
        mux: pendingMonster.mux, muy: pendingMonster.muy,
        mundetected: monsterUndetected,
        minvis: birthInvisible,
        perminvis: birthInvisible,
        movement: 0, mmove: MONSTER_MOVE[mndx] ?? 0,
        permspeed: hellishNativeBat ? 2 : 0,
        mspeed: hellishNativeBat ? 2 : 0,
        symbol: monsterClassSymbol(mndx),
        color: requireMonsterData(MONSTER_COLOR, mndx),
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
    if (mndx === PM_LONG_WORM) {
        if (pendingMonster.wormno !== undefined)
            monster.wormno = pendingMonster.wormno;
        if (pendingMonster.wormSegments !== undefined)
            monster.wormSegments = pendingMonster.wormSegments;
        if (pendingMonster.wormHead !== undefined)
            monster.wormHead = pendingMonster.wormHead;
        if (pendingMonster.wormGrowTime !== undefined)
            monster.wormGrowTime = pendingMonster.wormGrowTime;
    }
    if (Number.isInteger(pendingMonster.cham))
        monster.cham = pendingMonster.cham;
    if (mndx === PM_WIZARD_OF_YENDOR) {
        monster.iswiz = true;
        game.context.no_of_wizards =
            (game.context.no_of_wizards || 0) + 1;
    }
    restoreMonsterInventoryOwnership(monster);
    await initializeMonsterArmor(monster);
    if (allowMonsterInventory) {
        await maybeGiveDomesticSaddle(monster);
        monster.hasInventory = monsterInventory.length > 0;
    }
    if (isMimic) {
        monster.m_ap_type = pendingMonster.m_ap_type ?? M_AP_NOTHING;
        monster.mappearance = pendingMonster.mappearance ?? 0;
        if (pendingMonster.mcorpsenm != null)
            monster.mcorpsenm = pendingMonster.mcorpsenm;
    }
    if (In_sokoban(game.u.uz) && !(requireMonsterData(MONSTER_FLAGS1, mndx) & M1_MINDLESS)) {
        // Branch knowledge survives puzzle completion.
        monster.mtrapseen = (1 << (PIT - 1)) | (1 << (HOLE - 1));
    }
    if (mndx === PM_SHOPKEEPER) {
        monster.mpeaceful = 1;
    }
    if (generatedGhostName != null) setMonsterGivenName(monster, generatedGhostName);
    registerQuestLeader(monster);
    level.monsters[monsterIndex] = monster;
    return finishMonsterBirth(monster, mmflags);
}

// Direct-coordinate creation for source callers which deliberately bypass
// enexto(), such as savebones() creating the dead hero's ghost on u.ux/u.uy.
export async function makemonAt(
    mnum: number | null, x: number, y: number, flags = 0,
): Promise<MonsterBirthState | null> {
    return makemon(mnum, x, y, flags);
}

// C teleport.c:collect_coords().  Each square ring is completely collected
// and shuffled before the next ring begins.  A zero maximum means the whole
// usable map, excluding the center and unused column zero.
function collectShuffledMonsterCoordinates(centerX: number, centerY: number, maxRadius = 0): Position[] {
    const candidates: Position[] = [];
    const rowRange = centerY < ROWNO / 2
        ? ROWNO - 1 - centerY : centerY;
    const columnRange = centerX < COLNO / 2
        ? COLNO - 1 - centerX : centerX;
    const finalRadius = maxRadius
        ? Math.min(maxRadius, Math.max(rowRange, columnRange))
        : Math.max(rowRange, columnRange);
    for (let radius = 1; radius <= finalRadius; radius++) {
        const ring: Position[] = [];
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
            if (pick) {
                const current = ring[i], chosen = ring[i + pick];
                if (!current || !chosen)
                    throw new RangeError('monster placement shuffle exceeded its coordinate ring');
                ring[i] = chosen;
                ring[i + pick] = current;
            }
        }
        candidates.push(...ring);
    }
    return candidates;
}

function findMonsterNearPositionCore(
    mnum: number | null, centerX: number, centerY: number, checkScary: boolean,
    ignoreWater: boolean, state: GameState,
): Position | null {
    const species = mnum ?? state.u.umonster;
    if (species === undefined) throw new Error('monster placement requires a species or initialized hero body');
    const subject = { kind: 'species' as const, mnum: species };
    const gpflags = (checkScary ? GP_CHECKSCARY : 0) | (ignoreWater ? MM_IGNOREWATER : 0);
    const nearby = collectShuffledMonsterCoordinates(centerX, centerY, 3);
    for (const pos of nearby) {
        if (goodPosition(pos.x, pos.y, subject, { state, gpflags }))
            return pos;
    }

    // NEW_ENEXTO deliberately reshuffles the near rings while collecting the
    // complete map, then skips their count because they were already tested.
    const all = collectShuffledMonsterCoordinates(centerX, centerY, 0);
    for (const pos of all.slice(nearby.length)) {
        if (goodPosition(pos.x, pos.y, subject, { state, gpflags }))
            return pos;
    }
    return null;
}

// C teleport.c:enexto().  The first complete search avoids scary squares;
// only total failure triggers an independently shuffled unrestricted search.
// Exposing selection separately lets callbacks distinguish enexto failure
// from a later makemon()/make_familiar() construction failure.
export function findMonsterNearPosition(
    mnum: number | null, centerX: number, centerY: number,
    { ignoreWater = false, state = game }: { ignoreWater?: boolean; state?: GameState } = {},
): Position | null {
    return findMonsterNearPositionCore(
        mnum, centerX, centerY, true, ignoreWater, state,
    ) || findMonsterNearPositionCore(
        mnum, centerX, centerY, false, ignoreWater, state,
    );
}

// C refs: mhitu.c:cloneu(), potion.c:split_mon(), dog.c:initedog().
// The actor is a fresh makemon birth rather than a copy of youmonst: it owns
// ordinary placement, HP, gender, attitude, and identity RNG before cloneu()
// replaces its level/HP and initializes a named tame companion.  split_mon()
// then halves maximum form HP separately, leaving odd points with the hero.
export async function splitHeroMonsterForm(state: GameState = game): Promise<Monster | null> {
    if (state !== game)
        throw new Error('hero clone owner requires live game state');
    const u = state.u;
    if (typeof u.mh !== 'number' || typeof u.mhmax !== 'number') return null;
    if (Number.isFinite(u.mh) && Number.isFinite(u.mhmax)
        && u.mh > u.mhmax) u.mh = u.mhmax;
    const mnum = u.umonnum;
    if (typeof mnum !== 'number' || !Number.isInteger(mnum)) return null;
    const vitalFlags = state.mvitals?.[mnum]?.mvflags ?? 0;
    if (!Number.isFinite(u.mh)
        || !Number.isFinite(u.mhmax) || u.mh <= 1
        || (vitalFlags & (G_EXTINCT | G_GENOD))) return null;

    const clone = await makemonNear(
        mnum, u.ux, u.uy, NO_MINVENT | MM_EDOG | MM_NOMSG, true,
    );
    if (!clone) return null;

    const name = state.plname || 'player';
    const edog: PetData = {
        parentmid: clone.m_id,
        droptime: 0,
        dropdist: 10000,
        apport: u.acurr?.a?.[A_CHA] ?? 3,
        whistletime: 0,
        hungrytime: (state.moves ?? 0) + 1000,
        ogoal: { x: -1, y: -1 },
        abuse: 0,
        revivals: 0,
        mhpmax_penalty: 0,
        killed_by_u: 0,
    };
    clone.mcloned = 1;
    setMonsterGivenName(clone, name);
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
    clone.mextra ??= {};
    clone.mextra.edog = edog;
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
    mnum: number | null, centerX: number, centerY: number, flags = 0,
    requestedByHero = centerX === game.u?.ux && centerY === game.u?.uy,
): Promise<MonsterBirthState | null> {
    const pos = findMonsterNearPosition(mnum, centerX, centerY, {
        ignoreWater: !!(flags & MM_IGNOREWATER),
    });
    if (!pos) return null;
    // teleport.c:enexto_core() tests every shuffled coordinate through
    // goodpos() for the requested species before makemon() owns construction.
    return makemon(mnum, pos.x, pos.y, flags, requestedByHero);
}

// C makemon.c:create_critters().  Wands, scrolls, and spells all create
// monsters through the ordinary constructor.  The return value says whether
// the hero saw or sensed at least one result.
export async function createCritters(count: number, mnum: number | null = null): Promise<boolean> {
    let known = false;
    while (count-- > 0) {
        if (mnum == null && game.level?.flags?.rndmongen === false) continue;
        let monster = null;
        if (mnum == null && game.u?.uinwater) {
            const wetPosition = findMonsterNearPosition(
                PM_GIANT_EEL, game.u.ux, game.u.uy,
            );
            if (wetPosition) {
                monster = await makemon(
                    null, wetPosition.x, wetPosition.y, 0, true,
                );
            } else {
                monster = await makemonNear(
                    null, game.u.ux, game.u.uy, 0, true,
                );
            }
        } else {
            monster = await makemonNear(
                mnum, game.u.ux, game.u.uy, 0, true,
            );
        }
        if (!monster) continue;

        newsym(monster.mx, monster.my);
        const appearance = M_AP_TYPE(monster);
        const visible = canSeeMonster(monster);
        const seenInOwnForm = visible
            && (appearance === M_AP_NOTHING || appearance === M_AP_MONSTER);
        if (seenInOwnForm || canSenseMonster(monster)) known = true;
    }
    return known;
}

// C refs: wizard.c:nasty()/pick_nasty() and mcastu.c:mcast_summon_mons().
// A monster-cast summon deliberately chooses an explicit high-difficulty
// species, asks enexto() for a square around the caster's apparent hero
// position, then runs the ordinary makemon() constructor.  The created
// actors are returned so the caller can repaint them at the same runtime
// boundary where C's makemon() calls newsym().
export async function summonNastyMonsters(
    summoner: Monster | null, { onCreate = null }: {
        onCreate?: ((monster: Monster) => unknown) | null;
    } = {},
): Promise<{ count: number; created: Monster[]; deferredDemonSummon?: boolean }> {
    const created: Monster[] = [];
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

    const summonerClass = summoner ? MONSTER_SYMBOL[summoner.mnum] ?? 0 : 0;
    let difficultyCap = summoner ? MONSTER_DIFFICULTY[summoner.mnum] ?? 0 : 0;
    const casterAlignment = Math.sign(
        summoner ? MONSTER_ALIGNMENT[summoner.mnum] ?? 0 : 0,
    );
    const outerLimit = (game.u?.ulevel ?? 1) > 3
        ? Math.trunc((game.u?.ulevel ?? 1) / 3) : 1;
    const outerCount = rnd(outerLimit);
    const archLich = MONSTER_NAME.indexOf('arch-lich');
    const archon = MONSTER_NAME.indexOf('Archon');
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

export async function maketrap(x: number, y: number, typ: number): Promise<Trap | null> {
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
    const level = game.level;
    if (!level.traps) level.traps = [];
    const oldTrap = level.traps.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    // C reinitializes a destroyable trap in place.  This matters when a Lua
    // random trap lands on a fixed one: t_at() must expose the replacement,
    // not an older duplicate.  Portals and the vibrating square are the two
    // undestroyable floor traps and reject replacement.
    if (oldTrap
        && (oldTrap.ttyp === MAGIC_PORTAL
            || oldTrap.ttyp === VIBRATING_SQUARE)) return null;
    if (!oldTrap) {
        const terrain = level.at(x, y)?.typ;
        // trap.c:maketrap() rejects terrain before allocating a trap.  In
        // particular, Wiz-strt's random trap can land in a cloud: the Lua
        // location owner accepts that dry square, but maketrap() rejects
        // IS_AIR and its caller must not run the later victim-chance draw.
        if (terrain === STAIRS || terrain === LADDER
            || isPoolAt(x, y) || isLavaAt(x, y)
            || (terrain !== undefined && IS_FURNITURE(terrain)
                && typ !== PIT && typ !== HOLE)
            || (terrain === DRAWBRIDGE_UP && typ === MAGIC_PORTAL)
            || (terrain !== undefined && IS_AIR(terrain) && typ !== MAGIC_PORTAL)) {
            return null;
        }
    }
    if (oldTrap && game.u.utrap && game.u.ux === x && game.u.uy === y) {
        const trappedIn = game.u.utraptype;
        if ((trappedIn === TT_BEARTRAP && typ !== BEAR_TRAP)
            || (trappedIn === TT_WEB && typ !== WEB)
            || (trappedIn === TT_PIT && !is_pit(typ))
            || (trappedIn === TT_LAVA && !isLavaAt(x, y))) {
            await resetHeroTrap(false);
        }
    }
    const initializedTrap: Trap = {
        // trap.c:maketrap() initializes the one unhideable floor trap as
        // already seen; ordinary trap doors remain concealed.
        ttyp: typ, tx: x, ty: y, tseen: typ === HOLE, once: false,
        launch: { x: 0, y: 0 },
    };
    const trap = oldTrap || initializedTrap;
    if (oldTrap) {
        trap.ttyp = initializedTrap.ttyp;
        trap.tseen = initializedTrap.tseen;
        trap.once = initializedTrap.once;
        trap.launch = initializedTrap.launch;
        delete trap.launch2;
        delete trap.dst;
        delete trap.teledest;
        delete trap.conjoined;
        delete trap.tnote;
        delete trap.madeby_u;
    }
    if (is_pit(typ)) trap.conjoined = 0;
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
    if (!oldTrap) level.traps.push(trap);
    if (is_pit(typ) || is_hole(typ)) {
        await preparePitOrHoleTerrain(x, y, typ);
    } else if (typ === STATUE_TRAP) {
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
        const statue = await createCorpstatAt(STATUE, null, statueMonster, x, y, 0);
        const temporary = await makemon(
            statue.corpsenm ?? null, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG,
        );
        if (temporary) {
            await putGeneratedMonsterInventoryInStatue(temporary, statue);
            level.monsters = level.monsters.filter(
                monster => monster !== temporary,
            );
        }
    } else if (typ === SQKY_BOARD) {
        const used = new Set(level.traps
            .filter(candidate => candidate !== trap && candidate.ttyp === SQKY_BOARD)
            .map(candidate => candidate.tnote));
        const available = [];
        for (let note = 0; note < 12; note++)
            if (!used.has(note)) available.push(note);
        const selectedNote = available.length
            ? available[rn2(available.length)] : rn2(12);
        if (selectedNote === undefined) throw new Error('Squeaky board selected a missing note');
        trap.tnote = selectedNote;
    } else if (typ === ROLLING_BOULDER_TRAP
        && level.flags.sokoban_rules) {
        // Sokoban has no rolling-boulder launchers. The trap stays in place
        // without creating another boulder.
        trap.launch = { x, y };
        trap.launch2 = { x, y };
    } else if (typ === ROLLING_BOULDER_TRAP) {
        // C ref: trap.c find_random_launch_coord()/mkroll_launch().  A
        // rolling-boulder trap chooses one distance and starting direction,
        // then searches all eight directions at decreasing distances until
        // both sides of the trigger have a clear path and the launch square
        // is neither pool nor lava.
        let distance = rn1(5, 4);
        let direction = rn2(8);
        let tries = 0;
        // isclearpath(): any ZAP_POS terrain (pools and lava included) except
        // a closed or locked door, with no pit, hole, or teleport trap.
        const clearPath = (dx: number, dy: number, length: number): boolean => {
            for (let step = 1; step <= length; step++) {
                const px = x + step * dx, py = y + step * dy;
                const loc = isok(px, py) ? level.at(px, py) : undefined;
                if (!loc || !ZAP_POS(loc.typ)
                    || (IS_DOOR(loc.typ) && (loc.doormask & (D_LOCKED | D_CLOSED)) !== 0)) return false;
                const blockingTrap = level.traps.some(candidate =>
                    candidate !== trap && candidate.tx === px
                    && candidate.ty === py
                    && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)
                        || (candidate.ttyp >= TELEP_TRAP && candidate.ttyp <= MAGIC_PORTAL)));
                if (blockingTrap) return false;
            }
            return true;
        };
        let launch = null;
        while (distance >= 2) {
            const dx = xdir[direction], dy = ydir[direction];
            if (dx === undefined || dy === undefined)
                throw new Error(`Rolling boulder trap has invalid direction ${direction}`);
            const lx = x + distance * dx, ly = y + distance * dy;
            const landsInLiquid = isPoolAt(lx, ly) || isLavaAt(lx, ly);
            if (!landsInLiquid && clearPath(dx, dy, distance)
                && clearPath(-dx, -dy, distance)) {
                launch = { x: lx, y: ly };
                break;
            }
            direction = (direction + 1) % 8;
            if (++tries % 8 === 0) distance--;
        }
        if (launch) {
            const boulder = await mksobj(BOULDER, true, false);
            placeCreatedObject(boulder, launch.x, launch.y);
            trap.launch = launch;
            trap.launch2 = {
                x: x - (launch.x - x), y: y - (launch.y - y),
            };
        } else {
            trap.launch = { x, y };
            trap.launch2 = { x, y };
        }
    }
    if (oldTrap) finishSokobanIfSolved();
    return trap;
}

// C trap.c:maketrap() owns these effects even when the caller is Lua or
// wizard trap creation rather than digging. Preserve the old shop terrain
// for repair before opening the floor and exposing buried objects.
async function preparePitOrHoleTerrain(x: number, y: number, trapType: number): Promise<void> {
    const level = requireGameLevel();
    const location = level.requireAt(x, y);
    const oldType = location.typ;
    const wasIce = isIceAt(x, y);
    const wallOrDoor = IS_DOOR(oldType) || IS_WALL(oldType);
    if (roomsAt(game.level, x, y, SHOPBASE).length
        && (is_hole(trapType) || wallOrDoor)) {
        addShopDamage(x, y,
            wallOrDoor && !game.context.mon_moving ? SHOP_HOLE_COST : 0);
    }

    if (oldType === DRAWBRIDGE_UP) {
        location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER) | DB_FLOOR;
        location.flags = location.drawbridgemask;
    } else {
        if (IS_ROOM(oldType)) setLevelTerrainType(x, y, ROOM);
        else if (oldType === STONE || oldType === SCORR)
            setLevelTerrainType(x, y, CORR);
        else if (IS_WALL(oldType) || oldType === SDOOR)
            setLevelTerrainType(x, y, level.flags.is_maze_lev ? ROOM
                : level.flags.is_cavernous_lev ? CORR : DOOR);

        // These separate JS fields mirror the same native rm.flags union.
        location.flags = 0;
        location.doormask = 0;
        location.wall_info = 0;
        location.altarmask = 0;
        location.ladder = 0;
        location.drawbridgemask = 0;
        location.looted = 0;
        location.icedpool = 0;
        location.emptygrave = 0;
    }
    if (wasIce && !isIceAt(x, y)) {
        updateIceObjectTimersAt(x, y, game, { includeBuried: true });
        stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    }
    if (oldType !== location.typ && (oldType === FOUNTAIN || oldType === SINK))
        countLevelFeatures();

    await unearthFloorObjectsAt(x, y);
    vision_note_blocker_change(x, y);
}

// revive_corpse() reaches fill_pit() only after its visible or audible
// presentation has completed.
interface BuriedZombieEvent {
    kind?: string;
    monster?: Monster | null;
    finished?: boolean;
    pitFilled?: boolean;
    filledByBoulder?: GameObject | null;
    buriedFloorObjects?: GameObject[];
}

export async function finishBuriedZombieTimer<Event extends BuriedZombieEvent | null | undefined>(
    event: Event, state: GameState = game,
): Promise<Event> {
    if (!event || event.kind !== 'revived' || event.finished) return event;
    if (!event.monster) throw new Error('A revived corpse has no monster');
    const x = event.monster.mx, y = event.monster.my;
    const result = await fillPitWithBoulderAt(x, y, state);
    event.finished = true;
    event.pitFilled = result.filled;
    event.filledByBoulder = result.filled ? result.boulder : null;
    event.buriedFloorObjects = result.buriedFloorObjects;
    return event;
}

// C trap.c:delfloortrap().  Destroys a trap which emanates from the floor,
// freeing a hero or monster caught in it.  Portal-like and special traps are
// not floor traps and are rejected.
export async function deleteFloorTrap(trap: Trap | null | undefined, state: GameState = game): Promise<boolean> {
    if (!trap) return false;
    const ttyp = trap.ttyp;
    const removable = ttyp === SQKY_BOARD || ttyp === BEAR_TRAP
        || ttyp === LANDMINE || ttyp === FIRE_TRAP || is_pit(ttyp)
        || is_hole(ttyp) || ttyp === TELEP_TRAP || ttyp === LEVEL_TELEP
        || ttyp === WEB || ttyp === MAGIC_TRAP || ttyp === ANTI_MAGIC;
    if (!removable) return false;

    if (state.u?.ux === trap.tx && state.u?.uy === trap.ty) {
        // C reset_utrap(TRUE): a freed hero may resume floating.
        if (state.u.utraptype !== TT_BURIEDBALL) {
            await resetHeroTrap(true, state);
        }
    } else {
        const monster = (state.level?.monsters || []).find(candidate => monsterHasMapPosition(candidate, state) &&
            !candidate.dead && monsterOccupiesPosition(candidate, trap.tx, trap.ty));
        if (monster) monster.mtrapped = 0;
    }
    deleteTrap(trap, state);
    return true;
}

export async function runClaimedObjectRotTimer(claimed: DueObjectTimer | null | undefined, state: GameState = game): Promise<{
    kind: 'blocked-organic-rot'; object: GameObject;
} | {
    kind: 'rot-organic' | 'rot-corpse'; object: GameObject;
    where: ObjectWhere; x: number; y: number;
} | null> {
    const object = claimed?.object;
    const kind = claimed?.timer?.kind;
    if (!object || (kind !== OBJECT_TIMER_KIND.ROT_CORPSE
        && kind !== OBJECT_TIMER_KIND.ROT_ORGANIC)) return null;

    if (kind === OBJECT_TIMER_KIND.ROT_ORGANIC) {
        while (object.contents?.length) {
            const content = object.contents[0];
            if (!content) throw new Error('Rotting container is missing its first object');
            content.ox = object.ox;
            content.oy = object.oy;
            if ((await buryObject(content, state)).outcome === 'skipped') {
                return { kind: 'blocked-organic-rot', object };
            }
        }
    }
    const { where, ox: x, oy: y } = object;
    if (kind === OBJECT_TIMER_KIND.ROT_CORPSE) await rotCorpse(object, state);
    else await deleteObject(object, state);
    return { kind, object, where, x, y };
}

function make_engr_at(
    x: number, y: number, text: string, pristine: string | null,
    epoch: number, engr_type: number,
    options: { nowipeout?: boolean; guardobjects?: boolean } | undefined = undefined,
) {
    return makeEngravingAt(
        x, y, text, pristine, epoch, engr_type, options,
    );
}

export function make_grave(x: number, y: number, text: string | null): void {
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
function getRandomTextLine(lines: readonly string[]): string {
    if (!lines.length) throw new Error('Random text needs at least one source line');
    const sizes = lines.map(line => Math.max(line.length, 59) + 1);
    const fileSize = sizes.reduce((sum, size) => sum + size, 0);
    let picked = 0;
    for (let tries = 10; tries > 0; tries--) {
        let offset = rn2(fileSize);
        picked = 0;
        let size = sizes[picked];
        if (size === undefined) throw new Error('Random text is missing its first line size');
        while (offset >= size) {
            offset -= size;
            size = sizes[++picked];
            if (size === undefined) throw new Error('Random text offset exceeds its source text');
        }
        const remainder = size - offset;
        if (remainder <= 61) break;
    }
    const line = lines[(picked + 1) % lines.length];
    if (line === undefined) throw new Error('Random text selection is missing its source line');
    return line;
}

export function getRumor(excludeCookie: boolean, truth = 0): string {
    let rumor = '';
    let count = 0;
    let trueRumor = false;
    do {
        trueRumor = truth + rn2(2) > 0;
        rumor = getRandomTextLine(trueRumor
            ? TRUE_RUMORS : FALSE_RUMORS);
    } while (count++ < 50 && excludeCookie && rumor.startsWith('[cookie] '));
    if (count < 50 && !game.in_mklev) exerciseWisdom(trueRumor);
    if (!excludeCookie && rumor.startsWith('[cookie] '))
        rumor = rumor.slice('[cookie] '.length);
    return rumor;
}

// C ref: engrave.c random_engraving().
export function randomEngraving(): { pristine: string; text: string } {
    let pristine;
    if (!rn2(4)) pristine = getRandomTextLine(RANDOM_ENGRAVINGS);
    else pristine = getRumor(true) || getRandomTextLine(RANDOM_ENGRAVINGS);
    return {
        pristine,
        text: wipeoutText(pristine, Math.trunc(pristine.length / 4)),
    };
}

const BONES_VERSION = 10;

function bonesStorageKey(level: DungeonLocation | undefined = game.u.uz): string {
    return `teleport-bones:${level?.dnum ?? 0}:${level?.dlevel ?? 1}`;
}

export function bonesLevelExists(level: DungeonLocation | undefined = game.u.uz): boolean {
    return game.storage?.getItem(bonesStorageKey(level)) != null;
}

async function bonesPrompt(message: string, displayLevel: GameMap | null = null): Promise<string> {
    await pline(message);
    const restoredLevel = game.level;
    if (displayLevel) game.level = displayLevel;
    await flush_screen(1);
    if (displayLevel) game.level = restoredLevel;
    game.nhDisplay?.setCursor(message.length, 0);
    return String.fromCharCode(await nhgetch()).toLowerCase();
}

function eachTopLevelBonesObject(level: GameMap, visit: (object: GameObject) => void): void {
    for (const monster of level?.monsters || []) {
        for (const object of monster.minvent || monster.inventory || [])
            visit(object);
    }
    for (const column of level?.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || []) visit(object);
        }
    }
    for (const object of level?.buriedObjects || []) visit(object);
}

function eachObjectInBonesGraph(level: GameMap, visit: (object: GameObject) => void): void {
    const walk = (object: GameObject): void => {
        if (!object) return;
        visit(object);
        for (const content of object.contents || []) walk(content);
    };
    eachTopLevelBonesObject(level, walk);
}

function resetBonesObjectList(objects: GameObject[] | null | undefined, ghostly: boolean): GameObject[] {
    const kept: GameObject[] = [];
    for (const object of objects || []) {
        object.contents = resetBonesObjectList(object.contents, false);
        for (const content of object.contents)
            content.container = object;
        if (object.in_use) continue;
        if (ghostly) object.ghostly = true;
        kept.push(prepareBonesObjectForSave(object));
    }
    return kept;
}

function resetBonesObjectsForSave(level: GameMap): void {
    for (const monster of level?.monsters || []) {
        const inventory = resetBonesObjectList(
            monster.minvent || monster.inventory, true,
        );
        monster.minvent = monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
    }
    for (let x = 0; x < (level?.objects?.length || 0); x++) {
        const column = level.objects[x];
        if (!column) continue;
        for (let y = 0; y < column.length; y++)
            column[y] = resetBonesObjectList(column[y], true);
    }
    level.buriedObjects = resetBonesObjectList(level?.buriedObjects, true);
}

// C refs: bones.c savebones()/resetobjs(FALSE). The persistent payload owns
// the level graph only. The saved-graph codec retains entity aliases and
// container back-pointers; getbones() restores the GameMap prototype.
export function saveBonesLevel(): boolean {
    const storage = game.storage;
    if (!storage || !game.level) return false;

    let payload: BonesPayload;
    try {
        payload = decodeBonesPayload(encodeSavedGraph({
            version: BONES_VERSION,
            level: game.level,
            stairs: game.stairs || null,
            heroTrack: (game._heroTrack || []).map(point => ({
                x: point.x, y: point.y,
            })),
            fruits: [],
        }), BONES_VERSION);
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
        trap.tseen = trap.ttyp === HOLE;
    }
    resetBonesObjectsForSave(payload.level);
    const fruitIds = new Set();
    eachObjectInBonesGraph(payload.level, object => {
        if (object.otyp === SLIME_MOLD) fruitIds.add(object.spe);
    });
    payload.fruits = (game.fruits || []).filter(fruit => fruitIds.has(fruit.fid))
        .map(fruit => ({ ...fruit }));

    // savebones() removes the dead hero and all of their remembered glyphs
    // before savelev(). Terrain lighting itself remains part of the level.
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = payload.level.locations?.[x]?.[y];
            if (!location) continue;
            location.seenv = 0;
            location.waslit = false;
            location.lastseentyp = STONE;
            location.disp_ch = ' ';
            location.disp_color = 0;
            location.disp_decgfx = false;
            location.disp_attr = 0;
            location.glyph_symidx = -1;
            delete location.disp_glyph;
            delete location.remembered_glyph;
        }
    }

    try {
        storage.setItem(bonesStorageKey(), encodeSavedGraph(payload));
        return true;
    } catch (_error) {
        return false;
    }
}

function remappedMonsterId(oldId: number | undefined, monsterIds: ReadonlyMap<number, number>): number | undefined {
    return oldId !== undefined && Number.isInteger(oldId) ? monsterIds.get(oldId) : undefined;
}

function repairContainedObjects(container: GameObject): void {
    for (const object of container.contents || []) {
        object.container = container;
        object.where = 'contained';
        delete object.carrierMid;
        repairContainedObjects(object);
    }
}

function repairObjectMonsterIds(object: GameObject, monsterIds: ReadonlyMap<number, number>): void {
    const extra = object.oextra;
    const omid = extra?.omid;
    if (omid && extra) {
        const newId = remappedMonsterId(omid, monsterIds);
        if (newId) extra.omid = newId;
        else delete extra.omid;
    }
    if (object.omid) {
        const newId = remappedMonsterId(object.omid, monsterIds);
        if (newId) object.omid = newId;
        else delete object.omid;
    }
    if (object.leashmon) {
        object.leashmon = remappedMonsterId(object.leashmon, monsterIds) || 0;
    }
    if (object.oextra?.omonst) {
        object.oextra.omonst.m_id = 0;
        object.oextra.omonst.mpeaceful = 0;
        object.oextra.omonst.mtame = 0;
    }
}

function repairMonsterExtensions(monster: Monster): void {
    const edog = monster.edog || monster.mextra?.edog;
    if (edog) {
        edog.parentmid = monster.m_id;
        monster.edog = edog;
        monster.mextra = { ...(monster.mextra || {}), edog };
    }
    const shopkeeper = monster.eshk || monster.mextra?.eshk;
    if (shopkeeper) {
        shopkeeper.parentmid = monster.m_id;
        monster.eshk = shopkeeper;
        if (monster.mextra?.eshk) monster.mextra.eshk = shopkeeper;
    }
    const priest = monster.epri || monster.mextra?.epri;
    if (priest) {
        priest.parentmid = monster.m_id;
        monster.epri = priest;
        if (monster.mextra?.epri) monster.mextra.epri = priest;
    }
    const minion = monster.emin || monster.mextra?.emin;
    if (minion) {
        minion.parentmid = monster.m_id;
        monster.emin = minion;
        if (monster.mextra?.emin) monster.mextra.emin = minion;
    }
    if (monster.mextra?.ebones) monster.mextra.ebones.parentmid = monster.m_id;
}

async function renewBonesIdentities(level: GameMap, fruits: readonly Fruit[]): Promise<void> {
    // restmonchn() assigns every monster a fresh id; each monster inventory
    // is restored immediately afterward. getlev() then restores floor and
    // buried object chains. All three paths share next_ident().
    const monsterIds = new Map<number, number>();
    const renewObject = async (object: GameObject): Promise<void> => {
        if (!object) return;
        object.o_id = nextIdent();
        if (object.otyp === SLIME_MOLD) {
            const oldFruit = fruits.find(fruit => fruit.fid === object.spe);
            if (oldFruit) object.spe = addFruit(oldFruit.fname);
            else await impossible('no old fruit?');
        }
        for (const content of object.contents || []) await renewObject(content);
    };
    for (const monster of level?.monsters || []) {
        const oldId = monster.m_id;
        monster.m_id = nextIdent();
        if (Number.isInteger(oldId) && oldId > 0)
            monsterIds.set(oldId, monster.m_id);
        for (const object of monster.minvent || monster.inventory || [])
            await renewObject(object);
    }
    for (const column of level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || []) await renewObject(object);
    for (const object of level?.buriedObjects || []) await renewObject(object);

    for (const monster of level?.monsters || []) {
        repairMonsterExtensions(monster);
        const inventory = monster.minvent || monster.inventory || [];
        monster.minvent = inventory;
        monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
        for (const object of inventory) {
            object.where = 'minvent';
        }
        restoreMonsterInventoryOwnership(monster);
    }
    eachObjectInBonesGraph(level, object =>
        repairObjectMonsterIds(object, monsterIds));
    eachTopLevelBonesObject(level, repairContainedObjects);
}

function restoreBonesObjects(level: GameMap): void {
    eachObjectInBonesGraph(level, object =>
        prepareBonesObjectForRestore(object, game));
}

function restoreBonesMonsterAttitudes(level: GameMap): void {
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
async function getbones(): Promise<boolean> {
    const flags = game.flags || {};
    if (flags.explore) return false;
    if (flags.bones === false) return false;
    if (rn2(3) && !game.flags?.debug) return false;

    const encoded = game.storage?.getItem(bonesStorageKey());
    if (!encoded) return false;
    // keepdogs() has already detached a migrating companion from the source
    // monster chain. Clear its glyph before the wizard query, while retaining
    // the rest of the already-painted source tty map.
    if (game.startingPet
        && !game.level?.monsters?.includes(game.startingPet)) {
        const petLocation = game.level?.at?.(
            game.startingPet.mx, game.startingPet.my,
        );
        if (petLocation?.remembered_glyph?.kind === 'monster') {
            delete petLocation.remembered_glyph;
        }
        newsym(game.startingPet.mx, game.startingPet.my);
    }
    if (game.flags?.debug
        && await bonesPrompt('Get bones? [yn] (n) ') !== 'y') return false;

    let payload: BonesPayload;
    try {
        payload = decodeBonesPayload(encoded, BONES_VERSION);
    } catch (_error) {
        return false;
    }
    if (!validMonsterWormBodies(payload.level)) return false;

    restoreMonsterWormHeads(payload.level);
    const sourceDisplayLevel = game.level;
    game.level = payload.level;
    game.stairs = payload.stairs || null;
    game._heroTrack = (payload.heroTrack || []).map(point => ({
        x: point.x, y: point.y,
    }));
    await renewBonesIdentities(game.level, payload.fruits);
    await restoreBonesMonsters(game.level, game);
    restoreBonesObjects(game.level);
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
export async function l_nhcore_init(): Promise<void> {
    await currentLuaLifecycle().startCore(game);
}

// C ref: mklev.c mklev()
export async function mklev(): Promise<void> {
    const g = game;
    if (await getbones()) return;
    g.in_mklev = true;
    await makelevel();
    await currentLuaLifecycle().runCallbacks(g, 'level_enter');
    countLevelFeatures();
    await level_finalize_topology();
    g.in_mklev = false;
}

export function countLevelFeatures(state: GameState = game): void {
    const lvl = state.level;
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

async function fillVault(room: Room | null | undefined): Promise<void> {
    if (!room) return;
    const amountRange = Math.abs(depth_of_level(game.u?.uz)) * 100;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            await mkgold(51 + rn2(amountRange), x, y);
        }
    }
}

// C ref: mklev.c clear_level_structures()
function clear_level_structures(): void {
    const g = game;
    g.fmon = null;
    g.level = new GameMap();
    g.level.nroom = 0;
    g.level.rooms = [];
    g.level.nsubroom = 0;
    g.level.subrooms = [];
    g.made_branch = false;
    g.smeq = Array.from({ length: MAXNROFROOMS + 1 }, () => 0);
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
    lf.temperature = In_hell(g.u.uz) ? 1 : 0;
    lf.rndmongen = true;
    lf.deathdrops = true;
    lf.noautosearch = false;
    lf.fumaroles = false;
    lf.stormy = false;
    lf.stasis_until = 0;
    init_rect();
}

// C ref: mkmap.c litstate_rnd()
function litstate_rnd(litstate: number | boolean): boolean {
    if (typeof litstate === 'number' && litstate < 0) {
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

function centeredSpecialMap(width: number, height: number): SpecialLevelContext {
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

function halfLeftSpecialMap(width: number, height: number): SpecialLevelContext {
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

function halfRightSpecialMap(width: number, height: number): SpecialLevelContext {
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

function leftBottomSpecialMap(width: number, height: number): SpecialLevelContext {
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

function rightTopSpecialMap(width: number, height: number): SpecialLevelContext {
    // sp_lev.c lspo_map(SPLEV_RIGHT, TOP).
    const mazeMaxX = (COLNO - 1) & ~1;
    let xstart = mazeMaxX - width - 1;
    let ystart = 3;
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    return { xstart, ystart, width, height };
}

function rightCenterSpecialMap(width: number, height: number): SpecialLevelContext {
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

async function specialRandomLocation(
    context: SpecialLevelContext,
    acceptable?: (location: MapLocation, x: number, y: number) => boolean,
): Promise<Position | null> {
    const point = await getLocationCoord(context, null, DRY, acceptable);
    return point.x === -1 && point.y === -1 ? null : point;
}

// C ref: mkmaze.c set_levltyp().  Terrain mutation owns persistent tile
// side-effects; in particular, every lava form becomes lit even when the Lua
// terrain operation requested SET_LIT_NOCHANGE.  Callers may subsequently
// replace the terrain again without implicitly clearing that light bit.
function setLevelTerrainType(x: number, y: number, typ: number): boolean {
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

function setLevelTerrainLit(x: number, y: number, typ: number, lit: number | boolean = -2): boolean {
    const level = requireGameLevel();
    if (!setLevelTerrainType(x, y, typ)) return false;
    if (lit !== -2) {
        level.requireAt(x, y).lit = IS_LAVA(typ)
            ? true
            : lit === -1 ? !!rn2(2) : !!lit;
    }
    return true;
}

function specialSelectionTerrain(selection: SpecialSelection, typ: number, lit: number | boolean = -2): void {
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        if (!setLevelTerrainLit(x, y, typ, lit)) return;
        if (typ === IRONBARS || typ === HWALL)
            level.requireAt(x, y).horizontal = true;
    });
}

function specialMazeWalk(
    context: SpecialLevelContext, mapX: number, mapY: number,
    direction: 'north' | 'south' | 'east' | 'west', passageType = ROOM,
): void {
    const level = requireGameLevel();
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

    const opening = level.at(x, y);
    if (opening && !IS_DOOR(opening.typ)) {
        opening.typ = passageType;
        opening.flags = 0;
    }
    if (!(x % 2)) {
        x += direction === 'east' ? 1 : -1;
        const parityOpening = level.at(x, y);
        if (parityOpening) {
            parityOpening.typ = passageType;
            parityOpening.flags = 0;
        }
    }
    if (!(y % 2)) y += direction === 'south' ? 1 : -1;

    carveMazeFrom(
        x, y, passageType,
        (COLNO - 1) & ~1, (ROWNO - 1) & ~1,
    );
}

function specialMazeStockPoint(mappedCells: SpecialSelection): Position {
    const level = requireGameLevel();
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
        if (--tries < 0) break;
        const loc = level.at(point.x, point.y);
        const hasBoulder = level.objects[point.x]?.[point.y]
            ?.some(object => object.otyp === BOULDER);
        if ((point.x % 2) && (point.y % 2) && !mappedCells.has(point.x, point.y)
            && loc && (Is_waterlevel(game.u.uz) || (SPACE_POS(loc.typ) && !hasBoulder))) {
            break;
        }
    } while (true);
    return point;
}

function randomSpecialTrapType(): number {
    const level = requireGameLevel();
    let typ;
    do {
        typ = rnd(TRAPNUM - 1);
        if (typ === HOLE || typ === VIBRATING_SQUARE
            || typ === MAGIC_PORTAL) {
            typ = NO_TRAP;
        } else if (typ === TRAPDOOR && !canDigDown()) {
            typ = NO_TRAP;
        } else if ((typ === LEVEL_TELEP || typ === TELEP_TRAP)
            && level.flags.noteleport) {
            typ = NO_TRAP;
        } else if ((typ === ROLLING_BOULDER_TRAP || typ === ROCKTRAP)
            && In_endgame(game.u?.uz)) {
            typ = NO_TRAP;
        }
    } while (typ === NO_TRAP);
    return typ;
}

async function fillEmptySpecialMaze(mappedCells: SpecialSelection): Promise<void> {
    const level = requireGameLevel();
    // sp_lev.c:fill_empty_maze().  mapcount intentionally begins at the
    // complete rectangle while only mapcountmax is halved; this historical
    // asymmetry increases the stocking budget beyond the uncovered fraction.
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    let mapcount = (mazeXMax - 2) * (mazeYMax - 2);
    const mapcountmax = Math.trunc(mapcount / 2);
    for (let x = 2; x < mazeXMax; x++) {
        for (let y = 0; y < mazeYMax; y++) {
            if (mappedCells.has(x, y)) {
                mapcount--;
            }
        }
    }
    if (mapcount <= Math.trunc(mapcountmax / 10)) return;
    const mapfact = Math.trunc(mapcount * 100 / mapcountmax);

    for (let count = rnd(Math.trunc(20 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await mkobj_at(
            rn2(2) ? GEM_CLASS : RANDOM_CLASS,
            point.x, point.y, true,
        );
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        const trap = level.traps?.find(candidate =>
            candidate.tx === point.x && candidate.ty === point.y);
        if (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) continue;
        await mksobj_at(BOULDER, point.x, point.y, true, false);
    }
    for (let count = rn2(2); count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await makemon(PM_MINOTAUR, point.x, point.y, 0);
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await makemon(null, point.x, point.y, 0);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await mkgold(0, point.x, point.y);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100));
        count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        let typ = randomSpecialTrapType();
        if (level.objects?.[point.x]?.[point.y]
            ?.some(object => object.otyp === BOULDER)) {
            while (is_pit(typ) || is_hole(typ))
                typ = randomSpecialTrapType();
        }
        await maketrap(point.x, point.y, typ);
    }
}

// C ref: sp_lev.c pm_to_humidity().
function specialMonsterHumidity(mndx: number): number {
    const flags = MONSTER_FLAGS1[mndx] ?? 0;
    const symbol = MONSTER_SYMBOL[mndx];
    let humidity = symbol === 57 || (flags & (0x00000002 | 0x00000200))
        ? WET : DRY;
    if ((flags & 0x00000001) || symbol === 5 || symbol === 25)
        humidity |= HOT | WET;
    if ((flags & 0x00000008) || symbol === 54) humidity |= SOLID;
    if (mndx === 30 || mndx === 110
        || mndx === PM_FIRE_ELEMENTAL || mndx === PM_SALAMANDER)
        humidity |= HOT;
    return humidity;
}

async function specialStair(context: SpecialLevelContext, up: boolean): Promise<Position | null> {
    const point = await specialRandomLocation(context,
        loc => loc.typ === ROOM || loc.typ === CORR || loc.typ === ICE);
    if (point) mkstairs(point.x, point.y, up, null);
    return point;
}

function specialNonDiggable(context: SpecialLevelContext | null = null): void {
    const level = requireGameLevel();
    const xstart = context?.xstart ?? 0;
    const ystart = context?.ystart ?? 0;
    const width = context?.width ?? COLNO;
    const height = context?.height ?? ROWNO;
    for (let dx = 0; dx < width; dx++) {
        for (let dy = 0; dy < height; dy++) {
            const loc = level.at(xstart + dx, ystart + dy);
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

function specialSelectionNonDiggable(selection: SpecialSelection): void {
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
            || loc.typ === IRONBARS)) loc.wall_info |= W_NONDIGGABLE;
    });
}

async function specialObject(context: SpecialLevelContext): Promise<GameObject | null> {
    const point = await specialRandomLocation(context);
    if (point) return await mkobj_at(RANDOM_CLASS, point.x, point.y, true);
    return null;
}

async function specialObjectOfClass(context: SpecialLevelContext, objectClass: number): Promise<GameObject | null> {
    const point = await specialRandomLocation(context);
    if (point) return await mkobj_at(objectClass, point.x, point.y, true);
    return null;
}

async function specialCorpseOf(context: SpecialLevelContext, mndx: number): Promise<GameObject | null> {
    const point = await specialRandomLocation(context);
    if (!point) return null;
    const corpse = await mksobj_at(CORPSE, point.x, point.y, true, false);
    set_corpsenm(corpse, mndx);
    return corpse;
}

async function specialObjectOfType(context: SpecialLevelContext, otyp: number): Promise<GameObject | null> {
    const point = await specialRandomLocation(context);
    return point ? await mksobj_at(otyp, point.x, point.y, true, true) : null;
}

async function specialFeatureOfType(context: SpecialLevelContext, typ: number): Promise<Position | null> {
    const level = requireGameLevel();
    const point = await specialRandomLocation(context, loc =>
        SPACE_POS(loc.typ) && !IS_FURNITURE(loc.typ));
    if (!point) return null;
    const loc = level.at(point.x, point.y);
    if (!loc || IS_FURNITURE(loc.typ)) return null;
    loc.typ = typ;
    return point;
}

function specialDoorAt(context: SpecialLevelContext, mask: number, x: number, y: number): Position | null {
    const level = requireGameLevel();
    const doorX = context.xstart + x, doorY = context.ystart + y;
    const loc = level.at(doorX, doorY);
    if (!loc) return null;
    if (!IS_DOOR(loc.typ) && loc.typ !== SDOOR) loc.typ = DOOR;
    const wallOrDoor = (candidate: MapLocation | null): boolean => !!candidate
        && (IS_WALL(candidate.typ) || IS_DOOR(candidate.typ)
            || candidate.typ === SDOOR);
    const wleft = wallOrDoor(level.at(doorX - 1, doorY));
    const wright = wallOrDoor(level.at(doorX + 1, doorY));
    const wup = wallOrDoor(level.at(doorX, doorY - 1));
    const wdown = wallOrDoor(level.at(doorX, doorY + 1));
    loc.horizontal = !!((wleft || wright) && !(wup && wdown));
    loc.doormask = mask;
    return { x: doorX, y: doorY };
}

function specialRandomDoorAt(context: SpecialLevelContext, x: number, y: number): Position | null {
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

function specialIrregularRoom(
    context: SpecialLevelContext, x: number, y: number, rtype: number,
    lit: boolean, needfill: number,
): Room {
    const level = requireGameLevel();
    // sp_lev.c lspo_region() delegates irregular rooms to flood_fill_rm().
    // That scanline flood includes diagonally touching runs of the same
    // terrain, then marks neighboring walls and doors as the room's edge.
    const seedX = context.xstart + x, seedY = context.ystart + y;
    const seedType = level.at(seedX, seedY)?.typ;
    const roomNumber = level.nroom + ROOMOFFSET;
    const equivalence = game.smeq;
    if (!equivalence) throw new Error('Irregular room creation requires room equivalence.');
    equivalence[level.nroom] = level.nroom;
    const pending: Position[] = [{ x: seedX, y: seedY }];
    const visited = new Map<string, Position>();
    let lx = seedX, hx = seedX, ly = seedY, hy = seedY;
    while (pending.length) {
        const point = pending.pop();
        if (!point) break;
        const { x: roomX, y: roomY } = point;
        const key = `${roomX},${roomY}`;
        if (visited.has(key)) continue;
        const loc = level.at(roomX, roomY);
        if (!loc || loc.typ !== seedType) continue;
        visited.set(key, point);
        loc.roomno = roomNumber;
        loc.lit = !!lit;
        lx = Math.min(lx, roomX); hx = Math.max(hx, roomX);
        ly = Math.min(ly, roomY); hy = Math.max(hy, roomY);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx || dy) pending.push({ x: roomX + dx, y: roomY + dy });
            }
        }
    }
    for (const { x: roomX, y: roomY } of visited.values()) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const loc = level.at(roomX + dx, roomY + dy);
                if (!loc || !(IS_WALL(loc.typ) || IS_DOOR(loc.typ)
                    || loc.typ === SDOOR)) continue;
                loc.edge = true;
                if (lit) loc.lit = true;
                loc.roomno = loc.roomno && loc.roomno !== roomNumber
                    ? SHARED : roomNumber;
            }
        }
    }
    // lspo_region() registers the bounds with lighting off: flood_fill_rm()
    // already lit the room's floor and boundary, not the whole rectangle.
    add_room(lx, ly, hx, hy, false, rtype, true);
    const room = level.rooms[level.nroom - 1];
    if (!isRoom(room)) throw new Error('Irregular room creation did not install a room.');
    room.rlit = lit ? 1 : 0;
    room.irregular = true;
    room.needjoining = true;
    room.needfill = needfill;
    for (let doorX = room.lx - 1; doorX <= room.hx + 1; doorX++) {
        for (let doorY = room.ly - 1; doorY <= room.hy + 1; doorY++) {
            const loc = level.at(doorX, doorY);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                add_door(doorX, doorY, room);
        }
    }
    return room;
}

function getSpecialLevelExtents(): { minx: number; miny: number; maxx: number; maxy: number } {
    const map = requireGameLevel();
    const findColumn = (start: number, step: number) => {
        for (let x = start; x >= 0 && x < COLNO; x += step) {
            let nonwall = false, found = false;
            for (let y = 0; y < ROWNO; y++) {
                const typ = map.requireAt(x, y).typ;
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
    const findRow = (start: number, step: number) => {
        for (let y = start; y >= 0 && y < ROWNO; y += step) {
            let nonwall = false, found = false;
            for (let x = minx; x <= maxx; x++) {
                const typ = map.requireAt(x, y).typ;
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

function flipSpecialLevel(flp: number): void {
    if (!(flp & 3)) return;
    const level = requireGameLevel();
    const { minx, miny, maxx, maxy } = getSpecialLevelExtents();
    const inArea = (x: number, y: number): boolean => x >= minx && x <= maxx
        && y >= miny && y <= maxy;
    const flipX = (x: number): number => maxx - x + minx;
    const flipY = (y: number): number => maxy - y + miny;
    const transform = (x: number, y: number, requireArea = true): Position => {
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
            const loc = level.requireAt(x, y);
            if (flp & 1) loc.typ = verticalWallFlip.get(loc.typ) ?? loc.typ;
            if (flp & 2) loc.typ = horizontalWallFlip.get(loc.typ) ?? loc.typ;
        }
    }

    for (let stair = game.stairs; stair; stair = stair.next) {
        const point = transform(stair.sx, stair.sy, false);
        stair.sx = point.x; stair.sy = point.y;
    }
    if (level.upstair) level.upstair = transform(
        level.upstair.x, level.upstair.y, false);
    if (level.dnstair) level.dnstair = transform(
        level.dnstair.x, level.dnstair.y, false);
    for (const trap of level.traps || []) {
        const flipTrap = inArea(trap.tx, trap.ty);
        const point = transform(trap.tx, trap.ty);
        trap.tx = point.x; trap.ty = point.y;
        if (flipTrap && trap.ttyp === ROLLING_BOULDER_TRAP) {
            trap.launch = transform(trap.launch.x, trap.launch.y, false);
            if (!trap.launch2) throw new Error('Rolling boulder trap has no second launch location.');
            trap.launch2 = transform(trap.launch2.x, trap.launch2.y, false);
        }
    }
    const movedObjects: FloorObjects = [];
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const pile = level.objects?.[x]?.[y];
            if (!pile) continue;
            const point = transform(x, y);
            for (const object of pile) {
                object.ox = point.x; object.oy = point.y;
            }
            const column = movedObjects[point.x] ??= [];
            column[point.y] = pile;
        }
    }
    level.objects = movedObjects;
    const flipCoordinate = (coordinate: Position | null | undefined): void => {
        if (!coordinate?.x) return;
        const flipped = transform(coordinate.x, coordinate.y);
        coordinate.x = flipped.x;
        coordinate.y = flipped.y;
    };
    for (const monster of level.monsters || []) {
        if (!inArea(monster.mx, monster.my)) continue;
        const point = transform(monster.mx, monster.my);
        monster.mx = point.x; monster.my = point.y;
        if (monster.ispriest) {
            flipCoordinate((monster.epri || monster.mextra?.epri)?.shrpos);
        } else if (monster.isshk) {
            const shop = monster.eshk || monster.mextra?.eshk;
            flipCoordinate(shop?.shk);
            flipCoordinate(shop?.shd);
        } else if (monster.wormno) {
            flipCoordinate(monster.wormHead);
            if (!monster.wormSegments) throw new Error('Long worm has no segment list.');
            monster.wormSegments = monster.wormSegments.map(segment =>
                transform(segment.x, segment.y));
        }
    }
    for (const engraving of level.engravings || []) {
        const point = transform(engraving.x, engraving.y, false);
        engraving.x = point.x; engraving.y = point.y;
    }
    for (const room of level.rooms.slice(0, level.nroom)) {
        if (!isRoom(room)) continue;
        const low = transform(room.lx, room.ly, false);
        const high = transform(room.hx, room.hy, false);
        room.lx = Math.min(low.x, high.x); room.hx = Math.max(low.x, high.x);
        room.ly = Math.min(low.y, high.y); room.hy = Math.max(low.y, high.y);
    }
    for (const room of level.subrooms || []) {
        if (!room) continue;
        const low = transform(room.lx, room.ly, false);
        const high = transform(room.hx, room.hy, false);
        room.lx = Math.min(low.x, high.x); room.hx = Math.max(low.x, high.x);
        room.ly = Math.min(low.y, high.y); room.hy = Math.max(low.y, high.y);
    }
    for (const door of level.doors || []) {
        const point = transform(door.x, door.y);
        door.x = point.x; door.y = point.y;
    }
    for (const zone of level.exclusionZones || []) {
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
                const otherY = flipY(y);
                const column = level.requireColumn(x);
                const swap = level.requireAt(x, y);
                column[y] = level.requireAt(x, otherY);
                column[otherY] = swap;
            }
        }
    }
    if (flp & 2) {
        for (let x = minx; x < minx + Math.trunc((maxx - minx + 1) / 2); x++) {
            const otherX = flipX(x);
            const column = level.requireColumn(x);
            const otherColumn = level.requireColumn(otherX);
            for (let y = miny; y <= maxy; y++) {
                const swap = level.requireAt(x, y);
                column[y] = level.requireAt(otherX, y);
                otherColumn[y] = swap;
            }
        }
    }
    level._flip = { flp, minx, miny, maxx, maxy };
}

function flipSpecialLevelRandom(allowed: number): void {
    let flp = 0;
    if ((allowed & 1) && rn2(2)) flp |= 1;
    if ((allowed & 2) && rn2(2)) flp |= 2;
    flipSpecialLevel(flp);
}

async function fillZooRoom(room: Room): Promise<void> {
    const level = requireGameLevel();
    // C ref: mkroom.c fill_zoo(), ZOO branch.  Irregular-room membership and
    // the first linked door determine the traversal and its three-cell
    // entrance exclusion.  Monster and gold creation remain shared owners.
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    const entrance = level.doors[room.fdoor];
    if (room.doorct && !entrance) throw new Error('Zoo room has no entrance door.');
    let goldlim = 500 * level_difficulty();
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.requireAt(x, y);
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

            const species = room.rtype === LEPREHALL ? MONSTER_NAME.indexOf('leprechaun')
                : room.rtype === COCKNEST ? MONSTER_NAME.indexOf('cockatrice')
                    : room.rtype === ANTHOLE ? antholeMonsterType() : null;
            const monster = await makemon(species, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster) monster.msleeping = 1;

            if (room.rtype === ANTHOLE) {
                if (!rn2(3)) await mkobj_at(FOOD_CLASS, x, y, false);
            } else if (room.rtype === COCKNEST) {
                if (!rn2(3)) {
                    const statue = await createToptenObject(STATUE, x, y);
                    for (let count = rn2(5); count > 0; count--)
                        await addToContainer(statue, await mkobj(RANDOM_CLASS, false));
                    statue.owt = objectWeight(statue);
                }
            } else {
                let amountRange = goldlim;
                if (room.doorct && entrance) {
                    const dx = x - entrance.x, dy = y - entrance.y;
                    const distanceSquared = dx * dx + dy * dy;
                    amountRange = distanceSquared * distanceSquared;
                }
                if (amountRange >= goldlim)
                    amountRange = 5 * level_difficulty();
                goldlim -= amountRange;
                await mkgold(rn1(amountRange, 10), x, y);
            }
        }
    }
    if (room.rtype === ZOO) level.flags.has_zoo = true;
}

// C mkroom.c:antholemon(). A level's colony uses one birthday-derived
// species, trying the next two species if genocide or extinction forbids it.
function antholeMonsterType(): number | null {
    const species = ['soldier ant', 'fire ant', 'giant ant'];
    const start = ((game.ubirthday ?? 0) % 3) + level_difficulty();
    for (let attempt = 0; attempt < 3; attempt++) {
        const name = species[(start + attempt) % 3];
        if (!name) throw new RangeError('Anthole species selection is out of range');
        const mnum = MONSTER_NAME.indexOf(name);
        if (!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE)) return mnum;
    }
    return null;
}

export function courtMonsterType(): number | null {
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

async function fillCourtRoom(room: Room): Promise<void> {
    const level = requireGameLevel();
    // C mkroom.c:fill_zoo(COURT).  Maze courts use the throne already drawn
    // on the map; ordinary courts choose a free square for a new throne.
    const throne = { x: 0, y: 0 };
    let mappedThrone = false;
    if (level.flags.is_maze_lev) {
        for (let x = room.lx; x <= room.hx && !mappedThrone; x++) {
            for (let y = room.ly; y <= room.hy; y++) {
                if (level.at(x, y)?.typ !== THRONE) continue;
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
        const mace = await mksobj(MACE, true, false);
        await addObjectToMonsterInventory(ruler, mace, game, { atFront: true });
    }

    const entrance = room.doorct
        ? level.doors[room.fdoor] : null;
    const roomNumber = level.rooms.indexOf(room) + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.at(x, y);
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

    const throneLoc = level.at(throne.x, throne.y);
    if (throneLoc) throneLoc.typ = THRONE;
    const cofferPosition = { x: 0, y: 0 };
    somexyspace(room, cofferPosition);
    const gold = await mksobj(GOLD_PIECE, true, false);
    gold.quan = rn1(50 * difficulty, 10);
    gold.quantity = gold.quan;
    gold.owt = (OBJECT_WEIGHT[GOLD_PIECE] ?? 0) * gold.quan;
    const chest = await mksobj_at(
        CHEST, cofferPosition.x, cofferPosition.y, true, false,
    );
    chest.contents = [gold];
    chest.spe = 2;
    level.flags.has_court = true;
}

function loadSpecialAsciiMap(
    rows: readonly string[], lit: boolean,
    origin: Pick<SpecialLevelContext, 'xstart' | 'ystart'> | null = null,
): SpecialLevelContext {
    const level = requireGameLevel();
    const width = Math.max(...rows.map(row => row.length));
    const context = origin
        ? { ...origin, width, height: rows.length }
        : centeredSpecialMap(width, rows.length);
    for (const [dy, sourceRow] of rows.entries()) {
        const row = sourceRow.padEnd(width, ' ');
        for (let dx = 0; dx < width; dx++) {
            // `x` is NetHack's INVALID_TYPE map glyph: it is transparent and
            // preserves the terrain established by level_init.
            if (row[dx] === 'x') continue;
            const loc = level.at(context.xstart + dx, context.ystart + dy);
            // lspo_map() clips a fragment at COLNO/ROWNO while retaining its
            // declared coordinate frame.  water.lua deliberately supplies an
            // 80-column fragment beginning at column one, so its last source
            // column lies beyond NetHack's usable map and is ignored.
            if (!loc) continue;
            loc.lit = lit;
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
            else if (row[dx] === 'A') loc.typ = AIR;
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
    for (const [dy, sourceRow] of rows.entries()) {
        const row = sourceRow.padEnd(width, ' ');
        for (let dx = 0; dx < width; dx++) {
            if (row[dx] !== '+' && row[dx] !== 'S') continue;
            const loc = level.at(context.xstart + dx, context.ystart + dy);
            if (!loc) continue;
            specialDoorAt(context, loc.doormask, dx, dy);
        }
    }
    return context;
}

function specialStairAt(context: SpecialLevelContext, x: number, y: number, up: boolean): void {
    mkstairs(context.xstart + x, context.ystart + y, up, null);
}

function specialLadderAt(context: SpecialLevelContext, x: number, y: number, up: boolean): void {
    const ladderX = context.xstart + x;
    const ladderY = context.ystart + y;
    const loc = requireGameLevel().at(ladderX, ladderY);
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

async function specialObjectAt(
    context: SpecialLevelContext, otyp: number, x: number, y: number,
    { named = false }: { named?: boolean } = {},
): Promise<GameObject> {
    // sp_lev.c:create_object() passes `!named` as mksobj_at()'s artifact
    // eligibility.  This matters even when no artifact can be produced:
    // unnamed armor still consumes its source-owned rn2(40) chance.
    return await mksobj_at(
        otyp, context.xstart + x, context.ystart + y, true, !named,
    );
}

async function specialRandomObjectAt(context: SpecialLevelContext, x: number, y: number): Promise<GameObject> {
    return await mkobj_at(
        RANDOM_CLASS, context.xstart + x, context.ystart + y, true,
    );
}

async function specialObjectClassAt(
    context: SpecialLevelContext, objectClass: number, x: number, y: number,
): Promise<GameObject> {
    return await mkobj_at(
        objectClass, context.xstart + x, context.ystart + y, true,
    );
}

function applyMinesSameRaceMonsterGate(mndx: number | null): number | null {
    const dungeonName = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname;
    const prototype = game._activeSpecialLevel?.prototype;
    const inMines = dungeonName === 'The Gnomish Mines'
        || prototype === 'minefill'
        || prototype === 'minetn'
        || prototype === 'minend';
    if (mndx == null || !inMines) return mndx;
    const race = game.urace?.noun;
    const selfMask = race === 'dwarf' ? M2_DWARF
        : race === 'gnome' ? M2_GNOME : 0;
    if (!selfMask || !((MONSTER_FLAGS2[mndx] || 0) & selfMask))
        return mndx;
    // sp_lev.c:create_monster(): Mines levels usually replace a requested
    // monster of the dwarf/gnome hero's own race with a random species.
    return rn2(3) ? null : mndx;
}

export function finishSpecialRoamer(monster: Monster, alignment: number, peaceful: boolean): void {
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

interface SpecialMonsterOptions {
    randomGender?: boolean;
    randomAlignment?: boolean;
    peaceful?: boolean | null;
    asleep?: boolean | null;
    mmflags?: number;
    roamerAlignment?: number | (() => number) | null;
}

interface SpecialObjectAppearance {
    kind: 'object';
    otyp: number;
}

interface SpecialTrapOptions {
    spiderOnWeb?: boolean;
    seen?: boolean;
    victim?: boolean;
}

async function specialMonsterAt(
    context: SpecialLevelContext, mndx: number | null, x: number, y: number,
    {
        randomGender = true,
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    }: SpecialMonsterOptions = {},
): Promise<Monster | null> {
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
    if (monster && requestedFemale !== null) monster.female = requestedFemale;
    if (monster && peaceful != null) monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null) monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}

async function specialMonsterClassAt(
    context: SpecialLevelContext, monsterClass: number, x: number, y: number,
    appearance: SpecialObjectAppearance | null = null,
    {
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    }: SpecialMonsterOptions = {},
): Promise<Monster | null> {
    const level = requireGameLevel();
    // A class request resolves random alignment and mkclass(), but unlike a
    // named species it has no separate find_montype() gender draw.  Explicit
    // coordinates also bypass get_location()'s two-axis sampling.
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    let mndx = mkclass(monsterClass, 0x0200);
    // A null class choice asks makemon() for a random species.
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const absoluteX = context.xstart + x, absoluteY = context.ystart + y;
    const occupied = level.monsters.some(candidate => monsterHasMapPosition(candidate, game) && candidate.mhp > 0
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

export async function giveSpecialMonsterObject(
    context: SpecialLevelContext, monster: Monster | null, otyp: number, spe?: number | null,
): Promise<GameObject | null> {
    const point = await specialRandomLocation(context);
    if (!point || !monster) return null;
    const object = await mksobj_at(otyp, point.x, point.y, true, true);
    if (spe != null) object.spe = spe;
    remove_object(object, game);
    return await addObjectToMonsterInventory(
        monster, object, game, { atFront: true },
    );
}

function specialNonPasswall(context: SpecialLevelContext): void {
    const level = requireGameLevel();
    for (let dx = 0; dx < context.width; dx++) {
        for (let dy = 0; dy < context.height; dy++) {
            const loc = level.at(context.xstart + dx, context.ystart + dy);
            if (loc && IS_WALL(loc.typ)) loc.wall_info |= W_NONPASSWALL;
        }
    }
}

async function specialMonsterRandomLocation(
    context: SpecialLevelContext, mndx: number | null,
): Promise<Position | null> {
    // create_monster() has no species humidity to retry when selection
    // falls back to a random monster; it goes directly through DRY.
    if (mndx === null) return await getLocationCoord(context, null, DRY);
    const humidity = specialMonsterHumidity(mndx);
    let point = await getLocationCoord(context, null, humidity | NO_LOC_WARN);
    if (point.x === -1 && point.y === -1)
        point = await getLocationCoord(context, null, humidity | DRY);
    return point.x === -1 && point.y === -1 ? null : point;
}

async function specialExplicitMonster(
    context: SpecialLevelContext, mndx: number, appearance: SpecialObjectAppearance | null = null,
    {
        randomGender = true,
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    }: SpecialMonsterOptions = {},
): Promise<Monster | null> {
    const level = requireGameLevel();
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
    const selectedSpecies = applyMinesSameRaceMonsterGate(mndx);
    const point = await specialMonsterRandomLocation(context, selectedSpecies);
    if (!point) return null;
    const occupied = level.monsters.some(candidate => monsterHasMapPosition(candidate, game) && candidate.mhp > 0
        && candidate.mx === point.x && candidate.my === point.y);
    const monster = occupied
        ? await makemonNear(selectedSpecies, point.x, point.y, mmflags)
        : await makemon(selectedSpecies, point.x, point.y, mmflags);
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
    context: SpecialLevelContext, monsterClass: number,
    {
        randomAlignment = true,
        peaceful = null,
        asleep = null,
        mmflags = 0,
        roamerAlignment = null,
    }: SpecialMonsterOptions = {},
): Promise<Monster | null> {
    const level = requireGameLevel();
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
    const point = await specialMonsterRandomLocation(context, mndx);
    if (!point) return null;
    const occupied = level.monsters.some(candidate => monsterHasMapPosition(candidate, game) && candidate.mhp > 0
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

async function finishLevelTrapConstruction(
    trap: Trap | null, { spiderOnWeb = true, seen = false, victim = true }: SpecialTrapOptions = {},
): Promise<Trap | null> {
    if (!trap) return null;
    const kind = trap.ttyp;
    // mklev.c:mktrap() owns the web's resident spider before evaluating the
    // shallow-level dead-predecessor gate.
    if (kind === WEB && spiderOnWeb)
        await makemon(PM_GIANT_SPIDER, trap.tx, trap.ty, 0);
    if (seen) trap.tseen = true;
    const cameFrom = game.u.ucamefrom;
    if (kind === MAGIC_PORTAL && cameFrom && (cameFrom.dnum || cameFrom.dlevel))
        trap.dst = { ...cameFrom };

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
        await mktrap_victim(trap);
    }
    return trap;
}

// sp_lev.c:create_trap() checks stairs after get_location_coord(), even
// when the water plane accepts every terrain during coordinate selection.
async function specialTrapLocation(
    context: SpecialLevelContext, coordinate: Position | null,
): Promise<Position | null> {
    const level = requireGameLevel();
    const room = context._room;
    if (room) {
        const point = await getLocationCoord(context, coordinate, DRY);
        if (level.at(point.x, point.y)?.typ === ROOM) return point;
        // get_free_room_loc() falls back to room floor, including when
        // an explicit coordinate names furniture or other terrain.
        for (let attempt = 0; attempt <= 100; attempt++) {
            if (!somexy(room, point))
                throw new Error("get_room_loc: can't find a place!");
            if (level.at(point.x, point.y)?.typ === ROOM) return point;
        }
        throw new Error("get_free_room_loc: can't find a place!");
    }
    for (let attempt = 0; attempt <= 100; attempt++) {
        const point = await getLocationCoord(context, coordinate, DRY);
        const terrain = level.at(point.x, point.y)?.typ;
        if (terrain !== STAIRS && terrain !== LADDER) return point;
    }
    return null;
}

async function specialTrapOfType(
    context: SpecialLevelContext, typ: number, options: SpecialTrapOptions,
    coordinate: Position | null,
): Promise<Trap | null> {
    const point = await specialTrapLocation(context, coordinate);
    if (!point) return null;
    return await mktrap(typ, options, null, point);
}

async function specialMonster(context: SpecialLevelContext, {
    randomAlignment = true,
    peaceful = null,
    asleep = null,
    mmflags = 0,
    roamerAlignment = null,
}: SpecialMonsterOptions = {}): Promise<Monster | null | undefined> {
    const level = requireGameLevel();
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const point = await specialRandomLocation(context);
    if (!point) return;
    const occupiedPoint = level.monsters.some(monster => monsterHasMapPosition(monster, game) && monster.mhp > 0
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

function setSpecialRegionLighting(
    context: SpecialLevelContext, x1: number, y1: number, x2: number, y2: number, lit: boolean,
): void {
    const level = requireGameLevel();
    // sp_lev.c's two-argument des.region(selection, "lit") grows the cloned
    // selection one cell in every direction before applying light.  "unlit"
    // applies to the literal selection without growth.
    const halo = lit ? 1 : 0;
    for (let x = x1 - halo; x <= x2 + halo; x++) {
        for (let y = y1 - halo; y <= y2 + halo; y++) {
            const loc = level.at(context.xstart + x, context.ystart + y);
            if (loc) loc.lit = lit;
        }
    }
}


async function generateMineFiller(active: ActiveSpecialLevel): Promise<void> {
    active.file = 'minefill.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

export async function generateVladsTowerLevel(active: ActiveSpecialLevel): Promise<void> {
    if (!/^tower[1-3]$/.test(active?.prototype))
        throw new RangeError(`unknown Vlad tower level ${active?.prototype}`);
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

export async function generateMinesEnd(active: ActiveSpecialLevel): Promise<void> {
    if (active.variant === undefined || active.variant < 1 || active.variant > 3) {
        throw new RangeError(`unknown Mines' End layout ${active?.variant}`);
    }
    active.file = `minend-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function specialRoomContext(room: Room): SpecialLevelContext {
    const context: SpecialLevelContext = {
        xstart: room.lx,
        ystart: room.ly,
        width: room.hx - room.lx + 1,
        height: room.hy - room.ly + 1,
        _room: room,
    };
    Object.defineProperty(context, '_room', {
        enumerable: false, configurable: false, writable: false,
    });
    return context;
}

function addDoorsToSpecialRoom(room: Room): void {
    const level = requireGameLevel();
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const loc = level.at(x, y);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                add_door(x, y, room);
        }
    }
    for (const subroom of room.sbrooms || []) addDoorsToSpecialRoom(subroom);
}

interface SpecialRoomSpec {
    chance?: number;
    rtype?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    lit?: number | boolean;
    xalign?: number;
    yalign?: number;
    filled?: number;
    joined?: boolean | number;
}

async function buildSpecialRoom(
    spec: SpecialRoomSpec, parent: Room | null = null,
    contents: ((room: Room) => Promise<unknown> | void) | null = null,
): Promise<Room | null> {
    const level = requireGameLevel();
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
        room = made ? level.rooms[level.nroom - 1] : null;
    }
    if (!isRoom(room)) return null;
    // Lua lspo_room() marks the current parent irregular as soon as a child
    // room is accepted.  Runtime inside_room() queries must then use map
    // room-number ownership rather than the parent's rectangular boundary.
    if (parent) parent.irregular = true;
    topologize(room);
    // lspo_room() leaves themed rooms unstocked unless Lua requests filling.
    // Special-level room definitions retain the ordinary filled default.
    room.needfill = spec.filled ?? (game.in_mk_themerooms ? FILL_NONE : FILL_NORMAL);
    room.needjoining = spec.joined === undefined || !!spec.joined;
    if (contents) await contents(room);
    addDoorsToSpecialRoom(room);
    return room;
}

function createSpecialRoomDoor(
    room: Room, state: string, wall: string, position = -1,
): void {
    const level = requireGameLevel();
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
            if (!isok(x, y - 1) || IS_OBSTRUCTED(level.requireAt(x, y - 1).typ))
                continue;
        } else if (direction === 1) {
            y = room.hy + 1;
            x = room.lx + (position < 0
                ? rn2(1 + room.hx - room.lx) : position);
            if (!isok(x, y + 1) || IS_OBSTRUCTED(level.requireAt(x, y + 1).typ))
                continue;
        } else if (direction === 2) {
            x = room.lx - 1;
            y = room.ly + (position < 0
                ? rn2(1 + room.hy - room.ly) : position);
            if (!isok(x - 1, y) || IS_OBSTRUCTED(level.requireAt(x - 1, y).typ))
                continue;
        } else {
            x = room.hx + 1;
            y = room.ly + (position < 0
                ? rn2(1 + room.hy - room.ly) : position);
            if (!isok(x + 1, y) || IS_OBSTRUCTED(level.requireAt(x + 1, y).typ))
                continue;
        }
        if (okdoor(x, y)) {
            found = true;
            break;
        }
    }
    if (!found) return;
    const loc = level.at(x, y);
    if (!loc) return;
    loc.typ = secret ? SDOOR : DOOR;
    loc.doormask = mask;
}

export async function generateMinetown(active: ActiveSpecialLevel): Promise<void> {
    const level = requireGameLevel();
    if (active.variant === undefined || active.variant < 1 || active.variant > 7) {
        throw new RangeError(`unknown Minetown layout ${active?.variant}`);
    }
    active.file = `minetn-${active.variant}.lua`;
    level.flags.is_maze_lev = true;
    level.flags.has_town = true;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room)) await fillSpecialRoom(room);
}

function isLuaQuestPrototype(prototype: string): boolean {
    return /^[A-Z][a-z]{2}-(strt|loca|goal|fila|filb)$/.test(prototype);
}

async function generateLuaQuestLevel(active: ActiveSpecialLevel): Promise<void> {
    if (!isLuaQuestPrototype(active?.prototype))
        throw new RangeError(`unknown quest level ${active?.prototype}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room)) await fillSpecialRoom(room);
}

export async function generateOracleLevel(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'oracle')
        throw new RangeError(`unknown Oracle level ${active?.prototype}`);
    active.file = 'oracle.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function specialRectangularRoom(
    context: SpecialLevelContext, x1: number, y1: number, x2: number, y2: number,
    rtype: number, lit: boolean, needfill: number,
): Room {
    const level = requireGameLevel();
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
            const loc = level.at(x, y);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                add_door(x, y, room);
        }
    }
    return room;
}

async function specialShrinePriest(
    temple: Room | null, altarX: number, altarY: number, altarAlignment: number,
    { sanctum = false }: { sanctum?: boolean } = {},
): Promise<Monster | null> {
    const level = requireGameLevel();
    const shrineLevel = game.u.uz;
    if (!shrineLevel) throw new Error('Shrine priest creation requires the dungeon location.');
    const startDirection = rn2(8);
    let priestX = altarX, priestY = altarY;
    for (let offset = 0; offset < 8; offset++) {
        const direction = (startDirection + offset) % 8;
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined)
            throw new RangeError(`Invalid priest placement direction ${direction}`);
        const x = altarX + dx;
        const y = altarY + dy;
        const loc = level.at(x, y);
        if (loc && SPACE_POS(loc.typ)
            && !level.monsters.some(monster => monsterHasMapPosition(monster, game) && monster.mhp > 0
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
        shrlevel: { ...shrineLevel },
        parentmid: priest.m_id,
        intone_time: 0,
        enter_time: 0,
        peaceful_time: 0,
        hostile_time: 0,
    };
    priest.mtrapseen = 0x7fffffff;

    if (sanctum && altarAlignment === A_NONE) {
        const amulet = await mksobj(AMULET_OF_YENDOR, true, false);
        await addObjectToMonsterInventory(
            priest, amulet, game, { atFront: true },
        );
    }

    const spellbookCount = 2 + rn2(3);
    for (let count = 0; count < spellbookCount; count++) {
        const spellbook = await mkobj(SPBOOK_no_NOVEL, false);
        await addObjectToMonsterInventory(
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

export function morgueMonsterType(): number | null {
    const roll = rn2(100);
    const hitDice = rn2(level_difficulty());
    if (hitDice > 10 && roll < 10) {
        const inHell = !!game.dungeons[game.u.uz?.dnum ?? 0]?.flags?.hellish;
        if (inHell || In_endgame(game.u.uz)) return mkclass(56, 0);
        const demon = normalDemon(A_NONE);
        if (demon != null) return demon;
    }
    if (hitDice > 8 && roll > 85) return mkclass(48, 0);
    if (roll < 20) return 287; // PM_GHOST
    if (roll < 40) return 230; // PM_WRAITH
    return mkclass(52, 0); // S_ZOMBIE
}

// C mkobj.c:mk_tt_object(). Statues have no initial books; a missing score
// entry falls back to a real player role without supplying a name or gender.
export async function createToptenObject(type: number, x: number, y: number): Promise<GameObject> {
    const object = await mksobj_at(type, x, y, type !== STATUE, false);
    if (!await nameObjectFromTopten(object)) {
        const firstRole = MONSTER_NAME.indexOf('archeologist');
        const lastRole = MONSTER_NAME.indexOf('wizard');
        set_corpsenm(object, rn1(lastRole - firstRole + 1, firstRole));
        object.owt = objectWeight(object);
    }
    return object;
}

async function fillMorgueRoom(room: Room): Promise<void> {
    const level = requireGameLevel();
    const entrance = room.doorct ? level.doors[room.fdoor] : null;
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.at(x, y);
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
            if (!rn2(5)) await createToptenObject(CORPSE, x, y);
            if (!rn2(10))
                await mksobj_at(rn2(3) ? LARGE_BOX : CHEST, x, y, true, false);
            if (!rn2(5)) make_grave(x, y, null);
        }
    }
    level.flags.has_morgue = true;
}

function specialMapRows(source: string): string[] {
    const rows = source.split('\n');
    if (rows.at(-1) === '') rows.pop();
    return rows;
}

async function fillSpecialLevel(
    options: DesOptions, active: ActiveSpecialLevel,
): Promise<void> {
    const level = requireGameLevel();
    active.levelInitialized = true;
    if (options.style === 'mines') {
        const foreground = mapCharacterType(options.fg ?? '.');
        const background = mapCharacterType(options.bg ?? ' ');
        if (foreground === undefined || background === undefined)
            throw new Error('unknown Lua mines terrain');
        const lit = options.lit == null ? !!rn2(2) : !!options.lit;
        await mkmap({
            lit,
            foreground,
            background,
            smoothed: !!options.smoothed,
            joined: !!options.joined,
            walled: !!options.walled,
            icedPools: !!active.icedPools,
        });
        active.defaultLit = lit;
        return;
    }
    if (options.style === 'swamp') {
        const foreground = mapCharacterType(options.fg ?? '.');
        const background = mapCharacterType(options.bg ?? '}');
        if (foreground === undefined || background === undefined)
            throw new Error('unknown Lua swamp terrain');
        const lit = !!options.lit;
        fillSpecialSwamp(foreground, background, lit);
        active.defaultLit = lit;
        return;
    }
    if (options.style === 'mazegrid') {
        const type = mapCharacterType(options.bg ?? '-');
        if (type === undefined)
            throw new Error(`unknown Lua map character ${options.bg}`);
        fillSpecialMazeGrid(type);
        active.defaultLit = false;
        return;
    }
    if (options.style === 'maze') {
        createMaze(
            options.corrwid ?? -1,
            options.wallthick ?? -1,
            options.deadends === false,
        );
        active.defaultLit = false;
        return;
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
            level.requireAt(x, y).lit = active.defaultLit;
        }
    }
    return;
}

function setLuaLevelFlags(active: ActiveSpecialLevel, flags: LuaValue[]): void {
    const level = requireGameLevel();
    for (const flag of flags) {
        if (flag === 'mazelevel') level.flags.is_maze_lev = true;
        else if (flag === 'noteleport') level.flags.noteleport = true;
        else if (flag === 'hardfloor') level.flags.hardfloor = true;
        else if (flag === 'nommap') level.flags.nommap = true;
        else if (flag === 'shortsighted') level.flags.shortsighted = true;
        else if (flag === 'arboreal') level.flags.arboreal = true;
        else if (flag === 'graveyard') level.flags.graveyard = true;
        else if (flag === 'corrmaze') level.flags.corrmaze = true;
        else if (flag === 'sokoban') level.flags.sokoban_rules = true;
        else if (flag === 'premapped') active.premapped = true;
        else if (flag === 'solidify') active.solidify = true;
        else if (flag === 'inaccessibles') active.checkInaccessibles = true;
        else if (flag === 'noflipx') active.allowFlips = (active.allowFlips ?? 0) & ~2;
        else if (flag === 'noflipy') active.allowFlips = (active.allowFlips ?? 0) & ~1;
        else if (flag === 'noflip') active.allowFlips = 0;
        else if (flag === 'temperate') level.flags.temperature = 0;
        else if (flag === 'hot') level.flags.temperature = 1;
        else if (flag === 'cold') level.flags.temperature = -1;
        else if (flag === 'nomongen') level.flags.rndmongen = false;
        else if (flag === 'nodeathdrops') level.flags.deathdrops = false;
        else if (flag === 'noautosearch') level.flags.noautosearch = true;
        else if (flag === 'fumaroles') level.flags.fumaroles = true;
        else if (flag === 'stormy') level.flags.stormy = true;
        else if (flag === 'icedpools') active.icedPools = true;
        else if (flag !== 'shroud')
            throw new Error(`unknown Lua level flag ${flag}`);
    }
}

function replaceLuaTerrain(context: SpecialLevelContext, options: DesSelectionOptions): void {
    const level = requireGameLevel();
    let selection = options.selection;
    if (!selection && Array.isArray(options.region)) {
        selection = specialSelectionFillRect(context, ...options.region);
    }
    if (!selection) {
        selection = specialSelectionFillRect(
            { xstart: 0, ystart: 0, width: COLNO, height: ROWNO }, 1, 0, COLNO - 1, ROWNO - 1,
        );
    }
    const fromType = mapCharacterType(options.fromterrain ?? '');
    const toType = mapCharacterType(options.toterrain ?? '');
    const fragment = fromType === undefined && options.mapfragment != null
        ? specialSelectionMatch(String(options.mapfragment)) : null;
    if ((!fragment && fromType === undefined) || toType === undefined)
        throw new Error('unknown Lua replacement terrain');
    const chance = options.chance ?? 100;
    const lit = options.lit ?? -2;
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        const matches = fragment
            ? fragment.has(x, y)
            : loc && fromType !== undefined && match_maptyps(fromType, loc.typ);
        if (!matches || rn2(100) >= chance) return;
        setLevelTerrainLit(x, y, toType, lit);
        if (loc && (toType === IRONBARS || toType === HWALL)) loc.horizontal = true;
    });
}

async function createLuaFeature(
    context: SpecialLevelContext, { type, point }: Parameters<DesOperations['feature']>[0],
): Promise<void> {
    const level = requireGameLevel();
    const types: Record<string, number> = {
        fountain: FOUNTAIN, sink: SINK, pool: POOL,
        throne: THRONE, tree: TREE,
    };
    const featureType = types[type];
    if (featureType === undefined)
        throw new Error(`unknown Lua feature ${type}`);
    if (point) {
        const loc = level.at(
            context.xstart + point.x, context.ystart + point.y,
        );
        if (loc) {
            loc.typ = featureType;
            if (featureType === FOUNTAIN) level.flags.nfountains++;
            else if (featureType === SINK) level.flags.nsinks++;
        }
        return;
    }
    if (await specialFeatureOfType(context, featureType)) {
        if (featureType === FOUNTAIN) level.flags.nfountains++;
        else if (featureType === SINK) level.flags.nsinks++;
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

function specialRoomAt(x: number, y: number, roomType: number): Room | null {
    const level = requireGameLevel();
    const roomNumber = level.at(x, y)?.roomno ?? 0;
    const direct = roomNumber >= ROOMOFFSET
        ? level.rooms?.[roomNumber - ROOMOFFSET] : null;
    if (direct && isRoom(direct) && direct.rtype === roomType) return direct;
    return level.rooms
        ?.slice(0, level.nroom)
        .filter(isRoom)
        .find(room => room.rtype === roomType
            && x >= room.lx && x <= room.hx
            && y >= room.ly && y <= room.hy) ?? null;
}

function luaCoordinate(options: { coord?: DesOptions['coord']; x?: number | undefined; y?: number | undefined }): Position | null {
    if (Array.isArray(options.coord))
        return { x: options.coord[0], y: options.coord[1] };
    if (options.coord && Number.isInteger(options.coord.x)
        && Number.isInteger(options.coord.y)) return options.coord;
    if (typeof options.x === 'number' && typeof options.y === 'number'
        && Number.isInteger(options.x) && Number.isInteger(options.y))
        return { x: options.x, y: options.y };
    return null;
}

async function createLuaAltar(context: SpecialLevelContext, options: DesOptions): Promise<void> {
    const level = requireGameLevel();
    const coordinate = luaCoordinate(options);
    const point = coordinate
        ? {
            x: context.xstart + coordinate.x,
            y: context.ystart + coordinate.y,
        }
        : await specialRandomLocation(context);
    if (!point) return;
    const altar = level.at(point.x, point.y);
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
    level.flags.has_temple = true;
}

function luaRoomLighting(value: boolean | number): boolean {
    if (value !== -1) return !!value;
    return rnd(1 + Math.abs(depth_of_level(game.u?.uz))) < 11
        && rn2(77) !== 0;
}

function luaRoomType(name = 'ordinary') {
    const roomTypes: Record<string, number> = {
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

function luaRoomTable(room: Room) {
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

async function createLuaRoomRegion(context: SpecialLevelContext, options: DesOptions): Promise<Room | null> {
    const [x1, y1, x2, y2] = options.region
        ?? [options.x1, options.y1, options.x2, options.y2];
    if (typeof x1 !== 'number' || typeof y1 !== 'number'
        || typeof x2 !== 'number' || typeof y2 !== 'number'
        || ![x1, y1, x2, y2].every(Number.isInteger))
        throw new TypeError('des.region requires four coordinates');
    const roomType = luaRoomType(options.type);
    const lit = luaRoomLighting(options.lit ?? -1);
    const roomNotNeeded = roomType === OROOM && !options.irregular
        && !options.arrival_room && !game.in_mk_themerooms;
    if (roomNotNeeded || requireGameLevel().nroom >= MAXNROFROOMS) {
        if (!roomNotNeeded) await impossible('Too many rooms on new level!');
        lightSpecialArea(context, x1, y1, x2, y2, lit);
        return null;
    }
    const needFill = options.filled ?? 0;
    const room = options.irregular
        ? specialIrregularRoom(
            context, x1, y1,
            roomType, lit, needFill,
        )
        : specialRectangularRoom(
            context, x1, y1, x2, y2, roomType, lit, needFill,
        );
    room.needjoining = options.joined === undefined || !!options.joined;
    if (room && options.arrival_room) room.arrival_room = true;
    return room;
}

function luaRoomSpec(options: DesOptions) {
    const coordinate = luaCoordinate(options);
    const horizontal: Record<string, number> = {
        left: 1, 'half-left': 2, center: 3, 'half-right': 4, right: 5,
        none: -1, random: -1,
    };
    const xalign = horizontal[options.xalign ?? 'random'];
    const vertical: Record<string, number> = {
        top: 1, center: 3, bottom: 5, none: -1, random: -1,
    };
    const yalign = vertical[options.yalign ?? 'random'];
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

async function createLuaStair(context: SpecialLevelContext, { direction, point }: Parameters<DesOperations['stair']>[0]): Promise<Position | null> {
    const up = direction === 'up';
    if (!point) return await specialStair(context, up);
    specialStairAt(context, point.x, point.y, up);
    return { x: context.xstart + point.x, y: context.ystart + point.y };
}

function createLuaDoor(context: SpecialLevelContext, {
    state, point, wall = 'all', pos = -1,
}: Parameters<DesOperations['door']>[0]) {
    if (!point) {
        if (!context?._room)
            throw new TypeError('des.door without coordinates needs a room');
        return createSpecialRoomDoor(context._room, state, wall, pos);
    }
    if (state === 'random')
        return specialRandomDoorAt(context, point.x, point.y);
    const masks: Record<string, number> = {
        nodoor: D_NODOOR,
        broken: D_BROKEN,
        open: D_ISOPEN,
        closed: D_CLOSED,
        locked: D_LOCKED,
    };
    if (state === 'secret') {
        const door = specialDoorAt(context, D_CLOSED, point.x, point.y);
        const loc = door && requireGameLevel().at(door.x, door.y);
        if (loc) loc.typ = SDOOR;
        return door;
    }
    const mask = masks[state];
    if (mask === undefined) throw new Error(`unknown Lua door state ${state}`);
    return specialDoorAt(context, mask, point.x, point.y);
}

function createLuaDrawbridge(context: SpecialLevelContext, options: DesOptions): Position {
    const coordinate = luaCoordinate(options);
    if (!coordinate)
        throw new TypeError('des.drawbridge requires coordinates');
    const directions: Record<string, number> = {
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
    return { x: context.xstart + coordinate.x, y: context.ystart + coordinate.y };
}

async function createLuaEngraving(context: SpecialLevelContext, options: Parameters<DesOperations['engraving']>[0]) {
    const point = options.point
        ? {
            x: context.xstart + options.point.x,
            y: context.ystart + options.point.y,
        }
        : await specialRandomLocation(context);
    if (!point) return null;
    const types: Record<string, number> = {
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

async function createLuaGold(context: SpecialLevelContext, options: PositionedDesOptions) {
    const point = options.point
        ? {
            x: context.xstart + options.point.x,
            y: context.ystart + options.point.y,
        }
        : await specialRandomLocation(context);
    if (!point) return null;
    const requestedAmount = options.amount ?? -1;
    const amount = requestedAmount < 0 ? rnd(200) : requestedAmount;
    return await mkgold(amount, point.x, point.y);
}

async function createLuaObject(
    context: SpecialLevelContext, options: DesObjectOptions,
    parentContainer: GameObject | null, parentMonster: Monster | null,
    invokeContents: (callback: LuaValue, object: GameObject) => Promise<void>,
): Promise<GameObject | null> {
    const { point, objectClass, objectType } = options;
    // lspo_object() resolves montype before create_object() chooses a
    // coordinate or initializes the object's random attributes.
    let corpseSpecies = options.monsterType;
    if (options.monsterClass !== null) {
        corpseSpecies = mkclass(options.monsterClass, G_NOGEN | G_IGNORE);
        if (corpseSpecies === null) throw new Error('Unknown montype');
    }
    let object: GameObject | null;
    const randomMedusaStatue = objectType === STATUE
        && game._activeSpecialLevel?.prototype === 'medusa'
        && options.montype == null;
    if (randomMedusaStatue) {
        object = await medusaEmptyStatue(context, point);
    } else if (objectType != null) {
        object = point
            ? await specialObjectAt(
                context, objectType, point.x, point.y,
                { named: !!options.name },
            )
            : await specialObjectOfType(context, objectType);
    } else if (objectClass != null) {
        object = point
            ? await specialObjectClassAt(context, objectClass, point.x, point.y)
            : await specialObjectOfClass(context, objectClass);
    } else {
        object = point
            ? await specialRandomObjectAt(context, point.x, point.y)
            : await specialObject(context);
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
    if (corpseSpecies !== null) set_corpsenm(object, corpseSpecies);
    if (options.spe !== undefined && Number.isInteger(options.spe)) object.spe = options.spe;
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
    if (options.quantity !== undefined && Number.isInteger(options.quantity) && options.quantity > 0
        && OBJECT_MERGE[object.otyp]) {
        object.quan = object.quantity = options.quantity;
        object.owt = objectWeight(object);
    }
    if (options.achievement) {
        object.achievement = true;
        object.nomerge = true;
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
        removeFloorObject(object);
        await addObjectToContainer(parentContainer, object, game);
        parentContainer.owt = objectWeight(parentContainer);
    } else if (parentMonster) {
        removeFloorObject(object);
        if (object.otyp !== SADDLE
            || !await putSaddleOnMonster(object, parentMonster))
            await addObjectToMonsterInventory(parentMonster, object, game);
    }
    // sp_lev.c create_object(): everything except container contents goes
    // through stackobj(), lighting, and burial. That includes monster
    // inventory, where stackobj() still scans the floor pile at ox/oy.
    if (!parentContainer) {
        object = await stack_object(object);
        if (options.lit) beginObjectBurn(object);
        if (options.buried && (await buryObject(object)).outcome === 'absorbed') object = null;
    }
    if (!object) return null;
    if (options.contents && typeof options.contents === 'object')
        await invokeContents(options.contents, object);
    return object;
}

function applyLuaMonsterAppearance(monster: Monster | null | undefined, appearance: MonsterAppearance | null): void {
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
    const terrains: Record<string, number> = {
        fountain: FOUNTAIN,
        'staircase down': STAIRS,
    };
    const terrain = terrains[appearance.name];
    if (appearance.kind !== 'terrain' || terrain == null)
        throw new Error(`unsupported Lua monster appearance ${appearance.name}`);
    monster.m_ap_type = M_AP_FURNITURE;
    monster.mappearance = terrain;
}

async function createLuaMonster(context: SpecialLevelContext, options: DesMonsterOptions): Promise<Monster | null> {
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
    // priest.c:mk_roamer() supplies its own flags, allowing random-species
    // companions and counting births regardless of Lua's creation options.
    const creation = explicitAlignment ? {
        randomAlignment: false,
        mmflags: MM_ADJACENTOK | MM_EMIN | MM_NOMSG,
        roamerAlignment: () => luaSpecialAlignment(options.align),
    } : { mmflags };
    let monster: Monster | null | undefined;
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
        setMonsterGivenName(monster, options.name);
    if (monster && options.waiting) {
        monster.mstrategy = (monster.mstrategy ?? 0) | STRAT_WAITFORU;
        monster.waiting = true;
        if (monster.cham === PM_VAMPIRE_LEADER
            && monster.mnum !== PM_VAMPIRE_LEADER
            && options.appearance?.kind !== 'monster') {
            await changeMonsterForm(monster, PM_VAMPIRE_LEADER);
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
    return monster ?? null;
}

async function createLuaTrap(context: SpecialLevelContext, options: Parameters<DesOperations['trap']>[0]) {
    const { trapType, point } = options;
    const construction = {
        seen: !!options.seen,
        victim: options.victim !== false,
        spiderOnWeb: options.spider_on_web !== false,
    };
    const trap = await specialTrapOfType(context, trapType ?? NO_TRAP, construction, point);
    const teleportDestination = luaCoordinate({ coord: options.teledest });
    if (trap && teleportDestination) {
        trap.teledest = {
            x: context.xstart + teleportDestination.x,
            y: context.ystart + teleportDestination.y,
        };
    }
    return trap;
}

function createLuaExclusion(context: SpecialLevelContext, options: DesOptions): void {
    const type = options.type ?? 'teleport';
    if (type !== 'teleport' && type !== 'teleport-up'
        && type !== 'teleport-down' && type !== 'monster-generation')
        throw new Error(`unsupported Lua exclusion ${type}`);
    const region = regionCoordinates(
        context, options.region, options.region_islev,
    );
    requireGameLevel().exclusionZones.push({ type, ...region });
}

function solidifyLuaMap(mappedCells: SpecialSelection): void {
    const level = requireGameLevel();
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = level.at(x, y);
            if (location && IS_STWALL(location.typ) && !mappedCells.has(x, y))
                location.wall_info |= W_NONDIGGABLE | W_NONPASSWALL;
        }
    }
}

function flipLuaRegions(active: ActiveSpecialLevel): void {
    for (const field of [
        'upTeleportRegion', 'upTeleportExclude',
        'downTeleportRegion', 'downTeleportExclude',
        'explicitUpStairRegion', 'explicitDownStairRegion',
        'explicitBranchRegion', 'explicitBranchExclude',
        'explicitPortalRegion', 'explicitPortalExclude',
    ] as const) {
        const region = active[field];
        if (!region) continue;
        const flipped = flipSpecialRegion(region);
        if (flipped) active[field] = flipped;
    }
}

function accessibleSpecialTerrain(x: number, y: number): boolean {
    const level = requireGameLevel();
    const type = level.at(x, y)?.typ;
    return type !== undefined && (ACCESSIBLE(type) || type === SDOOR || type === SCORR);
}

function floodAccessibleArea(selection: SpecialSelection, x: number, y: number): void {
    selection.floodFill(x, y, true, accessibleSpecialTerrain);
}

async function addWayOut(x: number, y: number, reachable: SpecialSelection): Promise<void> {
    const level = requireGameLevel();
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
        ] as const) {
            if (!isok(wallX, wallY) || reachable.has(wallX, wallY)
                || !IS_WALL(level.requireAt(wallX, wallY).typ)
                || !isok(beyondX, beyondY) || !reachable.has(beyondX, beyondY)
                || !ACCESSIBLE(level.requireAt(beyondX, beyondY).typ)) continue;
            level.requireAt(wallX, wallY).typ = SDOOR;
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
    const type = escapeItems[rn2(escapeItems.length)];
    if (type === undefined) throw new Error('Missing special-level escape item');
    await mksobj_at(type, point.x, point.y, true, false);
}

async function ensureWaysOut() {
    const level = requireGameLevel();
    const reachable = new SpecialSelection();
    const currentDungeon = game.u?.uz?.dnum ?? 0;
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.tolev?.dnum === currentDungeon)
            floodAccessibleArea(reachable, stair.sx, stair.sy);
    }
    for (const trap of level.traps || []) {
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
                if (ACCESSIBLE(level.requireAt(x, y).typ)
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

function createLuaLevelSession() {
    const wholeLevel = {
        xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
    };
    let active: ActiveSpecialLevel | null = null;
    let context: SpecialLevelContext = wholeLevel;
    let luaState: LuaGameState | null = null;
    const containers: GameObject[] = [];
    const monsterInventories: Array<Monster | null> = [];
    let mappedCells = new SpecialSelection();
    let roomFailed = false;
    const currentLevel = (): ActiveSpecialLevel => {
        if (!active) throw new Error('Lua level generation has not started');
        return active;
    };
    const currentState = (): LuaGameState => {
        if (!luaState) throw new Error('Lua level generation has no bound state');
        return luaState;
    };
    const invokeObjectContents = async (callback: LuaValue, object: GameObject) => {
        containers.push(object);
        try {
            await currentState().callValueAsync(callback, [currentState().objects.wrap(object)]);
        } finally {
            containers.pop();
        }
    };
    const operations: DesOperations = {
        levelInit: async options => await fillSpecialLevel(options, currentLevel()),
        levelFlags: flags => setLuaLevelFlags(currentLevel(), flags),
        message: value => {
            const messages = currentLevel().specialMessages ??= [];
            const originalAlignment = game.u?.ualignbase?.[0]
                ?? game.u?.ualign?.type ?? A_NONE;
            const godKey = originalAlignment > 0 ? 'lawful'
                : originalAlignment < 0 ? 'chaotic' : 'neutral';
            const deity = game.urole?.gods?.[godKey] || 'your god';
            messages.push(String(value).replaceAll('%d', deity));
        },
        map: async value => {
            const source = typeof value === 'string' ? value : value.map;
            if (source === undefined) throw new TypeError('des.map requires map text');
            // lspo_map() defaults to unlit in both forms, independently of
            // the lighting des.level_init() gave the underlying level.
            const lit = typeof value !== 'string' && !!value.lit;
            const rows = specialMapRows(source);
            const width = Math.max(...rows.map(row => row.length));
            const unplacedThemedMap = currentLevel().prototype === 'themerms'
                && typeof value !== 'string'
                && value.x == null && value.y == null
                && value.coord == null
                && value.halign == null && value.valign == null;
            let mapContext;
            if (unplacedThemedMap) {
                mapContext = placeThemedMap(rows, lit);
                if (!mapContext) {
                    roomFailed = true;
                    return new SpecialSelection();
                }
            } else {
                const origin = typeof value === 'string'
                    ? centeredSpecialMap(width, rows.length)
                    : mapOrigin(
                        value, width, rows.length, !!currentLevel().levelInitialized,
                    );
                mapContext = loadSpecialAsciiMap(rows, lit, origin);
            }
            const mapSelection = specialMapSelection(mapContext, rows);
            mappedCells = mappedCells.union(mapSelection);
            context = mapContext;
            currentLevel().context = context;
            if (typeof value !== 'string' && value.contents) {
                try {
                    await currentState().callValueAsync(value.contents, [
                        objectToLuaTable({
                            width: context.width, height: context.height,
                        }),
                    ]);
                } finally {
                    context = wholeLevel;
                    currentLevel().context = context;
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
                const loc = requireGameLevel().at(x, y);
                if (loc) loc.lit = lit;
            });
        },
        roomRegion: async options => {
            if (roomFailed) return null;
            const room = await createLuaRoomRegion(context, options);
            if (!room || !options.contents) return room;
            const parent = context;
            context = specialRoomContext(room);
            try {
                await currentState().callValueAsync(options.contents, [
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
                        await currentState().callValueAsync(options.contents, [
                            luaRoomTable(builtRoom),
                        ]);
                    } finally {
                        context = parent;
                    }
                } : null,
            );
            if (!room && currentLevel().prototype === 'themerms') roomFailed = true;
            context = parent;
            return room;
        },
        stair: async options => {
            const point = await createLuaStair(context, options);
            if (point) mappedCells.add(point.x, point.y);
        },
        ladder: options => {
            const up = options.direction === 'up';
            if (!options.point)
                throw new TypeError('des.ladder requires coordinates');
            specialLadderAt(
                context, options.point.x, options.point.y, up,
            );
            mappedCells.add(context.xstart + options.point.x, context.ystart + options.point.y);
        },
        door: options => {
            const point = createLuaDoor(context, options);
            if (point) mappedCells.add(point.x, point.y);
        },
        drawbridge: options => {
            const point = createLuaDrawbridge(context, options);
            mappedCells.add(point.x, point.y);
        },
        engraving: options => createLuaEngraving(context, options),
        gold: async options => await createLuaGold(context, options),
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
                currentLevel().upTeleportRegion = region;
                currentLevel().upTeleportExclude = exclude;
            } else if (options.dir === 'down') {
                currentLevel().downTeleportRegion = region;
                currentLevel().downTeleportExclude = exclude;
            } else {
                currentLevel().upTeleportRegion = { ...region };
                currentLevel().downTeleportRegion = { ...region };
                currentLevel().upTeleportExclude = exclude ? { ...exclude } : null;
                currentLevel().downTeleportExclude = exclude ? { ...exclude } : null;
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
                currentLevel().explicitUpStairRegion = value;
            else if (options.type === 'stair-down')
                currentLevel().explicitDownStairRegion = value;
            else if (options.type === 'branch') {
                currentLevel().explicitBranchRegion = region;
                currentLevel().explicitBranchExclude = exclude;
            }
            else if (options.type === 'portal') {
                currentLevel().explicitPortalRegion = region;
                currentLevel().explicitPortalExclude = exclude;
                if (options.name === undefined) delete currentLevel().portalDestinationName;
                else currentLevel().portalDestinationName = options.name;
            }
            else throw new Error(`unsupported Lua level region ${options.type}`);
        },
        exclusion: options => createLuaExclusion(context, options),
        gasCloud: options => createHarmlessGasCloudSelection(
            game, luaSelectionCoordinates(options.selection), { ttl: -1 },
        ),
        randomCorridors: async () => await makecorridors(),
        mineralize: options => mineralize(
            options.kelp_pool ?? -1, options.kelp_moat ?? -1,
            options.gold_prob ?? -1, options.gem_prob ?? -1, true,
        ),
        mazeWalk: async options => {
            const directions = ['north', 'south', 'east', 'west'] as const;
            const direction = options.dir === 'random'
                ? directions[rn2(directions.length)] : options.dir;
            if (options.x === undefined || options.y === undefined)
                throw new TypeError('des.mazewalk requires coordinates');
            if (direction !== 'north' && direction !== 'south'
                && direction !== 'east' && direction !== 'west')
                throw new TypeError(`Unknown maze direction: ${direction}`);
            const terrain = mapCharacterType(options.typ ?? '.');
            if (terrain === undefined) throw new TypeError('Unknown maze terrain');
            specialMazeWalk(context, options.x, options.y, direction, terrain);
            if (options.stocked)
                await fillEmptySpecialMaze(mappedCells);
        },
        object: async options => currentState().objects.wrap(await createLuaObject(
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
                && options.keep_default_invent !== true) {
                await dropSpecialMonsterObjects(monster);
                await discardMonsterInventory(monster, true);
            }
            if (options.inventory) {
                monsterInventories.push(monster);
                try {
                    await currentState().callValueAsync(options.inventory, []);
                } finally {
                    monsterInventories.pop();
                }
                if (monster) await initializeMonsterArmor(monster);
            }
            return monster;
        },
    };
    const selectionApi = createSelectionApi(
        () => context,
        (callable, args) => currentState().callValueAsync(callable, args),
    );
    const bindings: LuaBindings = {
        nh: {
            debug_themerm: () => null,
            is_genocided: name => {
                const target = String(name).toLowerCase();
                const mndx = MONSTER_NAME.findIndex(candidate =>
                    candidate?.toLowerCase() === target);
                return mndx >= 0
                    && !!((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GENOD);
            },
            level_difficulty: () => level_difficulty(),
            start_timer_at: (x, y, kind, timeout) => {
                const timerName = luaString(kind);
                if (timerName !== 'melt-ice' && timerName !== LEVEL_TIMER_KIND.MELT_ICE_AWAY)
                    throw new TypeError(`Unknown level timer: ${timerName}`);
                scheduleLevelTimer(
                    context.xstart + luaInteger(x),
                    context.ystart + luaInteger(y),
                    LEVEL_TIMER_KIND.MELT_ICE_AWAY,
                    (game.moves ?? 0) + luaInteger(timeout),
                    game,
                );
            },
        },
        des: createDesBindings(operations, selectionApi.wrap),
        selection: selectionApi.bindings,
    };
    return {
        bindings,
        beginLevel(nextActive: ActiveSpecialLevel, { special = true } = {}) {
            active = nextActive;
            context = wholeLevel;
            active.context = context;
            containers.length = 0;
            monsterInventories.length = 0;
            mappedCells = new SpecialSelection();
            roomFailed = false;
            currentLevel().allowFlips = 3;
            if (!special) return;
            requireGameLevel().flags.is_special = true;
            const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
            requireGameLevel().flags.temperature = currentDungeon?.flags?.hellish
                ? 1 : 0;
        },
        bindState(state: LuaGameState) {
            luaState = state;
            state.objects.toAbsolute = (x, y) => ({
                x: x + context.xstart, y: y + context.ystart,
            });
            currentLevel().align = luaTableToArray(state.getGlobal('align')).map(value => {
                if (value !== 'law' && value !== 'neutral' && value !== 'chaos')
                    throw new TypeError('Lua alignment must be law, neutral, or chaos');
                return value;
            });
        },
        beginRoom() {
            roomFailed = false;
            context = wholeLevel;
        },
        roomFailed() {
            return roomFailed;
        },
        async finishSpecialLevel() {
            removeSpecialLevelBoundaries(mappedCells);
            if (currentLevel().checkInaccessibles) await ensureWaysOut();
            await cleanupSpecialLevelMap();
            if (!requireGameLevel().flags.corrmaze)
                wallification(1, 0, COLNO - 1, ROWNO - 1);
            const allowedFlips = currentLevel().allowFlips;
            if (allowedFlips === undefined) throw new Error('Lua level flip flags are uninitialized');
            flipSpecialLevelRandom(allowedFlips);
            if (currentLevel().solidify) solidifyLuaMap(mappedCells);
            flipLuaRegions(currentLevel());
        },
    };
}

async function generateLuaSpecialLevel(active: ActiveSpecialLevel): Promise<void> {
    const session = createLuaLevelSession();
    session.beginLevel(active);
    await currentLuaLifecycle().executeSpecial(
        game, active.file, session.bindings,
        state => session.bindState(state),
    );
    await session.finishSpecialLevel();
}

type LuaLevelSession = ReturnType<typeof createLuaLevelSession>;
const themedLuaSessions = new WeakMap<LuaState, LuaLevelSession>();
const activeThemes = new WeakMap<GameState, { state: LuaState; session: LuaLevelSession }>();

async function beginLuaThemerooms(): Promise<void> {
    const lifecycle = currentLuaLifecycle();
    const dungeonNumber = game.u?.uz?.dnum ?? 0;
    let state = lifecycle.getThemedState(game, dungeonNumber);
    let session = state ? themedLuaSessions.get(state) : null;
    const active = { prototype: 'themerms', file: 'themerms.lua' };

    if (!session) {
        const createdSession = createLuaLevelSession();
        session = createdSession;
        createdSession.beginLevel(active, { special: false });
        state = await lifecycle.createThemedState(
            game, dungeonNumber, 'themerms.lua', createdSession.bindings,
            created => createdSession.bindState(created),
        );
        themedLuaSessions.set(state, session);
    } else {
        session.beginLevel(active, { special: false });
    }

    if (!state) throw new Error('Themed room initialization did not create a Lua state.');
    activeThemes.set(game, { state, session });
    await state.callValueAsync(state.getGlobal('pre_themerooms_generate'), []);
}

async function callLuaThemerooms(name: string, args: LuaValue[] = []): Promise<LuaValues> {
    const state = activeThemes.get(game)?.state;
    if (!state) throw new Error('themed rooms are not active');
    return state.callValueAsync(state.getGlobal(name), args);
}

async function specialRandomMonsterAt(context: SpecialLevelContext, x: number, y: number, {
    randomAlignment = true,
    peaceful = null,
    asleep = null,
    mmflags = 0,
    roamerAlignment = null,
}: SpecialMonsterOptions = {}): Promise<Monster | null> {
    const level = requireGameLevel();
    // A coordinate-only des.monster() resolves random alignment before
    // makemon(NULL, x, y).  Unlike a named species, it has no find_montype()
    // gender draw and unlike des.monster() without coordinates it performs no
    // get_location() sampling.
    if (randomAlignment) consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const absoluteX = context.xstart + x;
    const absoluteY = context.ystart + y;
    const occupied = level.monsters.some(monster => monsterHasMapPosition(monster, game) && monster.mhp > 0
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

export async function generateBigRoom(active: ActiveSpecialLevel): Promise<void> {
    if (active.variant === undefined || active.variant < 1 || active.variant > 13)
        throw new RangeError(`unknown Big Room variant ${active?.variant}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function removeFloorObject(object: GameObject | null): void {
    if (object?.where === 'floor') remove_object(object, game);
}

async function addToContainer(container: GameObject | null, object: GameObject | null): Promise<GameObject | null> {
    if (!container || !object) return object;
    removeFloorObject(object);
    return await addCreatedObjectToContainer(container, object, game);
}

function consumeSpecialMonsterAlignment(): void {
    inducedAlignment(80);
}

function namedMonsterNeedsGenderDraw(mndx: number): boolean {
    const flags = MONSTER_FLAGS2[mndx] || 0;
    // sp_lev.c:find_montype() suppresses the parser draw only for explicitly
    // male or female species.  A neuter species still resolves rn2(2), even
    // though makemon() later stores the neutral gender independently.
    return !(flags & (0x10000 | 0x20000));
}

function medusaPetrifiable(mndx: number | null | undefined): boolean {
    const resistance = mndx == null ? 0 : MONSTER_RESISTS[mndx] || 0;
    const stoneResistant = !!(resistance & 0x80);
    const changesToStoneGolem = mndx != null && MONSTER_SYMBOL[mndx] === 55 && mndx !== 257;
    return !stoneResistant && !changesToStoneGolem;
}

// C mk_trap_statue() and create_object(): direct extraction, not unwear_mon_obj.
async function putGeneratedMonsterInventoryInStatue(monster: Monster, statue: GameObject): Promise<void> {
    while (monster.minvent?.length) {
        const object = monster.minvent[0];
        if (!object) throw new Error('Monster inventory contains a missing object.');
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        object.wielded = false;
        unlinkMonsterObject(monster, object);
        await addObjectToContainer(statue, object, game);
    }
    statue.owt = objectWeight(statue);
}

async function medusaEmptyStatue(context: SpecialLevelContext, fixedPoint: Position | null = null): Promise<GameObject | null> {
    const level = requireGameLevel();
    const point = fixedPoint
        ? {
            x: context.xstart + fixedPoint.x,
            y: context.ystart + fixedPoint.y,
        }
        : await specialRandomLocation(context);
    if (!point) return null;
    const statue = await mksobj_at(STATUE, point.x, point.y, true, true);
    // `contents=0` removes any randomly initialized spellbook before the
    // Medusa petrified-monster special case creates the temporary actor.
    statue.contents = [];

    let mndx = statue.corpsenm ?? null;
    for (let attempt = 0; attempt < 1000; attempt++, mndx = rndmonnum()) {
        let monsterPoint = null;
        for (let locations = 0; locations < 100; locations++) {
            const x = rn2(COLNO - 3) + 2;
            const y = rn2(ROWNO);
            if (goodPosition(x, y, mndx == null ? null : { kind: 'species', mnum: mndx })) {
                monsterPoint = { x, y };
                break;
            }
        }
        if (!monsterPoint) continue;
        const was = await makemon(mndx, monsterPoint.x, monsterPoint.y,
            MM_NOCOUNTBIRTH | MM_NOMSG);
        if (!was) continue;
        level.monsters = level.monsters.filter(monster => monster !== was);
        if (!medusaPetrifiable(mndx)) continue;
        if (mndx === null) throw new Error('Medusa statue monster has no species.');
        propagateMonsterSpecies(mndx, true, false);
        statue.corpsenm = mndx;
        await putGeneratedMonsterInventoryInStatue(was, statue);
        break;
    }
    return statue;
}

function markSpecialSelectionWallProperty(selection: SpecialSelection, property: number): void {
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
            || loc.typ === IRONBARS))
            loc.wall_info |= property;
    });
}

async function generateElementalPlane(active: ActiveSpecialLevel): Promise<void> {
    active.file = `${active.prototype}.lua`;
    if (active.prototype === 'air' || active.prototype === 'water')
        active.elementalBubbles = true;
    if (active.prototype === 'water') requireGameLevel().flags.waterlevel = true;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

export async function generateEarthLevel(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'earth')
        throw new RangeError(`unknown earth level ${active?.prototype}`);
    await generateElementalPlane(active);
}

export async function generateWaterLevel(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'water')
        throw new RangeError(`unknown water level ${active?.prototype}`);
    await generateElementalPlane(active);
}

export async function generateAstralLevel(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'astral')
        throw new RangeError(`unknown Astral level ${active?.prototype}`);
    active.file = 'astral.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function specialMapSelection(context: SpecialLevelContext, rows: readonly string[] | null = null): SpecialSelection {
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

function lightSpecialArea(context: SpecialLevelContext, x1: number, y1: number, x2: number, y2: number, lit: boolean): void {
    const level = requireGameLevel();
    // sp_lev.c:light_region() includes surrounding walls only when lit.
    const halo = lit ? 1 : 0;
    const lx = Math.max(1, context.xstart + x1 - halo);
    const hx = Math.min(COLNO - 1, context.xstart + x2 + halo);
    const ly = Math.max(0, context.ystart + y1 - halo);
    const hy = Math.min(ROWNO - 1, context.ystart + y2 + halo);
    for (let x = lx; x <= hx; x++) {
        for (let y = ly; y <= hy; y++) {
            const loc = level.at(x, y);
            if (loc) loc.lit = lit || IS_LAVA(loc.typ);
        }
    }
}

function fillSpecialSolid(filling = STONE, lit = false): void {
    const level = requireGameLevel();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.at(x, y);
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

function fillSpecialSwamp(fg = ROOM, bg = MOAT, lit = false): void {
    const level = requireGameLevel();
    // sp_lev.c:lvlfill_swamp().  First establish the full moat background,
    // then run the x-major relaxed blockwise maze over even coordinates.
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    for (let x = 2; x <= mazeXMax; x++) {
        for (let y = 0; y <= mazeYMax; y++) {
            const loc = level.at(x, y);
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
            const east = level.at(x + 1, y);
            const south = level.at(x, y + 1);
            const diagonal = level.at(x + 1, y + 1);
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

async function generateWizardLevel(active: ActiveSpecialLevel): Promise<void> {
    const level = requireGameLevel();
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room)) await fillSpecialRoom(room);
}

export async function generateWizard3Level(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'wizard3')
        throw new RangeError(`unknown Wizard level ${active?.prototype}`);
    await generateWizardLevel(active);
}

export async function generateFakeWizardLevel(active: ActiveSpecialLevel): Promise<void> {
    if (!['fakewiz1', 'fakewiz2'].includes(active?.prototype)) {
        throw new RangeError(`unknown false Wizard level ${active?.prototype}`);
    }
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function makeSpecialDrawbridge(context: SpecialLevelContext, x: number, y: number, direction: number, open = false): void {
    const level = requireGameLevel();
    const bridgeX = context.xstart + x;
    const bridgeY = context.ystart + y;
    const bridge = level.at(bridgeX, bridgeY);
    if (!bridge) return;
    const under = bridge.typ === LAVAPOOL ? DB_LAVA : DB_MOAT;
    const offsets = new Map<number, Position>([
        [DB_NORTH, { x: 0, y: -1 }], [DB_SOUTH, { x: 0, y: 1 }],
        [DB_EAST, { x: 1, y: 0 }], [DB_WEST, { x: -1, y: 0 }],
    ]);
    const offset = offsets.get(direction);
    if (!offset) throw new RangeError(`Invalid drawbridge direction ${direction}`);
    bridge.typ = open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    bridge.horizontal = direction === DB_EAST || direction === DB_WEST;
    bridge.drawbridgemask = direction | under;
    const wall = level.at(bridgeX + offset.x, bridgeY + offset.y);
    if (wall) {
        wall.typ = open ? DOOR : DBWALL;
        if (open) wall.doormask = D_NODOOR;
        wall.horizontal = direction === DB_NORTH || direction === DB_SOUTH;
        if (!open) wall.wall_info |= W_NONDIGGABLE;
    }
}

export async function generateHellFillerLevel(active: ActiveSpecialLevel): Promise<void> {
    const level = requireGameLevel();
    if (active?.prototype !== 'hellfill')
        throw new RangeError(`unknown Hell filler ${active?.prototype}`);
    active.file = 'hellfill.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room)) await fillSpecialRoom(room);
}

function flipSpecialRegion(region: StairRegion | undefined): StairRegion | undefined {
    const flip = requireGameLevel()._flip;
    if (!region || !flip) return region;
    let { lx, ly, hx, hy } = region;
    if (flip.flp & 2) [lx, hx] = [flip.maxx - hx + flip.minx,
        flip.maxx - lx + flip.minx];
    if (flip.flp & 1) [ly, hy] = [flip.maxy - hy + flip.miny,
        flip.maxy - ly + flip.miny];
    const result = { ...region, lx, ly, hx, hy };
    if (region.nlx != null) {
        let { nlx, nly, nhx, nhy } = region;
        if (nly === undefined || nhx === undefined || nhy === undefined)
            throw new Error('Flipped stair region has an incomplete exclusion rectangle.');
        if (flip.flp & 2) [nlx, nhx] = [
            flip.maxx - nhx + flip.minx,
            flip.maxx - nlx + flip.minx,
        ];
        if (flip.flp & 1) [nly, nhy] = [
            flip.maxy - nhy + flip.miny,
            flip.maxy - nly + flip.miny,
        ];
        result.nlx = nlx;
        result.nly = nly;
        result.nhx = nhx;
        result.nhy = nhy;
    }
    return result;
}

export async function generateMedusaLevel(active: ActiveSpecialLevel): Promise<void> {
    if (active.variant === undefined || active.variant < 1 || active.variant > 4) {
        throw new RangeError(`unknown Medusa variant ${active?.variant}`);
    }
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}

function medusaRoomPoint(room: Room): Position {
    return {
        x: room.lx + rn2(room.hx - room.lx + 1),
        y: room.ly + rn2(room.hy - room.ly + 1),
    };
}

async function fixupMedusa(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'medusa') return;
    const level = requireGameLevel();
    const room = level.rooms[0];
    if (!isRoom(room)) return;
    for (let count = rnd(4); count > 0; count--) {
        const point = medusaRoomPoint(room);
        const loc = level.at(point.x, point.y);
        if (!loc || !SPACE_POS(loc.typ)) continue;
        const statue = await createToptenObject(STATUE, point.x, point.y);
        for (let tries = 0; tries < 99
            && !medusaPetrifiable(statue.corpsenm); tries++)
            set_corpsenm(statue, rndmonnum());
    }
    const topTen = !!rn2(2);
    const point = medusaRoomPoint(room);
    const statue = topTen
        ? await createToptenObject(STATUE, point.x, point.y)
        : await createCorpstatAt(STATUE, null, null, point.x, point.y, 0);
    for (let tries = 0; tries < 99
        && statue && !medusaPetrifiable(statue.corpsenm); tries++)
        set_corpsenm(statue, rndmonnum());
}


async function fixupBaalz(active: ActiveSpecialLevel): Promise<void> {
    const level = requireGameLevel();
    // mkmaze.c:baalz_fixup().  Corrmaze suppresses ordinary wallification so
    // the nondiggable perimeter can define the protected beetle interior.
    let lastx = 0;
    const inarea = { x1: 0, y1: 0, x2: 0, y2: 0 };
    const middleY = Math.trunc(ROWNO / 2);
    let scanX;
    for (scanX = 0; scanX < COLNO; scanX++) {
        if (((level.at(scanX, middleY)?.wall_info ?? 0)
            & W_NONDIGGABLE) !== 0) {
            if (!lastx) inarea.x1 = scanX + 1;
            lastx = scanX;
        }
    }
    inarea.x2 = (lastx > inarea.x1 ? lastx : scanX) - 1;

    let lasty = 0;
    let scanY;
    for (scanY = 0; scanY < ROWNO; scanY++) {
        if (((level.at(inarea.x1, scanY)?.wall_info ?? 0)
            & W_NONDIGGABLE) !== 0) {
            if (!lasty) inarea.y1 = scanY + 1;
            lasty = scanY;
        }
    }
    inarea.y2 = (lasty > inarea.y1 ? lasty : scanY) - 1;

    const poolMarkers: Position[] = [];
    for (let x = inarea.x1; x <= inarea.x2; x++) {
        for (let y = inarea.y1; y <= inarea.y2; y++) {
            const loc = level.at(x, y);
            if (loc?.typ === POOL) {
                loc.typ = HWALL;
                loc.horizontal = true;
                poolMarkers.push({ x, y });
            } else if (loc?.typ === IRONBARS) {
                if (((level.at(x - 1, y)?.wall_info ?? 0)
                    & W_NONDIGGABLE) !== 0) {
                    level.requireAt(x - 1, y).wall_info &= ~W_NONDIGGABLE;
                    if (isok(x - 2, y))
                        level.requireAt(x - 2, y).wall_info &= ~W_NONDIGGABLE;
                } else if (((level.at(x + 1, y)?.wall_info ?? 0)
                    & W_NONDIGGABLE) !== 0) {
                    level.requireAt(x + 1, y).wall_info &= ~W_NONDIGGABLE;
                    if (isok(x + 2, y))
                        level.requireAt(x + 2, y).wall_info &= ~W_NONDIGGABLE;
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

    const repairMarker = async (
        marker: Position | undefined, verticalDelta: number, jointType: number, upper: boolean,
    ): Promise<void> => {
        if (!marker) return;
        const loc = level.at(marker.x, marker.y);
        const joint = level.at(
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
        const monster = monsterAtPosition(level, marker.x, marker.y);
        if (monster) await randomMonsterRelocation(monster, { flags: RLOC_ERR | RLOC_NOMSG });
    };
    await repairMarker(poolMarkers[0], 1, TUWALL, true);
    await repairMarker(poolMarkers[1], -1, TDWALL, false);

    active.baalzFixupArea = { ...inarea };
    active.baalzPoolMarkers = poolMarkers.map(
        marker => ({ ...marker }),
    );
}

// C ref: mkmaze.c fixup_special() LR_PORTAL case.  Named Lua portals are
// level regions rather than dungeon branches: after every script operation
// has completed, place_lregion() samples the declared area, rejects its
// exclusion rectangle and occupied terrain, then installs a magic portal
// whose destination is the named special level.
async function fixupSpecialPortal(active: ActiveSpecialLevel): Promise<void> {
    const region = active?.explicitPortalRegion;
    if (!region) return;
    const exclude = active.explicitPortalExclude || {
        lx: -1, ly: -1, hx: -1, hy: -1,
    };
    const lx = Math.max(1, region.lx);
    const hx = Math.min(COLNO - 1, region.hx);
    const ly = Math.max(0, region.ly);
    const hy = Math.min(ROWNO - 1, region.hy);
    const destination = active.portalDestinationName
        ? game.specialLevels?.get(active.portalDestinationName) : undefined;
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
    if (!portal) throw new Error('Special-level portal could not be created.');
    portal.dst = { ...destination };
}

function fixupSpecialStair(active: ActiveSpecialLevel): void {
    // Preserve Lua declaration order for the common paired regions: Juiblex
    // declares its down stair before its up stair.
    for (const [field, type] of [
        ['explicitDownStairRegion', LR_DOWNSTAIR],
        ['explicitUpStairRegion', LR_UPSTAIR],
    ] as const) {
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
async function fixupSpecialBranch(active: ActiveSpecialLevel): Promise<void> {
    if (game.made_branch) return;
    const branch = is_branchlev();

    if (active?.explicitBranchRegion) {
        const region = active.explicitBranchRegion;
        const exclude = active.explicitBranchExclude
            || { lx: -1, ly: -1, hx: -1, hy: -1 };
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

async function generateSpecialAndFixup(
    generator: (active: ActiveSpecialLevel) => Promise<void>, active: ActiveSpecialLevel,
): Promise<void> {
    await generator(active);
    const level = requireGameLevel();
    const arrivalRegion = (
        region: StairRegion | null | undefined, exclude: Rectangle | null | undefined,
    ): ArrivalRegion | null => {
        if (!region) return null;
        let embeddedExclude: Rectangle | null = null;
        if (region.nlx !== undefined && Number.isInteger(region.nlx)) {
            if (region.nly === undefined || region.nhx === undefined || region.nhy === undefined)
                throw new Error('Arrival region has an incomplete exclusion rectangle.');
            embeddedExclude = { lx: region.nlx, ly: region.nly, hx: region.nhx, hy: region.nhy };
        }
        const exclusion = exclude || embeddedExclude;
        return {
            ...region,
            ...(exclusion ? { exclude: { ...exclusion } } : {}),
        };
    };
    level.upTeleportRegion = arrivalRegion(
        active?.upTeleportRegion, active?.upTeleportExclude,
    );
    level.downTeleportRegion = arrivalRegion(
        active?.downTeleportRegion, active?.downTeleportExclude,
    );
    // mkmaze.c:fixup_special() must allocate and initially paint Air/Water
    // bubbles before named portals and arrival regions are materialized.
    if (active?.elementalBubbles) await setupElementalBubbles();
    await fixupSpecialPortal(active);
    fixupSpecialStair(active);
    await fixupSpecialBranch(active);
    if (active?.baalzFixup) await fixupBaalz(active);
    // sp_lev.c explicitly places deferred portals, stairs, and branches
    // before premap_detect(); otherwise their remembered glyphs retain the
    // underlying terrain even though the live level cell was updated.
    if (active?.premapped) premap_detect();
    await fixupMedusa(active);
}

async function generateSokobanLevel(active: ActiveSpecialLevel): Promise<void> {
    if (!/^soko[1-4]$/.test(active?.prototype)
        || active.variant === undefined || active.variant < 1 || active.variant > 2) {
        throw new RangeError(
            `unknown Sokoban level ${active?.prototype}-${active?.variant}`,
        );
    }
    active.file = `${active.prototype}-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room)) await fillSpecialRoom(room);
}

export async function generateSokobanLevel2(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'soko2') {
        throw new RangeError(`unknown Sokoban level 2 ${active?.prototype}`);
    }
    await generateSokobanLevel(active);
}

function fillSpecialMazeGrid(filling = HWALL): void {
    const level = requireGameLevel();
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    for (let x = 2; x <= mazeXMax; x++) {
        for (let y = 0; y <= mazeYMax; y++) {
            const loc = level.at(x, y);
            if (loc) {
                loc.typ = level.flags.corrmaze
                    ? STONE
                    : (y < 2 || ((x % 2) && (y % 2)))
                        ? STONE : filling;
            }
        }
    }
}

export async function generateKnoxLevel(active: ActiveSpecialLevel): Promise<void> {
    if (active?.prototype !== 'knox')
        throw new RangeError(`unknown Knox level ${active?.prototype}`);
    active.file = 'knox.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room)) await fillSpecialRoom(room);
}

// C mkmaze.c:makemaz("") with no dungeon prototype or fill script.
export async function generateRandomMaze(): Promise<void> {
    const level = requireGameLevel();
    level.flags.is_maze_lev = true;
    level.flags.corrmaze = rn2(3) === 0;
    const invocation = Invocation_lev(game.u.uz);
    if (!invocation && rn2(2)) createMaze(-1, -1, rn2(5) === 0);
    else createMaze(1, 1, false);
    if (!level.flags.corrmaze)
        wallification(2, 2, (COLNO - 1) & ~1, (ROWNO - 1) & ~1);

    const up = mazeFloorPoint();
    mkstairs(up.x, up.y, true, null);
    if (invocation) {
        const square = vibratingSquarePoint();
        await maketrap(square.x, square.y, VIBRATING_SQUARE);
    } else {
        const down = mazeFloorPoint();
        mkstairs(down.x, down.y, false, null);
    }
    await place_branch(is_branchlev());
    await populateRandomMaze();
}

// C mazexy(): generated maze cargo uses ROOM or CORR of the selected
// style, rather than any accessible terrain or the former odd-cell grid.
function mazeFloorPoint(): Position {
    const level = requireGameLevel();
    const maxX = (COLNO - 1) & ~1;
    const maxY = (ROWNO - 1) & ~1;
    const terrain = level.flags.corrmaze ? CORR : ROOM;
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = rnd(maxX);
        const y = rnd(maxY);
        if (level.requireAt(x, y).typ === terrain) return { x, y };
    }
    for (let x = 1; x <= maxX; x++) {
        for (let y = 1; y <= maxY; y++) {
            if (level.requireAt(x, y).typ === terrain) return { x, y };
        }
    }
    throw new Error('mazexy: no generated maze passage is available');
}

function vibratingSquarePoint(): Position {
    const level = requireGameLevel();
    const minimum = 2, xMargin = 4, yMargin = 3;
    const xRange = ((COLNO - 1) & ~1) - minimum - 2 * xMargin - 1;
    const yRange = ((ROWNO - 1) & ~1) - minimum - 2 * yMargin - 1;
    const up = stairway_find_dir(true);
    let point;
    for (let attempt = 0; attempt <= 1000; attempt++) {
        point = {
            x: rn1(xRange, minimum + xMargin + 1),
            y: rn1(yRange, minimum + yMargin + 1),
        };
        if (attempt === 1000 || !up) break;
        const dx = Math.abs(point.x - up.sx);
        const dy = Math.abs(point.y - up.sy);
        if (dx && dy && dx !== dy && Math.max(dx, dy) > 11
            && SPACE_POS(level.requireAt(point.x, point.y).typ)
            && !occupied(point.x, point.y)) break;
    }
    if (!point) throw new Error('Vibrating square placement did not choose a position.');
    return point;
}

async function populateRandomMaze(): Promise<void> {
    for (let count = rn1(8, 11); count > 0; count--) {
        const point = mazeFloorPoint();
        await mkobj_at(rn2(2) ? GEM_CLASS : RANDOM_CLASS,
            point.x, point.y, true);
    }
    for (let count = rn1(10, 2); count > 0; count--) {
        const point = mazeFloorPoint();
        await mksobj_at(BOULDER, point.x, point.y, true, false);
    }
    for (let count = rn2(3); count > 0; count--) {
        const point = mazeFloorPoint();
        await makemon(PM_MINOTAUR, point.x, point.y, 0);
    }
    for (let count = rn1(5, 7); count > 0; count--) {
        const point = mazeFloorPoint();
        await makemon(null, point.x, point.y, 0);
    }
    for (let count = rn1(6, 7); count > 0; count--) {
        const point = mazeFloorPoint();
        await mkgold(0, point.x, point.y);
    }
    for (let count = rn1(6, 7); count > 0; count--)
        await mktrap(NO_TRAP, {}, null, null);
}

async function generateDungeonMazeFile(prototype: string): Promise<void> {
    const active: ActiveSpecialLevel = { prototype, file: `${prototype}.lua` };
    if (!LUA_SOURCES[active.file]) {
        await impossible(`Couldn't load "${active.file}" - making a maze.`);
        await generateRandomMaze();
        return;
    }
    game._activeSpecialLevel = active;
    if (prototype === 'minefill') await generateMineFiller(active);
    else if (prototype === 'hellfill') await generateHellFillerLevel(active);
    else if (isLuaQuestPrototype(prototype)) await generateLuaQuestLevel(active);
    else {
        await generateSpecialAndFixup(generateLuaSpecialLevel, active);
        const level = requireGameLevel();
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room)) await fillSpecialRoom(room);
    }
}

// C ref: mklev.c makelevel()
async function makelevel(): Promise<void> {
    const g = game;
    oinit();
    clear_level_structures();
    const level = requireGameLevel();
    const location = g.u.uz;
    if (!location) throw new Error('Level generation requires the hero dungeon location.');
    // dungeon.lua supplies Rogue through the named-level descriptor.  The JS
    // dungeon loader does not yet materialize C's global rogue_level d_level,
    // so bind that canonical identity when the descriptor reaches makelevel.
    const requestedRogue = g._specialLevelPrototype === 'rogue';
    if (requestedRogue)
        g.rogue_level = { dnum: location.dnum, dlevel: location.dlevel };
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
        const align: NonNullable<ActiveSpecialLevel['align']> = ['law', 'neutral', 'chaos'];
        if (!luaOwnedSpecial) {
            for (let i = align.length; i > 1; i--) {
                const j = rn2(i);
                const oldAlignment = align[i - 1], selectedAlignment = align[j];
                if (oldAlignment === undefined || selectedAlignment === undefined)
                    throw new RangeError('Special-level alignment shuffle index is out of range.');
                align[i - 1] = selectedAlignment;
                align[j] = oldAlignment;
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
        };
        g._specialLevelPrototype = null;

        if (prototype === 'castle') {
            await generateSpecialAndFixup(generateLuaSpecialLevel,
                g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room)) await fillSpecialRoom(room);
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
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room)) await fillSpecialRoom(room);
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
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room)) await fillSpecialRoom(room);
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
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room)) await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'sanctum') {
            await generateSpecialAndFixup(generateLuaSpecialLevel,
                g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room)) await fillSpecialRoom(room);
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
    if (currentDungeon?.protofile) {
        const prototype = currentDungeon.protofile
            + (currentDungeon.num_dunlevs > 1 ? location.dlevel : '');
        await generateDungeonMazeFile(prototype);
        return;
    }
    if (currentDungeon?.levelFill) {
        await generateDungeonMazeFile(currentDungeon.levelFill);
        return;
    }
    if (currentDungeon?.dname === 'The Quest') {
        const role = g.urole?.filecode;
        const locate = role ? g.specialLevels?.get(`${role}-loca`) : undefined;
        if (!role || !locate) throw new Error('Quest generation requires the role and locate level.');
        const suffix = location.dlevel < locate.dlevel ? 'a' : 'b';
        await generateDungeonMazeFile(`${role}-fil${suffix}`);
        return;
    }

    // C mklev.c consumes this rn2(5) on every non-hellish regular candidate,
    // including levels outside Medusa's dungeon or above her level.
    const medusa = g.medusa_level;
    if (In_hell(location)
        || (rn2(5) && location.dnum === medusa?.dnum
            && depth_of_level(location) > depth_of_level(medusa))) {
        await generateRandomMaze();
        return;
    }

    // C ref: mklev.c makelevel() -> extralev.c.  Rogue owns a legacy 3x3
    // room/intersection graph and deliberately skips themed rooms, ordinary
    // corridors, niches, vaults, and random special-room selection.
    if (isRogueLevel) {
        level.flags.is_rogue_level = true;
        level.flags.rogue_level = true;
        await makeroguerooms();
        await makerogueghost();
        if (level.nroom <= 0) return;
        sort_rooms();
        await generate_stairs();

        const branchp = is_branchlev();
        if (branchp) await place_branch(branchp);

        for (const croom of level.rooms.slice(0, level.nroom))
            if (isRoom(croom)) await fill_ordinary_room(croom, false);
        for (const croom of level.rooms.slice(0, level.nroom))
            if (isRoom(croom)) await fillSpecialRoom(croom);
        return;
    }

    // Regular level generation
    await beginLuaThemerooms();
    await makerooms();

    if (level.nroom <= 0) return;
    sort_rooms();
    await generate_stairs();

    // Branch check
    const branchp = is_branchlev();
    let roomThreshold = branchp ? 4 : 3;

    await makecorridors();
    await make_niches();

    // Vault creation (simplified for contest)
    if (g.vault_x !== undefined && g.vault_x !== -1) {
        if (g.vault_y === undefined) throw new Error('Vault reservation has no y coordinate.');
        const vw = { v: 1 }, vh = { v: 1 };
        const vx = { v: g.vault_x }, vy = { v: g.vault_y };
        const finishVault = async () => {
            add_room(vx.v, vy.v, vx.v + vw.v, vy.v + vh.v, true, VAULT, false);
            level.flags.has_vault = true;
            roomThreshold++;
            const vaultRoom = level.rooms[level.nroom - 1];
            if (isRoom(vaultRoom)) {
                vaultRoom.needfill = FILL_NORMAL;
                await fillVault(vaultRoom);
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
                const candidate = level.rooms[level.nroom];
                vx.v = g.vault_x = candidate?.lx ?? -1;
                vy.v = g.vault_y = candidate?.ly ?? -1;
                if (check_room(vx, vw, vy, vh, true)) await finishVault();
                else if (candidate) level.rooms[level.nroom] = { ...candidate, hx: -1 };
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
    const fillableRooms = level.rooms
        .slice(0, level.nroom)
        .filter((room): room is Room => isRoom(room)
            && (room.rtype === OROOM || room.rtype === THEMEROOM)
            && room.needfill === FILL_NORMAL);
    let bonusItemRoomCountdown = fillableRooms.length
        ? rn2(fillableRooms.length) : -1;
    for (const croom of level.rooms.slice(0, level.nroom)) {
        if (!isRoom(croom)) continue;
        const fillable = (croom.rtype === OROOM || croom.rtype === THEMEROOM)
            && croom.needfill === FILL_NORMAL;
        await fill_ordinary_room(croom,
            fillable && bonusItemRoomCountdown === 0);
        if (fillable) bonusItemRoomCountdown--;
    }

    // C defers all special-room stocking until ordinary rooms are filled.
    // Room order matters: this level's shop is stocked before the vault's
    // second fill pass, and both precede mineralization.
    for (const croom of level.rooms.slice(0, level.nroom))
        if (isRoom(croom)) await fillSpecialRoom(croom);

    await callLuaThemerooms('post_level_generate');
    // A loaded theme interpreter always wallifies the complete level, not
    // only rooms created from des.map().  Dynamic terrain callbacks such as
    // "Pillars" rely on this pass for their internal wall spines.
    wallification(1, 0, COLNO - 1, ROWNO - 1);
}

// C ref: mklev.c mk_knox_portal().  Fort Ludios starts with an out-of-range
// source dnum.  Each otherwise eligible vault owns one deferral draw until a
// deep main-dungeon vault resolves that source; subsequent vaults skip it.
async function maybePlaceKnoxPortal(x: number, y: number): Promise<boolean> {
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

function roomHasStair(croom: Room, up: boolean): boolean {
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
function invalidShopShape(croom: Room): boolean {
    const level = requireGameLevel();
    const door = level.doors[croom.fdoor];
    if (!door) return true;
    let inside = null;
    let insideCount = 0;
    for (let x = Math.max(door.x - 1, croom.lx);
        x <= Math.min(door.x + 1, croom.hx); x++) {
        for (let y = Math.max(door.y - 1, croom.ly);
            y <= Math.min(door.y + 1, croom.hy); y++) {
            if (level.at(x, y)?.typ === ROOM) {
                inside = { x, y };
                insideCount++;
            }
        }
    }
    if (insideCount < 1 || !inside) return true;
    if (insideCount > 1) return false;

    let exits = 0;
    for (let x = Math.max(inside.x - 1, croom.lx);
        x <= Math.min(inside.x + 1, croom.hx); x++) {
        for (let y = Math.max(inside.y - 1, croom.ly);
            y <= Math.min(inside.y + 1, croom.hy); y++) {
            if (x === inside.x && y === inside.y) continue;
            if (level.at(x, y)?.typ === ROOM) exits++;
        }
    }
    return exits === 1;
}

function mkshop(): boolean {
    const level = requireGameLevel();
    const rooms = level.rooms.slice(0, level.nroom);
    const sroom = rooms.find((room): room is Room => isRoom(room) && room.rtype === OROOM
        && !roomHasStair(room, false)
        && !roomHasStair(room, true)
        && room.doorct === 1
        && !invalidShopShape(room));
    if (!sroom) return false;

    if (!sroom.rlit) {
        for (let x = sroom.lx - 1; x <= sroom.hx + 1; x++)
            for (let y = sroom.ly - 1; y <= sroom.hy + 1; y++) {
                const loc = level.at(x, y);
                if (loc) loc.lit = true;
            }
        sroom.rlit = 1;
    }

    let roll = rnd(100);
    let shopIndex = 0;
    while (shopIndex < RANDOM_SHOP_TYPES.length - 1) {
        const shop = RANDOM_SHOP_TYPES[shopIndex];
        if (!shop) throw new Error(`Missing random shop definition ${shopIndex}`);
        if ((roll -= shop.probability) <= 0) break;
        shopIndex++;
    }
    const area = (sroom.hx - sroom.lx + 1) * (sroom.hy - sroom.ly + 1);
    const shop = RANDOM_SHOP_TYPES[shopIndex];
    if (!shop) throw new Error(`Missing random shop definition ${shopIndex}`);
    const symbol = shop.symbol;
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
function pickSpecialRoom(strict: boolean): Room | null {
    const rooms = game.level?.rooms?.slice(0, game.level.nroom) ?? [];
    if (!rooms.length) return null;
    let index = rn2(rooms.length);
    for (let remaining = rooms.length; remaining > 0; remaining--) {
        const room = rooms[index];
        index = (index + 1) % rooms.length;
        if (!isRoom(room) || room.hx < 0) return null;
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

// C ref: mkroom.c shrine_pos().  Even-width or even-height interiors have
// two central squares, and each such axis owns one independent tie-breaker.
function shrinePosition(room: Room): Position {
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
async function makeRandomTemple(room: Room): Promise<boolean> {
    const level = requireGameLevel();
    room.rtype = TEMPLE;
    room.needfill = FILL_NORMAL;

    const shrine = shrinePosition(room);
    const altar = level.at(shrine.x, shrine.y);
    if (!altar) return false;
    altar.typ = ALTAR;
    const alignment = inducedAlignment(80);
    altar.flags = Align2amask(alignment);
    await specialShrinePriest(
        room, shrine.x, shrine.y, alignment,
    );
    altar.flags |= AM_SHRINE;
    level.flags.has_temple = true;
    return true;
}

async function markRandomSpecialRoom(roomType: number): Promise<boolean> {
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
async function maybeMakeSpecialRoom(roomThreshold: number): Promise<boolean> {
    const uDepth = depth_of_level(game.u?.uz);
    const medusaDepth = depth_of_level(game.medusa_level);
    if (uDepth > 1 && uDepth < medusaDepth
        && requireGameLevel().nroom >= roomThreshold && rn2(uDepth) < 3)
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

interface ShopDoor extends Position {
    doorIndex: number;
    door: Position;
}

function goodShopDoor(sroom: Room): ShopDoor | null {
    const level = requireGameLevel();
    for (let i = 0; i < sroom.doorct; i++) {
        const doorIndex = sroom.fdoor + i;
        const door = level.doors[doorIndex];
        if (!door) continue;
        let { x, y } = door;
        if (sroom.irregular) {
            const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
            const candidates: Position[] = [
                { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 },
            ];
            const inside = candidates.find(({ x: cx, y: cy }) => {
                const loc = level.at(cx, cy);
                return loc && !loc.edge && loc.roomno === roomno;
            });
            if (!inside) continue;
            x = inside.x;
            y = inside.y;
        } else if (x === sroom.lx - 1) x++;
        else if (x === sroom.hx + 1) x--;
        else if (y === sroom.ly - 1) y++;
        else if (y === sroom.hy + 1) y--;
        else continue;
        return { doorIndex, door, x, y };
    }
    return null;
}

function stockRoomGoodPos(sroom: Room, shopDoor: ShopDoor, x: number, y: number): boolean {
    const loc = requireGameLevel().at(x, y);
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

export function recorderLocalEpochSeconds(datetime: string | null | undefined): number {
    if (!datetime || !/^\d{14}$/.test(datetime)) return 0;
    const values = [
        Number(datetime.slice(0, 4)), Number(datetime.slice(4, 6)),
        Number(datetime.slice(6, 8)), Number(datetime.slice(8, 10)),
        Number(datetime.slice(10, 12)), Number(datetime.slice(12, 14)),
    ] as const;
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
    const currentParts = new Map<string, number>(
        formatter.formatToParts(new Date(currentEpoch))
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)]),
    );
    const part = (name: string): number => {
        const value = currentParts.get(name);
        if (value === undefined) throw new Error(`Local time formatter omitted ${name}`);
        return value;
    };
    const currentLocalProjection = Date.UTC(
        part('year'), part('month') - 1, part('day'),
        part('hour'), part('minute'), part('second'),
    );
    const inheritedOffset = currentLocalProjection - currentEpoch;
    return Math.trunc((target - inheritedOffset) / 1000);
}

// C shknam.c:nameshk(). Store the prefixed identity; presentation strips it.
function assignShopkeeperIdentity(monster: Monster, shopIndex: number): void {
    const level = requireGameLevel();
    const shop = SHOP_TYPES[shopIndex];
    const candleShop = SHOP_TYPES[11], toolShop = SHOP_TYPES[8], generalShop = SHOP_TYPES[0];
    if (!shop || !candleShop || !toolShop || !generalShop)
        throw new Error(`Missing shop naming definition ${shopIndex}`);
    const shopkeeper = monster.eshk;
    if (!shopkeeper) throw new Error('Shopkeeper identity requires the shop extension.');
    let names: readonly string[] = shop.names;
    let selected: string | undefined;
    if (names === candleShop.names && In_mines(game.u.uz)
        && level.flags.has_town) {
        selected = '+Izchak';
        monster.female = false;
    } else {
        const birthSeed = Math.trunc((game.ubirthday ?? 0) / 257) | 0;
        let wanted = (monster.m_id | 0) + ledgerNo(game.u.uz)
            + (birthSeed % 13) - (birthSeed % 5);
        if (wanted < 0) wanted += 18;
        monster.female = !!(wanted & 1);
        wanted %= names.length;
        for (let attempt = 0; attempt < 50; attempt++) {
            if (names === toolShop.names) {
                selected = names[rn2(names.length)];
                monster.female = false;
            } else if (wanted < names.length) {
                selected = names[wanted];
            } else {
                const index = rn2(names.length);
                if (index) selected = names[index - 1];
                else if (names !== generalShop.names) {
                    names = generalShop.names;
                    continue;
                } else {
                    selected = monster.female ? '-Lucrezia' : '+Dirk';
                }
            }
            if (selected === undefined) throw new Error('Shopkeeper name selection is out of range.');
            if (selected[0] === '_' || selected[0] === '-') monster.female = true;
            else if (selected[0] === '|' || selected[0] === '+') monster.female = false;
            const taken = level.monsters.some(other => other !== monster
                && other.mhp > 0 && other.isshk && other.eshk?.shknam === selected);
            if (!taken) break;
            wanted = names.length;
        }
    }
    if (selected === undefined) throw new Error('Shopkeeper name selection did not choose a name.');
    shopkeeper.shknam = selected.slice(0, PL_NSIZ - 1);
}

function getShopItem(shopIndex: number): number {
    const table = SHOP_TYPES[shopIndex]?.items;
    if (!table) throw new Error(`Missing shop stock definition ${shopIndex}`);
    let roll = rnd(100);
    for (const [probability, itemType] of table) {
        if (probability === undefined || itemType === undefined)
            throw new Error(`Incomplete shop stock entry for shop ${shopIndex}`);
        roll -= probability;
        if (roll <= 0) return itemType;
    }
    const lastType = table.at(-1)?.[1];
    if (lastType === undefined) throw new Error(`Shop ${shopIndex} has no stock entries.`);
    return lastType;
}

// C ref: shknam.c shkveg()/mkveggy_at().  Corpses and tins use a vegetarian
// lichen stand-in while selecting an object type; actual tin contents are
// repaired after normal mksobj initialization.
async function mkveggy_at(x: number, y: number): Promise<GameObject> {
    const eligible: number[] = [];
    let totalProbability = 0;
    const first = OBJECT_BASES[FOOD_CLASS];
    const afterFood = OBJECT_BASES[FOOD_CLASS + 1];
    if (first === undefined || afterFood === undefined)
        throw new Error('Food class boundaries are missing.');
    const last = afterFood - 1;
    for (let otyp = first; otyp <= last; otyp++) {
        if (OBJECT_MATERIAL[otyp] !== 3 // VEGGY
            && otyp !== EGG && otyp !== TIN && otyp !== CORPSE) continue;
        eligible.push(otyp);
        const probability = OBJECT_PROB[otyp];
        if (probability === undefined) throw new Error(`Missing food probability for object ${otyp}`);
        totalProbability += probability;
    }
    let choice = rnd(totalProbability);
    let selected = eligible[0];
    for (const otyp of eligible) {
        selected = otyp;
        const probability = OBJECT_PROB[otyp];
        if (probability === undefined) throw new Error(`Missing food probability for object ${otyp}`);
        choice -= probability;
        if (choice <= 0) break;
    }
    if (selected === undefined) throw new Error('Vegetarian shop selection has no eligible food.');
    const object = await mksobj_at(selected, x, y, true, true);
    if (object?.otyp === TIN) setTinVariety(object, HEALTHY_TIN);
    return object;
}

async function stockShopRoom(sroom: Room): Promise<void> {
    const level = requireGameLevel();
    const shopLevel = game.u.uz;
    if (!shopLevel) throw new Error('Shop creation requires the current dungeon location.');
    const shopDoor = goodShopDoor(sroom);
    if (!shopDoor) return;
    const shopIndex = sroom.rtype - SHOPBASE;
    // shknam.c:shkinit() relocates an existing occupant before creating
    // the resident; it does not abandon this shop when its doorway is busy.
    const occupant = monsterAtPosition(level, shopDoor.x, shopDoor.y);
    if (occupant) await randomMonsterRelocation(occupant, { flags: RLOC_NOMSG });
    const shopkeeper = await makemon(PM_SHOPKEEPER, shopDoor.x, shopDoor.y, 0);
    if (!shopkeeper) return;
    shopkeeper.eshk = {
        shoproom: (sroom.roomnoidx ?? -1) + ROOMOFFSET,
        shoptype: sroom.rtype,
        shoplevel: { ...shopLevel },
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
    await linkObjectToMonsterInventory(
        shopkeeper, await mksobj(GOLD_PIECE, false, false), { atFront: true },
    );
    if (shopIndex === 6)
        await addObjectToMonsterInventory(
            shopkeeper, await mksobj(TOUCHSTONE, true, false), game,
            { atFront: true },
        );
    if (shopIndex === 8 || shopIndex === 7
        || (shopIndex === 6 && rn2(2))
        || (shopIndex === 0 && rn2(5)))
        await addObjectToMonsterInventory(
            shopkeeper, await mksobj(SCR_CHARGING, true, false), game,
            { atFront: true },
        );
    assignShopkeeperIdentity(shopkeeper, shopIndex);

    const doorLoc = level.at(shopDoor.door.x, shopDoor.door.y);
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
            await mksobj_at(SPE_NOVEL, pos.x, pos.y, false, false);
            game._tributeBookstock = true;
            continue;
        }
        if (rn2(100) < depth_of_level(game.u?.uz)
            && !level.monsters.some(mon => monsterHasMapPosition(mon, game) && mon.mx === pos.x && mon.my === pos.y)) {
            const mimic = mkclass(S_MIMIC, 0);
            if (mimic != null) {
                await makemon(mimic, pos.x, pos.y, 0);
                continue;
            }
        }
        const atype = getShopItem(shopIndex);
        if (atype === VEGETARIAN_CLASS) {
            await mkveggy_at(pos.x, pos.y);
        } else if (atype < 0) {
            await mksobj_at(-atype, pos.x, pos.y, true, true);
        } else {
            await mkobj_at(atype, pos.x, pos.y, true);
        }
    }
    // shknam.c:stock_room() makes Orcus's two shops into a ghost town after
    // stocking.  mongone() first probes every carried item for protected
    // objects, then discards the inventory and detaches the shopkeeper.
    if (game._activeSpecialLevel?.prototype === 'orcus') {
        await removeMonsterFromGame(shopkeeper);
    }
    level.flags.has_shop = true;
}

export async function fillSpecialRoom(croom: Room | null | undefined): Promise<void> {
    const level = requireGameLevel();
    if (!croom) return;
    for (const subroom of croom.sbrooms || [])
        await fillSpecialRoom(subroom);
    if (croom.rtype === OROOM || croom.rtype === THEMEROOM
        || croom.needfill === FILL_NONE) return;
    if (croom.needfill === FILL_NORMAL) {
        if (croom.rtype >= SHOPBASE) await stockShopRoom(croom);
        else if (croom.rtype === VAULT) await fillVault(croom);
        else if (croom.rtype === COURT) await fillCourtRoom(croom);
        else if ([ZOO, LEPREHALL, COCKNEST, ANTHOLE].includes(croom.rtype))
            await fillZooRoom(croom);
        else if (croom.rtype === BEEHIVE) await fillBeehiveRoom(croom);
        else if (croom.rtype === MORGUE) await fillMorgueRoom(croom);
        else if (croom.rtype === BARRACKS) await fillBarracksRoom(croom);
    }
    // FILL_LVFLAGS suppresses stocking but still publishes the special-room
    // level flag; FILL_NORMAL constructors above publish the same flag.
    if (croom.rtype === VAULT) level.flags.has_vault = true;
    else if (croom.rtype === COURT) level.flags.has_court = true;
    else if (croom.rtype === ZOO) level.flags.has_zoo = true;
    else if (croom.rtype === BEEHIVE)
        level.flags.has_beehive = true;
    else if (croom.rtype === MORGUE) level.flags.has_morgue = true;
    else if (croom.rtype === BARRACKS)
        level.flags.has_barracks = true;
    else if (croom.rtype === TEMPLE) level.flags.has_temple = true;
    else if (croom.rtype === SWAMP) level.flags.has_swamp = true;
}

function barracksMonsterType(): number | null {
    const probabilities = [
        [PM_SOLDIER, 80], [PM_SERGEANT, 15],
        [PM_LIEUTENANT, 4], [PM_CAPTAIN, 1],
    ] as const;
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
    if (mndx == null) {
        const entry = probabilities[rn2(probabilities.length)];
        if (!entry) throw new RangeError('Barracks monster selection is out of range.');
        mndx = entry[0];
    }
    return ((game.mvitals?.[mndx]?.mvflags ?? 0) & 0x03)
        ? null : mndx;
}

async function fillBarracksRoom(room: Room): Promise<void> {
    const level = requireGameLevel();
    const entrance = room.doorct ? level.doors?.[room.fdoor] : null;
    const roomNumber = level.rooms.indexOf(room) + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.at(x, y);
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
                await mksobj_at(
                    rn2(3) ? LARGE_BOX : CHEST,
                    x, y, true, false,
                );
            }
        }
    }
    level.flags.has_barracks = true;
}

// C ref: mkroom.c fill_zoo(BEEHIVE).  The queen occupies the geometric
// center; every other eligible room square receives a sleeping, ungrouped
// killer bee, followed by that square's independent royal-jelly probe.
async function fillBeehiveRoom(croom: Room): Promise<void> {
    const level = requireGameLevel();
    const centerX = croom.lx + Math.trunc((croom.hx - croom.lx + 1) / 2);
    const centerY = croom.ly + Math.trunc((croom.hy - croom.ly + 1) / 2);
    const door = croom.doorct ? level.doors?.[croom.fdoor] : null;
    for (let x = croom.lx; x <= croom.hx; x++) {
        for (let y = croom.ly; y <= croom.hy; y++) {
            const loc = level.at(x, y);
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
                await mksobj_at(LUMP_OF_ROYAL_JELLY, x, y, true, false);
        }
    }
    level.flags.has_beehive = true;
}

// ============================================================
// Rogue level generation (C: extralev.c)
// ============================================================

interface RogueCellBase {
    doortable: number;
    rlx: number;
    rly: number;
}

interface RogueRoomCell extends RogueCellBase {
    real: true;
    dx: number;
    dy: number;
    nroom?: number;
}

type RogueCell = RogueRoomCell | (RogueCellBase & { real: false });

function rogueGridCell(grid: readonly (readonly RogueCell[])[], x: number, y: number): RogueCell {
    const cell = grid[x]?.[y];
    if (!cell) throw new RangeError(`Missing Rogue grid cell ${x},${y}`);
    return cell;
}

function rogueGridRoom(cell: RogueRoomCell): Room {
    const room = cell.nroom === undefined ? undefined : requireGameLevel().rooms[cell.nroom];
    if (!isRoom(room)) throw new Error('Rogue room cell has no generated room.');
    return room;
}

function rogueCorrCell(x: number, y: number): void {
    const loc = game.level?.at(x, y);
    if (loc) loc.typ = rn2(50) ? CORR : SCORR;
}

function roguejoin(x1: number, y1: number, x2: number, y2: number, horiz: boolean): void {
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

async function roguecorr(grid: RogueCell[][], x: number, y: number, dir: number): Promise<void> {
    const level = requireGameLevel();
    let fromx, fromy, tox, toy;
    const source = rogueGridCell(grid, x, y);
    if (dir === XL_DOWN) {
        source.doortable &= ~XL_DOWN;
        if (!source.real) {
            fromx = source.rlx + 1 + 26 * x;
            fromy = source.rly + 7 * y;
        } else {
            fromx = source.rlx + rn2(source.dx) + 1 + 26 * x;
            fromy = source.rly + source.dy + 7 * y;
            await dodoor(fromx, fromy, rogueGridRoom(source));
            level.requireAt(fromx, fromy).doormask = D_NODOOR;
            fromy++;
        }
        if (y >= 2) return;
        const dest = rogueGridCell(grid, x, ++y);
        dest.doortable &= ~XL_UP;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        } else {
            tox = dest.rlx + rn2(dest.dx) + 1 + 26 * x;
            toy = dest.rly - 1 + 7 * y;
            await dodoor(tox, toy, rogueGridRoom(dest));
            level.requireAt(tox, toy).doormask = D_NODOOR;
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
            await dodoor(fromx, fromy, rogueGridRoom(source));
            level.requireAt(fromx, fromy).doormask = D_NODOOR;
            fromx++;
        }
        if (x >= 2) return;
        const dest = rogueGridCell(grid, ++x, y);
        dest.doortable &= ~XL_LEFT;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        } else {
            tox = dest.rlx - 1 + 1 + 26 * x;
            toy = dest.rly + rn2(dest.dy) + 7 * y;
            await dodoor(tox, toy, rogueGridRoom(dest));
            level.requireAt(tox, toy).doormask = D_NODOOR;
            tox--;
        }
        roguejoin(fromx, fromy, tox, toy, true);
    }
}

// Modified walkfrom() from mkmaze.c.  Preserve the recursive walk and its
// left/right/up/down candidate order: revisiting a cell can add the intended
// one-in-ten extra connection and therefore owns observable RNG calls.
function rogueMiniwalk(grid: RogueCell[][], x: number, y: number): void {
    while (true) {
        const dirs: number[] = [];
        const here = rogueGridCell(grid, x, y);
        if (x > 0 && !(here.doortable & XL_LEFT)
            && (!rogueGridCell(grid, x - 1, y).doortable || !rn2(10)))
            dirs.push(XL_LEFT);
        if (x < 2 && !(here.doortable & XL_RIGHT)
            && (!rogueGridCell(grid, x + 1, y).doortable || !rn2(10)))
            dirs.push(XL_RIGHT);
        if (y > 0 && !(here.doortable & XL_UP)
            && (!rogueGridCell(grid, x, y - 1).doortable || !rn2(10)))
            dirs.push(XL_UP);
        if (y < 2 && !(here.doortable & XL_DOWN)
            && (!rogueGridCell(grid, x, y + 1).doortable || !rn2(10)))
            dirs.push(XL_DOWN);
        if (!dirs.length) return;

        const dir = dirs[rn2(dirs.length)];
        if (dir === undefined) throw new RangeError('Rogue walk direction is out of range.');
        if (dir === XL_LEFT) {
            here.doortable |= XL_LEFT;
            rogueGridCell(grid, --x, y).doortable |= XL_RIGHT;
        } else if (dir === XL_RIGHT) {
            here.doortable |= XL_RIGHT;
            rogueGridCell(grid, ++x, y).doortable |= XL_LEFT;
        } else if (dir === XL_UP) {
            here.doortable |= XL_UP;
            rogueGridCell(grid, x, --y).doortable |= XL_DOWN;
        } else {
            here.doortable |= XL_DOWN;
            rogueGridCell(grid, x, ++y).doortable |= XL_UP;
        }
        rogueMiniwalk(grid, x, y);
    }
}

async function makeroguerooms(): Promise<void> {
    const g = game;
    const level = requireGameLevel();
    const roomEquivalence = g.smeq;
    if (!roomEquivalence) throw new Error('Rogue generation requires initialized room equivalence.');
    const grid: RogueCell[][] = [[], [], []];
    let realRooms = 0;

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const column = grid[x];
            if (!column) throw new RangeError(`Missing Rogue grid column ${x}`);
            if (!rn2(5) && (realRooms || (x < 2 && y < 2))) {
                column[y] = {
                    doortable: 0, real: false,
                    rlx: rn1(22, 2), rly: rn1(y === 2 ? 4 : 3, 2),
                };
            } else {
                const dx = rn1(22, 2), dy = rn1(y === 2 ? 4 : 3, 2);
                column[y] = {
                    doortable: 0, real: true, dx, dy,
                    rlx: rnd(23 - dx + 1), rly: rnd((y === 2 ? 5 : 4) - dy + 1),
                };
                realRooms++;
            }
        }
    }

    rogueMiniwalk(grid, rn2(3), rn2(3));
    level.nroom = 0;
    level.rooms = [];
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const room = rogueGridCell(grid, x, y);
            if (!room.real) continue;
            room.nroom = level.nroom;
            roomEquivalence[level.nroom] = level.nroom;
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
            const room = rogueGridCell(grid, x, y);
            if (room.doortable & XL_DOWN)
                await roguecorr(grid, x, y, XL_DOWN);
            if (room.doortable & XL_RIGHT)
                await roguecorr(grid, x, y, XL_RIGHT);
        }
    }
}

function roguename(): string {
    return rn2(3)
        ? (rn2(2) ? 'Michael Toy' : 'Kenneth Arnold')
        : 'Glenn Wichman';
}

async function makerogueghost(): Promise<void> {
    const level = requireGameLevel();
    if (!level.nroom) return;
    const croom = level.rooms[rn2(level.nroom)];
    if (!isRoom(croom)) throw new Error('Rogue ghost placement selected a missing room.');
    const x = somex(croom), y = somey(croom);
    const ghost = await makemon(287, x, y, 0); // PM_GHOST
    if (!ghost) return;
    ghost.msleeping = 1;
    ghost.name = roguename();

    let ghostobj;
    if (rn2(4)) {
        ghostobj = await mksobj_at(FOOD_RATION, x, y, false, false);
        ghostobj.quan = rnd(7);
        ghostobj.quantity = ghostobj.quan;
        ghostobj.owt = (OBJECT_WEIGHT[FOOD_RATION] ?? 1) * ghostobj.quan;
    }
    if (rn2(2)) {
        ghostobj = await mksobj_at(MACE, x, y, false, false);
        ghostobj.spe = rnd(3);
        if (rn2(4)) curseObjectState(ghostobj);
    } else {
        ghostobj = await mksobj_at(TWO_HANDED_SWORD, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (rn2(4)) curseObjectState(ghostobj);
    }
    ghostobj = await mksobj_at(BOW, x, y, false, false);
    ghostobj.spe = 1;
    if (rn2(4)) curseObjectState(ghostobj);

    ghostobj = await mksobj_at(ARROW, x, y, false, false);
    ghostobj.spe = 0;
    ghostobj.quan = rn1(10, 25);
    ghostobj.quantity = ghostobj.quan;
    ghostobj.owt = (OBJECT_WEIGHT[ARROW] ?? 1) * ghostobj.quan;
    if (rn2(4)) curseObjectState(ghostobj);

    if (rn2(2)) {
        ghostobj = await mksobj_at(RING_MAIL, x, y, false, false);
        ghostobj.spe = rn2(3);
        if (!rn2(3)) ghostobj.oerodeproof = true;
        if (rn2(4)) curseObjectState(ghostobj);
    } else {
        ghostobj = await mksobj_at(PLATE_MAIL, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (!rn2(3)) ghostobj.oerodeproof = true;
        if (rn2(4)) curseObjectState(ghostobj);
    }
    if (rn2(2)) {
        ghostobj = await mksobj_at(
            FAKE_AMULET_OF_YENDOR, x, y, true, false,
        );
        ghostobj.known = true;
    }
}

// C ref: mklev.c makerooms()
async function makerooms(): Promise<void> {
    const g = game;
    const level = requireGameLevel();
    let tried_vault = false;
    let themeroom_tries = 0;

    while (level.nroom < (MAXNROFROOMS - 1) && rnd_rect()) {
        if (level.nroom >= Math.trunc(MAXNROFROOMS / 6) && rn2(2) && !tried_vault) {
            tried_vault = true;
            if (create_vault()) {
                g.vault_x = level.rooms[level.nroom]?.lx ?? -1;
                g.vault_y = level.rooms[level.nroom]?.ly ?? -1;
                const reserved = level.rooms[level.nroom];
                if (reserved) level.rooms[level.nroom] = { ...reserved, hx: -1 };
            }
        } else {
            g.in_mk_themerooms = true;
            const generated = await themerooms_generate();
            g.in_mk_themerooms = false;
            if (!generated) {
                if (themeroom_tries++ > 10
                    || level.nroom >= Math.trunc(MAXNROFROOMS / 6))
                    break;
            }
        }
    }
    g.in_mk_themerooms = false;
    await callLuaThemerooms('post_themerooms_generate');
}

function themedMapTerrain(ch: string | undefined): number | null {
    if (ch === '.') return ROOM;
    if (ch === '-') return HWALL;
    if (ch === '|') return VWALL;
    if (ch === 'L') return LAVAPOOL;
    if (ch === 'P') return POOL;
    if (ch === '}') return MOAT;
    if (ch === ' ') return STONE;
    return null; // 'x' and any unsupported map character are see-through
}

function themedMapFits(rows: readonly string[], xstart: number, ystart: number): boolean {
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

function placeThemedMap(rows: readonly string[], lit: boolean): SpecialLevelContext | null {
    const level = requireGameLevel();
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
            const loc = level.requireAt(xstart + col, ystart + row);
            loc.typ = terrain;
            loc.flags = 0;
            // sp_lev.c:lspo_map() clears the record, then sel_set_ter()
            // restores orientation for horizontal walls.  A later dosdoor()
            // can turn this wall into an SDOOR and deliberately retain it.
            loc.horizontal = terrain === HWALL;
            loc.roomno = 0;
            loc.edge = false;
            loc.lit = lit || IS_LAVA(terrain);
        }
    }
    return { xstart, ystart, width, height };
}

function luaSelectionCoordinates(selection: SpecialSelection): Position[] {
    const coordinates: Position[] = [];
    selection.forEachLua((x, y) => coordinates.push({ x, y }));
    return coordinates;
}

async function themerooms_generate(): Promise<boolean> {
    const level = requireGameLevel();
    const session = activeThemes.get(game)?.session;
    session?.beginRoom();
    const roomsBefore = level.nroom;
    const subroomsBefore = level.nsubroom;
    await callLuaThemerooms('themerooms_generate');
    if (session?.roomFailed()) return false;
    return level.nroom !== roomsBefore
        || level.nsubroom !== subroomsBefore;
}

// C ref: sp_lev.c check_room()
interface MutableNumber {
    v: number;
}

function check_room(
    lowx: MutableNumber, ddx: MutableNumber, lowy: MutableNumber, ddy: MutableNumber, vault: boolean,
): boolean {
    const map = requireGameLevel();
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
function create_room(
    x: number, y: number, w: number, h: number, xal: number, yal: number,
    rtype: number, rlit: number | boolean,
): boolean {
    const g = game;
    const level = requireGameLevel();
    let xabs = 0, yabs = 0;
    let r1: Rectangle | null = null, r2: Rectangle | null = null;
    let wtmp = w, htmp = h;
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
                && (!level.nroom || !rn2(level.nroom))
                && (yabs + dy > Math.trunc(ROWNO / 2))) {
                yabs = rn1(3, 2);
                if (level.nroom < 4 && dy > 1) dy--;
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
    if (!r2) throw new Error('Room placement did not choose a rectangle.');
    split_rects(r1, r2);
    if (!vault) {
        if (!g.smeq) throw new Error('Room placement requires initialized room equivalence.');
        g.smeq[level.nroom] = level.nroom;
        add_room(xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1, rlit, rtype, false);
    } else {
        level.rooms[level.nroom] = { ...level.rooms[level.nroom], lx: xabs, ly: yabs };
    }
    return true;
}

// C refs: sp_lev.c create_subroom() and mklev.c add_subroom().  Subrooms
// share their parent's rectangle allocation but retain distinct room
// identity for shop/temple membership and recursive special-room filling.
function add_subroom(
    proom: Room, lowx: number, lowy: number, hix: number, hiy: number,
    lit: number | boolean, rtype: number, special: boolean,
): Room {
    const level = requireGameLevel();
    const subroomIndex = level.nsubroom || 0;
    const croom: Room = {
        lx: lowx, ly: lowy, hx: hix, hy: hiy,
        rtype, rlit: lit ? 1 : 0,
        doorct: 0, fdoor: level.doorindex,
        irregular: false, needjoining: !special,
        nsubrooms: 0, sbrooms: [],
        roomnoidx: MAXNROFROOMS + subroomIndex,
        needfill: 0,
    };
    do_room_or_subroom(
        croom, lowx, lowy, hix, hiy, lit, rtype, special, false,
    );
    proom.sbrooms[proom.nsubrooms++] = croom;
    const subrooms = level.subrooms ??= [];
    subrooms[subroomIndex] = croom;
    level.nsubroom = subroomIndex + 1;
    return croom;
}

function create_subroom(
    proom: Room, x: number, y: number, w: number, h: number, rtype: number, rlit: number | boolean,
): Room | null {
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

function create_vault(): boolean {
    return create_room(-1, -1, 2, 2, -1, -1, VAULT, true);
}

// C ref: mklev.c add_room()
function add_room(
    lowx: number, lowy: number, hix: number, hiy: number,
    lit: number | boolean, rtype: number, special: boolean,
): Room {
    const level = requireGameLevel();
    const croom: Room = {
        lx: lowx, ly: lowy, hx: hix, hy: hiy,
        rtype, rlit: lit ? 1 : 0,
        doorct: 0, fdoor: level.doorindex,
        irregular: false, needjoining: !special,
        nsubrooms: 0, sbrooms: [],
        roomnoidx: level.nroom,
        needfill: 0,
    };
    do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special, true);
    level.rooms[level.nroom] = croom;
    level.nroom++;
    if (level.nroom < MAXNROFROOMS) {
        level.rooms[level.nroom] = { hx: -1 };
    }
    return croom;
}

// C ref: mklev.c do_room_or_subroom()
function do_room_or_subroom(
    croom: Room, lowx: number, lowy: number, hix: number, hiy: number,
    lit: number | boolean, rtype: number, special: boolean, is_room: boolean,
): void {
    const map = requireGameLevel();
    if (!lowx) lowx++;
    if (!lowy) lowy++;
    if (hix >= COLNO - 1) hix = COLNO - 2;
    if (hiy >= ROWNO - 1) hiy = ROWNO - 2;
    if (lit) {
        for (let x = lowx - 1; x <= hix + 1; x++)
            for (let y = Math.max(lowy - 1, 0); y <= hiy + 1; y++) {
                const loc = map.at(x, y);
                if (loc) loc.lit = true;
            }
        croom.rlit = 1;
    } else {
        croom.rlit = 0;
    }
    croom.lx = lowx; croom.hx = hix;
    croom.ly = lowy; croom.hy = hiy;
    croom.rtype = rtype;
    croom.doorct = 0;
    croom.fdoor = map.doorindex;
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
function sort_rooms(): void {
    const level = requireGameLevel();
    const n = level.nroom;
    const oldToNew = Array.from({ length: n }, () => 0);
    const liveRooms = level.rooms.slice(0, n).map(room => {
        if (!isRoom(room)) throw new Error('Live room list contains an unfinished room.');
        return room;
    }).sort((a, b) => a.lx - b.lx);
    level.rooms = liveRooms;
    for (const [index, room] of liveRooms.entries()) {
        oldToNew[room.roomnoidx] = index;
        room.roomnoidx = index;
    }
    if (n < MAXNROFROOMS) level.rooms[n] = { hx: -1 };
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.requireAt(x, y);
            const rno = loc.roomno;
            if (rno >= ROOMOFFSET && rno < MAXNROFROOMS + 1) {
                const roomIndex = oldToNew[rno - ROOMOFFSET];
                if (roomIndex === undefined) throw new Error(`Missing room number ${rno}`);
                loc.roomno = roomIndex + ROOMOFFSET;
            }
        }
}

// C ref: mklev.c topologize()
function topologize(croom: Room | null | undefined): void {
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

function good_rm_wall_doorpos(x: number, y: number, dir: number, room: Room): boolean {
    const map = requireGameLevel();
    const rmno = map.rooms.indexOf(room) + ROOMOFFSET;
    if (!isok(x, y) || !room.needjoining) return false;
    const loc = map.at(x, y);
    if (!loc) return false;
    if (!(loc.typ === HWALL || loc.typ === VWALL || IS_DOOR(loc.typ) || loc.typ === SDOOR))
        return false;
    if (bydoor(x, y)) return false;
    const dx = xdir[dir], dy = ydir[dir];
    if (dx === undefined || dy === undefined) return false;
    const tx = x + dx, ty = y + dy;
    if (!isok(tx, ty)) return false;
    const tloc = map.at(tx, ty);
    if (!tloc || IS_OBSTRUCTED(tloc.typ)) return false;
    if (rmno !== tloc.roomno) return false;
    return true;
}

function finddpos_shift(xp: MutableNumber, yp: MutableNumber, dir: number, aroom: Room): boolean {
    const level = requireGameLevel();
    const rdir = DIR_180(dir);
    if (good_rm_wall_doorpos(xp.v, yp.v, rdir, aroom)) return true;
    // An irregular room's actual wall can sit inside its rectangular bounds.
    // Walk inward across untouched stone/corridor cells until that wall is
    // reached, exactly as mklev.c finddpos_shift() does.
    if (aroom.irregular) {
        const dx = xdir[rdir], dy = ydir[rdir];
        if (dx === undefined || dy === undefined) return false;
        let rx = xp.v, ry = yp.v;
        let fail = false;
        while (!fail && isok(rx, ry)) {
            const current = level.at(rx, ry);
            if (!current || (current.typ !== STONE && current.typ !== CORR)) break;
            rx += dx;
            ry += dy;
            if (good_rm_wall_doorpos(rx, ry, rdir, aroom)) {
                xp.v = rx;
                yp.v = ry;
                return true;
            }
            const advanced = level.at(rx, ry);
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
function finddpos(cc: Position, dir: number, aroom: Room): boolean {
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

function maybe_sdoor(chance: number): boolean {
    const d = depth_of_level(game.u?.uz);
    return (d > 2) && !rn2(Math.max(2, chance));
}

// C ref: sp_lev.c dig_corridor()
export async function dig_corridor(
    org: Position, dest: Position, npoints_out: MutableNumber | null,
    nxcor: boolean, ftyp: number, btyp: number,
): Promise<boolean> {
    const map = requireGameLevel();
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
                    await mksobj_at(BOULDER, xx, yy, true, false);
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
async function dosdoor(x: number, y: number, aroom: Room, type: number): Promise<void> {
    const map = requireGameLevel();
    const loc = map.at(x, y);
    if (!loc) return;
    const shdoor = roomsAt(map, x, y, SHOPBASE).length > 0;
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
            if (level_difficulty() >= 9 && !rn2(5)
                && MONSTER_SYMBOL.some((symbol, mndx) => symbol === S_MIMIC
                    && !((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE))) {
                loc.doormask = D_NODOOR;
                const mimic = await makemon(mkclass(S_MIMIC, 0), x, y, 0);
                if (mimic) await setMimicAppearance(mimic);
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

async function dodoor(x: number, y: number, aroom: Room): Promise<void> {
    await dosdoor(x, y, aroom, maybe_sdoor(8) ? SDOOR : DOOR);
}

function add_door(x: number, y: number, aroom: Room): void {
    const level = requireGameLevel();
    for (let i = 0; i < aroom.doorct; i++) {
        const d = level.doors[aroom.fdoor + i];
        if (d && d.x === x && d.y === y) return;
    }
    if (aroom.doorct === 0) aroom.fdoor = level.doorindex;
    aroom.doorct++;
    for (let tmp = level.doorindex; tmp > aroom.fdoor; tmp--) {
        const door = level.doors[tmp - 1];
        if (!door) throw new Error(`Missing door at index ${tmp - 1}`);
        level.doors[tmp] = door;
    }
    const otherRooms = [
        ...level.rooms.slice(0, level.nroom),
        ...(level.subrooms ?? []).slice(0, level.nsubroom ?? 0),
    ];
    for (const broom of otherRooms) {
        if (!isRoom(broom) || broom === aroom || !broom.doorct) continue;
        if (broom.fdoor >= aroom.fdoor) broom.fdoor++;
    }
    level.doors[aroom.fdoor] = { x, y };
    level.doorindex++;
}

function bydoor(x: number, y: number): boolean {
    const map = requireGameLevel();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!isok(x + dx, y + dy)) continue;
        const loc = map.at(x + dx, y + dy);
        if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR)) return true;
    }
    return false;
}

function okdoor(x: number, y: number): boolean {
    const map = requireGameLevel();
    const loc = map.at(x, y);
    if (!loc) return false;
    if (!(loc.typ === HWALL || loc.typ === VWALL)) return false;
    if (bydoor(x, y)) return false;
    return (
        (isok(x - 1, y) && !IS_OBSTRUCTED(map.requireAt(x - 1, y).typ))
        || (isok(x + 1, y) && !IS_OBSTRUCTED(map.requireAt(x + 1, y).typ))
        || (isok(x, y - 1) && !IS_OBSTRUCTED(map.requireAt(x, y - 1).typ))
        || (isok(x, y + 1) && !IS_OBSTRUCTED(map.requireAt(x, y + 1).typ))
    );
}

// C ref: mklev.c join()
async function join(a: number, b: number, nxcor: boolean): Promise<void> {
    const g = game;
    const level = requireGameLevel();
    const croom = level.rooms[a];
    const troom = level.rooms[b];
    if (!isRoom(croom) || !isRoom(troom)) return;
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
        const loc = level.at(xx + dx, yy + dy);
        if (loc && loc.typ !== STONE) return;
    }
    const org = { x: xx + dx, y: yy + dy };
    const dest = { x: tx, y: ty };
    const npoints = { v: 0 };
    const ftyp = level.flags.arboreal ? ROOM : CORR;
    const dig_result = await dig_corridor(org, dest, npoints, nxcor, ftyp, STONE);
    if ((npoints.v > 0) && (okdoor(xx, yy) || !nxcor))
        await dodoor(xx, yy, croom);
    if (!dig_result) return;
    if (okdoor(tt.x, tt.y) || !nxcor)
        await dodoor(tt.x, tt.y, troom);
    const equivalence = g.smeq;
    const first = equivalence?.[a], second = equivalence?.[b];
    if (!equivalence || first === undefined || second === undefined)
        throw new Error('Corridor join requires room equivalence indexes.');
    if (first < second) equivalence[b] = first;
    else equivalence[a] = second;
}

// C ref: mklev.c makecorridors()
async function makecorridors(): Promise<void> {
    const g = game;
    const level = requireGameLevel();
    const equivalence = g.smeq;
    if (!equivalence) throw new Error('Corridors require initialized room equivalence.');
    let unjoinedRooms = true;
    for (let a = 0; a < level.nroom - 1; a++) {
        await join(a, a + 1, false);
        if (!rn2(50)) break;
    }
    for (let a = 0; a < level.nroom - 2; a++)
        if (equivalence[a] !== equivalence[a + 2]) await join(a, a + 2, false);
    for (let a = 0; unjoinedRooms && a < level.nroom; a++) {
        unjoinedRooms = false;
        for (let b = 0; b < level.nroom; b++)
            if (equivalence[a] !== equivalence[b]) { await join(a, b, false); unjoinedRooms = true; }
    }
    if (level.nroom > 2) {
        const count = rn2(level.nroom) + 4;
        for (let i = 0; i < count; i++) {
            const a = rn2(level.nroom);
            let b = rn2(level.nroom - 2);
            if (b >= a) b += 2;
            await join(a, b, true);
        }
    }
}

// ============================================================
// Stairs
// ============================================================

function generate_stairs_room_good(croom: Room | null | undefined, phase: number): boolean {
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

function generate_stairs_find_room(): Room | null {
    const level = requireGameLevel();
    if (!level.nroom) return null;
    for (let phase = 2; phase > -1; phase--) {
        const candidates: Room[] = [];
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room) && generate_stairs_room_good(room, phase))
                candidates.push(room);
        if (candidates.length > 0) {
            const selected = candidates[rn2(candidates.length)];
            if (!selected) throw new RangeError('Stair room selection is out of range.');
            return selected;
        }
    }
    const selected = level.rooms[rn2(level.nroom)];
    return isRoom(selected) ? selected : null;
}

export function mkstairs(x: number, y: number, up: boolean | 0 | 1, croom: Room | null): void {
    const g = game;
    const level = requireGameLevel();
    const currentLevel = g.u?.uz?.dlevel ?? 1;
    const dungeonLevels = g.dungeons?.[g.u?.uz?.dnum ?? 0]?.num_dunlevs
        ?? currentLevel;
    // Regular stairs cannot leave a dungeon at either end.  Branch
    // placement later installs the cross-dungeon stair on an entry level.
    if ((up && currentLevel === 1)
        || (!up && currentLevel === dungeonLevels))
        return;
    const loc = level.at(x, y);
    if (loc) {
        loc.typ = STAIRS;
        loc.ladder = up ? 1 : 2;
    }
    const dest = {
        dnum: g.u?.uz?.dnum ?? 0,
        dlevel: currentLevel + (up ? -1 : 1),
    };
    stairway_add(x, y, !!up, false, dest);
    if (up) level.upstair = { x, y };
    else level.dnstair = { x, y };
}

async function generate_stairs(): Promise<void> {
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

function cardinal_nextto_room(aroom: Room, x: number, y: number): boolean {
    const map = requireGameLevel();
    const rmno = map.rooms.indexOf(aroom) + ROOMOFFSET;
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
        if (!isok(x + dx, y + dy)) continue;
        const loc = map.at(x + dx, y + dy);
        if (loc && !loc.edge && loc.roomno === rmno) return true;
    }
    return false;
}

function place_niche(aroom: Room): { dy: number; xx: number; yy: number } | null {
    const level = requireGameLevel();
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
    const niche = level.at(xx, yy + dy);
    const back = level.at(xx, yy - dy);
    if (!niche || niche.typ !== STONE) return null;
    if (!back || IS_POOL(back.typ) || IS_FURNITURE(back.typ)) return null;
    if (!cardinal_nextto_room(aroom, xx, yy)) return null;
    return { dy, xx, yy };
}

async function makeniche(trap_type: number): Promise<void> {
    const g = game;
    const level = requireGameLevel();
    let vct = 8;
    while (vct--) {
        const aroom = level.rooms[rn2(level.nroom)];
        if (!isRoom(aroom) || aroom.rtype !== OROOM) continue;
        if (aroom.doorct === 1 && rn2(5)) continue;
        const niche = place_niche(aroom);
        if (!niche) continue;
        const { dy, xx, yy } = niche;
        const rm = level.at(xx, yy + dy);
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
                    // Creation preserves the original punctuation before wear.
                    makeEngravingAt(xx, yy - dy, trapEngraving, null, 0, DUST);
                    wipeEngravingAt(xx, yy - dy, 5);
                }
            }
            await dosdoor(xx, yy, aroom, SDOOR);
        } else {
            rm.typ = CORR;
            if (rn2(7)) {
                await dosdoor(xx, yy, aroom, rn2(5) ? SDOOR : DOOR);
            } else {
                const loc = level.at(xx, yy);
                if (!rn2(5) && loc && IS_WALL(loc.typ)) {
                    loc.typ = IRONBARS;
                    if (rn2(3)) {
                        const S_HUMAN = 53;
                        const human = mkclass(S_HUMAN, 0);
                        await createCorpstatAt(CORPSE, null, human, xx, yy + dy, 1);
                    }
                }
                if (!level.flags.noteleport) {
                    await mksobj_at(SCR_TELEPORTATION, xx, yy + dy, true, false);
                }
                if (!rn2(3)) {
                    await mkobj_at(RANDOM_CLASS, xx, yy + dy, true);
                }
            }
        }
        return;
    }
}

async function make_niches(): Promise<void> {
    const g = game;
    let ct = rnd(Math.trunc(requireGameLevel().nroom / 2) + 1);
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

function is_branchlev(): DungeonBranch | null {
    const g = game;
    if (!g.branches) return null;
    for (const br of g.branches) {
        if (br?.end1?.dnum === (g.u?.uz?.dnum ?? 0) && br?.end1?.dlevel === (g.u?.uz?.dlevel ?? 1)) return br;
        if (br?.end2?.dnum === (g.u?.uz?.dnum ?? 0) && br?.end2?.dlevel === (g.u?.uz?.dlevel ?? 1)) return br;
    }
    return null;
}

function find_branch_room(mp: Position): Room | null {
    if (!requireGameLevel().nroom) {
        const point = mazeFloorPoint();
        mp.x = point.x;
        mp.y = point.y;
        return null;
    }
    const croom = generate_stairs_find_room();
    if (croom) somexyspace(croom, mp);
    return croom;
}

async function placeBranchAt(branchp: DungeonBranch | null, x: number, y: number): Promise<void> {
    const g = game;
    if (!branchp || g.made_branch) return;
    const on_end1 = branchp.end1?.dnum === g.u?.uz?.dnum
        && branchp.end1?.dlevel === g.u?.uz?.dlevel;
    const dest = on_end1 ? branchp.end2 : branchp.end1;
    if (branchp.type === 'portal') {
        const portal = await maketrap(x, y, MAGIC_PORTAL);
        if (!portal) throw new Error('Dungeon branch portal could not be created.');
        portal.dst = { ...dest };
    } else if (branchp.type !== (on_end1 ? 'no_end1' : 'no_end2')) {
        const goes_up = on_end1 ? !!branchp.end1_up : !branchp.end1_up;
        const loc = g.level?.at(x, y);
        if (loc) {
            loc.typ = STAIRS;
            loc.ladder = goes_up ? 1 : 2;
        }
        stairway_add(x, y, goes_up, false,
            dest);
    }
    g.made_branch = true;
}

async function place_branch(branchp: DungeonBranch | null): Promise<void> {
    const g = game;
    if (!branchp || g.made_branch) return;
    const mp = { x: 0, y: 0 };
    find_branch_room(mp);
    await placeBranchAt(branchp, mp.x, mp.y);
}

// ============================================================
// Wallification
// ============================================================

function isSolidTile(x: number, y: number): boolean {
    if (!isok(x, y)) return true;
    return IS_STWALL(game.level?.at(x, y)?.typ ?? STONE);
}
function isWallOrStone(x: number, y: number): 0 | 1 {
    if (!isok(x, y)) return 1;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (typ === STONE || isWallTile(x, y)) ? 1 : 0;
}
function isWallTile(x: number, y: number): 0 | 1 {
    if (!isok(x, y)) return 0;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (IS_WALL(typ) || IS_DOOR(typ) || typ === LAVAWALL
        || typ === WATER || typ === SDOOR || typ === IRONBARS) ? 1 : 0;
}
type WallNeighbors = [[number, number, number], [number, number, number], [number, number, number]];
interface WallArea { x1: number; y1: number; x2: number; y2: number }

function extend_spine(locale: WallNeighbors, wall_there: 0 | 1, dx: -1 | 0 | 1, dy: -1 | 0 | 1): 0 | 1 {
    const nx = 1 + dx, ny = 1 + dy;
    if (!wall_there) return 0;
    if (dx) {
        const column = locale[nx];
        if (!column) throw new RangeError(`Invalid wall neighborhood column ${nx}`);
        if (locale[1][0] && locale[1][2] && column[0] && column[2]) return 0;
        return 1;
    }
    if (locale[0][1] && locale[2][1] && locale[0][ny] && locale[2][ny]) return 0;
    return 1;
}
function withinArea(x: number, y: number, area: WallArea | null): boolean {
    return !!area && x >= area.x1 && x <= area.x2
        && y >= area.y1 && y <= area.y2;
}

function wall_cleanup(x1: number, y1: number, x2: number, y2: number, protectedArea: WallArea | null = null): void {
    const map = game.level;
    if (!map) return;
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
            if (withinArea(x, y, protectedArea)) continue;
            const loc = map.at(x, y);
            if (!loc) continue;
            const typ = loc.typ;
            if (!(IS_WALL(typ) && typ !== DBWALL)) continue;
            if (isSolidTile(x-1,y-1) && isSolidTile(x-1,y) && isSolidTile(x-1,y+1)
                && isSolidTile(x,y-1) && isSolidTile(x,y+1)
                && isSolidTile(x+1,y-1) && isSolidTile(x+1,y) && isSolidTile(x+1,y+1))
                loc.typ = STONE;
        }
}
export function fix_wall_spines(x1: number, y1: number, x2: number, y2: number, wallOnlyArea: WallArea | null = null): void {
    const spineArray = [VWALL, HWALL, HWALL, HWALL,
        VWALL, TRCORNER, TLCORNER, TDWALL,
        VWALL, BRCORNER, BLCORNER, TUWALL,
        VWALL, TLWALL, TRWALL, CROSSWALL];
    const map = game.level;
    if (!map) return;
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
            const loc = map.at(x, y);
            if (!loc) continue;
            const typ = loc.typ;
            if (!(IS_WALL(typ) && typ !== DBWALL)) continue;
            const probe = withinArea(x, y, wallOnlyArea)
                ? isWallTile : isWallOrStone;
            const locale: WallNeighbors = [
                [probe(x-1,y-1), probe(x-1,y), probe(x-1,y+1)],
                [probe(x,y-1), 0, probe(x,y+1)],
                [probe(x+1,y-1), probe(x+1,y), probe(x+1,y+1)],
            ];
            const bits = (extend_spine(locale, isWallTile(x,y-1), 0, -1) << 3)
                | (extend_spine(locale, isWallTile(x,y+1), 0, 1) << 2)
                | (extend_spine(locale, isWallTile(x+1,y), 1, 0) << 1)
                | extend_spine(locale, isWallTile(x-1,y), -1, 0);
            if (bits) {
                const wallType = spineArray[bits];
                if (wallType === undefined) throw new RangeError(`Invalid wall spine mask ${bits}`);
                loc.typ = wallType;
            }
        }
}
function wallification(x1: number, y1: number, x2: number, y2: number, protectedArea: WallArea | null = null): void {
    wall_cleanup(x1, y1, x2, y2, protectedArea);
    fix_wall_spines(x1, y1, x2, y2, protectedArea);
}

// C ref: sp_lev.c wallify_map().  This is the producer half of Lua's
// des.wallify(): turn solid rock touching room terrain (including diagonals)
// into a provisional straight wall.  The ordinary wallification pass below
// then resolves corners and junctions.  Iterate y-major to preserve C's
// mutation order, although newly created walls do not themselves propagate.
export function wallifyMap(x1: number, y1: number, x2: number, y2: number): void {
    const level = requireGameLevel();
    const lowX = Math.max(x1, 1);
    const lowY = Math.max(y1, 0);
    const highX = Math.min(x2, COLNO - 1);
    const highY = Math.min(y2, ROWNO - 1);
    for (let y = lowY; y <= highY; y++) {
        const neighborLowY = y > 0 ? y - 1 : 0;
        const neighborHighY = y < highY ? y + 1 : highY;
        for (let x = lowX; x <= highX; x++) {
            const loc = level.at(x, y);
            if (loc?.typ !== STONE) continue;
            const neighborLowX = x > 1 ? x - 1 : 1;
            const neighborHighX = x < highX ? x + 1 : highX;
            let wallType = null;
            for (let yy = neighborLowY; yy <= neighborHighY
                && wallType == null; yy++) {
                for (let xx = neighborLowX; xx <= neighborHighX; xx++) {
                    const neighborType = level.at(xx, yy)?.typ ?? STONE;
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

function traptype_rnd({ spiderOnWeb = true }: SpecialTrapOptions): number {
    const lvl = level_difficulty();
    let kind = rnd(TRAPNUM - 1);
    switch (kind) {
    case TRAPPED_DOOR: case TRAPPED_CHEST: case MAGIC_PORTAL: case VIBRATING_SQUARE:
        kind = NO_TRAP; break;
    case ROLLING_BOULDER_TRAP: case SLP_GAS_TRAP:
        if (lvl < 2) kind = NO_TRAP; break;
    case LEVEL_TELEP:
        if (lvl < 5 || game.level?.flags?.noteleport
            || Is_knox_level(game.u.uz)) kind = NO_TRAP; break;
    case SPIKED_PIT:
        if (lvl < 5) kind = NO_TRAP; break;
    case LANDMINE:
        if (lvl < 6) kind = NO_TRAP; break;
    case WEB:
        if (lvl < 7 && spiderOnWeb) kind = NO_TRAP; break;
    case STATUE_TRAP: case POLY_TRAP:
        if (lvl < 8) kind = NO_TRAP; break;
    case FIRE_TRAP:
        if (!In_hell(game.u.uz))
            kind = NO_TRAP;
        break;
    case TELEP_TRAP:
        if (game.level?.flags?.noteleport) kind = NO_TRAP; break;
    case HOLE:
        if (rn2(7)) kind = NO_TRAP; break;
    }
    return kind;
}

function find_okay_roompos(croom: Room, crd: Position): boolean {
    let tryct = 0;
    do {
        if (++tryct > 200) return false;
        if (!somexyspace(croom, crd)) return false;
    } while (occupied(crd.x, crd.y) || bydoor(crd.x, crd.y));
    return true;
}

async function mktrap_victim(trap: Trap): Promise<void> {
    const lvl = level_difficulty();
    const kind = trap.ttyp;
    const x = trap.tx, y = trap.ty;
    // Object based on trap type.  These are floor objects, not just an RNG
    // side effect: a later pet, pickup, or display pass can observe the pile.
    let trapObject = null;
    switch (kind) {
    case ARROW_TRAP:
        trapObject = await mksobj(18, true, false);
        trapObject.opoisoned = 0;
        break;
    case DART_TRAP: trapObject = await mksobj(24, true, false); break;
    case ROCKTRAP: trapObject = await mksobj(ROCK, true, false); break;
    default: break;
    }
    if (trapObject) placeCreatedObject(trapObject, x, y);
    // Random items on victim
    do {
        const cls = [WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS][rn2(4)];
        if (cls === undefined) throw new RangeError('Trap victim object class is out of range.');
        const otmp = await mkobj(cls, false);
        curseObjectState(otmp);
        // mktrap_victim() treats PIT as an exploded landmine.  Its impact
        // test consumes obj_resists() before deciding whether a fragile item
        // survives, so both the call and the floor-chain mutation belong here.
        if (!(kind === PIT && trapVictimObjectBreaks(otmp))) {
            placeCreatedObject(otmp, x, y);
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
            const otmp = await mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
            otmp.quan = 1;
            curseObjectState(otmp);
            placeCreatedObject(otmp, x, y);
        }
        break;
    default: victim_mnum = PM_HUMAN; break;
    }
    if (victim_mnum === PM_HUMAN && rn2(25))
        victim_mnum = rn1(
            PM_WIZARD - PM_ARCHAEOLOGIST, PM_ARCHAEOLOGIST,
        );
    const corpse = await createCorpstatAt(
        CORPSE, null, victim_mnum, x, y, 8,
    ); // CORPSTAT_INIT
    // C makes every trap-victim corpse older than TAINT_AGE after creating
    // it.  The existing rot timer is intentionally left unchanged; dogfood()
    // observes the backdated age immediately and classifies it as unsafe.
    if (!corpse || corpse.age === undefined)
        throw new Error('Trap victim creation did not produce an aged corpse.');
    corpse.age -= 51; // TAINT_AGE + 1
}

// C refs: zap.c obj_resists() and dothrow.c breaktest().  This helper is
// private to the trap-victim generation block; its inputs are freshly made,
// non-invocation objects from the four possession classes above.
function trapVictimObjectBreaks(object: GameObject): boolean {
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

// C mktrap(): the room and maze callers share type selection, collision
// checks, web residents, and shallow-level victims.
async function mktrap(
    num: number, options: SpecialTrapOptions, croom: Room | null, coordinate: Position | null,
): Promise<Trap | null> {
    const level = requireGameLevel();
    // Explicit locations are screened before type selection. Room and maze
    // callers select the type first, then search for an unoccupied square.
    if (coordinate && (isPoolAt(coordinate.x, coordinate.y)
        || isLavaAt(coordinate.x, coordinate.y))) return null;
    let kind;
    if (num > NO_TRAP && num < TRAPNUM) {
        kind = num;
    } else if (Is_rogue_level(game.u.uz)) {
        kind = [BEAR_TRAP, ARROW_TRAP, DART_TRAP, TRAPDOOR,
            PIT, SLP_GAS_TRAP, RUST_TRAP][rn2(7)];
    } else if (In_hell(game.u.uz)
        && !rn2(5)) kind = FIRE_TRAP;
    else do { kind = traptype_rnd(options); } while (kind === NO_TRAP);
    if (kind === undefined) throw new RangeError('Rogue trap selection is out of range.');
    if (is_hole(kind) && !canFallThrough()) kind = ROCKTRAP;
    const pos = coordinate ? { ...coordinate } : { x: 0, y: 0 };
    if (!coordinate) {
        const avoidBoulder = is_pit(kind) || is_hole(kind);
        let attempts = 0;
        do {
            if (++attempts > 200) return null;
            if (croom) {
                if (!somexyspace(croom, pos)) return null;
            } else {
                const point = mazeFloorPoint();
                pos.x = point.x;
                pos.y = point.y;
            }
        } while (occupied(pos.x, pos.y)
            || (avoidBoulder && level.objects[pos.x]?.[pos.y]
                ?.some(object => object.otyp === BOULDER)));
    }
    const trap = await maketrap(pos.x, pos.y, kind);
    return await finishLevelTrapConstruction(trap, options);
}

function mkfount(croom: Room): void {
    const level = requireGameLevel();
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos)) return;
    const loc = level.at(pos.x, pos.y);
    if (loc) {
        loc.typ = FOUNTAIN;
        if (!rn2(7)) loc.blessedftn = 1;
        level.flags.nfountains++;
    }
}

function mkaltar(croom: Room | null): void {
    if (!croom || croom.rtype !== OROOM) return;
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos)) return;
    const loc = game.level?.at(pos.x, pos.y);
    if (!loc) return;
    loc.typ = ALTAR;
    const al = rn2(A_LAWFUL + 2) - 1;
    loc.flags = Align2amask(al);
}

async function mkgrave_room(croom: Room): Promise<void> {
    const dobell = !rn2(10);
    if (croom.rtype !== OROOM) return;
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos)) return;
    make_grave(pos.x, pos.y, dobell ? 'Saved by the bell!' : null);
    if (!rn2(3)) {
        const gold = await mksobj(GOLD_PIECE, true, false);
        if (gold) {
            gold.quan = gold.quantity = rnd(20)
                + level_difficulty() * rnd(5);
            gold.owt = objectWeight(gold);
            addBuriedObject(gold, pos.x, pos.y);
        }
    }
    for (let tryct = rn2(5); tryct > 0; tryct--) {
        const otmp = await mkobj(RANDOM_CLASS, true);
        curseObjectState(otmp);
        addBuriedObject(otmp, pos.x, pos.y);
    }
    if (dobell) await mksobj_at(BELL, pos.x, pos.y, true, false);
}

async function fillRandomRoomObjects(croom: Room, pos: Position): Promise<void> {
    if (!rn2(3) && somexyspace(croom, pos)) {
        await mkobj_at(RANDOM_CLASS, pos.x, pos.y, true);
        let objTrycnt = 0;
        while (!rn2(5)) {
            if (++objTrycnt > 100) break;
            if (somexyspace(croom, pos))
                await mkobj_at(RANDOM_CLASS, pos.x, pos.y, true);
        }
    }
}

export async function fill_ordinary_room(croom: Room | null | undefined, bonus_items: boolean): Promise<void> {
    const g = game;
    if (!croom || (croom.rtype !== OROOM && croom.rtype !== THEMEROOM)) return;
    const level = requireGameLevel();
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
        await mktrap(NO_TRAP, {}, croom, null);
    }
    // Gold
    if (!rn2(3) && somexyspace(croom, pos)) {
        await mkgold(0, pos.x, pos.y);
    }
    // Rogue levels skip furniture, statues, bonus/chest construction, and
    // graffiti, then rejoin the ordinary random-object tail.
    if (Is_rogue_level(g.u?.uz)) {
        await fillRandomRoomObjects(croom, pos);
        return;
    }
    // Fountain
    if (!rn2(10)) mkfount(croom);
    // Sink
    if (!rn2(60)) {
        if (find_okay_roompos(croom, pos)) {
            const loc = level.at(pos.x, pos.y);
            if (loc) { loc.typ = SINK; level.flags.nsinks = (level.flags.nsinks || 0) + 1; }
        }
    }
    // Altar
    if (!rn2(60)) mkaltar(croom);
    // Grave
    x = 80 - (depth_of_level(g.u?.uz) * 2);
    if (x < 2) x = 2;
    if (!rn2(x)) await mkgrave_room(croom);
    // Statue
    if (!rn2(20) && somexyspace(croom, pos)) {
        await createCorpstatAt(STATUE, null, null, pos.x, pos.y, 8);
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
            await mksobj_at((rn2(5) < 3) ? FOOD_RATION : rn2(2) ? CRAM_RATION : LEMBAS_WAFER,
                pos.x, pos.y, true, false);
        } else if ((g.u?.uz?.dnum ?? 0) === (g.oracle_level?.dnum ?? 0)
            && (g.u?.uz?.dlevel ?? 1) < oracle_dlevel && rn2(3)) {
            // Supply chest
            const supply_chest = await mksobj_at(rn2(3) ? CHEST : LARGE_BOX, pos.x, pos.y, false, false);
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
                    if (otyp === undefined) throw new RangeError('Supply chest object selection is out of range.');
                    const otmp = await mksobj(otyp, true, false);
                    if (otmp && otyp === POT_HEALING && rn2(2)) {
                        otmp.quan = otmp.quantity = 2;
                    }
                    cursed_item = otmp?.cursed ?? false;
                    await addToContainer(supply_chest, otmp);
                    if (++tryct2 >= 50) break;
                } while (cursed_item || !rn2(5));
                if (rn2(3)) {
                    const extra_classes = [FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS,
                        SCROLL_CLASS, POTION_CLASS, RING_CLASS,
                        SPBOOK_no_NOVEL, SPBOOK_no_NOVEL, SPBOOK_no_NOVEL];
                    const oclass = extra_classes[rn2(extra_classes.length)];
                    if (oclass === undefined) throw new RangeError('Supply chest class selection is out of range.');
                    let otmp = await mkobj(oclass, false);
                    if (oclass === SPBOOK_no_NOVEL && otmp) {
                        const depth = g.u?.uz?.dlevel ?? 1;
                        const maxpass = (depth > 2) ? 2 : 3;
                        for (let pass = 1; pass <= maxpass; pass++) {
                            const candidate = await mkobj(oclass, false);
                            if ((OBJECT_SPELL_LEVEL[candidate.otyp] ?? 0)
                                < (OBJECT_SPELL_LEVEL[otmp.otyp] ?? 0)) {
                                otmp = candidate;
                            }
                        }
                    }
                    await addToContainer(supply_chest, otmp);
                }
                supply_chest.owt = objectWeight(supply_chest);
            }
            skip_chests = true;
        }
    }
    // Box/chest check
    if (!skip_chests && !rn2(Math.trunc(level.nroom * 5 / 2)) && somexyspace(croom, pos)) {
        await mksobj_at(rn2(3) ? LARGE_BOX : CHEST, pos.x, pos.y, true, false);
    }
    // Graffiti
    const depth = g.u?.uz?.dlevel ?? 1;
    if (!rn2(27 + 3 * Math.abs(depth))) {
        const { text: engrText, pristine } = randomEngraving();
        if (engrText) {
            do {
                somexyspace(croom, pos);
                if (level.at(pos.x, pos.y)?.typ === ROOM) break;
            } while (!rn2(40));
            if (level.at(pos.x, pos.y)?.typ === ROOM)
                make_engr_at(pos.x, pos.y, engrText, pristine, 0, MARK);
        }
    }
    await fillRandomRoomObjects(croom, pos);
}

// ============================================================
// Mineralize
// ============================================================

function water_has_kelp(x: number, y: number, kelp_pool: number, kelp_moat: number): boolean {
    const loc = requireGameLevel().at(x, y);
    if (!loc) return false;
    if (kelp_pool && (loc.typ === POOL
        || (loc.typ === WATER && !Is_waterlevel(game.u.uz)))
        && !rn2(kelp_pool)) return true;
    if (kelp_moat && loc.typ === MOAT && !rn2(kelp_moat)) return true;
    return false;
}

async function mineralize_kelp(kelp_pool: number, kelp_moat: number): Promise<void> {
    if (kelp_pool < 0) kelp_pool = 10;
    if (kelp_moat < 0) kelp_moat = 30;
    for (let x = 2; x < COLNO - 2; x++)
        for (let y = 1; y < ROWNO - 1; y++)
            if (water_has_kelp(x, y, kelp_pool, kelp_moat))
                await mksobj_at(KELP_FROND, x, y, true, false);
}

async function mineralize(
    kelp_pool: number, kelp_moat: number, goldprob: number, gemprob: number, skip_lvl_checks: boolean,
): Promise<void> {
    const map = requireGameLevel();
    if (!skip_lvl_checks && In_endgame(game.u.uz)) return;
    await mineralize_kelp(kelp_pool, kelp_moat);
    // A Lua fill script is still an ordinary depth. Native mineral admission
    // uses the dungeon graph's named descriptor, not the script's map flag.
    const special = specialLevelAt();
    if (!skip_lvl_checks && (In_hell(game.u.uz) || In_V_tower(game.u.uz)
        || Is_rogue_level(game.u.uz) || map.flags.arboreal
        || (special && !Is_oracle_level(game.u.uz)
            && (!In_mines(game.u.uz) || special.flags.town)))) return;
    const absDepth = depth_of_level(game.u?.uz);
    const dunLevel = game.u?.uz?.dlevel ?? 1;
    if (goldprob < 0) goldprob = 20 + Math.trunc(absDepth / 3);
    if (gemprob < 0) gemprob = Math.trunc(goldprob / 4);
    if (!skip_lvl_checks) {
        if (In_mines(game.u.uz)) {
            goldprob *= 2;
            gemprob *= 3;
        } else if (In_quest(game.u.uz)) {
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
            const stoneNeighbor = (dx: number, dy: number): boolean =>
                map.at(x + dx, y + dy)?.typ === STONE;
            if (!(loc.wall_info & W_NONDIGGABLE)
                && stoneNeighbor(0, -1) && stoneNeighbor(1, -1) && stoneNeighbor(-1, -1)
                && stoneNeighbor(1, 0) && stoneNeighbor(-1, 0)
                && stoneNeighbor(1, 1) && stoneNeighbor(-1, 1)) {
                if (rn2(1000) < goldprob) {
                    const otmp = await mksobj(GOLD_PIECE, false, false);
                    otmp.quan = 1 + rnd(goldprob * 3);
                    otmp.quantity = otmp.quan;
                    otmp.owt = objectWeight(otmp);
                    if (rn2(3) === 0) {
                        addBuriedObject(otmp, x, y);
                    } else {
                        placeCreatedObject(otmp, x, y);
                    }
                }
                if (rn2(1000) < gemprob) {
                    const cnt = rnd(2 + Math.trunc(dunLevel / 3));
                    for (let i = 0; i < cnt; i++) {
                        const gem = await mkobj(GEM_CLASS, false);
                        // Rocks selected from GEM_CLASS are discarded rather
                        // than buried or placed.
                        if (gem.otyp === ROCK) deallocateObject(gem);
                        else {
                            if (rn2(3) === 0) {
                                addBuriedObject(gem, x, y);
                            } else {
                                placeCreatedObject(gem, x, y);
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

function get_level_extends(): { xmin: number; xmax: number; ymin: number; ymax: number } {
    const map = requireGameLevel();
    let xmin = 0, xmax = COLNO - 1, ymin = 0, ymax = ROWNO - 1;
    let found = false, nonwall = false;
    for (xmin = 0; !found && xmin <= COLNO - 1; xmin++) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmin, y)?.typ ?? STONE;
            if (typ !== STONE) { found = true; if (!IS_WALL(typ)) nonwall = true; }
        }
    }
    xmin -= (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    xmin = Math.max(0, xmin);
    found = false; nonwall = false;
    for (xmax = COLNO - 1; !found && xmax >= 0; xmax--) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmax, y)?.typ ?? STONE;
            if (typ !== STONE) { found = true; if (!IS_WALL(typ)) nonwall = true; }
        }
    }
    xmax += (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    xmax = Math.min(COLNO - 1, xmax);
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

function bound_digging(): void {
    if (Is_earthlevel(game.u.uz)) return;
    const map = requireGameLevel();
    const { xmin, xmax, ymin, ymax } = get_level_extends();
    for (let x = 0; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (!loc) continue;
            if (!IS_STWALL(loc.typ)) continue;
            if (y <= ymin || y >= ymax || x <= xmin || x >= xmax)
                loc.wall_info |= W_NONDIGGABLE;
            if (y < ymin || y > ymax || x < xmin || x > xmax)
                loc.wall_info |= W_NONPASSWALL;
        }
}


async function level_finalize_topology(): Promise<void> {
    const level = requireGameLevel();
    bound_digging();
    await mineralize(-1, -1, -1, -1, false);
    game.in_mklev = false;
    if (level.flags.has_morgue)
        level.flags.graveyard = true;
    if (!level.flags.is_maze_lev) {
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room)) topologize(room);
    }
    setWallState();
    for (const room of level.rooms) {
        if (isRoom(room)) room.orig_rtype = room.rtype;
    }
}
