import { RANDOM_CLASS, ILLOBJ_CLASS, WEAPON_CLASS, RING_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, } from '../objclass.js';
import { objectClassForType, CORPSE, EGG, FIGURINE, OBJECT_DESCRIPTIONS, OBJECT_NAMES, STATUE, TIN, } from '../object_data.js';
import { ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, COLNO, CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, ROWNO, RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB, } from '../const.js';
import { MONSTER_NAME, monsterTypeName } from '../monster_data.js';
import { game } from '../gstate.js';
import { LuaTable, luaValueToJs } from './runtime.js';
import { unwrapSelection } from './selection.js';
import { luaInteger } from './arguments.js';
import { OBJECT_CLASS_SYMBOLS } from '../display.js';
export const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];
export const TRAP_TYPES = new Map([
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
// Shared Lua boundary validation for des.* tables. Each binding owns its defaults and feature creation.
export function tableOptions(value, lighting = 'terrain', preferExplicitRegion = false) {
    if (!(value instanceof LuaTable))
        throw new TypeError('des operation expects a table');
    const options = {};
    for (const key of [
        'id', 'class', 'montype', 'appear_as', 'align', 'bg', 'buc', 'dir',
        'direction', 'destwall', 'fg', 'filling', 'fromterrain', 'halign', 'map', 'mapfragment',
        'name', 'property', 'state', 'srcwall', 'style', 'text', 'toterrain', 'typ', 'type', 'valign',
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
        'amount', 'blinded', 'chance', 'corrwid', 'damage', 'destdoor', 'destroom', 'eroded', 'filled', 'fleeing',
        'gem_prob', 'gold_prob', 'h', 'kelp_moat', 'kelp_pool', 'm_lev_adj',
        'paralyzed', 'pos', 'quantity', 'recharged', 'seentraps', 'spe', 'srcdoor', 'srcroom', 'ttl', 'w',
        'wallthick', 'x', 'x1', 'x2', 'y', 'y1', 'y2'
    ]) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        if ((key === 'spe' || key === 'quantity') && typeof entry === 'string'
            && entry.toLowerCase() === 'random')
            continue;
        if (typeof entry !== 'number' || !Number.isInteger(entry))
            throw new TypeError(`des.${key} must be an integer`);
        options[key] = entry;
    }
    for (const key of [
        'achievement', 'adjacentok', 'arrival_room', 'asleep', 'avenge', 'broken',
        'buried', 'cancelled', 'confused', 'countbirth', 'deadends', 'degrade', 'dishwasher',
        'exclude_islev', 'female', 'greased', 'group', 'guardobjects', 'historic',
        'ignorewater', 'invisible', 'irregular', 'joined', 'keep_default_invent', 'laid_by_you',
        'lit', 'locked', 'looted', 'male', 'peaceful', 'pudding', 'region_islev', 'revived', 'ring', 'seen',
        'smoothed', 'spider_on_web', 'stocked', 'stunned', 'swarm', 'tail', 'trap_known',
        'trapped', 'victim', 'waiting', 'walled', 'warned'
    ]) {
        const entry = value.get(key);
        if (entry == null)
            continue;
        if (key === 'lit' && lighting === 'integer') {
            options.lit = luaInteger(entry);
            continue;
        }
        if (typeof entry !== 'boolean' && typeof entry !== 'number')
            throw new TypeError(`des.${key} must be a flag`);
        if ((key !== 'lit' || lighting === 'boolean')
            && typeof entry === 'number' && entry !== 0 && entry !== 1)
            throw new TypeError(`des.${key} must be zero or one`);
        options[key] = key === 'lit' ? entry : !!entry;
    }
    for (const key of ['coord', 'teledest']) {
        if (key === 'coord' && ((options.x ?? -1) !== -1 || (options.y ?? -1) !== -1))
            continue;
        const entry = value.get(key);
        if (entry == null)
            continue;
        const location = get_coord(luaArgument(entry));
        if (!location)
            throw new TypeError(`des.${key} must be a coordinate`);
        options[key] = Array.isArray(luaArgument(entry))
            ? [location.x, location.y] : location;
    }
    for (const key of ['region', 'exclude']) {
        if (key === 'region' && preferExplicitRegion
            && [options.x1, options.y1, options.x2, options.y2]
                .some(axis => axis !== undefined && axis !== -1))
            continue;
        const region = get_table_region(value, key);
        if (region)
            options[key] = region;
    }
    for (const key of ['contents', 'inventory', 'selection']) {
        const entry = value.get(key);
        if (entry != null)
            options[key] = entry;
    }
    return options;
}
export function luaArgument(value) {
    return value instanceof LuaTable ? luaValueToJs(value) : value;
}
// C sp_lev.c:get_coord(). Read the pair form or the named x/y form.
export function get_coord(value, y = null) {
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
// C sp_lev.c:get_table_xy_or_coord(): the x/y fields, or the coord table
// when both axes are absent.
export function get_table_xy_or_coord(options) {
    const x = options.x ?? -1;
    const y = options.y ?? -1;
    return x === -1 && y === -1 ? get_coord(options.coord) : { x, y };
}
export function objectClassForSymbol(symbol) {
    const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
    if (objectClass < ILLOBJ_CLASS)
        throw new Error(`unknown Lua object class ${symbol}`);
    return objectClass;
}
// C sp_lev.c:find_objtype(): resolve an object by name, honoring the class
// symbol and the "ring of "-style prefixes, then by description.
export function find_objtype(name, classSymbol = null, state = game) {
    const prefixes = [
        ['ring of ', RING_CLASS],
        ['potion of ', POTION_CLASS],
        ['scroll of ', SCROLL_CLASS],
        ['spellbook of ', SPBOOK_CLASS],
        ['wand of ', WAND_CLASS],
    ];
    let desiredClass = Math.max(RANDOM_CLASS, OBJECT_CLASS_SYMBOLS.indexOf(typeof classSymbol === 'string' ? classSymbol : ''));
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
// C sp_lev.c:find_montype(): resolve a monster name, including its male and
// female spellings, with the gender it implies.
export function find_montype(name) {
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
// C sp_lev.c:l_register_des(). Register the native des entrypoints and their Lua return contracts.
export function l_register_des(operations, wrapSelection) {
    const commands = {
        level_init: operations.levelInit,
        level_flags: (...flags) => operations.levelFlags(flags),
        mineralize: operations.mineralize,
        message: value => operations.message(String(value)),
        terrain: operations.terrain,
        replace_terrain: operations.replaceTerrain,
        room: operations.room,
        stair: operations.stair,
        ladder: operations.ladder,
        door: operations.door,
        drawbridge: operations.drawbridge,
        engraving: operations.engraving,
        gold: operations.gold,
        grave: operations.grave,
        feature: operations.feature,
        altar: operations.altar,
        non_diggable: selection => operations.nonDiggable(selection == null ? null : unwrapSelection(selection)),
        non_passwall: selection => operations.nonPasswall(selection == null ? null : unwrapSelection(selection)),
        wall_property: operations.wallProperty,
        wallify: operations.wallify,
        teleport_region: operations.teleportRegion,
        levregion: operations.levelRegion,
        exclusion: operations.exclusion,
        gas_cloud: operations.gasCloud,
        random_corridors: operations.randomCorridors,
        corridor: operations.corridor,
        mazewalk: operations.mazeWalk,
        trap: operations.trap,
        monster: operations.monster,
        region: (selection, lighting) => selection instanceof LuaTable
            ? operations.roomRegion(selection)
            : operations.region(unwrapSelection(selection), String(lighting)),
    };
    const bindings = {
        map: async (value) => wrapSelection(await operations.map(value)),
        object: (id, x, y) => operations.object(id, x, y),
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
// C sp_lev.c:get_table_region(). Read the four-entry region or exclusion array.
function get_table_region(table, key) {
    const entry = table.get(key);
    if (entry == null)
        return null;
    const coordinates = luaArgument(entry);
    if (!Array.isArray(coordinates) || coordinates.length !== 4
        || !coordinates.every(value => typeof value === 'number'))
        throw new TypeError(`des.${key} must contain four coordinates`);
    const [lx, ly, hx, hy] = coordinates;
    if (typeof lx !== 'number' || typeof ly !== 'number'
        || typeof hx !== 'number' || typeof hy !== 'number'
        || ![lx, ly, hx, hy].every(Number.isInteger))
        throw new TypeError(`des.${key} must contain four coordinates`);
    return [lx, ly, hx, hy];
}
//# sourceMappingURL=des.js.map