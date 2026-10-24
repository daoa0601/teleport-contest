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
    selection_size_description,
    SEL_GRADIENT_RADIAL,
    SEL_GRADIENT_SQUARE,
} from '../selvar.js';
import { LuaTable, LuaUserdata, luaType } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
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

function selectionValue(value: LuaValue | undefined): SpecialSelection {
    if (!(value instanceof LuaUserdata)
        || !(value.value instanceof SpecialSelection))
        throw new TypeError('selection operation requires a selection');
    return value.value;
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
        if (args.length === 0) throw new TypeError('Selection setpoint error');
        const self = args.length === 2 ? undefined : args.shift();
        const selection = self === undefined ? new SpecialSelection() : selectionValue(self);
        const coordinate = args.length === 0 ? null
            : { x: luaCoordinate(args[0]), y: luaCoordinate(args[1]) };
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        selection_setpoint(point.x, point.y, selection.selection, luaInt(args[2] ?? 1));
        return self ?? wrap(selection);
    };
    const get = async (self: LuaValue, ...args: LuaValue[]) => {
        let coordinate: Coordinate;
        const table = args[0];
        if (args.length === 1 && table instanceof LuaTable) {
            if (table.get('x') != null) {
                if (table.get('y') == null) throw new TypeError('Not a coordinate');
                coordinate = { x: luaCoordinate(table.get('x')), y: luaCoordinate(table.get('y')) };
            } else {
                if (table.length() !== 2) throw new TypeError('Not a coordinate');
                coordinate = { x: luaCoordinate(table.get(1)), y: luaCoordinate(table.get(2)) };
            }
        } else if (args.length === 2) {
            coordinate = { x: getAxis(args[0]), y: getAxis(args[1]) };
        } else {
            throw new TypeError('l_selection_getpoint: Incorrect params');
        }
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        return selection_getpoint(point.x, point.y, selectionValue(self).selection);
    };
    const clone = (self: LuaValue, ...extra: LuaValue[]) => {
        if (extra.length) throw new TypeError('wrong parameters');
        return wrap(selectionValue(self).clone());
    };
    const numpoints = (self: LuaValue) => selectionValue(self).numPoints();
    const negate = (...args: LuaValue[]) => {
        if (args.length === 0) return wrap(new SpecialSelection().negate());
        if (args.length !== 1) throw new TypeError('wrong parameters');
        return wrap(selectionValue(args[0]).negate());
    };
    const percentage = (self: LuaValue, percent: LuaValue) => wrap(
        selectionValue(self).percentage(luaInt(percent)),
    );
    const filterMapchar = (self: LuaValue, character: LuaValue, lit: LuaValue = -2) => wrap(
        selectionValue(self).filterMapCharacter(luaString(character), luaInt(lit ?? -2)),
    );
    const grow = (self: LuaValue, direction: LuaValue = 'all', ...extra: LuaValue[]) => {
        if (extra.length) throw new TypeError('wrong parameters');
        const name = luaString(direction ?? 'all');
        if (!['all', 'random', 'north', 'south', 'east', 'west'].includes(name))
            throw new TypeError(`Unknown selection growth direction: ${name}`);
        return wrap(selectionValue(self).grow(name));
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
    const geometry = (shape: 'line' | 'rect' | 'area', args: LuaValue[]) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        if (args.length !== 4)
            throw new TypeError(`selection.${shape === 'area' ? 'fillrect' : shape}: illegal arguments`);
        const result = self ? selectionValue(self).clone() : new SpecialSelection();
        const start = explicitPoint(args[0], args[1]), end = explicitPoint(args[2], args[3]);
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
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        const required = circular ? 3 : 4;
        if (args.length !== required && args.length !== required + 1)
            throw new TypeError('wrong parameters');
        const result = self ? selectionValue(self) : new SpecialSelection();
        const x = luaInteger(args[0]), y = luaInteger(args[1]);
        const radiusX = luaInt(args[2]);
        const radiusY = circular ? radiusX : luaInt(args[3]);
        const filled = luaInt(args[circular ? 3 : 4] ?? 0);
        const point = explicitPoint(x, y);
        selection_do_ellipse(result.selection, point.x, point.y, radiusX, radiusY, !filled);
        return self ?? wrap(result);
    };
    const gradient = async (options: LuaValue, ...extra: LuaValue[]) => {
        if (!(options instanceof LuaTable) || extra.length)
            throw new TypeError('selection.gradient requires table argument');
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
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        if (args.length !== 5) throw new TypeError('wrong parameters');
        const result = self ? selectionValue(self).clone() : new SpecialSelection();
        const start = explicitPoint(args[0], args[1]), end = explicitPoint(args[2], args[3]);
        return wrap(specialSelectionRandLine(
            start.x, start.y, end.x, end.y,
            luaInt(args[4]),
            12,
            result,
        ));
    };
    const iterate = async (self: LuaValue, ...args: LuaValue[]) => {
        const callback = args[0];
        if (args.length !== 1 || callback === undefined || luaType(callback) !== 'function')
            throw new TypeError('wrong parameters');
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
            if (args.length !== 1) throw new TypeError('wrong parameters');
            return selection_size_description(selectionValue(args[0]).selection);
        },
        floodfill: (...args) => {
            if (args.length !== 2 && args.length !== 3) throw new TypeError('wrong parameters');
            return wrap(specialSelectionFloodFill(currentContext(),
                luaInteger(args[0]), luaInteger(args[1]), luaTruthy(args[2])));
        },
        match: (...args) => {
            if (args.length !== 1) throw new TypeError('wrong parameters');
            return wrap(specialSelectionMatch(luaString(args[0])));
        },
        room: (...args) => {
            const candidate = args.length === 1
                ? game.level?.rooms[luaInt(args[0])] : undefined;
            return wrap(new SpecialSelection(selection_from_mkroom(
                isRoom(candidate) ? candidate : currentContext()._room,
            )));
        },
    };
    const metatable: LuaMetatable = {
        __index: methods,
        __bor: (left, right) => wrap(
            selectionValue(left).union(selectionValue(right)),
        ),
        __band: (left, right) => wrap(
            selectionValue(left).intersect(selectionValue(right)),
        ),
        __bxor: (left, right) => wrap(
            selectionValue(left).xor(selectionValue(right)),
        ),
        __bnot: value => wrap(selectionValue(value).negate()),
        __unm: value => wrap(selectionValue(value).negate()),
        __add: (left, right) => wrap(
            selectionValue(left).union(selectionValue(right)),
        ),
        __sub: (left, right) => wrap(
            selectionValue(left).subtract(selectionValue(right)),
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
