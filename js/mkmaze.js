// mkmaze.js — the mkmaze.c module: wall topology and spine repair,
// set_levltyp, lregion/portal placement, fixup_special and the named
// special-level fixups, makemaz and the random maze fillers, the orc-raid
// stolen booty, and the Plane of Water/Air bubbles. sp_lev.c construction
// lives in sp_lev.ts; regular room-and-corridor generation
// stays in mklev.ts.
import { RANDOM_CLASS, GEM_CLASS, RING_CLASS, FOOD_CLASS } from './objclass.js';
import { game, requireGameLevel, requireInitializedGame, requirePlayingGame } from './gstate.js';
import { rn2, rnd, rn1 } from './rng.js';
import { ACCESSIBLE, AIR, ALTAR, BLCORNER, BRCORNER, CLOUD, COLNO, CORR, CROSSWALL, DBWALL, D_NODOOR, FOUNTAIN, HWALL, ICED_MOAT, ICED_POOL, ICE, In_mines, In_quest, Invocation_lev, IRONBARS, IS_DOOR, IS_LAVA, IS_STWALL, IS_WALL, Is_airlevel, Is_earthlevel, Is_firelevel, Is_stronghold, Is_waterlevel, LAVAPOOL, LAVAWALL, LR_BRANCH, LR_DOWNSTAIR, LR_DOWNTELE, LR_PORTAL, LR_TELE, LR_UPSTAIR, LR_UPTELE, MAGIC_PORTAL, MAX_TYPE, MIGR_LEFTOVERS, MIGR_RANDOM, MIGR_TO_SPECIES, MM_NONAME, MON_BUBBLEMOVE, NON_PM, POOL, ROOM, ROWNO, SDOOR, SINK, SPACE_POS, STONE, TDWALL, TLCORNER, TLWALL, TRCORNER, TRWALL, TUWALL, VWALL, VIBRATING_SQUARE, WATER, W_NONDIGGABLE, W_NONPASSWALL, RLOC_ERR, RLOC_NOMSG, LEVEL_TIMER_KIND } from './const.js';
import { isok } from './cmd.js';
import { isPoolAt, isIceAt } from './dbridge.js';
import { CORPSE, EGG, GOLD_PIECE, LEATHER_GLOVES, LEMBAS_WAFER, LONG_SWORD, ROCK, SKELETON_KEY, SLIME_MOLD, TALLOW_CANDLE, TIN, TRIPE_RATION, WAX_CANDLE, BOULDER, STATUE, OBJECT_NAMES } from './object_data.js';
import { createPoisonGasCloud } from './regions.js';
import { heroIsDeaf } from './senses.js';
import { plineWithContinuation } from './pline.js';
import { monsterAtPosition } from './steed.js';
import { randomMonsterRelocation } from './teleport.js';
import { deleteTrap, maketrap } from './trap.js';
import { canOverwriteTerrain, cmapSymbolAppearance, newsym } from './display.js';
import { CLR_BRIGHT_BLUE, CLR_CYAN, CLR_GRAY } from './terminal.js';
import { CmapSymbol } from './glyph_numbers.js';
import { placeObject, remove_object } from './mkobj.js';
import { stack_object } from './invent.js';
import { clearMonsterWormFromMap } from './worm.js';
import { block_point, recalc_block_point, unblock_point, vision_recalc } from './vision.js';
import { heroIsPunished, reserveBallAndChainPlacement, restoreBallAndChainPlacement } from './ball.js';
import { stopLevelTimer } from './timeout.js';
import { fill_special_room, load_special, medusaPetrifiable } from './sp_lev.js';
import { goodPosition } from './teleport.js';
import { mkcorpstat, createToptenObject, mkgold, mkobj, mkobj_at, mksobj, deallocateObject, objectWeight, rndmonnum, set_corpsenm, mksobj_at, updateIceObjectTimersAt } from './mkobj.js';
import { makemon, makemonAt, setMonsterMalign } from './makemon.js';
import { occupied } from './mkroom.js';
import { objectProb } from './o_init.js';
import { upstart } from './hacklib.js';
import { addFruit } from './options.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { randomOrcName, setMonsterGivenName } from './do_name.js';
import { addObjectToMonsterInventory } from './steal.js';
import { randomTypeByDescription } from './objnam.js';
import { migrateMonsterOffLevel } from './dog.js';
import { is_orc } from './mondata.js';
import { premap_detect } from './detect.js';
import { placeHeroOnLevel, specialLevelAt } from './dungeon.js';
import { impossible } from './diagnostics.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { NO_TRAP, PM_MINOTAUR, countLevelFeatures, is_branchlev, mkstairs, mktrap, place_branch, placeBranchAt, stairway_find_dir } from './mklev.js';
import { isRoom } from './map_types.js';
import { sendMonsterToLimbo, mnearto, dealWithMonsterOvercrowding, moveMonsterNextToHero } from './mon.js';
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
// C mkmaze.c mz_move() direction order: north, east, south, west.
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// C mkmaze.c:is_solid().
function isSolidTile(x, y) {
    if (!isok(x, y))
        return true;
    return IS_STWALL(game.level?.at(x, y)?.typ ?? STONE);
}
// C mkmaze.c:iswall_or_stone().
function isWallOrStone(x, y) {
    if (!isok(x, y))
        return 1;
    const typ = game.level?.at(x, y)?.typ ?? STONE;
    return (typ === STONE || isWallTile(x, y)) ? 1 : 0;
}
// C mkmaze.c:iswall().
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
// C mkmaze.c:okay(): after mz_move() twice in the given direction, the cell
// must still lie inside the active maze bounds and be untouched stone.
function okay(x, y, dir, mazeXMax, mazeYMax, level) {
    const step = directions[dir];
    if (!step)
        throw new RangeError(`mz_move: bad direction ${dir}`);
    const nx = x + 2 * step[0], ny = y + 2 * step[1];
    if (nx < 3 || ny < 3 || nx > mazeXMax || ny > mazeYMax)
        return false;
    return level.requireAt(nx, ny).typ === STONE;
}
// C mkmaze.c:maze0xy(): find random starting point for maze generation.
function maze0xy(mazeXMax, mazeYMax) {
    return {
        x: 3 + 2 * rn2((mazeXMax >> 1) - 1),
        y: 3 + 2 * rn2((mazeYMax >> 1) - 1),
    };
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
// C mkmaze.c:is_exclusion_zone().
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
async function generateMineFiller(active) {
    active.file = 'minefill.lua';
    await generateSpecialAndFixup(load_special, active);
}
export async function generateVladsTowerLevel(active) {
    if (!/^tower[1-3]$/.test(active?.prototype))
        throw new RangeError(`unknown Vlad tower level ${active?.prototype}`);
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(load_special, active);
}
export async function generateMinesEnd(active) {
    if (active.variant === undefined || active.variant < 1 || active.variant > 3) {
        throw new RangeError(`unknown Mines' End layout ${active?.variant}`);
    }
    active.file = `minend-${active.variant}.lua`;
    await generateSpecialAndFixup(load_special, active);
}
export async function generateMinetown(active) {
    const level = requireGameLevel();
    if (active.variant === undefined || active.variant < 1 || active.variant > 7) {
        throw new RangeError(`unknown Minetown layout ${active?.variant}`);
    }
    active.file = `minetn-${active.variant}.lua`;
    await generateSpecialAndFixup(load_special, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fill_special_room(room);
}
export function isLuaQuestPrototype(prototype) {
    return /^[A-Z][a-z]{2}-(strt|loca|goal|fila|filb)$/.test(prototype);
}
export async function generateLuaQuestLevel(active) {
    if (!isLuaQuestPrototype(active?.prototype))
        throw new RangeError(`unknown quest level ${active?.prototype}`);
    await generateSpecialAndFixup(load_special, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fill_special_room(room);
}
export async function generateOracleLevel(active) {
    if (active?.prototype !== 'oracle')
        throw new RangeError(`unknown Oracle level ${active?.prototype}`);
    active.file = 'oracle.lua';
    await generateSpecialAndFixup(load_special, active);
}
export async function generateBigRoom(active) {
    if (active.variant === undefined || active.variant < 1 || active.variant > 13)
        throw new RangeError(`unknown Big Room variant ${active?.variant}`);
    await generateSpecialAndFixup(load_special, active);
}
export async function generateElementalPlane(active) {
    active.file = `${active.prototype}.lua`;
    if (active.prototype === 'air' || active.prototype === 'water')
        active.elementalBubbles = true;
    if (active.prototype === 'water')
        requireGameLevel().flags.waterlevel = true;
    await generateSpecialAndFixup(load_special, active);
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
    await generateSpecialAndFixup(load_special, active);
}
export async function generateWizardLevel(active) {
    const level = requireGameLevel();
    active.file = `${active.prototype}.lua`;
    await generateSpecialAndFixup(load_special, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fill_special_room(room);
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
    await generateSpecialAndFixup(load_special, active);
}
export async function generateHellFillerLevel(active) {
    const level = requireGameLevel();
    if (active?.prototype !== 'hellfill')
        throw new RangeError(`unknown Hell filler ${active?.prototype}`);
    active.file = 'hellfill.lua';
    await generateSpecialAndFixup(load_special, active);
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fill_special_room(room);
}
export async function generateMedusaLevel(active) {
    if (active.variant === undefined || active.variant < 1 || active.variant > 4) {
        throw new RangeError(`unknown Medusa variant ${active?.variant}`);
    }
    await generateSpecialAndFixup(load_special, active);
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
        : await mkcorpstat(STATUE, null, null, point.x, point.y, 0);
    for (let tries = 0; tries < 99
        && statue && !medusaPetrifiable(statue.corpsenm); tries++)
        set_corpsenm(statue, rndmonnum());
}
// C mkmaze.c:baalz_fixup(): rebuild the beetle's nondiggable perimeter so
// ordinary wallification keeps the leg walls.
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
// fixup_special()'s region pass: regions are processed in Lua declaration
// order; this helper owns that loop for the port below.
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
export async function generateSpecialAndFixup(generator, active) {
    await generator(active);
    await fixupSpecial(active);
}
// C mkmaze.c:fixup_special(), after the Lua level has finished construction.
// Also C mkmaze.c:check_ransacked(): inlined here (the minetn-1 raid test).
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
        await setup_waterlevel();
    await fixupSpecialRegions(active);
    // fixup_special() reduces undead remains throughout the Castle and the
    // Priest quest, even after the hero has entered any morgue rooms.
    if (Is_stronghold(game.u.uz) || game.urole?.key === 'priest' && In_quest(game.u.uz))
        level.flags.graveyard = true;
    if (active?.baalzFixup)
        await fixupBaalz(active);
    if (active.file === 'minetn-1.lua' && In_mines(game.u.uz))
        await stolen_booty();
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
export async function generateSokobanLevel(active) {
    if (!/^soko[1-4]$/.test(active?.prototype)
        || active.variant === undefined || active.variant < 1 || active.variant > 2) {
        throw new RangeError(`unknown Sokoban level ${active?.prototype}-${active?.variant}`);
    }
    active.file = `${active.prototype}-${active.variant}.lua`;
    await generateSpecialAndFixup(load_special, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fill_special_room(room);
}
export async function generateSokobanLevel2(active) {
    if (active?.prototype !== 'soko2') {
        throw new RangeError(`unknown Sokoban level 2 ${active?.prototype}`);
    }
    await generateSokobanLevel(active);
}
export async function generateKnoxLevel(active) {
    if (active?.prototype !== 'knox')
        throw new RangeError(`unknown Knox level ${active?.prototype}`);
    active.file = 'knox.lua';
    await generateSpecialAndFixup(load_special, active);
    const level = requireGameLevel();
    for (const room of level.rooms.slice(0, level.nroom))
        if (isRoom(room))
            await fill_special_room(room);
}
// check_ransacked()'s ORC_LEADER marker and orcfruit[] table, plus the
// monster/object indices the raid needs.  C mkmaze.c:706-714.
const C_RATION = OBJECT_NAMES.indexOf('C-ration');
const K_RATION = OBJECT_NAMES.indexOf('K-ration');
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
const M2_ORC = 0x80;
const DELIVER_SPECIES = 0x21fe; // undead, were, human, elf, dwarf, gnome, orc, demon, giant
const PM_ORC = MONSTER_NAME.indexOf('orc');
const PM_ORC_SHAMAN = MONSTER_NAME.indexOf('orc shaman');
const PM_ORC_CAPTAIN = MONSTER_NAME.indexOf('orc-captain');
// do_name.c:christen_orc(): the gang name is composed into the orc's given
// name.  Shared by stolen_booty() and the booty delivery below.
function nameOrc(monster, gang, suffix = '') {
    const name = upstart(randomOrcName());
    setMonsterGivenName(monster, gang === null ? name + suffix : `${name} of ${upstart(gang)}`);
}
// C mkmaze.c:migrate_orc().
async function migrate_orc(monster, leader, state) {
    const current = state.u.uz;
    const bottom = state.dungeons[current.dnum]?.num_dunlevs;
    if (bottom === undefined)
        throw new Error('Orc raid requires the current Mines branch.');
    let destination;
    if (leader) {
        destination = bottom - Number(rn2(40) === 0);
        monster.migflags = (monster.migflags ?? 0) | MIGR_LEFTOVERS;
    }
    else {
        destination = Math.min(bottom, Math.max(current.dlevel + 1, current.dlevel + rn2(bottom - current.dlevel + 1)));
        monster.migflags = (monster.migflags ?? 0) & ~MIGR_LEFTOVERS;
    }
    await migrateMonsterOffLevel(monster, state, { dst: { dnum: current.dnum, dlevel: destination } }, { kind: 'level-migration', mode: MIGR_RANDOM });
}
// C mkmaze.c:shiny_orc_stuff().
// C objnam.c:shiny_obj(): the captain's ring is a random "shiny"
// description match within the ring class.
async function shiny_orc_stuff(monster, state) {
    const captain = monster.mnum === PM_ORC_CAPTAIN;
    const goldChance = captain ? 600 : 300;
    if (rn2(1000) < goldChance) {
        const gold = await mksobj(GOLD_PIECE, true, false);
        gold.quan = 1 + rnd(goldChance);
        gold.owt = objectWeight(gold);
        await addObjectToMonsterInventory(monster, gold, state);
    }
    if (rn2(1000) < goldChance / 4) {
        const gem = await mkobj(GEM_CLASS, false);
        if (gem.otyp !== ROCK)
            await addObjectToMonsterInventory(monster, gem, state);
        else
            deallocateObject(gem, state);
    }
    if (captain || rn2(8) === 0) {
        const type = randomTypeByDescription('shiny', RING_CLASS, 0, state);
        if (type !== null)
            await addObjectToMonsterInventory(monster, await mksobj(type, true, false), state);
    }
}
// C mkmaze.c:migr_booty_item().
// C mkobj.c:mksobj_migr_to_species(): the object enters migration flagged
// for orc-infested target species.
async function migr_booty_item(type, gang, state) {
    const object = await mksobj(type, true, false);
    object.where = 'migrating';
    object.owornmask = MIGR_TO_SPECIES;
    object.migration = { source: { dnum: 0, dlevel: 0 }, destination: { dnum: 0, dlevel: 0 },
        arrival: MIGR_TO_SPECIES, speciesFlags: M2_ORC };
    object.oextra ??= {};
    object.oextra.oname = gang;
    state.migratingObjects ??= [];
    state.migratingObjects.unshift(object);
    if (object.oclass === FOOD_CLASS) {
        if (type === SLIME_MOLD)
            object.spe = addFruit(rn2(2) ? 'dwarven root' : 'paddle cactus', { state });
        object.quan += rn2(3);
        object.owt = objectWeight(object);
    }
}
// C mkmaze.c:stolen_booty().
export async function stolen_booty() {
    requirePlayingGame(game);
    const state = game;
    const gang = randomOrcName();
    // create the stuff that the gang took
    let count = rnd(4);
    for (; count > 0; count--)
        await migr_booty_item(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, gang, state);
    count = rnd(3);
    for (; count > 0; count--)
        await migr_booty_item(SKELETON_KEY, gang, state);
    await migr_booty_item(LEATHER_GLOVES + rn2(GAUNTLETS_OF_DEXTERITY - LEATHER_GLOVES + 1), gang, state);
    count = rnd(10);
    for (; count > 0; count--) {
        // Food items - but no lembas! (or some other weird things)
        const type = TRIPE_RATION + rn2(TIN - TRIPE_RATION + 1);
        if (type !== LEMBAS_WAFER && ((objectProb[type] ?? 0) > 0 || type === C_RATION || type === K_RATION)
            && type !== CORPSE && type !== EGG && type !== TIN)
            await migr_booty_item(type, gang, state);
    }
    await migr_booty_item(rn2(2) ? LONG_SWORD : SILVER_SABER, gang, state);
    // create the leader of the orc gang
    const captain = await makemonAt(PM_ORC_CAPTAIN, 0, 0, MM_NONAME);
    if (captain) {
        setMonsterGivenName(captain, upstart(gang));
        captain.mpeaceful = 0;
        setMonsterMalign(captain, state);
        await shiny_orc_stuff(captain, state);
        await migrate_orc(captain, true, state);
    }
    // Make most of the orcs on the level be part of the invading gang.
    // C fmon is newest-first; the runtime monster array stores births in order.
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0)
            continue;
        if (is_orc(monster.mnum) && !monster.name && rn2(10)) {
            // Don't christen the orc captain from the level description as a
            // subordinate member of the main orc horde.
            if (monster.mnum !== PM_ORC_CAPTAIN)
                nameOrc(monster, gang);
        }
    }
    // Lastly, ensure there's several more orcs from the gang along the way.
    // The mechanics are such that they aren't actually identified as members
    // of the invading gang until they get their spoils assigned to the
    // inventory; handled during that assignment.
    for (count = rn2(10) + 5; count > 0; count--) {
        const monster = await makemonAt(PM_ORC + rn2(PM_ORC_SHAMAN - PM_ORC + 1), 0, 0, MM_NONAME);
        if (!monster)
            continue;
        await shiny_orc_stuff(monster, state);
        await migrate_orc(monster, false, state);
    }
}
// dokick.c:deliver_obj_to_mon()/dog.c: migrated MIGR_TO_SPECIES booty is
// handed to the first matching monster that is created or arrives.  The
// species flags ride the object's overloaded owornmask/corpsenm fields,
// which is why the food filters above exclude them.
export async function deliverOrcRaidLoot(monster, state, all = false) {
    for (const object of [...(state.migratingObjects ?? [])]) {
        const migration = object.migration;
        if (!migration || !(migration.arrival & MIGR_TO_SPECIES)
            || migration.speciesFlags === undefined || migration.speciesFlags === NON_PM
            || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & DELIVER_SPECIES) !== migration.speciesFlags)
            continue;
        const index = state.migratingObjects?.indexOf(object) ?? -1;
        if (index >= 0)
            state.migratingObjects?.splice(index, 1);
        object.where = 'free';
        object.owornmask = 0;
        object.ox = object.oy = 0;
        if ((migration.speciesFlags & M2_ORC) && object.oextra?.oname) {
            if (!monster.name) {
                const inMines = state.u.uz?.dnum === state.mines_dnum;
                if (inMines || rn2(2) === 0)
                    nameOrc(monster, inMines ? object.oextra.oname : null, ' the Fence');
            }
            delete object.oextra.oname;
        }
        object.corpsenm = NON_PM;
        delete object.migration;
        await addObjectToMonsterInventory(monster, object, state);
        if (!all)
            break;
    }
}
// C mkmaze.c:maze_inbounds().
function maze_inbounds(x, y, mazeXMax, mazeYMax) {
    // isok() test is superfluous here (unless something has clobbered the
    // maze bounds), exactly as in C.
    return x >= 2 && y >= 2 && x < mazeXMax && y < mazeYMax && isok(x, y);
}
// C mkmaze.c:maze_remove_deadends(). mz_move() steps one cell per call; the
// two-step probe decides whether opening the near cell joins another passage.
function maze_remove_deadends(level, typ, mazeXMax, mazeYMax) {
    for (let x = 2; x < mazeXMax; x++)
        for (let y = 2; y < mazeYMax; y++)
            if (ACCESSIBLE(level.requireAt(x, y).typ) && x % 2 && y % 2) {
                const dirok = [];
                let idx2 = 0;
                for (let dir = 0; dir < 4; dir++) {
                    const step = directions[dir];
                    if (!step)
                        throw new RangeError(`mz_move: bad direction ${dir}`);
                    let dx = x, dy = y;
                    dx += step[0];
                    dy += step[1];
                    if (!maze_inbounds(dx, dy, mazeXMax, mazeYMax)) {
                        idx2++;
                        continue;
                    }
                    let dx2 = x, dy2 = y;
                    dx2 += 2 * step[0];
                    dy2 += 2 * step[1];
                    if (!maze_inbounds(dx2, dy2, mazeXMax, mazeYMax)) {
                        idx2++;
                        continue;
                    }
                    if (!ACCESSIBLE(level.requireAt(dx, dy).typ)
                        && ACCESSIBLE(level.requireAt(dx2, dy2).typ)) {
                        dirok.push(dir);
                        idx2++;
                    }
                }
                if (idx2 >= 3 && dirok.length) {
                    const dir = dirok[rn2(dirok.length)];
                    const step = dir === undefined ? undefined : directions[dir];
                    if (!step)
                        throw new RangeError('Maze dead-end opening is out of range.');
                    level.requireAt(x + step[0], y + step[1]).typ = typ;
                }
            }
}
// C mkmaze.c:create_maze() with the maze grid scaled to corridor and wall.
// The grid lives directly on the map; bounds and the scaled-up copy follow
// create_maze()'s own order.
export function create_maze(corridorWidth = -1, wallThickness = -1, removeDeadEnds = false, state = game) {
    const level = requireGameLevel(state);
    const nativeXMax = (COLNO - 1) & ~1;
    const nativeYMax = (ROWNO - 1) & ~1;
    if (corridorWidth === -1)
        corridorWidth = rnd(4);
    if (wallThickness === -1)
        wallThickness = rnd(4) - corridorWidth;
    if (wallThickness < 1)
        wallThickness = 1;
    else if (wallThickness > 5)
        wallThickness = 5;
    if (corridorWidth < 1)
        corridorWidth = 1;
    else if (corridorWidth > 5)
        corridorWidth = 5;
    const scale = corridorWidth + wallThickness;
    const rdx = Math.trunc(nativeXMax / scale);
    const rdy = Math.trunc(nativeYMax / scale);
    const mazeXMax = rdx * 2;
    const mazeYMax = rdy * 2;
    const passageType = level.flags.corrmaze ? CORR : ROOM;
    /* fill the maze grid */
    if (level.flags.corrmaze)
        for (let x = 2; x < mazeXMax; x++)
            for (let y = 2; y < mazeYMax; y++)
                level.requireAt(x, y).typ = STONE;
    else
        for (let x = 2; x <= mazeXMax; x++)
            for (let y = 2; y <= mazeYMax; y++)
                level.requireAt(x, y).typ = ((x % 2) && (y % 2))
                    ? STONE : HWALL;
    /* create maze */
    const mm = maze0xy(mazeXMax, mazeYMax);
    walkfrom(mm.x, mm.y, 0, mazeXMax, mazeYMax, state);
    if (removeDeadEnds)
        maze_remove_deadends(level, passageType, mazeXMax, mazeYMax);
    /* scale maze up if needed */
    if (scale > 2) {
        // Scaling copies terrain only; lighting and other cell fields stay local.
        const saved = Array.from({ length: nativeXMax }, (_, x) => Array.from({ length: nativeYMax }, (_, y) => level.requireAt(x, y).typ));
        let rx = 2, x = 2;
        while (rx < nativeXMax) {
            const mx = x % 2 ? corridorWidth : (x === 2 || x === mazeXMax) ? 1 : wallThickness;
            let ry = 2, y = 2;
            while (ry < nativeYMax) {
                const my = y % 2 ? corridorWidth : (y === 2 || y === mazeYMax) ? 1 : wallThickness;
                for (let dx = 0; dx < mx; dx++) {
                    for (let dy = 0; dy < my; dy++) {
                        if (rx + dx >= nativeXMax || ry + dy >= nativeYMax)
                            break;
                        const terrain = saved[x]?.[y];
                        if (terrain === undefined)
                            throw new RangeError(`Missing maze terrain at ${x},${y}`);
                        level.requireAt(rx + dx, ry + dy).typ = terrain;
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
// C mkmaze.c:makemaz("") with no dungeon prototype or fill script.
export async function generateRandomMaze() {
    const level = requireGameLevel();
    level.flags.is_maze_lev = true;
    level.flags.corrmaze = rn2(3) === 0;
    const invocation = Invocation_lev(game.u.uz);
    if (!invocation && rn2(2))
        create_maze(-1, -1, rn2(5) === 0);
    else
        create_maze(1, 1, false);
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
// C mkmaze.c:walkfrom() (recursive form).  C resumes at the recursive child's
// coordinates, which mz_move() already changed; restoring the parent's
// coordinates changes the maze.
export function walkfrom(x, y, passageType, mazeXMax, mazeYMax, state = game) {
    const level = requireGameLevel(state);
    const typ = passageType || (level.flags.corrmaze ? CORR : ROOM);
    const start = level.requireAt(x, y);
    if (!IS_DOOR(start.typ)) {
        // might still be on edge of MAP, so don't overwrite
        start.typ = typ;
        start.flags = 0;
    }
    for (;;) {
        const dirs = [];
        for (let dir = 0; dir < 4; dir++)
            if (okay(x, y, dir, mazeXMax, mazeYMax, level))
                dirs.push(dir);
        if (!dirs.length)
            return;
        const dir = dirs[rn2(dirs.length)];
        const step = dir === undefined ? undefined : directions[dir];
        if (!step)
            throw new RangeError('Maze direction selection is out of range.');
        x += step[0];
        y += step[1];
        level.requireAt(x, y).typ = typ;
        x += step[0];
        y += step[1];
        walkfrom(x, y, typ, mazeXMax, mazeYMax, state);
    }
}
// C mazexy(): generated maze cargo uses ROOM or CORR of the selected
// style, rather than any accessible terrain or the former odd-cell grid.
export function mazeFloorPoint() {
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
// C mkmaze.c:populate_maze().
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
export async function generateDungeonMazeFile(prototype) {
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
        await generateSpecialAndFixup(load_special, active);
        const level = requireGameLevel();
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room))
                await fill_special_room(room);
    }
}
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
export function bound_digging() {
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
// C ref: mkmaze.c:fumaroles(). Lava vents leave damaging gas even though
// fire striking water leaves harmless steam. Called from goto_level() when
// arriving and moveloop_core() when on the level.
export async function fumaroles(state = requireInitializedGame()) {
    let cloudCount = rn2(3);
    let minimumSize = 5;
    if (Is_firelevel(state.u?.uz)) {
        cloudCount++;
        minimumSize += 5;
    }
    if ((state.level?.flags?.temperature || 0) > 0) {
        cloudCount++;
        minimumSize += 5;
    }
    let heard = false;
    let loud = false;
    for (let count = cloudCount; count > 0; count--) {
        const x = rn2(COLNO - 4) + 3;
        const y = rn2(ROWNO - 4) + 3;
        if (state.level?.at?.(x, y)?.typ !== LAVAPOOL)
            continue;
        const cloud = await createPoisonGasCloud(state, x, y, rn2(10) + minimumSize, rn2(10) + 5);
        if (cloud)
            cloud.heroFault = false;
        heard = true;
        const dx = x - (state.u?.ux ?? 0);
        const dy = y - (state.u?.uy ?? 0);
        if (dx * dx + dy * dy < 15)
            loud = true;
    }
    if (heard && !heroIsDeaf(state))
        await plineWithContinuation(`You hear a ${loud ? 'loud ' : ''}whoosh!`, { noRepeat: true });
    return { heard, loud };
}
// C mkmaze.c's bubble movement boundaries: gbxmin/gbymin/gbxmax/gbymax
// (mkmaze.c:1523-1530), mirrored here with the bubble walk bounds.
const BOUNDS = {
    xmin: 3, ymin: 1, xmax: 78, ymax: 20,
    bubbleXMin: 4, bubbleYMin: 2, bubbleXMax: 77, bubbleYMax: 19,
};
// C mkmaze.c:movebubbles().  On the Plane of Water every bubble first
// collects its contents (objects, monsters, hero, traps) and is filled with
// water; on the Plane of Air the whole sky is repainted and the border
// gains fresh clouds; then each bubble moves once, alternating the traversal
// direction so overlapped junk does not pool in the last bubble.
export async function movebubbles() {
    const bubbles = game.level?.elementalBubbles;
    if (!Array.isArray(bubbles) || !bubbles.length)
        return;
    const level = requireGameLevel();
    await vision_recalc(2);
    game._heroBubble = null;
    const traversalUp = !!game._bubbleTraversalUp;
    let ballChainPin = 0;
    if (Is_waterlevel(game.u?.uz)) {
        // keep attached ball&chain separate from bubble objects
        if (heroIsPunished())
            ballChainPin = await reserveBallAndChainPlacement();
        const collectionOrder = traversalUp
            ? bubbles : [...bubbles].reverse();
        for (const bubble of collectionOrder) {
            // pick up everything inside of a bubble, then fill its cells
            // with water (the CONS_OBJ/CONS_MON/CONS_HERO/CONS_TRAP loop).
            bubble.contents = [];
            for (const { x, y } of bubbleCells(bubble)) {
                const pile = level.objects[x]?.[y];
                if (pile?.length) {
                    const items = [];
                    for (const object of [...pile]) {
                        remove_object(object);
                        object.ox = 0;
                        object.oy = 0;
                        items.unshift(object);
                    }
                    bubble.contents.unshift({ kind: 'objects', x, y, items });
                }
                const monster = monsterAtPosition(level, x, y);
                if (monster) {
                    bubble.contents.unshift({ kind: 'monster', x, y, monster });
                    if (monster.wormno)
                        await clearMonsterWormFromMap(monster);
                    monster.mx = 0;
                    monster.my = 0;
                    monster.mstate = (monster.mstate ?? 0) | MON_BUBBLEMOVE;
                    await newsym(x, y);
                }
                if (!game.u?.uswallow && game.u?.ux === x && game.u?.uy === y) {
                    bubble.contents.unshift({ kind: 'hero', x, y });
                    game._heroBubble = bubble;
                }
                const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
                if (trap)
                    bubble.contents.unshift({ kind: 'trap', x, y, trap });
                setElementalCell(level.at(x, y), WATER, false);
                // C movebubbles() blocks the filled square outright; plain
                // WATER is not an obstruction for does_block(), so the
                // direct call matters.
                block_point(x, y);
            }
        }
    }
    else if (Is_airlevel(game.u?.uz)) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = level.requireAt(x, y);
                setElementalCell(loc, AIR, true);
                // C assigns air_pos then recalc_block_point(): the cell
                // joins or leaves the blocker table incrementally rather
                // than through a full vision_reset() rebuild.
                recalc_block_point(x, y);
                const xedge = x < BOUNDS.bubbleXMin
                    || x > BOUNDS.bubbleXMax;
                const yedge = y < BOUNDS.bubbleYMin
                    || y > BOUNDS.bubbleYMax;
                if ((xedge || yedge) && rn2(xedge ? 3 : 5) === 0) {
                    loc.typ = CLOUD;
                    block_point(x, y);
                }
            }
        }
    }
    // Every second time traverse down.  This is because otherwise all the
    // junk that changes owners when bubbles overlap would eventually end up
    // in the last bubble in the chain.
    game._bubbleTraversalUp = !traversalUp;
    const ordered = game._bubbleTraversalUp
        ? bubbles : [...bubbles].reverse();
    for (const bubble of ordered) {
        const rx = rn2(3);
        const ry = rn2(3);
        const dx = bubble.dx + 1
            - (!bubble.dx ? rx : (rx ? 1 : 0));
        const dy = bubble.dy + 1
            - (!bubble.dy ? ry : (ry ? 1 : 0));
        await mv_bubble(bubble, dx, dy, false);
    }
    if (Is_waterlevel(game.u.uz) && heroIsPunished())
        await restoreBallAndChainPlacement(ballChainPin);
    game.vision_full_recalc = 1;
}
// C mkmaze.c:water_friction().  Water can deflect a swimming hero's
// intended move onto the orthogonal axis.
export async function applyWaterFriction() {
    const hero = game.u;
    if (hero.dx && !rn2(hero.dy ? 6 : 3)) {
        let dy;
        do {
            dy = rn2(3) - 1;
        } while (dy && (!isok(hero.ux, hero.uy + dy) || !isPoolAt(hero.ux, hero.uy + dy, game)));
        hero.dx = 0;
        hero.dy = dy;
    }
    else if (hero.dy && !rn2(hero.dx ? 5 : 3)) {
        let dx;
        do {
            dx = rn2(3) - 1;
        } while (dx && (!isok(hero.ux + dx, hero.uy) || !isPoolAt(hero.ux + dx, hero.uy, game)));
        hero.dx = dx;
        hero.dy = 0;
    }
    else {
        return;
    }
    await plineWithContinuation('Water turbulence affects your movements.');
}
// C mkmaze.c:restore_waterlevel() redraws each saved bubble through
// mv_bubble(..., TRUE), including its Air-plane movement roll and
// border-direction bounce.  It runs while the level is still reloading, so
// it drives mv_bubble()'s synchronous cores directly.
export function restore_waterlevel() {
    if (!Is_airlevel(game.u.uz) && !Is_waterlevel(game.u.uz))
        return;
    game._heroBubble = null;
    for (const bubble of game.level?.elementalBubbles ?? []) {
        const motion = moveBubblePosition(bubble, 0, 0);
        drawBubble(bubble);
        changeBubbleDirection(bubble, motion.collision, true);
    }
}
// C mkmaze.c:setup_waterlevel().  The entire level is remembered as one
// glyph and unspecified terrain defaults to the level's base element; the
// bubbles themselves are spaced by the plane's own skips.
export async function setup_waterlevel() {
    if (!Is_airlevel(game.u?.uz) && !Is_waterlevel(game.u?.uz))
        return;
    const level = requireGameLevel();
    level.flags.hero_memory = false;
    level.elementalBounds = { ...BOUNDS };
    level.elementalBubbles = [];
    const baseTerrain = Is_waterlevel(game.u?.uz) ? WATER : AIR;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.at(x, y);
            if (!loc)
                continue;
            if (loc.typ === STONE)
                loc.typ = baseTerrain;
            const water = baseTerrain === WATER;
            const appearance = cmapSymbolAppearance(water ? CmapSymbol.water : CmapSymbol.air);
            loc.remembered_glyph = {
                ch: appearance.ch,
                color: water ? CLR_BRIGHT_BLUE : CLR_CYAN,
                decgfx: appearance.dec, kind: 'terrain', terrainName: water ? 'water' : 'air',
            };
        }
    }
    const xskip = Is_waterlevel(game.u?.uz)
        ? 10 + rn2(10) : 6 + rn2(4);
    const yskip = Is_waterlevel(game.u?.uz)
        ? 4 + rn2(4) : 3 + rn2(3);
    for (let x = BOUNDS.bubbleXMin; x <= BOUNDS.bubbleXMax; x += xskip)
        for (let y = BOUNDS.bubbleYMin; y <= BOUNDS.bubbleYMax; y += yskip)
            await mk_bubble(x, y, rn2(7));
}
// mk_bubble()'s static bmask[] table.  These bit masks make visually
// pleasing bubbles on a normal aspect 25x80 terminal, which naturally
// results in them being mathematically anything but symmetric; the first
// two elements tell the dimensions of the bubble's bounding box.
const BUBBLE_MASKS = [
    { width: 2, height: 1, rows: [0x3] },
    { width: 3, height: 2, rows: [0x7, 0x7] },
    { width: 4, height: 3, rows: [0x6, 0xf, 0x6] },
    { width: 5, height: 3, rows: [0xe, 0x1f, 0xe] },
    { width: 6, height: 4, rows: [0x1e, 0x3f, 0x3f, 0x1e] },
    { width: 7, height: 4, rows: [0x3e, 0x7f, 0x7f, 0x3e] },
    { width: 8, height: 4, rows: [0x7e, 0xff, 0xff, 0x7e] },
];
// C mkmaze.c:mk_bubble().
async function mk_bubble(x, y, maskIndex) {
    if (x >= BOUNDS.bubbleXMax || y >= BOUNDS.bubbleYMax)
        return;
    const mask = BUBBLE_MASKS[Math.min(maskIndex, BUBBLE_MASKS.length - 1)];
    if (!mask)
        throw new Error(`Elemental bubble has invalid shape ${maskIndex}`);
    const bubble = {
        x: Math.min(x, BOUNDS.bubbleXMax - mask.width + 1),
        y: Math.min(y, BOUNDS.bubbleYMax - mask.height + 1),
        dx: 1 - rn2(3),
        dy: 1 - rn2(3),
        width: mask.width,
        height: mask.height,
        rows: [...mask.rows],
    };
    const bubbles = requireGameLevel().elementalBubbles;
    if (!bubbles)
        throw new Error('Elemental bubble construction has no initialized bubble list');
    bubbles.push(bubble);
    await mv_bubble(bubble, 0, 0, true);
}
// C mkmaze.c:maybe_adjust_hero_bubble().  The bubble last carrying the hero
// remains sticky for subsequent steps until movebubbles() collects again.
export function maybe_adjust_hero_bubble() {
    const hero = game.u;
    if (!Is_waterlevel(hero.uz) || (!hero.dx && !hero.dy))
        return;
    const bubble = game._heroBubble;
    if (bubble && game.level?.elementalBubbles?.includes(bubble) && !rn2(2)) {
        bubble.dx = hero.dx ?? 0;
        bubble.dy = hero.dy ?? 0;
    }
}
// The levl[x][y] = water_pos / air_pos assignments of C movebubbles() and
// mv_bubble(): the whole rm record is replaced, so every JS terrain alias is
// reset, and the remembered glyph resolves the cmap symbol through the
// active symbol set the way showsyms[] does in C.
function setElementalCell(loc, typ, lit) {
    if (!loc)
        return;
    loc.typ = typ;
    loc.roomno = 0;
    loc.lit = lit;
    loc.waslit = false;
    loc.flags = 0;
    loc.doormask = 0;
    loc.seenv = 0;
    loc.horizontal = false;
    loc.edge = false;
    loc.wall_info = 0;
    loc.icedpool = 0;
    loc.altarmask = 0;
    loc.ladder = 0;
    loc.drawbridgemask = 0;
    loc.looted = 0;
    loc.emptygrave = false;
    loc.blessedftn = false;
    loc.disturbed = false;
    loc.candig = false;
    loc.arboreal_sdoor = false;
    // movebubbles() resets old air clouds to an Air cell remembered as
    // Cloud, and old water bubbles to a Water cell remembered as Water.
    const water = typ === WATER;
    const appearance = cmapSymbolAppearance(water ? CmapSymbol.water : CmapSymbol.cloud);
    loc.remembered_glyph = {
        ch: appearance.ch,
        color: water ? CLR_BRIGHT_BLUE : CLR_GRAY,
        decgfx: appearance.dec, kind: 'terrain', terrainName: water ? 'water' : 'cloud',
    };
}
// The b->bm bit-mask walk of C movebubbles()/mv_bubble(), which both inline;
// shared here by the collection loop and the bubble painter.
function bubbleCells(bubble) {
    const cells = [];
    for (let dx = 0; dx < bubble.width; dx++) {
        for (let dy = 0; dy < bubble.height; dy++) {
            if ((bubble.rows[dy] ?? 0) & (1 << dx))
                cells.push({ x: bubble.x + dx, y: bubble.y + dy });
        }
    }
    return cells;
}
// The movement core of C mv_bubble(): clouds move only one time in six —
// the roll belongs even to the initial zero-distance draw that paints a
// newly allocated cloud — and the border clamps and bounces precede it.
function moveBubblePosition(bubble, requestedDx, requestedDy) {
    let dx = requestedDx;
    let dy = requestedDy;
    let collision = 0;
    if (!Is_airlevel(game.u?.uz) || rn2(6) === 0) {
        if (dx < -1 || dx > 1)
            dx = Math.sign(dx);
        if (dy < -1 || dy > 1)
            dy = Math.sign(dy);
        if (bubble.x <= BOUNDS.bubbleXMin)
            collision |= 2;
        if (bubble.y <= BOUNDS.bubbleYMin)
            collision |= 1;
        if (bubble.x + bubble.width - 1 >= BOUNDS.bubbleXMax)
            collision |= 2;
        if (bubble.y + bubble.height - 1 >= BOUNDS.bubbleYMax)
            collision |= 1;
        bubble.x = Math.max(BOUNDS.bubbleXMin, Math.min(BOUNDS.bubbleXMax - bubble.width + 1, bubble.x));
        bubble.y = Math.max(BOUNDS.bubbleYMin, Math.min(BOUNDS.bubbleYMax - bubble.height + 1, bubble.y));
        if (bubble.x === BOUNDS.bubbleXMin && dx < 0)
            dx = -dx;
        if (bubble.x + bubble.width - 1 === BOUNDS.bubbleXMax && dx > 0)
            dx = -dx;
        if (bubble.y === BOUNDS.bubbleYMin && dy < 0)
            dy = -dy;
        if (bubble.y + bubble.height - 1 === BOUNDS.bubbleYMax && dy > 0)
            dy = -dy;
        bubble.x += dx;
        bubble.y += dy;
    }
    return { dx, dy, collision };
}
// The "boing?" tail of C mv_bubble(): border collisions flip the heading,
// and a stationary bubble sometimes alters direction for fun anyway.
function changeBubbleDirection(bubble, collision, initial) {
    if (collision & 1)
        bubble.dy = -bubble.dy;
    if (collision & 2)
        bubble.dx = -bubble.dx;
    if (!collision && !initial
        && rn2(bubble.dx || bubble.dy ? 20 : 5) === 0) {
        bubble.dx = 1 - rn2(3);
        bubble.dy = 1 - rn2(3);
    }
}
// The drawing half of C mv_bubble(): a water bubble paints AIR cells and
// unblocks them, an air bubble paints CLOUD cells and blocks them.
function drawBubble(bubble) {
    const isAir = Is_airlevel(game.u?.uz);
    for (let dx = 0; dx < bubble.width; dx++) {
        for (let dy = 0; dy < bubble.height; dy++) {
            if (!((bubble.rows[dy] ?? 0) & (1 << dx)))
                continue;
            const x = bubble.x + dx, y = bubble.y + dy;
            const loc = game.level?.at?.(x, y);
            if (isAir) {
                if (loc) {
                    loc.typ = CLOUD;
                    loc.lit = true;
                }
                // C mv_bubble() blocks each drawn cloud cell incrementally.
                block_point(x, y);
            }
            else if (Is_waterlevel(game.u?.uz)) {
                if (loc) {
                    loc.typ = AIR;
                    loc.lit = true;
                }
                unblock_point(x, y);
            }
        }
    }
}
// C mkmaze.c:mv_bubble().  The player, the portal and all other objects and
// monsters float along with their associated bubble; after the draw, a
// water bubble puts its collected contents back at the moved position.
async function mv_bubble(bubble, requestedDx, requestedDy, initial) {
    const motion = moveBubblePosition(bubble, requestedDx, requestedDy);
    drawBubble(bubble);
    if (Is_waterlevel(game.u?.uz) && !initial) {
        // replace contents of bubble
        requirePlayingGame(game);
        const level = requireGameLevel();
        for (const content of bubble.contents || []) {
            const x = content.x + motion.dx, y = content.y + motion.dy;
            if (content.kind === 'objects') {
                for (const object of content.items) {
                    await placeObject(object, x, y);
                    await stack_object(object);
                }
            }
            else if (content.kind === 'monster') {
                // mnearto() might fail; the monster is moved next to the
                // hero instead (C jumps to elemental_clog()).
                if (!await mnearto(content.monster, x, y, game, { moveOther: true, flags: RLOC_NOMSG }))
                    await dealWithMonsterOvercrowding(content.monster);
            }
            else if (content.kind === 'hero') {
                const occupant = monsterAtPosition(level, x, y);
                const oldx = game.u.ux, oldy = game.u.uy;
                await placeHeroOnLevel(x, y);
                await newsym(oldx, oldy);
                if (occupant)
                    await moveMonsterNextToHero(occupant, game, { flags: RLOC_NOMSG });
            }
            else if (content.kind === 'trap') {
                content.trap.tx = x;
                content.trap.ty = y;
            }
        }
        bubble.contents = [];
    }
    changeBubbleDirection(bubble, motion.collision, initial);
}
//# sourceMappingURL=mkmaze.js.map