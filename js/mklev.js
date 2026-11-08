// mklev.js — regular level generation.
// C ref: mklev.c — mklev, makelevel, makerooms, makecorridors,
// generate_stairs, fill_ordinary_room, mineralize, level_finalize_topology.
// sp_lev.c special-level construction lives in sp_lev.ts;
// mkmaze.c mazes and special-level fixups in mkmaze.ts; mkroom.c special
// room selection and filling in mkroom.ts; bones.c in bones.ts; the Rogue
// level (extralev.c) in extralev.ts; stairs.c stairway management in
// stairs.ts. Level construction uses the game's main random-number stream.
import { stack_object } from './invent.js';
import { RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, GEM_CLASS, SPBOOK_no_NOVEL, } from './objclass.js';
import { recorderLocalEpochSeconds, recorderTimestamp } from './calendar.js';
import { rotCorpse } from './dig.js';
import { mksobj, mksobj_at, mkobj, mkobj_at, mkgold, mkcorpstat, set_corpsenm, rndmonnum, rndmonnumAdj, linkObjectToMonsterInventory, curseObjectState, deallocateObject, objectWeight, nextIdent, placeCreatedObject, updateIceObjectTimersAt, addBuriedObject } from './mkobj.js';
import { restoreMonsterInventoryOwnership } from './mon.js';
import { oinit, objectMaterial } from './o_init.js';
import { isRoom } from './map_types.js';
import { restoreLevelTimers, stopLevelTimer } from './timeout.js';
import { deleteTrap, finishSokobanIfSolved, fillPitWithBoulderAt, mintrap, resetUtrap, maketrap } from './trap.js';
import { roguePlayerName, setMonsterGivenName } from './do_name.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { makemon, mkclass, setMimicAppearance, setMonsterMalign } from './makemon.js';
import { addFruit } from './message_types.js';
import { set_tin_variety } from './eat.js';
import { monsterHasMapPosition, monsterAtPosition, monsterOccupiesPosition } from './steed.js';
import { nameObjectFromTopten } from './topten.js';
import { normalDemon } from './minion.js';
import { randomMonsterRelocation } from './teleport.js';
import { restoreLevelChains, restoreMonsterWormHeads, validMonsterWormBodies } from './restore.js';
import { restoreLevelPetHistory } from './restore.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { panic } from './end.js';
import { PanicTermination } from './panic_termination.js';
import { finishHeroDeath } from './end.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { buriedBallToPunishment, buryObject, unearthFloorObjectsAt } from './dig.js';
import { GameMap } from './game.js';
import { ageStoresFuel } from './pickup.js';
import { decodeBonesPayload } from './bones_validation.js';
import { encodeSavedGraph } from './saved_graph.js';
import { rn2, rnd, rn1 } from './rng.js';
import { SHOP_TYPES, RANDOM_SHOP_TYPES } from './shknam.js';
import { GP_ALLOW_XY, GP_CHECKSCARY, RLOC_ERR, RLOC_NOMSG, PL_NSIZ, A_CHA, COLNO, ROWNO, STONE, MAX_TYPE, ROOM, CORR, DOOR, STAIRS, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED, OROOM, VAULT, COURT, SWAMP, BEEHIVE, MORGUE, BARRACKS, ZOO, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, THEMEROOM, SHOPBASE, ROOMOFFSET, MAXNROFROOMS, SHARED, SDOOR, SCORR, IRONBARS, FOUNTAIN, SINK, ALTAR, GRAVE, THRONE, HEADSTONE, MARK, DUST, DIR_N, DIR_S, DIR_E, DIR_W, DIR_180, XL_UP, XL_DOWN, XL_LEFT, XL_RIGHT, IS_WALL, IS_STWALL, COULD_SEE, IN_SIGHT, IS_DOOR, IS_ROOM, IS_OBSTRUCTED, ZAP_POS, IS_FURNITURE, IS_POOL, IS_AIR, IS_LAVA, In_endgame, Is_earthlevel, Is_stronghold, Is_oracle_level, Is_waterlevel, Is_knox_level, Is_rogue_level, SPACE_POS, W_NONDIGGABLE, W_NONPASSWALL, FILL_NORMAL, ICE, MOAT, POOL, WATER, LAVAPOOL, LAVAWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DBWALL, ICED_POOL, ICED_MOAT, DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_MOAT, DB_LAVA, DB_UNDER, DB_FLOOR, SHOP_HOLE_COST, AIR, TRICKED, A_NONE, A_LAWFUL, AM_SHRINE, Align2amask, LR_DOWNSTAIR, LR_UPSTAIR, LR_UPTELE, LR_DOWNTELE, LR_TELE, LR_BRANCH, LR_PORTAL, MM_ASLEEP, MM_NOGRP, MM_EPRI, MM_ESHK, MM_IGNOREWATER, MM_NOCOUNTBIRTH, MM_NOMSG, MM_EDOG, NO_MINVENT, G_EXTINCT, G_GENOD, G_GONE, HEALTHY_TIN, ANTI_MAGIC, TT_BURIEDBALL, TT_BEARTRAP, TT_WEB, TT_PIT, TT_LAVA, LEVEL_TIMER_KIND, OBJECT_TIMER_KIND, is_hole, is_pit } from './const.js';
import { isok } from './cmd.js';
import { init_rect, rnd_rect } from './rect.js';
import { Is_botlevel, depth as depth_of_level, dungeonDepth, inducedAlignment, is_branchlev, ledgerNo, level_difficulty, placeHeroOnLevel, specialLevelAt, u_on_rndspot, canFallThrough, In_quest, In_mines, In_V_tower, In_hell, Invocation_lev } from './dungeon.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, LARGE_BOX, CHEST, ICE_BOX, TALLOW_CANDLE, WAX_CANDLE, EXPENSIVE_CAMERA, CORPSE, EGG, KELP_FROND, SLIME_MOLD, MELON, LUMP_OF_ROYAL_JELLY, CREAM_PIE, TIN, GOLD_PIECE, SPE_NOVEL, TOUCHSTONE, ROCK, BOULDER, STATUE, MACE, RING_MAIL, ROBE, CLOAK_OF_PROTECTION, CLOAK_OF_MAGIC_RESISTANCE, oc_level } from './object_data.js';
import { MONSTER_DIFFICULTY, MONSTER_GENO, MONSTER_ALIGNMENT, MONSTER_LEVEL, MONSTER_FLAGS2, MONSTER_SYMBOL, MONSTER_NAME } from './monster_data.js';
import { nhgetch } from './input.js';
import { flush_screen, newsym, back_to_glyph, canOverwriteTerrain, set_wall_state } from './display.js';
import { pline, plineWithContinuation, impossible } from './pline.js';
import { premap_detect, convertSecretDoor } from './detect.js';
import { deleteEngravingAt, makeEngravingAt, make_grave, randomEngraving, restoreEngravings, sanitizeEngravings, wipeEngravingAt } from './engrave.js';
import { addObjectToMonsterInventory } from './steal.js';
import { insideShopRoomAt, addShopDamage, fixShopDamage, deleteObject } from './shk.js';
import { PM_SOLDIER, antholeMonsterType, do_mkroom, roomHasStair, somex, somey, somexyspace, insideRoom } from './mkroom.js';
import { bound_digging, generateAstralLevel, generateBigRoom, generateDungeonMazeFile, generateElementalPlane, generateFakeWizardLevel, generateKnoxLevel, generateLuaQuestLevel, generateMedusaLevel, generateMinesEnd, generateMinetown, generateOracleLevel, generateRandomMaze, generateSokobanLevel, generateSpecialAndFixup, generateVladsTowerLevel, generateWizardLevel, isLuaQuestPrototype, mazeFloorPoint, mkportal, place_lregion, setLevelTerrainType, wallification } from './mkmaze.js';
import { getbones, levelAllowsBones, restoreBonesMonsters } from './bones.js';
import { makeroguerooms, makerogueghost } from './extralev.js';
import { restoreLevelRegions } from './region.js';
import { beginObjectBurn } from './timeout.js';
import { vision_note_blocker_change, vision_reset_new_level } from './vision.js';
import { goodPosition, enexto, enexto_gpflags } from './teleport.js';
import { isIceAt, isLavaAt, isPoolAt, isPoolOrLavaAt } from './dbridge.js';
import { addToContainer, beginLuaThemerooms, callLuaThemerooms, check_room, create_room, dig_corridor, fill_special_room, fillVault, finishLevelTrapConstruction, load_special, medusaPetrifiable, putGeneratedMonsterInventoryInStatue, themerooms_generate } from './sp_lev.js';
import { finishHeroLiquidMonsterDeath, finishMonsterLiquidDeath, purgeDeadMonsters, removeMonsterFromGame, resolveMonsterLiquid, revealMonsterAppearance, sendMonsterToLimbo } from './mon.js';
import { fractureRock } from './zap.js';
import { flushPendingTopline } from './topl.js';
import { stairway_add, stairway_free_all } from './stairs.js';
import { switchHeroTerrain, roomsAt } from './hack.js';
import { is_domestic } from './mondata.js';
export const G_NOGEN = 0x0200;
export const G_IGNORE = 0x8000;
export const SCR_TELEPORTATION = 333;
export const RIN_TELEPORTATION = 194;
const BELL = 255;
export const CANDELABRUM_OF_INVOCATION = 262;
export const PM_VAMPIRE_BAT = 129;
// Supply chest items
const POT_HEALING = 307;
const POT_EXTRA_HEALING = 308;
const POT_SPEED = 302;
const POT_GAIN_ENERGY = 313;
const SCR_ENCHANT_WEAPON = 328;
const SCR_ENCHANT_ARMOR = 323;
const SCR_CONFUSE_MONSTER = 325;
const SCR_SCARE_MONSTER = 326;
export const WAN_DIGGING = 428;
const SPE_HEALING = 374;
const FOOD_RATION = 293;
const CRAM_RATION = 292;
const LEMBAS_WAFER = 291;
export const WAN_TELEPORTATION = 424;
export const PM_GIANT_SPIDER = 96;
export const PM_MINOTAUR = 177;
export const PM_FIRE_ELEMENTAL = 155;
export const PM_VAMPIRE = 226;
export const PM_VLAD_THE_IMPALER = 228;
const PM_ARCHAEOLOGIST = 331;
const PM_WIZARD = 343;
export const PM_SALAMANDER = 329;
export const S_MIMIC = 13;
export const PM_BLACK_LIGHT = 119;
export const PM_STALKER = 153;
export const XLIM = 4;
export const YLIM = 3;
// Direction deltas
export const xdir = [-1, -1, 0, 1, 1, 1, 0, -1];
export const ydir = [0, -1, -1, -1, 0, 1, 1, 1];
// Trap constants
export const NO_TRAP = 0;
export const TRAPNUM = 26;
const ARROW_TRAP = 1;
const DART_TRAP = 2;
export const ROCKTRAP = 3;
export const SQKY_BOARD = 4;
const BEAR_TRAP = 5;
export const LANDMINE = 6;
export const ROLLING_BOULDER_TRAP = 7;
const SLP_GAS_TRAP = 8;
export const RUST_TRAP = 9;
const FIRE_TRAP = 10;
export const PIT = 11;
const SPIKED_PIT = 12;
export const HOLE = 13;
export const TRAPDOOR = 14;
export const TELEP_TRAP = 15;
export const LEVEL_TELEP = 16;
export const MAGIC_PORTAL = 17;
export const WEB = 18;
const STATUE_TRAP = 19;
export const MAGIC_TRAP = 20;
const POLY_TRAP = 22;
export const VIBRATING_SQUARE = 23;
const TRAPPED_DOOR = 24;
const TRAPPED_CHEST = 25;
// Part of C makemon.c:makemon(): adapter for nearby placement through teleport.c:enexto() before monster construction.
// C refs: teleport.c enexto()/collect_coords() and makemon.c makemon().
export async function makemonNear(mnum, centerX, centerY, flags = 0, requestedByHero = centerX === game.u?.ux && centerY === game.u?.uy) {
    // Hero-origin placement belongs to makemon(), after its debug guard.
    // Other callers, such as egg hatching, call enexto() before makemon().
    if (requestedByHero && game.iflags.debug_mongen)
        return null;
    const pos = enexto_gpflags(mnum, centerX, centerY, flags & MM_IGNOREWATER);
    if (!pos)
        return null;
    // teleport.c:enexto_core() tests every shuffled coordinate through
    // goodpos() for the requested species before makemon() owns construction.
    return makemon(mnum, pos.x, pos.y, flags, requestedByHero);
}
// Part of C do.c:revive_corpse(): the deferred fill_pit tail after the
// revived zombie's presentation.
export async function finishBuriedZombieTimer(event, state = game) {
    if (!event || event.kind !== 'revived' || event.finished)
        return event;
    if (!event.monster)
        throw new Error('A revived corpse has no monster');
    const x = event.monster.mx, y = event.monster.my;
    const result = await fillPitWithBoulderAt(x, y, state);
    event.finished = true;
    event.pitFilled = result.filled;
    event.filledByBoulder = result.filled ? result.boulder : null;
    event.buriedFloorObjects = result.buriedFloorObjects;
    return event;
}
// C mklev.c:mklev()
export async function mklev() {
    const g = game;
    if (await getbones())
        return;
    if (g.program_state.gameover)
        return;
    g.in_mklev = true;
    await makelevel();
    await currentLuaLifecycle().runCallbacks(g, 'level_enter');
    await level_finalize_topology();
    g.in_mklev = false;
    // C pairs mklev() with vision_reset() (allmain.c) before anything can
    // query sight, so the blocker dig table never outlives the level it
    // was built for. Direct mklev() callers get that same fresh table here.
    vision_reset_new_level();
}
// C mklev.c:count_level_features():
export function countLevelFeatures(state = game) {
    const lvl = state.level;
    if (!lvl?.flags)
        return;
    let nfountains = 0, nsinks = 0;
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++) {
            const typ = lvl.at(x, y)?.typ;
            if (typ === FOUNTAIN)
                nfountains++;
            if (typ === SINK)
                nsinks++;
        }
    lvl.flags.nfountains = nfountains;
    lvl.flags.nsinks = nsinks;
}
// C mklev.c:clear_level_structures()
// Also C region.c:clear_regions(): a fresh GameMap owns no regions.
// Also C dungeon.c:free_exclusions(): a fresh GameMap owns no exclusion zones.
// C stairs.c:stairway_free_all() drops the freed chain below.
function clear_level_structures() {
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
    stairway_free_all();
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
// Part of C mklev.c:makelevel(): the generation driver; placeRoomLevelBranch() already holds the first-line citation.
// C ref: mklev.c makelevel()
// Also C mklev.c:themerooms_post_level_generate(): inlined here (the
// post_level_generate theme call plus whole-level wallification).
async function makelevel() {
    const g = game;
    oinit();
    clear_level_structures();
    const level = requireGameLevel();
    const location = g.u.uz;
    if (!location)
        throw new Error('Level generation requires the hero dungeon location.');
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
        const align = ['law', 'neutral', 'chaos'];
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
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fill_special_room(room);
            return;
        }
        if (prototype === 'knox') {
            await generateKnoxLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'asmodeus') {
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            return;
        }
        if (prototype === 'juiblex') {
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fill_special_room(room);
            return;
        }
        if (prototype === 'baalz') {
            g._activeSpecialLevel.baalzFixup = true;
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            return;
        }
        if (prototype === 'orcus') {
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fill_special_room(room);
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
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fill_special_room(room);
            return;
        }
        if (prototype === 'sanctum') {
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fill_special_room(room);
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
            await generateSpecialAndFixup(load_special, g._activeSpecialLevel);
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
        if (!role || !locate)
            throw new Error('Quest generation requires the role and locate level.');
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
        if (level.nroom <= 0)
            return;
        sort_rooms();
        await generate_stairs();
        const branchp = is_branchlev(game.u.uz);
        await placeRoomLevelBranch(branchp);
        // C ref: mklev.c makelevel() skip0 tail.  C still counts
        // ROOM_IS_FILLABLE rooms and draws the bonus-room selection here,
        // but savelev() memsets svr.rooms when the previous level is
        // released (save.c:564, reached from goto_level and #wizmakemap),
        // so Rogue rooms always start with needfill FILL_NONE and the
        // count is zero: every room is offered to fill_ordinary_room with
        // no bonus flag and returns at its needfill gate.
        for (const croom of level.rooms.slice(0, level.nroom))
            if (isRoom(croom))
                await fill_ordinary_room(croom, false);
        for (const croom of level.rooms.slice(0, level.nroom))
            if (isRoom(croom))
                await fill_special_room(croom);
        return;
    }
    // Regular level generation
    const themedRooms = await beginLuaThemerooms();
    await makerooms(themedRooms);
    if (level.nroom <= 0)
        return;
    sort_rooms();
    await generate_stairs();
    // Branch check
    const branchp = is_branchlev(game.u.uz);
    let roomThreshold = branchp ? 4 : 3;
    await makecorridors();
    await make_niches();
    // Restore the reserved vault after corridors and niches are complete.
    if (g.vault_x !== undefined && g.vault_x !== -1) {
        if (g.vault_y === undefined)
            throw new Error('Vault reservation has no y coordinate.');
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
            if (!level.flags.noteleport && !rn2(3))
                await makeniche(TELEP_TRAP);
        };
        if (check_room(vx, vw, vy, vh, true)) {
            await finishVault();
        }
        else if (rnd_rect()) {
            // C retries the reserved vault in the remaining free rectangle.
            // A successful reservation is only provisional: makelevel copies
            // its coordinates and re-enters the same check/fill block.
            const reserved = create_room(-1, -1, 2, 2, -1, -1, VAULT, true);
            if (reserved) {
                const candidate = level.rooms[level.nroom];
                vx.v = g.vault_x = candidate?.lx ?? -1;
                vy.v = g.vault_y = candidate?.ly ?? -1;
                if (check_room(vx, vw, vy, vh, true))
                    await finishVault();
                else if (candidate)
                    level.rooms[level.nroom] = { ...candidate, hx: -1 };
            }
        }
    }
    // C ref: mklev.c makelevel() -> mkroom.c mkshop().  On shallow regular
    // levels the only eligible random special room is a shop.  Selecting it
    // here is stateful: it changes topology and excludes the room from the
    // ordinary-room bonus and filling passes below.
    await maybeMakeSpecialRoom(roomThreshold);
    // Place dungeon branch
    await placeRoomLevelBranch(branchp);
    // Choose one ordinary room for a level-specific bonus item, then fill all
    // ordinary rooms.  The choice uses the rooms on this level.
    const fillableRooms = level.rooms
        .slice(0, level.nroom)
        .filter((room) => isRoom(room)
        && (room.rtype === OROOM || room.rtype === THEMEROOM)
        && room.needfill === FILL_NORMAL);
    let bonusItemRoomCountdown = fillableRooms.length
        ? rn2(fillableRooms.length) : -1;
    for (const croom of level.rooms.slice(0, level.nroom)) {
        if (!isRoom(croom))
            continue;
        const fillable = (croom.rtype === OROOM || croom.rtype === THEMEROOM)
            && croom.needfill === FILL_NORMAL;
        await fill_ordinary_room(croom, fillable && bonusItemRoomCountdown === 0);
        if (fillable)
            bonusItemRoomCountdown--;
    }
    // C defers all special-room stocking until ordinary rooms are filled.
    // Room order matters: this level's shop is stocked before the vault's
    // second fill pass, and both precede mineralization.
    for (const croom of level.rooms.slice(0, level.nroom))
        if (isRoom(croom))
            await fill_special_room(croom);
    if (themedRooms) {
        await callLuaThemerooms('post_level_generate');
        // A loaded theme interpreter wallifies the complete level, including
        // walls placed inside rooms by terrain callbacks such as "Pillars".
        wallification(1, 0, COLNO - 1, ROWNO - 1);
    }
}
// C mklev.c:mk_knox_portal()
// Fort Ludios starts with an out-of-range
// source dnum.  Each otherwise eligible vault owns one deferral draw until a
// deep main-dungeon vault resolves that source; subsequent vaults skip it.
async function maybePlaceKnoxPortal(x, y) {
    const dungeons = game.dungeons || [];
    const branch = game.branches?.find(candidate => dungeons[candidate?.end2?.dnum]?.dname === 'Fort Ludios');
    if (!branch)
        return false;
    const onKnoxSourceEnd = game.knox_level
        && branch.end1?.dnum === game.knox_level.dnum
        && branch.end1?.dlevel === game.knox_level.dlevel;
    const source = onKnoxSourceEnd ? branch.end2 : branch.end1;
    if (!onKnoxSourceEnd && is_branchlev(game.u.uz))
        return false;
    if ((source?.dnum ?? -1) < dungeons.length)
        return false;
    const deferred = rn2(3);
    if (deferred && !game.flags?.debug)
        return false;
    const here = game.u?.uz || { dnum: 0, dlevel: 1 };
    const hereDepth = depth_of_level(here);
    const medusaDepth = depth_of_level(game.medusa_level);
    if (here.dnum !== game.oracle_level?.dnum
        || hereDepth <= 10 || hereDepth >= medusaDepth)
        return false;
    if (onKnoxSourceEnd)
        branch.end2 = { ...here };
    else
        branch.end1 = { ...here };
    await place_branch(branch, x, y);
    return true;
}
// C mklev.c:occupied():
export function occupied(x, y, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return false;
    const trapped = state.level?.traps?.some(trap => trap.tx === x && trap.ty === y);
    return !!(trapped || IS_FURNITURE(location.typ)
        || isPoolOrLavaAt(x, y, state));
}
// Part of C mklev.c:makelevel(): the depth-dependent random special-room selection.
// C ref: mklev.c makelevel() random-special-room else-if chain.  Every failed
// depth-eligible predicate owns its draw; once one type is selected, room
// picking becomes mkroom.c's responsibility and later predicates are skipped.
async function maybeMakeSpecialRoom(roomThreshold) {
    const uDepth = depth_of_level(game.u?.uz);
    const medusaDepth = depth_of_level(game.medusa_level);
    if (uDepth > 1 && uDepth < medusaDepth
        && requireGameLevel().nroom >= roomThreshold && rn2(uDepth) < 3)
        return do_mkroom(SHOPBASE);
    if (uDepth > 4 && !rn2(6))
        return do_mkroom(COURT);
    if (uDepth > 5 && !rn2(8)
        && !((game.mvitals?.[MONSTER_NAME.indexOf('leprechaun')]?.mvflags ?? 0) & G_GONE))
        return do_mkroom(LEPREHALL);
    if (uDepth > 6 && !rn2(7))
        return do_mkroom(ZOO);
    if (uDepth > 8 && !rn2(5))
        return do_mkroom(TEMPLE);
    if (uDepth > 9 && !rn2(5)
        && !((game.mvitals?.[MONSTER_NAME.indexOf('killer bee')]?.mvflags ?? 0) & G_GONE))
        return do_mkroom(BEEHIVE);
    if (uDepth > 11 && !rn2(6))
        return do_mkroom(MORGUE);
    if (uDepth > 12 && !rn2(8) && antholeMonsterType() !== null)
        return do_mkroom(ANTHOLE);
    if (uDepth > 14 && !rn2(4)
        && !((game.mvitals?.[PM_SOLDIER]?.mvflags ?? 0) & G_GONE))
        return do_mkroom(BARRACKS);
    if (uDepth > 15 && !rn2(6))
        return do_mkroom(SWAMP);
    if (uDepth > 16 && !rn2(8)
        && !((game.mvitals?.[MONSTER_NAME.indexOf('cockatrice')]?.mvflags ?? 0) & G_GONE))
        return do_mkroom(COCKNEST);
    return false;
}
// C mklev.c:makerooms()
async function makerooms(themedRooms) {
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
                if (reserved)
                    level.rooms[level.nroom] = { ...reserved, hx: -1 };
            }
        }
        else if (themedRooms) {
            g.in_mk_themerooms = true;
            const generated = await themerooms_generate();
            g.in_mk_themerooms = false;
            if (!generated) {
                if (themeroom_tries++ > 10
                    || level.nroom >= Math.trunc(MAXNROFROOMS / 6))
                    break;
            }
        }
        else if (!create_room(-1, -1, -1, -1, -1, -1, OROOM, -1))
            break;
    }
    g.in_mk_themerooms = false;
    if (themedRooms)
        await callLuaThemerooms('post_themerooms_generate');
}
// C mklev.c:add_subroom()
// C refs: sp_lev.c create_subroom() and mklev.c add_subroom().  Subrooms
// share their parent's rectangle allocation but retain distinct room
// identity for shop/temple membership and recursive special-room filling.
export function add_subroom(proom, lowx, lowy, hix, hiy, lit, rtype, special) {
    const level = requireGameLevel();
    const subroomIndex = level.nsubroom || 0;
    const croom = {
        lx: lowx, ly: lowy, hx: hix, hy: hiy,
        rtype, rlit: lit ? 1 : 0,
        doorct: 0, fdoor: level.doorindex,
        irregular: false, needjoining: !special,
        nsubrooms: 0, sbrooms: [],
        roomnoidx: MAXNROFROOMS + 1 + subroomIndex,
        needfill: 0,
    };
    do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special, false);
    proom.sbrooms[proom.nsubrooms++] = croom;
    const subrooms = level.subrooms ??= [];
    subrooms[subroomIndex] = croom;
    level.nsubroom = subroomIndex + 1;
    return croom;
}
// C mklev.c:create_vault():
function create_vault() {
    return create_room(-1, -1, 2, 2, -1, -1, VAULT, true);
}
// C mklev.c:add_room()
export function add_room(lowx, lowy, hix, hiy, lit, rtype, special) {
    const level = requireGameLevel();
    const croom = {
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
// C mklev.c:do_room_or_subroom()
function do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special, is_room) {
    const map = requireGameLevel();
    if (!lowx)
        lowx++;
    if (!lowy)
        lowy++;
    if (hix >= COLNO - 1)
        hix = COLNO - 2;
    if (hiy >= ROWNO - 1)
        hiy = ROWNO - 2;
    if (lit) {
        for (let x = lowx - 1; x <= hix + 1; x++)
            for (let y = Math.max(lowy - 1, 0); y <= hiy + 1; y++) {
                const loc = map.at(x, y);
                if (loc)
                    loc.lit = true;
            }
        croom.rlit = 1;
    }
    else {
        croom.rlit = 0;
    }
    croom.lx = lowx;
    croom.hx = hix;
    croom.ly = lowy;
    croom.hy = hiy;
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
                if (loc) {
                    loc.typ = HWALL;
                    loc.horizontal = true;
                }
            }
        for (let x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2))
            for (let y = lowy; y <= hiy; y++) {
                const loc = map.at(x, y);
                if (loc) {
                    loc.typ = VWALL;
                    loc.horizontal = false;
                }
            }
        for (let x = lowx; x <= hix; x++)
            for (let y = lowy; y <= hiy; y++) {
                const loc = map.at(x, y);
                if (loc)
                    loc.typ = ROOM;
            }
        if (is_room) {
            const tl = map.at(lowx - 1, lowy - 1);
            const tr = map.at(hix + 1, lowy - 1);
            const bl = map.at(lowx - 1, hiy + 1);
            const br = map.at(hix + 1, hiy + 1);
            if (tl)
                tl.typ = TLCORNER;
            if (tr)
                tr.typ = TRCORNER;
            if (bl)
                bl.typ = BLCORNER;
            if (br)
                br.typ = BRCORNER;
        }
        else {
            wallification(lowx - 1, lowy - 1, hix + 1, hiy + 1);
        }
    }
}
// C mklev.c:sort_rooms()
// Also C mklev.c:mkroom_cmp(): inlined as the room-x comparator.
function sort_rooms() {
    const level = requireGameLevel();
    const n = level.nroom;
    const oldToNew = Array.from({ length: n }, () => 0);
    const liveRooms = level.rooms.slice(0, n).map(room => {
        if (!isRoom(room))
            throw new Error('Live room list contains an unfinished room.');
        return room;
    }).sort((a, b) => a.lx - b.lx);
    level.rooms = liveRooms;
    for (const [index, room] of liveRooms.entries()) {
        oldToNew[room.roomnoidx] = index;
        room.roomnoidx = index;
    }
    if (n < MAXNROFROOMS)
        level.rooms[n] = { hx: -1 };
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.requireAt(x, y);
            const rno = loc.roomno;
            if (rno >= ROOMOFFSET && rno < MAXNROFROOMS + 1) {
                const roomIndex = oldToNew[rno - ROOMOFFSET];
                if (roomIndex === undefined)
                    throw new Error(`Missing room number ${rno}`);
                loc.roomno = roomIndex + ROOMOFFSET;
            }
        }
}
// C mklev.c:topologize()
export function topologize(croom) {
    if (!croom || croom.irregular)
        return;
    const roomno = (croom.roomnoidx ?? -1) + ROOMOFFSET;
    const lowx = croom.lx, lowy = croom.ly;
    const hix = croom.hx, hiy = croom.hy;
    if (!game.level || roomno < ROOMOFFSET)
        return;
    if ((game.level.at(lowx, lowy)?.roomno ?? 0) === roomno)
        return;
    for (let x = lowx; x <= hix; x++)
        for (let y = lowy; y <= hiy; y++) {
            const loc = game.level.at(x, y);
            if (loc)
                loc.roomno = roomno;
        }
    for (let x = lowx - 1; x <= hix + 1; x++)
        for (let y = lowy - 1; y <= hiy + 1; y += (hiy - lowy + 2)) {
            const loc = game.level.at(x, y);
            if (loc) {
                loc.edge = true;
                loc.roomno = loc.roomno ? SHARED : roomno;
            }
        }
    for (let x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2))
        for (let y = lowy; y <= hiy; y++) {
            const loc = game.level.at(x, y);
            if (loc) {
                loc.edge = true;
                loc.roomno = loc.roomno ? SHARED : roomno;
            }
        }
}
// ============================================================
// Corridors
// ============================================================
// C mklev.c:good_rm_wall_doorpos():
function good_rm_wall_doorpos(x, y, dir, room) {
    const map = requireGameLevel();
    const rmno = map.rooms.indexOf(room) + ROOMOFFSET;
    if (!isok(x, y) || !room.needjoining)
        return false;
    const loc = map.at(x, y);
    if (!loc)
        return false;
    if (!(loc.typ === HWALL || loc.typ === VWALL || IS_DOOR(loc.typ) || loc.typ === SDOOR))
        return false;
    if (bydoor(x, y))
        return false;
    const dx = xdir[dir], dy = ydir[dir];
    if (dx === undefined || dy === undefined)
        return false;
    const tx = x + dx, ty = y + dy;
    if (!isok(tx, ty))
        return false;
    const tloc = map.at(tx, ty);
    if (!tloc || IS_OBSTRUCTED(tloc.typ))
        return false;
    if (rmno !== tloc.roomno)
        return false;
    return true;
}
// C mklev.c:finddpos_shift():
function finddpos_shift(xp, yp, dir, aroom) {
    const level = requireGameLevel();
    const rdir = DIR_180(dir);
    if (good_rm_wall_doorpos(xp.v, yp.v, rdir, aroom))
        return true;
    // An irregular room's actual wall can sit inside its rectangular bounds.
    // Walk inward across untouched stone/corridor cells until that wall is
    // reached, exactly as mklev.c finddpos_shift() does.
    if (aroom.irregular) {
        const dx = xdir[rdir], dy = ydir[rdir];
        if (dx === undefined || dy === undefined)
            return false;
        let rx = xp.v, ry = yp.v;
        let fail = false;
        while (!fail && isok(rx, ry)) {
            const current = level.at(rx, ry);
            if (!current || (current.typ !== STONE && current.typ !== CORR))
                break;
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
// C mklev.c:finddpos()
function finddpos(cc, dir, aroom) {
    let x1, y1, x2, y2;
    switch (dir) {
        case DIR_N:
            x1 = aroom.lx;
            x2 = aroom.hx;
            y1 = y2 = aroom.ly - 1;
            break;
        case DIR_S:
            x1 = aroom.lx;
            x2 = aroom.hx;
            y1 = y2 = aroom.hy + 1;
            break;
        case DIR_W:
            x1 = x2 = aroom.lx - 1;
            y1 = aroom.ly;
            y2 = aroom.hy;
            break;
        case DIR_E:
            x1 = x2 = aroom.hx + 1;
            y1 = aroom.ly;
            y2 = aroom.hy;
            break;
        default: return false;
    }
    let tryct = 0;
    let x, y;
    do {
        x = (x2 - x1) ? rn1(x2 - x1 + 1, x1) : x1;
        y = (y2 - y1) ? rn1(y2 - y1 + 1, y1) : y1;
        const xp = { v: x }, yp = { v: y };
        if (finddpos_shift(xp, yp, dir, aroom)) {
            cc.x = xp.v;
            cc.y = yp.v;
            return true;
        }
    } while (++tryct < 20);
    for (x = x1; x <= x2; x++)
        for (y = y1; y <= y2; y++) {
            const xp = { v: x }, yp = { v: y };
            if (finddpos_shift(xp, yp, dir, aroom)) {
                cc.x = xp.v;
                cc.y = yp.v;
                return true;
            }
        }
    cc.x = x1;
    cc.y = y1;
    return false;
}
// C mklev.c:maybe_sdoor():
export function maybe_sdoor(chance) {
    const d = depth_of_level(game.u?.uz);
    return (d > 2) && !rn2(Math.max(2, chance));
}
// C mklev.c:dosdoor()
async function dosdoor(x, y, aroom, type) {
    const map = requireGameLevel();
    const loc = map.at(x, y);
    if (!loc)
        return;
    const shdoor = roomsAt(map, x, y, SHOPBASE).length > 0;
    if (!IS_WALL(loc.typ))
        type = DOOR;
    loc.typ = type;
    if (type === DOOR) {
        if (!rn2(3)) {
            if (!rn2(5))
                loc.doormask = D_ISOPEN;
            else if (!rn2(6))
                loc.doormask = D_LOCKED;
            else
                loc.doormask = D_CLOSED;
            if (loc.doormask !== D_ISOPEN && !shdoor
                && level_difficulty() >= 5 && !rn2(25))
                loc.doormask |= D_TRAPPED;
        }
        else {
            loc.doormask = shdoor ? D_ISOPEN : D_NODOOR;
        }
        // Rogue doors are always open doorways.  This happens before the
        // trapped-door mimic check in C, suppressing that later constructor
        // without changing the door-state RNG sequence above.
        if (Is_rogue_level(game.u?.uz))
            loc.doormask = D_NODOOR;
        if (loc.doormask & D_TRAPPED) {
            if (level_difficulty() >= 9 && !rn2(5)
                && MONSTER_SYMBOL.some((symbol, mndx) => symbol === S_MIMIC
                    && !((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE))) {
                loc.doormask = D_NODOOR;
                const mimic = await makemon(mkclass(S_MIMIC, 0), x, y, 0);
                if (mimic)
                    await setMimicAppearance(mimic);
            }
        }
    }
    else {
        if (shdoor || !rn2(5))
            loc.doormask = D_LOCKED;
        else
            loc.doormask = D_CLOSED;
        if (!shdoor && level_difficulty() >= 4 && !rn2(20))
            loc.doormask |= D_TRAPPED;
    }
    add_door(x, y, aroom);
}
// C mklev.c:dodoor():
export async function dodoor(x, y, aroom) {
    await dosdoor(x, y, aroom, maybe_sdoor(8) ? SDOOR : DOOR);
}
// C mklev.c:add_door():
export function add_door(x, y, aroom) {
    const level = requireGameLevel();
    for (let i = 0; i < aroom.doorct; i++) {
        const d = level.doors[aroom.fdoor + i];
        if (d && d.x === x && d.y === y)
            return;
    }
    if (aroom.doorct === 0)
        aroom.fdoor = level.doorindex;
    aroom.doorct++;
    for (let tmp = level.doorindex; tmp > aroom.fdoor; tmp--) {
        const door = level.doors[tmp - 1];
        if (!door)
            throw new Error(`Missing door at index ${tmp - 1}`);
        level.doors[tmp] = door;
    }
    const otherRooms = [
        ...level.rooms.slice(0, level.nroom),
        ...(level.subrooms ?? []).slice(0, level.nsubroom ?? 0),
    ];
    for (const broom of otherRooms) {
        if (!isRoom(broom) || broom === aroom || !broom.doorct)
            continue;
        if (broom.fdoor >= aroom.fdoor)
            broom.fdoor++;
    }
    level.doors[aroom.fdoor] = { x, y };
    level.doorindex++;
}
// C mklev.c:bydoor():
function bydoor(x, y) {
    const map = requireGameLevel();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!isok(x + dx, y + dy))
            continue;
        const loc = map.at(x + dx, y + dy);
        if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
            return true;
    }
    return false;
}
// C mklev.c:okdoor():
export function okdoor(x, y) {
    const map = requireGameLevel();
    const loc = map.at(x, y);
    if (!loc)
        return false;
    if (!(loc.typ === HWALL || loc.typ === VWALL))
        return false;
    if (bydoor(x, y))
        return false;
    return ((isok(x - 1, y) && !IS_OBSTRUCTED(map.requireAt(x - 1, y).typ))
        || (isok(x + 1, y) && !IS_OBSTRUCTED(map.requireAt(x + 1, y).typ))
        || (isok(x, y - 1) && !IS_OBSTRUCTED(map.requireAt(x, y - 1).typ))
        || (isok(x, y + 1) && !IS_OBSTRUCTED(map.requireAt(x, y + 1).typ)));
}
// C mklev.c:join()
async function join(a, b, nxcor) {
    const g = game;
    const level = requireGameLevel();
    const croom = level.rooms[a];
    const troom = level.rooms[b];
    if (!isRoom(croom) || !isRoom(troom))
        return;
    if (!croom.needjoining || !troom.needjoining)
        return;
    if (troom.hx < 0 || croom.hx < 0)
        return;
    let dx, dy;
    const cc = { x: 0, y: 0 }, tt = { x: 0, y: 0 };
    if (troom.lx > croom.hx) {
        dx = 1;
        dy = 0;
        if (!finddpos(cc, DIR_E, croom))
            return;
        if (!finddpos(tt, DIR_W, troom))
            return;
    }
    else if (troom.hy < croom.ly) {
        dy = -1;
        dx = 0;
        if (!finddpos(cc, DIR_N, croom))
            return;
        if (!finddpos(tt, DIR_S, troom))
            return;
    }
    else if (troom.hx < croom.lx) {
        dx = -1;
        dy = 0;
        if (!finddpos(cc, DIR_W, croom))
            return;
        if (!finddpos(tt, DIR_E, troom))
            return;
    }
    else {
        dy = 1;
        dx = 0;
        if (!finddpos(cc, DIR_S, croom))
            return;
        if (!finddpos(tt, DIR_N, troom))
            return;
    }
    const xx = cc.x, yy = cc.y;
    const tx = tt.x - dx, ty = tt.y - dy;
    if (nxcor) {
        const loc = level.at(xx + dx, yy + dy);
        if (loc && loc.typ !== STONE)
            return;
    }
    const org = { x: xx + dx, y: yy + dy };
    const dest = { x: tx, y: ty };
    const npoints = { v: 0 };
    const ftyp = level.flags.arboreal ? ROOM : CORR;
    const dig_result = await dig_corridor(org, dest, npoints, nxcor, ftyp, STONE);
    if ((npoints.v > 0) && (okdoor(xx, yy) || !nxcor))
        await dodoor(xx, yy, croom);
    if (!dig_result)
        return;
    if (okdoor(tt.x, tt.y) || !nxcor)
        await dodoor(tt.x, tt.y, troom);
    const equivalence = g.smeq;
    const first = equivalence?.[a], second = equivalence?.[b];
    if (!equivalence || first === undefined || second === undefined)
        throw new Error('Corridor join requires room equivalence indexes.');
    if (first < second)
        equivalence[b] = first;
    else
        equivalence[a] = second;
}
// C mklev.c:makecorridors()
export async function makecorridors() {
    const g = game;
    const level = requireGameLevel();
    const equivalence = g.smeq;
    if (!equivalence)
        throw new Error('Corridors require initialized room equivalence.');
    let unjoinedRooms = true;
    for (let a = 0; a < level.nroom - 1; a++) {
        await join(a, a + 1, false);
        if (!rn2(50))
            break;
    }
    for (let a = 0; a < level.nroom - 2; a++)
        if (equivalence[a] !== equivalence[a + 2])
            await join(a, a + 2, false);
    for (let a = 0; unjoinedRooms && a < level.nroom; a++) {
        unjoinedRooms = false;
        for (let b = 0; b < level.nroom; b++)
            if (equivalence[a] !== equivalence[b]) {
                await join(a, b, false);
                unjoinedRooms = true;
            }
    }
    if (level.nroom > 2) {
        const count = rn2(level.nroom) + 4;
        for (let i = 0; i < count; i++) {
            const a = rn2(level.nroom);
            let b = rn2(level.nroom - 2);
            if (b >= a)
                b += 2;
            await join(a, b, true);
        }
    }
}
// ============================================================
// Stairs
// ============================================================
// C mklev.c:generate_stairs_room_good():
function generate_stairs_room_good(croom, phase) {
    if (!croom || croom.hx < 0)
        return false;
    if (!croom.needjoining && phase >= 0)
        return false;
    if (phase >= 1 && (roomHasStair(croom, false) || roomHasStair(croom, true)))
        return false;
    if (croom.rtype !== OROOM && !(phase < 2 && croom.rtype === THEMEROOM))
        return false;
    return true;
}
// C mklev.c:generate_stairs_find_room():
function generate_stairs_find_room() {
    const level = requireGameLevel();
    if (!level.nroom)
        return null;
    for (let phase = 2; phase > -1; phase--) {
        const candidates = [];
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room) && generate_stairs_room_good(room, phase))
                candidates.push(room);
        if (candidates.length > 0) {
            const selected = candidates[rn2(candidates.length)];
            if (!selected)
                throw new RangeError('Stair room selection is out of range.');
            return selected;
        }
    }
    const selected = level.rooms[rn2(level.nroom)];
    return isRoom(selected) ? selected : null;
}
// C mklev.c:mkstairs():
export async function mkstairs(x, y, up, croom, force = false) {
    const g = game;
    const level = requireGameLevel();
    if (!isok(x, y)) {
        await impossible(`mkstairs:  bogus stair attempt at <${x},${y}>`);
        return;
    }
    const loc = level.requireAt(x, y);
    // Explicit Lua coordinates force floor even when this dungeon endpoint
    // subsequently prevents creation of the requested stairs.
    if (force)
        loc.typ = ROOM;
    if (loc.typ !== ROOM && loc.typ !== CORR && loc.typ !== ICE) {
        const terrain = back_to_glyph(loc, x, y).terrainName;
        await impossible(`mkstairs:  placing stairs ${up ? 'up' : 'down'} on ${terrain} at <${x},${y}>`);
    }
    const currentLevel = g.u?.uz?.dlevel ?? 1;
    const dungeonLevels = g.dungeons?.[g.u?.uz?.dnum ?? 0]?.num_dunlevs
        ?? currentLevel;
    // Regular stairs cannot leave a dungeon at either end.  Branch
    // placement later installs the cross-dungeon stair on an entry level.
    if ((up && currentLevel === 1)
        || (!up && currentLevel === dungeonLevels))
        return;
    const dest = {
        dnum: g.u?.uz?.dnum ?? 0,
        dlevel: currentLevel + (up ? -1 : 1),
    };
    stairway_add(x, y, !!up, false, dest);
    setLevelTerrainType(x, y, STAIRS);
    loc.ladder = up ? 1 : 2;
    if (up)
        level.upstair = { x, y };
    else
        level.dnstair = { x, y };
}
// C mklev.c:generate_stairs():
async function generate_stairs() {
    const g = game;
    const pos = { x: 0, y: 0 };
    // Down stairs
    if (!Is_botlevel(g.u.uz)) {
        const croom = generate_stairs_find_room();
        if (croom) {
            if (!somexyspace(croom, pos)) {
                pos.x = somex(croom);
                pos.y = somey(croom);
            }
            await mkstairs(pos.x, pos.y, 0, croom);
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
            await mkstairs(pos.x, pos.y, 1, croom);
        }
    }
}
// ============================================================
// Niches
// ============================================================
// C mklev.c:cardinal_nextto_room():
function cardinal_nextto_room(aroom, x, y) {
    const map = requireGameLevel();
    const rmno = map.rooms.indexOf(aroom) + ROOMOFFSET;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (!isok(x + dx, y + dy))
            continue;
        const loc = map.at(x + dx, y + dy);
        if (loc && !loc.edge && loc.roomno === rmno)
            return true;
    }
    return false;
}
// C mklev.c:place_niche():
function place_niche(aroom) {
    const level = requireGameLevel();
    let dy;
    const dd = { x: 0, y: 0 };
    if (rn2(2)) {
        dy = 1;
        if (!finddpos(dd, DIR_S, aroom))
            return null;
    }
    else {
        dy = -1;
        if (!finddpos(dd, DIR_N, aroom))
            return null;
    }
    const xx = dd.x, yy = dd.y;
    const niche = level.at(xx, yy + dy);
    const back = level.at(xx, yy - dy);
    if (!niche || niche.typ !== STONE)
        return null;
    if (!back || IS_POOL(back.typ) || IS_FURNITURE(back.typ))
        return null;
    if (!cardinal_nextto_room(aroom, xx, yy))
        return null;
    return { dy, xx, yy };
}
// C mklev.c:makeniche():
async function makeniche(trap_type) {
    const g = game;
    const level = requireGameLevel();
    let vct = 8;
    while (vct--) {
        const aroom = level.rooms[rn2(level.nroom)];
        if (!isRoom(aroom) || aroom.rtype !== OROOM)
            continue;
        if (aroom.doorct === 1 && rn2(5))
            continue;
        const niche = place_niche(aroom);
        if (!niche)
            continue;
        const { dy, xx, yy } = niche;
        const rm = level.at(xx, yy + dy);
        if (!rm)
            continue;
        if (trap_type || !rn2(4)) {
            rm.typ = SCORR;
            if (trap_type) {
                let actualTrap = trap_type;
                if (is_hole(actualTrap) && !canFallThrough())
                    actualTrap = ROCKTRAP;
                const trap = await maketrap(xx, yy + dy, actualTrap);
                if (trap && actualTrap !== ROCKTRAP)
                    trap.once = true;
                const trapEngraving = actualTrap === TRAPDOOR
                    ? 'Vlad was here'
                    : (actualTrap === TELEP_TRAP || actualTrap === LEVEL_TELEP)
                        ? 'ad aerarium' : null;
                if (trap && trapEngraving) {
                    // Creation preserves the original punctuation before wear.
                    makeEngravingAt(xx, yy - dy, trapEngraving, null, 0, DUST);
                    wipeEngravingAt(xx, yy - dy, 5);
                }
            }
            await dosdoor(xx, yy, aroom, SDOOR);
        }
        else {
            rm.typ = CORR;
            if (rn2(7)) {
                await dosdoor(xx, yy, aroom, rn2(5) ? SDOOR : DOOR);
            }
            else {
                const loc = level.at(xx, yy);
                if (!rn2(5) && loc && IS_WALL(loc.typ)) {
                    setLevelTerrainType(xx, yy, IRONBARS);
                    if (rn2(3)) {
                        const S_HUMAN = 53;
                        const human = mkclass(S_HUMAN, 0);
                        await mkcorpstat(CORPSE, null, human, xx, yy + dy, 1);
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
// C mklev.c:make_niches():
async function make_niches() {
    const level = requireGameLevel();
    let ct = rnd(Math.trunc(level.nroom / 2) + 1);
    const depth = depth_of_level(game.u.uz);
    let ltptr = !level.flags.noteleport && depth > 15;
    let vamp = depth > 5 && depth < 25;
    while (ct--) {
        if (ltptr && !rn2(6)) {
            ltptr = false;
            await makeniche(LEVEL_TELEP);
        }
        else if (vamp && !rn2(6)) {
            vamp = false;
            await makeniche(TRAPDOOR);
        }
        else {
            await makeniche(NO_TRAP);
        }
    }
}
// ============================================================
// Branch placement
// ============================================================
// C mklev.c:find_branch_room():
function find_branch_room(mp) {
    if (!requireGameLevel().nroom) {
        const point = mazeFloorPoint();
        mp.x = point.x;
        mp.y = point.y;
        return null;
    }
    const croom = generate_stairs_find_room();
    if (croom)
        somexyspace(croom, mp);
    return croom;
}
// C mklev.c:place_branch().  Return immediately if there is no branch to
// make or we have already made one; a special level can name an SSTAIR spot
// as a favored site, which is why this can be called twice.
export async function place_branch(branchp, x = 0, y = 0) {
    const g = game;
    if (!branchp || g.made_branch)
        return;
    if (!x) { /* find random coordinates for branch */
        const mp = { x: 0, y: 0 };
        find_branch_room(mp);
        x = mp.x;
        y = mp.y;
    }
    const on_end1 = branchp.end1?.dnum === g.u?.uz?.dnum
        && branchp.end1?.dlevel === g.u?.uz?.dlevel;
    const dest = on_end1 ? branchp.end2 : branchp.end1;
    if (branchp.type === 'portal') {
        await mkportal(x, y, dest.dnum, dest.dlevel);
    }
    else if (branchp.type !== (on_end1 ? 'no_end1' : 'no_end2')) {
        const goes_up = on_end1 ? !!branchp.end1_up : !branchp.end1_up;
        const loc = g.level?.at(x, y);
        if (loc) {
            setLevelTerrainType(x, y, STAIRS);
            loc.ladder = goes_up ? 1 : 2;
        }
        stairway_add(x, y, goes_up, false, dest);
    }
    // Set made_branch even without a stairwell: there is only one branch
    // per level, so a failed placement would fail again on the next call.
    g.made_branch = true;
}
// C mklev.c:makelevel() marks the entrance after placing a room level's
// branch. Lua and maze branches keep stairway_add()'s untraversed state.
async function placeRoomLevelBranch(branch) {
    const previous = game.stairs;
    await place_branch(branch);
    if (game.u.uz?.dnum === 0 && game.u.uz.dlevel === 1
        && game.stairs && game.stairs !== previous)
        game.stairs.u_traversed = true;
}
// ============================================================
// Wallification
// ============================================================
// ============================================================
// Fill ordinary room
// ============================================================
// C mklev.c:traptype_rnd():
function traptype_rnd({ spiderOnWeb = true }) {
    const lvl = level_difficulty();
    let kind = rnd(TRAPNUM - 1);
    switch (kind) {
        case TRAPPED_DOOR:
        case TRAPPED_CHEST:
        case MAGIC_PORTAL:
        case VIBRATING_SQUARE:
            kind = NO_TRAP;
            break;
        case ROLLING_BOULDER_TRAP:
        case SLP_GAS_TRAP:
            if (lvl < 2)
                kind = NO_TRAP;
            break;
        case LEVEL_TELEP:
            if (lvl < 5 || game.level?.flags?.noteleport
                || Is_knox_level(game.u.uz))
                kind = NO_TRAP;
            break;
        case SPIKED_PIT:
            if (lvl < 5)
                kind = NO_TRAP;
            break;
        case LANDMINE:
            if (lvl < 6)
                kind = NO_TRAP;
            break;
        case WEB:
            if (lvl < 7 && spiderOnWeb)
                kind = NO_TRAP;
            break;
        case STATUE_TRAP:
        case POLY_TRAP:
            if (lvl < 8)
                kind = NO_TRAP;
            break;
        case FIRE_TRAP:
            if (!In_hell(game.u.uz))
                kind = NO_TRAP;
            break;
        case TELEP_TRAP:
            if (game.level?.flags?.noteleport)
                kind = NO_TRAP;
            break;
        case HOLE:
            if (rn2(7))
                kind = NO_TRAP;
            break;
    }
    return kind;
}
// C mklev.c:find_okay_roompos():
function find_okay_roompos(croom, crd) {
    let tryct = 0;
    do {
        if (++tryct > 200)
            return false;
        if (!somexyspace(croom, crd))
            return false;
    } while (occupied(crd.x, crd.y) || bydoor(crd.x, crd.y));
    return true;
}
// C mklev.c:mktrap_victim():
export async function mktrap_victim(trap) {
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
        case DART_TRAP:
            trapObject = await mksobj(24, true, false);
            break;
        case ROCKTRAP:
            trapObject = await mksobj(ROCK, true, false);
            break;
        default: break;
    }
    if (trapObject)
        placeCreatedObject(trapObject, x, y);
    // Random items on victim
    do {
        const cls = [WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS][rn2(4)];
        if (cls === undefined)
            throw new RangeError('Trap victim object class is out of range.');
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
    const PM_ELF = 264, PM_DWARF = 44, PM_ORC = 72, PM_GNOME = 165, PM_HUMAN = 260;
    let victim_mnum;
    switch (rn2(15)) {
        case 0:
            victim_mnum = PM_ELF;
            if (kind === SLP_GAS_TRAP && !(lvl <= 2 && rn2(2)))
                victim_mnum = PM_HUMAN;
            break;
        case 1:
        case 2:
            victim_mnum = PM_DWARF;
            break;
        case 3:
        case 4:
        case 5:
            victim_mnum = PM_ORC;
            break;
        case 6:
        case 7:
        case 8:
        case 9:
            victim_mnum = PM_GNOME;
            if (!rn2(10)) {
                const otmp = await mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
                otmp.quan = 1;
                otmp.quantity = 1;
                otmp.owt = objectWeight(otmp);
                curseObjectState(otmp);
                placeCreatedObject(otmp, x, y);
                if (!requireGameLevel().requireAt(x, y).lit)
                    beginObjectBurn(otmp);
            }
            break;
        default:
            victim_mnum = PM_HUMAN;
            break;
    }
    if (victim_mnum === PM_HUMAN && rn2(25))
        victim_mnum = rn1(PM_WIZARD - PM_ARCHAEOLOGIST, PM_ARCHAEOLOGIST);
    const corpse = await mkcorpstat(CORPSE, null, victim_mnum, x, y, 8); // CORPSTAT_INIT
    // C makes every trap-victim corpse older than TAINT_AGE after creating
    // it.  The existing rot timer is intentionally left unchanged; dogfood()
    // observes the backdated age immediately and classifies it as unsafe.
    if (!corpse || corpse.age === undefined)
        throw new Error('Trap victim creation did not produce an aged corpse.');
    corpse.age -= 51; // TAINT_AGE + 1
}
// Part of C dothrow.c:breaktest(): the trap-victim subset, including zap.c:obj_resists() for fresh non-invocation objects.
// C refs: zap.c obj_resists() and dothrow.c breaktest().  This helper is
// private to the trap-victim generation block; its inputs are freshly made,
// non-invocation objects from the four possession classes above.
function trapVictimObjectBreaks(object) {
    const material = objectMaterial(object.otyp);
    const ordinaryResistance = object.oclass === ARMOR_CLASS && material === 19
        ? 90 : 1; // GLASS == 19
    if (rn2(100) < (object.artifact ? 99 : ordinaryResistance))
        return false;
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
// C mklev.c:mktrap()
// C mktrap(): the room and maze callers share type selection, collision
// checks, web residents, and shallow-level victims.
// Also C mklev.c:traptype_roguelvl(): inlined in the Rogue-level type selection.
export async function mktrap(num, options, croom, coordinate) {
    const level = requireGameLevel();
    // Explicit locations are screened before type selection. Room and maze
    // callers select the type first, then search for an unoccupied square.
    if (coordinate && (isPoolAt(coordinate.x, coordinate.y)
        || isLavaAt(coordinate.x, coordinate.y)))
        return null;
    let kind;
    if (num > NO_TRAP && num < TRAPNUM) {
        kind = num;
    }
    else if (Is_rogue_level(game.u.uz)) {
        kind = [BEAR_TRAP, ARROW_TRAP, DART_TRAP, TRAPDOOR,
            PIT, SLP_GAS_TRAP, RUST_TRAP][rn2(7)];
    }
    else if (In_hell(game.u.uz)
        && !rn2(5))
        kind = FIRE_TRAP;
    else
        do {
            kind = traptype_rnd(options);
        } while (kind === NO_TRAP);
    if (kind === undefined)
        throw new RangeError('Rogue trap selection is out of range.');
    if (is_hole(kind) && !canFallThrough())
        kind = ROCKTRAP;
    const pos = coordinate ? { ...coordinate } : { x: 0, y: 0 };
    if (!coordinate) {
        const avoidBoulder = is_pit(kind) || is_hole(kind);
        let attempts = 0;
        do {
            if (++attempts > 200)
                return null;
            if (croom) {
                if (!somexyspace(croom, pos))
                    return null;
            }
            else {
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
// C mklev.c:mkfount():
function mkfount(croom) {
    const level = requireGameLevel();
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos))
        return;
    const loc = level.at(pos.x, pos.y);
    if (loc) {
        if (!setLevelTerrainType(pos.x, pos.y, FOUNTAIN))
            return;
        if (!rn2(7))
            loc.blessedftn = 1;
        level.flags.nfountains++;
    }
}
// C mklev.c:mkaltar():
function mkaltar(croom) {
    if (!croom || croom.rtype !== OROOM)
        return;
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos))
        return;
    const loc = game.level?.at(pos.x, pos.y);
    if (!loc)
        return;
    if (!setLevelTerrainType(pos.x, pos.y, ALTAR))
        return;
    const al = rn2(A_LAWFUL + 2) - 1;
    loc.flags = Align2amask(al);
}
// C mklev.c:mkgrave():
async function mkgrave_room(croom) {
    const dobell = !rn2(10);
    if (croom.rtype !== OROOM)
        return;
    const pos = { x: 0, y: 0 };
    if (!find_okay_roompos(croom, pos))
        return;
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
    if (dobell)
        await mksobj_at(BELL, pos.x, pos.y, true, false);
}
// Part of C mklev.c:mkinvokearea(): the concentric ring walk.
// The rings are deliberately visited in native order: actors encounter the
// changed terrain before the next ring.
function invocationRings(x, y) {
    const rings = [[{ x, y }]];
    let xmin = x, xmax = x, ymin = y, ymax = y;
    for (let distance = 1; distance < 7; distance++) {
        xmin--;
        xmax++;
        const ring = [];
        if (distance !== 3) {
            ymin--;
            ymax++;
            for (let column = xmin + 1; column < xmax; column++)
                ring.push({ x: column, y: ymin }, { x: column, y: ymax });
        }
        for (let row = ymin; row <= ymax; row++)
            ring.push({ x: xmin, y: row }, { x: xmax, y: row });
        rings.push(ring);
    }
    return rings;
}
// C mklev.c:mkinvokearea().
// Also C mklev.c:mkinvk_check_wall(): inlined here (the wall probe that
// decides the crumbling-walls message).
export async function makeInvocationArea({ state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const level = requireGameLevel(state);
    const rings = invocationRings(state.u.ux, state.u.uy);
    await plineWithContinuation('The floor shakes violently under you!');
    if (rings.flat().some(({ x, y }) => {
        const location = level.at(x, y);
        return location && (IS_STWALL(location.typ) || location.typ === IRONBARS);
    }))
        await plineWithContinuation('The walls around you begin to bend and crumble!');
    await flushPendingTopline();
    if (state.u.utrap) {
        if (state.u.utraptype === TT_BURIEDBALL)
            await buriedBallToPunishment();
        await resetUtrap(false, state);
    }
    for (const [distance, ring] of rings.entries()) {
        for (const position of ring)
            await changeInvocationSquare(position, distance, state);
        if (distance) {
            await flush_screen(1);
            await state.animationFrame?.();
        }
    }
    await plineWithContinuation('You are standing at the top of a stairwell leading down!');
    await mkstairs(state.u.ux, state.u.uy, false, null);
    await newsym(state.u.ux, state.u.uy);
    state.vision_full_recalc = 1;
}
// C mklev.c:mkinvpos().
async function changeInvocationSquare({ x, y }, distance, state) {
    if (x < 2 || y < 2 || x > ((COLNO - 1) & ~1) || y > ((ROWNO - 1) & ~1)) {
        if (distance < 5) {
            const report = x > 0 && x < COLNO && y >= 0 && y < ROWNO ? impossible : panic;
            await report(`mkinvpos: <${x},${y}> (${distance}) off map edge!`, { state });
        }
        return;
    }
    const level = requireGameLevel(state);
    const location = level.requireAt(x, y);
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap)
        deleteTrap(trap, state);
    let makeRocks = ![1, 4, 5].includes(distance);
    for (const boulder of [...(level.objects[x]?.[y] || [])].filter(object => object.otyp === BOULDER)) {
        if (makeRocks) {
            await fractureRock(boulder, x, y, { state });
            makeRocks = false;
        }
        else
            await deleteObject(boulder, state);
    }
    location.seenv = location.doormask = location.flags = 0;
    if (distance < 6)
        location.lit = true;
    location.waslit = true;
    location.horizontal = false;
    const visionRow = state.viz_array?.[y];
    if (visionRow)
        visionRow[x] = distance < 6 ? IN_SIGHT | COULD_SEE : COULD_SEE;
    if (distance === 1) {
        if (!isPoolAt(x, y, state)) {
            location.typ = ROOM;
            const fire = await maketrap(x, y, FIRE_TRAP);
            if (fire)
                fire.tseen = true;
        }
    }
    else
        location.typ = distance === 4 || distance === 5 ? MOAT : ROOM;
    const monster = monsterAtPosition(level, x, y);
    if (monster) {
        if (monster.m_ap_type)
            await revealMonsterAppearance(monster);
        if (level.traps.some(candidate => candidate.tx === x && candidate.ty === y)) {
            await mintrap(monster, state);
        }
        else
            await resolveMonsterLiquid(monster, state, {
                announce: plineWithContinuation, monsterMoving: false, finishDeath: finishInvocationLiquidDeath,
            });
    }
    vision_note_blocker_change(x, y);
    await newsym(x, y);
}
// Part of C mklev.c:mkinvpos(): the liquid-death finisher for a monster
// standing in a changed square.
function finishInvocationLiquidDeath(monster, options) {
    if (options.cause === 'drowning' || options.cause === 'lava-burning')
        return finishHeroLiquidMonsterDeath(monster, options);
    return finishMonsterLiquidDeath(monster, options);
}
// Part of C mklev.c:fill_ordinary_room(): the skip_nonrogue random-object
// tail.
async function fillRandomRoomObjects(croom, pos) {
    if (!rn2(3) && somexyspace(croom, pos)) {
        await mkobj_at(RANDOM_CLASS, pos.x, pos.y, true);
        let objTrycnt = 0;
        while (!rn2(5)) {
            if (++objTrycnt > 100)
                break;
            if (somexyspace(croom, pos))
                await mkobj_at(RANDOM_CLASS, pos.x, pos.y, true);
        }
    }
}
// C mklev.c:fill_ordinary_room(): a recursive ordinary-room fill —
// subrooms first, then the sleeping monster, traps, gold, and the
// non-rogue furniture; mksink() is inlined in the one-in-60 arm below
// and fillRandomRoomObjects() above is the shared skip_nonrogue
// random-object tail.
export async function fill_ordinary_room(croom, bonus_items) {
    const g = game;
    if (!croom || (croom.rtype !== OROOM && croom.rtype !== THEMEROOM))
        return;
    const level = requireGameLevel();
    const levelDepth = depth_of_level(g.u.uz);
    // C fills descendants before their parent and does so even when the
    // parent itself is marked unfilled.
    for (const subroom of croom.sbrooms || [])
        await fill_ordinary_room(subroom, false);
    if (croom.needfill !== FILL_NORMAL)
        return;
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
    if (x <= 1)
        x = 2;
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
    if (!rn2(10))
        mkfount(croom);
    // Sink
    if (!rn2(60)) {
        if (find_okay_roompos(croom, pos)) {
            const loc = level.at(pos.x, pos.y);
            if (loc && setLevelTerrainType(pos.x, pos.y, SINK))
                level.flags.nsinks++;
        }
    }
    // Altar
    if (!rn2(60))
        mkaltar(croom);
    // Grave
    x = 80 - levelDepth * 2;
    if (x < 2)
        x = 2;
    if (!rn2(x))
        await mkgrave_room(croom);
    // Statue
    if (!rn2(20) && somexyspace(croom, pos)) {
        await mkcorpstat(STATUE, null, null, pos.x, pos.y, 8);
    }
    // Bonus items
    let skip_chests = false;
    if (bonus_items && somexyspace(croom, pos)) {
        const branchp = is_branchlev(game.u.uz);
        const oracle_dlevel = g.oracle_level?.dlevel ?? 5;
        const minesDnum = g.dungeons?.findIndex(dungeon => dungeon?.dname === 'The Gnomish Mines') ?? -1;
        const entersMines = branchp && (g.u?.uz?.dnum ?? 0) !== minesDnum
            && (branchp.end1?.dnum === minesDnum
                || branchp.end2?.dnum === minesDnum);
        if (entersMines) {
            // Mines entrance bonus food
            await mksobj_at((rn2(5) < 3) ? FOOD_RATION : rn2(2) ? CRAM_RATION : LEMBAS_WAFER, pos.x, pos.y, true, false);
        }
        else if ((g.u?.uz?.dnum ?? 0) === (g.oracle_level?.dnum ?? 0)
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
                    if (rn2(2))
                        otyp = POT_HEALING;
                    else
                        otyp = supply_items[rn2(supply_items.length)];
                    if (otyp === undefined)
                        throw new RangeError('Supply chest object selection is out of range.');
                    const otmp = await mksobj(otyp, true, false);
                    if (otmp && otyp === POT_HEALING && rn2(2)) {
                        otmp.quan = otmp.quantity = 2;
                    }
                    cursed_item = otmp?.cursed ?? false;
                    await addToContainer(supply_chest, otmp);
                    if (++tryct2 >= 50)
                        break;
                } while (cursed_item || !rn2(5));
                if (rn2(3)) {
                    const extra_classes = [FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS,
                        SCROLL_CLASS, POTION_CLASS, RING_CLASS,
                        SPBOOK_no_NOVEL, SPBOOK_no_NOVEL, SPBOOK_no_NOVEL];
                    const oclass = extra_classes[rn2(extra_classes.length)];
                    if (oclass === undefined)
                        throw new RangeError('Supply chest class selection is out of range.');
                    let otmp = await mkobj(oclass, false);
                    if (oclass === SPBOOK_no_NOVEL && otmp) {
                        const maxpass = levelDepth > 2 ? 2 : 3;
                        for (let pass = 1; pass <= maxpass; pass++) {
                            const candidate = await mkobj(oclass, false);
                            if ((oc_level(candidate.otyp) ?? 0)
                                < (oc_level(otmp.otyp) ?? 0)) {
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
    if (!rn2(27 + 3 * Math.abs(levelDepth))) {
        const { text: engrText, pristine } = randomEngraving();
        if (engrText) {
            do {
                somexyspace(croom, pos);
                if (level.at(pos.x, pos.y)?.typ === ROOM)
                    break;
            } while (!rn2(40));
            if (level.at(pos.x, pos.y)?.typ === ROOM)
                makeEngravingAt(pos.x, pos.y, engrText, pristine, 0, MARK);
        }
    }
    await fillRandomRoomObjects(croom, pos);
}
// ============================================================
// Mineralize
// ============================================================
// C mklev.c:water_has_kelp():
function water_has_kelp(x, y, kelp_pool, kelp_moat) {
    const loc = requireGameLevel().at(x, y);
    if (!loc)
        return false;
    if (kelp_pool && (loc.typ === POOL
        || (loc.typ === WATER && !Is_waterlevel(game.u.uz)))
        && !rn2(kelp_pool))
        return true;
    if (kelp_moat && loc.typ === MOAT && !rn2(kelp_moat))
        return true;
    return false;
}
// Part of C mklev.c:mineralize(): the kelp-placement loop.
async function mineralize_kelp(kelp_pool, kelp_moat) {
    if (kelp_pool < 0)
        kelp_pool = 10;
    if (kelp_moat < 0)
        kelp_moat = 30;
    for (let x = 2; x < COLNO - 2; x++)
        for (let y = 1; y < ROWNO - 1; y++)
            if (water_has_kelp(x, y, kelp_pool, kelp_moat))
                await mksobj_at(KELP_FROND, x, y, true, false);
}
// C mklev.c:mineralize():
export async function mineralize(kelp_pool, kelp_moat, goldprob, gemprob, skip_lvl_checks) {
    const map = requireGameLevel();
    if (!skip_lvl_checks && In_endgame(game.u.uz))
        return;
    await mineralize_kelp(kelp_pool, kelp_moat);
    // A Lua fill script is still an ordinary depth. Native mineral admission
    // uses the dungeon graph's named descriptor, not the script's map flag.
    const special = specialLevelAt();
    if (!skip_lvl_checks && (In_hell(game.u.uz) || In_V_tower(game.u.uz)
        || Is_rogue_level(game.u.uz) || map.flags.arboreal
        || (special && !Is_oracle_level(game.u.uz)
            && (!In_mines(game.u.uz) || special.flags.town))))
        return;
    const absDepth = depth_of_level(game.u?.uz);
    const dunLevel = game.u?.uz?.dlevel ?? 1;
    if (goldprob < 0)
        goldprob = 20 + Math.trunc(absDepth / 3);
    if (gemprob < 0)
        gemprob = Math.trunc(goldprob / 4);
    if (!skip_lvl_checks) {
        if (In_mines(game.u.uz)) {
            goldprob *= 2;
            gemprob *= 3;
        }
        else if (In_quest(game.u.uz)) {
            goldprob = Math.trunc(goldprob / 4);
            gemprob = Math.trunc(gemprob / 6);
        }
    }
    for (let x = 2; x < COLNO - 2; x++) {
        for (let y = 1; y < ROWNO - 1; y++) {
            const loc = map.at(x, y);
            const locBelow = map.at(x, y + 1);
            if (!loc || !locBelow)
                continue;
            if (locBelow.typ !== STONE) {
                y += 2;
                continue;
            }
            if (loc.typ !== STONE) {
                y += 1;
                continue;
            }
            const stoneNeighbor = (dx, dy) => map.at(x + dx, y + dy)?.typ === STONE;
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
                    }
                    else {
                        placeCreatedObject(otmp, x, y);
                    }
                }
                if (rn2(1000) < gemprob) {
                    const cnt = rnd(2 + Math.trunc(dunLevel / 3));
                    for (let i = 0; i < cnt; i++) {
                        const gem = await mkobj(GEM_CLASS, false);
                        // Rocks selected from GEM_CLASS are discarded rather
                        // than buried or placed.
                        if (gem.otyp === ROCK)
                            deallocateObject(gem);
                        else {
                            if (rn2(3) === 0) {
                                addBuriedObject(gem, x, y);
                            }
                            else {
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
// C mklev.c:level_finalize_topology():
async function level_finalize_topology() {
    const level = requireGameLevel();
    bound_digging();
    await mineralize(-1, -1, -1, -1, false);
    game.in_mklev = false;
    if (level.flags.has_morgue)
        level.flags.graveyard = true;
    if (!level.flags.is_maze_lev) {
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room))
                topologize(room);
    }
    set_wall_state();
    for (const room of [...level.rooms, ...(level.subrooms ?? [])]) {
        if (isRoom(room))
            room.orig_rtype = room.rtype;
    }
}
//# sourceMappingURL=mklev.js.map