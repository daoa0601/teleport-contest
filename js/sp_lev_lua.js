// sp_lev_lua.js — Lua des.* operation bindings for special levels.
// C ref: sp_lev.c sp_level_coder_init(), l_register_des(),
// create_des_coder(), load_special(), and the themed-room Lua sessions
// that mklev.c makerooms() drives.
import { game, requireGameLevel } from './gstate.js';
import { discardMonsterInventory, dropSpecialMonsterObjects } from './monster_drop.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { impossible } from './diagnostics.js';
import { PanicTermination } from './panic_termination.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { createDesBindings, mapOrigin } from './lua/des.js';
import { luaToInteger, luaNumberValue } from './lua/arguments.js';
import { createSelectionApi } from './lua/selection.js';
import { LuaArgumentError, NethackLuaError } from './lua/errors.js';
import { nameToMonster } from './mondata.js';
import { luaTableToArray, objectToLuaTable, LuaTable, luaCheckString, luaCheckInteger, luaType } from './lua/runtime.js';
import { rn2 } from './rng.js';
import { level_difficulty } from './dungeon.js';
import { ANY_LOC, DRY, getLocationCoord, getPackedLocationCoord } from './special_location.js';
import { cleanupSpecialLevelMap, removeSpecialLevelBoundaries } from './special_level_cleanup.js';
import { COLNO, ROWNO, GRAVE, IS_LAVA, isok, W_NONPASSWALL, A_NONE, G_GENOD } from './const.js';
import { initializeMonsterArmor } from './monworn.js';
import { createGasCloudSelection, createPoisonGasCloud } from './regions.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer, stopLevelTimer } from './object_timers.js';
import { SpecialSelection, mapCharacterType } from './selvar.js';
import { countLevelFeatures, make_grave, makecorridors, mineralize } from './mklev.js';
import { wallification } from './mkmaze.js';
import { addDoorsToSpecialRoom, buildSpecialRoom, centeredSpecialMap, createLuaAltar, createLuaCorridor, createLuaDoor, createLuaDrawbridge, createLuaEngraving, createLuaExclusion, createLuaFeature, createLuaGold, createLuaMonster, createLuaObject, createLuaRoomRegion, createLuaStair, createLuaTrap, createLuaWallProperty, ensureWaysOut, fillEmptySpecialMaze, fillSpecialLevel, flipLuaRegions, flipSpecialLevelRandom, levelRegionCoordinates, linkSpecialLevelDoors, loadSpecialAsciiMap, luaRoomSpec, luaRoomTable, luaSelectionCoordinates, markSpecialSelectionWallProperty, placeThemedMap, replaceLuaTerrain, setLuaLevelFlags, setSpecialTerrain, solidifyLuaMap, specialMapRows, specialMapSelection, specialMazeWalk, specialNonDiggable, specialRoomContext, specialSelectionNonDiggable, specialSelectionTerrain, wallifyMap } from './sp_lev.js';
// nhlua.c:nhl_get_timertype() takes luaL_checkoption over timeout_funcs'
// timer names, in timeout.h order; timer_is_pos() admits only melt-ice.
const LEVEL_TIMER_TYPE_NAMES = [
    'rot-organic', 'rot-corpse', 'revive-mon', 'zombify-mon',
    'burn-obj', 'hatch-egg', 'fig-transform', 'shrink-glob', 'melt-ice',
];
// nhlua.c:nhl_get_xy_params() over sp_lev.c:get_coord(), as reached by
// nhl_timer_start_at() after the timer type and delay were popped: two
// integers, or one table with x/y fields or a two-entry array.
function luaTimerCoordinates(args) {
    if (args.length === 4)
        return { x: luaToInteger(args[0]), y: luaToInteger(args[1]) };
    if (args.length === 3 && args[0] instanceof LuaTable) {
        const table = args[0];
        const x = table.get('x');
        if (x != null) {
            // get_coord() converts x with luaL_checkinteger before it
            // looks for y at all.
            const xValue = luaCheckInteger(-1, x);
            const y = table.get('y');
            if (y == null)
                throw new NethackLuaError('Not a coordinate');
            return { x: xValue, y: luaCheckInteger(-1, y) };
        }
        if (table.length() !== 2)
            throw new NethackLuaError('Not a coordinate');
        return { x: luaTimerArrayEntry(table, 1), y: luaTimerArrayEntry(table, 2) };
    }
    throw new NethackLuaError('nhl_timer_start_at: Wrong args');
}
// sp_lev.c:get_table_intarray_entry(): numbers and numeric strings
// convert with lua_tointeger laxness, everything else raises nhl_error.
// The C message hardcodes entry number 1 for both positions.
function luaTimerArrayEntry(table, entry) {
    const value = table.get(entry);
    const converted = luaNumberValue(value);
    if (converted === null)
        throw new NethackLuaError(`Array entry #1 is ${luaType(value)}, expected number`);
    return luaToInteger(converted);
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
    let mappedCells = new SpecialSelection();
    let roomFailed = false;
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
        levelInit: async (options) => await fillSpecialLevel(options, currentLevel()),
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
        map: async (value) => {
            const source = typeof value === 'string' ? value : value.map;
            if (source === undefined)
                throw new TypeError('des.map requires map text');
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
            }
            else {
                const origin = typeof value === 'string'
                    ? centeredSpecialMap(width, rows.length)
                    : mapOrigin(value, width, rows.length, !!currentLevel().levelInitialized);
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
                }
                finally {
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
        terrainAt: async (x, y, character, lit = -2) => {
            const type = mapCharacterType(character);
            if (type === undefined)
                throw new Error(`unknown Lua terrain ${character}`);
            const point = await getPackedLocationCoord(context, { x, y }, ANY_LOC);
            if (!isok(point.x, point.y))
                throw new TypeError('terrain coord not ok');
            setSpecialTerrain(point.x, point.y, type, lit ?? -2);
        },
        replaceTerrain: options => replaceLuaTerrain(context, options),
        region: (selection, lighting) => {
            const lit = lighting === 'lit';
            const area = lit ? selection.grow() : selection;
            area.forEachXMajor((x, y) => {
                const loc = requireGameLevel().at(x, y);
                // sp_lev.c:sel_set_lit() preserves lava's own light even
                // when the selected region is explicitly darkened.
                if (loc)
                    loc.lit = IS_LAVA(loc.typ) || lit;
            });
        },
        roomRegion: async (options) => {
            const room = await createLuaRoomRegion(currentLevel().context ?? wholeLevel, options);
            if (!room || !options.contents)
                return room;
            const parent = context;
            context = specialRoomContext(room);
            try {
                await currentState().callValueAsync(options.contents, [
                    luaRoomTable(room),
                ]);
            }
            finally {
                context = parent;
            }
            addDoorsToSpecialRoom(room);
            return room;
        },
        room: async (options) => {
            if (roomFailed)
                return null;
            const parent = context;
            const room = await buildSpecialRoom(luaRoomSpec(options), context._room ?? null, options.contents ? async (builtRoom) => {
                context = specialRoomContext(builtRoom);
                try {
                    await currentState().callValueAsync(options.contents, [
                        luaRoomTable(builtRoom),
                    ]);
                }
                finally {
                    context = parent;
                }
            } : null);
            if (!room && currentLevel().prototype === 'themerms')
                roomFailed = true;
            context = parent;
            return room;
        },
        stair: async (options) => {
            const point = await createLuaStair(context, options);
            mappedCells.add(point.x, point.y);
        },
        ladder: async (options) => {
            const point = await createLuaStair(context, options, true);
            mappedCells.add(point.x, point.y);
        },
        door: async (options) => {
            const point = await createLuaDoor(context, options);
            if (point)
                mappedCells.add(point.x, point.y);
        },
        drawbridge: async (options) => {
            const point = await createLuaDrawbridge(context, options);
            mappedCells.add(point.x, point.y);
        },
        engraving: options => createLuaEngraving(context, options),
        gold: async (options) => await createLuaGold(context, options),
        grave: async (options) => {
            const point = await getLocationCoord(context, options.point, DRY);
            const level = requireGameLevel();
            if (!isok(point.x, point.y)
                || level.traps.some(trap => trap.tx === point.x && trap.ty === point.y))
                return;
            level.requireAt(point.x, point.y).typ = GRAVE;
            make_grave(point.x, point.y, options.text ?? null);
        },
        feature: options => createLuaFeature(context, options),
        altar: options => createLuaAltar(context, options),
        nonDiggable: selection => selection
            ? specialSelectionNonDiggable(selection)
            : specialNonDiggable(),
        nonPasswall: selection => markSpecialSelectionWallProperty(selection ?? new SpecialSelection().negate(), W_NONPASSWALL),
        wallProperty: options => createLuaWallProperty(currentLevel().context ?? wholeLevel, options),
        wallify: options => {
            const map = currentLevel().context ?? wholeLevel;
            const x1 = options?.x1 ?? -1, y1 = options?.y1 ?? -1;
            const x2 = options?.x2 ?? -1, y2 = options?.y2 ?? -1;
            wallifyMap(x1 < 0 ? map.xstart - 1 : x1, y1 < 0 ? map.ystart - 1 : y1, x2 < 0 ? map.xstart + map.width + 1 : x2, y2 < 0 ? map.ystart + map.height + 1 : y2);
        },
        teleportRegion: async (options) => {
            const { region, exclude } = await levelRegionCoordinates(currentLevel().context ?? wholeLevel, options);
            if (options.dir === 'up') {
                currentLevel().upTeleportRegion = region;
                currentLevel().upTeleportExclude = exclude;
            }
            else if (options.dir === 'down') {
                currentLevel().downTeleportRegion = region;
                currentLevel().downTeleportExclude = exclude;
            }
            else {
                currentLevel().upTeleportRegion = { ...region };
                currentLevel().downTeleportRegion = { ...region };
                currentLevel().upTeleportExclude = exclude ? { ...exclude } : null;
                currentLevel().downTeleportExclude = exclude ? { ...exclude } : null;
            }
        },
        levelRegion: async (options) => {
            const { region, exclude } = await levelRegionCoordinates(currentLevel().context ?? wholeLevel, options);
            const type = options.type;
            if (type !== 'stair-up' && type !== 'stair-down' && type !== 'branch' && type !== 'portal')
                throw new Error(`unsupported Lua level region ${type}`);
            const active = currentLevel();
            active.levelRegions ??= [];
            active.levelRegions.push({ type, area: region, exclude,
                ...(options.name === undefined ? {} : { destination: options.name }),
            });
        },
        exclusion: options => createLuaExclusion(context, options),
        gasCloud: async (options) => {
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
        },
        randomCorridors: async () => await makecorridors(),
        corridor: createLuaCorridor,
        mineralize: options => mineralize(options.kelp_pool ?? -1, options.kelp_moat ?? -1, options.gold_prob ?? -1, options.gem_prob ?? -1, true),
        mazeWalk: async (options) => {
            const point = await getPackedLocationCoord(context, { x: options.x ?? -1, y: options.y ?? -1 }, ANY_LOC);
            if (!isok(point.x, point.y))
                throw new TypeError('mazewalk coord not ok');
            const directions = ['north', 'south', 'east', 'west'];
            const direction = options.dir === 'random'
                ? directions[rn2(directions.length)] : options.dir;
            if (direction !== 'north' && direction !== 'south'
                && direction !== 'east' && direction !== 'west')
                throw new TypeError(`Unknown maze direction: ${direction}`);
            const terrain = mapCharacterType(options.typ ?? '.');
            if (terrain === undefined)
                throw new TypeError('Unknown maze terrain');
            specialMazeWalk(context, point.x - context.xstart, point.y - context.ystart, direction, terrain);
            if (options.stocked)
                await fillEmptySpecialMaze(mappedCells);
        },
        object: async (options) => currentState().objects.wrap(await createLuaObject(context, options, containers.at(-1) ?? null, monsterInventories.at(-1) ?? null, invokeObjectContents)),
        trap: options => createLuaTrap(context, options),
        monster: async (options) => {
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
                }
                finally {
                    monsterInventories.pop();
                }
                if (monster)
                    await initializeMonsterArmor(monster);
            }
            return monster;
        },
    };
    const selectionApi = createSelectionApi(() => context, async (callable, args) => {
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
            start_timer_at: (...args) => {
                // nhl_get_timertype() takes luaL_checkoption over every
                // timeout_funcs entry at stack index -2, so a bad name is
                // lauxlib's argument error carrying that index; only
                // melt-ice is a position timer (timer_is_pos()).
                const timerIndex = -2;
                if (args.length === 1) {
                    // With one argument, stack index -2 holds the called
                    // function itself. With none, C reads its caller's
                    // frame; this interpreter cannot reproduce that
                    // invalid access without Lua's VM stack.
                    throw new LuaArgumentError(timerIndex, 'string expected, got function');
                }
                const timerName = luaCheckString(timerIndex, args[args.length - 2]);
                const timerType = LEVEL_TIMER_TYPE_NAMES.indexOf(timerName);
                if (timerType < 0)
                    throw new LuaArgumentError(timerIndex, `invalid option '${timerName}'`);
                const when = luaToInteger(args[args.length - 1]);
                const point = luaTimerCoordinates(args);
                if (timerType !== LEVEL_TIMER_TYPE_NAMES.indexOf('melt-ice'))
                    return;
                // nhl_timer_start_at() and cvt_to_abscoord() store signed
                // 16-bit coordxy values. Narrow before addition so large
                // Lua integers retain their low bits, then narrow the sum.
                const relativeX = (point.x << 16) >> 16;
                const relativeY = (point.y << 16) >> 16;
                const timerX = ((context.xstart + relativeX) << 16) >> 16;
                const timerY = ((context.ystart + relativeY) << 16) >> 16;
                if (!isok(timerX, timerY))
                    return;
                const deadline = (game.moves ?? 0) + when;
                stopLevelTimer(timerX, timerY, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game);
                scheduleLevelTimer(timerX, timerY, LEVEL_TIMER_KIND.MELT_ICE_AWAY, deadline, game);
            },
        },
        des: createDesBindings(operations, selectionApi.wrap),
        selection: selectionApi.bindings,
    };
    return {
        bindings,
        beginLevel(nextActive, { special = true } = {}) {
            active = nextActive;
            context = wholeLevel;
            active.context = context;
            containers.length = 0;
            monsterInventories.length = 0;
            mappedCells = new SpecialSelection();
            roomFailed = false;
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
            linkSpecialLevelDoors();
            removeSpecialLevelBoundaries(mappedCells);
            if (currentLevel().checkInaccessibles)
                await ensureWaysOut();
            await cleanupSpecialLevelMap();
            if (!requireGameLevel().flags.corrmaze)
                wallification(1, 0, COLNO - 1, ROWNO - 1);
            const allowedFlips = currentLevel().allowFlips;
            if (allowedFlips === undefined)
                throw new Error('Lua level flip flags are uninitialized');
            await flipSpecialLevelRandom(allowedFlips);
            countLevelFeatures();
            if (currentLevel().solidify)
                solidifyLuaMap(mappedCells);
            flipLuaRegions(currentLevel());
        },
    };
}
export async function generateLuaSpecialLevel(active) {
    const session = createLuaLevelSession();
    session.beginLevel(active);
    await currentLuaLifecycle().executeSpecial(game, active.file, session.bindings, state => session.bindState(state));
    await session.finishSpecialLevel();
}
const themedLuaSessions = new WeakMap();
const activeThemes = new WeakMap();
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
        const createdSession = createLuaLevelSession();
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
export async function callLuaThemerooms(name, args = []) {
    const state = activeThemes.get(game)?.state;
    if (!state)
        throw new Error('themed rooms are not active');
    return state.callValueAsync(state.getGlobal(name), args);
}
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
//# sourceMappingURL=sp_lev_lua.js.map