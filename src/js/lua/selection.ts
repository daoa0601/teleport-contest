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
    SEL_GRADIENT_RADIAL,
    SEL_GRADIENT_SQUARE,
} from '../selvar.js';
import { LuaTable, LuaUserdata } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
import { ANY_LOC, getLocationCoord } from '../special_location.js';
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
type InvokeSelection = ((callback: LuaValue, arguments_: LuaValue[]) => Promise<unknown>) | null;


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
    const relativePoint = (point: Coordinate | null): Coordinate | null => {
        if (!point) return null;
        const active = currentContext();
        return {
            x: point.x - active.xstart,
            y: point.y - active.ystart,
        };
    };
    const set = async (...args: LuaValue[]) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        const selection = self ? selectionValue(self) : new SpecialSelection();
        const coordinate = args.length === 0 ? null
            : { x: luaInteger(args[0]), y: luaInteger(args[1]) };
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        selection_setpoint(point.x, point.y, selection.selection, luaInteger(args[2] ?? 1));
        return self ?? wrap(selection);
    };
    const get = async (self: LuaValue, x: LuaValue, y: LuaValue = null) => {
        const coordinate = x instanceof LuaTable
            ? { x: luaInteger(x.get('x') ?? x.get(1)), y: luaInteger(x.get('y') ?? x.get(2)) }
            : { x: luaInteger(x), y: luaInteger(y) };
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        return selection_getpoint(point.x, point.y, selectionValue(self).selection);
    };
    const clone = (self: LuaValue) => wrap(selectionValue(self).clone());
    const numpoints = (self: LuaValue) => selectionValue(self).numPoints();
    const negate = (self: LuaValue) => wrap(self == null
        ? new SpecialSelection().negate()
        : selectionValue(self).negate());
    const percentage = (self: LuaValue, percent: LuaValue) => wrap(
        selectionValue(self).percentage(luaInteger(percent)),
    );
    const filterMapchar = (self: LuaValue, character: LuaValue, lit: LuaValue = -2) => wrap(
        selectionValue(self).filterMapCharacter(luaString(character), luaInteger(lit ?? -2)),
    );
    const grow = (self: LuaValue, direction: LuaValue = 'all') => {
        const name = luaString(direction ?? 'all');
        if (!['all', 'random', 'north', 'south', 'east', 'west'].includes(name))
            throw new TypeError(`Unknown selection growth direction: ${name}`);
        return wrap(selectionValue(self).grow(name));
    };
    const rndcoord = (self: LuaValue, remove: LuaValue = 0) => pointTable(
        relativePoint(selectionValue(self).randomCoordinate(!!luaInteger(remove ?? 0)))
            ?? { x: -1, y: -1 },
    );
    const bounds = (self: LuaValue) => boundsTable(selectionValue(self).bounds());
    const explicitPoint = (x: LuaValue | undefined, y: LuaValue | undefined) => {
        const active = currentContext();
        return {
            x: active.xstart + (luaInteger(x) & 0xff),
            y: active.ystart + (luaInteger(y) & 0xff),
        };
    };
    const geometry = (shape: 'line' | 'rect' | 'area', args: LuaValue[]) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
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
        const result = self ? selectionValue(self) : new SpecialSelection();
        const x = luaInteger(args[0]), y = luaInteger(args[1]);
        const radiusX = luaInteger(args[2]);
        const radiusY = circular ? radiusX : luaInteger(args[3]);
        const filled = luaInteger(args[circular ? 3 : 4] ?? 0);
        const point = explicitPoint(x, y);
        selection_do_ellipse(result.selection, point.x, point.y, radiusX, radiusY, !filled);
        return self ?? wrap(result);
    };
    const gradient = (options: LuaValue) => {
        if (!(options instanceof LuaTable))
            throw new TypeError('selection.gradient requires a table');
        const type = luaString(options.get('type') ?? 'radial');
        if (type !== 'radial' && type !== 'square')
            throw new TypeError(`Unknown gradient type: ${type}`);
        const active = currentContext();
        const x = active.xstart + luaInteger(options.get('x'));
        const y = active.ystart + luaInteger(options.get('y'));
        const x2 = active.xstart + luaInteger(options.get('x2') ?? -1);
        const y2 = active.ystart + luaInteger(options.get('y2') ?? -1);
        const pointCenter = x2 === -1 && y2 === -1;
        const result = new SpecialSelection();
        selection_do_gradient(result.selection, x, y,
            pointCenter ? x : x2, pointCenter ? y : y2,
            type === 'radial' ? SEL_GRADIENT_RADIAL : SEL_GRADIENT_SQUARE,
            luaInteger(options.get('mindist') ?? 0), luaInteger(options.get('maxdist')));
        return wrap(result);
    };
    const randline = (...args: LuaValue[]) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        const result = self ? selectionValue(self).clone() : new SpecialSelection();
        const start = explicitPoint(args[0], args[1]), end = explicitPoint(args[2], args[3]);
        return wrap(specialSelectionRandLine(
            start.x, start.y, end.x, end.y,
            luaInteger(args[4] ?? 7),
            12,
            result,
        ));
    };
    const iterate = async (self: LuaValue, callback: LuaValue) => {
        if (!invoke)
            throw new Error('selection.iterate needs a Lua state');
        const points: [number, number][] = [];
        const active = currentContext();
        selectionValue(self).forEachLua((x: number, y: number) => points.push([
            x - active.xstart,
            y - active.ystart,
        ]));
        for (const point of points) await invoke(callback, point);
    };
    const methods = {
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
    };
    const metatable: LuaMetatable = {
        __index: {
            ...methods,
        },
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

    const bindings: LuaHostObject = {
        new: () => wrap(new SpecialSelection()),
        ...methods,
        floodfill: (x, y, diagonals = false) => wrap(
            specialSelectionFloodFill(currentContext(), luaInteger(x), luaInteger(y), luaTruthy(diagonals)),
        ),
        match: fragment => wrap(specialSelectionMatch(luaString(fragment))),
        room: () => wrap(new SpecialSelection(
            selection_from_mkroom(currentContext()._room),
        )),
    };
    return { bindings, wrap };
}

export function createSelectionBindings(context: ContextSource, invoke: InvokeSelection = null) {
    return createSelectionApi(context, invoke).bindings;
}

export function unwrapSelection(value: LuaValue | undefined) {
    return selectionValue(value);
}
