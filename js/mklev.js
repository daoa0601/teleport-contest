import { recorderLocalEpochSeconds, recorderTimestamp } from './calendar.js';
import { rotCorpse } from './corpse_rot.js';
import { mksobj, mksobj_at, mkobj, mkobj_at, mkgold, createCorpstatAt, set_corpsenm, rndmonnum, rndmonnumAdj } from './mkobj.js';
import { oinit } from './o_init.js';
import { objectMaterial } from './object_material.js';
import { isRoom } from './map_types.js';
import { deleteTrap, finishSokobanIfSolved } from './trap_lifecycle.js';
import { roguePlayerName, setMonsterGivenName } from './monster_given_name.js';
import { game, requireGameLevel } from './gstate.js';
import { makemon, mkclass, setMimicAppearance } from './makemon.js';
import { placeHeroOnLevel } from './hero_location.js';
import { addFruit } from './fruit.js';
import { setTinVariety } from './tin.js';
import { setWallState } from './wall_topology.js';
import { monsterHasMapPosition, monsterAtPosition, monsterOccupiesPosition } from './monster_location.js';
import { nameObjectFromTopten } from './topten.js';
import { normalDemon } from './minion.js';
import { randomMonsterRelocation } from './teleport.js';
import { sendMonsterToLimbo } from './monster_migration.js';
import { discardMonsterInventory } from './monster_drop.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { restoreLevelChains } from './level_restore.js';
import { restoreLevelPetHistory } from './monster_restore.js';
import { exerciseWisdom } from './attrib.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { impossible } from './diagnostics.js';
import { PanicTermination } from './panic_termination.js';
import { finishHeroDeath, scoreDeathCause } from './end.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { nextIdent } from './ident.js';
import { deallocateObject, deleteObject } from './object_delete.js';
import { placeCreatedObject, stack_object, updateIceObjectTimersAt } from './floor_object.js';
import { addBuriedObject, buryObject, unearthFloorObjectsAt } from './buried_object.js';
import { resetHeroTrap, switchHeroTerrain } from './terrain_movement.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { addShopDamage, fixShopDamage } from './shop_damage.js';
import { GameMap } from './game.js';
import { levelAllowsBones } from './bones_admission.js';
import { ageStoresFuel } from './container.js';
import { restoreBonesMonsters } from './bones_monster.js';
import { prepareBonesObjectForRestore, prepareBonesObjectForSave } from './bones_object.js';
import { encodeSavedGraph } from './saved_graph.js';
import { decodeBonesPayload } from './bones_validation.js';
import { rn2, rnd, rn1 } from './rng.js';
import { SHOP_TYPES, RANDOM_SHOP_TYPES } from './shop_data.js';
import { GP_ALLOW_XY, GP_CHECKSCARY, RLOC_ERR, RLOC_NOMSG, In_mines, PL_NSIZ } from './const.js';
import { init_rect, rnd_rect } from './rect.js';
import { depth as depth_of_level, ledgerNo } from './hacklib.js';
import { inducedAlignment, level_difficulty, specialLevelAt } from './dungeon.js';
import { createMaze } from './maze_terrain.js';
import { A_CHA, COLNO, ROWNO, STONE, MAX_TYPE, ROOM, CORR, DOOR, STAIRS, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED, OROOM, VAULT, COURT, SWAMP, BEEHIVE, MORGUE, BARRACKS, ZOO, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, THEMEROOM, SHOPBASE, ROOMOFFSET, MAXNROFROOMS, SHARED, SDOOR, SCORR, IRONBARS, FOUNTAIN, SINK, ALTAR, GRAVE, THRONE, HEADSTONE, MARK, DUST, DIR_N, DIR_S, DIR_E, DIR_W, DIR_180, XL_UP, XL_DOWN, XL_LEFT, XL_RIGHT, IS_WALL, IS_STWALL, IS_DOOR, IS_ROOM, IS_OBSTRUCTED, ZAP_POS, IS_FURNITURE, IS_POOL, IS_AIR, IS_LAVA, In_endgame, Is_earthlevel, Is_botlevel, Is_stronghold, Invocation_lev, In_hell, In_quest, In_V_tower, Is_oracle_level, Is_waterlevel, Is_knox_level, Is_rogue_level, SPACE_POS, isok, W_NONDIGGABLE, W_NONPASSWALL, FILL_NORMAL, ICE, MOAT, POOL, WATER, LAVAPOOL, LAVAWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DBWALL, ICED_POOL, ICED_MOAT, DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_MOAT, DB_LAVA, DB_UNDER, DB_FLOOR, SHOP_HOLE_COST, AIR, TRICKED, A_NONE, A_LAWFUL, AM_SHRINE, Align2amask, LR_DOWNSTAIR, LR_UPSTAIR, LR_UPTELE, LR_DOWNTELE, LR_TELE, LR_BRANCH, LR_PORTAL, MM_ASLEEP, MM_NOGRP, MM_EPRI, MM_ESHK, MM_IGNOREWATER, MM_NOCOUNTBIRTH, MM_NOMSG, MM_EDOG, NO_MINVENT, G_EXTINCT, G_GENOD, G_GONE, HEALTHY_TIN, ANTI_MAGIC, TT_BURIEDBALL, TT_BEARTRAP, TT_WEB, TT_PIT, TT_LAVA } from './const.js';
import { OBJECT_BASES, OBJECT_PROB, OBJECT_SPELL_LEVEL, OBJECT_WEIGHT, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, LARGE_BOX, CHEST, ICE_BOX, TALLOW_CANDLE, WAX_CANDLE, EXPENSIVE_CAMERA, CORPSE, EGG, KELP_FROND, SLIME_MOLD, MELON, LUMP_OF_ROYAL_JELLY, CREAM_PIE, TIN, GOLD_PIECE, SPE_NOVEL, TOUCHSTONE, ROCK, BOULDER, STATUE, MACE, RING_MAIL, ROBE, CLOAK_OF_PROTECTION, CLOAK_OF_MAGIC_RESISTANCE } from './object_data.js';
import { MONSTER_ATTACKS, MONSTER_DIFFICULTY, MONSTER_GENO, MONSTER_ALIGNMENT, MONSTER_LEVEL, MONSTER_FLAGS2, MONSTER_SYMBOL, MONSTER_NAME } from './monster_data.js';
import { pickNastyShape } from './monster_polymorph.js';
import { restoreMonsterWormHeads, validMonsterWormBodies } from './monster_worm.js';
import { setMonsterMalign } from './monster_alignment.js';
import { nhgetch } from './input.js';
import { flush_screen, newsym, terrain_glyph } from './display.js';
import { pline } from './pline.js';
import { premap_detect } from './detect.js';
import { TRUE_RUMORS, FALSE_RUMORS, RANDOM_ENGRAVINGS, RANDOM_EPITAPHS } from './random_text_data.js';
import { deleteEngravingAt, makeEngravingAt, restoreEngravings, sanitizeEngravings, wipeEngravingAt, wipeoutText } from './engrave.js';
import { addObjectToMonsterInventory, linkObjectToMonsterInventory, restoreMonsterInventoryOwnership } from './monster_inventory.js';
import { setupElementalBubbles } from './elemental.js';
import { insideRoom, roomsAt } from './room.js';
import { insideShopRoomAt } from './shk.js';
import { convertSecretDoor } from './detect.js';
import { PM_SOLDIER, antholeMonsterType, markRandomSpecialRoom, mkshop, occupied, roomHasStair, somex, somey, somexyspace, } from './mkroom.js';
import { bound_digging, generateAstralLevel, generateBigRoom, generateDungeonMazeFile, generateElementalPlane, generateFakeWizardLevel, generateKnoxLevel, generateLuaQuestLevel, generateMedusaLevel, generateMinesEnd, generateMinetown, generateOracleLevel, generateRandomMaze, generateSokobanLevel, generateSpecialAndFixup, generateVladsTowerLevel, generateWizardLevel, isLuaQuestPrototype, mazeFloorPoint, mkportal, place_lregion, setLevelTerrainType, wallification, } from './mkmaze.js';
import { getbones } from './bones.js';
import { makeroguerooms, makerogueghost } from './extralev.js';
import { restoreLevelRegions } from './regions.js';
import { beginObjectBurn } from './light.js';
import { LEVEL_TIMER_KIND, OBJECT_TIMER_KIND, restoreLevelTimers, stopLevelTimer } from './object_timers.js';
import { objectWeight } from './weight.js';
import { createOrcRaid } from './orc_raid.js';
import { curseObjectState } from './object_state.js';
import { vision_note_blocker_change, vision_reset_new_level } from './vision.js';
import { goodPosition } from './teleport_rules.js';
import { canOverwriteTerrain, isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { addToContainer, check_room, create_room, dig_corridor, fillSpecialRoom, fillVault, finishLevelTrapConstruction, medusaPetrifiable, putGeneratedMonsterInventoryInStatue } from './sp_lev.js';
import { beginLuaThemerooms, callLuaThemerooms, generateLuaSpecialLevel, themerooms_generate } from './sp_lev_lua.js';
// mklev.js — regular level generation.
// C ref: mklev.c — mklev, makelevel, makerooms, makecorridors,
// generate_stairs, fill_ordinary_room, mineralize, level_finalize_topology.
// sp_lev.c special-level construction lives in sp_lev.ts and sp_lev_lua.ts;
// mkmaze.c mazes and special-level fixups in mkmaze.ts; mkroom.c special
// room selection and filling in mkroom.ts; bones.c in bones.ts; the Rogue
// level (extralev.c) in extralev.ts. Level construction uses the game's
// main random-number stream.
// Object/class constants (normally from objects.js, not in contest template)
export const RANDOM_CLASS = 0;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const TOOL_CLASS = 6;
const M2_DOMESTIC = 0x00400000;
export const G_NOGEN = 0x0200;
export const G_IGNORE = 0x8000;
export const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
export const SPBOOK_CLASS = 10;
export const WAND_CLASS = 11;
export const GEM_CLASS = 13;
export const SCR_TELEPORTATION = 333;
export const RIN_TELEPORTATION = 194;
const SCR_LIGHT = 332;
const SPE_LIGHT = 372;
const BELL = 255;
export const CANDELABRUM_OF_INVOCATION = 262;
export const PM_VAMPIRE_BAT = 129;
export const SPBOOK_no_NOVEL = -SPBOOK_CLASS;
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
export const WAN_DIGGING = 428;
const SPE_HEALING = 374;
const FOOD_RATION = 293;
const CRAM_RATION = 292;
const LEMBAS_WAFER = 291;
export const WAN_TELEPORTATION = 424;
const WAN_SLEEP = 432;
export const PM_GIANT_SPIDER = 96;
export const PM_MINOTAUR = 177;
const PM_HUMAN_ZOMBIE = 244;
const PM_WRAITH = 230;
const PM_DWARF = 44;
const PM_GNOME = 165;
export const PM_FIRE_ELEMENTAL = 155;
export const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
export const PM_VLAD_THE_IMPALER = 228;
const PM_ARCHAEOLOGIST = 331;
const PM_WIZARD = 343;
export const PM_SALAMANDER = 329;
export const S_MIMIC = 13;
const S_ANGEL = 27;
const S_DEMON = 56;
const G_UNIQ_MASK = 0x1000;
export const PM_BLACK_LIGHT = 119;
export const PM_STALKER = 153;
const PM_BLACK_PUDDING = 209;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
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
export function is_hole(t) { return t === HOLE || t === TRAPDOOR; }
export function is_pit(t) { return t === PIT || t === SPIKED_PIT; }
// Stairway list management
export function stairway_add(x, y, up, isladder, dest) {
    const node = {
        sx: x, sy: y, up, isladder, tolev: { ...dest },
        u_traversed: false,
        next: game.stairs,
    };
    game.stairs = node;
}
// ── Stairway lookup ──
export function stairway_find_dir(up) {
    for (let s = game.stairs; s; s = s.next)
        if (s.up === up)
            return s;
    return null;
}
function stairway_find_special_dir(up) {
    for (let s = game.stairs; s; s = s.next)
        if (s.tolev.dnum !== (game.u?.uz?.dnum ?? 0) && s.up !== up)
            return s;
    return null;
}
// ── Hero placement (C ref: stairs.c, mkmaze.c) ──
// C refs: dungeon.c Can_dig_down()/Can_fall_thru().  A level's hard-floor
// flag is only one of the gates: bottom levels and the invocation level also
// reject holes, while the Castle is an explicit exception because its
// trapdoors lead into the Valley.
export function canDigDown(uz = game.u.uz) {
    // C dungeon.c:Can_dig_down() pairs the current level's hard-floor flag
    // with the destination depth checks in the level argument.
    if (!uz)
        return false;
    return !game.level?.flags?.hardfloor
        && !Is_botlevel(uz)
        && !Invocation_lev(uz);
}
export function canFallThrough(uz = game.u.uz) {
    return canDigDown(uz) || (uz !== undefined && Is_stronghold(uz));
}
// C ref: stairs.c:u_on_sstairs() — place the hero on the special (branch)
// staircase, falling back to a random arrival spot.
export async function u_on_sstairs(upflag) {
    const stway = stairway_find_special_dir(!!(upflag & 1));
    if (stway) {
        await placeHeroOnLevel(stway.sx, stway.sy);
        return;
    }
    await u_on_rndspot(!!(upflag & 1));
}
// C ref: dungeon.c:u_on_rndspot() restricted to the flag bits the stairs.c
// callers pass: arrivals use the level's up or down teleport region, and an
// unset region lets place_lregion() default to the whole level.
async function u_on_rndspot(up) {
    const region = up ? game.level?.upTeleportRegion : game.level?.downTeleportRegion;
    const area = region ?? { lx: 0, ly: 0, hx: 0, hy: 0 };
    const excluded = region?.exclude ?? { lx: -1, ly: -1, hx: -1, hy: -1 };
    await place_lregion(area.lx, area.ly, area.hx, area.hy, excluded.lx, excluded.ly, excluded.hx, excluded.hy, up ? LR_UPTELE : LR_DOWNTELE, null);
    await switchHeroTerrain();
}
// C ref: stairs.c:u_on_upstairs() — place you on upstairs (or special
// equivalent).
export async function u_on_upstairs() {
    const stway = stairway_find_dir(true);
    if (stway) {
        await placeHeroOnLevel(stway.sx, stway.sy);
        return;
    }
    await u_on_sstairs(0); /* destination upstairs implies moving down */
}
// C ref: stairs.c:u_on_dnstairs() — place you on dnstairs (or special
// equivalent).
export async function u_on_downstairs() {
    const stway = stairway_find_dir(false);
    if (stway) {
        await placeHeroOnLevel(stway.sx, stway.sy);
        return;
    }
    await u_on_sstairs(1); /* destination dnstairs implies moving up */
}
const M2_HUMAN = 0x00000008;
const M2_ELF = 0x00000010;
export const M2_DWARF = 0x00000020;
export const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
const M2_JEWELS = 0x20000000;
export const M2_SHAPESHIFTER = 0x00004000;
export const M2_MALE = 0x00010000;
export const M2_FEMALE = 0x00020000;
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
        for (let i = 0, remaining = ring.length; remaining > 1; i++, remaining--) {
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
export function findMonsterNearPositionCore(mnum, centerX, centerY, gpflags, state) {
    const species = mnum ?? state.u.umonster;
    if (species === undefined)
        throw new Error('monster placement requires a species or initialized hero body');
    const subject = { kind: 'species', mnum: species };
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
    if ((gpflags & GP_ALLOW_XY)
        && goodPosition(centerX, centerY, subject, { state, gpflags }))
        return { x: centerX, y: centerY };
    return null;
}
// C teleport.c:enexto().  The first complete search avoids scary squares;
// only total failure triggers an independently shuffled unrestricted search.
// Exposing selection separately lets callbacks distinguish enexto failure
// from a later makemon()/make_familiar() construction failure.
export function findMonsterNearPosition(mnum, centerX, centerY, { ignoreWater = false, gpflags = 0, state = game } = {}) {
    const flags = gpflags | (ignoreWater ? MM_IGNOREWATER : 0);
    return findMonsterNearPositionCore(mnum, centerX, centerY, flags | GP_CHECKSCARY, state) || findMonsterNearPositionCore(mnum, centerX, centerY, flags, state);
}
// C potion.c:split_mon() halves maximum HP after cloneu() divides current HP.
export async function splitHeroMonsterForm(state = game) {
    const maximum = state.u.mhmax;
    if (maximum === undefined)
        return null;
    const clone = await cloneHeroMonsterForm(state);
    if (clone) {
        clone.mhpmax = Math.trunc(maximum / 2);
        state.u.mhmax = maximum - clone.mhpmax;
    }
    return clone;
}
// C refs: mhitu.c:cloneu() and dog.c:initedog().
// The actor is a fresh makemon birth rather than a copy of youmonst: it owns
// ordinary placement, HP, gender, attitude, and identity RNG before cloneu()
// replaces its level/HP and initializes a named tame companion.
export async function cloneHeroMonsterForm(state = game) {
    if (state !== game)
        throw new Error('hero clone owner requires live game state');
    const u = state.u;
    if (typeof u.mh !== 'number' || typeof u.mhmax !== 'number')
        return null;
    if (Number.isFinite(u.mh) && Number.isFinite(u.mhmax)
        && u.mh > u.mhmax)
        u.mh = u.mhmax;
    const mnum = u.umonnum;
    if (typeof mnum !== 'number' || !Number.isInteger(mnum))
        return null;
    const vitalFlags = state.mvitals?.[mnum]?.mvflags ?? 0;
    if (!Number.isFinite(u.mh)
        || !Number.isFinite(u.mhmax) || u.mh <= 1
        || (vitalFlags & (G_EXTINCT | G_GENOD)))
        return null;
    const clone = await makemonNear(mnum, u.ux, u.uy, NO_MINVENT | MM_EDOG | MM_NOMSG, true);
    if (!clone)
        return null;
    const name = state.plname || 'player';
    const edog = {
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
    clone.mtame = Math.max((MONSTER_FLAGS2[mnum] ?? 0) & M2_DOMESTIC ? 10 : 5, clone.mtame ?? 0);
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
    setMonsterMalign(clone, state);
    clone.mhpmax = u.mhmax;
    clone.mhp = Math.trunc(u.mh / 2);
    u.mh -= clone.mhp;
    state.context.botl = true;
    // C cloneu() never redraws the clone's square after taming it: the glyph
    // cached by makemon()'s newsym() (warning digit for a blind warned hero,
    // hostile monster glyph otherwise) stays until something else redraws it.
    if (!u.uconduct)
        u.uconduct = {};
    u.uconduct.pets = (u.uconduct.pets ?? 0) + 1;
    return clone;
}
// C refs: teleport.c enexto()/collect_coords() and makemon.c makemon().
export async function makemonNear(mnum, centerX, centerY, flags = 0, requestedByHero = centerX === game.u?.ux && centerY === game.u?.uy) {
    // Hero-origin placement belongs to makemon(), after its debug guard.
    // Other callers, such as egg hatching, call enexto() before makemon().
    if (requestedByHero && game.iflags.debug_mongen)
        return null;
    const pos = findMonsterNearPosition(mnum, centerX, centerY, {
        ignoreWater: !!(flags & MM_IGNOREWATER),
    });
    if (!pos)
        return null;
    // teleport.c:enexto_core() tests every shuffled coordinate through
    // goodpos() for the requested species before makemon() owns construction.
    return makemon(mnum, pos.x, pos.y, flags, requestedByHero);
}
// C refs: wizard.c:nasty()/pick_nasty() and mcastu.c:mcast_summon_mons().
// A monster-cast summon deliberately chooses an explicit high-difficulty
// species, asks enexto() for a square around the caster's apparent hero
// position, then runs the ordinary makemon() constructor.  The created
// actors retain the normal constructor's messages and display updates.
export async function summonNastyMonsters(summoner) {
    const created = [];
    const census = nastyMonsterCensus();
    const flags = summoner ? MM_NOMSG : 0;
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
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
    const casterAlignment = Math.sign(summoner ? MONSTER_ALIGNMENT[summoner.mnum] ?? 0 : 0);
    const outerLimit = (game.u?.ulevel ?? 1) > 3
        ? Math.trunc((game.u?.ulevel ?? 1) / 3) : 1;
    const outerCount = rnd(outerLimit);
    const archLich = MONSTER_NAME.indexOf('arch-lich');
    const archon = MONSTER_NAME.indexOf('Archon');
    const lowerArchDifficulty = Math.min(MONSTER_DIFFICULTY[archon] ?? 0, MONSTER_DIFFICULTY[archLich] ?? 0);
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
            } while ((difficultyCap > 0
                && (MONSTER_DIFFICULTY[makeindex] ?? 0)
                    >= difficultyCap
                && (MONSTER_ATTACKS[makeindex] || []).some(([attackType]) => attackType === 255))
                || (summonerClass === S_DEMON && candidateClass === S_ANGEL)
                || (summonerClass === S_ANGEL && candidateClass === S_DEMON));
            if (makeindex == null)
                continue;
            const position = summoner ? findMonsterNearPosition(makeindex, summoner.mux ?? game.u.ux, summoner.muy ?? game.u.uy)
                : { x: game.u.ux, y: game.u.uy };
            if (!position)
                continue;
            let monster = await makemon(makeindex, position.x, position.y, flags);
            if (monster) {
                monster.msleeping = 0;
                monster.mpeaceful = 0;
                monster.mtame = 0;
                setMonsterMalign(monster);
            }
            else {
                monster = await makemon(null, position.x, position.y, flags);
                if (monster) {
                    const replacementClass = MONSTER_SYMBOL[monster.mnum] ?? 0;
                    if ((difficultyCap > 0 && (MONSTER_DIFFICULTY[monster.mnum] ?? 0) >= difficultyCap
                        && rn2(In_endgame(game.u.uz) ? 3 : 7)
                        && (MONSTER_ATTACKS[monster.mnum] ?? []).some(([type]) => type === 255))
                        || (summonerClass === S_DEMON && replacementClass === S_ANGEL)
                        || (summonerClass === S_ANGEL && replacementClass === S_DEMON)) {
                        await unmakeNastySubstitute(monster);
                        monster = null;
                    }
                }
            }
            if (!monster)
                continue;
            if (monster.mnum === archLich || monster.mnum === archon) {
                if (!difficultyCap || difficultyCap > lowerArchDifficulty)
                    difficultyCap = lowerArchDifficulty;
            }
            monster.mspec_used = rnd(4);
            created.push(monster);
            const monsterAlignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
            if (created.length >= 10
                || monsterAlignment === 0
                || Math.sign(monsterAlignment) === casterAlignment) {
                break;
            }
        }
    }
    return { count: created.length ? nastyMonsterCensus() - census : 0, created };
}
function nastyMonsterCensus() {
    return game.level?.monsters.filter(monster => !monster.dead && monster.mhp > 0
        && !(monster.isgd && monster.mx === 0)).length ?? 0;
}
// C makemon.c:unmakemon(). Rejected substitutes undo their counted birth
// and artifact creation before the ordinary non-death removal.
async function unmakeNastySubstitute(monster) {
    const vital = game.mvitals?.[monster.mnum];
    if (vital) {
        if (vital.born > 0 && vital.born < 255)
            vital.born--;
        if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ_MASK)
            vital.mvflags &= ~G_EXTINCT;
    }
    monster.mhp = 0;
    await discardMonsterInventory(monster, true);
    await removeMonsterFromGame(monster);
}
// C trap.c:hole_destination().
// C trap.c:choose_trapnote().
export async function maketrap(x, y, typ) {
    // trap.c:maketrap() treats the two pseudo-types returned by rndtrap()
    // as failed constructions.  They describe trapped furniture rather than
    // floor traps and must not occupy the coordinate for later lregions.
    if (typ === TRAPPED_DOOR || typ === TRAPPED_CHEST)
        return null;
    if (!game.level) {
        return {
            ttyp: typ, tx: x, ty: y, tseen: typ === HOLE, once: false,
            launch: { x: 0, y: 0 },
        };
    }
    const level = game.level;
    if (!level.traps)
        level.traps = [];
    const oldTrap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    // C reinitializes a destroyable trap in place.  This matters when a Lua
    // random trap lands on a fixed one: t_at() must expose the replacement,
    // not an older duplicate.  Portals and the vibrating square are the two
    // undestroyable floor traps and reject replacement.
    if (oldTrap
        && (oldTrap.ttyp === MAGIC_PORTAL
            || oldTrap.ttyp === VIBRATING_SQUARE))
        return null;
    if (!oldTrap) {
        const terrain = level.at(x, y)?.typ;
        // trap.c:maketrap() rejects terrain before allocating a trap.  In
        // particular, Wiz-strt's random trap can land in a cloud: the Lua
        // location owner accepts that dry square, but maketrap() rejects
        // IS_AIR and its caller must not run the later victim-chance draw.
        if (terrain !== undefined && !canOverwriteTerrain(terrain)
            || isPoolAt(x, y) || isLavaAt(x, y)
            || (terrain !== undefined && IS_FURNITURE(terrain)
                && typ !== PIT && typ !== HOLE)
            || (terrain === DRAWBRIDGE_UP && typ === MAGIC_PORTAL)
            || (terrain !== undefined && IS_AIR(terrain) && typ !== MAGIC_PORTAL)
            || (typ === LEVEL_TELEP && Is_knox_level(game.u.uz))) {
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
    const initializedTrap = {
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
    if (is_pit(typ))
        trap.conjoined = 0;
    if (is_hole(typ)) {
        // C ref: trap.c hole_destination().  Ordinary holes and trapdoors
        // advance at least one level, then have a 3/4 chance to stop at each
        // level until the current dungeon's bottom is reached.
        const dnum = game.u?.uz?.dnum ?? 0;
        const dungeon = game.dungeons?.[dnum];
        let bottom = dungeon?.num_dunlevs
            ?? (game.u?.uz?.dlevel ?? 1);
        if (In_quest(game.u.uz)) {
            const locate = game.specialLevels?.get('x-loca');
            if (locate && (dungeon?.dunlev_ureached ?? 0) < locate.dlevel)
                bottom = locate.dlevel;
        }
        else if (In_hell(game.u.uz) && !game.u.uevent?.invoked) {
            bottom--;
        }
        let dlevel = game.u?.uz?.dlevel ?? 1;
        while (dlevel < bottom) {
            dlevel++;
            if (rn2(4))
                break;
        }
        trap.dst = { dnum, dlevel };
    }
    if (!oldTrap)
        level.traps.push(trap);
    if (is_pit(typ) || is_hole(typ)) {
        await preparePitOrHoleTerrain(x, y, typ);
    }
    else if (typ === STATUE_TRAP) {
        // trap.c mk_trap_statue(): avoid a co-aligned unicorn whose eventual
        // attitude would contradict the trap, then let mkcorpstat() perform
        // its independent initialized-statue identity before overwriting it.
        let statueMonster;
        let tryCount = 10;
        do {
            statueMonster = rndmonnumAdj(3, 6);
        } while (--tryCount > 0
            && MONSTER_SYMBOL[statueMonster] === 21
            && ((MONSTER_FLAGS2[statueMonster] ?? 0) & M2_JEWELS)
            && Math.sign(game.u?.ualign?.type ?? 0)
                === Math.sign(MONSTER_ALIGNMENT[statueMonster] ?? 0));
        const statue = await createCorpstatAt(STATUE, null, statueMonster, x, y, 0);
        const temporary = await makemon(statue.corpsenm ?? null, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG);
        if (temporary) {
            await putGeneratedMonsterInventoryInStatue(temporary, statue);
            level.monsters = level.monsters.filter(monster => monster !== temporary);
        }
    }
    else if (typ === SQKY_BOARD) {
        const used = new Set(level.traps
            .filter(candidate => candidate !== trap && candidate.ttyp === SQKY_BOARD)
            .map(candidate => candidate.tnote));
        const available = [];
        for (let note = 0; note < 12; note++)
            if (!used.has(note))
                available.push(note);
        const selectedNote = available.length
            ? available[rn2(available.length)] : rn2(12);
        if (selectedNote === undefined)
            throw new Error('Squeaky board selected a missing note');
        trap.tnote = selectedNote;
    }
    else if (typ === ROLLING_BOULDER_TRAP
        && level.flags.sokoban_rules) {
        // Sokoban has no rolling-boulder launchers. The trap stays in place
        // without creating another boulder.
        trap.launch = { x, y };
        trap.launch2 = { x, y };
    }
    else if (typ === ROLLING_BOULDER_TRAP) {
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
        const clearPath = (dx, dy, length) => {
            for (let step = 1; step <= length; step++) {
                const px = x + step * dx, py = y + step * dy;
                const loc = isok(px, py) ? level.at(px, py) : undefined;
                if (!loc || !ZAP_POS(loc.typ)
                    || (IS_DOOR(loc.typ) && (loc.doormask & (D_LOCKED | D_CLOSED)) !== 0))
                    return false;
                const blockingTrap = level.traps.some(candidate => candidate !== trap && candidate.tx === px
                    && candidate.ty === py
                    && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)
                        || (candidate.ttyp >= TELEP_TRAP && candidate.ttyp <= MAGIC_PORTAL)));
                if (blockingTrap)
                    return false;
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
            if (++tries % 8 === 0)
                distance--;
        }
        if (launch) {
            const boulder = await mksobj(BOULDER, true, false);
            placeCreatedObject(boulder, launch.x, launch.y);
            await stack_object(boulder);
            trap.launch = launch;
            await newsym(launch.x, launch.y);
            trap.launch2 = {
                x: x - (launch.x - x), y: y - (launch.y - y),
            };
        }
        else {
            trap.launch = { x, y };
            trap.launch2 = { x, y };
        }
    }
    if (oldTrap)
        finishSokobanIfSolved();
    return trap;
}
// C trap.c:maketrap() owns these effects even when the caller is Lua or
// wizard trap creation rather than digging. Preserve the old shop terrain
// for repair before opening the floor and exposing buried objects.
async function preparePitOrHoleTerrain(x, y, trapType) {
    const level = requireGameLevel();
    const location = level.requireAt(x, y);
    const oldType = location.typ;
    const wasIce = isIceAt(x, y);
    const wallOrDoor = IS_DOOR(oldType) || IS_WALL(oldType);
    if (roomsAt(game.level, x, y, SHOPBASE).length
        && (is_hole(trapType) || wallOrDoor)) {
        addShopDamage(x, y, wallOrDoor && !game.context.mon_moving ? SHOP_HOLE_COST : 0);
    }
    if (oldType === DRAWBRIDGE_UP) {
        location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER) | DB_FLOOR;
        location.flags = location.drawbridgemask;
    }
    else {
        if (IS_ROOM(oldType))
            setLevelTerrainType(x, y, ROOM);
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
// C trap.c:delfloortrap().  Destroys a trap which emanates from the floor,
// freeing a hero or monster caught in it.  Portal-like and special traps are
// not floor traps and are rejected.
export async function deleteFloorTrap(trap, state = game) {
    if (!trap)
        return false;
    const ttyp = trap.ttyp;
    const removable = ttyp === SQKY_BOARD || ttyp === BEAR_TRAP
        || ttyp === LANDMINE || ttyp === FIRE_TRAP || is_pit(ttyp)
        || is_hole(ttyp) || ttyp === TELEP_TRAP || ttyp === LEVEL_TELEP
        || ttyp === WEB || ttyp === MAGIC_TRAP || ttyp === ANTI_MAGIC;
    if (!removable)
        return false;
    if (state.u?.ux === trap.tx && state.u?.uy === trap.ty) {
        // C reset_utrap(TRUE): a freed hero may resume floating.
        if (state.u.utraptype !== TT_BURIEDBALL) {
            await resetHeroTrap(true, state);
        }
    }
    else {
        const monster = (state.level?.monsters || []).find(candidate => monsterHasMapPosition(candidate, state) &&
            !candidate.dead && monsterOccupiesPosition(candidate, trap.tx, trap.ty));
        if (monster)
            monster.mtrapped = 0;
    }
    deleteTrap(trap, state);
    return true;
}
export async function runClaimedObjectRotTimer(claimed, state = game) {
    const object = claimed?.object;
    const kind = claimed?.timer?.kind;
    if (!object || (kind !== OBJECT_TIMER_KIND.ROT_CORPSE
        && kind !== OBJECT_TIMER_KIND.ROT_ORGANIC))
        return null;
    if (kind === OBJECT_TIMER_KIND.ROT_ORGANIC) {
        while (object.contents?.length) {
            const content = object.contents[0];
            if (!content)
                throw new Error('Rotting container is missing its first object');
            content.ox = object.ox;
            content.oy = object.oy;
            if ((await buryObject(content, state)).outcome === 'skipped') {
                return { kind: 'blocked-organic-rot', object };
            }
        }
    }
    const { where, ox: x, oy: y } = object;
    if (kind === OBJECT_TIMER_KIND.ROT_CORPSE)
        await rotCorpse(object, state);
    else
        await deleteObject(object, state);
    return { kind, object, where, x, y };
}
export function make_engr_at(x, y, text, pristine, epoch, engr_type, options = undefined) {
    return makeEngravingAt(x, y, text, pristine, epoch, engr_type, options);
}
export function make_grave(x, y, text) {
    const loc = game.level?.at(x, y);
    const trapped = game.level?.traps?.some(trap => trap.tx === x && trap.ty === y);
    if (!loc || (loc.typ !== ROOM && loc.typ !== GRAVE) || trapped)
        return;
    if (!setLevelTerrainType(x, y, GRAVE))
        return;
    const epitaph = text ?? getRandomTextLine(RANDOM_EPITAPHS);
    make_engr_at(x, y, epitaph, null, 0, HEADSTONE);
}
// C ref: rumors.c get_rnd_line().  makedefs pads each source line to a
// minimum of 59 text bytes plus its newline.  Selection deliberately seeks
// into one line and returns the following line.
function getRandomTextLine(lines) {
    if (!lines.length)
        throw new Error('Random text needs at least one source line');
    const sizes = lines.map(line => Math.max(line.length, 59) + 1);
    const fileSize = sizes.reduce((sum, size) => sum + size, 0);
    let picked = 0;
    for (let tries = 10; tries > 0; tries--) {
        let offset = rn2(fileSize);
        picked = 0;
        let size = sizes[picked];
        if (size === undefined)
            throw new Error('Random text is missing its first line size');
        while (offset >= size) {
            offset -= size;
            size = sizes[++picked];
            if (size === undefined)
                throw new Error('Random text offset exceeds its source text');
        }
        const remainder = size - offset;
        if (remainder <= 61)
            break;
    }
    const line = lines[(picked + 1) % lines.length];
    if (line === undefined)
        throw new Error('Random text selection is missing its source line');
    return line;
}
export function getRumor(excludeCookie, truth = 0) {
    let rumor = '';
    let count = 0;
    let trueRumor = false;
    do {
        trueRumor = truth + rn2(2) > 0;
        rumor = getRandomTextLine(trueRumor
            ? TRUE_RUMORS : FALSE_RUMORS);
    } while (count++ < 50 && excludeCookie && rumor.startsWith('[cookie] '));
    if (count < 50 && !game.in_mklev)
        exerciseWisdom(trueRumor);
    if (!excludeCookie && rumor.startsWith('[cookie] '))
        rumor = rumor.slice('[cookie] '.length);
    return rumor;
}
// C ref: engrave.c random_engraving().
export function randomEngraving() {
    let pristine;
    if (!rn2(4))
        pristine = getRandomTextLine(RANDOM_ENGRAVINGS);
    else
        pristine = getRumor(true) || getRandomTextLine(RANDOM_ENGRAVINGS);
    return {
        pristine,
        text: wipeoutText(pristine, Math.trunc(pristine.length / 4)),
    };
}
// C ref: nhlua.c l_nhcore_init() (defined at nhlua.c:140)
export async function l_nhcore_init() {
    await currentLuaLifecycle().startCore(game);
}
// C ref: mklev.c mklev()
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
// C ref: mklev.c makelevel()
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
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'knox') {
            await generateKnoxLevel(g._activeSpecialLevel);
            return;
        }
        if (prototype === 'asmodeus') {
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            return;
        }
        if (prototype === 'juiblex') {
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'baalz') {
            g._activeSpecialLevel.baalzFixup = true;
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            return;
        }
        if (prototype === 'orcus') {
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
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
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
                    await fillSpecialRoom(room);
            return;
        }
        if (prototype === 'sanctum') {
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
            for (const room of level.rooms.slice(0, level.nroom))
                if (isRoom(room))
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
            await generateSpecialAndFixup(generateLuaSpecialLevel, g._activeSpecialLevel);
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
        const branchp = is_branchlev();
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
                await fillSpecialRoom(croom);
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
    const branchp = is_branchlev();
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
            await fillSpecialRoom(croom);
    if (themedRooms) {
        await callLuaThemerooms('post_level_generate');
        // A loaded theme interpreter wallifies the complete level, including
        // walls placed inside rooms by terrain callbacks such as "Pillars".
        wallification(1, 0, COLNO - 1, ROWNO - 1);
    }
}
// C ref: mklev.c mk_knox_portal().  Fort Ludios starts with an out-of-range
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
    if (!onKnoxSourceEnd && is_branchlev())
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
    await placeBranchAt(branch, x, y);
    return true;
}
// C ref: mklev.c makelevel() random-special-room else-if chain.  Every failed
// depth-eligible predicate owns its draw; once one type is selected, room
// picking becomes mkroom.c's responsibility and later predicates are skipped.
async function maybeMakeSpecialRoom(roomThreshold) {
    const uDepth = depth_of_level(game.u?.uz);
    const medusaDepth = depth_of_level(game.medusa_level);
    if (uDepth > 1 && uDepth < medusaDepth
        && requireGameLevel().nroom >= roomThreshold && rn2(uDepth) < 3)
        return mkshop();
    if (uDepth > 4 && !rn2(6))
        return markRandomSpecialRoom(COURT);
    if (uDepth > 5 && !rn2(8)
        && !((game.mvitals?.[MONSTER_NAME.indexOf('leprechaun')]?.mvflags ?? 0) & G_GONE))
        return markRandomSpecialRoom(LEPREHALL);
    if (uDepth > 6 && !rn2(7))
        return markRandomSpecialRoom(ZOO);
    if (uDepth > 8 && !rn2(5))
        return markRandomSpecialRoom(TEMPLE);
    if (uDepth > 9 && !rn2(5)
        && !((game.mvitals?.[MONSTER_NAME.indexOf('killer bee')]?.mvflags ?? 0) & G_GONE))
        return markRandomSpecialRoom(BEEHIVE);
    if (uDepth > 11 && !rn2(6))
        return markRandomSpecialRoom(MORGUE);
    if (uDepth > 12 && !rn2(8) && antholeMonsterType() !== null)
        return markRandomSpecialRoom(ANTHOLE);
    if (uDepth > 14 && !rn2(4)
        && !((game.mvitals?.[PM_SOLDIER]?.mvflags ?? 0) & G_GONE))
        return markRandomSpecialRoom(BARRACKS);
    if (uDepth > 15 && !rn2(6))
        return markRandomSpecialRoom(SWAMP);
    if (uDepth > 16 && !rn2(8)
        && !((game.mvitals?.[MONSTER_NAME.indexOf('cockatrice')]?.mvflags ?? 0) & G_GONE))
        return markRandomSpecialRoom(COCKNEST);
    return false;
}
// C ref: mklev.c makerooms()
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
function create_vault() {
    return create_room(-1, -1, 2, 2, -1, -1, VAULT, true);
}
// C ref: mklev.c add_room()
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
// C ref: mklev.c do_room_or_subroom()
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
// C ref: mklev.c sort_rooms()
// C mklev.c:mkroom_cmp().
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
// C ref: mklev.c topologize()
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
// C ref: mklev.c finddpos()
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
export function maybe_sdoor(chance) {
    const d = depth_of_level(game.u?.uz);
    return (d > 2) && !rn2(Math.max(2, chance));
}
// C ref: mklev.c dosdoor()
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
export async function dodoor(x, y, aroom) {
    await dosdoor(x, y, aroom, maybe_sdoor(8) ? SDOOR : DOOR);
}
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
// C ref: mklev.c join()
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
// C ref: mklev.c makecorridors()
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
        const terrain = terrain_glyph(loc, x, y).terrainName;
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
export function is_branchlev() {
    const g = game;
    if (!g.branches)
        return null;
    for (const br of g.branches) {
        if (br?.end1?.dnum === (g.u?.uz?.dnum ?? 0) && br?.end1?.dlevel === (g.u?.uz?.dlevel ?? 1))
            return br;
        if (br?.end2?.dnum === (g.u?.uz?.dnum ?? 0) && br?.end2?.dlevel === (g.u?.uz?.dlevel ?? 1))
            return br;
    }
    return null;
}
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
export async function placeBranchAt(branchp, x, y) {
    const g = game;
    if (!branchp || g.made_branch)
        return;
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
    g.made_branch = true;
}
export async function place_branch(branchp) {
    const g = game;
    if (!branchp || g.made_branch)
        return;
    const mp = { x: 0, y: 0 };
    find_branch_room(mp);
    await placeBranchAt(branchp, mp.x, mp.y);
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
    const corpse = await createCorpstatAt(CORPSE, null, victim_mnum, x, y, 8); // CORPSTAT_INIT
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
// C mktrap(): the room and maze callers share type selection, collision
// checks, web residents, and shallow-level victims.
// C mklev.c:traptype_roguelvl().
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
// C mklev.c:mksink().
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
        await createCorpstatAt(STATUE, null, null, pos.x, pos.y, 8);
    }
    // Bonus items
    let skip_chests = false;
    if (bonus_items && somexyspace(croom, pos)) {
        const branchp = is_branchlev();
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
    if (!rn2(27 + 3 * Math.abs(levelDepth))) {
        const { text: engrText, pristine } = randomEngraving();
        if (engrText) {
            do {
                somexyspace(croom, pos);
                if (level.at(pos.x, pos.y)?.typ === ROOM)
                    break;
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
    setWallState();
    for (const room of [...level.rooms, ...(level.subrooms ?? [])]) {
        if (isRoom(room))
            room.orig_rtype = room.rtype;
    }
}
//# sourceMappingURL=mklev.js.map