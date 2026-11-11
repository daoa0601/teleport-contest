// sp_lev.js — Special-level construction from level descriptions.
// C ref: sp_lev.c — map placement and terrain selections, room / object /
// monster / trap construction from des operations, live level flipping,
// fill_special_room, check_room, create_room, create_subroom,
// dig_corridor, wallify_map, location picking, map cleanup and boundary
// symbols, the Lua level coder and special-level loader, and themed-room
// map placement.  The des.* binding table lives in lua/des.ts.
import { stack_object } from './invent.js';
import { RANDOM_CLASS, GEM_CLASS } from './objclass.js';
import { objectMerge, EGG, TIN, FIGURINE, CORPSE, SPE_NOVEL, BOULDER, STATUE, PICK_AXE, DWARVISH_MATTOCK, SADDLE, } from './object_data.js';
import { heroIsPunished, placeBallAndChain, unplaceBallAndChain } from './ball.js';
import { mksobj_at, mkobj_at, mkgold, set_corpsenm, rndmonnum, unlinkMonsterObject, blessObjectState, curseObjectState, unblessObjectState, uncurseObjectState, addCreatedObjectToContainer, addObjectToContainer, objectWeight, remove_object } from './mkobj.js';
import { isRoom } from './map_types.js';
import { deleteTrap, maketrap, trapAt } from './trap.js';
import { lookupNovelTitle, setMonsterGivenName, monsterTypeName } from './do_name.js';
import { game, requireGameLevel } from './gstate.js';
import { makemon, mkclass, propagateMonsterSpecies, setMonsterMalign } from './makemon.js';
import { ensureMinionData } from './minion.js';
import { monsterAtPosition, putSaddleOnMonster } from './steed.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SYMBOL } from './monster_data.js';
import { ismnum, GRAVE, CORPSTAT_HISTORIC, CORPSTAT_MALE, CORPSTAT_FEMALE, COLNO, ROWNO, STONE, ROOM, CORR, DOOR, STAIRS, LADDER, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, D_NODOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED, OROOM, VAULT, COURT, SWAMP, BEEHIVE, MORGUE, BARRACKS, ZOO, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, DELPHI, THEMEROOM, SHOPBASE, ROOMOFFSET, MAXNROFROOMS, SDOOR, SCORR, IRONBARS, FOUNTAIN, SINK, ALTAR, THRONE, ENGRAVE, BURN, MARK, DUST, ENGR_BLOOD, ACCESSIBLE, IS_WALL, IS_STWALL, IS_DOOR, IS_ROOM, IS_OBSTRUCTED, IS_FURNITURE, IS_LAVA, IS_POOL, In_endgame, Is_waterlevel, SPACE_POS, W_NONDIGGABLE, W_NONPASSWALL, W_RANDOM, W_NORTH, W_SOUTH, W_EAST, W_WEST, INVALID_TYPE, MAP_Y_LIM, MATCH_WALL, MAX_TYPE, FILL_NONE, FILL_NORMAL, ICE, MOAT, POOL, WATER, LAVAPOOL, LAVAWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_DIR, TREE, AIR, CLOUD, A_NONE, A_CHAOTIC, A_NEUTRAL, A_LAWFUL, AM_NONE, AM_LAWFUL, AM_NEUTRAL, AM_CHAOTIC, AM_MASK, AM_SPLEV_CO, AM_SPLEV_NONCO, AM_SPLEV_RANDOM, AM_SHRINE, AM_SANCTUM, Align2amask, Amask2align, M_AP_NOTHING, M_AP_FURNITURE, M_AP_OBJECT, M_AP_MONSTER, MM_NOGRP, MM_EMIN, MM_NOTAIL, MM_IGNOREWATER, MM_ADJACENTOK, MM_NOCOUNTBIRTH, MM_NOMSG, G_EXTINCT, G_GENOD, G_GONE, LEVEL_TIMER_KIND, STRAT_WAITFORU, F_LOOTED, F_WARNED, S_LDWASHER, S_LPUDDING, S_LRING, T_LOOTED, TREE_LOOTED, TREE_SWARM, is_hole, is_pit } from './const.js';
import { isok } from './cmd.js';
import { changeMonsterForm, removeMonsterFromGame, shapechangerGender } from './mon.js';
import { l_register_des, tableOptions, get_coord, luaArgument, find_objtype, objectClassForSymbol, MONSTER_CLASS_SYMBOLS, TRAP_TYPES, get_table_int_or_random } from './lua/des.js';
import { LuaTable, objectToLuaTable, luaTableToArray, luaCheckString } from './lua/runtime.js';
import { currentLuaLifecycle, startTimerAt } from './lua/lifecycle.js';
import { discardMonsterInventory } from './mkobj.js';
import { dropSpecialMonsterObjects } from './steal.js';
import { initializeMonsterArmor } from './worn.js';
import { make_grave } from './engrave.js';
import { createGasCloudSelection, createPoisonGasCloud } from './region.js';
import { mineralize } from './mklev.js';
import { countLevelFeatures } from './mklev.js';
import { wallification } from './mkmaze.js';
import { createSelectionApi, unwrapSelection } from './lua/nhlsel.js';
import { luaInteger, luaString } from './lua/arguments.js';
import { buryObject } from './dig.js';
import { rn2, rnd, rn1 } from './rng.js';
import { rnd_rect, get_rect, split_rects } from './rect.js';
import { depth as depth_of_level, inducedAlignment, level_difficulty, canDigDown, canFallThrough } from './dungeon.js';
import { flood_fill_rm, litstate_rnd, mkmap } from './mkmap.js';
import { create_maze, walkfrom } from './mkmaze.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { back_to_glyph, set_wall_state } from './display.js';
import { deleteEngravingAt, engravingAt, deleteEngraving } from './engrave.js';
import { createPlayerMonster } from './mplayer.js';
import { deleteObject } from './shk.js';
import { artifactByName, nameArtifact } from './artifact.js';
import { addObjectToMonsterInventory } from './steal.js';
import { somexy, fillBarracksRoom, fillBeehiveRoom, fillCourtRoom, fillMorgueRoom, fillZooRoom, insideRoom } from './mkroom.js';
import { beginObjectBurn, scheduleLevelTimer, stopLevelTimer } from './timeout.js';
import { monsterEmitsLight, vision_reset } from './vision.js';
import { new_light_source } from './light.js';
import { SpecialSelection } from './selvar.js';
import { mapCharacterType } from './lua/lifecycle.js';
import { CANDELABRUM_OF_INVOCATION, G_IGNORE, G_NOGEN, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, NO_TRAP, PIT, PM_BLACK_LIGHT, PM_FIRE_ELEMENTAL, PM_GIANT_SPIDER, PM_MINOTAUR, PM_SALAMANDER, PM_STALKER, PM_VAMPIRE, PM_VAMPIRE_BAT, PM_VLAD_THE_IMPALER, RIN_TELEPORTATION, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SCR_TELEPORTATION, SQKY_BOARD, S_MIMIC, TELEP_TRAP, TRAPDOOR, TRAPNUM, VIBRATING_SQUARE, WAN_DIGGING, WAN_TELEPORTATION, WEB, XLIM, YLIM, add_door, add_room, add_subroom, makecorridors, maybe_sdoor, mkstairs, mktrap, mktrap_victim, okdoor, topologize } from './mklev.js';
import { stairway_add } from './stairs.js';
import { enexto } from './teleport.js';
import { makeEngravingAt } from './engrave.js';
import { fix_wall_spines, setLevelTerrainLit, setLevelTerrainType, vibratingSquarePoint } from './mkmaze.js';
import { makeroguerooms } from './extralev.js';
import { stockShopRoom } from './shknam.js';
import { finishSpecialRoamer, specialShrinePriest } from './priest.js';
import { isLavaAt, isPoolAt, makeSpecialDrawbridge } from './dbridge.js';
import { is_dwarf, is_gnome, is_male, is_shapeshifter, monsterHasStoneResistance, monsterIsFemale, formCanBecomeStoneGolem, setMonsterSpecies, monsterIsAmphibious, monsterIsFlyer, monsterIsSwimmer, monsterPassesWalls, monsterIsGolem, monsterIsPlayerMonster, monsterIsVampireShifter, nameToMonster } from './mondata.js';
import { roomForIndex, roomsAt } from './hack.js';
import { PanicTermination } from './panic_termination.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { NethackLuaError } from './lua/errors.js';
import { swapDirectionBits } from './hacklib.js';
import { impossible } from './pline.js';
// C sp_lev.c:match_maptyps().
export function match_maptyps(expected, actual) {
    if (expected === MATCH_WALL && !IS_STWALL(actual))
        return false;
    if (expected < MAX_TYPE && expected !== actual)
        return false;
    return true;
}
export function mapfrag_fromstr(str) {
    const data = (str.split('\0', 1)[0] ?? '').replace(/[0-9]/g, '');
    const rows = data.split('\n');
    if (rows.at(-1) === '')
        rows.pop();
    if (rows.length > MAP_Y_LIM + 1)
        return null;
    return { data, wid: Math.max(0, ...rows.map(row => row.length)), hei: rows.length };
}
// C sp_lev.c:mapfrag_canmatch(). The fragment must have odd height and width.
export function mapfrag_canmatch(mf) {
    return mf.wid % 2 !== 0 && mf.hei % 2 !== 0;
}
// C sp_lev.c:mapfrag_get(). The terrain character at a fragment position;
// the original buffer is indexed with a fixed row stride.
export function mapfrag_get(mf, x, y) {
    return mapCharacterType(mf.data[y * (mf.wid + 1) + x]) ?? INVALID_TYPE;
}
// C sp_lev.c:mapfrag_free(). Drop the holder's fragment; the holder
// pattern mirrors C's struct mapfragment ** out-parameter.
export function mapfrag_free(holder) {
    holder.fragment = null;
}
// C sp_lev.c:mapfrag_error(). Null when the fragment can match; the
// fragment is dropped and the reason returned otherwise. A null fragment
// from mapfrag_fromstr() is the generic mapfragment error.
export function mapfrag_error(holder) {
    const mf = holder.fragment;
    if (mf === null)
        return 'mapfragment error';
    if (!mapfrag_canmatch(mf)) {
        mapfrag_free(holder);
        return 'mapfragment needs to have odd height and width';
    }
    // TYP_CANNOT_MATCH(typ): MAX_TYPE or INVALID_TYPE.
    const center = mapfrag_get(mf, Math.trunc(mf.wid / 2), Math.trunc(mf.hei / 2));
    if (center === MAX_TYPE || center === INVALID_TYPE) {
        mapfrag_free(holder);
        return 'mapfragment center must be valid terrain';
    }
    return null;
}
// C sp_lev.c:mapfrag_match(). Does the fragment match the level at x,y?
export function mapfrag_match(mf, x, y) {
    for (let rx = -Math.trunc(mf.wid / 2); rx <= Math.trunc(mf.wid / 2); rx++)
        for (let ry = -Math.trunc(mf.hei / 2); ry <= Math.trunc(mf.hei / 2); ry++) {
            const mapc = mapfrag_get(mf, rx + Math.trunc(mf.wid / 2), ry + Math.trunc(mf.hei / 2));
            const levc = isok(x + rx, y + ry)
                ? game.level?.at?.(x + rx, y + ry)?.typ : STONE;
            if (!match_maptyps(mapc, levc ?? STONE))
                return false;
        }
    return true;
}
// C sp_lev.c:random_wdir().
export function random_wdir() {
    switch (rn2(4)) {
        case 0: return W_NORTH;
        case 1: return W_SOUTH;
        case 2: return W_EAST;
        case 3: return W_WEST;
        default: throw new RangeError('Random direction is outside 0 through 3.');
    }
}
// Part of C sp_lev.c:fill_special_room(): fill vault squares with depth-scaled gold.
export async function fillVault(room) {
    if (!room)
        return;
    const amountRange = Math.abs(depth_of_level(game.u?.uz)) * 100;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            await mkgold(51 + rn2(amountRange), x, y);
        }
    }
}
// Port only: adapt random special-level coordinates to an optional position.
async function specialRandomLocation(context, acceptable) {
    const point = await get_location_coord(context, null, DRY, acceptable);
    return point.x === -1 && point.y === -1 ? null : point;
}
// C sp_lev.c:sel_set_ter(). Apply terrain, lighting, and its door/bar/cloud effects.
export function sel_set_ter(x, y, typ, lit) {
    const level = requireGameLevel();
    if (!setLevelTerrainLit(x, y, typ, lit))
        return;
    const cell = level.requireAt(x, y);
    if (cell.typ === SDOOR || IS_DOOR(cell.typ)) {
        if (cell.typ === SDOOR)
            cell.flags = cell.doormask = D_CLOSED;
        const left = level.at(x - 1, y);
        if (left && (IS_WALL(left.typ) || left.horizontal))
            cell.horizontal = true;
    }
    else if (cell.typ === IRONBARS || cell.typ === HWALL) {
        cell.horizontal = true;
    }
    else if (cell.typ === CLOUD) {
        deleteEngravingAt(x, y, level);
    }
}
// C sp_lev.c:lspo_mazewalk(). Parse the walk, open the exit, align to the maze grid, and stock it.
export async function lspo_mazewalk(context, mappedCells, value, yValue, directionValue) {
    const options = value instanceof LuaTable ? tableOptions(value) : {};
    const coordinate = value instanceof LuaTable ? get_table_xy_or_coord(options) : null;
    const mx = value instanceof LuaTable ? coordinate?.x ?? options.x ?? -1 : luaInteger(value);
    const my = value instanceof LuaTable ? coordinate?.y ?? options.y ?? -1 : luaInteger(yValue);
    const dir = value instanceof LuaTable ? String(options.dir ?? 'random') : String(directionValue ?? 'random');
    const stocked = value instanceof LuaTable ? options.stocked !== false && options.stocked !== 0 : true;
    const point = await getPackedLocationCoord(context, { x: mx, y: my }, ANY_LOC);
    if (!isok(point.x, point.y))
        throw new TypeError('mazewalk coord not ok');
    const directions = ['north', 'south', 'east', 'west'];
    const direction = dir === 'random'
        ? directions[rn2(directions.length)] : dir;
    if (direction !== 'north' && direction !== 'south'
        && direction !== 'east' && direction !== 'west')
        throw new TypeError(`Unknown maze direction: ${direction}`);
    const terrain = mapCharacterType(options.typ ?? '.');
    if (terrain === undefined)
        throw new TypeError('Unknown maze terrain');
    const level = requireGameLevel();
    let x = point.x, y = point.y;
    if (direction === 'north')
        y--;
    else if (direction === 'south')
        y++;
    else if (direction === 'east')
        x++;
    else if (direction === 'west')
        x--;
    const opening = level.at(x, y);
    if (opening && !IS_DOOR(opening.typ)) {
        opening.typ = terrain;
        opening.flags = 0;
    }
    if (!(x % 2)) {
        x += direction === 'east' ? 1 : -1;
        const parityOpening = level.at(x, y);
        if (parityOpening) {
            parityOpening.typ = terrain;
            parityOpening.flags = 0;
        }
    }
    if (!(y % 2))
        y += direction === 'south' ? 1 : -1;
    walkfrom(x, y, terrain, (COLNO - 1) & ~1, (ROWNO - 1) & ~1);
    if (stocked)
        await fill_empty_maze(mappedCells);
}
// C sp_lev.c:maze1xy(): an odd, unclaimed, dry maze spot.
function maze1xy(mappedCells) {
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
        if (--tries < 0)
            break;
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
// C sp_lev.c:rndtrap(): a random trap, excluding holes, portals, vibrating
// squares, and level-dependent cases.
function rndtrap() {
    const level = requireGameLevel();
    let typ;
    do {
        typ = rnd(TRAPNUM - 1);
        if (typ === HOLE || typ === VIBRATING_SQUARE
            || typ === MAGIC_PORTAL) {
            typ = NO_TRAP;
        }
        else if (typ === TRAPDOOR && !canDigDown()) {
            typ = NO_TRAP;
        }
        else if ((typ === LEVEL_TELEP || typ === TELEP_TRAP)
            && level.flags.noteleport) {
            typ = NO_TRAP;
        }
        else if ((typ === ROLLING_BOULDER_TRAP || typ === ROCKTRAP)
            && In_endgame(game.u?.uz)) {
            typ = NO_TRAP;
        }
    } while (typ === NO_TRAP);
    return typ;
}
// C sp_lev.c:fill_empty_maze(). The special-level maze is stocked in
// proportion to how much of it the map left unused.
export async function fill_empty_maze(mappedCells) {
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
    if (mapcount <= Math.trunc(mapcountmax / 10))
        return;
    const mapfact = Math.trunc(mapcount * 100 / mapcountmax);
    for (let count = rnd(Math.trunc(20 * mapfact / 100)); count > 0; count--) {
        const point = maze1xy(mappedCells);
        await mkobj_at(rn2(2) ? GEM_CLASS : RANDOM_CLASS, point.x, point.y, true);
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100)); count > 0; count--) {
        const point = maze1xy(mappedCells);
        const trap = trapAt(game, point.x, point.y);
        if (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp)))
            continue;
        await mksobj_at(BOULDER, point.x, point.y, true, false);
    }
    for (let count = rn2(2); count > 0; count--) {
        const point = maze1xy(mappedCells);
        await makemon(PM_MINOTAUR, point.x, point.y, 0);
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100)); count > 0; count--) {
        const point = maze1xy(mappedCells);
        await makemon(null, point.x, point.y, 0);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100)); count > 0; count--) {
        const point = maze1xy(mappedCells);
        await mkgold(0, point.x, point.y);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100)); count > 0; count--) {
        const point = maze1xy(mappedCells);
        let typ = rndtrap();
        if (level.objects?.[point.x]?.[point.y]
            ?.some(object => object.otyp === BOULDER)) {
            while (is_pit(typ) || is_hole(typ))
                typ = rndtrap();
        }
        await maketrap(point.x, point.y, typ);
    }
}
// C sp_lev.c:pm_to_humidity().
function pm_to_humidity(mndx) {
    const symbol = MONSTER_SYMBOL[mndx];
    let humidity = symbol === 57 || (monsterIsSwimmer(mndx) || monsterIsAmphibious(mndx))
        ? WET : DRY;
    if (monsterIsFlyer(mndx) || symbol === 5 || symbol === 25)
        humidity |= HOT | WET;
    if (monsterPassesWalls(mndx) || symbol === 54)
        humidity |= SOLID;
    if (mndx === 30 || mndx === 110
        || mndx === PM_FIRE_ELEMENTAL || mndx === PM_SALAMANDER)
        humidity |= HOT;
    return humidity;
}
// C sp_lev.c:sel_set_wall_property(). Flag one qualifying square; solid
// rock counts, so a later des.wallify() cannot turn it into a boundary
// wall without losing the property established by des.non_diggable().
function sel_set_wall_property(loc, prop) {
    if (IS_STWALL(loc.typ) || loc.typ === TREE || loc.typ === IRONBARS)
        loc.wall_info |= prop;
}
// C sp_lev.c:set_wall_property(): flag the rectangle's walls, trees and
// iron bars. lspo_non_diggable() reaches this whole-map form.
export function set_wall_property(context = null) {
    const level = requireGameLevel();
    const xstart = context?.xstart ?? 0;
    const ystart = context?.ystart ?? 0;
    const width = context?.width ?? COLNO;
    const height = context?.height ?? ROWNO;
    for (let dx = 0; dx < width; dx++)
        for (let dy = 0; dy < height; dy++) {
            const loc = level.at(xstart + dx, ystart + dy);
            if (loc)
                sel_set_wall_property(loc, W_NONDIGGABLE);
        }
}
// C sp_lev.c:lspo_non_diggable(): the selection form flags the selected
// walls and trees directly.
export function lspo_non_diggable(selection) {
    if (!selection) {
        set_wall_property();
        return;
    }
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        if (loc)
            sel_set_wall_property(loc, W_NONDIGGABLE);
    });
}
// C sp_lev.c:sel_set_door(): make the square a door (secret if asked),
// orient it, and take the requested mask.
function sel_set_door(context, mask, x, y) {
    const level = requireGameLevel();
    const doorX = context.xstart + x, doorY = context.ystart + y;
    const loc = level.at(doorX, doorY);
    if (!loc)
        return null;
    if (!IS_DOOR(loc.typ) && loc.typ !== SDOOR)
        loc.typ = DOOR;
    set_door_orientation(doorX, doorY);
    loc.doormask = mask;
    return { x: doorX, y: doorY };
}
// C sp_lev.c:rnddoor(): one of the five door states, uniformly.
function rnddoor() {
    // lspo_door() uses rnddoor() directly for an explicit coordinate.
    const states = [D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED];
    const mask = states[rn2(states.length)];
    if (mask === undefined)
        throw new Error('Missing random door state');
    return mask;
}
// Part of C sp_lev.c:flip_level(): compute and clamp the area to flip.
// The extent scan duplicates get_level_extends in mkmaze.ts.
function getSpecialLevelExtents() {
    const map = requireGameLevel();
    const findColumn = (start, step) => {
        for (let x = start; x >= 0 && x < COLNO; x += step) {
            let nonwall = false, found = false;
            for (let y = 0; y < ROWNO; y++) {
                const typ = map.requireAt(x, y).typ;
                if (typ === STONE)
                    continue;
                found = true;
                if (!IS_WALL(typ))
                    nonwall = true;
            }
            if (found)
                return { coordinate: x, nonwall };
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
                const typ = map.requireAt(x, y).typ;
                if (typ === STONE)
                    continue;
                found = true;
                if (!IS_WALL(typ))
                    nonwall = true;
            }
            if (found)
                return { coordinate: y, nonwall };
        }
        return { coordinate: start, nonwall: false };
    };
    const top = findRow(0, 1), bottom = findRow(ROWNO - 1, -1);
    let miny = top.coordinate + 1
        - (top.nonwall || !map.flags.is_maze_lev ? 2 : 1);
    let maxy = bottom.coordinate - 1
        + (bottom.nonwall || !map.flags.is_maze_lev ? 2 : 1);
    minx = Math.max(1, minx);
    maxx = Math.min(COLNO - 1, maxx);
    miny = Math.max(0, miny);
    maxy = Math.min(ROWNO - 1, maxy);
    return { minx, miny, maxx, maxy };
}
// C sp_lev.c:flip_level(). Transposes top with bottom or left with right.
export async function flip_level(flp, extras = false) {
    if (!(flp & 3))
        return;
    const level = requireGameLevel();
    const { minx, miny, maxx, maxy } = getSpecialLevelExtents();
    const inArea = (x, y) => x >= minx && x <= maxx
        && y >= miny && y <= maxy;
    const flipX = (x) => maxx - x + minx;
    const flipY = (y) => maxy - y + miny;
    const transform = (x, y, requireArea = true) => {
        if (requireArea && !inArea(x, y))
            return { x, y };
        return { x: flp & 2 ? flipX(x) : x, y: flp & 1 ? flipY(y) : y };
    };
    let replaceBallAndChain = false;
    if (extras && heroIsPunished()) {
        const ball = game.uball || game.u.uball;
        const chain = game.uchain || game.u.uchain;
        if (!ball || !chain)
            throw new Error('Punishment requires a ball and chain.');
        if (ball.where !== 'free') {
            if (ball.where === 'inventory') {
                ball.ox = game.u.ux;
                ball.oy = game.u.uy;
            }
            replaceBallAndChain = inArea(ball.ox, ball.oy) !== inArea(chain.ox, chain.oy)
                || inArea(ball.ox, ball.oy) !== inArea(game.u.ux, game.u.uy);
            if (replaceBallAndChain)
                await unplaceBallAndChain();
        }
    }
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
            if (flp & 1)
                loc.typ = verticalWallFlip.get(loc.typ) ?? loc.typ;
            if (flp & 2)
                loc.typ = horizontalWallFlip.get(loc.typ) ?? loc.typ;
        }
    }
    for (let stair = game.stairs; stair; stair = stair.next) {
        const point = transform(stair.sx, stair.sy, false);
        stair.sx = point.x;
        stair.sy = point.y;
    }
    if (level.upstair)
        level.upstair = transform(level.upstair.x, level.upstair.y, false);
    if (level.dnstair)
        level.dnstair = transform(level.dnstair.x, level.dnstair.y, false);
    for (const trap of level.traps || []) {
        const flipTrap = inArea(trap.tx, trap.ty);
        const point = transform(trap.tx, trap.ty);
        trap.tx = point.x;
        trap.ty = point.y;
        if (flipTrap && is_pit(trap.ttyp) && trap.conjoined) {
            // C applies the full mask once in each selected axis branch.
            if (flp & 1)
                trap.conjoined = flip_encoded_dir_bits(flp, trap.conjoined);
            if (flp & 2)
                trap.conjoined = flip_encoded_dir_bits(flp, trap.conjoined);
        }
        if (flipTrap && trap.ttyp === ROLLING_BOULDER_TRAP) {
            trap.launch = transform(trap.launch.x, trap.launch.y, false);
            if (!trap.launch2)
                throw new Error('Rolling boulder trap has no second launch location.');
            trap.launch2 = transform(trap.launch2.x, trap.launch2.y, false);
        }
    }
    const movedObjects = [];
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const pile = level.objects?.[x]?.[y];
            if (!pile)
                continue;
            const point = transform(x, y);
            for (const object of pile) {
                object.ox = point.x;
                object.oy = point.y;
            }
            const column = movedObjects[point.x] ??= [];
            column[point.y] = pile;
        }
    }
    level.objects = movedObjects;
    for (const object of level.buriedObjects ?? []) {
        const point = transform(object.ox, object.oy);
        object.ox = point.x;
        object.oy = point.y;
    }
    const flipCoordinate = (coordinate) => {
        if (!coordinate?.x)
            return;
        const flipped = transform(coordinate.x, coordinate.y);
        coordinate.x = flipped.x;
        coordinate.y = flipped.y;
    };
    // C sp_lev.c:flip_vault_guard(): the guard's goal, origin, and corridor.
    const flipGuard = (monster) => {
        const guard = monster._egd;
        if (!guard)
            return;
        const goal = transform(guard.gdx, guard.gdy);
        guard.gdx = goal.x;
        guard.gdy = goal.y;
        const origin = transform(guard.ogx, guard.ogy);
        guard.ogx = origin.x;
        guard.ogy = origin.y;
        for (const cell of guard.fakecorr.slice(guard.fcbeg, guard.fcend))
            flipCoordinate(cell);
    };
    for (const monster of level.monsters || []) {
        if (monster.isgd) {
            if (extras)
                flipGuard(monster);
            if (monster.mx === 0)
                continue;
        }
        if (!inArea(monster.mx, monster.my))
            continue;
        const point = transform(monster.mx, monster.my);
        monster.mx = point.x;
        monster.my = point.y;
        flipCoordinate(monster.mgoal);
        if (monster.ispriest) {
            flipCoordinate((monster.epri || monster.mextra?.epri)?.shrpos);
        }
        else if (monster.isshk) {
            const shop = monster.eshk || monster.mextra?.eshk;
            flipCoordinate(shop?.shk);
            flipCoordinate(shop?.shd);
        }
        else if (monster.wormno) {
            if (monster.wormHead) {
                const head = transform(monster.wormHead.x, monster.wormHead.y, false);
                monster.wormHead.x = head.x;
                monster.wormHead.y = head.y;
            }
            if (!monster.wormSegments)
                throw new Error('Long worm has no segment list.');
            for (const segment of monster.wormSegments) {
                const position = transform(segment.x, segment.y, false);
                segment.x = position.x;
                segment.y = position.y;
            }
        }
    }
    if (extras) {
        const heroLevel = game.u.uz;
        if (!heroLevel)
            throw new Error('Flipping a live level requires the hero dungeon location.');
        const onLevel = (location) => location.dnum === heroLevel.dnum && location.dlevel === heroLevel.dlevel;
        for (const monster of game._migratingMonsters ?? []) {
            const priest = monster.epri || monster.mextra?.epri;
            const shop = monster.eshk || monster.mextra?.eshk;
            if (monster.isgd && monster._egd && onLevel(monster._egd.gdlevel))
                flipGuard(monster);
            else if (monster.ispriest && priest && onLevel(priest.shrlevel))
                flipCoordinate(priest.shrpos);
            else if (monster.isshk && shop && onLevel(shop.shoplevel)) {
                flipCoordinate(shop.shk);
                flipCoordinate(shop.shd);
            }
        }
    }
    for (const region of level.regions) {
        region.cells = region.cells.map(cell => transform(cell.x, cell.y, false));
    }
    for (const engraving of level.engravings || []) {
        const point = transform(engraving.x, engraving.y, false);
        engraving.x = point.x;
        engraving.y = point.y;
    }
    for (const room of level.rooms.slice(0, level.nroom)) {
        if (!isRoom(room))
            continue;
        const low = transform(room.lx, room.ly, false);
        const high = transform(room.hx, room.hy, false);
        room.lx = Math.min(low.x, high.x);
        room.hx = Math.max(low.x, high.x);
        room.ly = Math.min(low.y, high.y);
        room.hy = Math.max(low.y, high.y);
    }
    for (const room of level.subrooms || []) {
        if (!room)
            continue;
        const low = transform(room.lx, room.ly, false);
        const high = transform(room.hx, room.hy, false);
        room.lx = Math.min(low.x, high.x);
        room.hx = Math.max(low.x, high.x);
        room.ly = Math.min(low.y, high.y);
        room.hy = Math.max(low.y, high.y);
    }
    for (const door of level.doors || []) {
        const point = transform(door.x, door.y);
        door.x = point.x;
        door.y = point.y;
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
                flip_dbridge_vertical(swap);
                flip_dbridge_vertical(level.requireAt(x, otherY));
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
                flip_dbridge_horizontal(swap);
                flip_dbridge_horizontal(level.requireAt(otherX, y));
                column[y] = level.requireAt(otherX, y);
                otherColumn[y] = swap;
            }
        }
    }
    for (const timer of level.levelTimers) {
        const point = transform(timer.x, timer.y, false);
        timer.x = point.x;
        timer.y = point.y;
    }
    if (extras) {
        if (inArea(game.u.ux, game.u.uy)) {
            const hero = transform(game.u.ux, game.u.uy);
            game.u.ux = game.u.ux0 = hero.x;
            game.u.uy = game.u.uy0 = hero.y;
        }
        if (replaceBallAndChain)
            await placeBallAndChain();
        flipCoordinate(game._travelTarget); // C iflags.travelcc
        flipCoordinate(game.context.digging?.pos);
    }
    fix_wall_spines(1, 0, COLNO - 1, ROWNO - 1);
    if (extras) {
        set_wall_state();
        flip_visuals(flp, minx, miny, maxx, maxy);
    }
    vision_reset();
    game.vision_full_recalc = 1;
    level._flip = { flp, minx, miny, maxx, maxy };
}
// C sp_lev.c:flip_dbridge_horizontal().
function flip_dbridge_horizontal(location) {
    if (location.typ !== DRAWBRIDGE_UP && location.typ !== DRAWBRIDGE_DOWN)
        return;
    const mask = location.drawbridgemask ?? location.flags;
    const direction = mask & DB_DIR;
    const first = DB_WEST;
    const second = DB_EAST;
    if (direction !== first && direction !== second)
        return;
    location.flags = location.drawbridgemask = (mask & ~DB_DIR)
        | (direction === first ? second : first);
}
// C sp_lev.c:flip_dbridge_vertical().
function flip_dbridge_vertical(location) {
    if (location.typ !== DRAWBRIDGE_UP && location.typ !== DRAWBRIDGE_DOWN)
        return;
    const mask = location.drawbridgemask ?? location.flags;
    const direction = mask & DB_DIR;
    const first = DB_NORTH;
    const second = DB_SOUTH;
    if (direction !== first && direction !== second)
        return;
    location.flags = location.drawbridgemask = (mask & ~DB_DIR)
        | (direction === first ? second : first);
}
// C sp_lev.c:flip_encoded_dir_bits().
function flip_encoded_dir_bits(flp, value) {
    if (flp & 1) {
        value = swapDirectionBits(value, 1, 7);
        value = swapDirectionBits(value, 2, 6);
        value = swapDirectionBits(value, 3, 5);
    }
    if (flp & 2) {
        value = swapDirectionBits(value, 1, 3);
        value = swapDirectionBits(value, 0, 4);
        value = swapDirectionBits(value, 7, 5);
    }
    return value;
}
// C sp_lev.c:flip_visuals(). Updates the seen vector and known wall glyphs.
function flip_visuals(flp, minx, miny, maxx, maxy) {
    const level = requireGameLevel();
    for (let y = miny; y <= maxy; y++) {
        for (let x = minx; x <= maxx; x++) {
            const location = level.requireAt(x, y);
            let seen = location.seenv & 255;
            if (!seen)
                continue;
            if (flp & 1) {
                seen = swapDirectionBits(seen, 2, 4);
                seen = swapDirectionBits(seen, 1, 5);
                seen = swapDirectionBits(seen, 0, 6);
            }
            if (flp & 2) {
                seen = swapDirectionBits(seen, 2, 0);
                seen = swapDirectionBits(seen, 3, 7);
                seen = swapDirectionBits(seen, 4, 6);
            }
            location.seenv = seen;
            if ((IS_WALL(location.typ) || location.typ === SDOOR)
                && location.remembered_glyph?.kind === 'terrain') {
                const glyph = back_to_glyph(location, x, y);
                location.remembered_glyph = { ...glyph, decgfx: glyph.dec };
            }
        }
    }
}
// C sp_lev.c:flip_level_rnd(). Picks which of the allowed transpositions run.
export async function flip_level_rnd(allowed, extras = false) {
    let flp = 0;
    if ((allowed & 1) && rn2(2))
        flp |= 1;
    if ((allowed & 2) && rn2(2))
        flp |= 2;
    await flip_level(flp, extras);
}
// Part of C sp_lev.c:create_object(): the invent-carrying-monster branch —
// create at a chosen square, remove_object, then the monster picks it up.
export async function giveSpecialMonsterObject(context, monster, otyp, spe) {
    const point = await specialRandomLocation(context);
    if (!point || !monster)
        return null;
    const object = await mksobj_at(otyp, point.x, point.y, true, true);
    if (spe != null)
        object.spe = spe;
    remove_object(object, game);
    return await addObjectToMonsterInventory(monster, object, game, { atFront: true });
}
// Part of C mklev.c:mktrap(): finish trap residents, destinations and predecessor victims.
export async function finishLevelTrapConstruction(trap, { spiderOnWeb = true, seen = false, victim = true } = {}) {
    if (!trap)
        return null;
    const kind = trap.ttyp;
    // mklev.c:mktrap() owns the web's resident spider before evaluating the
    // shallow-level dead-predecessor gate.
    if (kind === WEB && spiderOnWeb)
        await makemon(PM_GIANT_SPIDER, trap.tx, trap.ty, 0);
    if (seen)
        trap.tseen = true;
    const cameFrom = game.u.ucamefrom;
    if (kind === MAGIC_PORTAL && cameFrom && (cameFrom.dnum || cameFrom.dlevel))
        trap.dst = { ...cameFrom };
    if (!game.in_mklev || kind === NO_TRAP || !victim)
        return trap;
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
export const DRY = 0x01;
export const WET = 0x02;
export const HOT = 0x04;
export const SOLID = 0x08;
export const ANY_LOC = 0x10;
export const NO_LOC_WARN = 0x20;
export const SPACELOC = 0x40;
// C sp_lev.c:get_location(). Resolve room/map coordinates and apply humidity constraints.
export async function get_location(context, coordinate, humidity, filter) {
    const room = context._room;
    const mx = room ? room.lx : context.xstart;
    const my = room ? room.ly : context.ystart;
    const sx = room ? room.hx - mx + 1 : context.width;
    const sy = room ? room.hy - my + 1 : context.height;
    let point = { ...coordinate };
    if (point.x >= 0) {
        point.x += mx;
        point.y += my;
    }
    else {
        let found = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (room)
                somexy(room, point);
            else
                point = { x: mx + rn2(sx), y: my + rn2(sy) };
            if (is_ok_location(point.x, point.y, humidity, filter)) {
                found = true;
                break;
            }
        }
        if (!found) {
            for (let x = 0; x < sx && !found; x++)
                for (let y = 0; y < sy; y++) {
                    point = { x: mx + x, y: my + y };
                    if (is_ok_location(point.x, point.y, humidity, filter)) {
                        found = true;
                        break;
                    }
                }
            if (!found) {
                if (humidity & NO_LOC_WARN)
                    point = { x: -1, y: -1 };
                else
                    await impossible("get_location:  can't find a place!");
            }
        }
    }
    if (!(humidity & ANY_LOC) && !isok(point.x, point.y))
        point = humidity & NO_LOC_WARN ? { x: -1, y: -1 }
            : { x: (COLNO - 1) & ~1, y: (ROWNO - 1) & ~1 };
    return point;
}
// C sp_lev.c:is_ok_location(). The filter argument represents set_ok_location_func().
export function is_ok_location(x, y, humidity, filter) {
    if (Is_waterlevel(game.u.uz))
        return true;
    const level = requireGameLevel();
    const location = level.at(x, y);
    if (filter)
        return !!location && filter(location, x, y);
    if (humidity & ANY_LOC)
        return true;
    if (!location)
        return false;
    if ((humidity & SOLID) && IS_OBSTRUCTED(location.typ))
        return true;
    if ((humidity & (DRY | SPACELOC)) && SPACE_POS(location.typ)) {
        const boulder = level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
        if (!boulder || (humidity & SOLID))
            return true;
    }
    if ((humidity & WET) && isPoolAt(x, y))
        return true;
    return !!((humidity & HOT) && isLavaAt(x, y));
}
// C sp_lev.c:get_location_coord(). Resolve a packed coordinate, retrying random placement if needed.
// Also C sp_lev.c:get_unpacked_coord(): inlined here (the -1 random
// sentinel and the explicit humidity flags).
export async function get_location_coord(context, coordinate, humidity, filter) {
    // sp_lev.h packs explicit axes as unsigned bytes; only (-1, -1)
    // denotes a random coordinate at the Lua boundary.
    if (coordinate && (coordinate.x !== -1 || coordinate.y !== -1))
        return await getPackedLocationCoord(context, coordinate, humidity, filter);
    const input = { x: -1, y: -1 };
    const point = await get_location(context, input, humidity | NO_LOC_WARN, filter);
    if (point.x === -1 && point.y === -1)
        return await get_location(context, point, humidity, filter);
    return point;
}
// Part of C sp_lev.h SP_COORD_PACK: decode a packed special-level coordinate
// without the random sentinel.  Unlike get_location_coord, it never
// recognizes the random sentinel.
export async function getPackedLocationCoord(context, coordinate, humidity, filter) {
    return await get_location(context, { x: coordinate.x & 0xff, y: coordinate.y & 0xff }, humidity, filter);
}
// C sp_lev.c:get_free_room_loc(). Retry on ordinary floor so room features do not replace each other.
async function get_free_room_loc(context, coordinate, room) {
    const level = requireGameLevel();
    let point = await get_location_coord(context, coordinate, DRY);
    if (level.at(point.x, point.y)?.typ === ROOM)
        return point;
    for (let attempt = 0; attempt <= 100; attempt++) {
        point = get_room_loc({ x: -1, y: -1 }, room);
        if (level.at(point.x, point.y)?.typ === ROOM)
            return point;
    }
    throw new Error("get_free_room_loc: can't find a place!");
}
// C sp_lev.c:create_trap(). Choose a free room square or retry away from stairs.
async function create_trap(context, typ, options, coordinate) {
    // C sp_lev.c:create_trap(): invocation placement owns its coordinates,
    // including when Lua supplies an explicit location or a room.
    if (typ === VIBRATING_SQUARE) {
        const square = vibratingSquarePoint();
        return await maketrap(square.x, square.y, VIBRATING_SQUARE);
    }
    const level = requireGameLevel();
    const room = context._room;
    let point = null;
    if (room) {
        point = await get_free_room_loc(context, coordinate, room);
    }
    else {
        for (let attempt = 0; attempt <= 100; attempt++) {
            const candidate = await get_location_coord(context, coordinate, DRY);
            const terrain = level.at(candidate.x, candidate.y)?.typ;
            if (terrain !== STAIRS && terrain !== LADDER) {
                point = candidate;
                break;
            }
        }
    }
    if (!point)
        return null;
    return await mktrap(typ, options, null, point);
}
// Port only: construct the Lua placement context for an existing room.
export function specialRoomContext(room) {
    const context = {
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
// C sp_lev.c:add_doors_to_room(). Claims bordering doors, subrooms included.
export function add_doors_to_room(room) {
    const level = requireGameLevel();
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const loc = level.at(x, y);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                maybe_add_door(x, y, room);
        }
    }
    for (const subroom of room.sbrooms || [])
        add_doors_to_room(subroom);
}
// C sp_lev.c:link_doors_rooms()
// A later Lua room can create a door shared
// with an earlier one, so link the completed map before stocking it.
// Claim map doors for their rooms.
export function link_doors_rooms() {
    const level = requireGameLevel();
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 0; x < COLNO; x++) {
            const loc = level.requireAt(x, y);
            if (!IS_DOOR(loc.typ) && loc.typ !== SDOOR)
                continue;
            set_door_orientation(x, y);
            for (const room of level.rooms.slice(0, level.nroom)) {
                if (!isRoom(room))
                    continue;
                maybe_add_door(x, y, room);
                for (const subroom of room.sbrooms ?? [])
                    maybe_add_door(x, y, subroom);
            }
        }
    }
}
// C sp_lev.c:maybe_add_door(). A door joins the room it is inside or borders.
function maybe_add_door(x, y, room) {
    const level = requireGameLevel();
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    const inRectangle = !room.irregular
        && x >= room.lx - 1 && x <= room.hx + 1
        && y >= room.ly - 1 && y <= room.hy + 1;
    if (inRectangle || level.at(x, y)?.roomno === roomNumber
        || shared_with_room(x, y, room, roomNumber)) {
        add_door(x, y, room);
    }
}
// C sp_lev.c:shared_with_room(). Is x,y right next to the room?
function shared_with_room(x, y, room, roomNumber) {
    const level = requireGameLevel();
    const loc = level.at(x, y);
    if (!isok(x, y) || !loc || (loc.roomno === roomNumber && !loc.edge))
        return false;
    return (isok(x - 1, y) && x - 1 <= room.hx && level.at(x - 1, y)?.roomno === roomNumber)
        || (isok(x + 1, y) && x + 1 >= room.lx && level.at(x + 1, y)?.roomno === roomNumber)
        || (isok(x, y - 1) && y - 1 <= room.hy && level.at(x, y - 1)?.roomno === roomNumber)
        || (isok(x, y + 1) && y + 1 >= room.ly && level.at(x, y + 1)?.roomno === roomNumber);
}
// C sp_lev.c:remove_boundary_syms(). Mapped crosswalls delimit rooms during
// construction, then become floor before ordinary wall shaping can alter them.
export function remove_boundary_syms(mappedCells, state = game) {
    const level = requireGameLevel(state);
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    for (let x = 0; x < mazeXMax; x++) {
        for (let y = 0; y < mazeYMax; y++) {
            const location = level.requireAt(x, y);
            if (location.typ === CROSSWALL && mappedCells.has(x, y))
                location.typ = ROOM;
        }
    }
}
// C sp_lev.c:set_door_orientation(). Horizontal unless the side walls say
// otherwise.
function set_door_orientation(x, y) {
    const level = requireGameLevel();
    const wallOrDoor = (nx, ny) => {
        const loc = level.at(nx, ny);
        return isok(nx, ny) && !!loc
            && (IS_WALL(loc.typ) || IS_DOOR(loc.typ) || loc.typ === SDOOR);
    };
    let left = wallOrDoor(x - 1, y), right = wallOrDoor(x + 1, y);
    let up = wallOrDoor(x, y - 1), down = wallOrDoor(x, y + 1);
    if (!left && !right && !up && !down) {
        const joinsDoor = (nx, ny) => {
            const loc = level.at(nx, ny);
            return !isok(nx, ny) || !!loc && (IS_OBSTRUCTED(loc.typ) || loc.typ === IRONBARS);
        };
        left = joinsDoor(x - 1, y);
        right = joinsDoor(x + 1, y);
        up = joinsDoor(x, y - 1);
        down = joinsDoor(x, y + 1);
    }
    level.requireAt(x, y).horizontal = (left || right) && !(up && down);
}
// C sp_lev.c:build_room(). Chance-gated room or subroom creation.
export async function build_room(spec, parent = null) {
    const level = requireGameLevel();
    const chance = spec.chance ?? 100;
    const requestedType = spec.rtype ?? OROOM;
    const rtype = !chance || rn2(100) < chance ? requestedType : OROOM;
    let room;
    if (parent) {
        room = create_subroom(parent, spec.x ?? -1, spec.y ?? -1, spec.w ?? -1, spec.h ?? -1, rtype, spec.lit ?? -1);
    }
    else {
        const made = create_room(spec.x ?? -1, spec.y ?? -1, spec.w ?? -1, spec.h ?? -1, spec.xalign ?? -1, spec.yalign ?? -1, rtype, spec.lit ?? -1);
        room = made ? level.rooms[level.nroom - 1] : null;
    }
    if (!isRoom(room))
        return null;
    // Lua lspo_room() marks the current parent irregular as soon as a child
    // room is accepted.  Runtime inside_room() queries must then use map
    // room-number ownership rather than the parent's rectangular boundary.
    if (parent)
        parent.irregular = true;
    topologize(room);
    // lspo_room() leaves themed rooms unstocked unless Lua requests filling.
    // Special-level room definitions retain the ordinary filled default.
    room.needfill = spec.filled ?? (game.in_mk_themerooms ? FILL_NONE : FILL_NORMAL);
    room.needjoining = spec.joined === undefined || !!spec.joined;
    return room;
}
// C sp_lev.c:create_door(). A door on a room wall, with a random state.
function create_door(room, state, wall, position = -1) {
    const level = requireGameLevel();
    const wantedDirection = wall === 'all' || wall === 'random' ? null
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
            }
            else if (rn2(6) === 0) {
                mask = D_LOCKED;
            }
            else {
                mask = D_CLOSED;
            }
            if (mask !== D_ISOPEN && rn2(25) === 0)
                mask |= D_TRAPPED;
        }
        else {
            mask = D_NODOOR;
        }
    }
    else {
        mask = state === 'secret' ? D_NODOOR
            : state === 'nodoor' ? D_NODOOR
                : state === 'locked' ? D_LOCKED
                    : state === 'open' ? D_ISOPEN : D_CLOSED;
    }
    let x = 0, y = 0;
    let found = false;
    for (let trycnt = 0; trycnt < 100; trycnt++) {
        const direction = rn2(4);
        if (wantedDirection != null && direction !== wantedDirection)
            continue;
        if (direction === 0) {
            y = room.ly - 1;
            x = room.lx + (position < 0
                ? rn2(1 + room.hx - room.lx) : position);
            if (!isok(x, y - 1) || IS_OBSTRUCTED(level.requireAt(x, y - 1).typ))
                continue;
        }
        else if (direction === 1) {
            y = room.hy + 1;
            x = room.lx + (position < 0
                ? rn2(1 + room.hx - room.lx) : position);
            if (!isok(x, y + 1) || IS_OBSTRUCTED(level.requireAt(x, y + 1).typ))
                continue;
        }
        else if (direction === 2) {
            x = room.lx - 1;
            y = room.ly + (position < 0
                ? rn2(1 + room.hy - room.ly) : position);
            if (!isok(x - 1, y) || IS_OBSTRUCTED(level.requireAt(x - 1, y).typ))
                continue;
        }
        else {
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
    if (!found)
        return;
    const loc = level.at(x, y);
    if (!loc)
        return;
    if (!setLevelTerrainType(x, y, secret ? SDOOR : DOOR))
        return;
    loc.doormask = mask;
}
// C sp_lev.c:lvlfill_solid(): fill the maze area and reset per-cell flags.
function lvlfill_solid(type, lit) {
    const level = requireGameLevel();
    for (let x = 2; x <= ((COLNO - 1) & ~1); x++) {
        for (let y = 0; y <= ((ROWNO - 1) & ~1); y++) {
            if (!setLevelTerrainLit(x, y, type, lit))
                continue;
            const cell = level.requireAt(x, y);
            cell.flags = cell.doormask = cell.wall_info = cell.icedpool = 0;
            cell.altarmask = cell.ladder = cell.looted = cell.drawbridgemask = 0;
            cell.emptygrave = false;
            cell.blessedftn = false;
            cell.disturbed = false;
            cell.horizontal = false;
            cell.roomno = 0;
            cell.edge = false;
        }
    }
}
// C sp_lev.c:splev_initlev(): the level style
// dispatch — solidfill, mazegrid, maze, rogue, mines and swamp.
export async function splev_initlev(options, active) {
    active.levelInitialized = true;
    const style = options.style ?? 'solidfill';
    if (style === 'rogue') {
        await makeroguerooms();
        return;
    }
    if (style === 'mines') {
        const foreground = mapCharacterType(options.fg ?? '.');
        const background = mapCharacterType(options.bg ?? ' ');
        if (foreground === undefined || background === undefined)
            throw new Error('unknown Lua mines terrain');
        const lit = options.lit == null ? !!rn2(2) : !!options.lit;
        const filling = mapCharacterType(options.filling ?? options.fg ?? '.');
        if (filling !== undefined)
            lvlfill_solid(filling, false);
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
    if (style === 'swamp') {
        const foreground = mapCharacterType(options.fg ?? '.');
        const background = mapCharacterType(options.bg ?? '}');
        if (foreground === undefined || background === undefined)
            throw new Error('unknown Lua swamp terrain');
        const lit = options.lit == null ? !!rn2(2) : !!options.lit;
        lvlfill_swamp(foreground, background, lit);
        active.defaultLit = lit;
        return;
    }
    if (style === 'mazegrid') {
        const type = mapCharacterType(options.bg ?? ' ');
        if (type === undefined)
            throw new Error(`unknown Lua map character ${options.bg}`);
        lvlfill_maze_grid(type);
        active.defaultLit = false;
        return;
    }
    if (style === 'maze') {
        create_maze(options.corrwid ?? -1, options.wallthick ?? -1, options.deadends === false);
        active.defaultLit = false;
        return;
    }
    if (style !== 'solidfill')
        throw new Error(`unsupported Lua level style ${style}`);
    const type = mapCharacterType(options.filling ?? options.fg ?? '.');
    if (type === undefined)
        throw new Error(`unknown Lua map character ${options.fg}`);
    active.defaultLit = options.lit == null ? !!rn2(2) : !!options.lit;
    lvlfill_solid(type, active.defaultLit);
    return;
}
// C sp_lev.c:lspo_level_flags(): the level flag names.
export function lspo_level_flags(active, flags) {
    const level = requireGameLevel();
    if (!flags.length)
        throw new TypeError('des.level_flags requires at least one flag');
    for (const value of flags) {
        const flag = luaString(value).toLowerCase();
        if (flag === 'mazelevel')
            level.flags.is_maze_lev = true;
        else if (flag === 'noteleport')
            level.flags.noteleport = true;
        else if (flag === 'hardfloor')
            level.flags.hardfloor = true;
        else if (flag === 'nommap')
            level.flags.nommap = true;
        else if (flag === 'shortsighted')
            level.flags.shortsighted = true;
        else if (flag === 'arboreal')
            level.flags.arboreal = true;
        else if (flag === 'graveyard')
            level.flags.graveyard = true;
        else if (flag === 'corrmaze')
            level.flags.corrmaze = true;
        else if (flag === 'sokoban')
            level.flags.sokoban_rules = true;
        else if (flag === 'premapped')
            active.premapped = true;
        else if (flag === 'solidify')
            active.solidify = true;
        else if (flag === 'inaccessibles')
            active.checkInaccessibles = true;
        else if (flag === 'noflipx')
            active.allowFlips = (active.allowFlips ?? 0) & ~2;
        else if (flag === 'noflipy')
            active.allowFlips = (active.allowFlips ?? 0) & ~1;
        else if (flag === 'noflip')
            active.allowFlips = 0;
        else if (flag === 'temperate')
            level.flags.temperature = 0;
        else if (flag === 'hot')
            level.flags.temperature = 1;
        else if (flag === 'cold')
            level.flags.temperature = -1;
        else if (flag === 'nomongen')
            level.flags.rndmongen = false;
        else if (flag === 'nodeathdrops')
            level.flags.deathdrops = false;
        else if (flag === 'noautosearch')
            level.flags.noautosearch = true;
        else if (flag === 'fumaroles')
            level.flags.fumaroles = true;
        else if (flag === 'stormy')
            level.flags.stormy = true;
        else if (flag === 'icedpools')
            active.icedPools = true;
        else if (flag === 'shroud')
            level.flags.hero_memory = true;
        else
            throw new Error(`unknown Lua level flag ${flag}`);
    }
}
// C sp_lev.c:lspo_replace_terrain(): chance-gated terrain exchange over a
// region, selection or map fragment match.
export async function lspo_replace_terrain(context, value) {
    const fields = tableOptions(value, 'terrain', true);
    const options = {
        ...fields, selection: fields.selection == null ? null : unwrapSelection(fields.selection),
    };
    const level = requireGameLevel();
    const explicit = [
        options.x1 ?? -1, options.y1 ?? -1, options.x2 ?? -1, options.y2 ?? -1,
    ];
    const rectangle = explicit.some(value => value !== -1) ? explicit : options.region;
    let selection = options.selection;
    if (rectangle && rectangle.some(value => value !== -1)) {
        const start = await get_location(context, { x: rectangle[0], y: rectangle[1] }, ANY_LOC);
        const end = await get_location(context, { x: rectangle[2], y: rectangle[3] }, ANY_LOC);
        selection = new SpecialSelection();
        for (let x = Math.max(1, start.x); x <= Math.min(COLNO - 1, end.x); x++)
            for (let y = Math.max(0, start.y); y <= Math.min(ROWNO - 1, end.y); y++)
                selection.add(x, y);
    }
    selection ??= new SpecialSelection().negate();
    const fromType = mapCharacterType(options.fromterrain ?? '');
    const toType = mapCharacterType(options.toterrain ?? '');
    const holder = { fragment: null };
    if (fromType === undefined && options.mapfragment != null) {
        holder.fragment = mapfrag_fromstr(String(options.mapfragment));
        const error = mapfrag_error(holder);
        if (error !== null)
            throw new NethackLuaError(error);
    }
    const mf = holder.fragment;
    if ((!mf && fromType === undefined) || toType === undefined)
        throw new Error('unknown Lua replacement terrain');
    const chance = options.chance ?? 100;
    const lit = options.lit ?? -2;
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        const matches = mf
            ? mapfrag_match(mf, x, y)
            : loc && fromType !== undefined && match_maptyps(fromType, loc.typ);
        if (!matches || rn2(100) >= chance)
            return;
        setLevelTerrainLit(x, y, toType, lit);
    });
    mapfrag_free(holder);
}
// C sp_lev.c:sel_set_feature(). Furniture placement refuses a square that
// already holds furniture.
function sel_set_feature(cell, typ) {
    if (!IS_FURNITURE(cell.typ))
        cell.typ = typ;
}
// C sp_lev.c:l_table_getset_feature_flag(). Set or clear one furniture
// flag; an absent field leaves the flag alone.
function l_table_getset_feature_flag(cell, value, flag) {
    if (value === undefined)
        return;
    const current = cell.looted ?? cell.flags;
    cell.flags = cell.looted = value ? current | flag : current & ~flag;
}
// C sp_lev.c:lspo_feature(): furniture at a dry random spot or an
// author-chosen square.
export async function lspo_feature(context, value, x, y) {
    const fields = value instanceof LuaTable ? tableOptions(value) : {};
    const options = {
        ...fields, type: fields.type ?? String(value),
        point: get_table_xy_or_coord(fields) ?? get_coord(luaArgument(x), luaArgument(y)),
    };
    const level = requireGameLevel();
    const { type, point } = options;
    const types = {
        fountain: FOUNTAIN, sink: SINK, pool: POOL,
        throne: THRONE, tree: TREE,
    };
    const featureType = types[type];
    if (featureType === undefined)
        throw new Error(`unknown Lua feature ${type}`);
    const random = !point || (point.x === -1 && point.y === -1);
    const location = await get_location_coord(context, point, random ? DRY : ANY_LOC);
    if (!isok(location.x, location.y))
        return;
    const cell = level.requireAt(location.x, location.y);
    sel_set_feature(cell, featureType);
    if (cell.typ !== featureType)
        return;
    switch (featureType) {
        case FOUNTAIN:
            l_table_getset_feature_flag(cell, options.looted, F_LOOTED);
            l_table_getset_feature_flag(cell, options.warned, F_WARNED);
            break;
        case SINK:
            l_table_getset_feature_flag(cell, options.pudding, S_LPUDDING);
            l_table_getset_feature_flag(cell, options.dishwasher, S_LDWASHER);
            l_table_getset_feature_flag(cell, options.ring, S_LRING);
            break;
        case THRONE:
            l_table_getset_feature_flag(cell, options.looted, T_LOOTED);
            break;
        case TREE:
            l_table_getset_feature_flag(cell, options.looted, TREE_LOOTED);
            l_table_getset_feature_flag(cell, options.swarm, TREE_SWARM);
            break;
    }
}
// C sp_lev.c:noncoalignment().
function noncoalignment() {
    const original = game.u?.ualignbase?.[1]
        ?? game.u?.ualign?.type ?? A_NEUTRAL;
    const choice = rn2(2);
    if (original === A_NEUTRAL)
        return choice ? A_CHAOTIC : A_LAWFUL;
    return choice ? -original : A_NEUTRAL;
}
// Part of C sp_lev.c:sp_amask_to_amask(): evaluate the repeated noncoalignment macro argument.
// align.h:Align2amask: the macro argument is a ternary
// macro that re-evaluates noncoalignment for every comparison. Its first
// comparison tests against A_NONE (-128), which noncoalignment never
// returns, so resolution always continues: a lawful second draw stops after
// two rn2 draws with bound 2; anything else forces a third and can store the shifted
// (alignment + 2) mask.
function noncoalignedSpecialAmask() {
    const first = noncoalignment();
    if (first === A_NONE)
        return AM_NONE;
    const second = noncoalignment();
    if (second === A_LAWFUL)
        return AM_LAWFUL;
    return (noncoalignment() + 2) & 0xff;
}
// C sp_lev.c:get_table_align(). The alignment field's mask: a fixed
// alignment, a coalignment placeholder, or random.
function get_table_align(align = 'random') {
    const gtaligns = new Map([
        ['noalign', AM_NONE],
        ['law', AM_LAWFUL],
        ['neutral', AM_NEUTRAL],
        ['chaos', AM_CHAOTIC],
        ['coaligned', AM_SPLEV_CO],
        ['noncoaligned', AM_SPLEV_NONCO],
        ['random', AM_SPLEV_RANDOM],
    ]);
    const spAmask = gtaligns.get(align);
    if (spAmask === undefined)
        throw new Error(`unsupported Lua alignment ${align}`);
    return spAmask;
}
// C sp_lev.c:sp_amask_to_amask(). Resolve coaligned, noncoaligned and random masks.
function sp_amask_to_amask(spAmask) {
    if (spAmask === AM_SPLEV_CO)
        return Align2amask(game.u?.ualignbase?.[1] ?? game.u?.ualign?.type ?? A_NEUTRAL);
    if (spAmask === AM_SPLEV_NONCO)
        return noncoalignedSpecialAmask();
    if (spAmask === AM_SPLEV_RANDOM)
        return Align2amask(inducedAlignment(80));
    return spAmask & AM_MASK;
}
// C sp_lev.c:lspo_altar(). The shared table reader supplies the altar descriptor.
export async function lspo_altar(context, value) {
    const options = tableOptions(value);
    const spAmask = get_table_align(options.align);
    await create_altar(context, options, spAmask);
}
// C sp_lev.c:create_altar(). Place the altar and its optional shrine priest.
async function create_altar(context, options, spAmask) {
    const level = requireGameLevel();
    const coordinate = get_table_xy_or_coord(options);
    const point = context._room
        ? await get_free_room_loc(context, coordinate, context._room)
        : await get_location_coord(context, coordinate, DRY);
    const altar = level.at(point.x, point.y);
    if (!altar)
        return;
    if (!setLevelTerrainType(point.x, point.y, ALTAR))
        return;
    const amask = sp_amask_to_amask(spAmask);
    const alignment = Amask2align(amask);
    altar.flags = amask;
    const altarType = options.type ?? 'altar';
    if (!['altar', 'shrine', 'sanctum'].includes(altarType))
        throw new Error(`unsupported Lua altar type ${altarType}`);
    const templeNumber = context._room ? undefined : roomsAt(level, point.x, point.y, TEMPLE)[0];
    const temple = context._room
        ? context._room.rtype === TEMPLE ? context._room : null
        : templeNumber === undefined ? null : roomForIndex(level, templeNumber - ROOMOFFSET);
    if (!temple || altarType === 'altar')
        return;
    const sanctum = altarType === 'sanctum';
    await specialShrinePriest(temple, point.x, point.y, alignment, { sanctum });
    altar.flags |= AM_SHRINE;
    if (sanctum)
        altar.flags |= AM_SANCTUM;
    level.flags.has_temple = true;
}
// C sp_lev.c:get_table_roomtype_opt(): the room type by name.
function get_table_roomtype_opt(name = 'ordinary') {
    const roomTypes = {
        ordinary: OROOM,
        vault: VAULT,
        zoo: ZOO,
        beehive: BEEHIVE,
        morgue: MORGUE,
        barracks: BARRACKS,
        anthole: ANTHOLE,
        cocknest: COCKNEST,
        leprehall: LEPREHALL,
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
    const roomType = roomTypes[name.toLowerCase()];
    if (roomType == null)
        throw new Error(`unsupported Lua room type ${name}`);
    return roomType;
}
// C sp_lev.c:get_mkroom_name(). The room type's name in room_types[].
// C calls impossible() for a type outside the table; the rtype values the
// game creates are all listed, so the branch is unreachable here.
function get_mkroom_name(rtype) {
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
    return rtype >= SHOPBASE
        ? shopNames[rtype - SHOPBASE] ?? 'unknown' : names.get(rtype) ?? 'unknown';
}
// C sp_lev.c:l_push_mkroom_table(): the room table passed to a contents
// callback.
// Also C sp_lev.c:l_push_wid_hei_table(): inlined here (the width/height
// entries of the room table).
export function l_push_mkroom_table(room) {
    return objectToLuaTable({
        width: room.hx - room.lx + 1,
        height: room.hy - room.ly + 1,
        region: { x1: room.lx, y1: room.ly, x2: room.hx, y2: room.hy },
        lit: !!room.rlit,
        irregular: !!room.irregular,
        needjoining: !!room.needjoining,
        type: get_mkroom_name(room.rtype),
    });
}
// C sp_lev.c:get_table_coords_or_region(). The x1..y2 fields, or the
// region array when all four coordinates are absent.
function get_table_coords_or_region(options) {
    const coords = [options.x1 ?? -1, options.y1 ?? -1, options.x2 ?? -1, options.y2 ?? -1];
    return coords.some(value => value !== -1) ? coords : options.region ?? coords;
}
// C sp_lev.c:lspo_region(). Light a selection, or create a rectangular/irregular room and its contents.
// Also C sp_lev.c:sel_set_lit(): inlined here (the selection lighting
// callback, lava excepted).
export async function lspo_region(scope, context, state, value, lighting = 'unlit') {
    if (value instanceof SpecialSelection) {
        const lit = lighting === 'lit';
        const area = lit ? value.grow() : value;
        area.forEachXMajor((x, y) => {
            const loc = requireGameLevel().at(x, y);
            if (loc)
                loc.lit = IS_LAVA(loc.typ) || lit;
        });
        return null;
    }
    const options = tableOptions(value, 'integer', true);
    const [x1, y1, x2, y2] = get_table_coords_or_region(options);
    if (typeof x1 !== 'number' || typeof y1 !== 'number'
        || typeof x2 !== 'number' || typeof y2 !== 'number'
        || ![x1, y1, x2, y2].every(Number.isInteger))
        throw new TypeError('des.region requires four coordinates');
    if ([x1, y1, x2, y2].every(value => value === -1))
        throw new TypeError('region needs region');
    const roomType = get_table_roomtype_opt(options.type);
    const lit = litstate_rnd(options.lit ?? -1);
    const start = await get_location(context, { x: x1, y: y1 }, ANY_LOC);
    const end = await get_location(context, { x: x2, y: y2 }, ANY_LOC);
    const absolute = { xstart: 0, ystart: 0, width: COLNO, height: ROWNO };
    const roomNotNeeded = roomType === OROOM && !options.irregular
        && !options.arrival_room && !game.in_mk_themerooms;
    if (roomNotNeeded || requireGameLevel().nroom >= MAXNROFROOMS) {
        if (!roomNotNeeded)
            await impossible('Too many rooms on new level!');
        light_region(absolute, start.x, start.y, end.x, end.y, lit);
        return null;
    }
    const needFill = options.filled ?? 0;
    const level = requireGameLevel();
    let room;
    if (options.irregular) {
        const seedX = start.x, seedY = start.y;
        const roomNumber = level.nroom + ROOMOFFSET;
        const equivalence = game.smeq;
        if (!equivalence)
            throw new Error('Irregular room creation requires room equivalence.');
        equivalence[level.nroom] = level.nroom;
        const bounds = flood_fill_rm(seedX, seedY, roomNumber, lit, true);
        // lspo_region() registers the bounds with lighting off: flood_fill_rm()
        // already lit the room's floor and boundary, not the whole rectangle.
        add_room(bounds.lx, bounds.ly, bounds.hx, bounds.hy, false, roomType, true);
        const created = level.rooms[level.nroom - 1];
        if (!isRoom(created))
            throw new Error('Irregular room creation did not install a room.');
        created.rlit = lit ? 1 : 0;
        created.irregular = true;
        created.needjoining = true;
        created.needfill = needFill;
        add_doors_to_room(created);
        room = created;
    }
    else {
        const level = requireGameLevel();
        room = add_room(start.x, start.y, end.x, end.y, lit, roomType, true);
        room.needjoining = true;
        room.needfill = needFill;
        topologize(room);
        add_doors_to_room(room);
    }
    room.needjoining = options.joined === undefined || !!options.joined;
    if (room && options.arrival_room)
        room.arrival_room = true;
    if (!options.contents)
        return room;
    const parent = scope.context;
    scope.context = specialRoomContext(room);
    try {
        await state.callValueAsync(options.contents, [l_push_mkroom_table(room)]);
    }
    finally {
        update_croom(scope, parent);
    }
    add_doors_to_room(room);
    return room;
}
// C sp_lev.c:update_croom(). Restore the coder's room context to the
// enclosing room; the port models tmproomlist[] with the async scope
// chain, so the parent is the popped room below the top.
function update_croom(scope, parent) {
    scope.context = parent;
}
// C sp_lev.c:lspo_room(). Read room placement, build it, then run its nested contents.
// Also C sp_lev.c:spo_endroom(): inlined here (the finally pops the room
// scope through update_croom()).
export async function lspo_room(scope, active, state, value) {
    const options = tableOptions(value, 'integer');
    if (scope.roomFailed)
        return null;
    const coordinate = get_table_xy_or_coord(options);
    if (coordinate && (coordinate.x === -1) !== (coordinate.y === -1))
        throw new TypeError('Room must have both x and y');
    const horizontal = {
        left: 1, 'half-left': 2, center: 3, 'half-right': 4, right: 5,
        none: -1, random: -1,
    };
    const xalign = horizontal[options.xalign ?? 'random'];
    const vertical = {
        top: 1, center: 3, bottom: 5, none: -1, random: -1,
    };
    const yalign = vertical[options.yalign ?? 'random'];
    if (xalign == null || yalign == null)
        throw new Error('unsupported Lua room alignment');
    const spec = {
        ...options,
        x: coordinate?.x ?? -1,
        y: coordinate?.y ?? -1,
        rtype: get_table_roomtype_opt(options.type),
        xalign,
        yalign,
    };
    const parent = scope.context;
    const room = await build_room(spec, parent._room ?? null);
    if (room) {
        if (options.contents) {
            scope.context = specialRoomContext(room);
            try {
                await state.callValueAsync(options.contents, [l_push_mkroom_table(room)]);
            }
            finally {
                update_croom(scope, parent);
            }
        }
        add_doors_to_room(room);
    }
    else if (active.prototype === 'themerms') {
        scope.roomFailed = true;
    }
    update_croom(scope, parent);
    return room;
}
// C sp_lev.c:l_create_stairway(). Both Lua bindings share placement and trap clearance.
// Also C sp_lev.c:good_stair_loc(): inlined here (the random-spot terrain
// filter).
async function l_create_stairway(context, mappedCells, usingLadder, directionValue, x, y) {
    const options = directionValue instanceof LuaTable ? tableOptions(directionValue) : null;
    const direction = options ? String(options.dir ?? 'down') : String(directionValue);
    const point = options ? get_table_xy_or_coord(options) : get_coord(luaArgument(x), luaArgument(y));
    const up = direction === 'up';
    const random = !point || (point.x === -1 && point.y === -1);
    const location = await get_location_coord(context, point, DRY, random ? loc => loc.typ === ROOM || loc.typ === CORR || loc.typ === ICE : undefined);
    const trap = requireGameLevel().traps.find(candidate => candidate.tx === location.x && candidate.ty === location.y);
    if (trap)
        deleteTrap(trap);
    mappedCells.add(location.x, location.y);
    if (usingLadder) {
        const loc = requireGameLevel().at(location.x, location.y);
        if (!loc)
            return location;
        loc.typ = LADDER;
        loc.ladder = up ? 1 : 2;
        const currentLevel = game.u?.uz?.dlevel ?? 1;
        const destination = {
            dnum: game.u?.uz?.dnum ?? 0,
            dlevel: currentLevel + (up ? -1 : 1),
        };
        stairway_add(location.x, location.y, !!up, true, destination);
    }
    else
        await mkstairs(location.x, location.y, up, context._room ?? null, !random);
    return location;
}
// C sp_lev.c:lspo_stair().
export async function lspo_stair(context, mappedCells, direction, x, y) {
    return await l_create_stairway(context, mappedCells, false, direction, x, y);
}
// C sp_lev.c:lspo_ladder().
export async function lspo_ladder(context, mappedCells, direction, x, y) {
    return await l_create_stairway(context, mappedCells, true, direction, x, y);
}
// C sp_lev.c:lspo_door(). Read the state and coordinates, then create a room or map door.
export async function lspo_door(context, value, x, y) {
    const options = value instanceof LuaTable ? tableOptions(value) : {};
    const state = value instanceof LuaTable ? String(options.state ?? 'random') : String(value);
    const point = value instanceof LuaTable ? get_table_xy_or_coord(options) : get_coord(luaArgument(x), luaArgument(y));
    const wall = options.wall ?? 'all';
    const pos = options.pos ?? -1;
    if (!point || (point.x === -1 && point.y === -1)) {
        if (!context?._room)
            throw new TypeError('des.door without coordinates needs a room');
        return create_door(context._room, state, wall, pos);
    }
    const randomMask = state === 'random' ? rnddoor() : null;
    const location = await getPackedLocationCoord(context, point, ANY_LOC);
    if (!isok(location.x, location.y))
        throw new TypeError('door coord not ok');
    const mapX = location.x - context.xstart, mapY = location.y - context.ystart;
    if (randomMask !== null)
        return sel_set_door(context, randomMask, mapX, mapY);
    const masks = {
        nodoor: D_NODOOR,
        broken: D_BROKEN,
        open: D_ISOPEN,
        closed: D_CLOSED,
        locked: D_LOCKED,
    };
    if (state === 'secret') {
        const door = sel_set_door(context, D_CLOSED, mapX, mapY);
        const loc = door && requireGameLevel().at(door.x, door.y);
        if (loc)
            loc.typ = SDOOR;
        return door;
    }
    const mask = masks[state];
    if (mask === undefined)
        throw new Error(`unknown Lua door state ${state}`);
    return sel_set_door(context, mask, mapX, mapY);
}
// C sp_lev.c:create_corridor(). Corridors start from a door.
export async function create_corridor(options) {
    const { srcroom, srcdoor, destroom, destdoor } = options;
    if (srcroom === undefined || srcdoor === undefined || destroom === undefined || destdoor === undefined)
        throw new TypeError('des.corridor requires source and destination rooms and door indices');
    if (srcroom === -1) {
        await makecorridors();
        return;
    }
    const srcwall = options.srcwall ?? 'all', destwall = options.destwall ?? 'all';
    if (['all', 'random'].includes(srcwall) || ['all', 'random'].includes(destwall)) {
        await impossible('create_corridor to/from a random wall');
        return;
    }
    const level = requireGameLevel();
    const source = level.rooms[srcroom], destination = level.rooms[destroom];
    if (!isRoom(source) || !isRoom(destination))
        return;
    const start = search_door(source, srcwall, srcdoor);
    const end = search_door(destination, destwall, destdoor);
    if (start && end)
        await dig_corridor(start, end, null, false, CORR, STONE);
}
// C sp_lev.c:search_door(). Number doors along a wall in increasing map order.
function search_door(room, wall, door) {
    if (!['north', 'south', 'east', 'west'].includes(wall))
        throw new TypeError(`Unknown corridor wall: ${wall}`);
    const vertical = wall === 'east' || wall === 'west';
    const dx = wall === 'east' ? 1 : wall === 'west' ? -1 : 0;
    const dy = wall === 'south' ? 1 : wall === 'north' ? -1 : 0;
    let x = wall === 'east' ? room.hx + 1 : room.lx + dx;
    let y = wall === 'south' ? room.hy + 1 : room.ly + dy;
    while (x <= room.hx + 1 && y <= room.hy + 1) {
        const cell = requireGameLevel().at(x, y);
        if (cell && (IS_DOOR(cell.typ) || cell.typ === SDOOR) && door-- <= 0)
            return { x: x + dx, y: y + dy };
        if (vertical)
            y++;
        else
            x++;
    }
    return null;
}
// C sp_lev.c:lspo_drawbridge(): direction, open or closed state, placement.
export async function lspo_drawbridge(context, value) {
    const options = tableOptions(value, 'terrain', false);
    const coordinate = get_table_xy_or_coord(options);
    if (!coordinate || !isok(coordinate.x, coordinate.y))
        throw new TypeError('des.drawbridge requires coordinates');
    const directions = {
        north: DB_NORTH, south: DB_SOUTH,
        east: DB_EAST, west: DB_WEST,
    };
    const direction = options.dir === 'random' || options.dir == null
        ? -1
        : directions[options.dir];
    if (direction == null)
        throw new Error(`unknown Lua drawbridge direction ${options.dir}`);
    if (!['open', 'closed', 'random', undefined].includes(options.state))
        throw new Error(`unknown Lua drawbridge state ${options.state}`);
    const point = await get_location_coord(context, coordinate, DRY | WET | HOT);
    const open = options.state === 'random' || options.state == null
        ? !rn2(2) : options.state === 'open';
    if (!await makeSpecialDrawbridge(point.x, point.y, direction, open))
        await impossible('Cannot create drawbridge.');
    return point;
}
// C sp_lev.c:lspo_engraving(). Read the text and flags, choose a dry spot, and engrave.
export async function lspo_engraving(context, value, typeValue, text) {
    const options = typeValue == null ? tableOptions(value) : { degrade: true, guardobjects: false };
    const coordinate = typeValue == null ? get_table_xy_or_coord(options) : get_coord(luaArgument(value));
    const engravingType = typeValue == null ? String(options.type ?? 'engrave') : String(typeValue);
    const textValue = typeValue == null ? String(options.text) : String(text);
    const point = await get_location_coord(context, coordinate, DRY);
    const types = {
        dust: DUST,
        engrave: ENGRAVE,
        burn: BURN,
        mark: MARK,
        blood: ENGR_BLOOD,
    };
    const type = types[engravingType];
    if (type == null)
        throw new Error(`unknown Lua engraving type ${engravingType}`);
    makeEngravingAt(point.x, point.y, textValue, null, 0, type);
    // C sp_lev.c:lspo_engraving(): the coder's guard/degrade flags are
    // applied after make_engr_at(), so they also override the Elbereth
    // guard that make_engr_at() itself installs while making a level.
    const engraving = engravingAt(point.x, point.y);
    if (engraving) {
        engraving.guardobjects = !!options.guardobjects;
        engraving.nowipeout = options.degrade === false;
    }
    return engraving;
}
// C sp_lev.c:lspo_gold(). Resolve placement before drawing an unspecified amount.
export async function lspo_gold(context, value, x, y) {
    const options = value instanceof LuaTable ? tableOptions(value) : null;
    const coordinate = options ? get_table_xy_or_coord(options) : get_coord(luaArgument(x), luaArgument(y));
    const requestedAmount = options ? options.amount ?? -1
        : typeof value === 'number' && Number.isInteger(value) ? value : -1;
    const point = await get_location_coord(context, coordinate, DRY);
    const amount = requestedAmount < 0 ? rnd(200) : requestedAmount;
    return await mkgold(amount, point.x, point.y);
}
// C sp_lev.c:lspo_object(). Parse the request and repeat create_object for nonstacking quantities.
export async function lspo_object(context, parentContainer, parentMonster, invokeContents, id, x, y) {
    const options = id instanceof LuaTable
        ? tableOptions(id) : {};
    const curseState = get_table_buc(options.buc);
    if (typeof id === 'string') {
        if (id.length === 1)
            options.class = id;
        else
            options.id = id;
    }
    const location = get_table_xy_or_coord(options)
        ?? get_coord(luaArgument(x), luaArgument(y));
    const corpseMonster = options.montype == null
        ? null : String(options.montype);
    const objectType = options.id ? find_objtype(options.id, options.class) : null;
    const speciesObject = objectType !== null && [STATUE, CORPSE, EGG, TIN, FIGURINE].includes(objectType);
    const spinachTin = objectType === TIN
        && corpseMonster?.toLowerCase() === 'spinach';
    const noSpecies = spinachTin || (objectType === TIN || objectType === EGG)
        && corpseMonster?.toLowerCase() === 'empty';
    const corpseMonsterClass = speciesObject && corpseMonster?.length === 1
        ? MONSTER_CLASS_SYMBOLS.indexOf(corpseMonster) : null;
    if (speciesObject && corpseMonster?.length === 1 && (corpseMonsterClass == null || corpseMonsterClass < 1))
        throw new Error(`unknown Lua monster class ${corpseMonster}`);
    if (objectType === STATUE || objectType === CORPSE) {
        options.spe = (options.historic ? CORPSTAT_HISTORIC : 0)
            | (options.male ? CORPSTAT_MALE : 0) | (options.female ? CORPSTAT_FEMALE : 0);
    }
    else if (objectType === EGG) {
        options.spe = options.laid_by_you ? 1 : 0;
    }
    else if (objectType === TIN || objectType === FIGURINE) {
        options.spe = spinachTin ? 1 : 0;
    }
    const objectOptions = {
        ...options,
        curseState,
        point: location,
        objectClass: options.class
            ? objectClassForSymbol(options.class) : null,
        objectType,
        monsterType: speciesObject && corpseMonster && corpseMonster.length > 1 && !noSpecies
            ? find_montype(corpseMonster).type : null,
        monsterClass: corpseMonsterClass,
    };
    // lspo_object() resolves montype before create_object() chooses a
    // coordinate or initializes the object's random attributes.
    let corpseSpecies = objectOptions.monsterType;
    if (objectOptions.monsterClass !== null) {
        corpseSpecies = mkclass(objectOptions.monsterClass, G_NOGEN | G_IGNORE);
        if (corpseSpecies === null)
            throw new Error('Unknown montype');
    }
    const quantity = get_table_int_or_random(objectOptions.quantity, 'quantity', -1);
    const count = objectOptions.objectType !== null && !objectMerge(objectOptions.objectType)
        ? Math.max(1, quantity) : 1;
    let object = null;
    for (let index = 0; index < count; index++) {
        object = await create_object(context, objectOptions, corpseSpecies, parentContainer, parentMonster);
    }
    if (object && objectOptions.contents && typeof objectOptions.contents === 'object')
        await invokeContents(objectOptions.contents, object);
    return object;
}
// C sp_lev.c:get_table_buc(). The buc field's curse-state code: 0 random,
// 1 blessed, 2 uncursed, 3 cursed, 4 not-cursed, 5 not-uncursed,
// 6 not-blessed.
function get_table_buc(buc = 'random') {
    const bucs = new Map([
        ['random', 0], ['blessed', 1], ['uncursed', 2], ['cursed', 3],
        ['not-cursed', 4], ['not-uncursed', 5], ['not-blessed', 6],
    ]);
    const curseState = bucs.get(buc);
    if (curseState === undefined)
        throw new Error(`unsupported Lua buc ${buc}`);
    return curseState;
}
// C sp_lev.c:create_object(). Create one object and apply its level-description attributes.
async function create_object(context, options, corpseSpecies, parentContainer, parentMonster) {
    const { point, objectClass, objectType } = options;
    const allowArtifacts = !options.name;
    let object;
    const randomMedusaStatue = objectType === STATUE
        && game._activeSpecialLevel?.prototype === 'medusa'
        && options.montype == null;
    if (randomMedusaStatue) {
        const location = await get_location_coord(context, point, DRY);
        const statue = await mksobj_at(STATUE, location.x, location.y, true, true);
        // sp_lev.c create_object() empties a `contents=` container (removing any
        // random spellbook) before the Medusa petrified-monster special case
        // moves the temporary actor's inventory into the statue.
        if (Object.hasOwn(options, 'contents'))
            statue.contents = [];
        let mndx = statue.corpsenm ?? null;
        for (let attempt = 0; attempt < 1000; attempt++, mndx = rndmonnum()) {
            const was = await makemon(mndx, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG);
            if (!was)
                continue;
            if (mndx === null)
                throw new Error('Medusa statue monster has no species.');
            // makemon() can change the form; C tests poly_when_stoned(wastyp).
            if (monsterHasStoneResistance(was) || formCanBecomeStoneGolem(mndx)) {
                await removeMonsterFromGame(was);
                continue;
            }
            propagateMonsterSpecies(mndx, true, false);
            statue.corpsenm = mndx;
            await putGeneratedMonsterInventoryInStatue(was, statue);
            await removeMonsterFromGame(was);
            break;
        }
        object = statue;
    }
    else {
        const location = await get_location_coord(context, point, DRY);
        if (!point && location.x === -1 && location.y === -1)
            return null;
        if (objectType !== null)
            object = await mksobj_at(objectType, location.x, location.y, true, allowArtifacts);
        else
            object = await mkobj_at(objectClass ?? RANDOM_CLASS, location.x, location.y, allowArtifacts);
    }
    if (!object)
        return null;
    const spe = get_table_int_or_random(options.spe, 'spe', -127);
    if (spe !== -127) /* That means NOT RANDOM! */
        object.spe = spe;
    switch (options.curseState) {
        case 1: /* blessed */
            blessObjectState(object);
            break;
        case 2: /* uncursed */
            unblessObjectState(object);
            uncurseObjectState(object);
            break;
        case 3: /* cursed */
            curseObjectState(object);
            break;
        case 4: /* not cursed */
            uncurseObjectState(object);
            break;
        case 5: /* not uncursed */
            if (!object.blessed && !object.cursed && !rn2(1)) {
                if (!rn2(2))
                    curseObjectState(object);
                else
                    blessObjectState(object);
            }
            break;
        case 6: /* not blessed */
            unblessObjectState(object);
            break;
        default: /* random */
            break; /* keep what mkobj gave us */
    }
    if (corpseSpecies !== null)
        set_corpsenm(object, corpseSpecies);
    if (options.eroded) {
        if (options.eroded < 0) {
            object.oerodeproof = true;
        }
        else {
            object.oeroded = options.eroded % 4;
            object.oeroded2 = (options.eroded >> 2) % 4;
            object.orotten = object.odiluted = !!object.oeroded;
            object.norevive = !!object.oeroded2;
        }
    }
    else {
        object.oeroded = 0;
        object.oeroded2 = 0;
        object.orotten = object.odiluted = object.norevive = false;
        object.oerodeproof = false;
    }
    if (options.recharged) {
        object.recharged = options.recharged % 8;
        object.on_ice = !!object.recharged;
    }
    if (Object.hasOwn(options, 'trapped'))
        object.otrapped = object.opoisoned = !!options.trapped;
    if (Object.hasOwn(options, 'locked'))
        object.olocked = !!options.locked;
    else if (options.broken) {
        object.obroken = true;
        object.degraded_horn = 1;
        object.olocked = false;
    }
    if (options.trapped !== false && Object.hasOwn(options, 'trap_known'))
        object.tknown = !!options.trap_known;
    object.greased = !!options.greased;
    if (options.name) {
        const artifact = artifactByName(options.name);
        if (artifact?.baseType === object.otyp) {
            if (nameArtifact(object, artifact, { origin: 'lvldef' }) && artifact.questArtifact)
                object.questArtifact = true;
        }
        else {
            object.oextra = {
                ...(object.oextra || {}), oname: String(options.name),
            };
        }
        if (object.otyp === SPE_NOVEL)
            lookupNovelTitle(options.name, object);
    }
    if (options.quantity !== undefined && Number.isInteger(options.quantity) && options.quantity > 0
        && objectMerge(object.otyp)) {
        object.quan = object.quantity = options.quantity;
        object.owt = objectWeight(object);
    }
    if (options.achievement) {
        object.achievement = true;
        object.nomerge = true;
        if (!game.context.achieveo)
            game.context.achieveo = {};
        const prototype = game._activeSpecialLevel?.prototype;
        const prefix = prototype === 'minend' ? 'mines'
            : prototype === 'soko1' ? 'soko' : null;
        if (prefix && !game.context.achieveo[`${prefix}_prize_oid`]) {
            game.context.achieveo[`${prefix}_prize_oid`] = object.o_id;
            game.context.achieveo[`${prefix}_prize_otyp`] = object.otyp;
        }
    }
    if (Object.hasOwn(options, 'contents') && !randomMedusaStatue)
        object.contents = [];
    if (parentContainer) {
        removeFloorObject(object);
        await addObjectToContainer(parentContainer, object, game);
        parentContainer.owt = objectWeight(parentContainer);
    }
    else if (parentMonster) {
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
        if (options.lit)
            beginObjectBurn(object);
        if (options.buried && (await buryObject(object)).outcome === 'absorbed')
            object = null;
    }
    return object;
}
// C sp_lev.c:find_montype(): resolve a monster name, including its male and
// female spellings, with the gender it implies.
export function find_montype(name) {
    const target = String(name).toLowerCase();
    for (let type = 0; type < MONSTER_NAME.length; type++) {
        const neutral = MONSTER_NAME[type]?.toLowerCase();
        if (neutral === target)
            return { type, female: null };
        const male = monsterTypeName(type, false)?.toLowerCase();
        const female = monsterTypeName(type, true)?.toLowerCase();
        if (male !== neutral && male === target)
            return { type, female: false };
        if (female !== neutral && female === target)
            return { type, female: true };
    }
    throw new Error(`unknown Lua monster ${name}`);
}
// C sp_lev.c:get_table_xy_or_coord(): the x/y fields, or the coord table
// when both axes are absent.
export function get_table_xy_or_coord(options) {
    const x = options.x ?? -1;
    const y = options.y ?? -1;
    return x === -1 && y === -1 ? get_coord(options.coord) : { x, y };
}
// C sp_lev.c:get_table_monclass(). The class field's monster class symbol.
// C returns the character itself and create_monster() panics on an unknown
// one; the port resolves the symbol here and rejects it at the boundary.
function get_table_monclass(options) {
    const monsterClass = options.class
        ? MONSTER_CLASS_SYMBOLS.indexOf(options.class) : null;
    if (options.class && (monsterClass == null || monsterClass < 1))
        throw new Error(`unknown Lua monster class ${options.class}`);
    return monsterClass;
}
// C sp_lev.c:get_table_montype(). The id field through find_montype().
function get_table_montype(options) {
    return options.id ? find_montype(options.id) : null;
}
// C sp_lev.c:lspo_monster(). Parse the request, create the monster, then run its custom inventory.
// Also C sp_lev.c:spo_end_moninvent(): inlined here (m_dowear after the
// inventory callback closes).
export async function lspo_monster(context, state, inventories, id, x, y) {
    const options = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1)
            options.class = id;
        else
            options.id = id;
    }
    const monsterClass = get_table_monclass(options);
    const namedMonster = get_table_montype(options);
    let appearance = null;
    if (typeof options.appear_as === 'string') {
        const separator = options.appear_as.indexOf(':');
        if (separator < 1)
            throw new Error(`unknown Lua monster appearance ${options.appear_as}`);
        const kind = options.appear_as.slice(0, separator);
        const name = options.appear_as.slice(separator + 1);
        if (kind === 'obj') {
            appearance = { kind: 'object', type: find_objtype(name) };
        }
        else if (kind === 'mon') {
            appearance = { kind: 'monster', type: find_montype(name).type };
        }
        else if (kind === 'ter') {
            appearance = { kind: 'terrain', name };
        }
        else {
            throw new Error(`unknown Lua monster appearance ${options.appear_as}`);
        }
    }
    const monsterOptions = {
        ...options,
        point: get_table_xy_or_coord(options)
            ?? get_coord(luaArgument(x), luaArgument(y)),
        monsterClass,
        monsterType: namedMonster?.type ?? null,
        nameFemale: namedMonster?.female ?? null,
        appearance,
    };
    const monster = await create_monster(context, monsterOptions);
    if (options.inventory) {
        inventories.push(monster);
        try {
            await state.callValueAsync(options.inventory, []);
        }
        finally {
            inventories.pop();
        }
        if (monster)
            await initializeMonsterArmor(monster);
    }
    return monster;
}
// C sp_lev.c:create_monster()
// Also C priest.c:mk_roamer(): creation is inlined here; priest.ts:finishSpecialRoamer initializes it
// Resolve species and location, then apply the requested attributes.
export async function create_monster(context, options) {
    const { point, monsterClass, monsterType } = options;
    const peaceful = options.peaceful == null ? null : !!options.peaceful;
    const asleep = options.asleep == null ? null : !!options.asleep;
    let mmflags = 0;
    if (options.tail === false)
        mmflags |= MM_NOTAIL;
    if (options.group === false)
        mmflags |= MM_NOGRP;
    if (options.adjacentok)
        mmflags |= MM_ADJACENTOK;
    if (options.ignorewater)
        mmflags |= MM_IGNOREWATER;
    if (options.countbirth === false)
        mmflags |= MM_NOCOUNTBIRTH;
    const spAmask = get_table_align(options.align);
    // Named requests resolve sex before the alignment and species draws.
    const requestedFemale = monsterType !== null && options.nameFemale === null
        && !(is_male(monsterType) || monsterIsFemale(monsterType)) ? !!rn2(2) : null;
    // sp_amask_to_amask() runs for every alignment: the random branch's
    // induced_align(80) draw happens even though its mask is discarded.
    const amask = sp_amask_to_amask(spAmask);
    const alignment = spAmask !== AM_SPLEV_RANDOM ? Amask2align(amask) : null;
    if (alignment !== null)
        mmflags = MM_ADJACENTOK | MM_EMIN | MM_NOMSG;
    let species = monsterType;
    if (species !== null) {
        const vitalFlags = game.mvitals?.[species]?.mvflags ?? 0;
        if (((MONSTER_GENO[species] ?? 0) & 0x1000) && (vitalFlags & G_EXTINCT))
            return null;
        if (vitalFlags & G_GONE)
            species = null;
    }
    else if (monsterClass !== null) {
        species = mkclass(monsterClass, 0x0200);
    }
    const dungeonName = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname;
    const prototype = game._activeSpecialLevel?.prototype;
    const inMines = dungeonName === 'The Gnomish Mines'
        || prototype === 'minefill' || prototype === 'minetn' || prototype === 'minend';
    const race = game.urace?.noun;
    const sameRace = species === null ? false
        : race === 'dwarf' ? is_dwarf(species)
            : race === 'gnome' && is_gnome(species);
    if (inMines && sameRace && rn2(3))
        species = null;
    let location;
    if (species !== null) {
        const humidity = pm_to_humidity(species);
        location = await get_location_coord(context, point, humidity | NO_LOC_WARN);
        if (location.x === -1 && location.y === -1)
            location = await get_location_coord(context, point, humidity | DRY);
        if (location.x === -1 && location.y === -1)
            return null;
    }
    else {
        location = await get_location_coord(context, point, DRY);
        if (monsterType === null && monsterClass === null && !point
            && location.x === -1 && location.y === -1)
            return null;
    }
    let { x, y } = location;
    const level = requireGameLevel();
    if (monsterAtPosition(level, x, y)) {
        const nearby = enexto(species, x, y);
        if (nearby) {
            x = nearby.x;
            y = nearby.y;
        }
    }
    const room = context._room;
    if (room && !insideRoom(level, room, x, y))
        return null;
    const playerMonster = alignment === null && monsterType !== null
        && (point ? species !== null && monsterIsPlayerMonster(species)
            : monsterIsPlayerMonster(monsterType));
    const monster = playerMonster && species !== null
        ? await createPlayerMonster(species, x, y, false)
        : await makemon(species, x, y, mmflags);
    if (monster && requestedFemale !== null)
        monster.female = requestedFemale;
    if (monster && peaceful !== null)
        monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep !== null)
        monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment !== null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    if (monster && options.nameFemale !== null)
        monster.female = options.nameFemale;
    // sp_lev.c:lspo_monster() defaults class and random requests to male.
    // create_monster() restores the requested sex after any initial shape.
    if (monster) {
        const explicitFemale = options.female === true || options.female === 1
            ? true : options.female === false || options.female === 0 ? false : null;
        const requestedFemale = monsterIsFemale(monsterType ?? -1) ? true
            : is_male(monsterType ?? -1) ? false
                : explicitFemale ?? (monsterType == null ? false : !!monster.female);
        const appearance = options.appearance;
        if (appearance && !game.u.protectionFromShapeChangers && !game.protectionFromShapeChangers
            && (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
                || (ismnum(monster.cham) && appearance.kind === 'monster'))) {
            switch (appearance.kind) {
                case 'object':
                    monster.m_ap_type = M_AP_OBJECT;
                    monster.mappearance = appearance.type;
                    break;
                case 'monster': {
                    let type = appearance.type;
                    if (monsterIsVampireShifter(monster)) {
                        const base = monster.cham;
                        if (base === PM_VLAD_THE_IMPALER
                            && monster.minvent?.some(object => object.otyp === CANDELABRUM_OF_INVOCATION)) {
                            type = base;
                        }
                        else if (is_shapeshifter(type)) {
                            if (!ismnum(base))
                                throw new Error('A vampire shape needs its natural species');
                            type = base;
                        }
                        else if (!(type === PM_VAMPIRE_BAT
                            || type === MONSTER_NAME.indexOf('fog cloud')
                            || (type === MONSTER_NAME.indexOf('wolf') && base !== PM_VAMPIRE)))
                            break;
                    }
                    if (type === monster.mnum) {
                        monster.m_ap_type = M_AP_NOTHING;
                        monster.mappearance = 0;
                    }
                    else if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC || monster.iswiz) {
                        monster.m_ap_type = M_AP_MONSTER;
                        monster.mappearance = type;
                    }
                    else {
                        const oldForm = monster.mnum;
                        monster.female = shapechangerGender(monster.cham ?? oldForm, type, !!monster.female);
                        setMonsterSpecies(monster, type);
                        if (monsterEmitsLight(oldForm) !== monsterEmitsLight(type)) {
                            delete monster._lightPosition;
                            if (monsterEmitsLight(type))
                                new_light_source(monster.mx, monster.my, { kind: 'monster', monster }, game);
                            game.vision_full_recalc = 1;
                        }
                        if (!monster.perminvis || oldForm === PM_STALKER || oldForm === PM_BLACK_LIGHT)
                            monster.perminvis = type === PM_STALKER || type === PM_BLACK_LIGHT;
                    }
                    break;
                }
                case 'terrain': {
                    // The appearance stores a defsyms index, rather than a terrain type.
                    const symbol = MAP_SYMBOLS.findIndex(candidate => candidate.name === appearance.name);
                    if (symbol < 0)
                        throw new Error(`unsupported Lua monster appearance ${appearance.name}`);
                    monster.m_ap_type = M_AP_FURNITURE;
                    monster.mappearance = symbol;
                    break;
                }
            }
        }
        monster.female = requestedFemale;
    }
    if (monster && options.name != null)
        setMonsterGivenName(monster, options.name);
    if (monster && peaceful != null) {
        monster.mpeaceful = peaceful ? 1 : 0;
        // sp_lev.c:create_monster() resets kill credit after the Lua override.
        setMonsterMalign(monster);
    }
    if (monster && options.waiting) {
        monster.mstrategy = (monster.mstrategy ?? 0) | STRAT_WAITFORU;
        monster.waiting = true;
        if (monsterIsVampireShifter(monster)
            && monster.mnum !== monster.cham
            && options.appearance?.kind !== 'monster') {
            await changeMonsterForm(monster, monster.cham ?? null);
        }
    }
    if (monster && options.seentraps)
        monster.mtrapseen = options.seentraps;
    if (monster && options.cancelled)
        monster.mcan = 1;
    if (monster && options.revived)
        monster.mrevived = 1;
    if (monster && options.avenge)
        monster.mavenge = 1;
    if (monster && options.stunned)
        monster.mstun = 1;
    if (monster && options.confused)
        monster.mconf = 1;
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
        monster.m_lev = Math.max(0, Math.min(49, monster.m_lev + options.m_lev_adj));
    }
    if (monster && asleep != null)
        monster.msleeping = asleep ? 1 : 0;
    if (monster && (options.inventory || options.keep_default_invent === false)
        && options.keep_default_invent !== true) {
        await dropSpecialMonsterObjects(monster);
        await discardMonsterInventory(monster, true);
    }
    return monster ?? null;
}
// C sp_lev.c:get_traptype_byname(). The named trap type. C's table lookup
// yields NO_TRAP for an unknown name; the Lua boundary reports it instead.
function get_traptype_byname(trapname) {
    const trapType = TRAP_TYPES.get(trapname);
    if (trapType === undefined)
        throw new Error(`unknown Lua trap ${trapname}`);
    return trapType;
}
// C sp_lev.c:get_table_traptype_opt(). The type field of the table form;
// an absent or "random" type is a random trap (NO_TRAP).
function get_table_traptype_opt(options) {
    if (options.type == null || options.type === 'random')
        return NO_TRAP;
    return get_traptype_byname(String(options.type));
}
// C sp_lev.c:lspo_trap(): trap type, placement and construction options.
export async function lspo_trap(context, type, x, y) {
    const options = type instanceof LuaTable
        ? tableOptions(type) : type == null ? {} : { type: String(type) };
    const trapType = get_table_traptype_opt(options);
    const coordinate = get_table_xy_or_coord(options) ?? get_coord(luaArgument(x), luaArgument(y));
    const construction = {
        seen: !!options.seen,
        victim: options.victim !== false,
        spiderOnWeb: options.spider_on_web !== false,
    };
    const trap = await create_trap(context, trapType, construction, coordinate);
    const teleportDestination = options.teledest ? get_table_xy_or_coord({ coord: options.teledest }) : null;
    if (trap && teleportDestination) {
        trap.teledest = {
            x: context.xstart + teleportDestination.x,
            y: context.ystart + teleportDestination.y,
        };
    }
    return trap;
}
// C sp_lev.c:lspo_exclusion(): a teleport or monster-generation exclusion
// zone.
export async function lspo_exclusion(context, value) {
    const options = tableOptions(value, 'terrain', false);
    const type = options.type ?? 'teleport';
    if (type !== 'teleport' && type !== 'teleport-up'
        && type !== 'teleport-down' && type !== 'monster-generation')
        throw new Error(`unsupported Lua exclusion ${type}`);
    if (!options.region)
        throw new TypeError('Lua region requires four coordinates');
    const [x1, y1, x2, y2] = options.region;
    const start = await getPackedLocationCoord(context, { x: x1, y: y1 }, ANY_LOC | NO_LOC_WARN);
    const end = await getPackedLocationCoord(context, { x: x2, y: y2 }, ANY_LOC | NO_LOC_WARN);
    requireGameLevel().exclusionZones.unshift({ type,
        lx: start.x, ly: start.y, hx: end.x, hy: end.y,
    });
}
// C sp_lev.c:levregion_add(): resolves one region rectangle's raw map-relative endpoints, never croom; l_get_lregion() below and its caller append the resolved regions.
async function regionCoordinates(context, coordinates, levelCoordinates) {
    if (!coordinates)
        throw new TypeError('Lua region requires four coordinates');
    const [x1, y1, x2, y2] = coordinates;
    if (levelCoordinates)
        return { lx: x1, ly: y1, hx: x2, hy: y2 };
    const start = await get_location(context, { x: x1, y: y1 }, ANY_LOC);
    const end = await get_location(context, { x: x2, y: y2 }, ANY_LOC);
    return { lx: start.x, ly: start.y, hx: end.x, hy: end.y };
}
// C sp_lev.c:l_get_lregion(): the region and exclude rectangles, keeping an
// absent exclusion off-map.
export async function l_get_lregion(context, options) {
    const region = await regionCoordinates(context, options.region, options.region_islev);
    // l_get_lregion() keeps negative exclusion bounds off-map.
    const exclude = options.exclude ? await regionCoordinates(context, options.exclude, options.exclude[0] < 0 || options.exclude_islev) : null;
    return { region, exclude };
}
// C sp_lev.c:solidify_map(). Unmapped walls become nondiggable.
export function solidify_map(mappedCells) {
    const level = requireGameLevel();
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = level.at(x, y);
            if (location && IS_STWALL(location.typ) && !mappedCells.has(x, y))
                location.wall_info |= W_NONDIGGABLE | W_NONPASSWALL;
        }
    }
}
// C sp_lev.c:map_cleanup(): boulders, most traps and engravings on liquid
// are removed without settling, messages or destruction rolls.
export async function map_cleanup(state = game) {
    const level = requireGameLevel(state);
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const terrain = level.requireAt(x, y).typ;
            if (!IS_LAVA(terrain) && !IS_POOL(terrain))
                continue;
            // This is construction cleanup, so boulders are freed without
            // settling, changing terrain, messages, or destruction rolls.
            for (const object of [...(level.objects[x]?.[y] ?? [])]) {
                if (object.otyp === BOULDER)
                    await deleteObject(object, state);
            }
            const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
            if (trap && trap.ttyp !== MAGIC_PORTAL && trap.ttyp !== VIBRATING_SQUARE)
                deleteTrap(trap, state);
            const engraving = engravingAt(x, y, level);
            if (engraving)
                deleteEngraving(engraving, level);
        }
    }
}
// Part of C sp_lev.c:flip_level(): flip saved Lua region rectangles.
export function flipLuaRegions(active) {
    for (const field of [
        'upTeleportRegion', 'upTeleportExclude',
        'downTeleportRegion', 'downTeleportExclude',
    ]) {
        const region = active[field];
        if (!region)
            continue;
        const flipped = flipSpecialRegion(region);
        if (flipped)
            active[field] = flipped;
    }
    for (const region of active.levelRegions ?? []) {
        region.area = flipSpecialRegion(region.area) ?? region.area;
        if (region.exclude)
            region.exclude = flipSpecialRegion(region.exclude) ?? region.exclude;
    }
}
// C sp_lev.c:floodfillchk_match_under(). The terrain travels with the
// predicate instead of global state.
export function floodfillchk_match_under(x, y, terrain) {
    return game.level?.at?.(x, y)?.typ === terrain;
}
// C sp_lev.c:set_floodfillchk_match_under().
export function set_floodfillchk_match_under(terrain) {
    return (x, y) => floodfillchk_match_under(x, y, terrain);
}
// C sp_lev.c:floodfillchk_match_accessible(): ACCESSIBLE terrain plus
// secret corridors and doors.
function floodfillchk_match_accessible(x, y) {
    const level = requireGameLevel();
    const type = level.at(x, y)?.typ;
    return type !== undefined && (ACCESSIBLE(type) || type === SDOOR || type === SCORR);
}
// Port only: adapt selection flood fill to the accessible-terrain predicate.
function floodAccessibleArea(selection, x, y) {
    selection.floodFill(x, y, true, floodfillchk_match_accessible);
}
// C sp_lev.c:generate_way_out_method(). Secret door, hole or trapdoor, or
// an escape item, in that order.
async function generate_way_out_method(x, y, reachable) {
    const level = requireGameLevel();
    const component = new SpecialSelection();
    floodAccessibleArea(component, x, y);
    const doorCandidates = component.clone();
    for (let point = doorCandidates.randomCoordinate(true); point; point = doorCandidates.randomCoordinate(true)) {
        for (const [wallX, wallY, beyondX, beyondY] of [
            [point.x + 1, point.y, point.x + 2, point.y],
            [point.x - 1, point.y, point.x - 2, point.y],
            [point.x, point.y + 1, point.x, point.y + 2],
            [point.x, point.y - 1, point.x, point.y - 2],
        ]) {
            if (!isok(wallX, wallY) || reachable.has(wallX, wallY)
                || !IS_WALL(level.requireAt(wallX, wallY).typ)
                || !isok(beyondX, beyondY) || !reachable.has(beyondX, beyondY)
                || !ACCESSIBLE(level.requireAt(beyondX, beyondY).typ))
                continue;
            level.requireAt(wallX, wallY).typ = SDOOR;
            return;
        }
    }
    if (canFallThrough()) {
        const trapCandidates = component.clone();
        for (let point = trapCandidates.randomCoordinate(true); point; point = trapCandidates.randomCoordinate(true)) {
            const trap = await maketrap(point.x, point.y, rn2(2) ? HOLE : TRAPDOOR);
            if (trap)
                return;
        }
    }
    const point = component.randomCoordinate();
    if (!point)
        return;
    const escapeItems = [
        PICK_AXE, DWARVISH_MATTOCK, WAN_DIGGING,
        WAN_TELEPORTATION, SCR_TELEPORTATION, RIN_TELEPORTATION,
    ];
    const type = escapeItems[rn2(escapeItems.length)];
    if (type === undefined)
        throw new Error('Missing special-level escape item');
    await mksobj_at(type, point.x, point.y, true, false);
}
// C sp_lev.c:ensure_way_out(). Floods from stairs and holes until every
// accessible spot is reached.
export async function ensure_way_out() {
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
        if (!unreachable)
            return;
        await generate_way_out_method(unreachable.x, unreachable.y, reachable);
        floodAccessibleArea(reachable, unreachable.x, unreachable.y);
    }
}
// Part of C sp_lev.c:create_object(): detach the generated object from its
// square before the container or monster transfer.
export function removeFloorObject(object) {
    if (object?.where === 'floor')
        remove_object(object, game);
}
// Part of C sp_lev.c:create_object(): the container branch —
// add_to_container() after removing the generated object.
export async function addToContainer(container, object) {
    if (!container || !object)
        return object;
    removeFloorObject(object);
    return await addCreatedObjectToContainer(container, object, game);
}
// Part of C sp_lev.c:create_object(): reject stone-resistant Medusa statue species.
export function medusaPetrifiable(mndx) {
    const resistance = mndx == null ? 0 : MONSTER_RESISTS[mndx] || 0;
    const stoneResistant = !!(resistance & 0x80);
    const changesToStoneGolem = mndx != null && monsterIsGolem(mndx) && mndx !== 257;
    return !stoneResistant && !changesToStoneGolem;
}
// Part of C trap.c:mk_trap_statue(), sp_lev.c:create_object(): transfer generated monster gear into a statue.
// C mk_trap_statue and create_object: direct extraction, not unwear_mon_obj.
export async function putGeneratedMonsterInventoryInStatue(monster, statue) {
    while (monster.minvent?.length) {
        const object = monster.minvent[0];
        if (!object)
            throw new Error('Monster inventory contains a missing object.');
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        object.wielded = false;
        unlinkMonsterObject(monster, object);
        await addObjectToContainer(statue, object, game);
    }
    statue.owt = objectWeight(statue);
}
// C sp_lev.c:set_wallprop_in_selection(): apply sel_set_wall_property()
// to every selected square. Also the body of lspo_non_passwall(), which
// negates an absent selection to cover the whole map.
export function set_wallprop_in_selection(selection, property) {
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        if (loc)
            sel_set_wall_property(loc, property);
    });
}
// C sp_lev.c:lspo_wall_property(): the property rectangle, defaulting to
// the map's outline, resolved through get_location() before marking.
export async function lspo_wall_property(context, value) {
    const options = tableOptions(value, 'terrain', true);
    const property = options.property ?? 'nondiggable';
    if (property !== 'nondiggable' && property !== 'nonpasswall')
        throw new TypeError(`Unknown wall property: ${property}`);
    const explicit = [
        options.x1 ?? -1, options.y1 ?? -1, options.x2 ?? -1, options.y2 ?? -1,
    ];
    const useRegion = explicit.every(value => value === -1);
    if (useRegion && !options.region)
        throw new TypeError('des.wall_property requires a rectangle');
    const [x1, y1, x2, y2] = useRegion && options.region ? options.region : explicit;
    const start = await get_location(context, {
        x: x1 === -1 ? context.xstart - 1 : x1,
        y: y1 === -1 ? context.ystart - 1 : y1,
    }, ANY_LOC);
    const end = await get_location(context, {
        x: x2 === -1 ? context.xstart + context.width + 1 : x2,
        y: y2 === -1 ? context.ystart + context.height + 1 : y2,
    }, ANY_LOC);
    const area = new SpecialSelection();
    for (let x = Math.max(1, start.x); x <= Math.min(COLNO - 1, end.x); x++)
        for (let y = Math.max(0, start.y); y <= Math.min(ROWNO - 1, end.y); y++)
            area.add(x, y);
    set_wallprop_in_selection(area, property === 'nondiggable' ? W_NONDIGGABLE : W_NONPASSWALL);
}
// C sp_lev.c:light_region(): light a rectangular area.
function light_region(context, x1, y1, x2, y2, lit) {
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
            if (loc)
                loc.lit = lit || IS_LAVA(loc.typ);
        }
    }
}
// C sp_lev.c:lvlfill_swamp(): the relaxed-blockwise maze swamp.
function lvlfill_swamp(fg = ROOM, bg = MOAT, lit = false) {
    const level = requireGameLevel();
    // sp_lev.c:lvlfill_swamp().  First establish the full moat background,
    // then run the x-major relaxed blockwise maze over even coordinates.
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    lvlfill_solid(bg, lit);
    for (let x = 2; x <= Math.min(mazeXMax, COLNO - 2); x += 2) {
        for (let y = 0; y <= Math.min(mazeYMax, ROWNO - 2); y += 2) {
            setLevelTerrainLit(x, y, fg, lit);
            const east = level.at(x + 1, y);
            const south = level.at(x, y + 1);
            const diagonal = level.at(x + 1, y + 1);
            const untouched = Number(east?.typ === bg)
                + Number(south?.typ === bg)
                + Number(diagonal?.typ === bg);
            if (untouched !== 3)
                continue;
            const chosen = rn2(3);
            if (chosen === 0)
                setLevelTerrainLit(x + 1, y, fg, lit);
            else if (chosen === 1)
                setLevelTerrainLit(x, y + 1, fg, lit);
            else
                setLevelTerrainLit(x + 1, y + 1, fg, lit);
        }
    }
}
// Part of C sp_lev.c:flip_level(): mirror one region and its exclusion rectangle.
function flipSpecialRegion(region) {
    const flip = requireGameLevel()._flip;
    if (!region || !flip)
        return region;
    let { lx, ly, hx, hy } = region;
    if (flip.flp & 2)
        [lx, hx] = [flip.maxx - hx + flip.minx,
            flip.maxx - lx + flip.minx];
    if (flip.flp & 1)
        [ly, hy] = [flip.maxy - hy + flip.miny,
            flip.maxy - ly + flip.miny];
    const result = { ...region, lx, ly, hx, hy };
    if (region.nlx != null) {
        let { nlx, nly, nhx, nhy } = region;
        if (nly === undefined || nhx === undefined || nhy === undefined)
            throw new Error('Flipped stair region has an incomplete exclusion rectangle.');
        if (flip.flp & 2)
            [nlx, nhx] = [
                flip.maxx - nhx + flip.minx,
                flip.maxx - nlx + flip.minx,
            ];
        if (flip.flp & 1)
            [nly, nhy] = [
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
// C sp_lev.c:fill_special_room(). Fill subrooms before their parent.
export async function fill_special_room(croom) {
    const level = requireGameLevel();
    if (!croom)
        return;
    for (const subroom of croom.sbrooms || [])
        await fill_special_room(subroom);
    if (croom.rtype === OROOM || croom.rtype === THEMEROOM
        || croom.needfill === FILL_NONE)
        return;
    if (croom.needfill === FILL_NORMAL) {
        if (croom.rtype >= SHOPBASE)
            await stockShopRoom(croom);
        else if (croom.rtype === VAULT)
            await fillVault(croom);
        else if (croom.rtype === COURT)
            await fillCourtRoom(croom);
        else if ([ZOO, LEPREHALL, COCKNEST, ANTHOLE].includes(croom.rtype))
            await fillZooRoom(croom);
        else if (croom.rtype === BEEHIVE)
            await fillBeehiveRoom(croom);
        else if (croom.rtype === MORGUE)
            await fillMorgueRoom(croom);
        else if (croom.rtype === BARRACKS)
            await fillBarracksRoom(croom);
    }
    // FILL_LVFLAGS suppresses stocking but still publishes the special-room
    // level flag; FILL_NORMAL constructors above publish the same flag.
    if (croom.rtype === VAULT)
        level.flags.has_vault = true;
    else if (croom.rtype === COURT)
        level.flags.has_court = true;
    else if (croom.rtype === ZOO)
        level.flags.has_zoo = true;
    else if (croom.rtype === BEEHIVE)
        level.flags.has_beehive = true;
    else if (croom.rtype === MORGUE)
        level.flags.has_morgue = true;
    else if (croom.rtype === BARRACKS)
        level.flags.has_barracks = true;
    else if (croom.rtype === TEMPLE)
        level.flags.has_temple = true;
    else if (croom.rtype === SWAMP)
        level.flags.has_swamp = true;
}
// Port only: collect coordinates in Lua selection iteration order.
export function luaSelectionCoordinates(selection) {
    const coordinates = [];
    selection.forEachLua((x, y) => coordinates.push({ x, y }));
    return coordinates;
}
// C sp_lev.c:check_room()
export function check_room(lowx, ddx, lowy, ddy, vault) {
    const map = requireGameLevel();
    let hix = lowx.v + ddx.v, hiy = lowy.v + ddy.v;
    const xlim = XLIM + (vault ? 1 : 0);
    const ylim = YLIM + (vault ? 1 : 0);
    const s_lowx = lowx.v, s_ddx = ddx.v;
    const s_lowy = lowy.v, s_ddy = ddy.v;
    if (lowx.v < 3)
        lowx.v = 3;
    if (lowy.v < 2)
        lowy.v = 2;
    if (hix > COLNO - 3)
        hix = COLNO - 3;
    if (hiy > ROWNO - 3)
        hiy = ROWNO - 3;
    for (;;) {
        if (hix <= lowx.v || hiy <= lowy.v)
            return false;
        if (game.in_mk_themerooms
            && s_lowx !== lowx.v && s_ddx !== ddx.v
            && s_lowy !== lowy.v && s_ddy !== ddy.v) {
            return false;
        }
        let retry = false;
        for (let x = lowx.v - xlim; x <= hix + xlim && !retry; x++) {
            if (x <= 0 || x >= COLNO)
                continue;
            let y = Math.max(lowy.v - ylim, 0);
            const ymax = Math.min(hiy + ylim, ROWNO - 1);
            for (; y <= ymax; y++) {
                const loc = map.at(x, y);
                if (loc && loc.typ !== STONE) {
                    if (!rn2(3))
                        return false;
                    if (game.in_mk_themerooms)
                        return false;
                    if (x < lowx.v)
                        lowx.v = x + xlim + 1;
                    else
                        hix = x - xlim - 1;
                    if (y < lowy.v)
                        lowy.v = y + ylim + 1;
                    else
                        hiy = y - ylim - 1;
                    retry = true;
                    break;
                }
            }
        }
        if (!retry)
            break;
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
// C sp_lev.c:create_room()
export function create_room(x, y, w, h, xal, yal, rtype, rlit) {
    const g = game;
    const level = requireGameLevel();
    let xabs = 0, yabs = 0;
    let r1 = null, r2 = null;
    let wtmp = w, htmp = h;
    let trycnt = 0;
    let vault = false;
    let xlim = XLIM, ylim = YLIM;
    if (rtype === -1)
        rtype = OROOM;
    if (rtype === VAULT) {
        vault = true;
        xlim++;
        ylim++;
    }
    rlit = litstate_rnd(rlit);
    do {
        wtmp = w;
        htmp = h;
        let xtmp = x, ytmp = y;
        let xaltmp = xal, yaltmp = yal;
        if ((xtmp < 0 && ytmp < 0 && wtmp < 0 && xaltmp < 0 && yaltmp < 0) || vault) {
            r1 = rnd_rect();
            if (!r1)
                return false;
            const hx = r1.hx, hy = r1.hy, lx = r1.lx, ly = r1.ly;
            let dx, dy;
            if (vault) {
                dx = dy = 1;
            }
            else {
                dx = 2 + rn2((hx - lx > 28) ? 12 : 8);
                dy = 2 + rn2(4);
                if (dx * dy > 50)
                    dy = Math.trunc(50 / dx);
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
                if (level.nroom < 4 && dy > 1)
                    dy--;
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
        }
        else {
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
            if (xaltmp < 0)
                xaltmp = rnd(3);
            if (yaltmp < 0)
                yaltmp = rnd(3);
            xabs = Math.trunc(((xtmp - 1) * COLNO) / 5) + 1;
            yabs = Math.trunc(((ytmp - 1) * ROWNO) / 5) + 1;
            if (xaltmp === 5)
                xabs += Math.trunc(COLNO / 5) - wtmp;
            else if (xaltmp === 3)
                xabs += Math.trunc((Math.trunc(COLNO / 5) - wtmp) / 2);
            if (yaltmp === 5)
                yabs += Math.trunc(ROWNO / 5) - htmp;
            else if (yaltmp === 3)
                yabs += Math.trunc((Math.trunc(ROWNO / 5) - htmp) / 2);
            if (xabs + wtmp - 1 > COLNO - 2)
                xabs = COLNO - wtmp - 3;
            if (xabs < 2)
                xabs = 2;
            if (yabs + htmp - 1 > ROWNO - 2)
                yabs = ROWNO - htmp - 3;
            if (yabs < 2)
                yabs = 2;
            r2 = {
                lx: xabs - 1, ly: yabs - 1,
                hx: xabs + wtmp + rndpos,
                hy: yabs + htmp + rndpos,
            };
            r1 = get_rect(r2);
            const lowx = { v: xabs }, ddx = { v: wtmp };
            const lowy = { v: yabs }, ddy = { v: htmp };
            if (r1 && !check_room(lowx, ddx, lowy, ddy, vault))
                r1 = null;
            xabs = lowx.v;
            yabs = lowy.v;
        }
    } while (++trycnt <= 100 && !r1);
    if (!r1)
        return false;
    if (!r2)
        throw new Error('Room placement did not choose a rectangle.');
    split_rects(r1, r2);
    if (!vault) {
        if (!g.smeq)
            throw new Error('Room placement requires initialized room equivalence.');
        g.smeq[level.nroom] = level.nroom;
        add_room(xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1, rlit, rtype, false);
    }
    else {
        level.rooms[level.nroom] = { ...level.rooms[level.nroom], lx: xabs, ly: yabs };
    }
    return true;
}
// C sp_lev.c:create_subroom()
function create_subroom(proom, x, y, w, h, rtype, rlit) {
    const width = proom.hx - proom.lx + 1;
    const height = proom.hy - proom.ly + 1;
    if (width < 4 || height < 4)
        return null;
    if (w < 0)
        w = rnd(width - 3);
    if (h < 0)
        h = rnd(height - 3);
    if (x < 0)
        x = rnd(width - w);
    if (y < 0)
        y = rnd(height - h);
    if (x === 1)
        x = 0;
    if (y === 1)
        y = 0;
    if (x + w + 1 === width)
        x++;
    if (y + h + 1 === height)
        y++;
    if (rtype < 0)
        rtype = OROOM;
    rlit = litstate_rnd(rlit);
    return add_subroom(proom, proom.lx + x, proom.ly + y, proom.lx + x + w - 1, proom.ly + y + h - 1, rlit, rtype, false);
}
// C sp_lev.c:dig_corridor()
export async function dig_corridor(org, dest, npoints_out, nxcor, ftyp, btyp) {
    const map = requireGameLevel();
    let dx = 0, dy = 0;
    let xx = org.x, yy = org.y;
    const tx = dest.x, ty = dest.y;
    let npoints = 0;
    if (npoints_out)
        npoints_out.v = 0;
    if (xx <= 0 || yy <= 0 || tx <= 0 || ty <= 0
        || xx > COLNO - 1 || tx > COLNO - 1 || yy > ROWNO - 1 || ty > ROWNO - 1)
        return false;
    if (tx > xx)
        dx = 1;
    else if (ty > yy)
        dy = 1;
    else if (tx < xx)
        dx = -1;
    else
        dy = -1;
    xx -= dx;
    yy -= dy;
    let cct = 0;
    while (xx !== tx || yy !== ty) {
        if (cct++ > 500 || (nxcor && !rn2(35)))
            return false;
        xx += dx;
        yy += dy;
        if (xx >= COLNO - 1 || xx <= 0 || yy <= 0 || yy >= ROWNO - 1)
            return false;
        const crm = map.at(xx, yy);
        if (!crm)
            return false;
        if (crm.typ === btyp) {
            if (ftyp === CORR && maybe_sdoor(100)) {
                npoints++;
                if (npoints_out)
                    npoints_out.v = npoints;
                crm.typ = SCORR;
            }
            else {
                npoints++;
                if (npoints_out)
                    npoints_out.v = npoints;
                crm.typ = ftyp;
                if (nxcor && !rn2(50)) {
                    await mksobj_at(BOULDER, xx, yy, true, false);
                }
            }
        }
        else if (crm.typ !== ftyp && crm.typ !== SCORR) {
            return false;
        }
        let dix = Math.abs(xx - tx);
        let diy = Math.abs(yy - ty);
        if ((dix > diy) && diy && !rn2(dix - diy + 1))
            dix = 0;
        else if ((diy > dix) && dix && !rn2(diy - dix + 1))
            diy = 0;
        if (dy && dix > diy) {
            const ddx = (xx > tx) ? -1 : 1;
            const ncr = map.at(xx + ddx, yy);
            if (ncr && (ncr.typ === btyp || ncr.typ === ftyp || ncr.typ === SCORR)) {
                dx = ddx;
                dy = 0;
                continue;
            }
        }
        else if (dx && diy > dix) {
            const ddy = (yy > ty) ? -1 : 1;
            const ncr = map.at(xx, yy + ddy);
            if (ncr && (ncr.typ === btyp || ncr.typ === ftyp || ncr.typ === SCORR)) {
                dy = ddy;
                dx = 0;
                continue;
            }
        }
        const straight = map.at(xx + dx, yy + dy);
        if (straight && (straight.typ === btyp || straight.typ === ftyp || straight.typ === SCORR))
            continue;
        if (dx) {
            dx = 0;
            dy = (ty < yy) ? -1 : 1;
        }
        else {
            dy = 0;
            dx = (tx < xx) ? -1 : 1;
        }
        const alt = map.at(xx + dx, yy + dy);
        if (alt && (alt.typ === btyp || alt.typ === ftyp || alt.typ === SCORR))
            continue;
        dy = -dy;
        dx = -dx;
    }
    if (npoints_out)
        npoints_out.v = npoints;
    return true;
}
// C sp_lev.c:wallify_map()
// This is the producer half of Lua's
// des.wallify(): turn solid rock touching room terrain (including diagonals)
// into a provisional straight wall.  The ordinary wallification pass below
// then resolves corners and junctions.  Iterate y-major to preserve C's
// mutation order, although newly created walls do not themselves propagate.
// Shape bordering stone into walls.
export function wallify_map(x1, y1, x2, y2) {
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
            if (loc?.typ !== STONE)
                continue;
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
            }
        }
    }
}
// C sp_lev.c:lspo_terrain(). Read a coordinate or selection, then change the selected terrain.
export async function lspo_terrain(context, args) {
    let coordinate = null;
    let selection = null;
    let character;
    let lit = -2;
    if (args.length === 3) {
        coordinate = { x: luaInteger(args[0]), y: luaInteger(args[1]) };
        character = String(args[2]);
    }
    else if (args[0] instanceof LuaTable) {
        const options = tableOptions(args[0]);
        const location = get_table_xy_or_coord(options) ?? get_coord(luaArgument(args[0]));
        const type = args.length === 1 ? options.typ : args[1];
        if (location && type != null) {
            coordinate = location;
            character = String(type);
            lit = options.lit ?? -2;
        }
        else if (options.selection != null && type != null) {
            selection = unwrapSelection(options.selection);
            character = String(type);
            lit = options.lit ?? -2;
        }
        else {
            selection = unwrapSelection(args[0]);
            character = String(args[1]);
        }
    }
    else {
        selection = unwrapSelection(args[0]);
        character = String(args[1]);
    }
    const type = mapCharacterType(character);
    if (type === undefined)
        throw new Error(`unknown Lua terrain ${character}`);
    if (coordinate) {
        const location = await getPackedLocationCoord(context, coordinate, ANY_LOC);
        if (!isok(location.x, location.y))
            throw new TypeError('terrain coord not ok');
        sel_set_ter(location.x, location.y, type, lit);
    }
    else if (selection) {
        selection.forEachXMajor((x, y) => sel_set_ter(x, y, type, lit));
    }
}
// C sp_lev.c:lspo_wallify(). Default omitted bounds to the current map outline.
export function lspo_wallify(map, value) {
    const options = value == null ? null : tableOptions(value);
    const x1 = options?.x1 ?? -1, y1 = options?.y1 ?? -1;
    const x2 = options?.x2 ?? -1, y2 = options?.y2 ?? -1;
    wallify_map(x1 < 0 ? map.xstart - 1 : x1, y1 < 0 ? map.ystart - 1 : y1, x2 < 0 ? map.xstart + map.width + 1 : x2, y2 < 0 ? map.ystart + map.height + 1 : y2);
}
// C sp_lev.c:lspo_finalize_level(). Finish construction before level fixups and room filling.
export async function lspo_finalize_level(active, mappedCells) {
    link_doors_rooms();
    remove_boundary_syms(mappedCells);
    if (active.checkInaccessibles)
        await ensure_way_out();
    await map_cleanup();
    if (!requireGameLevel().flags.corrmaze)
        wallification(1, 0, COLNO - 1, ROWNO - 1);
    const allowedFlips = active.allowFlips;
    if (allowedFlips === undefined)
        throw new Error('Lua level flip flags are uninitialized');
    await flip_level_rnd(allowedFlips);
    countLevelFeatures();
    if (active.solidify)
        solidify_map(mappedCells);
    flipLuaRegions(active);
}
// C sp_lev.c:lspo_map(). Place the map, retain its selected cells, and run its contents in that coordinate frame.
export async function lspo_map(scope, active, state, wholeLevel, mappedCells, input) {
    const value = input instanceof LuaTable ? tableOptions(input, 'boolean') : String(input);
    const source = typeof value === 'string' ? value : value.map;
    if (source === undefined)
        throw new TypeError('des.map requires map text');
    // lspo_map() defaults to unlit in both forms, independently of
    // the lighting des.level_init() gave the underlying level.
    const lit = typeof value !== 'string' && !!value.lit;
    const rows = source.split('\n');
    if (rows.at(-1) === '')
        rows.pop();
    const width = Math.max(...rows.map(row => row.length));
    const unplacedThemedMap = active.prototype === 'themerms'
        && typeof value !== 'string'
        && value.x == null && value.y == null
        && value.coord == null
        && value.halign == null && value.valign == null;
    let mapContext;
    if (unplacedThemedMap) {
        const level = requireGameLevel();
        const height = rows.length;
        const terrainTypes = {
            '.': ROOM, '-': HWALL, '|': VWALL, L: LAVAPOOL, P: POOL, '}': MOAT, ' ': STONE,
        };
        let xstart = 0, ystart = 0;
        for (let tryct = 0; tryct <= 100; tryct++) {
            xstart = 1 + rn2(COLNO - 1 - width);
            ystart = rn2(ROWNO - height);
            let fits = true;
            for (let y = ystart - 1; y <= ystart + height && fits; y++) {
                for (let x = xstart - 1; x <= xstart + width; x++) {
                    if (!isok(x, y)) {
                        fits = false;
                        break;
                    }
                    const loc = game.level?.at(x, y);
                    if (!loc) {
                        fits = false;
                        break;
                    }
                    const outside = x < xstart || x >= xstart + width
                        || y < ystart || y >= ystart + height;
                    if (outside) {
                        if (loc.typ !== STONE || loc.roomno) {
                            fits = false;
                            break;
                        }
                        continue;
                    }
                    const terrain = terrainTypes[rows[y - ystart]?.[x - xstart] ?? 'x'];
                    if (terrain == null)
                        continue;
                    if ((loc.typ !== STONE && loc.typ !== terrain) || loc.roomno) {
                        fits = false;
                        break;
                    }
                }
            }
            if (fits)
                break;
            if (tryct === 100) {
                scope.roomFailed = true;
                return new SpecialSelection();
            }
        }
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const terrain = terrainTypes[rows[row]?.[col] ?? 'x'];
                if (terrain == null)
                    continue;
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
        mapContext = { xstart, ystart, width, height };
    }
    else {
        const options = typeof value === 'string' ? { halign: 'center', valign: 'center' } : value;
        const height = rows.length;
        const levelInitialized = !!active.levelInitialized;
        const coordinate = get_table_xy_or_coord(options);
        if (coordinate && coordinate.x >= 0 && coordinate.y >= 0) {
            mapContext = { xstart: coordinate.x, ystart: coordinate.y, width, height };
        }
        else {
            const mazeMaxX = (COLNO - 1) & ~1;
            const mazeMaxY = (ROWNO - 1) & ~1;
            const horizontal = {
                left: levelInitialized ? 1 : 3,
                'half-left': 2 + Math.trunc((mazeMaxX - 2 - width) / 4),
                center: 2 + Math.trunc((mazeMaxX - 2 - width) / 2),
                'half-right': 2 + Math.trunc((mazeMaxX - 2 - width) * 3 / 4),
                right: mazeMaxX - width - 1,
            };
            const vertical = {
                top: 3,
                center: 2 + Math.trunc((mazeMaxY - 2 - height) / 2),
                bottom: mazeMaxY - height - 1,
            };
            let xstart = horizontal[options.halign ?? ''];
            let ystart = vertical[options.valign ?? ''];
            if (xstart === undefined || ystart === undefined
                || !Number.isInteger(xstart) || !Number.isInteger(ystart))
                throw new Error('Lua map needs coordinates or horizontal and vertical alignment');
            if (!(xstart % 2))
                xstart++;
            if (!(ystart % 2))
                ystart++;
            if (ystart < 0 || ystart + height > ROWNO) {
                ystart += ystart > 0 ? -2 : 2;
                if (height === ROWNO)
                    ystart = 0;
                if (ystart < 0 || ystart + height > ROWNO)
                    ystart = 0;
            }
            mapContext = { xstart, ystart, width, height };
        }
        const level = requireGameLevel();
        for (const [dy, sourceRow] of rows.entries()) {
            const row = sourceRow.padEnd(width, ' ');
            for (let dx = 0; dx < width; dx++) {
                // `x` is NetHack's INVALID_TYPE map glyph: it is transparent and
                // preserves the terrain established by level_init.
                if (row[dx] === 'x')
                    continue;
                const loc = level.at(mapContext.xstart + dx, mapContext.ystart + dy);
                // lspo_map() clips a fragment at COLNO/ROWNO while retaining its
                // declared coordinate frame.  water.lua deliberately supplies an
                // 80-column fragment beginning at column one, so its last source
                // column lies beyond NetHack's usable map and is ignored.
                if (!loc)
                    continue;
                loc.lit = lit;
                loc.horizontal = row[dx] === '-';
                if (row[dx] === '.')
                    loc.typ = ROOM;
                else if (row[dx] === '#')
                    loc.typ = CORR;
                else if (row[dx] === '-')
                    loc.typ = HWALL;
                else if (row[dx] === '|')
                    loc.typ = VWALL;
                else if (row[dx] === '+') {
                    loc.typ = DOOR;
                    loc.doormask = D_NODOOR;
                }
                else if (row[dx] === 'S') {
                    loc.typ = SDOOR;
                    loc.doormask = D_CLOSED;
                }
                else if (row[dx] === 'F')
                    loc.typ = IRONBARS;
                else if (row[dx] === 'B')
                    loc.typ = CROSSWALL;
                else if (row[dx] === 'P')
                    loc.typ = POOL;
                else if (row[dx] === 'I')
                    setLevelTerrainType(mapContext.xstart + dx, mapContext.ystart + dy, ICE);
                else if (row[dx] === '{')
                    loc.typ = FOUNTAIN;
                else if (row[dx] === '}')
                    loc.typ = MOAT;
                else if (row[dx] === 'W')
                    loc.typ = WATER;
                else if (row[dx] === 'A')
                    loc.typ = AIR;
                else if (row[dx] === 'L') {
                    loc.typ = LAVAPOOL;
                    loc.lit = true;
                }
                else if (row[dx] === 'Z') {
                    loc.typ = LAVAWALL;
                    loc.lit = true;
                }
                else if (row[dx] === 'C')
                    loc.typ = CLOUD;
                else if (row[dx] === 'T')
                    loc.typ = TREE;
                else if (row[dx] === '\\')
                    loc.typ = THRONE;
                else
                    loc.typ = STONE;
            }
        }
        // sp_lev.c orients mapped doors only after the whole fragment exists, so
        // neighboring walls and other doors are all available to the decision.
        for (const [dy, sourceRow] of rows.entries()) {
            const row = sourceRow.padEnd(width, ' ');
            for (let dx = 0; dx < width; dx++) {
                if (row[dx] !== '+' && row[dx] !== 'S')
                    continue;
                const loc = level.at(mapContext.xstart + dx, mapContext.ystart + dy);
                if (!loc)
                    continue;
                sel_set_door(mapContext, loc.doormask, dx, dy);
            }
        }
    }
    const selection = new SpecialSelection();
    for (let dy = 0; dy < mapContext.height; dy++) {
        const row = rows?.[dy]?.padEnd(mapContext.width, ' ');
        for (let dx = 0; dx < mapContext.width; dx++) {
            if (row?.[dx] === 'x')
                continue;
            selection.add(mapContext.xstart + dx, mapContext.ystart + dy);
        }
    }
    const mapSelection = selection;
    mapSelection.forEachXMajor((x, y) => mappedCells.add(x, y));
    scope.context = mapContext;
    active.context = scope.context;
    if (typeof value !== 'string' && value.contents) {
        try {
            await state.callValueAsync(value.contents, [
                objectToLuaTable({
                    width: scope.context.width, height: scope.context.height,
                }),
            ]);
        }
        finally {
            scope.context = wholeLevel;
            active.context = scope.context;
        }
    }
    return mapSelection;
}
// C sp_lev.c:lspo_message().
export async function lspo_message(active, value) {
    const messages = active.specialMessages ??= [];
    const originalAlignment = game.u?.ualignbase?.[0]
        ?? game.u?.ualign?.type ?? A_NONE;
    const godKey = originalAlignment > 0 ? 'lawful'
        : originalAlignment < 0 ? 'chaotic' : 'neutral';
    const deity = game.urole?.gods?.[godKey] || 'your god';
    messages.push(String(value).replaceAll('%d', deity));
}
// C sp_lev.c:lspo_grave().
export async function lspo_grave(context, value, y, text) {
    const fields = value instanceof LuaTable ? tableOptions(value) : {};
    const options = {
        ...fields, ...(text == null ? {} : { text: String(text) }),
        point: get_table_xy_or_coord(fields) ?? get_coord(luaArgument(value), luaArgument(y)),
    };
    const point = await get_location_coord(context, options.point, DRY);
    const level = requireGameLevel();
    if (!isok(point.x, point.y) || trapAt(game, point.x, point.y))
        return;
    level.requireAt(point.x, point.y).typ = GRAVE;
    make_grave(point.x, point.y, options.text ?? null);
}
// C sp_lev.c:lspo_teleport_region().
export async function lspo_teleport_region(context, active, value) {
    const options = tableOptions(value);
    const { region, exclude } = await l_get_lregion(context, options);
    if (options.dir === 'up') {
        active.upTeleportRegion = region;
        active.upTeleportExclude = exclude;
    }
    else if (options.dir === 'down') {
        active.downTeleportRegion = region;
        active.downTeleportExclude = exclude;
    }
    else {
        active.upTeleportRegion = { ...region };
        active.downTeleportRegion = { ...region };
        active.upTeleportExclude = exclude ? { ...exclude } : null;
        active.downTeleportExclude = exclude ? { ...exclude } : null;
    }
}
// C sp_lev.c:lspo_levregion().
export async function lspo_levregion(context, active, value) {
    const options = tableOptions(value);
    const { region, exclude } = await l_get_lregion(context, options);
    const type = options.type;
    if (type !== 'stair-up' && type !== 'stair-down' && type !== 'branch' && type !== 'portal')
        throw new Error(`unsupported Lua level region ${type}`);
    active.levelRegions ??= [];
    active.levelRegions.push({ type, area: region, exclude,
        ...(options.name === undefined ? {} : { destination: options.name }),
    });
}
// C sp_lev.c:lspo_gas_cloud().
export async function lspo_gas_cloud(value) {
    const fields = tableOptions(value);
    const options = {
        ...fields, point: get_table_xy_or_coord(fields),
        selection: fields.selection == null ? null : unwrapSelection(fields.selection),
    };
    const coordinate = options.point;
    const point = coordinate?.x === -1 && coordinate.y === -1 ? null : coordinate;
    const damage = options.damage ?? 0;
    const cloud = point
        ? await createPoisonGasCloud(game, point.x, point.y, 1, damage)
        : options.selection ? await createGasCloudSelection(game, luaSelectionCoordinates(options.selection), -1, damage) : null;
    if (!cloud)
        throw new TypeError('des.gas_cloud requires a coordinate or selection');
    cloud.heroFault = !game.in_mklev && !game.context.mon_moving;
    if (options.ttl !== undefined && options.ttl > -2)
        cloud.ttl = options.ttl;
    return cloud;
}
// C sp_lev.c:lspo_level_init(). Read the initialization table before dispatching its style.
export async function lspo_level_init(value, active) {
    await splev_initlev(tableOptions(value, 'boolean'), active);
}
// C sp_lev.c:lspo_corridor().
export async function lspo_corridor(value) {
    await create_corridor(tableOptions(value));
}
// C sp_lev.c:lspo_random_corridors().
export async function lspo_random_corridors() {
    await makecorridors();
}
// C sp_lev.c:lspo_mineralize().
export async function lspo_mineralize(value) {
    const options = value === undefined ? {} : tableOptions(value);
    await mineralize(options.kelp_pool ?? -1, options.kelp_moat ?? -1, options.gold_prob ?? -1, options.gem_prob ?? -1, true);
}
// C sp_lev.c:lvlfill_maze_grid()
// Fill the maze rectangle with the wall-and-pillar lattice level_init uses.
// C sp_lev.c:lvlfill_maze_grid(): stone everywhere in corridor mazes, and
// a (y < 2 || odd x, odd y) lattice otherwise.
function lvlfill_maze_grid(filling = HWALL) {
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
// C sp_lev.c:get_room_loc(). Resolve a relative room point or choose a random room square.
function get_room_loc(coordinate, room) {
    const point = { ...coordinate };
    if (point.x < 0 && point.y < 0) {
        if (!somexy(room, point))
            throw new Error("get_room_loc: can't find a place!");
    }
    else {
        if (point.x < 0)
            point.x = rn2(room.hx - room.lx + 1);
        if (point.y < 0)
            point.y = rn2(room.hy - room.ly + 1);
        point.x += room.lx;
        point.y += room.ly;
    }
    return point;
}
// C sp_lev.c:lspo_non_passwall(). An absent selection covers the whole map.
export function lspo_non_passwall(selection) {
    set_wallprop_in_selection(selection ?? new SpecialSelection().negate(), W_NONPASSWALL);
}
// C sp_lev.c:reset_xystart_size(). The whole-level rectangle: xstart 1
// (column 0 is off limits), ystart 0, and the playable extents.
export function reset_xystart_size() {
    return {
        xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
    };
}
// C sp_lev.c:sp_level_coder_init(). Create the per-level room, inventory, and map state.
// Also C sp_lev.c:create_des_coder(): the lazy coder allocation; every Lua
// session builds its coder state directly here.
function sp_level_coder_init() {
    const wholeLevel = reset_xystart_size();
    let active = null;
    const roomScope = { context: wholeLevel, roomFailed: false };
    let luaState = null;
    const containers = [];
    const monsterInventories = [];
    let mappedCells = new SpecialSelection();
    const currentLevel = () => {
        if (!active)
            throw new Error('Lua level generation has not started');
        return active;
    };
    const currentState = () => {
        if (!luaState)
            throw new Error('Lua level generation has no bound state');
        return luaState;
    };
    // Also C sp_lev.c:spo_pop_container(): inlined here in the finally block.
    const invokeObjectContents = async (callback, object) => {
        containers.push(object);
        try {
            await currentState().callValueAsync(callback, [currentState().objects.wrap(object)]);
        }
        finally {
            containers.pop();
        }
    };
    const operations = {
        levelInit: value => lspo_level_init(value, currentLevel()),
        levelFlags: flags => lspo_level_flags(currentLevel(), flags),
        message: value => lspo_message(currentLevel(), value),
        map: value => lspo_map(roomScope, currentLevel(), currentState(), wholeLevel, mappedCells, value),
        terrain: (...args) => lspo_terrain(roomScope.context, args),
        replaceTerrain: options => lspo_replace_terrain(roomScope.context, options),
        region: (selection, lighting) => lspo_region(roomScope, currentLevel().context ?? wholeLevel, currentState(), selection, lighting),
        roomRegion: options => lspo_region(roomScope, currentLevel().context ?? wholeLevel, currentState(), options),
        room: options => lspo_room(roomScope, currentLevel(), currentState(), options),
        stair: (direction, x, y) => lspo_stair(roomScope.context, mappedCells, direction, x, y),
        ladder: (direction, x, y) => lspo_ladder(roomScope.context, mappedCells, direction, x, y),
        door: async (state, x, y) => {
            const point = await lspo_door(roomScope.context, state, x, y);
            if (point)
                mappedCells.add(point.x, point.y);
        },
        drawbridge: async (options) => {
            const point = await lspo_drawbridge(roomScope.context, options);
            mappedCells.add(point.x, point.y);
        },
        engraving: (value, type, text) => lspo_engraving(roomScope.context, value, type, text),
        gold: (value, x, y) => lspo_gold(roomScope.context, value, x, y),
        grave: (value, y, text) => lspo_grave(roomScope.context, value, y, text),
        feature: (value, x, y) => lspo_feature(roomScope.context, value, x, y),
        altar: options => lspo_altar(roomScope.context, options),
        nonDiggable: lspo_non_diggable,
        nonPasswall: lspo_non_passwall,
        wallProperty: options => lspo_wall_property(currentLevel().context ?? wholeLevel, options),
        wallify: options => lspo_wallify(currentLevel().context ?? wholeLevel, options),
        teleportRegion: value => lspo_teleport_region(currentLevel().context ?? wholeLevel, currentLevel(), value),
        levelRegion: value => lspo_levregion(currentLevel().context ?? wholeLevel, currentLevel(), value),
        exclusion: options => lspo_exclusion(roomScope.context, options),
        gasCloud: lspo_gas_cloud,
        randomCorridors: lspo_random_corridors,
        corridor: lspo_corridor,
        mineralize: lspo_mineralize,
        mazeWalk: (value, y, direction) => lspo_mazewalk(roomScope.context, mappedCells, value, y, direction),
        object: async (id, x, y) => currentState().objects.wrap(await lspo_object(roomScope.context, containers.at(-1) ?? null, monsterInventories.at(-1) ?? null, invokeObjectContents, id, x, y)),
        trap: (type, x, y) => lspo_trap(roomScope.context, type, x, y),
        monster: (id, x, y) => lspo_monster(roomScope.context, currentState(), monsterInventories, id, x, y),
    };
    const selectionApi = createSelectionApi(() => roomScope.context, async (callable, args) => {
        const state = currentState();
        try {
            await state.callValueAsync(callable, args);
            return true;
        }
        catch (error) {
            if (error instanceof PanicTermination)
                throw error;
            const detail = state.traceback.format(error);
            await impossible(`Lua error: ${state.sid}:l_selection_iterate ${detail}`);
            return false;
        }
    });
    const bindings = {
        nh: {
            debug_themerm: (...args) => {
                if (args.length !== 1)
                    throw new NethackLuaError('debug_themerm should have 1 boolean arg');
                return null;
            },
            is_genocided: (...args) => {
                if (args.length !== 1)
                    throw new NethackLuaError('Wrong args');
                // C nhl_is_genocided() resolves names with name_to_mon(),
                // which accepts articles, plurals, and alternate spellings.
                const mndx = nameToMonster(luaCheckString(1, args[0]));
                return mndx >= 0
                    && !!((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GENOD);
            },
            level_difficulty: (...args) => {
                if (args.length)
                    throw new NethackLuaError('level_difficulty should not have any args');
                return level_difficulty();
            },
            // nhl_timer_start_at() is startTimerAt() in lua/lifecycle.ts;
            // the binding reads this scope's room coordinates at call time.
            start_timer_at: (...args) => startTimerAt(roomScope.context.xstart, roomScope.context.ystart, args),
        },
        des: l_register_des(operations, selectionApi.wrap),
        selection: selectionApi.bindings,
    };
    return {
        bindings,
        // Reset the flip flags, mapped cells, room scope, and level flags.
        // An empty
        // SpLev_Map, and the level's base flags; reset_xystart_size() is
        // the wholeLevel rectangle.
        beginLevel(nextActive, { special = true } = {}) {
            active = nextActive;
            roomScope.context = wholeLevel;
            active.context = roomScope.context;
            containers.length = 0;
            monsterInventories.length = 0;
            mappedCells = new SpecialSelection();
            roomScope.roomFailed = false;
            currentLevel().allowFlips = 3;
            if (!special)
                return;
            requireGameLevel().flags.is_special = true;
            const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
            requireGameLevel().flags.temperature = currentDungeon?.flags?.hellish
                ? 1 : 0;
        },
        bindState(state) {
            luaState = state;
            state.objects.toAbsolute = (x, y) => ({
                x: x + roomScope.context.xstart, y: y + roomScope.context.ystart,
            });
            currentLevel().align = luaTableToArray(state.getGlobal('align')).map(value => {
                if (value !== 'law' && value !== 'neutral' && value !== 'chaos')
                    throw new TypeError('Lua alignment must be law, neutral, or chaos');
                return value;
            });
        },
        beginRoom() {
            roomScope.roomFailed = false;
            roomScope.context = wholeLevel;
        },
        roomFailed() {
            return roomScope.roomFailed;
        },
        finishSpecialLevel: () => lspo_finalize_level(currentLevel(), mappedCells),
    };
}
// C sp_lev.c:load_special(): run the level's Lua script, then finalize.
export async function load_special(active) {
    const session = sp_level_coder_init();
    session.beginLevel(active);
    await currentLuaLifecycle().executeSpecial(game, active.file, session.bindings, state => session.bindState(state));
    await session.finishSpecialLevel();
}
const themedLuaSessions = new WeakMap();
const activeThemes = new WeakMap();
// Part of C mklev.c:makerooms(): open the dungeon's theme state and run its pre-generation hook.
export async function beginLuaThemerooms() {
    const lifecycle = currentLuaLifecycle();
    const dungeonNumber = game.u?.uz?.dnum ?? 0;
    let state = lifecycle.getThemedState(game, dungeonNumber);
    const filename = game.dungeons[dungeonNumber]?.themeRooms;
    if (!state && !filename) {
        activeThemes.delete(game);
        return false;
    }
    let session = state ? themedLuaSessions.get(state) : null;
    const active = { prototype: 'themerms', file: filename ?? '' };
    if (!session) {
        if (!filename)
            throw new Error('Themed room initialization requires a source file.');
        const createdSession = sp_level_coder_init();
        session = createdSession;
        createdSession.beginLevel(active, { special: false });
        let loadingStateId;
        try {
            state = await lifecycle.createThemedState(game, dungeonNumber, filename, createdSession.bindings, created => {
                loadingStateId = created.sid;
                createdSession.bindState(created);
            });
        }
        catch (error) {
            if (error instanceof PanicTermination)
                throw error;
            let reason;
            if (!LUA_SOURCES[filename]) {
                reason = `nhl_loadlua: Error opening (${filename})`;
            }
            else if (error instanceof SyntaxError) {
                reason = `luaL_loadbuffer: Error loading (${filename}): ${error.message}`;
            }
            else {
                if (loadingStateId === undefined)
                    throw error;
                reason = `Lua error: ${loadingStateId}:${filename} ${error instanceof Error ? error.message : String(error)}`;
            }
            await impossible(reason);
            // C makerooms() closes a failed theme and clears its filename so
            // this level and later levels use ordinary rooms instead.
            const dungeon = game.dungeons[dungeonNumber];
            if (dungeon)
                dungeon.themeRooms = undefined;
            activeThemes.delete(game);
            return false;
        }
        themedLuaSessions.set(state, session);
    }
    else {
        session.beginLevel(active, { special: false });
    }
    if (!state)
        throw new Error('Themed room initialization did not create a Lua state.');
    activeThemes.set(game, { state, session });
    await state.callValueAsync(state.getGlobal('pre_themerooms_generate'), []);
    return true;
}
// Port only: call a named function in the active themed-room Lua state.
export async function callLuaThemerooms(name, args = []) {
    const state = activeThemes.get(game)?.state;
    if (!state)
        throw new Error('themed rooms are not active');
    return state.callValueAsync(state.getGlobal(name), args);
}
// Part of C mklev.c:makerooms(): run the themed-room generator and detect room creation.
export async function themerooms_generate() {
    const level = requireGameLevel();
    const session = activeThemes.get(game)?.session;
    session?.beginRoom();
    const roomsBefore = level.nroom;
    const subroomsBefore = level.nsubroom;
    await callLuaThemerooms('themerooms_generate');
    if (session?.roomFailed())
        return false;
    return level.nroom !== roomsBefore
        || level.nsubroom !== subroomsBefore;
}
//# sourceMappingURL=sp_lev.js.map