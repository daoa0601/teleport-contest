import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, COLNO, DART_TRAP, FIRE_TRAP, HOLE,
    LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP,
    ROCKTRAP, ROLLING_BOULDER_TRAP, ROWNO, RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT,
    SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB,
} from '../const.js';
import {
    OBJECT_BASES, OBJECT_DESCRIPTIONS, OBJECT_NAMES,
} from '../object_data.js';
import { MONSTER_NAME, monsterTypeName } from '../monster_data.js';
import { game } from '../gstate.js';
import { LuaTable, luaValueToJs } from './runtime.js';
import type { LuaHostObject, LuaValue } from './runtime.js';
import type { GameState } from '../game_state.js';
import type { SpecialSelection } from '../selvar.js';
import type { SelectionContext } from './selection.js';
import { unwrapSelection } from './selection.js';
import { luaInteger } from './arguments.js';
import { OBJECT_CLASS_SYMBOLS } from '../object_knowledge.js';

export interface LuaPoint { x: number; y: number }
export type LuaRegion = [number, number, number, number];
type Coordinate = [number, number] | LuaPoint;
type LuaFlag = boolean | number;

// These are the named arguments accepted by the level-description API.
// Lua tables are checked at this boundary before the game receives them.
export interface DesOptions {
    id?: string;
    class?: string;
    montype?: string;
    appear_as?: string;
    align?: string;
    bg?: string;
    buc?: string;
    dir?: string;
    direction?: string;
    fg?: string;
    filling?: string;
    fromterrain?: string;
    halign?: string;
    map?: string;
    mapfragment?: string;
    name?: string;
    state?: string;
    style?: string;
    text?: string;
    toterrain?: string;
    typ?: string;
    type?: string;
    valign?: string;
    wall?: string;
    xalign?: string;
    yalign?: string;
    amount?: number;
    blinded?: number;
    chance?: number;
    corrwid?: number;
    eroded?: number;
    filled?: number;
    fleeing?: number;
    gem_prob?: number;
    gold_prob?: number;
    h?: number;
    kelp_moat?: number;
    kelp_pool?: number;
    m_lev_adj?: number;
    paralyzed?: number;
    pos?: number;
    quantity?: number;
    recharged?: number;
    seentraps?: number;
    spe?: number;
    w?: number;
    wallthick?: number;
    x?: number;
    x1?: number;
    x2?: number;
    y?: number;
    y1?: number;
    y2?: number;
    achievement?: LuaFlag;
    adjacentok?: LuaFlag;
    arrival_room?: LuaFlag;
    asleep?: LuaFlag;
    avenge?: LuaFlag;
    broken?: LuaFlag;
    buried?: LuaFlag;
    cancelled?: LuaFlag;
    confused?: LuaFlag;
    countbirth?: LuaFlag;
    deadends?: LuaFlag;
    degrade?: LuaFlag;
    exclude_islev?: LuaFlag;
    female?: LuaFlag;
    greased?: LuaFlag;
    group?: LuaFlag;
    guardobjects?: LuaFlag;
    historic?: LuaFlag;
    ignorewater?: LuaFlag;
    invisible?: LuaFlag;
    irregular?: LuaFlag;
    joined?: LuaFlag;
    keep_default_invent?: LuaFlag;
    lit?: LuaFlag;
    locked?: LuaFlag;
    male?: LuaFlag;
    peaceful?: LuaFlag;
    region_islev?: LuaFlag;
    revived?: LuaFlag;
    seen?: LuaFlag;
    smoothed?: LuaFlag;
    spider_on_web?: LuaFlag;
    stocked?: LuaFlag;
    stunned?: LuaFlag;
    tail?: LuaFlag;
    tknown?: LuaFlag;
    trapped?: LuaFlag;
    victim?: LuaFlag;
    waiting?: LuaFlag;
    walled?: LuaFlag;
    coord?: Coordinate;
    teledest?: Coordinate;
    region?: LuaRegion;
    exclude?: LuaRegion;
    contents?: LuaValue;
    inventory?: LuaValue;
    selection?: LuaValue;
}

export interface DesObjectOptions extends DesOptions {
    point: LuaPoint | null;
    objectClass: number | null;
    objectType: number | null;
    monsterType: number | null;
    monsterClass: number | null;
    spinachTin: boolean;
}

export type MonsterAppearance =
    | { kind: 'object'; type: number }
    | { kind: 'monster'; type: number }
    | { kind: 'terrain'; name: string };

export interface DesMonsterOptions extends DesOptions {
    point: LuaPoint | null;
    monsterClass: number | null;
    monsterType: number | null;
    nameFemale: boolean | null;
    appearance: MonsterAppearance | null;
}

export type PositionedDesOptions = DesOptions & { point: LuaPoint | null };
export type DesSelectionOptions = Omit<DesOptions, 'selection'> & {
    selection: SpecialSelection | null;
};
export type DesOperationResult = unknown;
export interface DesOperations {
    levelInit(options: DesOptions): DesOperationResult;
    levelFlags(flags: LuaValue[]): DesOperationResult;
    mineralize(options: DesOptions): DesOperationResult;
    message(message: string): DesOperationResult;
    map(options: DesOptions | string): SpecialSelection | Promise<SpecialSelection>;
    terrainAt(x: number, y: number, character: string, lit?: LuaFlag): DesOperationResult;
    terrain(selection: SpecialSelection, character: string, lit?: LuaFlag): DesOperationResult;
    replaceTerrain(options: DesSelectionOptions): DesOperationResult;
    roomRegion(options: DesOptions): DesOperationResult;
    region(selection: SpecialSelection, lighting: string): DesOperationResult;
    room(options: DesOptions): DesOperationResult;
    stair(options: { direction: string; point: LuaPoint | null }): DesOperationResult;
    ladder(options: { direction: string; point: LuaPoint | null }): DesOperationResult;
    door(options: PositionedDesOptions & { state: string }): DesOperationResult;
    drawbridge(options: DesOptions): DesOperationResult;
    engraving(options: PositionedDesOptions & { type: string; text: string }): DesOperationResult;
    gold(options: PositionedDesOptions): DesOperationResult;
    grave(options: PositionedDesOptions): DesOperationResult;
    feature(options: { type: string; point: LuaPoint | null }): DesOperationResult;
    altar(options: DesOptions): DesOperationResult;
    nonDiggable(selection: SpecialSelection | null): DesOperationResult;
    nonPasswall(selection: SpecialSelection | null): DesOperationResult;
    wallify(): DesOperationResult;
    teleportRegion(options: DesOptions): DesOperationResult;
    levelRegion(options: DesOptions): DesOperationResult;
    exclusion(options: DesOptions): DesOperationResult;
    gasCloud(options: DesSelectionOptions & { selection: SpecialSelection }): DesOperationResult;
    randomCorridors(): DesOperationResult;
    mazeWalk(options: DesOptions & { dir: string; stocked: boolean }): DesOperationResult;
    object(options: DesObjectOptions): LuaValue | Promise<LuaValue>;
    trap(options: PositionedDesOptions & { trapType: number | null }): DesOperationResult;
    monster(options: DesMonsterOptions): DesOperationResult;
}

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

function tableOptions(value: LuaValue | undefined): DesOptions {
    if (!(value instanceof LuaTable))
        throw new TypeError('des operation expects a table');
    const options: DesOptions = {};
    for (const key of [
        'id', 'class', 'montype', 'appear_as', 'align', 'bg', 'buc', 'dir',
        'direction', 'fg', 'filling', 'fromterrain', 'halign', 'map', 'mapfragment',
        'name', 'state', 'style', 'text', 'toterrain', 'typ', 'type', 'valign',
        'wall', 'xalign', 'yalign'
    ] as const) {
        const entry = value.get(key);
        if (entry == null) continue;
        if (typeof entry !== 'string')
            throw new TypeError(`des.${key} must be a string`);
        options[key] = entry;
    }
    for (const key of [
        'amount', 'blinded', 'chance', 'corrwid', 'eroded', 'filled', 'fleeing',
        'gem_prob', 'gold_prob', 'h', 'kelp_moat', 'kelp_pool', 'm_lev_adj',
        'paralyzed', 'pos', 'quantity', 'recharged', 'seentraps', 'spe', 'w',
        'wallthick', 'x', 'x1', 'x2', 'y', 'y1', 'y2'
    ] as const) {
        const entry = value.get(key);
        if (entry == null) continue;
        if (typeof entry !== 'number')
            throw new TypeError(`des.${key} must be a number`);
        options[key] = entry;
    }
    for (const key of [
        'achievement', 'adjacentok', 'arrival_room', 'asleep', 'avenge', 'broken',
        'buried', 'cancelled', 'confused', 'countbirth', 'deadends', 'degrade',
        'exclude_islev', 'female', 'greased', 'group', 'guardobjects', 'historic',
        'ignorewater', 'invisible', 'irregular', 'joined', 'keep_default_invent',
        'lit', 'locked', 'male', 'peaceful', 'region_islev', 'revived', 'seen',
        'smoothed', 'spider_on_web', 'stocked', 'stunned', 'tail', 'tknown',
        'trapped', 'victim', 'waiting', 'walled'
    ] as const) {
        const entry = value.get(key);
        if (entry == null) continue;
        if (typeof entry !== 'boolean' && typeof entry !== 'number')
            throw new TypeError(`des.${key} must be a flag`);
        options[key] = entry;
    }
    for (const key of ['coord', 'teledest'] as const) {
        const entry = value.get(key);
        if (entry == null) continue;
        const location = point(luaArgument(entry));
        if (!location) throw new TypeError(`des.${key} must be a coordinate`);
        options[key] = Array.isArray(luaArgument(entry))
            ? [location.x, location.y] : location;
    }
    for (const key of ['region', 'exclude'] as const) {
        const entry = value.get(key);
        if (entry == null) continue;
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
    for (const key of ['contents', 'inventory', 'selection'] as const) {
        const entry = value.get(key);
        if (entry != null) options[key] = entry;
    }
    return options;
}

function luaArgument(value: LuaValue | undefined): unknown {
    return value instanceof LuaTable ? luaValueToJs(value) : value;
}

function point(value: unknown, y: unknown = null): LuaPoint | null {
    if (typeof value === 'number' && typeof y === 'number'
        && Number.isInteger(value) && Number.isInteger(y))
        return { x: value, y };
    if (Array.isArray(value) && value.length >= 2) {
        const coordinates: readonly unknown[] = value;
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

function objectClassForType(type: number) {
    for (let objectClass = 2;
        objectClass < OBJECT_BASES.length - 1; objectClass++) {
        const first = OBJECT_BASES[objectClass];
        const afterLast = OBJECT_BASES[objectClass + 1];
        if (first === undefined || afterLast === undefined)
            throw new Error(`Missing object class boundary ${objectClass}`);
        if (type >= first && type < afterLast) return objectClass;
    }
    return 1;
}

function objectClassForSymbol(symbol: string) {
    const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
    if (objectClass < 1)
        throw new Error(`unknown Lua object class ${symbol}`);
    return objectClass;
}

export function objectTypeForName(name: unknown, classSymbol: unknown = null, state: GameState = game): number {
    const prefixes: [string, number][] = [
        ['ring of ', 4],
        ['potion of ', 8],
        ['scroll of ', 9],
        ['spellbook of ', 10],
        ['wand of ', 11],
    ];
    let desiredClass = Math.max(0, OBJECT_CLASS_SYMBOLS.indexOf(typeof classSymbol === 'string' ? classSymbol : ''));
    let target = String(name).toLowerCase();
    if (!target) return 0; // STRANGE_OBJECT: request a random object.
    for (const [prefix, prefixClass] of prefixes) {
        if (!target.startsWith(prefix)) continue;
        target = target.slice(prefix.length);
        desiredClass = prefixClass;
        break;
    }
    for (let type = 0; type < OBJECT_NAMES.length; type++) {
        if (desiredClass && desiredClass !== objectClassForType(type)) continue;
        if (OBJECT_NAMES[type]?.toLowerCase() === target) return type;
    }
    // C find_objtype() uses shuffled descriptions and does not constrain
    // its description search by the requested object class.
    const descriptions = state.objectDescriptions ?? OBJECT_DESCRIPTIONS;
    for (let type = 0; type < descriptions.length; type++) {
        if (descriptions[type]?.toLowerCase() === target) return type;
    }
    throw new Error(`unknown Lua object ${name}`);
}

function objectOptions(id: LuaValue | undefined, x: LuaValue | undefined, y: LuaValue | undefined): DesObjectOptions {
    const options: DesOptions = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1) options.class = id;
        else options.id = id;
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

function monsterTypeForName(name: string) {
    const target = String(name).toLowerCase();
    for (let type = 0; type < MONSTER_NAME.length; type++) {
        const neutral = MONSTER_NAME[type]?.toLowerCase();
        if (neutral === target) return { type, female: null };
        const male = monsterTypeName(type, false)?.toLowerCase();
        const female = monsterTypeName(type, true)?.toLowerCase();
        if (male !== neutral && male === target)
            return { type, female: false };
        if (female !== neutral && female === target)
            return { type, female: true };
    }
    throw new Error(`unknown Lua monster ${name}`);
}

function monsterOptions(id: LuaValue | undefined, x: LuaValue | undefined, y: LuaValue | undefined): DesMonsterOptions {
    const options: DesOptions = id instanceof LuaTable
        ? tableOptions(id) : {};
    if (typeof id === 'string') {
        if (id.length === 1) options.class = id;
        else options.id = id;
    }
    const monsterClass = options.class
        ? MONSTER_CLASS_SYMBOLS.indexOf(options.class) : null;
    if (options.class && (monsterClass == null || monsterClass < 1))
        throw new Error(`unknown Lua monster class ${options.class}`);
    const namedMonster = options.id ? monsterTypeForName(options.id) : null;
    let appearance: MonsterAppearance | null = null;
    if (typeof options.appear_as === 'string') {
        const separator = options.appear_as.indexOf(':');
        if (separator < 1)
            throw new Error(`unknown Lua monster appearance ${options.appear_as}`);
        const kind = options.appear_as.slice(0, separator);
        const name = options.appear_as.slice(separator + 1);
        if (kind === 'obj') {
            appearance = { kind: 'object', type: objectTypeForName(name) };
        } else if (kind === 'mon') {
            appearance = { kind: 'monster', type: monsterTypeForName(name).type };
        } else if (kind === 'ter') {
            appearance = { kind: 'terrain', name };
        } else {
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

function trapOptions(type: LuaValue | undefined, x: LuaValue | undefined, y: LuaValue | undefined): PositionedDesOptions & { trapType: number | null } {
    const options: DesOptions = type instanceof LuaTable
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

function doorOptions(state: LuaValue | undefined, x: LuaValue | undefined, y: LuaValue | undefined): PositionedDesOptions & { state: string } {
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

function stairOptions(direction: LuaValue | undefined, x: LuaValue | undefined, y: LuaValue | undefined): { direction: string; point: LuaPoint | null } {
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

function mazeWalkOptions(value: LuaValue | undefined, y: LuaValue | undefined, direction: LuaValue | undefined): DesOptions & { dir: string; stocked: boolean } {
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

function engravingOptions(value: LuaValue | undefined, type: LuaValue | undefined, text: LuaValue | undefined): PositionedDesOptions & { type: string; text: string } {
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

function goldOptions(value: LuaValue | undefined, x: LuaValue | undefined, y: LuaValue | undefined): PositionedDesOptions {
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

function callTerrain(operations: DesOperations, args: LuaValue[]) {
    if (args.length === 3)
        return operations.terrainAt(luaInteger(args[0]), luaInteger(args[1]), String(args[2]));
    if (args[0] instanceof LuaTable) {
        const options = tableOptions(args[0]);
        const location = point(options.coord)
            ?? point(options.x, options.y)
            ?? point(luaArgument(args[0]));
        const type = args.length === 1 ? options.typ : args[1];
        if (location && type != null)
            return operations.terrainAt(
                location.x, location.y, String(type), options.lit,
            );
        if (options.selection != null && type != null) {
            return operations.terrain(
                unwrapSelection(options.selection), String(type), options.lit,
            );
        }
    }
    return operations.terrain(
        unwrapSelection(args[0]), String(args[1]),
    );
}

export function mapOrigin(options: DesOptions, width: number, height: number, levelInitialized: boolean) {
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
    const horizontal: Record<string, number> = {
        left: levelInitialized ? 1 : 3,
        'half-left': 2 + Math.trunc((mazeMaxX - 2 - width) / 4),
        center: 2 + Math.trunc((mazeMaxX - 2 - width) / 2),
        'half-right': 2 + Math.trunc(
            (mazeMaxX - 2 - width) * 3 / 4,
        ),
        right: mazeMaxX - width - 1,
    };
    const vertical: Record<string, number> = {
        top: 3,
        center: 2 + Math.trunc((mazeMaxY - 2 - height) / 2),
        bottom: mazeMaxY - height - 1,
    };
    let xstart = horizontal[options.halign ?? ''];
    let ystart = vertical[options.valign ?? ''];
    if (xstart === undefined || ystart === undefined
        || !Number.isInteger(xstart) || !Number.isInteger(ystart))
        throw new Error('Lua map needs coordinates or horizontal and vertical alignment');
    if (!(xstart % 2)) xstart++;
    if (!(ystart % 2)) ystart++;
    if (ystart < 0 || ystart + height > ROWNO) {
        ystart += ystart > 0 ? -2 : 2;
        if (height === ROWNO) ystart = 0;
        if (ystart < 0 || ystart + height > ROWNO) ystart = 0;
    }
    return { xstart, ystart, width, height };
}

export function regionCoordinates(context: Pick<SelectionContext, 'xstart' | 'ystart'>, coordinates: LuaRegion | undefined, levelCoordinates: LuaFlag | undefined) {
    if (!coordinates) throw new TypeError('Lua region requires four coordinates');
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

export function createDesBindings(
    operations: DesOperations,
    wrapSelection: (value: SpecialSelection) => LuaValue,
): LuaHostObject {
    const commands: Record<string, (...args: LuaValue[]) => unknown> = {
        level_init: (options: LuaValue) => operations.levelInit(tableOptions(options)),
        level_flags: (...flags: LuaValue[]) => operations.levelFlags(flags),
        mineralize: (value: LuaValue) => operations.mineralize(
            value === undefined ? {} : tableOptions(value),
        ),
        message: (value: LuaValue) => operations.message(String(value)),
        terrain: (...args: LuaValue[]) => callTerrain(operations, args),
        replace_terrain: (value: LuaValue) => {
            const options = tableOptions(value);
            return operations.replaceTerrain({
                ...options,
                selection: options.selection == null
                    ? null : unwrapSelection(options.selection),
            });
        },
        region: (selection: LuaValue, lighting: LuaValue) => selection instanceof LuaTable
            ? operations.roomRegion(tableOptions(selection))
            : operations.region(
                unwrapSelection(selection), String(lighting),
            ),
        room: (value: LuaValue) => operations.room(tableOptions(value)),
        stair: (direction: LuaValue, x: LuaValue, y: LuaValue) => operations.stair(
            stairOptions(direction, x, y),
        ),
        ladder: (direction: LuaValue, x: LuaValue, y: LuaValue) => operations.ladder(
            stairOptions(direction, x, y),
        ),
        door: (state: LuaValue, x: LuaValue, y: LuaValue) => operations.door(doorOptions(state, x, y)),
        drawbridge: (value: LuaValue) => operations.drawbridge(tableOptions(value)),
        engraving: (value: LuaValue, type: LuaValue, text: LuaValue) => operations.engraving(
            engravingOptions(value, type, text),
        ),
        gold: (value: LuaValue, x: LuaValue, y: LuaValue) => operations.gold(goldOptions(value, x, y)),
        grave: (value: LuaValue, y: LuaValue, text: LuaValue) => {
            const options = value instanceof LuaTable ? tableOptions(value) : {};
            return operations.grave({
                ...options,
                ...(text == null ? {} : { text: String(text) }),
                point: point(options.coord) ?? point(options.x, options.y)
                    ?? point(luaArgument(value), luaArgument(y)),
            });
        },
        feature: (type: LuaValue, x: LuaValue, y: LuaValue) => operations.feature({
            type: String(type),
            point: point(luaArgument(x), luaArgument(y)),
        }),
        altar: (value: LuaValue) => operations.altar(tableOptions(value)),
        non_diggable: (selection: LuaValue) => operations.nonDiggable(
            selection == null ? null : unwrapSelection(selection),
        ),
        non_passwall: (selection: LuaValue) => operations.nonPasswall(
            selection == null ? null : unwrapSelection(selection),
        ),
        wallify: () => operations.wallify(),
        teleport_region: (value: LuaValue) => operations.teleportRegion(
            tableOptions(value),
        ),
        levregion: (value: LuaValue) => operations.levelRegion(tableOptions(value)),
        exclusion: (value: LuaValue) => operations.exclusion(tableOptions(value)),
        gas_cloud: (value: LuaValue) => {
            const options = tableOptions(value);
            return operations.gasCloud({
                ...options,
                selection: unwrapSelection(options.selection),
            });
        },
        random_corridors: () => operations.randomCorridors(),
        mazewalk: (value: LuaValue, y: LuaValue, direction: LuaValue) => operations.mazeWalk(
            mazeWalkOptions(value, y, direction),
        ),
        trap: (type: LuaValue, x: LuaValue, y: LuaValue) => operations.trap(trapOptions(type, x, y)),
        monster: (id: LuaValue, x: LuaValue, y: LuaValue) => operations.monster(monsterOptions(id, x, y)),
    };
    const bindings: LuaHostObject = {
        map: async value => wrapSelection(await operations.map(
            value instanceof LuaTable ? tableOptions(value) : String(value),
        )),
        object: (id, x, y) => operations.object(objectOptions(id, x, y)),
    };
    // C's des callbacks return no Lua values except map and object. Internal
    // game functions may return an entity to their other callers.
    for (const [name, command] of Object.entries(commands)) {
        bindings[name] = (...args) => {
            const result = command(...args);
            if (result instanceof Promise) return result.then(() => undefined);
            return undefined;
        };
    }
    return bindings;
}

