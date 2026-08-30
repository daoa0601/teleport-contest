import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE,
    LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP,
    ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT,
    SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB,
} from '../const.js';
import {
    OBJECT_BASES, OBJECT_DESCRIPTIONS, OBJECT_NAMES,
} from '../object_data.js';
import { MONSTER_NAME } from '../monster_data.js';
import { LuaTable, luaValueToJs } from './runtime.js';
import { unwrapSelection } from './selection.js';

const OBJECT_CLASS_SYMBOLS = [
    '', ']', ')', '[', '=', '"', '(', '%', '!', '?', '+', '/', '$', '*',
    '`', '0', '_', '.',
];

const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];

const TRAP_TYPES = new Map([
    ['arrow', ARROW_TRAP],
    ['dart', DART_TRAP],
    ['falling rock', ROCKTRAP],
    ['board', SQKY_BOARD],
    ['bear', BEAR_TRAP],
    ['land mine', LANDMINE],
    ['rolling boulder', ROLLING_BOULDER_TRAP],
    ['sleep gas', SLP_GAS_TRAP],
    ['rust', RUST_TRAP],
    ['fire', FIRE_TRAP],
    ['pit', PIT],
    ['spiked pit', SPIKED_PIT],
    ['hole', HOLE],
    ['trap door', TRAPDOOR],
    ['teleport', TELEP_TRAP],
    ['level teleport', LEVEL_TELEP],
    ['magic portal', MAGIC_PORTAL],
    ['web', WEB],
    ['statue', STATUE_TRAP],
    ['magic', MAGIC_TRAP],
    ['anti magic', ANTI_MAGIC],
    ['polymorph', POLY_TRAP],
    ['vibrating square', VIBRATING_SQUARE],
]);

function tableOptions(value) {
    if (!(value instanceof LuaTable))
        throw new TypeError('des.level_init expects a table');
    return luaValueToJs(value);
}

function luaArgument(value) {
    return value instanceof LuaTable ? luaValueToJs(value) : value;
}

function point(value, y = null) {
    if (Number.isInteger(value) && Number.isInteger(y))
        return { x: value, y };
    if (Array.isArray(value) && value.length >= 2)
        return { x: value[0], y: value[1] };
    if (value && Number.isInteger(value.x) && Number.isInteger(value.y))
        return { x: value.x, y: value.y };
    return null;
}

function objectClassForType(type) {
    for (let objectClass = 2;
        objectClass < OBJECT_BASES.length - 1; objectClass++) {
        if (type >= OBJECT_BASES[objectClass]
            && type < OBJECT_BASES[objectClass + 1]) return objectClass;
    }
    return 1;
}

function objectClassForSymbol(symbol) {
    const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
    if (objectClass < 1)
        throw new Error(`unknown Lua object class ${symbol}`);
    return objectClass;
}

function objectTypeForName(name, classSymbol = null) {
    const prefixes = [
        ['ring of ', 4],
        ['potion of ', 8],
        ['scroll of ', 9],
        ['spellbook of ', 10],
        ['wand of ', 11],
    ];
    let desiredClass = classSymbol
        ? objectClassForSymbol(classSymbol) : null;
    let target = String(name).toLowerCase();
    for (const [prefix, prefixClass] of prefixes) {
        if (!target.startsWith(prefix)) continue;
        target = target.slice(prefix.length);
        desiredClass = prefixClass;
        break;
    }
    for (let type = 0; type < OBJECT_NAMES.length; type++) {
        if (desiredClass && desiredClass !== objectClassForType(type)) continue;
        if (OBJECT_NAMES[type]?.toLowerCase() === target
            || OBJECT_DESCRIPTIONS[type]?.toLowerCase() === target) return type;
    }
    throw new Error(`unknown Lua object ${name}`);
}

function objectOptions(id, x, y) {
    const options = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1) options.class = id;
        else options.id = id;
    }
    const location = point(options.coord)
        ?? point(options.x, options.y)
        ?? point(luaArgument(x), luaArgument(y));
    return {
        ...options,
        point: location,
        objectClass: options.class
            ? objectClassForSymbol(options.class) : null,
        objectType: options.id
            ? objectTypeForName(options.id, options.class) : null,
        monsterType: options.montype
            ? monsterTypeForName(options.montype) : null,
    };
}

function monsterTypeForName(name) {
    const target = String(name).toLowerCase();
    const type = MONSTER_NAME.findIndex(candidate =>
        candidate?.toLowerCase() === target);
    if (type < 0) throw new Error(`unknown Lua monster ${name}`);
    return type;
}

function monsterOptions(id, x, y) {
    const options = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1) options.class = id;
        else options.id = id;
    }
    const monsterClass = options.class
        ? MONSTER_CLASS_SYMBOLS.indexOf(options.class) : null;
    if (options.class && monsterClass < 1)
        throw new Error(`unknown Lua monster class ${options.class}`);
    return {
        ...options,
        point: point(options.coord)
            ?? point(options.x, options.y)
            ?? point(luaArgument(x), luaArgument(y)),
        monsterClass,
        monsterType: options.id ? monsterTypeForName(options.id) : null,
    };
}

function trapOptions(type, x, y) {
    const options = type instanceof LuaTable
        ? tableOptions(type) : { type };
    const name = options.type === 'random' ? null : options.type;
    const trapType = name == null ? null : TRAP_TYPES.get(String(name));
    if (name != null && trapType == null)
        throw new Error(`unknown Lua trap ${name}`);
    return {
        ...options,
        point: point(options.coord)
            ?? point(options.x, options.y)
            ?? point(luaArgument(x), luaArgument(y)),
        trapType,
    };
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
        stair: (direction, x, y) => operations.stair({
            direction: String(direction),
            point: point(luaArgument(x), luaArgument(y)),
        }),
        door: (state, x, y) => operations.door({
            state: String(state),
            point: point(luaArgument(x), luaArgument(y)),
        }),
        feature: (type, x, y) => operations.feature({
            type: String(type),
            point: point(luaArgument(x), luaArgument(y)),
        }),
        non_diggable: selection => operations.nonDiggable(
            selection == null ? null : unwrapSelection(selection),
        ),
        wallify: () => operations.wallify(),
        teleport_region: value => operations.teleportRegion(
            tableOptions(value),
        ),
        levregion: value => operations.levelRegion(tableOptions(value)),
        mazewalk: value => operations.mazeWalk(tableOptions(value)),
        object: (id, x, y) => operations.object(objectOptions(id, x, y)),
        trap: (type, x, y) => operations.trap(trapOptions(type, x, y)),
        monster: (id, x, y) => operations.monster(monsterOptions(id, x, y)),
    };
}
