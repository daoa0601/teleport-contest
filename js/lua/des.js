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
        terrain: (...args) => args.length === 3
            ? operations.terrainAt(args[0], args[1], String(args[2]))
            : operations.terrain(
                unwrapSelection(args[0]), String(args[1]),
            ),
        replace_terrain: value => {
            const options = tableOptions(value);
            return operations.replaceTerrain({
                ...options,
                selection: options.selection == null
                    ? null : unwrapSelection(options.selection),
            });
        },
        region: (selection, lighting) => selection instanceof LuaTable
            ? operations.roomRegion(tableOptions(selection))
            : operations.region(
                unwrapSelection(selection), String(lighting),
            ),
        stair: (...args) => operations.stair(...args.map(luaArgument)),
        door: (...args) => operations.door(...args.map(luaArgument)),
        feature: (...args) => operations.feature(...args.map(luaArgument)),
        non_diggable: selection => operations.nonDiggable(
            selection == null ? null : unwrapSelection(selection),
        ),
        wallify: () => operations.wallify(),
        teleport_region: value => operations.teleportRegion(
            tableOptions(value),
        ),
        levregion: value => operations.levelRegion(tableOptions(value)),
        mazewalk: value => operations.mazeWalk(tableOptions(value)),
        object: (...args) => operations.object(...args.map(luaArgument)),
        trap: (...args) => operations.trap(...args.map(luaArgument)),
        monster: (...args) => operations.monster(...args.map(luaArgument)),
    };
}
