// mkroom.js - special room selection and filling.
// C refs: mkroom.c — mkshop(), pick_room(), mkzoo(), mktemple(),
// mkswamp(), fill_zoo() and its zoo/court/morgue/barracks/beehive branches,
// morguemon(), antholemon(), courtmon(), squadmon(), nexttodoor(),
// shrine_pos(); plus the coordinate selectors somexy()/somexyspace() and
// mklev.c occupied() that share this file's room table.
import { game, requireGameLevel } from './gstate.js';
import { isPoolOrLavaAt } from './terrain_properties.js';
import { rn2, rnd, rn1 } from './rng.js';
import { CmapSymbol } from './glyph_numbers.js';
import { AIR, ALTAR, AM_SHRINE, ANTHOLE, ANY_SHOP, ANY_TYPE, BARRACKS, BEEHIVE, BLCORNER, BRCORNER, CLOUD, COCKNEST, CORR, COURT, CROSSWALL, LEPREHALL, DBWALL, DOOR, DRAWBRIDGE_DOWN, FILL_NORMAL, FOUNTAIN, GRAVE, HWALL, ICE, IRONBARS, IS_DOOR, IS_FURNITURE, IS_ROOM, IS_WALL, LADDER, LAVAPOOL, LAVAWALL, MM_ASLEEP, MM_NOGRP, MORGUE, OROOM, POOL, ROOM, ROOMOFFSET, SHOPBASE, SDOOR, SINK, SPACE_POS, STAIRS, STONE, SWAMP, TEMPLE, TDWALL, THRONE, TLCORNER, TLWALL, TRCORNER, TREE, TRWALL, TUWALL, VWALL, WATER, ZOO, isok, Align2amask, In_endgame, A_NONE, G_GONE, } from './const.js';
import { CORPSE, CHEST, GOLD_PIECE, LARGE_BOX, LUMP_OF_ROYAL_JELLY, MACE, STATUE, } from './object_data.js';
import { RANDOM_SHOP_TYPES } from './shop_data.js';
import { insideRoom } from './room.js';
import { level_difficulty, inducedAlignment } from './dungeon.js';
import { makemon, mkclass } from './makemon.js';
import { createToptenObject, mkgold, mkobj, mkobj_at, mksobj, mksobj_at, } from './mkobj.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { setMonsterMalign } from './monster_alignment.js';
import { monsterAtPosition } from './monster_location.js';
import { objectWeight } from './weight.js';
import { deleteEngravingAt } from './engrave.js';
import { normalDemon } from './minion.js';
import { impossible } from './diagnostics.js';
import { addToContainer } from './sp_lev.js';
import { MONSTER_NAME } from './monster_data.js';
import { specialShrinePriest } from './priest.js';
import { FOOD_CLASS, RANDOM_CLASS, SPBOOK_CLASS, WAND_CLASS, make_grave, topologize, } from './mklev.js';
import { isRoom } from './map_types.js';
// Species constants (normally from monst.js, not in contest template)
const PM_GNOME_RULER = 168;
const PM_GIANT_EEL = 319;
export const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;
// C search_special(): search ordinary rooms first, then their subrooms.
export function searchSpecial(type, state = game) {
    for (const rooms of [state.level?.rooms ?? [], state.level?.subrooms ?? []]) {
        for (const room of rooms) {
            if (!isRoom(room) || room.hx < 0)
                break;
            if ((type === ANY_TYPE && room.rtype !== OROOM)
                || (type === ANY_SHOP && room.rtype >= SHOPBASE)
                || room.rtype === type)
                return room;
        }
    }
    return null;
}
// C mkroom.c:cmap_to_type(). Display symbols and terrain have separate
// number spaces, including symbols with several appearances for one terrain.
export function cmapToType(symbol) {
    switch (symbol) {
        case CmapSymbol.stone: return STONE;
        case CmapSymbol.vwall: return VWALL;
        case CmapSymbol.hwall: return HWALL;
        case CmapSymbol.tlcorn: return TLCORNER;
        case CmapSymbol.trcorn: return TRCORNER;
        case CmapSymbol.blcorn: return BLCORNER;
        case CmapSymbol.brcorn: return BRCORNER;
        case CmapSymbol.crwall: return CROSSWALL;
        case CmapSymbol.tuwall: return TUWALL;
        case CmapSymbol.tdwall: return TDWALL;
        case CmapSymbol.tlwall: return TLWALL;
        case CmapSymbol.trwall: return TRWALL;
        case CmapSymbol.ndoor:
        case CmapSymbol.vodoor:
        case CmapSymbol.hodoor:
        case CmapSymbol.vcdoor:
        case CmapSymbol.hcdoor: return DOOR;
        case CmapSymbol.bars: return IRONBARS;
        case CmapSymbol.tree: return TREE;
        case CmapSymbol.room:
        case CmapSymbol.darkroom: return ROOM;
        case CmapSymbol.corr:
        case CmapSymbol.litcorr: return CORR;
        case CmapSymbol.upstair:
        case CmapSymbol.dnstair: return STAIRS;
        case CmapSymbol.upladder:
        case CmapSymbol.dnladder: return LADDER;
        case CmapSymbol.altar: return ALTAR;
        case CmapSymbol.grave: return GRAVE;
        case CmapSymbol.throne: return THRONE;
        case CmapSymbol.sink: return SINK;
        case CmapSymbol.fountain: return FOUNTAIN;
        case CmapSymbol.pool: return POOL;
        case CmapSymbol.ice: return ICE;
        case CmapSymbol.lava: return LAVAPOOL;
        case CmapSymbol.vodbridge:
        case CmapSymbol.hodbridge: return DRAWBRIDGE_DOWN;
        case CmapSymbol.vcdbridge:
        case CmapSymbol.hcdbridge: return DBWALL;
        case CmapSymbol.air: return AIR;
        case CmapSymbol.cloud: return CLOUD;
        case CmapSymbol.water: return WATER;
        case CmapSymbol.lavawall: return LAVAWALL;
        default: return STONE;
    }
}
export function somex(room) {
    return rn1(room.hx - room.lx + 1, room.lx);
}
export function somey(room) {
    return rn1(room.hy - room.ly + 1, room.ly);
}
export function occupied(x, y, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return false;
    const trapped = state.level?.traps?.some(trap => trap.tx === x && trap.ty === y);
    return !!(trapped || IS_FURNITURE(location.typ)
        || isPoolOrLavaAt(x, y, state));
}
export function somexy(room, coordinate, state = game) {
    if (room.irregular) {
        const roomNumber = (room.roomnoidx ?? -1) + ROOMOFFSET;
        let attempts = 0;
        while (attempts++ < 100) {
            coordinate.x = somex(room);
            coordinate.y = somey(room);
            const location = state.level?.at?.(coordinate.x, coordinate.y);
            if (location && !location.edge
                && location.roomno === roomNumber)
                return true;
        }
        for (coordinate.x = room.lx; coordinate.x <= room.hx; coordinate.x++) {
            for (coordinate.y = room.ly; coordinate.y <= room.hy; coordinate.y++) {
                const location = state.level?.at?.(coordinate.x, coordinate.y);
                if (location && !location.edge
                    && location.roomno === roomNumber)
                    return true;
            }
        }
        return false;
    }
    if (!room.nsubrooms) {
        coordinate.x = somex(room);
        coordinate.y = somey(room);
        return true;
    }
    let attempts = 0;
    while (attempts++ < 100) {
        coordinate.x = somex(room);
        coordinate.y = somey(room);
        const location = state.level?.at?.(coordinate.x, coordinate.y);
        if (location && IS_WALL(location.typ))
            continue;
        if ((room.sbrooms || []).some(subroom => insideRoom(state.level, subroom, coordinate.x, coordinate.y)))
            continue;
        return attempts < 100;
    }
    return false;
}
export function somexyspace(room, coordinate, state = game) {
    let attempts = 0;
    let valid;
    do {
        valid = somexy(room, coordinate, state)
            && isok(coordinate.x, coordinate.y)
            && !occupied(coordinate.x, coordinate.y, state);
        if (valid) {
            const location = state.level?.at?.(coordinate.x, coordinate.y);
            valid = !!location && [ROOM, CORR, ICE].includes(location.typ);
        }
    } while (attempts++ < 100 && !valid);
    return !!valid;
}
export function roomHasStair(croom, up) {
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
export async function mkshop() {
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
export function shrinePosition(room) {
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
export async function markRandomSpecialRoom(roomType) {
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
export function antholeMonsterType() {
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
//# sourceMappingURL=mkroom.js.map