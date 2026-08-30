import { COLNO, ROWNO } from '../const.js';
import { LUA_SOURCES } from '../generated/lua_sources.js';
import { depth } from '../hacklib.js';
import { rn2 } from '../rng.js';
import {
    LuaState, luaTableToArray, luaTableToObject, luaValueToJs,
    objectToLuaTable,
} from './runtime.js';

function bindingsFor(gameState, additionalBindings = {}) {
    const { nh: additionalNh = {}, ...remainingBindings }
        = additionalBindings;
    return {
        nh: {
            rn2: range => rn2(range),
            random: (start, range) => Number(start) + rn2(range),
            callback: () => null,
            gamestate: () => null,
            pline: () => null,
            text: () => null,
            eckey: command => command,
            ...additionalNh,
        },
        nhc: { COLNO, ROWNO },
        u: {
            ...(gameState.u || {}),
            depth: depth(gameState.u?.uz, gameState.dungeons),
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

    themedState(gameState, dungeonNumber) {
        if (!this.themed.has(dungeonNumber))
            this.themed.set(dungeonNumber, this.createState(gameState));
        return this.themed.get(dungeonNumber);
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
        for (const state of this.themed.values()) state.destroy();
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
