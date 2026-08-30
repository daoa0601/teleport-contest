import { COLNO, Invocation_lev, ROWNO } from '../const.js';
import { LUA_SOURCES } from '../generated/lua_sources.js';
import { depth } from '../hacklib.js';
import { commandKeyDescription } from '../command_keys.js';
import { parseNethackrc } from '../options.js';
import { rn2 } from '../rng.js';
import {
    LuaState, luaTableToArray, luaTableToObject, luaValueToJs,
    objectToLuaTable,
} from './runtime.js';

function bindingsFor(gameState, additionalBindings = {}) {
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
            callback: () => null,
            gamestate: () => null,
            pline: () => null,
            text: () => null,
            eckey: command => commandKeyDescription(
                command, gameState.commandBindings,
            ),
            parse_config: parseConfig,
            ...additionalNh,
        },
        nhc: { COLNO, ROWNO },
        u: {
            ...(gameState.u || {}),
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
    }

    createState(gameState, bindings = {}) {
        const state = new LuaState(bindingsFor(gameState, bindings));
        state.execute(LUA_SOURCES['nhlib.lua'], 'nhlib.lua');
        return state;
    }

    startCore(gameState) {
        this.core?.destroy();
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
        state.setGlobal('u', bindingsFor(gameState).u);
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
