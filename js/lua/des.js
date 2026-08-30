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
        map: value => operations.map(
            value instanceof LuaTable ? tableOptions(value) : String(value),
        ),
        terrain: (selection, terrain) => operations.terrain(
            unwrapSelection(selection), String(terrain),
        ),
        replace_terrain: value => {
            const options = tableOptions(value);
            return operations.replaceTerrain({
                ...options,
                selection: options.selection == null
                    ? null : unwrapSelection(options.selection),
            });
        },
        region: (selection, lighting) => operations.region(
            unwrapSelection(selection), String(lighting),
        ),
        stair: direction => operations.stair(String(direction)),
        feature: (...args) => operations.feature(...args.map(luaArgument)),
        non_diggable: selection => operations.nonDiggable(
            selection == null ? null : unwrapSelection(selection),
        ),
        wallify: () => operations.wallify(),
        object: (...args) => operations.object(...args),
        trap: (...args) => operations.trap(...args),
        monster: (...args) => operations.monster(...args.map(luaArgument)),
    };
}
