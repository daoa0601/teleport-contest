import { COLNO, Invocation_lev, ROWNO } from '../const.js';
import { LUA_SOURCES } from '../generated/lua_sources.js';
import { depth } from '../hacklib.js';
import { commandKeyDescription } from '../command_keys.js';
import { parseNethackrc } from '../options.js';
import { rn2 } from '../rng.js';
import { changeTutorialState } from '../tutorial_state.js';
import { luaPline, luaText } from './messages.js';
import {
    LuaState, LuaTable, luaType, luaTableToArray, luaTableToObject, luaValueToJs,
    objectToLuaTable,
} from './runtime.js';

const CALLBACK_NAMES = ['cmd_before', 'level_enter', 'level_leave', 'end_turn'];

function bindingsFor(gameState, lifecycle, additionalBindings = {}) {
    const { nh: additionalNh = {}, ...remainingBindings }
        = additionalBindings;
    const roleKey = gameState.urole?.key;
    const roleName = gameState.urole?.name?.m
        ?? gameState.u?.role
        ?? (roleKey
            ? roleKey[0].toUpperCase() + roleKey.slice(1)
            : undefined);
    const parseConfig = line => {
        const parsed = parseNethackrc(String(line));
        Object.assign(gameState.flags || (gameState.flags = {}), parsed.flags);
        Object.assign(gameState.iflags || (gameState.iflags = {}), parsed.iflags);
        Object.assign(
            gameState.commandBindings || (gameState.commandBindings = {}),
            parsed.bindings,
        );
    };
    return {
        nh: {
            rn2: range => rn2(range),
            random: (start, range) => Number(start) + rn2(range),
            callback: (...args) => lifecycle.registerCallback(...args),
            gamestate: (...args) => changeTutorialState(
                gameState, args.at(-1) != null && args.at(-1) !== false,
            ),
            pline: luaPline,
            text: luaText,
            eckey: command => commandKeyDescription(
                command, gameState.commandBindings,
            ),
            parse_config: parseConfig,
            ...additionalNh,
        },
        nhc: { COLNO, ROWNO },
        u: {
            ...(gameState.u || {}),
            moves: gameState.moves,
            dnum: gameState.u?.uz?.dnum,
            dlevel: gameState.u?.uz?.dlevel,
            uhave_amulet: Number(!!gameState.u?.uhave?.amulet),
            depth: depth(gameState.u?.uz, gameState.dungeons),
            invocation_level: Invocation_lev(gameState.u?.uz),
            role: roleName,
        },
        des: {},
        selection: {},
        obj: {},
        ...remainingBindings,
    };
}

export class LuaLifecycle {
    constructor() {
        this.core = null;
        this.themed = new Map();
        this.unavailableHooks = new Set();
        this.callbackCounts = new Map();
    }

    createState(gameState, bindings = {}) {
        const state = new LuaState(bindingsFor(gameState, this, bindings));
        state.execute(LUA_SOURCES['nhlib.lua'], 'nhlib.lua');
        return state;
    }

    startCore(gameState) {
        this.core?.destroy();
        this.unavailableHooks.clear();
        this.callbackCounts.clear();
        const savedVariables = gameState.nh_lua_variables || null;
        this.core = this.createState(gameState);
        this.core.execute(LUA_SOURCES['nhcore.lua'], 'nhcore.lua');
        if (savedVariables) {
            this.core.setGlobal(
                'nh_lua_variables', objectToLuaTable(savedVariables),
            );
        }
        gameState.splev_align = luaTableToArray(
            this.core.getGlobal('align'),
        );
        this.syncVariables(gameState);
        return this.core;
    }

    // C l_nhcore_call() stops trying a hook after finding it undefined.
    async callCore(gameState, name) {
        if (!this.core || this.unavailableHooks.has(name)) return;
        const hooks = this.core.getGlobal('nhcore');
        if (!(hooks instanceof LuaTable)) {
            this.core.destroy();
            this.core = null;
            return;
        }
        const hook = hooks.get(name);
        if (luaType(hook) !== 'function') {
            this.unavailableHooks.add(name);
            return;
        }
        this.refreshUser(this.core, gameState);
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
        if (!this.core) throw new Error('Lua callbacks require an initialized core');
        if (args.length !== 2 && args.length !== 3) return;
        let [name, fn, remove] = args;
        if (![name, fn].every(value => ['string', 'number'].includes(typeof value)))
            throw new TypeError('nh.callback expects an event name and function name');
        name = String(name);
        fn = String(fn);
        if (!CALLBACK_NAMES.includes(name)) return;
        const removing = remove != null && remove !== false;
        this.callbackCounts.set(name,
            (this.callbackCounts.get(name) || 0) + (removing ? -1 : 1));
        this.core.call(removing ? 'nh_callback_rm' : 'nh_callback_set', name, fn);
    }

    async runCallbacks(gameState, name, ...args) {
        if (!this.core || !this.callbackCounts.get(name)) return true;
        this.refreshUser(this.core, gameState);
        const result = await this.core.callValueAsync(
            this.core.getGlobal('nh_callback_run'), [name, ...args],
        );
        this.syncVariables(gameState);
        const value = result.values[0];
        return value != null && value !== false;
    }

    createSpecialState(gameState, bindings = {}) {
        return this.createState(gameState, bindings);
    }

    async executeSpecial(
        gameState, filename, bindings = {}, beforeExecute = null,
    ) {
        const state = this.createSpecialState(gameState, bindings);
        try {
            const source = LUA_SOURCES[filename];
            if (!source) throw new Error(`Lua source is not packaged: ${filename}`);
            beforeExecute?.(state);
            await state.executeAsync(source, filename);
        } finally {
            state.destroy();
        }
    }

    loadData(gameState, filename, globalName) {
        const state = this.createSpecialState(gameState);
        try {
            const source = LUA_SOURCES[filename];
            if (!source) throw new Error(`Lua source is not packaged: ${filename}`);
            state.execute(source, filename);
            return luaValueToJs(state.getGlobal(globalName));
        } finally {
            state.destroy();
        }
    }

    getThemedState(gameState, dungeonNumber) {
        const entry = this.themed.get(dungeonNumber);
        return entry?.gameState === gameState ? entry.state : null;
    }

    createThemedState(
        gameState, dungeonNumber, filename, bindings = {}, beforeExecute = null,
    ) {
        this.themed.get(dungeonNumber)?.state?.destroy();
        const state = this.createSpecialState(gameState, bindings);
        const source = LUA_SOURCES[filename];
        if (!source) throw new Error(`Lua source is not packaged: ${filename}`);
        beforeExecute?.(state);
        state.execute(source, filename);
        this.themed.set(dungeonNumber, { gameState, state });
        return state;
    }

    refreshUser(state, gameState) {
        state.setGlobal('u', bindingsFor(gameState, this).u);
    }

    syncVariables(gameState) {
        if (!this.core) return;
        gameState.nh_lua_variables = luaTableToObject(
            this.core.getGlobal('nh_lua_variables'),
        );
    }

    destroy() {
        this.core?.destroy();
        this.core = null;
        for (const entry of this.themed.values()) entry.state.destroy();
        this.themed.clear();
    }
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
