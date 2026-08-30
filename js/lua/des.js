import { LuaTable, luaValueToJs } from './runtime.js';
import { unwrapSelection } from './selection.js';

function tableOptions(value) {
    if (!(value instanceof LuaTable))
        throw new TypeError('des.level_init expects a table');
    return luaValueToJs(value);
}

function luaArgument(value) {
    return value instanceof LuaTable ? luaValueToJs(value) : value;
}

export function createDesBindings(operations) {
    return {
        level_init: options => operations.levelInit(tableOptions(options)),
        level_flags: (...flags) => operations.levelFlags(flags),
        map: source => operations.map(String(source)),
        terrain: (selection, terrain) => operations.terrain(
            unwrapSelection(selection), String(terrain),
        ),
        replace_terrain: value => {
            const options = tableOptions(value);
            return operations.replaceTerrain({
                ...options,
                selection: unwrapSelection(options.selection),
            });
        },
        region: (selection, lighting) => operations.region(
            unwrapSelection(selection), String(lighting),
        ),
        stair: direction => operations.stair(String(direction)),
        non_diggable: selection => operations.nonDiggable(
            selection == null ? null : unwrapSelection(selection),
        ),
        object: (...args) => operations.object(...args),
        trap: (...args) => operations.trap(...args),
        monster: (...args) => operations.monster(...args.map(luaArgument)),
    };
}
