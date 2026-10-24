import { COLNO, ROWNO } from '../const.js';
import { LUA_SOURCES } from '../generated/lua_sources.js';
import { commandKeyDescription } from '../command_keys.js';
import { impossible } from '../diagnostics.js';
import { applyNethackrc } from '../options.js';
import { rn2 } from '../rng.js';
import { changeTutorialState } from '../tutorial_state.js';
import { luaPline, luaText } from './messages.js';
import { NethackLuaError } from './errors.js';
import { luaInteger } from './arguments.js';
import { LuaHeroTable } from './hero.js';
import { createObjectApi } from './objects.js';
import type { ObjectApi } from './objects.js';
import type { GameState } from '../game_state.js';
import type { LuaHostObject, LuaValue } from './runtime.js';
import {
    LuaState, LuaTable, luaType, luaTableToArray, luaVariablesFromTable, luaValueToJs,
    objectToLuaTable,
} from './runtime.js';

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

function isCallbackName(name: string): name is LuaCallbackName {
    return CALLBACK_NAMES.some(event => event === name);
}

function alignmentName(value: LuaValue): LuaAlignmentName {
    if (value === 'law' || value === 'neutral' || value === 'chaos') return value;
    throw new TypeError(`Invalid Lua alignment name: ${String(value)}`);
}

function bindingsFor(
    gameState: GameState, lifecycle: LuaLifecycle, objects: ObjectApi,
    additionalBindings: LuaBindings = {},
): LuaBindings {
    const { nh: additionalNh = {}, ...remainingBindings }
        = additionalBindings;
    const parseConfig = (...args: LuaValue[]) => {
        if (args.length !== 1) throw new NethackLuaError('Wrong args');
        applyNethackrc(String(args[0]), gameState);
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
                const result = lifecycle.registerCallback(args);
                return result?.overdrawn
                    ? impossible('nh.callback counts are wrong', { state: gameState })
                    : undefined;
            },
            gamestate: (...args) => changeTutorialState(
                gameState, args.at(-1) != null && args.at(-1) !== false,
            ),
            pline: luaPline,
            text: luaText,
            impossible: async (...args: LuaValue[]) => {
                if (args.length !== 1) throw new NethackLuaError('Wrong args');
                await impossible(String(args[0]), { state: gameState });
            },
            eckey: (...args: LuaValue[]) => args.length === 1
                ? commandKeyDescription(String(args[0]), gameState.commandBindings)
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

    // C nhl_callback() stores names in the persistent core, even when the
    // registration comes from a temporary level-generation Lua state.
    registerCallback(args: LuaValue[]): { overdrawn: boolean } | null {
        if (!this.core) throw new Error('Lua callbacks require an initialized core');
        if (args.length !== 2 && args.length !== 3) return null;
        let [name, fn, remove] = args;
        if (![name, fn].every(value => ['string', 'number'].includes(typeof value)))
            throw new TypeError('nh.callback expects an event name and function name');
        name = String(name);
        fn = String(fn);
        if (!isCallbackName(name)) return null;
        const removing = remove != null && remove !== false;
        const count = (this.callbackCounts.get(name) || 0) + (removing ? -1 : 1);
        this.callbackCounts.set(name, count);
        // nhl_callback() reports each removal that drives a count negative
        // before it asks the core to run nh_callback_rm.
        const overdrawn = removing && count < 0;
        this.core.call(removing ? 'nh_callback_rm' : 'nh_callback_set', name, fn);
        return { overdrawn };
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

function luaSource(filename: string): string {
    const source = LUA_SOURCES[filename];
    if (!source) throw new Error(`Lua source is not packaged: ${filename}`);
    return source;
}

let activeLifecycle = new LuaLifecycle();

export function bindLuaLifecycle(lifecycle: LuaLifecycle): void {
    if (!(lifecycle instanceof LuaLifecycle))
        throw new TypeError('bindLuaLifecycle requires a LuaLifecycle');
    activeLifecycle = lifecycle;
}

export function currentLuaLifecycle(): LuaLifecycle {
    return activeLifecycle;
}

