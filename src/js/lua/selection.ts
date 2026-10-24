import {
    SpecialSelection,
    specialSelectionFloodFill,
    specialSelectionMatch,
    specialSelectionRandLine,
    selection_from_mkroom,
    selection_do_ellipse,
    selection_do_line,
    selection_do_gradient,
    selection_getpoint,
    selection_setpoint,
    selection_not,
    selection_size_description,
    SEL_GRADIENT_RADIAL,
    SEL_GRADIENT_SQUARE,
} from '../selvar.js';
import { LuaTable, LuaUserdata, luaType } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
import { LuaArgumentError, NethackLuaError } from './errors.js';
import { ANY_LOC, getLocationCoord } from '../special_location.js';
import { game } from '../gstate.js';
import { isRoom } from '../map_types.js';
import type { Coordinate, SelectionBounds } from '../selvar.js';
import type { LuaHostObject, LuaMetatable, LuaValue } from './runtime.js';

export interface SelectionContext {
    xstart: number;
    ystart: number;
    width: number;
    height: number;
    _room?: Parameters<typeof selection_from_mkroom>[0] | null;
}

type ContextSource = SelectionContext | (() => SelectionContext | null);
type InvokeSelection = ((callback: LuaValue, arguments_: LuaValue[]) => Promise<boolean>) | null;

function coordxy(value: number): number {
    return (value << 16) >> 16;
}

function luaCoordinate(value: LuaValue | undefined): number {
    return coordxy(luaInteger(value));
}

function luaInt(value: LuaValue | undefined): number {
    return luaInteger(value) | 0;
}

// The two-axis get form uses lua_tointeger, which returns zero on failure.
function getAxis(value: LuaValue | undefined): number {
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
    return Number.isInteger(number) ? coordxy(number) : 0;
}

function argumentType(value: LuaValue | undefined): string {
    if (value === undefined) return 'no value';
    if (value instanceof LuaUserdata) return value.metatable.__name ?? 'userdata';
    return luaType(value);
}

function integerArgument(value: LuaValue | undefined, argument: number): number {
    try {
        return luaInteger(value);
    } catch (cause) {
        const numeric = typeof value === 'number'
            || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)));
        const message = numeric ? 'number has no integer representation'
            : `number expected, got ${argumentType(value)}`;
        throw new LuaArgumentError(argument, message, { cause });
    }
}

function selectionValue(value: LuaValue | undefined, argument = 1): SpecialSelection {
    if (!(value instanceof LuaUserdata))
        throw new LuaArgumentError(argument, `userdata expected, got ${argumentType(value)}`);
    if (!(value.value instanceof SpecialSelection))
        throw new LuaArgumentError(argument, `selection expected, got ${argumentType(value)}`);
    return value.value;
}

function copySelectionInto(target: SpecialSelection, source: SpecialSelection): void {
    const copy = source.clone().selection;
    target.selection.wid = copy.wid;
    target.selection.hei = copy.hei;
    target.selection.bounds_dirty = copy.bounds_dirty;
    target.selection.bounds = copy.bounds;
    target.selection.map = copy.map;
}

function pointTable(point: Coordinate | null): LuaTable | null {
    if (!point) return null;
    const table = new LuaTable();
    table.set('x', point.x);
    table.set('y', point.y);
    return table;
}

function boundsTable(bounds: SelectionBounds): LuaTable {
    const table = new LuaTable();
    for (const field of ['lx', 'ly', 'hx', 'hy'] as const)
        table.set(field, bounds[field]);
    return table;
}

export function createSelectionApi(context: ContextSource, invoke: InvokeSelection = null) {
    const wrap = (selection: SpecialSelection) => new LuaUserdata(selection, metatable);
    const origin = () => {
        const active = currentContext();
        return {
            x: active._room?.lx ?? active.xstart,
            y: active._room?.ly ?? active.ystart,
        };
    };
    const relativePoint = (point: Coordinate | null): Coordinate | null => {
        if (!point) return null;
        const start = origin();
        return {
            x: point.x - start.x,
            y: point.y - start.y,
        };
    };
    const set = async (...args: LuaValue[]) => {
        if (args.length === 0) throw new NethackLuaError('Selection setpoint error');
        const self = args.length === 2 ? undefined : args.shift();
        const selection = self === undefined ? new SpecialSelection() : selectionValue(self);
        const coordinate = args.length === 0 ? null
            : { x: luaCoordinate(args[0]), y: luaCoordinate(args[1]) };
        const value = luaInt(args[2] ?? 1);
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        selection_setpoint(point.x, point.y, selection.selection, value);
        return self ?? wrap(selection);
    };
    const get = async (self: LuaValue, ...args: LuaValue[]) => {
        const selection = selectionValue(self);
        let coordinate: Coordinate;
        const table = args[0];
        if (args.length === 1 && table instanceof LuaTable) {
            if (table.get('x') != null) {
                if (table.get('y') == null) throw new NethackLuaError('Not a coordinate');
                coordinate = { x: luaCoordinate(table.get('x')), y: luaCoordinate(table.get('y')) };
            } else {
                if (table.length() !== 2) throw new NethackLuaError('Not a coordinate');
                coordinate = { x: luaCoordinate(table.get(1)), y: luaCoordinate(table.get(2)) };
            }
        } else if (args.length === 2) {
            coordinate = { x: getAxis(args[0]), y: getAxis(args[1]) };
        } else {
            throw new NethackLuaError('l_selection_getpoint: Incorrect params');
        }
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        return selection_getpoint(point.x, point.y, selection.selection);
    };
    const clone = (...args: LuaValue[]) => {
        const source = selectionValue(args[0]);
        if (args.length === 1) return wrap(source.clone());
        // Native copies into stack slot two and returns the new empty selection on top.
        copySelectionInto(selectionValue(args[1], 2), source);
        return wrap(new SpecialSelection());
    };
    const numpoints = (self: LuaValue) => selectionValue(self).numPoints();
    const negate = (...args: LuaValue[]) => {
        if (args.length === 0) return wrap(new SpecialSelection().negate());
        const result = clone(...args);
        const target = args.length === 1 ? result.value : selectionValue(args[1]);
        selection_not(target.selection);
        return result;
    };
    const percentage = (self: LuaValue, percent: LuaValue) => wrap(
        selectionValue(self).percentage(luaInt(percent)),
    );
    const filterMapchar = (self: LuaValue, character: LuaValue, lit: LuaValue = -2) => wrap(
        selectionValue(self).filterMapCharacter(luaString(character), luaInt(lit ?? -2)),
    );
    const grow = (self: LuaValue, direction: LuaValue = 'all', ...extra: LuaValue[]) => {
        const selection = selectionValue(self);
        const name = luaString(direction ?? 'all');
        if (!['all', 'random', 'north', 'south', 'east', 'west'].includes(name))
            throw new TypeError(`Unknown selection growth direction: ${name}`);
        // With extra arguments native leaves the direction in clone's second slot.
        if (extra.length) selectionValue(direction, 2);
        return wrap(selection.grow(name));
    };
    const rndcoord = (self: LuaValue, remove: LuaValue = 0) => pointTable(
        relativePoint(selectionValue(self).randomCoordinate(!!luaInt(remove ?? 0)))
            ?? { x: -1, y: -1 },
    );
    const bounds = (self: LuaValue) => boundsTable(selectionValue(self).bounds());
    const explicitPoint = (x: LuaValue | undefined, y: LuaValue | undefined) => {
        const start = origin();
        return {
            x: start.x + (luaInteger(x) & 0xff),
            y: start.y + (luaInteger(y) & 0xff),
        };
    };
    const pointArguments = (args: LuaValue[], first: number) => explicitPoint(
        integerArgument(args[first - 1], first), integerArgument(args[first], first + 1),
    );
    const geometry = (shape: 'line' | 'rect' | 'area', args: LuaValue[]) => {
        if (args.length !== 4 && args.length !== 5)
            throw new NethackLuaError(`selection.${shape === 'area' ? 'fillrect' : shape}: illegal arguments`);
        const source = args.length === 5 ? selectionValue(args[0]) : null;
        const first = source ? 2 : 1;
        const start = pointArguments(args, first), end = pointArguments(args, first + 2);
        const result = source ? source.clone() : new SpecialSelection();
        if (shape === 'area') {
            for (let y = start.y; y <= end.y; y++)
                selection_do_line(start.x, y, end.x, y, result.selection);
        } else {
            selection_do_line(start.x, start.y, end.x, shape === 'line' ? end.y : start.y, result.selection);
            if (shape === 'rect') {
                selection_do_line(start.x, start.y, start.x, end.y, result.selection);
                selection_do_line(end.x, start.y, end.x, end.y, result.selection);
                selection_do_line(start.x, end.y, end.x, end.y, result.selection);
            }
        }
        return wrap(result);
    };
    const ellipse = (circular: boolean, args: LuaValue[]) => {
        const required = circular ? 3 : 4;
        const coordinatesOnly = args.length === required
            || (args.length === required + 1 && typeof args[0] === 'number');
        if (!coordinatesOnly && args.length !== required + 1 && args.length !== required + 2)
            throw new NethackLuaError('wrong parameters');
        const result = coordinatesOnly ? new SpecialSelection() : selectionValue(args[0]);
        const first = coordinatesOnly ? 1 : 2;
        const point = pointArguments(args, first);
        const radiusX = integerArgument(args[first + 1], first + 2) | 0;
        const radiusY = circular ? radiusX : integerArgument(args[first + 2], first + 3) | 0;
        const filledIndex = first + required;
        const filledValue = args[filledIndex - 1];
        const filled = circular && coordinatesOnly && args.length === 4
            ? integerArgument(filledValue, filledIndex) | 0
            : integerArgument(filledValue ?? 0, filledIndex) | 0;
        selection_do_ellipse(result.selection, point.x, point.y, radiusX, radiusY, !filled);
        return coordinatesOnly ? wrap(result) : args[0];
    };
    const gradient = async (options: LuaValue, ...extra: LuaValue[]) => {
        if (!(options instanceof LuaTable) || extra.length)
            throw new NethackLuaError('selection.gradient requires table argument');
        const type = luaString(options.get('type') ?? 'radial');
        if (type !== 'radial' && type !== 'square')
            throw new TypeError(`Unknown gradient type: ${type}`);
        const start = origin();
        const x = coordxy(start.x + luaCoordinate(options.get('x')));
        const y = coordxy(start.y + luaCoordinate(options.get('y')));
        const x2 = coordxy(start.x + luaCoordinate(options.get('x2') ?? -1));
        const y2 = coordxy(start.y + luaCoordinate(options.get('y2') ?? -1));
        const pointCenter = x2 === -1 && y2 === -1;
        const result = new SpecialSelection();
        await selection_do_gradient(result.selection, x, y,
            pointCenter ? x : x2, pointCenter ? y : y2,
            type === 'radial' ? SEL_GRADIENT_RADIAL : SEL_GRADIENT_SQUARE,
            luaCoordinate(options.get('mindist') ?? 0), luaCoordinate(options.get('maxdist')));
        return wrap(result);
    };
    const randline = (...args: LuaValue[]) => {
        let start = explicitPoint(0, 0), end = explicitPoint(0, 0);
        let roughness = 7;
        if (args.length === 6) {
            selectionValue(args[0]);
            start = pointArguments(args, 2);
            end = pointArguments(args, 4);
            roughness = integerArgument(args[5], 6) | 0;
            args.splice(1);
        } else if (args.length === 5 && typeof args[0] === 'number') {
            start = pointArguments(args, 1);
            end = pointArguments(args, 3);
            roughness = integerArgument(args[4], 5) | 0;
            args = [wrap(new SpecialSelection())];
        }
        const result = clone(...args);
        const target = args.length === 1 ? result.value : selectionValue(args[1], 2);
        specialSelectionRandLine(start.x, start.y, end.x, end.y, roughness, 12, target);
        return result;
    };
    const iterate = async (self: LuaValue, ...args: LuaValue[]) => {
        const callback = args[0];
        if (args.length !== 1 || callback === undefined || luaType(callback) !== 'function')
            throw new NethackLuaError('wrong parameters');
        if (!invoke)
            throw new Error('selection.iterate needs a Lua state');
        const selection = selectionValue(self);
        const bounds = selection.bounds();
        for (let y = bounds.ly; y <= bounds.hy; y++) {
            for (let x = Math.max(1, bounds.lx); x <= bounds.hx; x++) {
                if (!selection.has(x, y)) continue;
                const start = origin();
                if (!await invoke(callback, [x - start.x, y - start.y])) return;
            }
        }
    };
    const methods: LuaHostObject = {
        new: () => wrap(new SpecialSelection()),
        set,
        get,
        clone,
        numpoints,
        negate,
        percentage,
        filter_mapchar: filterMapchar,
        grow,
        rndcoord,
        bounds,
        line: (...args: LuaValue[]) => geometry('line', args),
        rect: (...args: LuaValue[]) => geometry('rect', args),
        fillrect: (...args: LuaValue[]) => geometry('area', args),
        area: (...args: LuaValue[]) => geometry('area', args),
        circle: (...args: LuaValue[]) => ellipse(true, args),
        ellipse: (...args: LuaValue[]) => ellipse(false, args),
        gradient,
        randline,
        iterate,
        describe_size: (...args) => {
            if (args.length !== 1) throw new NethackLuaError('wrong parameters');
            return selection_size_description(selectionValue(args[0]).selection);
        },
        floodfill: (...args) => {
            if (args.length !== 2 && args.length !== 3) throw new NethackLuaError('wrong parameters');
            return wrap(specialSelectionFloodFill(currentContext(),
                luaInteger(args[0]), luaInteger(args[1]), luaTruthy(args[2])));
        },
        match: (...args) => {
            if (args.length !== 1) throw new NethackLuaError('wrong parameters');
            return wrap(specialSelectionMatch(luaString(args[0])));
        },
        room: (...args) => {
            // nhlsel.c uses room i only while 0 <= i < nroom; slots past
            // nroom (placeholders or stale rooms) fall back to the coder room.
            const index = args.length === 1 ? luaInt(args[0]) : -1;
            const candidate = index >= 0 && index < (game.level?.nroom ?? 0)
                ? game.level?.rooms[index] : undefined;
            return wrap(new SpecialSelection(selection_from_mkroom(
                isRoom(candidate) ? candidate : currentContext()._room,
            )));
        },
    };
    const metatable: LuaMetatable = {
        __name: 'selection',
        __index: methods,
        __bor: (left, right) => wrap(
            selectionValue(left).union(selectionValue(right, 2)),
        ),
        __band: (left, right) => wrap(
            selectionValue(left).intersect(selectionValue(right, 2)),
        ),
        __bxor: (left, right) => wrap(
            selectionValue(left).xor(selectionValue(right, 2)),
        ),
        __bnot: value => wrap(selectionValue(value).negate()),
        __unm: value => wrap(selectionValue(value).negate()),
        __add: (left, right) => wrap(
            selectionValue(left).union(selectionValue(right, 2)),
        ),
        __sub: (left, right) => wrap(
            selectionValue(left).subtract(selectionValue(right, 2)),
        ),
    };
    const currentContext = () => {
        const value = typeof context === 'function' ? context() : context;
        if (!value) throw new Error('selection needs an active level context');
        return value;
    };

    return { bindings: methods, wrap };
}

export function createSelectionBindings(context: ContextSource, invoke: InvokeSelection = null) {
    return createSelectionApi(context, invoke).bindings;
}

export function unwrapSelection(value: LuaValue | undefined) {
    return selectionValue(value);
}
