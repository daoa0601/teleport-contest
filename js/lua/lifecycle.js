import { COLNO, ROWNO } from '../const.js';
import { LUA_CORE_SOURCES } from '../generated/lua_core_sources.js';
import { rn2 } from '../rng.js';
import {
    LuaState, luaTableToArray, luaTableToObject, objectToLuaTable,
} from './runtime.js';

function bindingsFor(gameState) {
    return {
        nh: {
            rn2: range => rn2(range),
            random: (start, range) => Number(start) + rn2(range),
            callback: () => null,
            gamestate: () => null,
            pline: () => null,
            text: () => null,
            eckey: command => command,
        },
        nhc: { COLNO, ROWNO },
        u: gameState.u || {},
        des: {},
        selection: {},
        obj: {},
    };
}

export class LuaLifecycle {
    constructor() {
        this.core = null;
        this.themed = new Map();
    }

    createState(gameState) {
        const state = new LuaState(bindingsFor(gameState));
        state.execute(LUA_CORE_SOURCES['nhlib.lua'], 'nhlib.lua');
        return state;
    }

    startCore(gameState) {
        this.core?.destroy();
        const savedVariables = gameState.nh_lua_variables || null;
        this.core = this.createState(gameState);
        this.core.execute(LUA_CORE_SOURCES['nhcore.lua'], 'nhcore.lua');
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

    createSpecialState(gameState) {
        return this.createState(gameState);
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
