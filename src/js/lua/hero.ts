// C nhlua.c:init_u_data() and nhl_meta_u_index().

import { Invocation_lev } from '../const.js';
import { depth } from '../hacklib.js';
import { LuaTable } from './runtime.js';
import { luaString as luaStringArgument } from './arguments.js';
import type { LuaValue } from './runtime.js';
import type { GameState } from '../game_state.js';
import type { ObjectApi } from './objects.js';

const HERO_FIELDS = [
    'ux', 'uy', 'dx', 'dy', 'dz', 'tx', 'ty', 'ulevel', 'ulevelmax',
    'uhunger', 'nv_range', 'xray_range', 'umonster', 'umonnum', 'mh',
    'mhmax', 'mtimedone', 'uluck', 'uhp', 'uhpmax', 'uen', 'uenmax',
] as const;

function isHeroField(value: LuaValue): value is typeof HERO_FIELDS[number] {
    return HERO_FIELDS.some(field => field === value);
}

export class LuaHeroTable extends LuaTable {
    constructor(private readonly game: GameState, private readonly objects: ObjectApi) {
        super();
        super.set('giveobj', objects.give);
        super.set('clear_inventory', objects.clearInventory);
    }

    override get(key: LuaValue): LuaValue {
        if (super.get(key) !== null) return super.get(key);
        const state = this.game;
        const hero = state.u;
        const field = luaStringArgument(key);
        if (isHeroField(field)) return hero[field] ?? 0;
        switch (field) {
        case 'inventory': return this.objects.wrap(state.inventory[0] || null);
        case 'role': return state.urole?.name.m ?? null;
        case 'moves': return state.moves;
        case 'dnum': return hero.uz?.dnum ?? 0;
        case 'dlevel': return hero.uz?.dlevel ?? 0;
        case 'uhave_amulet': return Number(!!hero.uhave?.amulet);
        case 'depth': return depth(hero.uz, state.dungeons);
        case 'invocation_level': return Invocation_lev(hero.uz);
        default: throw new TypeError(`Unknown u table index: ${String(key)}`);
        }
    }

    override set(key: LuaValue, value: LuaValue): void {
        // The C table stores its functions directly; only player fields
        // are read-only lookups through its metatable.
        if (super.get(key) !== null) return super.set(key, value);
        throw new TypeError('Cannot set u table values');
    }
}
