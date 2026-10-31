// mkmaze.js — maze levels, special-level fixups and wall topology.
// C ref: mkmaze.c — set_levltyp/set_levltyp_lit, wallification and spine
// repair, place_lregion and mkportal, fixup_special and the named special
// level fixups, makemaz and the random maze fillers, get_level_extends and
// bound_digging. sp_lev.c construction lives in sp_lev.ts / sp_lev_lua.ts;
// regular room-and-corridor generation stays in mklev.ts.
import { game, requireGameLevel } from './gstate.js';
import { rn2, rnd, rn1 } from './rng.js';
import { AIR, ALTAR, BLCORNER, BRCORNER, COLNO, CORR, CROSSWALL, DBWALL, D_NODOOR, FOUNTAIN, HWALL, ICED_MOAT, ICED_POOL, ICE, In_mines, In_quest, Invocation_lev, IRONBARS, IS_DOOR, IS_LAVA, IS_STWALL, IS_WALL, Is_earthlevel, Is_firelevel, Is_stronghold, LAVAPOOL, LAVAWALL, LR_BRANCH, LR_DOWNSTAIR, LR_DOWNTELE, LR_PORTAL, LR_TELE, LR_UPSTAIR, LR_UPTELE, MAGIC_PORTAL, MAX_TYPE, POOL, ROOM, ROWNO, SDOOR, SINK, SPACE_POS, STONE, TDWALL, TLCORNER, TLWALL, TRCORNER, TRWALL, TUWALL, VWALL, VIBRATING_SQUARE, WATER, W_NONDIGGABLE, W_NONPASSWALL, RLOC_ERR, RLOC_NOMSG, isok, } from './const.js';
import { BOULDER, STATUE } from './object_data.js';
import { createPoisonGasCloud } from './regions.js';
import { heroIsDeaf } from './senses.js';
import { plineWithContinuation } from './pline.js';
import { requireInitializedGame } from './gstate.js';
import { monsterAtPosition } from './monster_location.js';
import { randomMonsterRelocation } from './teleport.js';
import { sendMonsterToLimbo } from './monster_migration.js';
import { placeHeroOnLevel } from './hero_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import { canOverwriteTerrain, isIceAt } from './terrain_properties.js';
import { updateIceObjectTimersAt } from './floor_object.js';
import { LEVEL_TIMER_KIND, stopLevelTimer } from './object_timers.js';
import { fillSpecialRoom, medusaPetrifiable } from './sp_lev.js';
import { generateLuaSpecialLevel } from './sp_lev_lua.js';
import { goodPosition } from './teleport_rules.js';
import { createCorpstatAt, createToptenObject, mkgold, mkobj_at, rndmonnum, set_corpsenm, mksobj_at, } from './mkobj.js';
import { makemon } from './makemon.js';
import { occupied } from './mkroom.js';
import { createMaze } from './maze_terrain.js';
import { setupElementalBubbles } from './elemental.js';
import { premap_detect } from './detect.js';
import { specialLevelAt } from './dungeon.js';
import { impossible } from './diagnostics.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { GEM_CLASS, NO_TRAP, PM_MINOTAUR, RANDOM_CLASS, countLevelFeatures, is_branchlev, maketrap, mkstairs, mktrap, place_branch, placeBranchAt, stairway_find_dir, } from './mklev.js';
import { createOrcRaid } from './orc_raid.js';
import { isRoom } from './map_types.js';
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
export function isLuaQuestPrototype(prototype) {
    return /^[A-Z][a-z]{2}-(strt|loca|goal|fila|filb)$/.test(prototype);
}
export async function generateLuaQuestLevel(active) {
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
export async function generateBigRoom(active) {
    if (active.variant === undefined || active.variant < 1 || active.variant > 13)
        throw new RangeError(`unknown Big Room variant ${active?.variant}`);
    await generateSpecialAndFixup(generateLuaSpecialLevel, active);
}
export async function generateElementalPlane(active) {
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
export async function generateWizardLevel(active) {
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
export async function generateSpecialAndFixup(generator, active) {
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
export async function generateSokobanLevel(active) {
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
        await generateSpecialAndFixup(generateLuaSpecialLevel, active);
        const level = requireGameLevel();
        for (const room of level.rooms.slice(0, level.nroom))
            if (isRoom(room))
                await fillSpecialRoom(room);
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
//# sourceMappingURL=mkmaze.js.map