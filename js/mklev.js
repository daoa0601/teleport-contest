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
import { occupied, somex, somey, somexyspace } from './mkroom.js';
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
// mklev.js — Level generation.
// C ref: mklev.c — makelevel, makerooms, makecorridors, generate_stairs.
// sp_lev.c special-level construction lives in sp_lev.ts and sp_lev_lua.ts.
// Level construction uses the game's main random-number stream.
// Object/class constants (normally from objects.js, not in contest template)
export const RANDOM_CLASS = 0;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const TOOL_CLASS = 6;
const M2_DOMESTIC = 0x00400000;
export const G_NOGEN = 0x0200;
export const G_IGNORE = 0x8000;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
export const GEM_CLASS = 13;
// shknam.c's health-food pseudo-class lives just above the real object
// classes and is resolved by shkveg(), not by mkobj().
const VEGETARIAN_CLASS = 19;
export const SCR_TELEPORTATION = 333;
export const RIN_TELEPORTATION = 194;
const SCR_LIGHT = 332;
const ARROW = 18;
const TWO_HANDED_SWORD = 55;
const BOW = 83;
const PLATE_MAIL = 121;
const SPE_LIGHT = 372;
const BELL = 255;
export const CANDELABRUM_OF_INVOCATION = 262;
export const PM_VAMPIRE_BAT = 129;
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
export const WAN_DIGGING = 428;
const SPE_HEALING = 374;
const FOOD_RATION = 293;
const CRAM_RATION = 292;
const LEMBAS_WAFER = 291;
const SCR_CHARGING = 342;
export const WAN_TELEPORTATION = 424;
const WAN_SLEEP = 432;
const PM_SHOPKEEPER = 271;
export const PM_GIANT_SPIDER = 96;
export const PM_MINOTAUR = 177;
const PM_ALIGNED_CLERIC = 275;
const PM_HIGH_CLERIC = 276;
const PM_HUMAN_ZOMBIE = 244;
const PM_WRAITH = 230;
const PM_DWARF = 44;
const PM_GNOME = 165;
const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;
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
const PM_GNOME_RULER = 168;
const PM_GIANT_EEL = 319;
export const PM_BLACK_LIGHT = 119;
export const PM_STALKER = 153;
const PM_BLACK_PUDDING = 209;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
export const XLIM = 4;
export const YLIM = 3;
// Direction deltas
const xdir = [-1, -1, 0, 1, 1, 1, 0, -1];
const ydir = [0, -1, -1, -1, 0, 1, 1, 1];
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
function stairway_find_dir(up) {
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
// C refs: mklev.c occupied(), mkmaze.c bad_location().  Exclusion zones and
// the invocation position are modeled by their owning special levels; the
// shared terrain/feature gate belongs here.
function bad_location(x, y, nlx, nly, nhx, nhy) {
    const loc = game.level?.at(x, y);
    if (!loc)
        return true;
    if (occupied(x, y))
        return true;
    // Excluded region
    if (x >= nlx && x <= nhx && y >= nly && y <= nhy)
        return true;
    // Must be ROOM, literal AIR, or CORR on a maze level.  IS_AIR also
    // includes CLOUD for movement/vision, but C's bad_location() deliberately
    // rejects clouds when placing a portal, stair, branch, or hero region.
    if (loc.typ !== ROOM && loc.typ !== AIR
        && !(loc.typ === CORR && game.level?.flags?.is_maze_lev))
        return true;
    return false;
}
// C ref: mkmaze.c place_lregion — place hero (LR_UPTELE/LR_DOWNTELE)
export async function place_lregion(lx, ly, hx, hy, nlx, nly, nhx, nhy, rtype, destination) {
    if (!lx) {
        if (rtype === LR_BRANCH && (game.level?.nroom ?? 0) > 0) {
            await place_branch(is_branchlev());
            return;
        }
        lx = 1;
        hx = COLNO - 1;
        ly = 0;
        hy = ROWNO - 1;
    }
    if (lx < 1)
        lx = 1;
    if (hx > COLNO - 1)
        hx = COLNO - 1;
    if (ly < 0)
        ly = 0;
    if (hy > ROWNO - 1)
        hy = ROWNO - 1;
    const oneshot = lx === hx && ly === hy;
    for (let trycnt = 0; trycnt < 200; trycnt++) {
        const x = rn1((hx - lx) + 1, lx);
        const y = rn1((hy - ly) + 1, ly);
        if (await putLregionHere(x, y, nlx, nly, nhx, nhy, rtype, oneshot, destination))
            return;
    }
    // Deterministic fallback
    for (let x = lx; x <= hx; x++)
        for (let y = ly; y <= hy; y++)
            if (await putLregionHere(x, y, nlx, nly, nhx, nhy, rtype, true, destination))
                return;
    await impossible(`Couldn't place lregion type ${rtype}!`);
}
function excludedLregion(type, x, y) {
    const direction = type === LR_UPTELE ? 'teleport-up' : 'teleport-down';
    return (type === LR_TELE || type === LR_UPTELE || type === LR_DOWNTELE)
        && !!game.level?.exclusionZones.some(zone => (zone.type === 'teleport' || (type !== LR_TELE && zone.type === direction))
            && x >= zone.lx && x <= zone.hx && y >= zone.ly && y <= zone.hy);
}
async function putLregionHere(x, y, nlx, nly, nhx, nhy, type, oneshot, destination) {
    const level = requireGameLevel();
    if (bad_location(x, y, nlx, nly, nhx, nhy) || excludedLregion(type, x, y)) {
        if (!oneshot)
            return false;
        const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
        if (trap && trap.ttyp !== MAGIC_PORTAL && trap.ttyp !== VIBRATING_SQUARE) {
            const monster = monsterAtPosition(level, x, y);
            if (monster)
                monster.mtrapped = 0;
            deleteTrap(trap);
        }
        if (bad_location(x, y, nlx, nly, nhx, nhy) || excludedLregion(type, x, y))
            return false;
    }
    if (type === LR_TELE || type === LR_UPTELE || type === LR_DOWNTELE) {
        const monster = monsterAtPosition(level, x, y);
        if (monster) {
            if (!oneshot)
                return false;
            if (!await randomMonsterRelocation(monster, { flags: RLOC_NOMSG }))
                await sendMonsterToLimbo(monster);
        }
        await placeHeroOnLevel(x, y);
    }
    else if (type === LR_PORTAL) {
        if (!destination)
            throw new Error('Portal region requires a destination');
        await mkportal(x, y, destination.dnum, destination.dlevel);
    }
    else if (type === LR_BRANCH) {
        await placeBranchAt(is_branchlev(), x, y);
    }
    else if (type === LR_DOWNSTAIR || type === LR_UPSTAIR) {
        await mkstairs(x, y, type === LR_UPSTAIR, null);
    }
    return true;
}
// C mkmaze.c:mkportal(). Only the destination coordinates belong to the
// trap; special-level metadata belongs to the dungeon's level descriptor.
export async function mkportal(x, y, dnum, dlevel) {
    const portal = await maketrap(x, y, MAGIC_PORTAL);
    if (!portal) {
        await impossible('portal on top of portal?');
        return;
    }
    portal.dst = { dnum, dlevel };
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
// C questpgr.c:qt_montype(). The chosen role supplies both species and
// fallback classes; a genocided preferred species still spends rn2(5).
function questMonsterType() {
    const role = game.urole;
    if (!role)
        throw new Error('Quest monsters require an initialized role');
    const first = rn2(5) !== 0;
    const species = first ? role.enemy1num : role.enemy2num;
    if (species !== null && rn2(5) && !((game.mvitals?.[species]?.mvflags ?? 0) & G_GENOD))
        return species;
    return mkclass(first ? role.enemy1sym : role.enemy2sym, 0);
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
const BONES_VERSION = 20;
// C files.c:set_bonesfile_name(): special levels keep their identity when
// dungeon generation changes their depth; quest bones also belong to a role.
function bonesLevelId(location = game.u.uz) {
    if (!location)
        throw new Error('Bones require an initialized dungeon location');
    const tag = game.dungeons[location.dnum]?.bonetag;
    if (!tag)
        return '';
    const role = In_quest(location) ? game.urole?.filecode : '0';
    if (role === undefined)
        throw new Error('Quest bones require an initialized role');
    const special = specialLevelAt(location);
    return `${tag}${role}.${special ? special.bonetag ?? '' : location.dlevel}`;
}
function bonesStorageKey(level = game.u.uz) {
    return `teleport-bones:${bonesLevelId(level)}`;
}
export function bonesLevelExists(level = game.u.uz) {
    return game.storage?.getItem(bonesStorageKey(level)) != null;
}
export function deleteBonesLevel() {
    const storage = game.storage;
    if (!storage)
        return false;
    try {
        const key = bonesStorageKey();
        // Native unlink fails if another game has already consumed these bones.
        if (storage.getItem(key) === null)
            return false;
        storage.removeItem(key);
        return storage.getItem(key) === null;
    }
    catch (_error) {
        return false;
    }
}
async function bonesPrompt(message, displayLevel = null) {
    await pline(message);
    const restoredLevel = game.level;
    if (displayLevel)
        game.level = displayLevel;
    await flush_screen(1);
    if (displayLevel)
        game.level = restoredLevel;
    game.nhDisplay?.setCursor(message.length, 0);
    return String.fromCharCode(await nhgetch()).toLowerCase();
}
function eachTopLevelBonesObject(level, visit) {
    for (const monster of [...level.monsters].reverse()) {
        for (const object of monster.minvent || monster.inventory || [])
            visit(object);
    }
    for (const object of bonesFloorObjects(level))
        visit(object);
    for (const object of level?.buriedObjects || [])
        visit(object);
}
function bonesFloorObjects(level) {
    const objects = [];
    for (const column of level.objects)
        for (const pile of column ?? [])
            objects.push(...(pile ?? []));
    return objects.sort((left, right) => (right._fobjOrder ?? 0) - (left._fobjOrder ?? 0));
}
function eachObjectInBonesGraph(level, visit) {
    const walk = (object) => {
        if (!object)
            return;
        visit(object);
        for (const content of object.contents || [])
            walk(content);
    };
    eachTopLevelBonesObject(level, walk);
}
function resetBonesObjectList(objects, mode, ghostly = mode === 'save') {
    const kept = [];
    for (const object of objects || []) {
        object.contents = resetBonesObjectList(object.contents, mode, false);
        for (const content of object.contents)
            content.container = object;
        if (object.in_use)
            continue;
        if (ghostly)
            object.ghostly = true;
        kept.push(mode === 'save'
            ? prepareBonesObjectForSave(object) : prepareBonesObjectForRestore(object));
    }
    return kept;
}
function resetBonesObjects(level, mode) {
    for (const monster of [...level.monsters].reverse()) {
        const inventory = resetBonesObjectList(monster.minvent || monster.inventory, mode);
        monster.minvent = monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
    }
    const retained = new Set(resetBonesObjectList(bonesFloorObjects(level), mode));
    for (const column of level.objects) {
        if (!column)
            continue;
        for (let y = 0; y < column.length; y++)
            column[y] = (column[y] ?? []).filter(object => retained.has(object));
    }
    level.buriedObjects = resetBonesObjectList(level?.buriedObjects, mode);
}
// C refs: bones.c savebones()/resetobjs(FALSE). The persistent payload owns
// the level graph only. The saved-graph codec retains entity aliases and
// container back-pointers; getbones() restores the GameMap prototype.
export function saveBonesLevel(deathCause = '', when = recorderLocalEpochSeconds(game.datetime) || Date.now() / 1000) {
    const storage = game.storage;
    const location = game.u.uz;
    if (!storage || !game.level || !location || !game.urole || !game.urace
        || !game.u.ualign)
        return false;
    purgeDeadMonsters(game.level);
    let payload;
    try {
        payload = decodeBonesPayload(encodeSavedGraph({
            version: BONES_VERSION,
            bonesId: bonesLevelId(),
            savedAt: game.moves,
            level: game.level,
            stairs: game.stairs || null,
            heroTrack: (game._heroTrack || []).map(point => ({
                x: point.x, y: point.y,
            })),
            fruits: [],
        }), BONES_VERSION);
    }
    catch (_error) {
        return false;
    }
    // savebones() records the final role, race, gender, and alignment in
    // cemetery.who. These suffixes also participate in bones_include_name().
    const alignment = game.u.ualign.type === 1 ? 'Law'
        : game.u.ualign.type === -1 ? 'Cha' : 'Neu';
    const who = [
        game.plname || 'player', game.urole.filecode.slice(0, 3),
        game.urace.filecode.slice(0, 3), game.flags.female ? 'Fem' : 'Mal', alignment,
    ].join('-');
    payload.level.bonesInfo = [
        { who, how: scoreDeathCause(deathCause, null), when: recorderTimestamp(when),
            frpx: game.u.ux, frpy: game.u.uy, bonesknown: false },
        ...(payload.level.bonesInfo ?? []),
    ];
    if (game.flags.debug)
        payload.level.flags.wizard_bones = true;
    for (const monster of payload.level.monsters || []) {
        monster.mlstmv = 0;
        if (!Number.isFinite(monster.mux))
            monster.mux = game.u?.ux ?? 0;
        if (!Number.isFinite(monster.muy))
            monster.muy = game.u?.uy ?? 0;
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
    resetBonesObjects(payload.level, 'save');
    const fruitIds = new Set();
    eachObjectInBonesGraph(payload.level, object => {
        if (object.otyp === SLIME_MOLD)
            fruitIds.add(object.spe);
    });
    payload.fruits = (game.fruits || []).filter(fruit => fruitIds.has(fruit.fid))
        .map(fruit => ({ ...fruit }));
    // savebones() removes the dead hero and all of their remembered glyphs
    // before savelev(). Terrain lighting itself remains part of the level.
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = payload.level.locations?.[x]?.[y];
            if (!location)
                continue;
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
        shiftBonesDestinations(payload, location, -location.dlevel);
        storage.setItem(bonesStorageKey(), encodeSavedGraph(payload));
        return true;
    }
    catch (_error) {
        return false;
    }
}
// C save_stairs()/savetrapchn() store same-dungeon destinations relative
// to the saved level. rest_stairs()/getlev() add the receiving level's depth.
// Only the bones copy is shifted; live and cached maps retain absolute depths.
function shiftBonesDestinations(payload, location, adjustment) {
    for (let stair = payload.stairs; stair; stair = stair.next) {
        if (stair.tolev.dnum === location.dnum)
            stair.tolev = { ...stair.tolev, dlevel: stair.tolev.dlevel + adjustment };
    }
    for (const trap of payload.level.traps) {
        const destination = trap.dst;
        if (destination?.dnum === location.dnum)
            trap.dst = { ...destination, dlevel: destination.dlevel + adjustment };
    }
}
function remappedMonsterId(oldId, monsterIds) {
    return oldId !== undefined && Number.isInteger(oldId) ? monsterIds.get(oldId) : undefined;
}
function repairContainedObjects(container) {
    for (const object of container.contents || []) {
        object.container = container;
        object.where = 'contained';
        delete object.carrierMid;
        repairContainedObjects(object);
    }
}
function repairObjectMonsterIds(object, monsterIds) {
    const extra = object.oextra;
    const omid = extra?.omid;
    if (omid && extra) {
        const newId = remappedMonsterId(omid, monsterIds);
        if (newId)
            extra.omid = newId;
        else
            delete extra.omid;
    }
    if (object.omid) {
        const newId = remappedMonsterId(object.omid, monsterIds);
        if (newId)
            object.omid = newId;
        else
            delete object.omid;
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
function repairMonsterExtensions(monster) {
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
        if (monster.mextra?.eshk)
            monster.mextra.eshk = shopkeeper;
    }
    const priest = monster.epri || monster.mextra?.epri;
    if (priest) {
        priest.parentmid = monster.m_id;
        monster.epri = priest;
        if (monster.mextra?.epri)
            monster.mextra.epri = priest;
    }
    const minion = monster.emin || monster.mextra?.emin;
    if (minion) {
        minion.parentmid = monster.m_id;
        monster.emin = minion;
        if (monster.mextra?.emin)
            monster.mextra.emin = minion;
    }
    if (monster.mextra?.ebones)
        monster.mextra.ebones.parentmid = monster.m_id;
}
async function renewBonesIdentities(level, fruits) {
    // restmonchn() assigns every monster a fresh id; each monster inventory
    // is restored immediately afterward. getlev() then restores floor and
    // buried object chains. All three paths share next_ident().
    const monsterIds = new Map();
    const renewObject = async (object) => {
        if (!object)
            return;
        object.o_id = nextIdent();
        if (object.otyp === SLIME_MOLD) {
            const oldFruit = fruits.find(fruit => fruit.fid === object.spe);
            if (oldFruit)
                object.spe = addFruit(oldFruit.fname);
            else
                await impossible('no old fruit?');
        }
        for (const content of object.contents || [])
            await renewObject(content);
    };
    for (const monster of [...level.monsters].reverse()) {
        const oldId = monster.m_id;
        monster.m_id = nextIdent();
        if (Number.isInteger(oldId) && oldId > 0)
            monsterIds.set(oldId, monster.m_id);
        for (const object of monster.minvent || monster.inventory || [])
            await renewObject(object);
    }
    for (const object of bonesFloorObjects(level))
        await renewObject(object);
    for (const object of level?.buriedObjects || [])
        await renewObject(object);
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
    eachObjectInBonesGraph(level, object => repairObjectMonsterIds(object, monsterIds));
    eachTopLevelBonesObject(level, repairContainedObjects);
    // C region.c:reset_region_mids(). Missing identities are removed by
    // replacing their slot with the last member, as during region turns.
    for (const region of level.regions) {
        region.heroFault = false;
        region.heroInside = false;
        let index = 0;
        while (index < region.monsterIds.length) {
            const mapped = remappedMonsterId(region.monsterIds[index], monsterIds);
            if (mapped !== undefined) {
                region.monsterIds[index++] = mapped;
            }
            else {
                const last = region.monsterIds.pop();
                if (last !== undefined && index < region.monsterIds.length)
                    region.monsterIds[index] = last;
            }
        }
    }
}
function restoreBonesFloorOrder(level) {
    let newestOrder = game._fobjSerial ?? 0;
    eachObjectInBonesGraph(level, object => {
        newestOrder = Math.max(newestOrder, object._fobjOrder ?? 0);
    });
    // C getlev() restores fobj before restore_cham() can drop equipment.
    // Those drops must precede every object already in the bones chain.
    game._fobjSerial = newestOrder;
}
// C restore.c:restobjchn()/getlev() and timeout.c:restore_timers(). Bones
// arrive immediately after the old hero's death, on the new hero's clock.
function restoreBonesClock(level, savedAt) {
    const adjustment = game.moves - savedAt;
    restoreLevelPetHistory(level, adjustment);
    const restoreObjectClock = (object, frozen = false) => {
        if (!frozen && !object.ageRelative && !ageStoresFuel(object))
            object.age += adjustment;
        for (const timer of object.objectTimers ?? [])
            timer.deadline += adjustment;
        for (const content of object.contents ?? [])
            restoreObjectClock(content, object.otyp === ICE_BOX);
    };
    eachTopLevelBonesObject(level, restoreObjectClock);
    for (const timer of level.levelTimers)
        timer.deadline += adjustment;
    for (const damage of level.damagelist ?? [])
        damage.when += adjustment;
    if (level.flags.stasis_until !== undefined)
        level.flags.stasis_until += adjustment;
}
// C restore.c:getlev(): branch entrances can move between games.
function repairBonesConnections(level, location) {
    const here = (end) => end.dnum === location.dnum && end.dlevel === location.dlevel;
    const branch = game.branches.find(candidate => here(candidate.end1) || here(candidate.end2));
    if (!branch) {
        for (const trap of [...level.traps])
            if (trap.ttyp === MAGIC_PORTAL)
                deleteTrap(trap);
        return;
    }
    if (location.dlevel !== 1)
        return;
    const destination = here(branch.end1) ? branch.end2 : branch.end1;
    if (branch.type === 'portal') {
        const portal = level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (!portal)
            throw new PanicTermination('getlev: need portal but none found');
        portal.dst = { ...destination };
        return;
    }
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.tolev.dnum === location.dnum)
            continue;
        stair.tolev = { ...destination };
        break;
    }
}
// C refs: bones.c:getbones() and restore.c:getlev(ghostly).
async function getbones() {
    const flags = game.flags || {};
    if (game.discover || flags.explore)
        return false;
    if (flags.bones === false)
        return false;
    if (rn2(3) && !game.flags?.debug)
        return false;
    const location = game.u.uz;
    if (!location || !levelAllowsBones(location))
        return false;
    const encoded = game.storage?.getItem(bonesStorageKey());
    if (!encoded)
        return false;
    let payload = null;
    try {
        payload = decodeBonesPayload(encoded, BONES_VERSION);
        if (!validMonsterWormBodies(payload.level))
            payload = null;
    }
    catch (_error) {
        payload = null;
    }
    if (!payload) {
        if (!game.flags.debug)
            await pline('Discarding unusable bones; no need to panic...');
        await finishBonesRestore();
        return false;
    }
    if (game.flags.debug
        && await bonesPrompt('Get bones? [yn] (n) ') !== 'y')
        return false;
    if (payload.bonesId.length >= 40)
        return false;
    const expectedId = bonesLevelId();
    if (payload.bonesId !== expectedId) {
        if (game.flags.debug)
            await pline(`This is bones level '${payload.bonesId}', not '${expectedId}'!`);
        await pline('Strange, this map is not as I remember it.');
        await pline('Somebody is trying some trickery here...');
        await pline('This game is void.');
        if (await finishHeroDeath({ killer: '', deathType: TRICKED }))
            return false;
        await finishBonesRestore();
        return false;
    }
    restoreMonsterWormHeads(payload.level);
    restoreEngravings(payload.level);
    const sourceDisplayLevel = game.level;
    game.level = payload.level;
    shiftBonesDestinations(payload, location, location.dlevel);
    game.stairs = restoreLevelChains(game.level, payload.stairs || null);
    game._heroTrack = (payload.heroTrack || []).map(point => ({
        x: point.x, y: point.y,
    }));
    restoreBonesClock(game.level, payload.savedAt);
    await renewBonesIdentities(game.level, payload.fruits);
    restoreBonesFloorOrder(game.level);
    restoreLevelTimers(game);
    await restoreBonesMonsters(game.level, game);
    await restoreLevelRegions(game, 0);
    repairBonesConnections(game.level, location);
    resetBonesObjects(game.level, 'restore');
    await fixShopDamage(game);
    // Failed loads still reference the level being left; sanitize loaded bones only.
    sanitizeEngravings(payload.level);
    game.fmon = game.level.monsters?.[0] || null;
    game._restoredBones = await finishBonesRestore(sourceDisplayLevel);
    return game._restoredBones;
}
async function finishBonesRestore(displayLevel = null) {
    const roleplay = game.u.uroleplay;
    if (!roleplay)
        throw new Error('Bones restoration requires initialized roleplay counters');
    roleplay.numbones++;
    if (game.flags.debug) {
        const unlink = await bonesPrompt('Unlink bones? [yn] (n) ', displayLevel);
        if (unlink !== 'y')
            return true;
    }
    return deleteBonesLevel();
}
// C ref: allmain.c l_nhcore_init()
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
// C ref: mkmaze.c set_levltyp().  Terrain mutation owns persistent tile
// side-effects; in particular, every lava form becomes lit even when the Lua
// terrain operation requested SET_LIT_NOCHANGE.  Callers may subsequently
// replace the terrain again without implicitly clearing that light bit.
export function setLevelTerrainType(x, y, typ) {
    if (!isok(x, y) || typ < STONE || typ >= MAX_TYPE)
        return false;
    const loc = game.level?.at?.(x, y);
    if (!loc)
        return false;
    if (loc.typ === SDOOR && typ === AIR) {
        loc.arboreal_sdoor = 1;
        return true;
    }
    const oldType = loc.typ;
    if (!canOverwriteTerrain(oldType))
        return false;
    const wasIce = isIceAt(x, y);
    loc.typ = typ;
    if (wasIce && typ !== ICE) {
        updateIceObjectTimersAt(x, y, game, { includeBuried: true });
        stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    }
    if (IS_LAVA(typ))
        loc.lit = true;
    if (typ === ICE && game._activeSpecialLevel?.levelInitialized) {
        loc.icedpool = game._activeSpecialLevel.icedPools
            ? ICED_POOL : ICED_MOAT;
    }
    // C mkmaze.c:set_levltyp() recounts when fountain or sink membership changes.
    if ((oldType === FOUNTAIN) !== (typ === FOUNTAIN)
        || (oldType === SINK) !== (typ === SINK))
        countLevelFeatures();
    return true;
}
export function setLevelTerrainLit(x, y, typ, lit = -2) {
    const level = requireGameLevel();
    if (!setLevelTerrainType(x, y, typ))
        return false;
    if (lit !== -2) {
        level.requireAt(x, y).lit = IS_LAVA(typ)
            ? true
            : lit === -1 ? !!rn2(2) : !!lit;
    }
    return true;
}
export async function fillZooRoom(room) {
    const level = requireGameLevel();
    // C ref: mkroom.c fill_zoo(), ZOO branch.  Irregular-room membership and
    // the first linked door determine the traversal and its three-cell
    // entrance exclusion.  Monster and gold creation remain shared owners.
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    const entrance = level.doors[room.fdoor];
    if (room.doorct && !entrance)
        throw new Error('Zoo room has no entrance door.');
    let goldlim = 500 * level_difficulty();
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.requireAt(x, y);
            const entranceDistance = entrance
                ? Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y))
                : Infinity;
            if (room.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (room.doorct && entranceDistance <= 1))
                    continue;
            }
            else if (!SPACE_POS(loc.typ)
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
            if (monster)
                monster.msleeping = 1;
            if (room.rtype === ANTHOLE) {
                if (!rn2(3))
                    await mkobj_at(FOOD_CLASS, x, y, false);
            }
            else if (room.rtype === COCKNEST) {
                if (!rn2(3)) {
                    const statue = await createToptenObject(STATUE, x, y);
                    for (let count = rn2(5); count > 0; count--)
                        await addToContainer(statue, await mkobj(RANDOM_CLASS, false));
                    statue.owt = objectWeight(statue);
                }
            }
            else {
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
    if (room.rtype === ZOO)
        level.flags.has_zoo = true;
}
// C mkroom.c:antholemon(). A level's colony uses one birthday-derived
// species, trying the next two species if genocide or extinction forbids it.
function antholeMonsterType() {
    const species = ['soldier ant', 'fire ant', 'giant ant'];
    const start = ((game.ubirthday ?? 0) % 3) + level_difficulty();
    for (let attempt = 0; attempt < 3; attempt++) {
        const name = species[(start + attempt) % 3];
        if (!name)
            throw new RangeError('Anthole species selection is out of range');
        const mnum = MONSTER_NAME.indexOf(name);
        if (!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE))
            return mnum;
    }
    return null;
}
export function courtMonsterType() {
    const roll = rn2(60) + rn2(3 * level_difficulty());
    if (roll > 100)
        return mkclass(30, 0); // S_DRAGON
    if (roll > 95)
        return mkclass(34, 0); // S_GIANT
    if (roll > 85)
        return mkclass(46, 0); // S_TROLL
    if (roll > 75)
        return mkclass(29, 0); // S_CENTAUR
    if (roll > 60)
        return mkclass(15, 0); // S_ORC
    if (roll > 45)
        return 45; // PM_BUGBEAR
    if (roll > 30)
        return 71; // PM_HOBGOBLIN
    if (roll > 15)
        return mkclass(33, 0); // S_GNOME
    return mkclass(11, 0); // S_KOBOLD
}
// C mkroom.c:mk_zoo_thronemon().
export async function fillCourtRoom(room) {
    const level = requireGameLevel();
    // C mkroom.c:fill_zoo(COURT).  Maze courts use the throne already drawn
    // on the map; ordinary courts choose a free square for a new throne.
    const throne = { x: 0, y: 0 };
    let mappedThrone = false;
    if (level.flags.is_maze_lev) {
        for (let x = room.lx; x <= room.hx && !mappedThrone; x++) {
            for (let y = room.ly; y <= room.hy; y++) {
                if (level.at(x, y)?.typ !== THRONE)
                    continue;
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
            if (!occupied(throne.x, throne.y))
                break;
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
        setMonsterMalign(ruler);
        const mace = await mksobj(MACE, true, false);
        // All four rulers are princes; mongets() upgrades their weapons.
        mace.spe = Math.max(1, mace.spe);
        await addObjectToMonsterInventory(ruler, mace, game, { atFront: true });
    }
    const entrance = room.doorct
        ? level.doors[room.fdoor] : null;
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.at(x, y);
            if (room.irregular) {
                if (!loc || loc.roomno !== roomNumber || loc.edge
                    || (entrance
                        && Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y)) <= 1))
                    continue;
            }
            else if (!loc || !SPACE_POS(loc.typ)
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
            if (loc.typ === THRONE)
                continue;
            const mndx = courtMonsterType();
            const monster = await makemon(mndx, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster) {
                monster.msleeping = 1;
                if (monster.mpeaceful) {
                    monster.mpeaceful = 0;
                    setMonsterMalign(monster);
                }
            }
        }
    }
    const throneLoc = level.at(throne.x, throne.y);
    if (throneLoc)
        throneLoc.typ = THRONE;
    const cofferPosition = { x: 0, y: 0 };
    somexyspace(room, cofferPosition);
    const gold = await mksobj(GOLD_PIECE, true, false);
    gold.quan = rn1(50 * difficulty, 10);
    gold.quantity = gold.quan;
    gold.owt = objectWeight(gold);
    const chest = await mksobj_at(CHEST, cofferPosition.x, cofferPosition.y, true, false);
    await addToContainer(chest, gold);
    chest.owt = objectWeight(chest);
    chest.spe = 2;
    level.flags.has_court = true;
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
    if (active.variant === undefined || active.variant < 1 || active.variant > 3) {
        throw new RangeError(`unknown Mines' End layout ${active?.variant}`);
    }
    active.file = `minend-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}
export async function generateMinetown(active) {
    const level = requireGameLevel();
    if (active.variant === undefined || active.variant < 1 || active.variant > 7) {
        throw new RangeError(`unknown Minetown layout ${active?.variant}`);
    }
    active.file = `minetn-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fillSpecialRoom(room);
}
function isLuaQuestPrototype(prototype) {
    return /^[A-Z][a-z]{2}-(strt|loca|goal|fila|filb)$/.test(prototype);
}
async function generateLuaQuestLevel(active) {
    if (!isLuaQuestPrototype(active?.prototype))
        throw new RangeError(`unknown quest level ${active?.prototype}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fillSpecialRoom(room);
}
export async function generateOracleLevel(active) {
    if (active?.prototype !== 'oracle')
        throw new RangeError(`unknown Oracle level ${active?.prototype}`);
    active.file = 'oracle.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}
export async function specialShrinePriest(temple, altarX, altarY, altarAlignment, { sanctum = false } = {}) {
    const level = requireGameLevel();
    const shrineLevel = game.u.uz;
    if (!shrineLevel)
        throw new Error('Shrine priest creation requires the dungeon location.');
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
            && !(level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER)) {
            priestX = x;
            priestY = y;
            break;
        }
    }
    const occupant = monsterAtPosition(level, priestX, priestY);
    if (occupant)
        await randomMonsterRelocation(occupant, { flags: RLOC_NOMSG });
    const priest = await makemon(sanctum ? PM_HIGH_CLERIC : PM_ALIGNED_CLERIC, priestX, priestY, MM_EPRI);
    if (!priest)
        return null;
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
    // priest.c:priestini() replaces the birth attitude and species alignment.
    setMonsterMalign(priest);
    if (sanctum && altarAlignment === A_NONE) {
        const amulet = await mksobj(AMULET_OF_YENDOR, true, false);
        await addObjectToMonsterInventory(priest, amulet, game, { atFront: true });
    }
    const spellbookCount = 2 + rn2(3);
    for (let count = 0; count < spellbookCount; count++) {
        const spellbook = await mkobj(SPBOOK_no_NOVEL, false);
        await addObjectToMonsterInventory(priest, spellbook, game, { atFront: true });
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
            if (!coaligned)
                cloak.blessed = false;
        }
    }
    return priest;
}
// C mkroom.c:morguemon().
export function morgueMonsterType() {
    const roll = rn2(100);
    const hitDice = rn2(level_difficulty());
    if (hitDice > 10 && roll < 10) {
        const inHell = !!game.dungeons[game.u.uz?.dnum ?? 0]?.flags?.hellish;
        if (inHell || In_endgame(game.u.uz))
            return mkclass(56, 0);
        const demon = normalDemon(A_NONE);
        if (demon != null)
            return demon;
    }
    if (hitDice > 8 && roll > 85)
        return mkclass(48, 0);
    if (roll < 20)
        return 287; // PM_GHOST
    if (roll < 40)
        return 230; // PM_WRAITH
    return mkclass(52, 0); // S_ZOMBIE
}
// C mkobj.c:mk_tt_object(). Statues have no initial books; a missing score
// entry falls back to a real player role without supplying a name or gender.
export async function createToptenObject(type, x, y) {
    const object = await mksobj_at(type, x, y, type !== STATUE, false);
    if (!await nameObjectFromTopten(object)) {
        const firstRole = MONSTER_NAME.indexOf('archeologist');
        const lastRole = MONSTER_NAME.indexOf('wizard');
        set_corpsenm(object, rn1(lastRole - firstRole + 1, firstRole));
        object.owt = objectWeight(object);
    }
    return object;
}
export async function fillMorgueRoom(room) {
    const level = requireGameLevel();
    const entrance = room.doorct ? level.doors[room.fdoor] : null;
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.at(x, y);
            const entranceDistance = entrance
                ? Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y))
                : Infinity;
            const entranceEdge = entrance && ((x === room.lx && entrance.x === x - 1)
                || (x === room.hx && entrance.x === x + 1)
                || (y === room.ly && entrance.y === y - 1)
                || (y === room.hy && entrance.y === y + 1));
            if (!loc)
                continue;
            if (room.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (room.doorct && entranceDistance <= 1))
                    continue;
            }
            else if (!SPACE_POS(loc.typ) || entranceEdge)
                continue;
            const monster = await makemon(morgueMonsterType(), x, y, MM_ASLEEP | MM_NOGRP);
            if (monster)
                monster.msleeping = 1;
            if (!rn2(5))
                await createToptenObject(CORPSE, x, y);
            if (!rn2(10))
                await mksobj_at(rn2(3) ? LARGE_BOX : CHEST, x, y, true, false);
            if (!rn2(5))
                make_grave(x, y, null);
        }
    }
    level.flags.has_morgue = true;
}
export async function generateBigRoom(active) {
    if (active.variant === undefined || active.variant < 1 || active.variant > 13)
        throw new RangeError(`unknown Big Room variant ${active?.variant}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}
async function generateElementalPlane(active) {
    active.file = `${active.prototype}.lua`;
    if (active.prototype === 'air' || active.prototype === 'water')
        active.elementalBubbles = true;
    if (active.prototype === 'water')
        requireGameLevel().flags.waterlevel = true;
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
async function generateWizardLevel(active) {
    const level = requireGameLevel();
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
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
// C dbridge.c:create_drawbridge().
export async function makeSpecialDrawbridge(x, y, direction, open) {
    const level = requireGameLevel();
    const bridge = level.at(x, y);
    if (!bridge)
        return false;
    const offsets = new Map([
        [DB_NORTH, { x: 0, y: -1 }], [DB_SOUTH, { x: 0, y: 1 }],
        [DB_EAST, { x: 1, y: 0 }], [DB_WEST, { x: -1, y: 0 }],
    ]);
    const requestedOffset = offsets.get(direction);
    if (!requestedOffset)
        await impossible('bad direction in create_drawbridge');
    const offset = requestedOffset ?? { x: -1, y: 0 };
    const wall = level.at(x + offset.x, y + offset.y);
    if (!wall || !IS_WALL(wall.typ))
        return false;
    const under = bridge.typ === LAVAPOOL ? DB_LAVA : DB_MOAT;
    const horizontal = offset.x === 0;
    bridge.typ = open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    bridge.horizontal = !horizontal;
    // Native rm.flags is five bits, including when the default -1 direction
    // reaches create_drawbridge()'s westward fallback.
    bridge.flags = bridge.drawbridgemask = (direction & 31) | under;
    wall.typ = open ? DOOR : DBWALL;
    wall.horizontal = horizontal;
    wall.flags = wall.wall_info = open ? D_NODOOR : W_NONDIGGABLE;
    if (open)
        wall.doormask = D_NODOOR;
    return true;
}
export async function generateHellFillerLevel(active) {
    const level = requireGameLevel();
    if (active?.prototype !== 'hellfill')
        throw new RangeError(`unknown Hell filler ${active?.prototype}`);
    active.file = 'hellfill.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fillSpecialRoom(room);
}
export async function generateMedusaLevel(active) {
    if (active.variant === undefined || active.variant < 1 || active.variant > 4) {
        throw new RangeError(`unknown Medusa variant ${active?.variant}`);
    }
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}
function medusaRoomPoint(room) {
    return {
        x: room.lx + rn2(room.hx - room.lx + 1),
        y: room.ly + rn2(room.hy - room.ly + 1),
    };
}
async function fixupMedusa(active) {
    if (active?.prototype !== 'medusa')
        return;
    const level = requireGameLevel();
    const room = level.rooms[0];
    if (!isRoom(room))
        return;
    for (let count = rnd(4); count > 0; count--) {
        const point = medusaRoomPoint(room);
        if (!goodPosition(point.x, point.y, null))
            continue;
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
async function fixupBaalz(active) {
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
            if (!lastx)
                inarea.x1 = scanX + 1;
            lastx = scanX;
        }
    }
    inarea.x2 = (lastx > inarea.x1 ? lastx : scanX) - 1;
    let lasty = 0;
    let scanY;
    for (scanY = 0; scanY < ROWNO; scanY++) {
        if (((level.at(inarea.x1, scanY)?.wall_info ?? 0)
            & W_NONDIGGABLE) !== 0) {
            if (!lasty)
                inarea.y1 = scanY + 1;
            lasty = scanY;
        }
    }
    inarea.y2 = (lasty > inarea.y1 ? lasty : scanY) - 1;
    const poolMarkers = [];
    for (let x = inarea.x1; x <= inarea.x2; x++) {
        for (let y = inarea.y1; y <= inarea.y2; y++) {
            const loc = level.at(x, y);
            if (loc?.typ === POOL) {
                loc.typ = HWALL;
                loc.horizontal = true;
                poolMarkers.push({ x, y });
            }
            else if (loc?.typ === IRONBARS) {
                if (((level.at(x - 1, y)?.wall_info ?? 0)
                    & W_NONDIGGABLE) !== 0) {
                    level.requireAt(x - 1, y).wall_info &= ~W_NONDIGGABLE;
                    if (isok(x - 2, y))
                        level.requireAt(x - 2, y).wall_info &= ~W_NONDIGGABLE;
                }
                else if (((level.at(x + 1, y)?.wall_info ?? 0)
                    & W_NONDIGGABLE) !== 0) {
                    level.requireAt(x + 1, y).wall_info &= ~W_NONDIGGABLE;
                    if (isok(x + 2, y))
                        level.requireAt(x + 2, y).wall_info &= ~W_NONDIGGABLE;
                }
            }
        }
    }
    wallification(Math.max(inarea.x1 - 2, 1), Math.max(inarea.y1 - 2, 0), Math.min(inarea.x2 + 2, COLNO - 1), Math.min(inarea.y2 + 2, ROWNO - 1), inarea);
    const repairMarker = async (marker, verticalDelta, jointType, upper) => {
        if (!marker)
            return;
        const loc = level.at(marker.x, marker.y);
        const joint = level.at(marker.x, marker.y + verticalDelta);
        if (!loc || !joint
            || (loc.typ !== TLWALL && loc.typ !== TRWALL)
            || joint.typ !== jointType)
            return;
        if (upper)
            loc.typ = loc.typ === TLWALL ? BRCORNER : BLCORNER;
        else
            loc.typ = loc.typ === TLWALL ? TRCORNER : TLCORNER;
        joint.typ = HWALL;
        joint.horizontal = true;
        const monster = monsterAtPosition(level, marker.x, marker.y);
        if (monster)
            await randomMonsterRelocation(monster, { flags: RLOC_ERR | RLOC_NOMSG });
    };
    await repairMarker(poolMarkers[0], 1, TUWALL, true);
    await repairMarker(poolMarkers[1], -1, TDWALL, false);
    active.baalzFixupArea = { ...inarea };
    active.baalzPoolMarkers = poolMarkers.map(marker => ({ ...marker }));
}
// C mkmaze.c:fixup_special() processes regions in Lua declaration order.
async function fixupSpecialRegions(active) {
    let branchDeclared = false;
    for (const region of active.levelRegions ?? []) {
        const { area } = region;
        const exclude = region.exclude ?? { lx: -1, ly: -1, hx: -1, hy: -1 };
        const type = region.type === 'stair-up' ? LR_UPSTAIR
            : region.type === 'stair-down' ? LR_DOWNSTAIR
                : region.type === 'branch' ? LR_BRANCH : LR_PORTAL;
        let destination = null;
        if (region.type === 'branch')
            branchDeclared = true;
        if (region.type === 'portal') {
            const name = region.destination;
            if (!name)
                throw new Error('Portal region requires a destination name');
            const currentLevel = game.u.uz;
            if (!currentLevel)
                throw new Error('Portal region requires a current dungeon level');
            destination = /^\d/u.test(name)
                ? { dnum: currentLevel.dnum, dlevel: parseInt(name, 10) }
                : game.specialLevels?.get(name) ?? null;
            if (!destination)
                throw new Error(`Portal destination ${name} does not exist`);
        }
        await place_lregion(area.lx, area.ly, area.hx, area.hy, exclude.lx, exclude.ly, exclude.hx, exclude.hy, type, destination);
    }
    if (!branchDeclared && is_branchlev())
        await place_lregion(0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH, null);
}
async function generateSpecialAndFixup(generator, active) {
    await generator(active);
    await fixupSpecial(active);
}
// C mkmaze.c:fixup_special(), after the Lua level has finished construction.
export async function fixupSpecial(active) {
    const level = requireGameLevel();
    const arrivalRegion = (region, exclude) => {
        if (!region)
            return null;
        let embeddedExclude = null;
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
    level.upTeleportRegion = arrivalRegion(active?.upTeleportRegion, active?.upTeleportExclude);
    level.downTeleportRegion = arrivalRegion(active?.downTeleportRegion, active?.downTeleportExclude);
    // mkmaze.c:fixup_special() must allocate and initially paint Air/Water
    // bubbles before named portals and arrival regions are materialized.
    if (active?.elementalBubbles)
        await setupElementalBubbles();
    await fixupSpecialRegions(active);
    // fixup_special() reduces undead remains throughout the Castle and the
    // Priest quest, even after the hero has entered any morgue rooms.
    if (Is_stronghold(game.u.uz) || game.urole?.key === 'priest' && In_quest(game.u.uz))
        level.flags.graveyard = true;
    if (active?.baalzFixup)
        await fixupBaalz(active);
    if (active.file === 'minetn-1.lua' && In_mines(game.u.uz))
        await createOrcRaid();
    // Minetown becomes a town only now, so the level's own monsters (and any
    // raiders) were created while in_town() still reported false.
    if (specialLevelAt()?.flags.town)
        level.flags.has_town = true;
    // sp_lev.c explicitly places deferred portals, stairs, and branches
    // before premap_detect(); otherwise their remembered glyphs retain the
    // underlying terrain even though the live level cell was updated.
    if (active?.premapped)
        await premap_detect();
    await fixupMedusa(active);
}
async function generateSokobanLevel(active) {
    if (!/^soko[1-4]$/.test(active?.prototype)
        || active.variant === undefined || active.variant < 1 || active.variant > 2) {
        throw new RangeError(`unknown Sokoban level ${active?.prototype}-${active?.variant}`);
    }
    active.file = `${active.prototype}-${active.variant}.lua`;
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fillSpecialRoom(room);
}
export async function generateSokobanLevel2(active) {
    if (active?.prototype !== 'soko2') {
        throw new RangeError(`unknown Sokoban level 2 ${active?.prototype}`);
    }
    await generateSokobanLevel(active);
}
export function fillSpecialMazeGrid(filling = HWALL) {
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
export async function generateKnoxLevel(active) {
    if (active?.prototype !== 'knox')
        throw new RangeError(`unknown Knox level ${active?.prototype}`);
    active.file = 'knox.lua';
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fillSpecialRoom(room);
}
// C mkmaze.c:makemaz("") with no dungeon prototype or fill script.
export async function generateRandomMaze() {
    const level = requireGameLevel();
    level.flags.is_maze_lev = true;
    level.flags.corrmaze = rn2(3) === 0;
    const invocation = Invocation_lev(game.u.uz);
    if (!invocation && rn2(2))
        createMaze(-1, -1, rn2(5) === 0);
    else
        createMaze(1, 1, false);
    if (!level.flags.corrmaze)
        wallification(2, 2, (COLNO - 1) & ~1, (ROWNO - 1) & ~1);
    const up = mazeFloorPoint();
    await mkstairs(up.x, up.y, true, null);
    if (invocation) {
        const square = vibratingSquarePoint();
        await maketrap(square.x, square.y, VIBRATING_SQUARE);
    }
    else {
        const down = mazeFloorPoint();
        await mkstairs(down.x, down.y, false, null);
    }
    await place_branch(is_branchlev());
    await populateRandomMaze();
}
// C mazexy(): generated maze cargo uses ROOM or CORR of the selected
// style, rather than any accessible terrain or the former odd-cell grid.
function mazeFloorPoint() {
    const level = requireGameLevel();
    const maxX = (COLNO - 1) & ~1;
    const maxY = (ROWNO - 1) & ~1;
    const terrain = level.flags.corrmaze ? CORR : ROOM;
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = rnd(maxX);
        const y = rnd(maxY);
        if (level.requireAt(x, y).typ === terrain)
            return { x, y };
    }
    for (let x = 1; x <= maxX; x++) {
        for (let y = 1; y <= maxY; y++) {
            if (level.requireAt(x, y).typ === terrain)
                return { x, y };
        }
    }
    throw new Error('mazexy: no generated maze passage is available');
}
export function vibratingSquarePoint() {
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
        if (attempt === 1000 || !up)
            break;
        const dx = Math.abs(point.x - up.sx);
        const dy = Math.abs(point.y - up.sy);
        if (dx && dy && dx !== dy && Math.max(dx, dy) > 11
            && SPACE_POS(level.requireAt(point.x, point.y).typ)
            && !occupied(point.x, point.y))
            break;
    }
    if (!point)
        throw new Error('Vibrating square placement did not choose a position.');
    level.invocationPosition = { ...point };
    return point;
}
async function populateRandomMaze() {
    for (let count = rn1(8, 11); count > 0; count--) {
        const point = mazeFloorPoint();
        await mkobj_at(rn2(2) ? GEM_CLASS : RANDOM_CLASS, point.x, point.y, true);
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
async function generateDungeonMazeFile(prototype) {
    const active = { prototype, file: `${prototype}.lua` };
    if (!LUA_SOURCES[active.file]) {
        await impossible(`Couldn't load "${active.file}" - making a maze.`);
        await generateRandomMaze();
        return;
    }
    game._activeSpecialLevel = active;
    if (prototype === 'minefill')
        await generateMineFiller(active);
    else if (prototype === 'hellfill')
        await generateHellFillerLevel(active);
    else if (isLuaQuestPrototype(prototype))
        await generateLuaQuestLevel(active);
    else {
        await generateSpecialAndFixup(generateLuaSpecialLevel, active);
        const level = requireGameLevel();
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room))
                await fillSpecialRoom(room);
    }
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
function roomHasStair(croom, up) {
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (!!stair.up !== !!up)
            continue;
        if (insideRoom(game.level, croom, stair.sx, stair.sy))
            return true;
    }
    return false;
}
// C ref: mkroom.c invalid_shop_shape().  A shopkeeper must have more than a
// one-square cul-de-sac immediately inside the selected room's only door.
async function invalidShopShape(croom) {
    const level = requireGameLevel();
    const door = level.doors[croom.fdoor];
    if (!door)
        return true;
    let inside = null;
    let insideCount = 0;
    for (let x = Math.max(door.x - 1, croom.lx); x <= Math.min(door.x + 1, croom.hx); x++) {
        for (let y = Math.max(door.y - 1, croom.ly); y <= Math.min(door.y + 1, croom.hy); y++) {
            if (level.at(x, y)?.typ === ROOM) {
                inside = { x, y };
                insideCount++;
            }
        }
    }
    if (insideCount < 1 || !inside) {
        await impossible('invalid_shop_shape: no squares inside door?');
        return true;
    }
    if (insideCount > 1)
        return false;
    let exits = 0;
    for (let x = Math.max(inside.x - 1, croom.lx); x <= Math.min(inside.x + 1, croom.hx); x++) {
        for (let y = Math.max(inside.y - 1, croom.ly); y <= Math.min(inside.y + 1, croom.hy); y++) {
            if (x === inside.x && y === inside.y)
                continue;
            if (level.at(x, y)?.typ === ROOM)
                exits++;
        }
    }
    return exits === 1;
}
async function mkshop() {
    const level = requireGameLevel();
    const rooms = level.rooms.slice(0, level.nroom);
    let sroom = null;
    for (const room of rooms) {
        if (!isRoom(room) || room.hx < 0)
            return false;
        if (room.rtype !== OROOM || roomHasStair(room, false)
            || roomHasStair(room, true) || room.doorct !== 1)
            continue;
        if (await invalidShopShape(room))
            continue;
        sroom = room;
        break;
    }
    if (!sroom)
        return false;
    if (!sroom.rlit) {
        for (let x = sroom.lx - 1; x <= sroom.hx + 1; x++)
            for (let y = sroom.ly - 1; y <= sroom.hy + 1; y++) {
                const loc = level.at(x, y);
                if (loc)
                    loc.lit = true;
            }
        sroom.rlit = 1;
    }
    let roll = rnd(100);
    let shopIndex = 0;
    while (shopIndex < RANDOM_SHOP_TYPES.length - 1) {
        const shop = RANDOM_SHOP_TYPES[shopIndex];
        if (!shop)
            throw new Error(`Missing random shop definition ${shopIndex}`);
        if ((roll -= shop.probability) <= 0)
            break;
        shopIndex++;
    }
    const area = (sroom.hx - sroom.lx + 1) * (sroom.hy - sroom.ly + 1);
    const shop = RANDOM_SHOP_TYPES[shopIndex];
    if (!shop)
        throw new Error(`Missing random shop definition ${shopIndex}`);
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
function pickSpecialRoom(strict) {
    const rooms = game.level?.rooms?.slice(0, game.level.nroom) ?? [];
    if (!rooms.length)
        return null;
    let index = rn2(rooms.length);
    for (let remaining = rooms.length; remaining > 0; remaining--) {
        const room = rooms[index];
        index = (index + 1) % rooms.length;
        if (!isRoom(room) || room.hx < 0)
            return null;
        if (room.rtype !== OROOM)
            continue;
        if (!strict) {
            if (roomHasStair(room, true)
                || (roomHasStair(room, false) && rn2(3)))
                continue;
        }
        else if (roomHasStair(room, true)
            || roomHasStair(room, false)) {
            continue;
        }
        if (room.doorct === 1)
            return room;
        // `wizard` is the last operand in C, so debug mode still consumes
        // the door-preference draw before accepting a multi-door room.
        if (!rn2(5) || game.flags?.debug)
            return room;
    }
    return null;
}
// C ref: mkroom.c shrine_pos().  Even-width or even-height interiors have
// two central squares, and each such axis owns one independent tie-breaker.
function shrinePosition(room) {
    const xDelta = room.hx - room.lx;
    let x = room.lx + Math.trunc(xDelta / 2);
    if ((xDelta % 2) && rn2(2))
        x++;
    const yDelta = room.hy - room.ly;
    let y = room.ly + Math.trunc(yDelta / 2);
    if ((yDelta % 2) && rn2(2))
        y++;
    return { x, y };
}
// C ref: mkroom.c mktemple().  Unlike zoo-family rooms, a temple is fully
// constructed at selection time; ordinary-room filling must observe both its
// changed room type and its resident priest.
async function makeRandomTemple(room) {
    const level = requireGameLevel();
    room.rtype = TEMPLE;
    const shrine = shrinePosition(room);
    const altar = level.at(shrine.x, shrine.y);
    if (!altar)
        return false;
    altar.typ = ALTAR;
    const alignment = inducedAlignment(80);
    altar.flags = Align2amask(alignment);
    await specialShrinePriest(room, shrine.x, shrine.y, alignment);
    altar.flags |= AM_SHRINE;
    level.flags.has_temple = true;
    return true;
}
async function markRandomSpecialRoom(roomType) {
    if (roomType === SWAMP)
        return makeSwamps();
    const room = pickSpecialRoom(roomType === TEMPLE);
    if (!room)
        return false;
    if (roomType === TEMPLE)
        return makeRandomTemple(room);
    room.rtype = roomType;
    room.needfill = FILL_NORMAL;
    return true;
}
// C mkroom.c:mkswamp(). Room selection is with replacement; a room already
// converted by an earlier attempt is skipped. The first pool has a resident.
async function makeSwamps() {
    const level = requireGameLevel();
    let residents = 0;
    let madeSwamp = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        const roomIndex = rn2(level.nroom);
        const room = level.rooms[roomIndex];
        if (!isRoom(room) || room.hx < 0 || room.rtype !== OROOM
            || roomHasStair(room, true) || roomHasStair(room, false))
            continue;
        room.rtype = SWAMP;
        for (let x = room.lx; x <= room.hx; x++) {
            for (let y = room.ly; y <= room.hy; y++) {
                const location = level.requireAt(x, y);
                if (!IS_ROOM(location.typ) || location.roomno !== roomIndex + ROOMOFFSET
                    || level.objects[x]?.[y]?.length || monsterAtPosition(level, x, y)
                    || level.traps.some(trap => trap.tx === x && trap.ty === y)
                    || swampSquareBordersDoor(x, y))
                    continue;
                if ((x + y) % 2) {
                    deleteEngravingAt(x, y, level);
                    location.typ = POOL;
                    if (!residents || !rn2(4)) {
                        const species = rn2(5) ? PM_GIANT_EEL
                            : rn2(2) ? MONSTER_NAME.indexOf('piranha')
                                : MONSTER_NAME.indexOf('electric eel');
                        await makemon(species, x, y, 0);
                        residents++;
                    }
                }
                else if (!rn2(4)) {
                    await makemon(mkclass(32, 0), x, y, 0); // S_FUNGUS
                }
            }
        }
        level.flags.has_swamp = true;
        madeSwamp = true;
    }
    return madeSwamp;
}
function swampSquareBordersDoor(x, y) {
    const level = requireGameLevel();
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (!isok(x + dx, y + dy))
                continue;
            const location = level.at(x + dx, y + dy);
            if (location && (IS_DOOR(location.typ) || location.typ === SDOOR))
                return true;
        }
    }
    return false;
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
function goodShopDoor(sroom) {
    const level = requireGameLevel();
    for (let i = 0; i < sroom.doorct; i++) {
        const doorIndex = sroom.fdoor + i;
        const door = level.doors[doorIndex];
        if (!door)
            continue;
        let { x, y } = door;
        if (sroom.irregular) {
            const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
            const candidates = [
                { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 },
            ];
            const inside = candidates.find(({ x: cx, y: cy }) => {
                const loc = level.at(cx, cy);
                return loc && !loc.edge && loc.roomno === roomno;
            });
            if (!inside)
                continue;
            x = inside.x;
            y = inside.y;
        }
        else if (x === sroom.lx - 1)
            x++;
        else if (x === sroom.hx + 1)
            x--;
        else if (y === sroom.ly - 1)
            y++;
        else if (y === sroom.hy + 1)
            y--;
        else
            continue;
        return { doorIndex, door, x, y };
    }
    return null;
}
function stockRoomGoodPos(sroom, shopDoor, x, y) {
    const loc = requireGameLevel().at(x, y);
    if (!loc || !IS_ROOM(loc.typ))
        return false;
    if (sroom.irregular) {
        const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
        return !loc.edge && loc.roomno === roomno
            && Math.max(Math.abs(x - shopDoor.door.x), Math.abs(y - shopDoor.door.y)) > 1;
    }
    return !((x === sroom.lx && shopDoor.door.x === x - 1)
        || (x === sroom.hx && shopDoor.door.x === x + 1)
        || (y === sroom.ly && shopDoor.door.y === y - 1)
        || (y === sroom.hy && shopDoor.door.y === y + 1));
}
// C shknam.c:nameshk(). Store the prefixed identity; presentation strips it.
function assignShopkeeperIdentity(monster, shopIndex) {
    const level = requireGameLevel();
    const shop = SHOP_TYPES[shopIndex];
    const candleShop = SHOP_TYPES[11], toolShop = SHOP_TYPES[8], generalShop = SHOP_TYPES[0];
    if (!shop || !candleShop || !toolShop || !generalShop)
        throw new Error(`Missing shop naming definition ${shopIndex}`);
    const shopkeeper = monster.eshk;
    if (!shopkeeper)
        throw new Error('Shopkeeper identity requires the shop extension.');
    let names = shop.names;
    let selected;
    if (names === candleShop.names && In_mines(game.u.uz)
        && specialLevelAt()?.flags.town) {
        selected = '+Izchak';
        monster.female = false;
    }
    else {
        const birthSeed = Math.trunc((game.ubirthday ?? 0) / 257) | 0;
        let wanted = (monster.m_id | 0) + ledgerNo(game.u.uz)
            + (birthSeed % 13) - (birthSeed % 5);
        if (wanted < 0)
            wanted += 18;
        monster.female = !!(wanted & 1);
        wanted %= names.length;
        for (let attempt = 0; attempt < 50; attempt++) {
            if (names === toolShop.names) {
                selected = names[rn2(names.length)];
                monster.female = false;
            }
            else if (wanted < names.length) {
                selected = names[wanted];
            }
            else {
                const index = rn2(names.length);
                if (index)
                    selected = names[index - 1];
                else if (names !== generalShop.names) {
                    names = generalShop.names;
                    continue;
                }
                else {
                    selected = monster.female ? '-Lucrezia' : '+Dirk';
                }
            }
            if (selected === undefined)
                throw new Error('Shopkeeper name selection is out of range.');
            if (selected[0] === '_' || selected[0] === '-')
                monster.female = true;
            else if (selected[0] === '|' || selected[0] === '+')
                monster.female = false;
            const taken = level.monsters.some(other => other !== monster
                && other.mhp > 0 && other.isshk && other.eshk?.shknam === selected);
            if (!taken)
                break;
            wanted = names.length;
        }
    }
    if (selected === undefined)
        throw new Error('Shopkeeper name selection did not choose a name.');
    shopkeeper.shknam = selected.slice(0, PL_NSIZ - 1);
}
export function getShopItem(shopIndex) {
    const table = SHOP_TYPES[shopIndex]?.items;
    if (!table)
        throw new Error(`Missing shop stock definition ${shopIndex}`);
    let roll = rnd(100);
    for (const [probability, itemType] of table) {
        if (probability === undefined || itemType === undefined)
            throw new Error(`Incomplete shop stock entry for shop ${shopIndex}`);
        roll -= probability;
        if (roll <= 0)
            return itemType;
    }
    const lastType = table.at(-1)?.[1];
    if (lastType === undefined)
        throw new Error(`Shop ${shopIndex} has no stock entries.`);
    return lastType;
}
// C ref: shknam.c shkveg()/mkveggy_at().  Corpses and tins use a vegetarian
// lichen stand-in while selecting an object type; actual tin contents are
// repaired after normal mksobj initialization.
async function mkveggy_at(x, y) {
    const eligible = [];
    let totalProbability = 0;
    const first = OBJECT_BASES[FOOD_CLASS];
    const afterFood = OBJECT_BASES[FOOD_CLASS + 1];
    if (first === undefined || afterFood === undefined)
        throw new Error('Food class boundaries are missing.');
    const last = afterFood - 1;
    for (let otyp = first; otyp <= last; otyp++) {
        if (objectMaterial(otyp) !== 3 // VEGGY
            && otyp !== EGG && otyp !== TIN && otyp !== CORPSE)
            continue;
        eligible.push(otyp);
        const probability = OBJECT_PROB[otyp];
        if (probability === undefined)
            throw new Error(`Missing food probability for object ${otyp}`);
        totalProbability += probability;
    }
    let choice = rnd(totalProbability);
    let selected = eligible[0];
    for (const otyp of eligible) {
        selected = otyp;
        const probability = OBJECT_PROB[otyp];
        if (probability === undefined)
            throw new Error(`Missing food probability for object ${otyp}`);
        choice -= probability;
        if (choice <= 0)
            break;
    }
    if (selected === undefined)
        throw new Error('Vegetarian shop selection has no eligible food.');
    const object = await mksobj_at(selected, x, y, true, true);
    if (object?.otyp === TIN)
        setTinVariety(object, HEALTHY_TIN);
    return object;
}
export async function stockShopRoom(sroom) {
    const level = requireGameLevel();
    const shopLevel = game.u.uz;
    if (!shopLevel)
        throw new Error('Shop creation requires the current dungeon location.');
    const shopDoor = goodShopDoor(sroom);
    if (!shopDoor)
        return;
    const shopIndex = sroom.rtype - SHOPBASE;
    // shknam.c:shkinit() relocates an existing occupant before creating
    // the resident; it does not abandon this shop when its doorway is busy.
    const occupant = monsterAtPosition(level, shopDoor.x, shopDoor.y);
    if (occupant)
        await randomMonsterRelocation(occupant, { flags: RLOC_NOMSG });
    const shopkeeper = await makemon(PM_SHOPKEEPER, shopDoor.x, shopDoor.y, MM_ESHK);
    if (!shopkeeper)
        return;
    const shop = shopkeeper.eshk;
    if (!shop)
        throw new Error('Shopkeeper creation requires its shop extension.');
    // C isshk() is resident-extension identity, not species identity.  A
    // Wizard-forced out-of-context shopkeeper has no eshk and remains an
    // ordinary humanoid observer; shkinit() establishes both together here.
    shopkeeper.isshk = 1;
    shopkeeper.mpeaceful = 1;
    setMonsterMalign(shopkeeper);
    shopkeeper.msleeping = 0;
    shopkeeper.mtrapseen = -1;
    shop.shoproom = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
    sroom.resident = shopkeeper;
    shop.shoptype = sroom.rtype;
    shop.shoplevel = { ...shopLevel };
    shop.shd = { ...shopDoor.door };
    shop.shk = { x: shopDoor.x, y: shopDoor.y };
    // C shknam.c:shkinit()/makemon.c:mkmonmoney(). Initial capital is
    // an ordinary coin stack in the keeper's inventory.
    const capital = 1000 + 30 * rnd(100);
    const coins = await mksobj(GOLD_PIECE, false, false);
    coins.quan = coins.quantity = capital;
    coins.owt = objectWeight(coins);
    await linkObjectToMonsterInventory(shopkeeper, coins, { atFront: true });
    if (shopIndex === 6)
        await addObjectToMonsterInventory(shopkeeper, await mksobj(TOUCHSTONE, true, false), game, { atFront: true });
    if (shopIndex === 8 || shopIndex === 7
        || (shopIndex === 6 && rn2(2))
        || (shopIndex === 0 && rn2(5)))
        await addObjectToMonsterInventory(shopkeeper, await mksobj(SCR_CHARGING, true, false), game, { atFront: true });
    assignShopkeeperIdentity(shopkeeper, shopIndex);
    const entrance = level.doors[sroom.fdoor];
    if (!entrance)
        throw new Error('A stocked shop has no entrance door.');
    const doorLoc = level.requireAt(entrance.x, entrance.y);
    if (doorLoc.doormask === D_NODOOR) {
        doorLoc.doormask = D_ISOPEN;
        await newsym(entrance.x, entrance.y);
    }
    if (doorLoc.typ === SDOOR) {
        convertSecretDoor(doorLoc);
        await newsym(entrance.x, entrance.y);
    }
    if (doorLoc.doormask & D_TRAPPED)
        doorLoc.doormask = D_LOCKED;
    if (doorLoc.doormask === D_LOCKED) {
        let x = entrance.x, y = entrance.y;
        if (insideShopRoomAt(game, x + 1, y))
            x--;
        else if (insideShopRoomAt(game, x - 1, y))
            x++;
        if (insideShopRoomAt(game, entrance.x, y + 1))
            y--;
        else if (insideShopRoomAt(game, entrance.x, y - 1))
            y++;
        makeEngravingAt(x, y, 'Closed for inventory', null, 0, DUST);
        const noticeLocation = level.requireAt(x, y);
        if (noticeLocation.typ !== CORR && noticeLocation.typ !== ROOM)
            noticeLocation.typ = specialLevelAt() || roomsAt(level, x, y, 0).length ? ROOM : CORR;
    }
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
            && !monsterAtPosition(level, pos.x, pos.y)) {
            const mimic = mkclass(S_MIMIC, 0);
            if (mimic != null && await makemon(mimic, pos.x, pos.y, 0)) {
                continue;
            }
        }
        const atype = getShopItem(shopIndex);
        if (atype === VEGETARIAN_CLASS) {
            await mkveggy_at(pos.x, pos.y);
        }
        else if (atype < 0) {
            await mksobj_at(-atype, pos.x, pos.y, true, true);
        }
        else {
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
// C mkroom.c:squadmon().
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
    if (mndx == null) {
        const entry = probabilities[rn2(probabilities.length)];
        if (!entry)
            throw new RangeError('Barracks monster selection is out of range.');
        mndx = entry[0];
    }
    return ((game.mvitals?.[mndx]?.mvflags ?? 0) & 0x03)
        ? null : mndx;
}
export async function fillBarracksRoom(room) {
    const level = requireGameLevel();
    const entrance = room.doorct ? level.doors?.[room.fdoor] : null;
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = level.at(x, y);
            if (!loc)
                continue;
            if (room.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (entrance
                        && Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y)) <= 1))
                    continue;
            }
            else if (!SPACE_POS(loc.typ)
                || (entrance
                    && ((x === room.lx && entrance.x === x - 1)
                        || (x === room.hx && entrance.x === x + 1)
                        || (y === room.ly && entrance.y === y - 1)
                        || (y === room.hy && entrance.y === y + 1)))) {
                continue;
            }
            const mndx = barracksMonsterType();
            const monster = await makemon(mndx, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster)
                monster.msleeping = 1;
            if (!rn2(20)) {
                await mksobj_at(rn2(3) ? LARGE_BOX : CHEST, x, y, true, false);
            }
        }
    }
    level.flags.has_barracks = true;
}
// C ref: mkroom.c fill_zoo(BEEHIVE). The queen uses the center when it
// belongs to the room. Every other eligible square receives a sleeping
// killer bee, followed by that square's independent royal-jelly probe.
export async function fillBeehiveRoom(croom) {
    const level = requireGameLevel();
    const roomNumber = croom.roomnoidx + ROOMOFFSET;
    let centerX = croom.lx + Math.trunc((croom.hx - croom.lx + 1) / 2);
    let centerY = croom.ly + Math.trunc((croom.hy - croom.ly + 1) / 2);
    const center = level.requireAt(centerX, centerY);
    if (croom.irregular && (center.roomno !== roomNumber || center.edge)) {
        const point = { x: centerX, y: centerY };
        somexyspace(croom, point);
        centerX = point.x;
        centerY = point.y;
    }
    const door = croom.doorct ? level.doors?.[croom.fdoor] : null;
    for (let x = croom.lx; x <= croom.hx; x++) {
        for (let y = croom.ly; y <= croom.hy; y++) {
            const loc = level.at(x, y);
            if (!loc)
                continue;
            if (croom.irregular) {
                if (loc.roomno !== roomNumber || loc.edge
                    || (door && Math.max(Math.abs(x - door.x), Math.abs(y - door.y)) <= 1))
                    continue;
            }
            else if (!SPACE_POS(loc.typ)
                || (door && ((x === croom.lx && door.x === x - 1)
                    || (x === croom.hx && door.x === x + 1)
                    || (y === croom.ly && door.y === y - 1)
                    || (y === croom.hy && door.y === y + 1)))) {
                continue;
            }
            const mndx = x === centerX && y === centerY ? 5 : 1;
            const monster = await makemon(mndx, x, y, MM_ASLEEP | MM_NOGRP);
            if (monster)
                monster.msleeping = 1;
            if (!rn2(3))
                await mksobj_at(LUMP_OF_ROYAL_JELLY, x, y, true, false);
        }
    }
    level.flags.has_beehive = true;
}
function rogueGridCell(grid, x, y) {
    const cell = grid[x]?.[y];
    if (!cell)
        throw new RangeError(`Missing Rogue grid cell ${x},${y}`);
    return cell;
}
function rogueGridRoom(cell) {
    const room = cell.nroom === undefined ? undefined : requireGameLevel().rooms[cell.nroom];
    if (!isRoom(room))
        throw new Error('Rogue room cell has no generated room.');
    return room;
}
function rogueCorrCell(x, y) {
    const loc = game.level?.at(x, y);
    if (loc)
        loc.typ = rn2(50) ? CORR : SCORR;
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
    }
    else {
        const middle = y1 + rn2(y2 - y1 + 1);
        for (let y = Math.min(y1, middle); y <= Math.max(y1, middle); y++)
            rogueCorrCell(x1, y);
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
            rogueCorrCell(x, middle);
        for (let y = Math.min(middle, y2); y <= Math.max(middle, y2); y++)
            rogueCorrCell(x2, y);
    }
}
async function roguecorr(grid, x, y, dir) {
    const level = requireGameLevel();
    let fromx, fromy, tox, toy;
    const source = rogueGridCell(grid, x, y);
    if (dir === XL_DOWN) {
        source.doortable &= ~XL_DOWN;
        if (!source.real) {
            fromx = source.rlx + 1 + 26 * x;
            fromy = source.rly + 7 * y;
        }
        else {
            fromx = source.rlx + rn2(source.dx) + 1 + 26 * x;
            fromy = source.rly + source.dy + 7 * y;
            await dodoor(fromx, fromy, rogueGridRoom(source));
            level.requireAt(fromx, fromy).doormask = D_NODOOR;
            fromy++;
        }
        if (y >= 2)
            return;
        const dest = rogueGridCell(grid, x, ++y);
        dest.doortable &= ~XL_UP;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        }
        else {
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
        }
        else {
            fromx = source.rlx + source.dx + 1 + 26 * x;
            fromy = source.rly + rn2(source.dy) + 7 * y;
            await dodoor(fromx, fromy, rogueGridRoom(source));
            level.requireAt(fromx, fromy).doormask = D_NODOOR;
            fromx++;
        }
        if (x >= 2)
            return;
        const dest = rogueGridCell(grid, ++x, y);
        dest.doortable &= ~XL_LEFT;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        }
        else {
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
function rogueMiniwalk(grid, x, y) {
    while (true) {
        const dirs = [];
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
        if (!dirs.length)
            return;
        const dir = dirs[rn2(dirs.length)];
        if (dir === undefined)
            throw new RangeError('Rogue walk direction is out of range.');
        if (dir === XL_LEFT) {
            here.doortable |= XL_LEFT;
            rogueGridCell(grid, --x, y).doortable |= XL_RIGHT;
        }
        else if (dir === XL_RIGHT) {
            here.doortable |= XL_RIGHT;
            rogueGridCell(grid, ++x, y).doortable |= XL_LEFT;
        }
        else if (dir === XL_UP) {
            here.doortable |= XL_UP;
            rogueGridCell(grid, x, --y).doortable |= XL_DOWN;
        }
        else {
            here.doortable |= XL_DOWN;
            rogueGridCell(grid, x, ++y).doortable |= XL_UP;
        }
        rogueMiniwalk(grid, x, y);
    }
}
export async function makeroguerooms() {
    const g = game;
    const level = requireGameLevel();
    const roomEquivalence = g.smeq;
    if (!roomEquivalence)
        throw new Error('Rogue generation requires initialized room equivalence.');
    const grid = [[], [], []];
    let realRooms = 0;
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const column = grid[x];
            if (!column)
                throw new RangeError(`Missing Rogue grid column ${x}`);
            if (!rn2(5) && (realRooms || (x < 2 && y < 2))) {
                column[y] = {
                    doortable: 0, real: false,
                    rlx: rn1(22, 2), rly: rn1(y === 2 ? 4 : 3, 2),
                };
            }
            else {
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
            if (!room.real)
                continue;
            room.nroom = level.nroom;
            roomEquivalence[level.nroom] = level.nroom;
            const lowx = 1 + 26 * x + room.rlx;
            const lowy = 7 * y + room.rly;
            add_room(lowx, lowy, lowx + room.dx - 1, lowy + room.dy - 1, !rn2(7), OROOM, false);
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
async function makerogueghost() {
    const level = requireGameLevel();
    if (!level.nroom)
        return;
    const croom = level.rooms[rn2(level.nroom)];
    if (!isRoom(croom))
        throw new Error('Rogue ghost placement selected a missing room.');
    const x = somex(croom), y = somey(croom);
    const ghost = await makemon(287, x, y, 0); // PM_GHOST
    if (!ghost)
        return;
    ghost.msleeping = 1;
    setMonsterGivenName(ghost, roguePlayerName());
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
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    else {
        ghostobj = await mksobj_at(TWO_HANDED_SWORD, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    ghostobj = await mksobj_at(BOW, x, y, false, false);
    ghostobj.spe = 1;
    if (rn2(4))
        curseObjectState(ghostobj);
    ghostobj = await mksobj_at(ARROW, x, y, false, false);
    ghostobj.spe = 0;
    ghostobj.quan = rn1(10, 25);
    ghostobj.quantity = ghostobj.quan;
    ghostobj.owt = (OBJECT_WEIGHT[ARROW] ?? 1) * ghostobj.quan;
    if (rn2(4))
        curseObjectState(ghostobj);
    if (rn2(2)) {
        ghostobj = await mksobj_at(RING_MAIL, x, y, false, false);
        ghostobj.spe = rn2(3);
        if (!rn2(3))
            ghostobj.oerodeproof = true;
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    else {
        ghostobj = await mksobj_at(PLATE_MAIL, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (!rn2(3))
            ghostobj.oerodeproof = true;
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    if (rn2(2)) {
        ghostobj = await mksobj_at(FAKE_AMULET_OF_YENDOR, x, y, true, false);
        ghostobj.known = true;
    }
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
async function dodoor(x, y, aroom) {
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
function is_branchlev() {
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
async function placeBranchAt(branchp, x, y) {
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
async function place_branch(branchp) {
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
function isSolidTile(x, y) {
    if (!isok(x, y))
        return true;
    return IS_STWALL(game.level?.at(x, y)?.typ ?? STONE);
}
function isWallOrStone(x, y) {
    if (!isok(x, y))
        return 1;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (typ === STONE || isWallTile(x, y)) ? 1 : 0;
}
function isWallTile(x, y) {
    if (!isok(x, y))
        return 0;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (IS_WALL(typ) || IS_DOOR(typ) || typ === LAVAWALL
        || typ === WATER || typ === SDOOR || typ === IRONBARS) ? 1 : 0;
}
function extend_spine(locale, wall_there, dx, dy) {
    const nx = 1 + dx, ny = 1 + dy;
    if (!wall_there)
        return 0;
    if (dx) {
        const column = locale[nx];
        if (!column)
            throw new RangeError(`Invalid wall neighborhood column ${nx}`);
        if (locale[1][0] && locale[1][2] && column[0] && column[2])
            return 0;
        return 1;
    }
    if (locale[0][1] && locale[2][1] && locale[0][ny] && locale[2][ny])
        return 0;
    return 1;
}
function withinArea(x, y, area) {
    return !!area && x >= area.x1 && x <= area.x2
        && y >= area.y1 && y <= area.y2;
}
function wall_cleanup(x1, y1, x2, y2, protectedArea = null) {
    const map = game.level;
    if (!map)
        return;
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
            if (withinArea(x, y, protectedArea))
                continue;
            const loc = map.at(x, y);
            if (!loc)
                continue;
            const typ = loc.typ;
            if (!(IS_WALL(typ) && typ !== DBWALL))
                continue;
            if (isSolidTile(x - 1, y - 1) && isSolidTile(x - 1, y) && isSolidTile(x - 1, y + 1)
                && isSolidTile(x, y - 1) && isSolidTile(x, y + 1)
                && isSolidTile(x + 1, y - 1) && isSolidTile(x + 1, y) && isSolidTile(x + 1, y + 1))
                loc.typ = STONE;
        }
}
export function fix_wall_spines(x1, y1, x2, y2, wallOnlyArea = null) {
    const spineArray = [VWALL, HWALL, HWALL, HWALL,
        VWALL, TRCORNER, TLCORNER, TDWALL,
        VWALL, BRCORNER, BLCORNER, TUWALL,
        VWALL, TLWALL, TRWALL, CROSSWALL];
    const map = game.level;
    if (!map)
        return;
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
            const loc = map.at(x, y);
            if (!loc)
                continue;
            const typ = loc.typ;
            if (!(IS_WALL(typ) && typ !== DBWALL))
                continue;
            const probe = withinArea(x, y, wallOnlyArea)
                ? isWallTile : isWallOrStone;
            const locale = [
                [probe(x - 1, y - 1), probe(x - 1, y), probe(x - 1, y + 1)],
                [probe(x, y - 1), 0, probe(x, y + 1)],
                [probe(x + 1, y - 1), probe(x + 1, y), probe(x + 1, y + 1)],
            ];
            const bits = (extend_spine(locale, isWallTile(x, y - 1), 0, -1) << 3)
                | (extend_spine(locale, isWallTile(x, y + 1), 0, 1) << 2)
                | (extend_spine(locale, isWallTile(x + 1, y), 1, 0) << 1)
                | extend_spine(locale, isWallTile(x - 1, y), -1, 0);
            if (bits) {
                const wallType = spineArray[bits];
                if (wallType === undefined)
                    throw new RangeError(`Invalid wall spine mask ${bits}`);
                loc.typ = wallType;
            }
        }
}
export function wallification(x1, y1, x2, y2, protectedArea = null) {
    wall_cleanup(x1, y1, x2, y2, protectedArea);
    fix_wall_spines(x1, y1, x2, y2, protectedArea);
}
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
function get_level_extends() {
    const map = requireGameLevel();
    let xmin = 0, xmax = COLNO - 1, ymin = 0, ymax = ROWNO - 1;
    let found = false, nonwall = false;
    for (xmin = 0; !found && xmin <= COLNO - 1; xmin++) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmin, y)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ))
                    nonwall = true;
            }
        }
    }
    xmin -= (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    xmin = Math.max(0, xmin);
    found = false;
    nonwall = false;
    for (xmax = COLNO - 1; !found && xmax >= 0; xmax--) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmax, y)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ))
                    nonwall = true;
            }
        }
    }
    xmax += (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    xmax = Math.min(COLNO - 1, xmax);
    found = false;
    nonwall = false;
    for (ymin = 0; !found && ymin <= ROWNO - 1; ymin++) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.at(x, ymin)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ))
                    nonwall = true;
            }
        }
    }
    ymin -= (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    found = false;
    nonwall = false;
    for (ymax = ROWNO - 1; !found && ymax >= 0; ymax--) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.at(x, ymax)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ))
                    nonwall = true;
            }
        }
    }
    ymax += (nonwall || !game.level?.flags?.is_maze_lev) ? 2 : 1;
    return { xmin, xmax, ymin, ymax };
}
function bound_digging() {
    if (Is_earthlevel(game.u.uz))
        return;
    const map = requireGameLevel();
    const { xmin, xmax, ymin, ymax } = get_level_extends();
    for (let x = 0; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (!loc)
                continue;
            if (!IS_STWALL(loc.typ))
                continue;
            if (y <= ymin || y >= ymax || x <= xmin || x >= xmax)
                loc.wall_info |= W_NONDIGGABLE;
            if (y < ymin || y > ymax || x < xmin || x > xmax)
                loc.wall_info |= W_NONPASSWALL;
        }
}
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