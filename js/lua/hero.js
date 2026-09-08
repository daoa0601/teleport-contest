// C nhlua.c:init_u_data() and nhl_meta_u_index().

import { Invocation_lev } from '../const.js';
import { depth } from '../hacklib.js';
import { LuaTable } from './runtime.js';

const HERO_FIELDS = new Set([
    'ux', 'uy', 'dx', 'dy', 'dz', 'tx', 'ty', 'ulevel', 'ulevelmax',
    'uhunger', 'nv_range', 'xray_range', 'umonster', 'umonnum', 'mh',
    'mhmax', 'mtimedone', 'uluck', 'uhp', 'uhpmax', 'uen', 'uenmax',
]);

export class LuaHeroTable extends LuaTable {
    constructor(state, objects) {
        super();
        this.game = state;
        this.objects = objects;
        super.set('giveobj', objects.give);
        super.set('clear_inventory', objects.clearInventory);
    }

    get(key) {
        if (this.values.has(key)) return super.get(key);
        const state = this.game;
        const hero = state.u;
        if (HERO_FIELDS.has(key)) return hero[key] ?? 0;
        switch (key) {
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

    set(key, value) {
        // The C table stores its functions directly; only player fields
        // are read-only lookups through its metatable.
        if (this.values.has(key)) return super.set(key, value);
        throw new TypeError('Cannot set u table values');
    }
}
