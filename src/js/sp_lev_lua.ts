// sp_lev_lua.js — Lua des.* operation bindings for special levels.
// C ref: sp_lev.c sp_level_coder_init(), l_register_des(),
// create_des_coder(), load_special(), and the themed-room Lua sessions
// that mklev.c makerooms() drives.

import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { ActiveSpecialLevel } from './map_types.js';
import type { GameState } from './game_state.js';
import type { LuaState, LuaValues } from './lua/runtime.js';
import { game, requireGameLevel } from './gstate.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { impossible } from './diagnostics.js';
import { PanicTermination } from './panic_termination.js';
import { LUA_SOURCES } from './generated/lua_sources.js';
import { l_register_des } from './lua/des.js';
import type { SpecialLevelRoomScope } from './sp_lev.js';
import type { DesOperations } from './lua/des.js';
import type { LuaBindings, LuaGameState } from './lua/lifecycle.js';
import type { LuaValue } from './lua/runtime.js';
import { luaToInteger, luaNumberValue } from './lua/arguments.js';
import { createSelectionApi } from './lua/selection.js';
import { LuaArgumentError, NethackLuaError } from './lua/errors.js';
import { nameToMonster } from './mondata.js';
import { luaTableToArray, LuaTable, luaCheckString, luaCheckInteger, luaType } from './lua/runtime.js';
import { level_difficulty } from './dungeon.js';

import { COLNO, ROWNO, G_GENOD, LEVEL_TIMER_KIND } from './const.js';
import { isok } from './cmd.js';

import { scheduleLevelTimer, stopLevelTimer } from './timeout.js';
import { SpecialSelection } from './selvar.js';
import { mineralize } from './mklev.js';

import {
    lspo_message, lspo_grave, lspo_gas_cloud, lspo_mineralize, lspo_random_corridors,
    lspo_corridor, lspo_level_init, lspo_teleport_region, lspo_levregion, lspo_map, lspo_altar,
    lspo_door, lspo_drawbridge, lspo_engraving, lspo_exclusion, lspo_feature, lspo_gold,
    lspo_monster, lspo_object, lspo_region, lspo_stair, lspo_ladder, lspo_trap,
    lspo_wall_property, lspo_finalize_level, lspo_room, lspo_replace_terrain, lspo_level_flags,
    lspo_terrain, lspo_mazewalk, lspo_non_diggable, lspo_non_passwall, lspo_wallify,
} from './sp_lev.js';

// nhlua.c:nhl_get_timertype() takes luaL_checkoption over timeout_funcs'
// timer names, in timeout.h order; timer_is_pos() admits only melt-ice.
const LEVEL_TIMER_TYPE_NAMES = [
    'rot-organic', 'rot-corpse', 'revive-mon', 'zombify-mon',
    'burn-obj', 'hatch-egg', 'fig-transform', 'shrink-glob', 'melt-ice',
];
// nhlua.c:nhl_get_xy_params() over sp_lev.c:get_coord(), as reached by
// nhl_timer_start_at() after the timer type and delay were popped: two
// integers, or one table with x/y fields or a two-entry array.
function luaTimerCoordinates(args: readonly LuaValue[]): { x: number; y: number } {
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
            if (y == null) throw new NethackLuaError('Not a coordinate');
            return { x: xValue, y: luaCheckInteger(-1, y) };
        }
        if (table.length() !== 2) throw new NethackLuaError('Not a coordinate');
        return { x: luaTimerArrayEntry(table, 1), y: luaTimerArrayEntry(table, 2) };
    }
    throw new NethackLuaError('nhl_timer_start_at: Wrong args');
}

// sp_lev.c:get_table_intarray_entry(): numbers and numeric strings
// convert with lua_tointeger laxness, everything else raises nhl_error.
// The C message hardcodes entry number 1 for both positions.
function luaTimerArrayEntry(table: LuaTable, entry: number): number {
    const value = table.get(entry);
    const converted = luaNumberValue(value);
    if (converted === null)
        throw new NethackLuaError(
            `Array entry #1 is ${luaType(value)}, expected number`);
    return luaToInteger(converted);
}

// C sp_lev.c:sp_level_coder_init(). Create the per-level room, inventory, and map state.
// Also C sp_lev.c:create_des_coder(): the lazy coder allocation; every Lua
// session builds its coder state directly here.
function sp_level_coder_init() {
    const wholeLevel = {
        xstart: 1, ystart: 0, width: COLNO - 1, height: ROWNO,
    };
    let active: ActiveSpecialLevel | null = null;
    const roomScope: SpecialLevelRoomScope = { context: wholeLevel, roomFailed: false };
    let luaState: LuaGameState | null = null;
    const containers: GameObject[] = [];
    const monsterInventories: Array<Monster | null> = [];
    let mappedCells = new SpecialSelection();
    const currentLevel = (): ActiveSpecialLevel => {
        if (!active) throw new Error('Lua level generation has not started');
        return active;
    };
    const currentState = (): LuaGameState => {
        if (!luaState) throw new Error('Lua level generation has no bound state');
        return luaState;
    };
    // Also C sp_lev.c:spo_pop_container(): inlined here in the finally block.
    const invokeObjectContents = async (callback: LuaValue, object: GameObject) => {
        containers.push(object);
        try {
            await currentState().callValueAsync(callback, [currentState().objects.wrap(object)]);
        } finally {
            containers.pop();
        }
    };
    const operations: DesOperations = {
        levelInit: value => lspo_level_init(value, currentLevel()),
        levelFlags: flags => lspo_level_flags(currentLevel(), flags),
        message: value => lspo_message(currentLevel(), value),
        map: value => lspo_map(roomScope, currentLevel(), currentState(), wholeLevel, mappedCells, value),
        terrain: (...args) => lspo_terrain(roomScope.context, args),
        replaceTerrain: options => lspo_replace_terrain(roomScope.context, options),
        region: (selection, lighting) => lspo_region(
            roomScope, currentLevel().context ?? wholeLevel, currentState(), selection, lighting,
        ),
        roomRegion: options => lspo_region(
            roomScope, currentLevel().context ?? wholeLevel, currentState(), options,
        ),
        room: options => lspo_room(roomScope, currentLevel(), currentState(), options),
        stair: (direction, x, y) => lspo_stair(roomScope.context, mappedCells, direction, x, y),
        ladder: (direction, x, y) => lspo_ladder(roomScope.context, mappedCells, direction, x, y),
        door: async (state, x, y) => {
            const point = await lspo_door(roomScope.context, state, x, y);
            if (point) mappedCells.add(point.x, point.y);
        },
        drawbridge: async options => {
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
        object: async (id, x, y) => currentState().objects.wrap(await lspo_object(
            roomScope.context, containers.at(-1) ?? null, monsterInventories.at(-1) ?? null,
            invokeObjectContents, id, x, y,
        )),
        trap: (type, x, y) => lspo_trap(roomScope.context, type, x, y),
        monster: (id, x, y) => lspo_monster(roomScope.context, currentState(), monsterInventories, id, x, y),
    };
    const selectionApi = createSelectionApi(
        () => roomScope.context,
        async (callable, args) => {
            const state = currentState();
            try {
                await state.callValueAsync(callable, args);
                return true;
            } catch (error) {
                if (error instanceof PanicTermination) throw error;
                const detail = state.traceback.format(error);
                await impossible(`Lua error: ${state.sid}:l_selection_iterate ${detail}`);
                return false;
            }
        },
    );
    const bindings: LuaBindings = {
        nh: {
            debug_themerm: (...args: LuaValue[]) => {
                if (args.length !== 1)
                    throw new NethackLuaError('debug_themerm should have 1 boolean arg');
                return null;
            },
            is_genocided: (...args: LuaValue[]) => {
                if (args.length !== 1) throw new NethackLuaError('Wrong args');
                // C nhl_is_genocided() resolves names with name_to_mon(),
                // which accepts articles, plurals, and alternate spellings.
                const mndx = nameToMonster(luaCheckString(1, args[0]));
                return mndx >= 0
                    && !!((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GENOD);
            },
            level_difficulty: (...args: LuaValue[]) => {
                if (args.length)
                    throw new NethackLuaError('level_difficulty should not have any args');
                return level_difficulty();
            },
            start_timer_at: (...args: LuaValue[]) => {
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
                    throw new LuaArgumentError(timerIndex,
                        'string expected, got function');
                }
                const timerName = luaCheckString(timerIndex, args[args.length - 2]);
                const timerType = LEVEL_TIMER_TYPE_NAMES.indexOf(timerName);
                if (timerType < 0)
                    throw new LuaArgumentError(timerIndex, `invalid option '${timerName}'`);
                const when = luaToInteger(args[args.length - 1]);
                const point = luaTimerCoordinates(args);
                if (timerType !== LEVEL_TIMER_TYPE_NAMES.indexOf('melt-ice')) return;
                // nhl_timer_start_at() and cvt_to_abscoord() store signed
                // 16-bit coordxy values. Narrow before addition so large
                // Lua integers retain their low bits, then narrow the sum.
                const relativeX = (point.x << 16) >> 16;
                const relativeY = (point.y << 16) >> 16;
                const timerX = ((roomScope.context.xstart + relativeX) << 16) >> 16;
                const timerY = ((roomScope.context.ystart + relativeY) << 16) >> 16;
                if (!isok(timerX, timerY)) return;
                const deadline = (game.moves ?? 0) + when;
                stopLevelTimer(timerX, timerY, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game);
                scheduleLevelTimer(
                    timerX, timerY,
                    LEVEL_TIMER_KIND.MELT_ICE_AWAY,
                    deadline,
                    game,
                );
            },
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
        beginLevel(nextActive: ActiveSpecialLevel, { special = true } = {}) {
            active = nextActive;
            roomScope.context = wholeLevel;
            active.context = roomScope.context;
            containers.length = 0;
            monsterInventories.length = 0;
            mappedCells = new SpecialSelection();
            roomScope.roomFailed = false;
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
export async function load_special(active: ActiveSpecialLevel): Promise<void> {
    const session = sp_level_coder_init();
    session.beginLevel(active);
    await currentLuaLifecycle().executeSpecial(
        game, active.file, session.bindings,
        state => session.bindState(state),
    );
    await session.finishSpecialLevel();
}

type LuaLevelSession = ReturnType<typeof sp_level_coder_init>;
const themedLuaSessions = new WeakMap<LuaState, LuaLevelSession>();
const activeThemes = new WeakMap<GameState, { state: LuaState; session: LuaLevelSession }>();
export async function beginLuaThemerooms(): Promise<boolean> {
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
        if (!filename) throw new Error('Themed room initialization requires a source file.');
        const createdSession = sp_level_coder_init();
        session = createdSession;
        createdSession.beginLevel(active, { special: false });
        let loadingStateId: number | undefined;
        try {
            state = await lifecycle.createThemedState(
                game, dungeonNumber, filename, createdSession.bindings,
                created => {
                    loadingStateId = created.sid;
                    createdSession.bindState(created);
                },
            );
        } catch (error) {
            if (error instanceof PanicTermination) throw error;
            let reason: string;
            if (!LUA_SOURCES[filename]) {
                reason = `nhl_loadlua: Error opening (${filename})`;
            } else if (error instanceof SyntaxError) {
                reason = `luaL_loadbuffer: Error loading (${filename}): ${error.message}`;
            } else {
                if (loadingStateId === undefined) throw error;
                reason = `Lua error: ${loadingStateId}:${filename} ${error instanceof Error ? error.message : String(error)}`;
            }
            await impossible(reason);
            // C makerooms() closes a failed theme and clears its filename so
            // this level and later levels use ordinary rooms instead.
            const dungeon = game.dungeons[dungeonNumber];
            if (dungeon) dungeon.themeRooms = undefined;
            activeThemes.delete(game);
            return false;
        }
        themedLuaSessions.set(state, session);
    } else {
        session.beginLevel(active, { special: false });
    }

    if (!state) throw new Error('Themed room initialization did not create a Lua state.');
    activeThemes.set(game, { state, session });
    await state.callValueAsync(state.getGlobal('pre_themerooms_generate'), []);
    return true;
}

export async function callLuaThemerooms(name: string, args: LuaValue[] = []): Promise<LuaValues> {
    const state = activeThemes.get(game)?.state;
    if (!state) throw new Error('themed rooms are not active');
    return state.callValueAsync(state.getGlobal(name), args);
}

export async function themerooms_generate(): Promise<boolean> {
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
