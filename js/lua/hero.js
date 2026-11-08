// C nhlua.c:init_u_data(), nhl_meta_u_index(), get_table_int(),
// get_table_str() and get_table_str_opt().
import { depth, Invocation_lev } from '../dungeon.js';
import { LuaTable } from './runtime.js';
import { luaString as luaStringArgument } from './arguments.js';
// C nhlua.c:get_table_str(): the required string fields of a dungeon
// definition table.
export function definitionString(value, path) {
    if (typeof value !== 'string')
        throw new TypeError(`${path} must be a string`);
    return value;
}
// C nhlua.c:get_table_str_opt(): the optional string fields of a dungeon
// definition table.
export function optionalDefinitionString(value, path) {
    return value == null ? undefined : definitionString(value, path);
}
// C nhlua.c:get_table_int(): the integer fields of a dungeon definition
// table — also get_table_int_opt(), whose fallback value is the third
// argument here.
export function definitionInteger(value, path, fallback) {
    if (value == null && fallback !== undefined)
        return fallback;
    if (typeof value !== 'number' || !Number.isSafeInteger(value))
        throw new TypeError(`${path} must be an integer`);
    return value;
}
const HERO_FIELDS = [
    'ux', 'uy', 'dx', 'dy', 'dz', 'tx', 'ty', 'ulevel', 'ulevelmax',
    'uhunger', 'nv_range', 'xray_range', 'umonster', 'umonnum', 'mh',
    'mhmax', 'mtimedone', 'uluck', 'uhp', 'uhpmax', 'uen', 'uenmax',
];
// Part of C nhlua.c:nhl_meta_u_index(): membership in the ustruct[] field
// list.
function isHeroField(value) {
    return HERO_FIELDS.some(field => field === value);
}
export class LuaHeroTable extends LuaTable {
    game;
    objects;
    constructor(game, objects) {
        super();
        this.game = game;
        this.objects = objects;
        super.set('giveobj', objects.give);
        super.set('clear_inventory', objects.clearInventory);
    }
    // C nhlua.c:nhl_meta_u_index(): the ustruct[] field loop first, then
    // the inventory/role/moves/uhave_amulet/depth/invocation_level lookups,
    // and "Unknown u table index" for anything else.
    get(key) {
        if (super.get(key) !== null)
            return super.get(key);
        const state = this.game;
        const hero = state.u;
        const field = luaStringArgument(key);
        if (isHeroField(field))
            return hero[field] ?? 0;
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
    set(key, value) {
        // The C table stores its functions directly; only player fields
        // are read-only lookups through its metatable.
        if (super.get(key) !== null)
            return super.set(key, value);
        throw new TypeError('Cannot set u table values');
    }
}
//# sourceMappingURL=hero.js.map