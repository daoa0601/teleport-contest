import {
    AIR, CLOUD, COLNO, CORR, CROSSWALL, DOOR, FOUNTAIN, HWALL, ICE, IRONBARS, LAVAPOOL,
    LAVAWALL, LEVEL_TIMER_KIND, MATCH_WALL, MAX_TYPE, MOAT, POOL, ROOM, ROWNO, SCORR, SDOOR,
    SINK, STONE, THRONE, TREE, VWALL, WATER,
} from '../const.js';
import { LUA_SOURCES } from '../generated/lua_sources.js';
import { commandKeyDescription, isok } from '../cmd.js';
import { applyNethackrc } from '../cfgfiles.js';
import { rn2 } from '../rng.js';
import { changeTutorialState } from '../tutorial_state.js';
import { luaPline, luaText } from './messages.js';
import { LuaArgumentError, NethackLuaError } from './errors.js';
import { luaInteger, luaToInteger } from './arguments.js';
import { luaTimerArrayEntry } from './des.js';
import { stopLevelTimer, scheduleLevelTimer } from '../timeout.js';
import { LuaHeroTable } from './hero.js';
import { createObjectApi } from './nhlobj.js';
import type { ObjectApi } from './nhlobj.js';
import type { GameState } from '../game_state.js';
import type { LuaHostObject, LuaValue } from './runtime.js';
import {
    LuaState, LuaTable, luaCheckInteger, luaCheckString, luaType, luaTableToArray,
    luaVariablesFromTable, luaValueToJs, objectToLuaTable,
} from './runtime.js';
import { impossible } from '../pline.js';
import { game } from '../gstate.js';

export interface LuaBindings extends LuaHostObject {
    nh?: LuaHostObject;
}

export class LuaGameState extends LuaState {
    constructor(bindings: LuaBindings, readonly objects: ObjectApi, readonly sid: number) {
        super(bindings, objects.destroy);
    }
}

type BeforeExecute = ((state: LuaGameState) => void) | null;

const CALLBACK_NAMES = ['cmd_before', 'level_enter', 'level_leave', 'end_turn'] as const;
export type LuaCallbackName = typeof CALLBACK_NAMES[number];
export type LuaAlignmentName = 'law' | 'neutral' | 'chaos';

// Part of C nhlua.c:nhl_callback(): membership in decl.c's nhcb_name[]
// callback list.
function isCallbackName(name: string): name is LuaCallbackName {
    return CALLBACK_NAMES.some(event => event === name);
}

// Port only: validate a Lua alignment name for the des bindings.
function alignmentName(value: LuaValue): LuaAlignmentName {
    if (value === 'law' || value === 'neutral' || value === 'chaos') return value;
    throw new TypeError(`Invalid Lua alignment name: ${String(value)}`);
}

// C nhlua.c:nhl_init(): the nh.* function registration
// (rn2, parse_config, callback, pline, text, ...).
function bindingsFor(
    gameState: GameState, lifecycle: LuaLifecycle, objects: ObjectApi,
    additionalBindings: LuaBindings = {},
): LuaBindings {
    const { nh: additionalNh = {}, ...remainingBindings }
        = additionalBindings;
    const parseConfig = (...args: LuaValue[]) => {
        if (args.length !== 1) throw new NethackLuaError('Wrong args');
        applyNethackrc(luaCheckString(1, args[0]), gameState);
    };
    return {
        nh: {
            rn2: (...args: LuaValue[]) => {
                if (args.length !== 1) throw new NethackLuaError('Wrong args');
                return rn2(luaInteger(args[0]));
            },
            random: (...args: LuaValue[]) => {
                if (args.length === 1) return rn2(luaInteger(args[0]));
                if (args.length === 2)
                    return luaInteger(args[0]) + rn2(luaInteger(args[1]));
                throw new NethackLuaError('Wrong args');
            },
            callback: (...args: LuaValue[]) => {
                if (lifecycle.registerCallback(args))
                    return impossible('nh.callback counts are wrong', { state: gameState });
                return undefined;
            },
            gamestate: (...args) => changeTutorialState(
                gameState, args.at(-1) != null && args.at(-1) !== false,
            ),
            pline: luaPline,
            text: luaText,
            impossible: async (...args: LuaValue[]) => {
                if (args.length !== 1) throw new NethackLuaError('Wrong args');
                await impossible(luaCheckString(1, args[0]), { state: gameState });
            },
            eckey: (...args: LuaValue[]) => args.length === 1
                ? commandKeyDescription(
                    luaCheckString(1, args[0]), gameState.commandBindings)
                : undefined,
            parse_config: parseConfig,
            ...additionalNh,
        },
        nhc: { COLNO, ROWNO },
        u: new LuaHeroTable(gameState, objects),
        des: {},
        selection: {},
        obj: objects.bindings,
        ...remainingBindings,
    };
}

// nhlua.c:nhl_get_timertype() takes luaL_checkoption over timeout_funcs'
// timer names, in timeout.h order; timer_is_pos() admits only melt-ice.
const LEVEL_TIMER_TYPE_NAMES = [
    'rot-organic', 'rot-corpse', 'revive-mon', 'zombify-mon',
    'burn-obj', 'hatch-egg', 'fig-transform', 'shrink-glob', 'melt-ice',
];

// Part of C nhlua.c:nhl_get_xy_params(): the x/y parameter read — two
// integers, or one table through sp_lev.c:get_coord() (x/y fields or a
// two-entry array); reached by nhl_timer_start_at() after the timer type
// and delay were popped.
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

// C nhlua.c:nhl_timer_start_at(): register a level timer at a map
// position; only melt-ice is a position timer (timer_is_pos()). The
// special-level binding passes its room context's origin, which C reads
// through cvt_to_abscoord() when translating the caller's relative
// position.
export function startTimerAt(xstart: number, ystart: number, args: readonly LuaValue[]): void {
    // nhl_get_timertype() takes luaL_checkoption over every
    // timeout_funcs entry at stack index -2, so a bad name is
    // lauxlib's argument error carrying that index; only melt-ice is
    // a position timer (timer_is_pos()).
    const timerIndex = -2;
    if (args.length === 1) {
        // With one argument, stack index -2 holds the called
        // function itself. With none, C reads its caller's frame;
        // this interpreter cannot reproduce that invalid access
        // without Lua's VM stack.
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
    // nhl_timer_start_at() and cvt_to_abscoord() store signed 16-bit
    // coordxy values. Narrow before addition so large Lua integers
    // retain their low bits, then narrow the sum.
    const relativeX = (point.x << 16) >> 16;
    const relativeY = (point.y << 16) >> 16;
    const timerX = ((xstart + relativeX) << 16) >> 16;
    const timerY = ((ystart + relativeY) << 16) >> 16;
    if (!isok(timerX, timerY)) return;
    const deadline = (game.moves ?? 0) + when;
    stopLevelTimer(timerX, timerY, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game);
    scheduleLevelTimer(
        timerX, timerY,
        LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        deadline,
        game,
    );
}

export class LuaLifecycle {
    private stateCount = 0;
    core: LuaGameState | null;
    readonly themed: Map<number, { gameState: GameState; state: LuaGameState }>;
    readonly unavailableHooks: Set<string>;
    readonly callbackCounts: Map<LuaCallbackName, number>;
    private _destroyPromise: Promise<void> | null;

    constructor() {
        this.core = null;
        this.themed = new Map();
        this.unavailableHooks = new Set();
        this.callbackCounts = new Map();
        this._destroyPromise = null;
    }

    createState(gameState: GameState, bindings: LuaBindings = {}): LuaGameState {
        const objects = createObjectApi(gameState);
        // nhlL_newstate() numbers every state, including temporary states.
        const state = new LuaGameState(
            bindingsFor(gameState, this, objects, bindings), objects, ++this.stateCount,
        );
        // nhl_loadlua() names each buffer with its parenthesized filename.
        state.execute(luaSource('nhlib.lua'), '(nhlib.lua)');
        return state;
    }

    async startCore(gameState: GameState): Promise<LuaGameState> {
        const previous = this.core;
        this.core = null;
        await previous?.destroy();
        this.unavailableHooks.clear();
        this.callbackCounts.clear();
        const savedVariables = gameState.nh_lua_variables || null;
        this.core = this.createState(gameState);
        this.core.execute(luaSource('nhcore.lua'), '(nhcore.lua)');
        if (savedVariables) {
            this.core.setGlobal(
                'nh_lua_variables', objectToLuaTable(savedVariables),
            );
        }
        gameState.splev_align = luaTableToArray(
            this.core.getGlobal('align'),
        ).map(alignmentName);
        this.syncVariables(gameState);
        return this.core;
    }

    // C l_nhcore_call() stops trying a hook after finding it undefined.
    async callCore(gameState: GameState, name: string): Promise<void> {
        if (!this.core || this.unavailableHooks.has(name)) return;
        const hooks = this.core.getGlobal('nhcore');
        if (!(hooks instanceof LuaTable)) {
            const previous = this.core;
            this.core = null;
            await previous.destroy();
            return;
        }
        const hook = hooks.get(name);
        if (luaType(hook) !== 'function') {
            this.unavailableHooks.add(name);
            return;
        }
        await this.core.callValueAsync(hook, []);
        this.syncVariables(gameState);
    }

    async changeTutorialMode(gameState: GameState, entering: boolean): Promise<void> {
        await this.callCore(gameState, entering ? 'enter_tutorial' : 'leave_tutorial');
        if (!entering) {
            this.unavailableHooks.add('enter_tutorial');
            this.unavailableHooks.add('leave_tutorial');
        }
    }

    // C nhlua.c:nhl_callback(): register or remove one named callback —
    // the argc 2/3 shapes, nhcb_name[] membership, the count fix, and the
    // negative-count report returned to the nh.callback binding for its
    // impossible(). Names stay in the persistent core, even when the
    // registration comes from a temporary level-generation Lua state.
    registerCallback(args: LuaValue[]): boolean {
        if (!this.core) throw new Error('Lua callbacks require an initialized core');
        if (args.length !== 2 && args.length !== 3) return false;
        let [name, fn, remove] = args;
        if (![name, fn].every(value => ['string', 'number'].includes(typeof value)))
            throw new TypeError('nh.callback expects an event name and function name');
        name = String(name);
        fn = String(fn);
        if (!isCallbackName(name)) return false;
        const removing = remove != null && remove !== false;
        const count = (this.callbackCounts.get(name) || 0) + (removing ? -1 : 1);
        this.callbackCounts.set(name, count);
        // nhl_callback() reports a removal that drives a count negative
        // with impossible(). The removal itself must run in every
        // execution mode: synchronous Lua cannot await the paged report,
        // and nh_callback_rm is silent, so running it before the report
        // leaves the observable output identical to the C order.
        this.core.call(removing ? 'nh_callback_rm' : 'nh_callback_set', name, fn);
        return removing && count < 0;
    }

    async runCallbacks(gameState: GameState, name: LuaCallbackName, ...args: LuaValue[]): Promise<boolean> {
        if (!this.core || !this.callbackCounts.get(name)) return true;
        const result = await this.core.callValueAsync(
            this.core.getGlobal('nh_callback_run'), [name, ...args],
        );
        this.syncVariables(gameState);
        const value = result.values[0];
        return value != null && value !== false;
    }

    createSpecialState(gameState: GameState, bindings: LuaBindings = {}): LuaGameState {
        return this.createState(gameState, bindings);
    }

    async executeSpecial(
        gameState: GameState, filename: string, bindings: LuaBindings = {},
        beforeExecute: BeforeExecute = null,
    ): Promise<void> {
        const state = this.createSpecialState(gameState, bindings);
        try {
            const source = luaSource(filename);
            beforeExecute?.(state);
            await state.executeAsync(source, `(${filename})`);
        } finally {
            await state.destroy();
        }
    }

    async loadData(gameState: GameState, filename: string, globalName: string): Promise<unknown> {
        const state = this.createSpecialState(gameState);
        try {
            const source = luaSource(filename);
            state.execute(source, `(${filename})`);
            return luaValueToJs(state.getGlobal(globalName));
        } finally {
            await state.destroy();
        }
    }

    getThemedState(gameState: GameState, dungeonNumber: number): LuaGameState | null {
        const entry = this.themed.get(dungeonNumber);
        return entry && entry.gameState === gameState ? entry.state : null;
    }

    async createThemedState(
        gameState: GameState, dungeonNumber: number, filename: string,
        bindings: LuaBindings = {}, beforeExecute: BeforeExecute = null,
    ): Promise<LuaGameState> {
        const previous = this.themed.get(dungeonNumber)?.state;
        this.themed.delete(dungeonNumber);
        await previous?.destroy();
        const state = this.createSpecialState(gameState, bindings);
        try {
            const source = luaSource(filename);
            beforeExecute?.(state);
            await state.executeAsync(source, `(${filename})`);
            this.themed.set(dungeonNumber, { gameState, state });
            return state;
        } catch (error) {
            await state.destroy();
            throw error;
        }
    }

    syncVariables(gameState: GameState): void {
        if (!this.core) return;
        gameState.nh_lua_variables = luaVariablesFromTable(
            this.core.getGlobal('nh_lua_variables'),
        );
    }

    destroy(): Promise<void> {
        if (this._destroyPromise) return this._destroyPromise;
        const states = [this.core, ...[...this.themed.values()].map(entry => entry.state)];
        this.core = null;
        this.themed.clear();
        this._destroyPromise = Promise.resolve().then(async () => {
            try {
                for (const state of states) await state?.destroy();
            } finally {
                this._destroyPromise = null;
            }
        });
        return this._destroyPromise;
    }
}

// Port only: look up a packaged Lua source by file name.
function luaSource(filename: string): string {
    const source = LUA_SOURCES[filename];
    if (!source) throw new Error(`Lua source is not packaged: ${filename}`);
    return source;
}

let activeLifecycle = new LuaLifecycle();

const MAP_CHAR_TYPES: Readonly<Record<string, number>> = {
    ' ': STONE,
    '#': CORR,
    '.': ROOM,
    '-': HWALL,
    '|': VWALL,
    '+': DOOR,
    A: AIR,
    C: CLOUD,
    S: SDOOR,
    H: SCORR,
    '{': FOUNTAIN,
    '\\': THRONE,
    K: SINK,
    '}': MOAT,
    P: POOL,
    L: LAVAPOOL,
    Z: LAVAWALL,
    I: ICE,
    W: WATER,
    T: TREE,
    F: IRONBARS,
    x: MAX_TYPE,
    B: CROSSWALL,
    w: MATCH_WALL,
};

// C nhlua.c:splev_chr2typ(): the map character type table; an unmatched
// character has no type (C INVALID_TYPE).
export function mapCharacterType(character: string | undefined): number | undefined {
    return character === undefined ? undefined : MAP_CHAR_TYPES[character];
}

// Port only: bind the process-wide active Lua lifecycle.
export function bindLuaLifecycle(lifecycle: LuaLifecycle): void {
    if (!(lifecycle instanceof LuaLifecycle))
        throw new TypeError('bindLuaLifecycle requires a LuaLifecycle');
    activeLifecycle = lifecycle;
}

// Port only: the process-wide active Lua lifecycle.
export function currentLuaLifecycle(): LuaLifecycle {
    return activeLifecycle;
}

// C nhlua.c:l_nhcore_init(): entry adapter; LuaLifecycle.startCore()
// initializes the core.
export async function l_nhcore_init(): Promise<void> {
    await currentLuaLifecycle().startCore(game);
}

