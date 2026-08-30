import { LuaTable, luaValueToJs } from './runtime.js';
import { unwrapSelection } from './selection.js';

function tableOptions(value) {
    if (!(value instanceof LuaTable))
        throw new TypeError('des.level_init expects a table');
    return luaValueToJs(value);
}

export function createDesBindings(operations) {
    return {
        level_init: options => operations.levelInit(tableOptions(options)),
        level_flags: (...flags) => operations.levelFlags(flags),
        map: source => operations.map(String(source)),
        terrain: (selection, terrain) => operations.terrain(
            unwrapSelection(selection), String(terrain),
        ),
        region: (selection, lighting) => operations.region(
            unwrapSelection(selection), String(lighting),
        ),
        stair: direction => operations.stair(String(direction)),
        non_diggable: selection => operations.nonDiggable(
            selection == null ? null : unwrapSelection(selection),
        ),
        object: (...args) => operations.object(...args),
        trap: (...args) => operations.trap(...args),
        monster: (...args) => operations.monster(...args),
    };
}
