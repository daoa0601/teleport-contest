import { COLNO, ROWNO } from '../const.js';
import { LUA_SOURCES } from '../generated/lua_sources.js';
import { commandKeyDescription } from '../command_keys.js';
import { impossible } from '../diagnostics.js';
import { applyNethackrc } from '../options.js';
import { rn2 } from '../rng.js';
import { changeTutorialState } from '../tutorial_state.js';
import { luaPline, luaText } from './messages.js';
import { luaInteger } from './arguments.js';
import { LuaHeroTable } from './hero.js';
import { createObjectApi } from './objects.js';
import { LuaState, LuaTable, luaType, luaTableToArray, luaVariablesFromTable, luaValueToJs, objectToLuaTable, } from './runtime.js';
export class LuaGameState extends LuaState {
    objects;
    constructor(bindings, objects) {
        super(bindings, objects.destroy);
        this.objects = objects;
    }
}
const CALLBACK_NAMES = ['cmd_before', 'level_enter', 'level_leave', 'end_turn'];
function isCallbackName(name) {
    return CALLBACK_NAMES.some(event => event === name);
}
function alignmentName(value) {
    if (value === 'law' || value === 'neutral' || value === 'chaos')
        return value;
    throw new TypeError(`Invalid Lua alignment name: ${String(value)}`);
}
function bindingsFor(gameState, lifecycle, objects, additionalBindings = {}) {
    const { nh: additionalNh = {}, ...remainingBindings } = additionalBindings;
    const parseConfig = (line) => {
        applyNethackrc(String(line), gameState);
    };
    return {
        nh: {
            rn2: (...args) => {
                if (args.length !== 1)
                    throw new TypeError('nh.rn2 expects one integer');
                return rn2(luaInteger(args[0]));
            },
            random: (...args) => {
                if (args.length === 1)
                    return rn2(luaInteger(args[0]));
                if (args.length === 2)
                    return luaInteger(args[0]) + rn2(luaInteger(args[1]));
                throw new TypeError('nh.random expects one or two integers');
            },
            callback: (...args) => lifecycle.registerCallback(...args),
            gamestate: (...args) => changeTutorialState(gameState, args.at(-1) != null && args.at(-1) !== false),
            pline: luaPline,
            text: luaText,
            impossible: async (message) => { await impossible(String(message), { state: gameState }); },
            eckey: command => commandKeyDescription(String(command), gameState.commandBindings),
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
    core;
    themed;
    unavailableHooks;
    callbackCounts;
    _destroyPromise;
    constructor() {
        this.core = null;
        this.themed = new Map();
        this.unavailableHooks = new Set();
        this.callbackCounts = new Map();
        this._destroyPromise = null;
    }
    createState(gameState, bindings = {}) {
        const objects = createObjectApi(gameState);
        const state = new LuaGameState(bindingsFor(gameState, this, objects, bindings), objects);
        state.execute(luaSource('nhlib.lua'), 'nhlib.lua');
        return state;
    }
    async startCore(gameState) {
        const previous = this.core;
        this.core = null;
        await previous?.destroy();
        this.unavailableHooks.clear();
        this.callbackCounts.clear();
        const savedVariables = gameState.nh_lua_variables || null;
        this.core = this.createState(gameState);
        this.core.execute(luaSource('nhcore.lua'), 'nhcore.lua');
        if (savedVariables) {
            this.core.setGlobal('nh_lua_variables', objectToLuaTable(savedVariables));
        }
        gameState.splev_align = luaTableToArray(this.core.getGlobal('align')).map(alignmentName);
        this.syncVariables(gameState);
        return this.core;
    }
    // C l_nhcore_call() stops trying a hook after finding it undefined.
    async callCore(gameState, name) {
        if (!this.core || this.unavailableHooks.has(name))
            return;
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
    async changeTutorialMode(gameState, entering) {
        await this.callCore(gameState, entering ? 'enter_tutorial' : 'leave_tutorial');
        if (!entering) {
            this.unavailableHooks.add('enter_tutorial');
            this.unavailableHooks.add('leave_tutorial');
        }
    }
    // C nhl_callback() stores names in the persistent core, even when the
    // registration comes from a temporary level-generation Lua state.
    registerCallback(...args) {
        if (!this.core)
            throw new Error('Lua callbacks require an initialized core');
        if (args.length !== 2 && args.length !== 3)
            return;
        let [name, fn, remove] = args;
        if (![name, fn].every(value => ['string', 'number'].includes(typeof value)))
            throw new TypeError('nh.callback expects an event name and function name');
        name = String(name);
        fn = String(fn);
        if (!isCallbackName(name))
            return;
        const removing = remove != null && remove !== false;
        this.callbackCounts.set(name, (this.callbackCounts.get(name) || 0) + (removing ? -1 : 1));
        this.core.call(removing ? 'nh_callback_rm' : 'nh_callback_set', name, fn);
    }
    async runCallbacks(gameState, name, ...args) {
        if (!this.core || !this.callbackCounts.get(name))
            return true;
        const result = await this.core.callValueAsync(this.core.getGlobal('nh_callback_run'), [name, ...args]);
        this.syncVariables(gameState);
        const value = result.values[0];
        return value != null && value !== false;
    }
    createSpecialState(gameState, bindings = {}) {
        return this.createState(gameState, bindings);
    }
    async executeSpecial(gameState, filename, bindings = {}, beforeExecute = null) {
        const state = this.createSpecialState(gameState, bindings);
        try {
            const source = luaSource(filename);
            beforeExecute?.(state);
            await state.executeAsync(source, filename);
        }
        finally {
            await state.destroy();
        }
    }
    async loadData(gameState, filename, globalName) {
        const state = this.createSpecialState(gameState);
        try {
            const source = luaSource(filename);
            state.execute(source, filename);
            return luaValueToJs(state.getGlobal(globalName));
        }
        finally {
            await state.destroy();
        }
    }
    getThemedState(gameState, dungeonNumber) {
        const entry = this.themed.get(dungeonNumber);
        return entry && entry.gameState === gameState ? entry.state : null;
    }
    async createThemedState(gameState, dungeonNumber, filename, bindings = {}, beforeExecute = null) {
        const previous = this.themed.get(dungeonNumber)?.state;
        this.themed.delete(dungeonNumber);
        await previous?.destroy();
        const state = this.createSpecialState(gameState, bindings);
        try {
            const source = luaSource(filename);
            beforeExecute?.(state);
            await state.executeAsync(source, filename);
            this.themed.set(dungeonNumber, { gameState, state });
            return state;
        }
        catch (error) {
            await state.destroy();
            throw error;
        }
    }
    syncVariables(gameState) {
        if (!this.core)
            return;
        gameState.nh_lua_variables = luaVariablesFromTable(this.core.getGlobal('nh_lua_variables'));
    }
    destroy() {
        if (this._destroyPromise)
            return this._destroyPromise;
        const states = [this.core, ...[...this.themed.values()].map(entry => entry.state)];
        this.core = null;
        this.themed.clear();
        this._destroyPromise = Promise.resolve().then(async () => {
            try {
                for (const state of states)
                    await state?.destroy();
            }
            finally {
                this._destroyPromise = null;
            }
        });
        return this._destroyPromise;
    }
}
function luaSource(filename) {
    const source = LUA_SOURCES[filename];
    if (!source)
        throw new Error(`Lua source is not packaged: ${filename}`);
    return source;
}
let activeLifecycle = new LuaLifecycle();
export function bindLuaLifecycle(lifecycle) {
    if (!(lifecycle instanceof LuaLifecycle))
        throw new TypeError('bindLuaLifecycle requires a LuaLifecycle');
    activeLifecycle = lifecycle;
}
export function currentLuaLifecycle() {
    return activeLifecycle;
}
//# sourceMappingURL=lifecycle.js.map