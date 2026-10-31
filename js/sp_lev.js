// sp_lev.js — Special-level construction from level descriptions.
// C ref: sp_lev.c — map placement and terrain selections, room / object /
// monster / trap construction from des operations, live level flipping,
// fill_special_room, check_room, create_room, create_subroom,
// dig_corridor, wallify_map, and themed-room map placement.  The des.*
// binding table and the Lua level/themeroom sessions live in sp_lev_lua.ts.
import { heroIsPunished, placeBallAndChain, unplaceBallAndChain } from './ball.js';
import { mksobj_at, mkobj_at, mkgold, set_corpsenm, rndmonnum } from './mkobj.js';
import { isRoom } from './map_types.js';
import { deleteTrap } from './trap_lifecycle.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { game, requireGameLevel } from './gstate.js';
import { makemon, mkclass } from './makemon.js';
import { lookupNovelTitle } from './novel_titles.js';
import { setWallState } from './wall_topology.js';
import { monsterAtPosition } from './monster_location.js';
import { ensureMinionData } from './monster_birth_extensions.js';
import { setMonsterSpecies } from './monster_species.js';
import { monsterIsVampireShifter } from './monster_data.js';
import { ismnum } from './const.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { monsterPolymorphsWhenStoned } from './monster_stoning.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { impossible } from './diagnostics.js';
import { tablePoint } from './lua/des.js';
import { luaString } from './lua/arguments.js';
import { objectToLuaTable } from './lua/runtime.js';
import { remove_object, stack_object } from './floor_object.js';
import { buryObject } from './buried_object.js';
import { propagateMonsterSpecies } from './monster_population.js';
import { rn2, rnd, rn1 } from './rng.js';
import { rnd_rect, get_rect, split_rects } from './rect.js';
import { depth as depth_of_level } from './hacklib.js';
import { inducedAlignment, level_difficulty } from './dungeon.js';
import { flood_fill_rm, litstate_rnd, mkmap } from './mkmap.js';
import { carveMazeFrom, createMaze } from './maze_terrain.js';
import { ANY_LOC, DRY, HOT, NO_LOC_WARN, SOLID, WET, getLocation, getLocationCoord, getPackedLocationCoord } from './special_location.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { COLNO, ROWNO, STONE, ROOM, CORR, DOOR, STAIRS, LADDER, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, D_NODOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED, OROOM, VAULT, COURT, SWAMP, BEEHIVE, MORGUE, BARRACKS, ZOO, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, DELPHI, THEMEROOM, SHOPBASE, ROOMOFFSET, MAXNROFROOMS, SDOOR, SCORR, IRONBARS, FOUNTAIN, SINK, ALTAR, THRONE, ENGRAVE, BURN, MARK, DUST, ENGR_BLOOD, ACCESSIBLE, IS_WALL, IS_STWALL, IS_DOOR, IS_ROOM, IS_OBSTRUCTED, IS_FURNITURE, IS_LAVA, In_endgame, Is_waterlevel, SPACE_POS, isok, W_NONDIGGABLE, W_NONPASSWALL, FILL_NONE, FILL_NORMAL, ICE, MOAT, POOL, WATER, LAVAPOOL, LAVAWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_DIR, TREE, AIR, CLOUD, A_NONE, A_CHAOTIC, A_NEUTRAL, A_LAWFUL, AM_NONE, AM_LAWFUL, AM_SHRINE, AM_SANCTUM, Align2amask, Amask2align, M_AP_NOTHING, M_AP_FURNITURE, M_AP_OBJECT, M_AP_MONSTER, MM_NOGRP, MM_EMIN, MM_NOTAIL, MM_IGNOREWATER, MM_ADJACENTOK, MM_NOCOUNTBIRTH, MM_NOMSG, G_EXTINCT, G_GONE, STRAT_WAITFORU } from './const.js';
import { OBJECT_MERGE, CORPSE, SPE_NOVEL, BOULDER, STATUE, PICK_AXE, DWARVISH_MATTOCK, SADDLE } from './object_data.js';
import { MONSTER_GENO, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_SYMBOL, MONSTER_NAME, MONSTER_RESISTS, monsterIsPlayerMonster } from './monster_data.js';
import { changeMonsterForm, shapechangerGender } from './monster_polymorph.js';
import { setMonsterMalign } from './monster_alignment.js';
import { terrain_glyph } from './display.js';
import { deleteEngravingAt } from './engrave.js';
import { createPlayerMonster } from './mplayer.js';
import { artifactByName, nameArtifact } from './artifacts.js';
import { addObjectToMonsterInventory, unlinkMonsterObject } from './monster_inventory.js';
import { putSaddleOnMonster } from './steed.js';
import { insideRoom, roomForIndex, roomsAt } from './room.js';
import { somexy } from './mkroom.js';
import { F_LOOTED, F_WARNED, S_LDWASHER, S_LPUDDING, S_LRING, T_LOOTED, TREE_LOOTED, TREE_SWARM } from './const.js';
import { beginObjectBurn } from './light.js';
import { objectWeight } from './weight.js';
import { blessObjectState, curseObjectState, unblessObjectState, uncurseObjectState } from './object_state.js';
import { addCreatedObjectToContainer, addObjectToContainer } from './object_container.js';
import { monsterEmitsLight, vision_reset } from './vision.js';
import { SpecialSelection, match_maptyps, mapCharacterType, specialSelectionMatch } from './selvar.js';
import { CANDELABRUM_OF_INVOCATION, GEM_CLASS, G_IGNORE, G_NOGEN, HOLE, LANDMINE, LEVEL_TELEP, M2_DWARF, M2_FEMALE, M2_GNOME, M2_MALE, M2_SHAPESHIFTER, MAGIC_PORTAL, MAGIC_TRAP, NO_TRAP, PIT, PM_BLACK_LIGHT, PM_FIRE_ELEMENTAL, PM_GIANT_SPIDER, PM_MINOTAUR, PM_SALAMANDER, PM_STALKER, PM_VAMPIRE, PM_VAMPIRE_BAT, PM_VLAD_THE_IMPALER, RANDOM_CLASS, RIN_TELEPORTATION, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SCR_TELEPORTATION, SQKY_BOARD, S_MIMIC, TELEP_TRAP, TRAPDOOR, TRAPNUM, VIBRATING_SQUARE, WAN_DIGGING, WAN_TELEPORTATION, WEB, XLIM, YLIM, add_door, add_room, add_subroom, canDigDown, canFallThrough, findMonsterNearPosition, is_hole, is_pit, make_engr_at, makecorridors, maketrap, maybe_sdoor, mkstairs, mktrap, mktrap_victim, okdoor, stairway_add, topologize, } from './mklev.js';
import { fillBarracksRoom, fillBeehiveRoom, fillCourtRoom, fillMorgueRoom, fillZooRoom, } from './mkroom.js';
import { fillSpecialMazeGrid, fix_wall_spines, setLevelTerrainLit, setLevelTerrainType, vibratingSquarePoint, } from './mkmaze.js';
import { makeroguerooms } from './extralev.js';
import { stockShopRoom } from './shknam.js';
import { specialShrinePriest } from './priest.js';
import { makeSpecialDrawbridge } from './dbridge.js';
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
// ── Special-level operations ──────────────────────────────────────────────
//
// C refs: sp_lev.c lspo_map(), get_location(), l_create_stairway(), and
// create_object().  Keep these operations independent of any one Lua file:
// the file-specific runner below should describe operation order and data,
// while this layer owns C coordinate and engine-object semantics.
export function centeredSpecialMap(width, height) {
    // sp_lev.c centers against x_maze_max/y_maze_max, then forces an odd
    // origin so wall glyphs line up with the maze grid.
    const mazeMaxX = (COLNO - 1) & ~1;
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = 2 + Math.trunc((mazeMaxX - 2 - width) / 2);
    let ystart = 2 + Math.trunc((mazeMaxY - 2 - height) / 2);
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
    // sp_lev.c permits full-height maps: after the ordinary odd-origin
    // alignment overflows ROWNO, it retries two rows upward and finally
    // anchors a ROWNO-tall fragment at row zero.
    if (ystart < 0 || ystart + height > ROWNO) {
        ystart += ystart > 0 ? -2 : 2;
        if (height === ROWNO)
            ystart = 0;
        if (ystart < 0 || ystart + height > ROWNO)
            ystart = 0;
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
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
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
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
    return { xstart, ystart, width, height };
}
function leftBottomSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_LEFT, BOTTOM).  An explicit level_init makes
    // the left anchor column 1; the bottom anchor is relative to the even
    // maze limit.  Both coordinates are then advanced to odd map-grid cells.
    const mazeMaxY = (ROWNO - 1) & ~1;
    let xstart = 1;
    let ystart = mazeMaxY - height - 1;
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
    return { xstart, ystart, width, height };
}
function rightTopSpecialMap(width, height) {
    // sp_lev.c lspo_map(SPLEV_RIGHT, TOP).
    const mazeMaxX = (COLNO - 1) & ~1;
    let xstart = mazeMaxX - width - 1;
    let ystart = 3;
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
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
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
    return { xstart, ystart, width, height };
}
async function specialRandomLocation(context, acceptable) {
    const point = await getLocationCoord(context, null, DRY, acceptable);
    return point.x === -1 && point.y === -1 ? null : point;
}
export function specialSelectionTerrain(selection, typ, lit = -2) {
    selection.forEachXMajor((x, y) => setSpecialTerrain(x, y, typ, lit));
}
// sp_lev.c:sel_set_ter() applies these effects to both coordinate and
// selection forms of des.terrain(). replace_terrain() only changes the type.
export function setSpecialTerrain(x, y, typ, lit) {
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
export function specialMazeWalk(context, mapX, mapY, direction, passageType = ROOM) {
    const level = requireGameLevel();
    // sp_lev.c:lspo_mazewalk() first opens the square just outside the
    // mapped fragment, then adjusts to an odd maze coordinate and delegates
    // to mkmaze.c:walkfrom().  The recursive walker uses native whole-level
    // maze bounds, not the Lua map rectangle.
    let x = context.xstart + mapX;
    let y = context.ystart + mapY;
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
    if (!(y % 2))
        y += direction === 'south' ? 1 : -1;
    carveMazeFrom(x, y, passageType, (COLNO - 1) & ~1, (ROWNO - 1) & ~1);
}
function specialMazeStockPoint(mappedCells) {
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
function randomSpecialTrapType() {
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
export async function fillEmptySpecialMaze(mappedCells) {
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
        const point = specialMazeStockPoint(mappedCells);
        await mkobj_at(rn2(2) ? GEM_CLASS : RANDOM_CLASS, point.x, point.y, true);
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100)); count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        const trap = level.traps?.find(candidate => candidate.tx === point.x && candidate.ty === point.y);
        if (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp)))
            continue;
        await mksobj_at(BOULDER, point.x, point.y, true, false);
    }
    for (let count = rn2(2); count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await makemon(PM_MINOTAUR, point.x, point.y, 0);
    }
    for (let count = rnd(Math.trunc(12 * mapfact / 100)); count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await makemon(null, point.x, point.y, 0);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100)); count > 0; count--) {
        const point = specialMazeStockPoint(mappedCells);
        await mkgold(0, point.x, point.y);
    }
    for (let count = rn2(Math.trunc(15 * mapfact / 100)); count > 0; count--) {
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
function specialMonsterHumidity(mndx) {
    const flags = MONSTER_FLAGS1[mndx] ?? 0;
    const symbol = MONSTER_SYMBOL[mndx];
    let humidity = symbol === 57 || (flags & (0x00000002 | 0x00000200))
        ? WET : DRY;
    if ((flags & 0x00000001) || symbol === 5 || symbol === 25)
        humidity |= HOT | WET;
    if ((flags & 0x00000008) || symbol === 54)
        humidity |= SOLID;
    if (mndx === 30 || mndx === 110
        || mndx === PM_FIRE_ELEMENTAL || mndx === PM_SALAMANDER)
        humidity |= HOT;
    return humidity;
}
// C sp_lev.c:l_create_stairway() removes a trap left by earlier level
// contents from the chosen stair or ladder square.
function clearStairwaySquare(x, y) {
    const trap = requireGameLevel().traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap)
        deleteTrap(trap);
}
export function specialNonDiggable(context = null) {
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
export function specialSelectionNonDiggable(selection) {
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
            || loc.typ === IRONBARS))
            loc.wall_info |= W_NONDIGGABLE;
    });
}
async function specialObject(context, allowArtifacts = true) {
    const point = await specialRandomLocation(context);
    if (point)
        return await mkobj_at(RANDOM_CLASS, point.x, point.y, allowArtifacts);
    return null;
}
async function specialObjectOfClass(context, objectClass, allowArtifacts = true) {
    const point = await specialRandomLocation(context);
    if (point)
        return await mkobj_at(objectClass, point.x, point.y, allowArtifacts);
    return null;
}
async function specialCorpseOf(context, mndx) {
    const point = await specialRandomLocation(context);
    if (!point)
        return null;
    const corpse = await mksobj_at(CORPSE, point.x, point.y, true, false);
    set_corpsenm(corpse, mndx);
    return corpse;
}
async function specialObjectOfType(context, otyp, allowArtifacts = true) {
    const point = await specialRandomLocation(context);
    return point ? await mksobj_at(otyp, point.x, point.y, true, allowArtifacts) : null;
}
function specialDoorAt(context, mask, x, y) {
    const level = requireGameLevel();
    const doorX = context.xstart + x, doorY = context.ystart + y;
    const loc = level.at(doorX, doorY);
    if (!loc)
        return null;
    if (!IS_DOOR(loc.typ) && loc.typ !== SDOOR)
        loc.typ = DOOR;
    setSpecialDoorOrientation(doorX, doorY);
    loc.doormask = mask;
    return { x: doorX, y: doorY };
}
function randomSpecialDoorMask() {
    // lspo_door() uses rnddoor() directly for an explicit coordinate.
    const states = [D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED];
    const mask = states[rn2(states.length)];
    if (mask === undefined)
        throw new Error('Missing random door state');
    return mask;
}
function specialIrregularRoom(context, x, y, rtype, lit, needfill) {
    const level = requireGameLevel();
    const seedX = context.xstart + x, seedY = context.ystart + y;
    const roomNumber = level.nroom + ROOMOFFSET;
    const equivalence = game.smeq;
    if (!equivalence)
        throw new Error('Irregular room creation requires room equivalence.');
    equivalence[level.nroom] = level.nroom;
    const bounds = flood_fill_rm(seedX, seedY, roomNumber, lit, true);
    // lspo_region() registers the bounds with lighting off: flood_fill_rm()
    // already lit the room's floor and boundary, not the whole rectangle.
    add_room(bounds.lx, bounds.ly, bounds.hx, bounds.hy, false, rtype, true);
    const room = level.rooms[level.nroom - 1];
    if (!isRoom(room))
        throw new Error('Irregular room creation did not install a room.');
    room.rlit = lit ? 1 : 0;
    room.irregular = true;
    room.needjoining = true;
    room.needfill = needfill;
    addDoorsToSpecialRoom(room);
    return room;
}
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
export async function flipSpecialLevel(flp, extras = false) {
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
                trap.conjoined = flipEncodedDirections(flp, trap.conjoined);
            if (flp & 2)
                trap.conjoined = flipEncodedDirections(flp, trap.conjoined);
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
                flipDrawbridgeDirection(swap, false);
                flipDrawbridgeDirection(level.requireAt(x, otherY), false);
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
                flipDrawbridgeDirection(swap, true);
                flipDrawbridgeDirection(level.requireAt(otherX, y), true);
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
        setWallState();
        flipRememberedVisuals(flp, minx, miny, maxx, maxy);
    }
    vision_reset();
    game.vision_full_recalc = 1;
    level._flip = { flp, minx, miny, maxx, maxy };
}
function flipDrawbridgeDirection(location, horizontal) {
    if (location.typ !== DRAWBRIDGE_UP && location.typ !== DRAWBRIDGE_DOWN)
        return;
    const mask = location.drawbridgemask ?? location.flags;
    const direction = mask & DB_DIR;
    const first = horizontal ? DB_WEST : DB_NORTH;
    const second = horizontal ? DB_EAST : DB_SOUTH;
    if (direction !== first && direction !== second)
        return;
    location.flags = location.drawbridgemask = (mask & ~DB_DIR)
        | (direction === first ? second : first);
}
function swapDirectionBits(value, first, second) {
    const different = ((value >> first) ^ (value >> second)) & 1;
    return value ^ ((different << first) | (different << second));
}
function flipEncodedDirections(flp, value) {
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
function flipRememberedVisuals(flp, minx, miny, maxx, maxy) {
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
                const glyph = terrain_glyph(location, x, y);
                location.remembered_glyph = { ...glyph, decgfx: glyph.dec };
            }
        }
    }
}
export async function flipSpecialLevelRandom(allowed, extras = false) {
    let flp = 0;
    if ((allowed & 1) && rn2(2))
        flp |= 1;
    if ((allowed & 2) && rn2(2))
        flp |= 2;
    await flipSpecialLevel(flp, extras);
}
export function loadSpecialAsciiMap(rows, lit, origin = null) {
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
            if (row[dx] === 'x')
                continue;
            const loc = level.at(context.xstart + dx, context.ystart + dy);
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
                setLevelTerrainType(context.xstart + dx, context.ystart + dy, ICE);
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
            const loc = level.at(context.xstart + dx, context.ystart + dy);
            if (!loc)
                continue;
            specialDoorAt(context, loc.doormask, dx, dy);
        }
    }
    return context;
}
function specialLadderAt(ladderX, ladderY, up) {
    const loc = requireGameLevel().at(ladderX, ladderY);
    if (!loc)
        return;
    loc.typ = LADDER;
    loc.ladder = up ? 1 : 2;
    const currentLevel = game.u?.uz?.dlevel ?? 1;
    const destination = {
        dnum: game.u?.uz?.dnum ?? 0,
        dlevel: currentLevel + (up ? -1 : 1),
    };
    stairway_add(ladderX, ladderY, !!up, true, destination);
}
async function specialObjectAt(context, otyp, x, y, { named = false } = {}) {
    // sp_lev.c:create_object() passes `!named` as mksobj_at()'s artifact
    // eligibility.  This matters even when no artifact can be produced:
    // unnamed armor still consumes its source-owned rn2(40) chance.
    const point = await getLocationCoord(context, { x, y }, DRY);
    return await mksobj_at(otyp, point.x, point.y, true, !named);
}
async function specialRandomObjectAt(context, x, y, allowArtifacts = true) {
    const point = await getLocationCoord(context, { x, y }, DRY);
    return await mkobj_at(RANDOM_CLASS, point.x, point.y, allowArtifacts);
}
async function specialObjectClassAt(context, objectClass, x, y, allowArtifacts = true) {
    const point = await getLocationCoord(context, { x, y }, DRY);
    return await mkobj_at(objectClass, point.x, point.y, allowArtifacts);
}
function applyMinesSameRaceMonsterGate(mndx) {
    const dungeonName = game.dungeons?.[game.u?.uz?.dnum ?? -1]?.dname;
    const prototype = game._activeSpecialLevel?.prototype;
    const inMines = dungeonName === 'The Gnomish Mines'
        || prototype === 'minefill'
        || prototype === 'minetn'
        || prototype === 'minend';
    if (mndx == null || !inMines)
        return mndx;
    const race = game.urace?.noun;
    const selfMask = race === 'dwarf' ? M2_DWARF
        : race === 'gnome' ? M2_GNOME : 0;
    if (!selfMask || !((MONSTER_FLAGS2[mndx] || 0) & selfMask))
        return mndx;
    // sp_lev.c:create_monster(): Mines levels usually replace a requested
    // monster of the dwarf/gnome hero's own race with a random species.
    return rn2(3) ? null : mndx;
}
export function finishSpecialRoamer(monster, alignment, peaceful) {
    const coaligned = alignment === (game.u?.ualign?.type ?? A_NEUTRAL);
    monster.ispriest = 0;
    monster.isminion = 1;
    const minion = ensureMinionData(monster);
    minion.min_align = alignment;
    minion.renegade = coaligned && !peaceful;
    monster.maligntyp = alignment;
    monster.mpeaceful = peaceful ? 1 : 0;
    monster.msleeping = 0;
    monster.mtrapseen = 0x7fffffff;
    setMonsterMalign(monster);
}
// sp_lev.c:create_monster() replaces unavailable ordinary species, but
// an extinct unique monster must not appear again in any form.
function selectNamedSpecialMonster(mndx) {
    if (mndx === null)
        return { species: null };
    const vitalFlags = game.mvitals?.[mndx]?.mvflags ?? 0;
    if (((MONSTER_GENO[mndx] ?? 0) & 0x1000) && (vitalFlags & G_EXTINCT))
        return null;
    return { species: vitalFlags & G_GONE ? null : mndx };
}
// sp_lev.c:create_monster() searches before construction, including when
// a worm's tail occupies the requested square. The result must stay in croom.
async function createSpecialMonster(context, mndx, x, y, mmflags, playerMonster = false) {
    const level = requireGameLevel();
    if (monsterAtPosition(level, x, y)) {
        const nearby = findMonsterNearPosition(mndx, x, y);
        if (nearby) {
            x = nearby.x;
            y = nearby.y;
        }
    }
    const room = context._room;
    if (room && !insideRoom(level, room, x, y))
        return null;
    return playerMonster && mndx !== null
        ? await createPlayerMonster(mndx, x, y, false)
        : await makemon(mndx, x, y, mmflags);
}
async function specialMonsterAt(context, mndx, x, y, { randomGender = true, randomAlignment = true, peaceful = null, asleep = null, mmflags = 0, roamerAlignment = null, } = {}) {
    // Lua's find_montype() resolves a requested gender before
    // create_monster() resolves random alignment.  Fixed-sex monsters skip
    // the former draw; makemon() still performs its own independent gender
    // initialization before the explicit value is restored.
    const requestedFemale = randomGender ? !!rn2(2) : null;
    if (randomAlignment)
        consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const selection = selectNamedSpecialMonster(mndx);
    if (!selection)
        return null;
    mndx = applyMinesSameRaceMonsterGate(selection.species);
    const point = await specialMonsterLocation(context, mndx, { x, y });
    if (!point)
        return null;
    const monster = await createSpecialMonster(context, mndx, point.x, point.y, mmflags, alignment === null && mndx !== null && monsterIsPlayerMonster(mndx));
    if (monster && requestedFemale !== null)
        monster.female = requestedFemale;
    if (monster && peaceful != null)
        monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null)
        monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}
async function specialMonsterClassAt(context, monsterClass, x, y, appearance = null, { randomAlignment = true, peaceful = null, asleep = null, mmflags = 0, roamerAlignment = null, } = {}) {
    // A class request resolves random alignment and mkclass(), but unlike a
    // named species it has no separate find_montype() gender draw.
    if (randomAlignment)
        consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    let mndx = mkclass(monsterClass, 0x0200);
    // A null class choice asks makemon() for a random species.
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const point = await specialMonsterLocation(context, mndx, { x, y });
    if (!point)
        return null;
    const monster = await createSpecialMonster(context, mndx, point.x, point.y, mmflags);
    if (monster && peaceful != null)
        monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null)
        monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    if (monster && appearance?.kind === 'object') {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = appearance.otyp;
    }
    return monster;
}
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
async function specialMonsterLocation(context, mndx, coordinate = null) {
    // create_monster() has no species humidity to retry when selection
    // falls back to a random monster; it goes directly through DRY.
    if (mndx === null)
        return await getLocationCoord(context, coordinate, DRY);
    const humidity = specialMonsterHumidity(mndx);
    let point = await getLocationCoord(context, coordinate, humidity | NO_LOC_WARN);
    if (point.x === -1 && point.y === -1)
        point = await getLocationCoord(context, coordinate, humidity | DRY);
    return point.x === -1 && point.y === -1 ? null : point;
}
async function specialExplicitMonster(context, mndx, appearance = null, { randomGender = true, randomAlignment = true, peaceful = null, asleep = null, mmflags = 0, roamerAlignment = null, } = {}) {
    // sp_lev.c find_montype() resolves a legal gender while parsing the Lua
    // table.  makemon() independently initializes gender, then
    // create_monster() restores this explicit value after construction.
    const requestedFemale = randomGender
        ? (namedMonsterNeedsGenderDraw(mndx)
            ? !!rn2(2)
            : !!((MONSTER_FLAGS2[mndx] || 0) & 0x00020000))
        : null;
    if (randomAlignment)
        consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const selection = selectNamedSpecialMonster(mndx);
    if (!selection)
        return null;
    const selectedSpecies = applyMinesSameRaceMonsterGate(selection.species);
    const point = await specialMonsterLocation(context, selectedSpecies);
    if (!point)
        return null;
    const monster = await createSpecialMonster(context, selectedSpecies, point.x, point.y, mmflags, alignment === null && monsterIsPlayerMonster(mndx));
    if (!monster)
        return null;
    if (requestedFemale != null)
        monster.female = requestedFemale;
    if (peaceful != null)
        monster.mpeaceful = peaceful ? 1 : 0;
    if (asleep != null)
        monster.msleeping = asleep ? 1 : 0;
    if (alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    if (appearance?.kind === 'object') {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = appearance.otyp;
    }
    return monster;
}
async function specialMonsterOfClass(context, monsterClass, { randomAlignment = true, peaceful = null, asleep = null, mmflags = 0, roamerAlignment = null, } = {}) {
    // create_monster() resolves its random alignment before a one-character
    // monster id is expanded through mkclass_aligned().
    if (randomAlignment)
        consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    // find_montype() allows class requests to select species which carry
    // G_NOGEN; explicit special-level population is the exception encoded
    // by mkclass(class, G_NOGEN).
    let mndx = mkclass(monsterClass, 0x0200);
    mndx = applyMinesSameRaceMonsterGate(mndx);
    const point = await specialMonsterLocation(context, mndx);
    if (!point)
        return null;
    const resolved = await createSpecialMonster(context, mndx, point.x, point.y, mmflags);
    if (resolved && peaceful != null)
        resolved.mpeaceful = peaceful ? 1 : 0;
    if (resolved && asleep != null)
        resolved.msleeping = asleep ? 1 : 0;
    if (resolved && alignment != null)
        finishSpecialRoamer(resolved, alignment, peaceful ?? true);
    return resolved;
}
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
// sp_lev.c:create_trap() checks stairs after get_location_coord(), even
// when the water plane accepts every terrain during coordinate selection.
async function specialTrapLocation(context, coordinate) {
    const level = requireGameLevel();
    const room = context._room;
    if (room)
        return await getFreeRoomLocation(context, coordinate, room);
    for (let attempt = 0; attempt <= 100; attempt++) {
        const point = await getLocationCoord(context, coordinate, DRY);
        const terrain = level.at(point.x, point.y)?.typ;
        if (terrain !== STAIRS && terrain !== LADDER)
            return point;
    }
    return null;
}
// sp_lev.c:get_free_room_loc(). Furniture can satisfy DRY placement;
// room features retry on ordinary floor instead of replacing each other.
async function getFreeRoomLocation(context, coordinate, room) {
    const level = requireGameLevel();
    const point = await getLocationCoord(context, coordinate, DRY);
    if (level.at(point.x, point.y)?.typ === ROOM)
        return point;
    for (let attempt = 0; attempt <= 100; attempt++) {
        if (!somexy(room, point))
            throw new Error("get_room_loc: can't find a place!");
        if (level.at(point.x, point.y)?.typ === ROOM)
            return point;
    }
    throw new Error("get_free_room_loc: can't find a place!");
}
async function specialTrapOfType(context, typ, options, coordinate) {
    // C sp_lev.c:create_trap(): invocation placement owns its coordinates,
    // including when Lua supplies an explicit location or a room.
    if (typ === VIBRATING_SQUARE) {
        const square = vibratingSquarePoint();
        return await maketrap(square.x, square.y, VIBRATING_SQUARE);
    }
    const point = await specialTrapLocation(context, coordinate);
    if (!point)
        return null;
    return await mktrap(typ, options, null, point);
}
async function specialMonster(context, { randomAlignment = true, peaceful = null, asleep = null, mmflags = 0, roamerAlignment = null, } = {}) {
    if (randomAlignment)
        consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const point = await specialRandomLocation(context);
    if (!point)
        return;
    const monster = await createSpecialMonster(context, null, point.x, point.y, mmflags);
    if (monster && peaceful != null)
        monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null)
        monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}
function setSpecialRegionLighting(context, x1, y1, x2, y2, lit) {
    const level = requireGameLevel();
    // sp_lev.c's two-argument des.region(selection, "lit") grows the cloned
    // selection one cell in every direction before applying light.  "unlit"
    // applies to the literal selection without growth.
    const halo = lit ? 1 : 0;
    for (let x = x1 - halo; x <= x2 + halo; x++) {
        for (let y = y1 - halo; y <= y2 + halo; y++) {
            const loc = level.at(context.xstart + x, context.ystart + y);
            if (loc)
                loc.lit = lit;
        }
    }
}
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
export function addDoorsToSpecialRoom(room) {
    const level = requireGameLevel();
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const loc = level.at(x, y);
            if (loc && (IS_DOOR(loc.typ) || loc.typ === SDOOR))
                maybeAddSpecialRoomDoor(x, y, room);
        }
    }
    for (const subroom of room.sbrooms || [])
        addDoorsToSpecialRoom(subroom);
}
// sp_lev.c:link_doors_rooms(). A later Lua room can create a door shared
// with an earlier one, so link the completed map before stocking it.
export function linkSpecialLevelDoors() {
    const level = requireGameLevel();
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 0; x < COLNO; x++) {
            const loc = level.requireAt(x, y);
            if (!IS_DOOR(loc.typ) && loc.typ !== SDOOR)
                continue;
            setSpecialDoorOrientation(x, y);
            for (const room of level.rooms.slice(0, level.nroom)) {
                if (!isRoom(room))
                    continue;
                maybeAddSpecialRoomDoor(x, y, room);
                for (const subroom of room.sbrooms ?? [])
                    maybeAddSpecialRoomDoor(x, y, subroom);
            }
        }
    }
}
function maybeAddSpecialRoomDoor(x, y, room) {
    const level = requireGameLevel();
    const roomNumber = room.roomnoidx + ROOMOFFSET;
    const inRectangle = !room.irregular
        && x >= room.lx - 1 && x <= room.hx + 1
        && y >= room.ly - 1 && y <= room.hy + 1;
    if (inRectangle || level.at(x, y)?.roomno === roomNumber
        || specialDoorSharedWithRoom(x, y, room, roomNumber)) {
        add_door(x, y, room);
    }
}
function specialDoorSharedWithRoom(x, y, room, roomNumber) {
    const level = requireGameLevel();
    const loc = level.at(x, y);
    if (!isok(x, y) || !loc || (loc.roomno === roomNumber && !loc.edge))
        return false;
    return (isok(x - 1, y) && x - 1 <= room.hx && level.at(x - 1, y)?.roomno === roomNumber)
        || (isok(x + 1, y) && x + 1 >= room.lx && level.at(x + 1, y)?.roomno === roomNumber)
        || (isok(x, y - 1) && y - 1 <= room.hy && level.at(x, y - 1)?.roomno === roomNumber)
        || (isok(x, y + 1) && y + 1 >= room.ly && level.at(x, y + 1)?.roomno === roomNumber);
}
function setSpecialDoorOrientation(x, y) {
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
export async function buildSpecialRoom(spec, parent = null, contents = null) {
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
    if (contents)
        await contents(room);
    addDoorsToSpecialRoom(room);
    return room;
}
function createSpecialRoomDoor(room, state, wall, position = -1) {
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
function specialRectangularRoom(context, x1, y1, x2, y2, rtype, lit, needfill) {
    const level = requireGameLevel();
    const room = add_room(context.xstart + x1, context.ystart + y1, context.xstart + x2, context.ystart + y2, lit, rtype, true);
    room.needjoining = true;
    room.needfill = needfill;
    topologize(room);
    addDoorsToSpecialRoom(room);
    return room;
}
export function specialMapRows(source) {
    const rows = source.split('\n');
    if (rows.at(-1) === '')
        rows.pop();
    return rows;
}
function fillSpecialSolid(type, lit) {
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
export async function fillSpecialLevel(options, active) {
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
            fillSpecialSolid(filling, false);
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
        fillSpecialSwamp(foreground, background, lit);
        active.defaultLit = lit;
        return;
    }
    if (style === 'mazegrid') {
        const type = mapCharacterType(options.bg ?? ' ');
        if (type === undefined)
            throw new Error(`unknown Lua map character ${options.bg}`);
        fillSpecialMazeGrid(type);
        active.defaultLit = false;
        return;
    }
    if (style === 'maze') {
        createMaze(options.corrwid ?? -1, options.wallthick ?? -1, options.deadends === false);
        active.defaultLit = false;
        return;
    }
    if (style !== 'solidfill')
        throw new Error(`unsupported Lua level style ${style}`);
    const type = mapCharacterType(options.filling ?? options.fg ?? '.');
    if (type === undefined)
        throw new Error(`unknown Lua map character ${options.fg}`);
    active.defaultLit = options.lit == null ? !!rn2(2) : !!options.lit;
    fillSpecialSolid(type, active.defaultLit);
    return;
}
export function setLuaLevelFlags(active, flags) {
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
export async function replaceLuaTerrain(context, options) {
    const level = requireGameLevel();
    const explicit = [
        options.x1 ?? -1, options.y1 ?? -1, options.x2 ?? -1, options.y2 ?? -1,
    ];
    const rectangle = explicit.some(value => value !== -1) ? explicit : options.region;
    let selection = options.selection;
    if (rectangle && rectangle.some(value => value !== -1)) {
        const start = await getLocation(context, { x: rectangle[0], y: rectangle[1] }, ANY_LOC);
        const end = await getLocation(context, { x: rectangle[2], y: rectangle[3] }, ANY_LOC);
        selection = new SpecialSelection();
        for (let x = Math.max(1, start.x); x <= Math.min(COLNO - 1, end.x); x++)
            for (let y = Math.max(0, start.y); y <= Math.min(ROWNO - 1, end.y); y++)
                selection.add(x, y);
    }
    selection ??= new SpecialSelection().negate();
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
        if (!matches || rn2(100) >= chance)
            return;
        setLevelTerrainLit(x, y, toType, lit);
    });
}
export async function createLuaFeature(context, options) {
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
    const location = await getLocationCoord(context, point, random ? DRY : ANY_LOC);
    if (!isok(location.x, location.y))
        return;
    const cell = level.requireAt(location.x, location.y);
    if (!IS_FURNITURE(cell.typ))
        cell.typ = featureType;
    if (cell.typ !== featureType)
        return;
    let flags = [];
    switch (featureType) {
        case FOUNTAIN:
            flags = [[options.looted, F_LOOTED], [options.warned, F_WARNED]];
            break;
        case SINK:
            flags = [[options.pudding, S_LPUDDING], [options.dishwasher, S_LDWASHER], [options.ring, S_LRING]];
            break;
        case THRONE:
            flags = [[options.looted, T_LOOTED]];
            break;
        case TREE:
            flags = [[options.looted, TREE_LOOTED], [options.swarm, TREE_SWARM]];
            break;
    }
    for (const [value, flag] of flags) {
        if (value === undefined)
            continue;
        const current = cell.looted ?? cell.flags;
        cell.flags = cell.looted = value ? current | flag : current & ~flag;
    }
}
function noncoalignedSpecialAlignmentDraw() {
    const original = game.u?.ualignbase?.[1]
        ?? game.u?.ualign?.type ?? A_NEUTRAL;
    const choice = rn2(2);
    if (original === A_NEUTRAL)
        return choice ? A_CHAOTIC : A_LAWFUL;
    return choice ? -original : A_NEUTRAL;
}
// C sp_lev.c sp_amask_to_amask(): the Align2amask() argument is a ternary
// macro that re-evaluates noncoalignment() for every comparison. Its first
// comparison tests against A_NONE (-128), which noncoalignment() never
// returns, so resolution always continues: a lawful second draw stops after
// two rn2(2) draws, anything else forces a third and can store the shifted
// (alignment + 2) mask.
function noncoalignedSpecialAmask() {
    const first = noncoalignedSpecialAlignmentDraw();
    if (first === A_NONE)
        return AM_NONE;
    const second = noncoalignedSpecialAlignmentDraw();
    if (second === A_LAWFUL)
        return AM_LAWFUL;
    return (noncoalignedSpecialAlignmentDraw() + 2) & 0xff;
}
function luaSpecialAlignment(value = 'random') {
    if (value === 'noalign')
        return A_NONE;
    if (value === 'law')
        return A_LAWFUL;
    if (value === 'neutral')
        return A_NEUTRAL;
    if (value === 'chaos')
        return A_CHAOTIC;
    if (value === 'coaligned') {
        return game.u?.ualignbase?.[1]
            ?? game.u?.ualign?.type ?? A_NEUTRAL;
    }
    if (value === 'noncoaligned')
        return Amask2align(noncoalignedSpecialAmask());
    if (value === 'random')
        return inducedAlignment(80);
    throw new Error(`unsupported Lua alignment ${value}`);
}
function specialRoomAt(x, y, roomType) {
    const level = requireGameLevel();
    const roomNumber = roomsAt(level, x, y, roomType)[0];
    return roomNumber === undefined ? null : roomForIndex(level, roomNumber - ROOMOFFSET);
}
export async function createLuaAltar(context, options) {
    const level = requireGameLevel();
    const coordinate = tablePoint(options);
    const point = context._room
        ? await getFreeRoomLocation(context, coordinate, context._room)
        : await getLocationCoord(context, coordinate, DRY);
    const altar = level.at(point.x, point.y);
    if (!altar)
        return;
    if (!setLevelTerrainType(point.x, point.y, ALTAR))
        return;
    // sp_amask_to_amask() resolves the whole mask (including the
    // re-evaluated noncoalignment ternary) before the altar stores it.
    const amask = options.align === 'noncoaligned'
        ? noncoalignedSpecialAmask() : Align2amask(luaSpecialAlignment(options.align));
    const alignment = Amask2align(amask);
    altar.flags = amask;
    const altarType = options.type ?? 'altar';
    if (!['altar', 'shrine', 'sanctum'].includes(altarType))
        throw new Error(`unsupported Lua altar type ${altarType}`);
    const temple = context._room
        ? context._room.rtype === TEMPLE ? context._room : null
        : specialRoomAt(point.x, point.y, TEMPLE);
    if (!temple || altarType === 'altar')
        return;
    const sanctum = altarType === 'sanctum';
    await specialShrinePriest(temple, point.x, point.y, alignment, { sanctum });
    altar.flags |= AM_SHRINE;
    if (sanctum)
        altar.flags |= AM_SANCTUM;
    level.flags.has_temple = true;
}
function luaRoomType(name = 'ordinary') {
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
export function luaRoomTable(room) {
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
export async function createLuaRoomRegion(context, options) {
    const explicit = [options.x1 ?? -1, options.y1 ?? -1, options.x2 ?? -1, options.y2 ?? -1];
    const [x1, y1, x2, y2] = explicit.some(value => value !== -1)
        ? explicit : options.region ?? explicit;
    if (typeof x1 !== 'number' || typeof y1 !== 'number'
        || typeof x2 !== 'number' || typeof y2 !== 'number'
        || ![x1, y1, x2, y2].every(Number.isInteger))
        throw new TypeError('des.region requires four coordinates');
    if ([x1, y1, x2, y2].every(value => value === -1))
        throw new TypeError('region needs region');
    const roomType = luaRoomType(options.type);
    const lit = litstate_rnd(options.lit ?? -1);
    const start = await getLocation(context, { x: x1, y: y1 }, ANY_LOC);
    const end = await getLocation(context, { x: x2, y: y2 }, ANY_LOC);
    const absolute = { xstart: 0, ystart: 0, width: COLNO, height: ROWNO };
    const roomNotNeeded = roomType === OROOM && !options.irregular
        && !options.arrival_room && !game.in_mk_themerooms;
    if (roomNotNeeded || requireGameLevel().nroom >= MAXNROFROOMS) {
        if (!roomNotNeeded)
            await impossible('Too many rooms on new level!');
        lightSpecialArea(absolute, start.x, start.y, end.x, end.y, lit);
        return null;
    }
    const needFill = options.filled ?? 0;
    const room = options.irregular
        ? specialIrregularRoom(absolute, start.x, start.y, roomType, lit, needFill)
        : specialRectangularRoom(absolute, start.x, start.y, end.x, end.y, roomType, lit, needFill);
    room.needjoining = options.joined === undefined || !!options.joined;
    if (room && options.arrival_room)
        room.arrival_room = true;
    return room;
}
export function luaRoomSpec(options) {
    const coordinate = tablePoint(options);
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
    return {
        ...options,
        x: coordinate?.x ?? -1,
        y: coordinate?.y ?? -1,
        rtype: luaRoomType(options.type),
        xalign,
        yalign,
    };
}
export async function createLuaStair(context, { direction, point }, usingLadder = false) {
    const up = direction === 'up';
    const random = !point || (point.x === -1 && point.y === -1);
    const location = await getLocationCoord(context, point, DRY, random ? loc => loc.typ === ROOM || loc.typ === CORR || loc.typ === ICE : undefined);
    clearStairwaySquare(location.x, location.y);
    if (usingLadder)
        specialLadderAt(location.x, location.y, up);
    else
        await mkstairs(location.x, location.y, up, context._room ?? null, !random);
    return location;
}
export async function createLuaDoor(context, { state, point, wall = 'all', pos = -1, }) {
    if (!point || (point.x === -1 && point.y === -1)) {
        if (!context?._room)
            throw new TypeError('des.door without coordinates needs a room');
        return createSpecialRoomDoor(context._room, state, wall, pos);
    }
    const randomMask = state === 'random' ? randomSpecialDoorMask() : null;
    const location = await getPackedLocationCoord(context, point, ANY_LOC);
    if (!isok(location.x, location.y))
        throw new TypeError('door coord not ok');
    const x = location.x - context.xstart, y = location.y - context.ystart;
    if (randomMask !== null)
        return specialDoorAt(context, randomMask, x, y);
    const masks = {
        nodoor: D_NODOOR,
        broken: D_BROKEN,
        open: D_ISOPEN,
        closed: D_CLOSED,
        locked: D_LOCKED,
    };
    if (state === 'secret') {
        const door = specialDoorAt(context, D_CLOSED, x, y);
        const loc = door && requireGameLevel().at(door.x, door.y);
        if (loc)
            loc.typ = SDOOR;
        return door;
    }
    const mask = masks[state];
    if (mask === undefined)
        throw new Error(`unknown Lua door state ${state}`);
    return specialDoorAt(context, mask, x, y);
}
export async function createLuaCorridor(options) {
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
    const start = corridorDoorEndpoint(source, srcwall, srcdoor);
    const end = corridorDoorEndpoint(destination, destwall, destdoor);
    if (start && end)
        await dig_corridor(start, end, null, false, CORR, STONE);
}
// sp_lev.c:search_door() numbers doors along a wall in increasing map order.
function corridorDoorEndpoint(room, wall, door) {
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
export async function createLuaDrawbridge(context, options) {
    const coordinate = tablePoint(options);
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
    const point = await getLocationCoord(context, coordinate, DRY | WET | HOT);
    const open = options.state === 'random' || options.state == null
        ? !rn2(2) : options.state === 'open';
    if (!await makeSpecialDrawbridge(point.x, point.y, direction, open))
        await impossible('Cannot create drawbridge.');
    return point;
}
export async function createLuaEngraving(context, options) {
    const point = await getLocationCoord(context, options.point, DRY);
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
    return make_engr_at(point.x, point.y, options.text, null, 0, type, {
        nowipeout: options.degrade === false,
        guardobjects: !!options.guardobjects,
    });
}
export async function createLuaGold(context, options) {
    const point = await getLocationCoord(context, options.point, DRY);
    const requestedAmount = options.amount ?? -1;
    const amount = requestedAmount < 0 ? rnd(200) : requestedAmount;
    return await mkgold(amount, point.x, point.y);
}
export async function createLuaObject(context, options, parentContainer, parentMonster, invokeContents) {
    // lspo_object() resolves montype before create_object() chooses a
    // coordinate or initializes the object's random attributes.
    let corpseSpecies = options.monsterType;
    if (options.monsterClass !== null) {
        corpseSpecies = mkclass(options.monsterClass, G_NOGEN | G_IGNORE);
        if (corpseSpecies === null)
            throw new Error('Unknown montype');
    }
    const quantity = options.quantity ?? 1;
    const count = options.objectType !== null && !OBJECT_MERGE[options.objectType]
        ? Math.max(1, quantity) : 1;
    let object = null;
    for (let index = 0; index < count; index++) {
        object = await createLuaObjectPiece(context, options, corpseSpecies, parentContainer, parentMonster);
    }
    if (object && options.contents && typeof options.contents === 'object')
        await invokeContents(options.contents, object);
    return object;
}
async function createLuaObjectPiece(context, options, corpseSpecies, parentContainer, parentMonster) {
    const { point, objectClass, objectType } = options;
    const allowArtifacts = !options.name;
    let object;
    const randomMedusaStatue = objectType === STATUE
        && game._activeSpecialLevel?.prototype === 'medusa'
        && options.montype == null;
    if (randomMedusaStatue) {
        object = await medusaEmptyStatue(context, point, Object.hasOwn(options, 'contents'));
    }
    else if (objectType != null) {
        object = point
            ? await specialObjectAt(context, objectType, point.x, point.y, { named: !!options.name })
            : await specialObjectOfType(context, objectType, allowArtifacts);
    }
    else if (objectClass != null) {
        object = point
            ? await specialObjectClassAt(context, objectClass, point.x, point.y, allowArtifacts)
            : await specialObjectOfClass(context, objectClass, allowArtifacts);
    }
    else {
        object = point
            ? await specialRandomObjectAt(context, point.x, point.y, allowArtifacts)
            : await specialObject(context, allowArtifacts);
    }
    if (!object)
        return null;
    if (options.spe !== undefined && Number.isInteger(options.spe))
        object.spe = options.spe;
    if (options.buc === 'blessed') {
        blessObjectState(object);
    }
    else if (options.buc === 'uncursed') {
        unblessObjectState(object);
        uncurseObjectState(object);
    }
    else if (options.buc === 'cursed') {
        curseObjectState(object);
    }
    else if (options.buc === 'not-cursed') {
        uncurseObjectState(object);
    }
    else if (options.buc === 'not-uncursed') {
        if (!object.blessed && !object.cursed && !rn2(1)) {
            if (!rn2(2))
                curseObjectState(object);
            else
                blessObjectState(object);
        }
    }
    else if (options.buc === 'not-blessed') {
        unblessObjectState(object);
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
        && OBJECT_MERGE[object.otyp]) {
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
function applyLuaMonsterAppearance(monster, appearance) {
    if (!monster || !appearance)
        return;
    const mimic = MONSTER_SYMBOL[monster.mnum] === S_MIMIC;
    if (game.u.protectionFromShapeChangers || game.protectionFromShapeChangers
        || !(mimic || (ismnum(monster.cham) && appearance.kind === 'monster')))
        return;
    if (appearance.kind === 'object') {
        monster.m_ap_type = M_AP_OBJECT;
        monster.mappearance = appearance.type;
        return;
    }
    if (appearance.kind === 'monster') {
        let type = appearance.type;
        if (monsterIsVampireShifter(monster)) {
            const base = monster.cham;
            if (base === PM_VLAD_THE_IMPALER
                && monster.minvent?.some(object => object.otyp === CANDELABRUM_OF_INVOCATION)) {
                type = base;
            }
            else if ((MONSTER_FLAGS2[type] ?? 0) & M2_SHAPESHIFTER) {
                if (!ismnum(base))
                    throw new Error('A vampire shape needs its natural species');
                type = base;
            }
            else if (!(type === PM_VAMPIRE_BAT
                || type === MONSTER_NAME.indexOf('fog cloud')
                || (type === MONSTER_NAME.indexOf('wolf') && base !== PM_VAMPIRE)))
                return;
        }
        if (type === monster.mnum) {
            monster.m_ap_type = M_AP_NOTHING;
            monster.mappearance = 0;
        }
        else if (mimic || monster.iswiz) {
            monster.m_ap_type = M_AP_MONSTER;
            monster.mappearance = type;
        }
        else {
            const oldForm = monster.mnum;
            monster.female = shapechangerGender(monster.cham ?? oldForm, type, !!monster.female);
            setMonsterSpecies(monster, type);
            if (monsterEmitsLight(oldForm) !== monsterEmitsLight(type))
                game.vision_full_recalc = 1;
            if (!monster.perminvis || oldForm === PM_STALKER || oldForm === PM_BLACK_LIGHT)
                monster.perminvis = type === PM_STALKER || type === PM_BLACK_LIGHT;
        }
        return;
    }
    // C sp_lev.c:create_monster() stores the matching defsyms index,
    // which is distinct from the terrain type used by map locations.
    const symbol = MAP_SYMBOLS.findIndex(candidate => candidate.name === appearance.name);
    if (symbol < 0)
        throw new Error(`unsupported Lua monster appearance ${appearance.name}`);
    monster.m_ap_type = M_AP_FURNITURE;
    monster.mappearance = symbol;
}
export async function createLuaMonster(context, options) {
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
    const explicitAlignment = options.align != null
        && options.align !== 'random';
    // priest.c:mk_roamer() supplies its own flags, allowing random-species
    // companions and counting births regardless of Lua's creation options.
    const creation = explicitAlignment ? {
        randomAlignment: false,
        mmflags: MM_ADJACENTOK | MM_EMIN | MM_NOMSG,
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
            ? await specialMonsterAt(context, monsterType, point.x, point.y, settings)
            : await specialExplicitMonster(context, monsterType, null, settings);
        if (monster && options.nameFemale != null)
            monster.female = options.nameFemale;
    }
    else if (monsterClass != null) {
        monster = point
            ? await specialMonsterClassAt(context, monsterClass, point.x, point.y, null, { peaceful, asleep, ...creation })
            : await specialMonsterOfClass(context, monsterClass, { peaceful, asleep, ...creation });
    }
    else {
        monster = point
            ? await specialRandomMonsterAt(context, point.x, point.y, { peaceful, asleep, ...creation })
            : await specialMonster(context, {
                peaceful, asleep, ...creation,
            });
    }
    // sp_lev.c:lspo_monster() defaults class and random requests to male.
    // create_monster() restores the requested sex after any initial shape.
    if (monster) {
        const explicitFemale = options.female === true || options.female === 1
            ? true : options.female === false || options.female === 0 ? false : null;
        const fixedSex = monsterType == null ? 0 : MONSTER_FLAGS2[monsterType] ?? 0;
        const requestedFemale = fixedSex & M2_FEMALE ? true
            : fixedSex & M2_MALE ? false
                : explicitFemale ?? (monsterType == null ? false : !!monster.female);
        applyLuaMonsterAppearance(monster, options.appearance);
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
    return monster ?? null;
}
export async function createLuaTrap(context, options) {
    const { trapType, point } = options;
    const construction = {
        seen: !!options.seen,
        victim: options.victim !== false,
        spiderOnWeb: options.spider_on_web !== false,
    };
    const trap = await specialTrapOfType(context, trapType ?? NO_TRAP, construction, point);
    const teleportDestination = options.teledest ? tablePoint({ coord: options.teledest }) : null;
    if (trap && teleportDestination) {
        trap.teledest = {
            x: context.xstart + teleportDestination.x,
            y: context.ystart + teleportDestination.y,
        };
    }
    return trap;
}
export async function createLuaExclusion(context, options) {
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
// sp_lev.c:levregion_add() uses raw map-relative endpoints, never croom.
async function regionCoordinates(context, coordinates, levelCoordinates) {
    if (!coordinates)
        throw new TypeError('Lua region requires four coordinates');
    const [x1, y1, x2, y2] = coordinates;
    if (levelCoordinates)
        return { lx: x1, ly: y1, hx: x2, hy: y2 };
    const start = await getLocation(context, { x: x1, y: y1 }, ANY_LOC);
    const end = await getLocation(context, { x: x2, y: y2 }, ANY_LOC);
    return { lx: start.x, ly: start.y, hx: end.x, hy: end.y };
}
export async function levelRegionCoordinates(context, options) {
    const region = await regionCoordinates(context, options.region, options.region_islev);
    // l_get_lregion() keeps negative exclusion bounds off-map.
    const exclude = options.exclude ? await regionCoordinates(context, options.exclude, options.exclude[0] < 0 || options.exclude_islev) : null;
    return { region, exclude };
}
export function solidifyLuaMap(mappedCells) {
    const level = requireGameLevel();
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = level.at(x, y);
            if (location && IS_STWALL(location.typ) && !mappedCells.has(x, y))
                location.wall_info |= W_NONDIGGABLE | W_NONPASSWALL;
        }
    }
}
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
function accessibleSpecialTerrain(x, y) {
    const level = requireGameLevel();
    const type = level.at(x, y)?.typ;
    return type !== undefined && (ACCESSIBLE(type) || type === SDOOR || type === SCORR);
}
function floodAccessibleArea(selection, x, y) {
    selection.floodFill(x, y, true, accessibleSpecialTerrain);
}
async function addWayOut(x, y, reachable) {
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
export async function ensureWaysOut() {
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
        await addWayOut(unreachable.x, unreachable.y, reachable);
        floodAccessibleArea(reachable, unreachable.x, unreachable.y);
    }
}
async function specialRandomMonsterAt(context, x, y, { randomAlignment = true, peaceful = null, asleep = null, mmflags = 0, roamerAlignment = null, } = {}) {
    // A coordinate-only des.monster() resolves random alignment before
    // makemon(NULL, x, y), without a named species' find_montype() gender draw.
    if (randomAlignment)
        consumeSpecialMonsterAlignment();
    const alignment = typeof roamerAlignment === 'function'
        ? roamerAlignment() : roamerAlignment;
    const point = await getLocationCoord(context, { x, y }, DRY);
    const monster = await createSpecialMonster(context, null, point.x, point.y, mmflags);
    if (monster && peaceful != null)
        monster.mpeaceful = peaceful ? 1 : 0;
    if (monster && asleep != null)
        monster.msleeping = asleep ? 1 : 0;
    if (monster && alignment != null)
        finishSpecialRoamer(monster, alignment, peaceful ?? true);
    return monster;
}
export function removeFloorObject(object) {
    if (object?.where === 'floor')
        remove_object(object, game);
}
export async function addToContainer(container, object) {
    if (!container || !object)
        return object;
    removeFloorObject(object);
    return await addCreatedObjectToContainer(container, object, game);
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
export function medusaPetrifiable(mndx) {
    const resistance = mndx == null ? 0 : MONSTER_RESISTS[mndx] || 0;
    const stoneResistant = !!(resistance & 0x80);
    const changesToStoneGolem = mndx != null && MONSTER_SYMBOL[mndx] === 55 && mndx !== 257;
    return !stoneResistant && !changesToStoneGolem;
}
// C mk_trap_statue() and create_object(): direct extraction, not unwear_mon_obj.
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
async function medusaEmptyStatue(context, fixedPoint, deleteContents) {
    const point = await getLocationCoord(context, fixedPoint, DRY);
    const statue = await mksobj_at(STATUE, point.x, point.y, true, true);
    // sp_lev.c create_object() empties a `contents=` container (removing any
    // random spellbook) before the Medusa petrified-monster special case
    // moves the temporary actor's inventory into the statue.
    if (deleteContents)
        statue.contents = [];
    let mndx = statue.corpsenm ?? null;
    for (let attempt = 0; attempt < 1000; attempt++, mndx = rndmonnum()) {
        const was = await makemon(mndx, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG);
        if (!was)
            continue;
        if (mndx === null)
            throw new Error('Medusa statue monster has no species.');
        // makemon() can change the form; C tests poly_when_stoned(wastyp).
        if (monsterHasStoneResistance(was) || monsterPolymorphsWhenStoned({ mnum: mndx })) {
            await removeMonsterFromGame(was);
            continue;
        }
        propagateMonsterSpecies(mndx, true, false);
        statue.corpsenm = mndx;
        await putGeneratedMonsterInventoryInStatue(was, statue);
        await removeMonsterFromGame(was);
        break;
    }
    return statue;
}
export function markSpecialSelectionWallProperty(selection, property) {
    const level = requireGameLevel();
    selection.forEachXMajor((x, y) => {
        const loc = level.at(x, y);
        if (loc && (IS_STWALL(loc.typ) || loc.typ === TREE
            || loc.typ === IRONBARS))
            loc.wall_info |= property;
    });
}
export async function createLuaWallProperty(context, options) {
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
    const start = await getLocation(context, {
        x: x1 === -1 ? context.xstart - 1 : x1,
        y: y1 === -1 ? context.ystart - 1 : y1,
    }, ANY_LOC);
    const end = await getLocation(context, {
        x: x2 === -1 ? context.xstart + context.width + 1 : x2,
        y: y2 === -1 ? context.ystart + context.height + 1 : y2,
    }, ANY_LOC);
    const area = new SpecialSelection();
    for (let x = Math.max(1, start.x); x <= Math.min(COLNO - 1, end.x); x++)
        for (let y = Math.max(0, start.y); y <= Math.min(ROWNO - 1, end.y); y++)
            area.add(x, y);
    markSpecialSelectionWallProperty(area, property === 'nondiggable' ? W_NONDIGGABLE : W_NONPASSWALL);
}
export function specialMapSelection(context, rows = null) {
    // sp_lev.c:lspo_map() returns only cells whose glyph decoded to real
    // terrain.  In particular, `x` is MAX_TYPE/transparent: it leaves both
    // SpLev_Map and the returned selection clear at that coordinate.
    const selection = new SpecialSelection();
    for (let dy = 0; dy < context.height; dy++) {
        const row = rows?.[dy]?.padEnd(context.width, ' ');
        for (let dx = 0; dx < context.width; dx++) {
            if (row?.[dx] === 'x')
                continue;
            selection.add(context.xstart + dx, context.ystart + dy);
        }
    }
    return selection;
}
function lightSpecialArea(context, x1, y1, x2, y2, lit) {
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
function fillSpecialSwamp(fg = ROOM, bg = MOAT, lit = false) {
    const level = requireGameLevel();
    // sp_lev.c:lvlfill_swamp().  First establish the full moat background,
    // then run the x-major relaxed blockwise maze over even coordinates.
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    fillSpecialSolid(bg, lit);
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
export async function fillSpecialRoom(croom) {
    const level = requireGameLevel();
    if (!croom)
        return;
    for (const subroom of croom.sbrooms || [])
        await fillSpecialRoom(subroom);
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
function themedMapTerrain(ch) {
    if (ch === '.')
        return ROOM;
    if (ch === '-')
        return HWALL;
    if (ch === '|')
        return VWALL;
    if (ch === 'L')
        return LAVAPOOL;
    if (ch === 'P')
        return POOL;
    if (ch === '}')
        return MOAT;
    if (ch === ' ')
        return STONE;
    return null; // 'x' and any unsupported map character are see-through
}
function themedMapFits(rows, xstart, ystart) {
    const width = Math.max(...rows.map(row => row.length));
    const height = rows.length;
    for (let y = ystart - 1; y <= ystart + height; y++) {
        for (let x = xstart - 1; x <= xstart + width; x++) {
            if (!isok(x, y))
                return false;
            const loc = game.level?.at(x, y);
            if (!loc)
                return false;
            const outside = x < xstart || x >= xstart + width
                || y < ystart || y >= ystart + height;
            if (outside) {
                if (loc.typ !== STONE || loc.roomno)
                    return false;
                continue;
            }
            const terrain = themedMapTerrain(rows[y - ystart]?.[x - xstart]);
            if (terrain == null)
                continue;
            if ((loc.typ !== STONE && loc.typ !== terrain) || loc.roomno)
                return false;
        }
    }
    return true;
}
export function placeThemedMap(rows, lit) {
    const level = requireGameLevel();
    const width = Math.max(...rows.map(row => row.length));
    const height = rows.length;
    let xstart = 0, ystart = 0;
    for (let tryct = 0; tryct <= 100; tryct++) {
        xstart = 1 + rn2(COLNO - 1 - width);
        ystart = rn2(ROWNO - height);
        if (themedMapFits(rows, xstart, ystart))
            break;
        if (tryct === 100)
            return null;
    }
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const terrain = themedMapTerrain(rows[row]?.[col]);
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
    return { xstart, ystart, width, height };
}
export function luaSelectionCoordinates(selection) {
    const coordinates = [];
    selection.forEachLua((x, y) => coordinates.push({ x, y }));
    return coordinates;
}
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
// C ref: sp_lev.c create_room()
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
// C ref: sp_lev.c dig_corridor()
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
// C ref: sp_lev.c wallify_map().  This is the producer half of Lua's
// des.wallify(): turn solid rock touching room terrain (including diagonals)
// into a provisional straight wall.  The ordinary wallification pass below
// then resolves corners and junctions.  Iterate y-major to preserve C's
// mutation order, although newly created walls do not themselves propagate.
export function wallifyMap(x1, y1, x2, y2) {
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
//# sourceMappingURL=sp_lev.js.map