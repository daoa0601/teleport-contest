import { ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, COLNO, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, ROWNO, RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB, } from '../const.js';
import { OBJECT_BASES, OBJECT_DESCRIPTIONS, OBJECT_NAMES, } from '../object_data.js';
import { MONSTER_NAME, monsterTypeName } from '../monster_data.js';
import { game } from '../gstate.js';
import { LuaTable, luaValueToJs } from './runtime.js';
import { unwrapSelection } from './selection.js';
import { luaInteger } from './arguments.js';
import { OBJECT_CLASS_SYMBOLS } from '../object_knowledge.js';
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
        throw new TypeError('des operation expects a table');
    const options = {};
    for (const key of [
        'id', 'class', 'montype', 'appear_as', 'align', 'bg', 'buc', 'dir',
        'direction', 'fg', 'filling', 'fromterrain', 'halign', 'map', 'mapfragment',
        'name', 'state', 'style', 'text', 'toterrain', 'typ', 'type', 'valign',
        'wall', 'xalign', 'yalign'
    ]) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        if (typeof entry !== 'string')
            throw new TypeError(`des.${key} must be a string`);
        options[key] = entry;
    }
    for (const key of [
        'amount', 'blinded', 'chance', 'corrwid', 'eroded', 'filled', 'fleeing',
        'gem_prob', 'gold_prob', 'h', 'kelp_moat', 'kelp_pool', 'm_lev_adj',
        'paralyzed', 'pos', 'quantity', 'recharged', 'seentraps', 'spe', 'w',
        'wallthick', 'x', 'x1', 'x2', 'y', 'y1', 'y2'
    ]) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        if (typeof entry !== 'number')
            throw new TypeError(`des.${key} must be a number`);
        options[key] = entry;
    }
    for (const key of [
        'achievement', 'adjacentok', 'arrival_room', 'asleep', 'avenge', 'broken',
        'buried', 'cancelled', 'confused', 'countbirth', 'deadends', 'degrade', 'dishwasher',
        'exclude_islev', 'female', 'greased', 'group', 'guardobjects', 'historic',
        'ignorewater', 'invisible', 'irregular', 'joined', 'keep_default_invent',
        'lit', 'locked', 'looted', 'male', 'peaceful', 'pudding', 'region_islev', 'revived', 'ring', 'seen',
        'smoothed', 'spider_on_web', 'stocked', 'stunned', 'swarm', 'tail', 'tknown',
        'trapped', 'victim', 'waiting', 'walled', 'warned'
    ]) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        if (typeof entry !== 'boolean' && typeof entry !== 'number')
            throw new TypeError(`des.${key} must be a flag`);
        if (key !== 'lit' && typeof entry === 'number' && entry !== 0 && entry !== 1)
            throw new TypeError(`des.${key} must be zero or one`);
        options[key] = key === 'lit' ? entry : !!entry;
    }
    for (const key of ['coord', 'teledest']) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        const location = point(luaArgument(entry));
        if (!location)
            throw new TypeError(`des.${key} must be a coordinate`);
        options[key] = Array.isArray(luaArgument(entry))
            ? [location.x, location.y] : location;
    }
    for (const key of ['region', 'exclude']) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        const coordinates = luaArgument(entry);
        if (!Array.isArray(coordinates) || coordinates.length !== 4
            || !coordinates.every(value => typeof value === 'number'))
            throw new TypeError(`des.${key} must contain four coordinates`);
        const [lx, ly, hx, hy] = coordinates;
        if (typeof lx !== 'number' || typeof ly !== 'number'
            || typeof hx !== 'number' || typeof hy !== 'number')
            throw new TypeError(`des.${key} must contain four coordinates`);
        options[key] = [lx, ly, hx, hy];
    }
    for (const key of ['contents', 'inventory', 'selection']) {
        const entry = value.get(key);
        if (entry != null)
            options[key] = entry;
    }
    return options;
}
function luaArgument(value) {
    return value instanceof LuaTable ? luaValueToJs(value) : value;
}
function point(value, y = null) {
    if (typeof value === 'number' && typeof y === 'number'
        && Number.isInteger(value) && Number.isInteger(y))
        return { x: value, y };
    if (Array.isArray(value) && value.length >= 2) {
        const coordinates = value;
        const [x, pointY] = coordinates;
        if (typeof x === 'number' && typeof pointY === 'number')
            return { x, y: pointY };
    }
    if (value && typeof value === 'object' && 'x' in value && 'y' in value
        && typeof value.x === 'number' && typeof value.y === 'number'
        && Number.isInteger(value.x) && Number.isInteger(value.y))
        return { x: value.x, y: value.y };
    return null;
}
function objectClassForType(type) {
    for (let objectClass = 2; objectClass < OBJECT_BASES.length - 1; objectClass++) {
        const first = OBJECT_BASES[objectClass];
        const afterLast = OBJECT_BASES[objectClass + 1];
        if (first === undefined || afterLast === undefined)
            throw new Error(`Missing object class boundary ${objectClass}`);
        if (type >= first && type < afterLast)
            return objectClass;
    }
    return 1;
}
function objectClassForSymbol(symbol) {
    const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
    if (objectClass < 1)
        throw new Error(`unknown Lua object class ${symbol}`);
    return objectClass;
}
export function objectTypeForName(name, classSymbol = null, state = game) {
    const prefixes = [
        ['ring of ', 4],
        ['potion of ', 8],
        ['scroll of ', 9],
        ['spellbook of ', 10],
        ['wand of ', 11],
    ];
    let desiredClass = Math.max(0, OBJECT_CLASS_SYMBOLS.indexOf(typeof classSymbol === 'string' ? classSymbol : ''));
    let target = String(name).toLowerCase();
    if (!target)
        return 0; // STRANGE_OBJECT: request a random object.
    for (const [prefix, prefixClass] of prefixes) {
        if (!target.startsWith(prefix))
            continue;
        target = target.slice(prefix.length);
        desiredClass = prefixClass;
        break;
    }
    for (let type = 0; type < OBJECT_NAMES.length; type++) {
        if (desiredClass && desiredClass !== objectClassForType(type))
            continue;
        if (OBJECT_NAMES[type]?.toLowerCase() === target)
            return type;
    }
    // C find_objtype() uses shuffled descriptions and does not constrain
    // its description search by the requested object class.
    const descriptions = state.objectDescriptions ?? OBJECT_DESCRIPTIONS;
    for (let type = 0; type < descriptions.length; type++) {
        if (descriptions[type]?.toLowerCase() === target)
            return type;
    }
    throw new Error(`unknown Lua object ${name}`);
}
function objectOptions(id, x, y) {
    const options = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1)
            options.class = id;
        else
            options.id = id;
    }
    const location = point(options.coord)
        ?? point(options.x, options.y)
        ?? point(luaArgument(x), luaArgument(y));
    const corpseMonster = options.montype == null
        ? null : String(options.montype);
    const spinachTin = typeof options.id === 'string'
        && options.id.toLowerCase() === 'tin'
        && corpseMonster?.toLowerCase() === 'spinach';
    const corpseMonsterClass = corpseMonster?.length === 1
        ? MONSTER_CLASS_SYMBOLS.indexOf(corpseMonster) : null;
    if (corpseMonster?.length === 1 && (corpseMonsterClass == null || corpseMonsterClass < 1))
        throw new Error(`unknown Lua monster class ${corpseMonster}`);
    return {
        ...options,
        point: location,
        objectClass: options.class
            ? objectClassForSymbol(options.class) : null,
        objectType: options.id
            ? objectTypeForName(options.id, options.class) : null,
        monsterType: corpseMonster && corpseMonster.length > 1 && !spinachTin
            ? monsterTypeForName(corpseMonster).type : null,
        monsterClass: corpseMonsterClass,
        spinachTin,
    };
}
function monsterTypeForName(name) {
    const target = String(name).toLowerCase();
    for (let type = 0; type < MONSTER_NAME.length; type++) {
        const neutral = MONSTER_NAME[type]?.toLowerCase();
        if (neutral === target)
            return { type, female: null };
        const male = monsterTypeName(type, false)?.toLowerCase();
        const female = monsterTypeName(type, true)?.toLowerCase();
        if (male !== neutral && male === target)
            return { type, female: false };
        if (female !== neutral && female === target)
            return { type, female: true };
    }
    throw new Error(`unknown Lua monster ${name}`);
}
function monsterOptions(id, x, y) {
    const options = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1)
            options.class = id;
        else
            options.id = id;
    }
    const monsterClass = options.class
        ? MONSTER_CLASS_SYMBOLS.indexOf(options.class) : null;
    if (options.class && (monsterClass == null || monsterClass < 1))
        throw new Error(`unknown Lua monster class ${options.class}`);
    const namedMonster = options.id ? monsterTypeForName(options.id) : null;
    let appearance = null;
    if (typeof options.appear_as === 'string') {
        const separator = options.appear_as.indexOf(':');
        if (separator < 1)
            throw new Error(`unknown Lua monster appearance ${options.appear_as}`);
        const kind = options.appear_as.slice(0, separator);
        const name = options.appear_as.slice(separator + 1);
        if (kind === 'obj') {
            appearance = { kind: 'object', type: objectTypeForName(name) };
        }
        else if (kind === 'mon') {
            appearance = { kind: 'monster', type: monsterTypeForName(name).type };
        }
        else if (kind === 'ter') {
            appearance = { kind: 'terrain', name };
        }
        else {
            throw new Error(`unknown Lua monster appearance ${options.appear_as}`);
        }
    }
    return {
        ...options,
        point: point(options.coord)
            ?? point(options.x, options.y)
            ?? point(luaArgument(x), luaArgument(y)),
        monsterClass,
        monsterType: namedMonster?.type ?? null,
        nameFemale: namedMonster?.female ?? null,
        appearance,
    };
}
function trapOptions(type, x, y) {
    const options = type instanceof LuaTable
        ? tableOptions(type) : type == null ? {} : { type: String(type) };
    const name = options.type === 'random' ? null : options.type;
    const trapType = name == null ? null : TRAP_TYPES.get(String(name)) ?? null;
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
function doorOptions(state, x, y) {
    if (state instanceof LuaTable) {
        const options = tableOptions(state);
        return {
            ...options,
            state: String(options.state ?? 'random'),
            point: point(options.coord) ?? point(options.x, options.y),
        };
    }
    return {
        state: String(state),
        point: point(luaArgument(x), luaArgument(y)),
    };
}
function stairOptions(direction, x, y) {
    if (direction instanceof LuaTable) {
        const options = tableOptions(direction);
        return {
            direction: String(options.dir ?? 'down'),
            point: point(options.coord) ?? point(options.x, options.y),
        };
    }
    return {
        direction: String(direction),
        point: point(luaArgument(x), luaArgument(y)),
    };
}
function mazeWalkOptions(value, y, direction) {
    if (!(value instanceof LuaTable)) {
        return {
            x: luaInteger(value),
            y: luaInteger(y),
            dir: String(direction ?? 'random'),
            stocked: true,
        };
    }
    const options = tableOptions(value);
    const location = point(options.coord) ?? point(options.x, options.y);
    return {
        ...options,
        ...(location ? { x: location.x, y: location.y } : {}),
        dir: String(options.dir ?? 'random'),
        stocked: options.stocked !== false && options.stocked !== 0,
    };
}
function engravingOptions(value, type, text) {
    if (type != null) {
        return {
            point: point(luaArgument(value)),
            type: String(type),
            text: String(text),
            degrade: true,
            guardobjects: false,
        };
    }
    const options = tableOptions(value);
    return {
        ...options,
        point: point(options.coord) ?? point(options.x, options.y),
        type: String(options.type ?? 'engrave'),
        text: String(options.text),
    };
}
function goldOptions(value, x, y) {
    if (value instanceof LuaTable) {
        const options = tableOptions(value);
        return {
            ...options,
            point: point(options.coord) ?? point(options.x, options.y),
        };
    }
    return {
        amount: typeof value === 'number' && Number.isInteger(value) ? value : -1,
        point: point(luaArgument(x), luaArgument(y)),
    };
}
function callTerrain(operations, args) {
    if (args.length === 3)
        return operations.terrainAt(luaInteger(args[0]), luaInteger(args[1]), String(args[2]));
    if (args[0] instanceof LuaTable) {
        const options = tableOptions(args[0]);
        const location = point(options.coord)
            ?? point(options.x, options.y)
            ?? point(luaArgument(args[0]));
        const type = args.length === 1 ? options.typ : args[1];
        if (location && type != null)
            return operations.terrainAt(location.x, location.y, String(type), options.lit);
        if (options.selection != null && type != null) {
            return operations.terrain(unwrapSelection(options.selection), String(type), options.lit);
        }
    }
    return operations.terrain(unwrapSelection(args[0]), String(args[1]));
}
export function mapOrigin(options, width, height, levelInitialized) {
    const coordinate = Array.isArray(options.coord)
        ? options.coord : [options.x, options.y];
    if (typeof coordinate[0] === 'number' && typeof coordinate[1] === 'number'
        && Number.isInteger(coordinate[0]) && Number.isInteger(coordinate[1])) {
        return {
            xstart: coordinate[0], ystart: coordinate[1], width, height,
        };
    }
    const mazeMaxX = (COLNO - 1) & ~1;
    const mazeMaxY = (ROWNO - 1) & ~1;
    const horizontal = {
        left: levelInitialized ? 1 : 3,
        'half-left': 2 + Math.trunc((mazeMaxX - 2 - width) / 4),
        center: 2 + Math.trunc((mazeMaxX - 2 - width) / 2),
        'half-right': 2 + Math.trunc((mazeMaxX - 2 - width) * 3 / 4),
        right: mazeMaxX - width - 1,
    };
    const vertical = {
        top: 3,
        center: 2 + Math.trunc((mazeMaxY - 2 - height) / 2),
        bottom: mazeMaxY - height - 1,
    };
    let xstart = horizontal[options.halign ?? ''];
    let ystart = vertical[options.valign ?? ''];
    if (xstart === undefined || ystart === undefined
        || !Number.isInteger(xstart) || !Number.isInteger(ystart))
        throw new Error('Lua map needs coordinates or horizontal and vertical alignment');
    if (!(xstart % 2))
        xstart++;
    if (!(ystart % 2))
        ystart++;
    if (ystart < 0 || ystart + height > ROWNO) {
        ystart += ystart > 0 ? -2 : 2;
        if (height === ROWNO)
            ystart = 0;
        if (ystart < 0 || ystart + height > ROWNO)
            ystart = 0;
    }
    return { xstart, ystart, width, height };
}
export function regionCoordinates(context, coordinates, levelCoordinates) {
    if (!coordinates)
        throw new TypeError('Lua region requires four coordinates');
    if (levelCoordinates) {
        return {
            lx: coordinates[0], ly: coordinates[1],
            hx: coordinates[2], hy: coordinates[3],
        };
    }
    return {
        lx: context.xstart + coordinates[0],
        ly: context.ystart + coordinates[1],
        hx: context.xstart + coordinates[2],
        hy: context.ystart + coordinates[3],
    };
}
export function createDesBindings(operations, wrapSelection) {
    const commands = {
        level_init: (options) => operations.levelInit(tableOptions(options)),
        level_flags: (...flags) => operations.levelFlags(flags),
        mineralize: (value) => operations.mineralize(value === undefined ? {} : tableOptions(value)),
        message: (value) => operations.message(String(value)),
        terrain: (...args) => callTerrain(operations, args),
        replace_terrain: (value) => {
            const options = tableOptions(value);
            return operations.replaceTerrain({
                ...options,
                selection: options.selection == null
                    ? null : unwrapSelection(options.selection),
            });
        },
        region: (selection, lighting) => selection instanceof LuaTable
            ? operations.roomRegion(tableOptions(selection))
            : operations.region(unwrapSelection(selection), String(lighting)),
        room: (value) => operations.room(tableOptions(value)),
        stair: (direction, x, y) => operations.stair(stairOptions(direction, x, y)),
        ladder: (direction, x, y) => operations.ladder(stairOptions(direction, x, y)),
        door: (state, x, y) => operations.door(doorOptions(state, x, y)),
        drawbridge: (value) => operations.drawbridge(tableOptions(value)),
        engraving: (value, type, text) => operations.engraving(engravingOptions(value, type, text)),
        gold: (value, x, y) => operations.gold(goldOptions(value, x, y)),
        grave: (value, y, text) => {
            const options = value instanceof LuaTable ? tableOptions(value) : {};
            return operations.grave({
                ...options,
                ...(text == null ? {} : { text: String(text) }),
                point: point(options.coord) ?? point(options.x, options.y)
                    ?? point(luaArgument(value), luaArgument(y)),
            });
        },
        feature: (type, x, y) => {
            const options = type instanceof LuaTable ? tableOptions(type) : {};
            return operations.feature({
                ...options,
                type: options.type ?? String(type),
                point: point(options.coord) ?? point(options.x, options.y)
                    ?? point(luaArgument(x), luaArgument(y)),
            });
        },
        altar: (value) => operations.altar(tableOptions(value)),
        non_diggable: (selection) => operations.nonDiggable(selection == null ? null : unwrapSelection(selection)),
        non_passwall: (selection) => operations.nonPasswall(selection == null ? null : unwrapSelection(selection)),
        wallify: () => operations.wallify(),
        teleport_region: (value) => operations.teleportRegion(tableOptions(value)),
        levregion: (value) => operations.levelRegion(tableOptions(value)),
        exclusion: (value) => operations.exclusion(tableOptions(value)),
        gas_cloud: (value) => {
            const options = tableOptions(value);
            return operations.gasCloud({
                ...options,
                selection: unwrapSelection(options.selection),
            });
        },
        random_corridors: () => operations.randomCorridors(),
        mazewalk: (value, y, direction) => operations.mazeWalk(mazeWalkOptions(value, y, direction)),
        trap: (type, x, y) => operations.trap(trapOptions(type, x, y)),
        monster: (id, x, y) => operations.monster(monsterOptions(id, x, y)),
    };
    const bindings = {
        map: async (value) => wrapSelection(await operations.map(value instanceof LuaTable ? tableOptions(value) : String(value))),
        object: (id, x, y) => operations.object(objectOptions(id, x, y)),
    };
    // C's des callbacks return no Lua values except map and object. Internal
    // game functions may return an entity to their other callers.
    for (const [name, command] of Object.entries(commands)) {
        bindings[name] = (...args) => {
            const result = command(...args);
            if (result instanceof Promise)
                return result.then(() => undefined);
            return undefined;
        };
    }
    return bindings;
}
//# sourceMappingURL=des.js.map