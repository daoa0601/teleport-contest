import {
    SpecialSelection,
    specialSelectionFillRect,
    specialSelectionFloodFill,
    specialSelectionLine,
    specialSelectionMatch,
    specialSelectionRandLine,
    specialSelectionRandomPoint,
    specialSelectionRect,
    selection_from_mkroom,
} from '../selvar.js';
import { LuaTable, LuaUserdata } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
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
    const set = (self: LuaValue, x: LuaValue = null, y: LuaValue = null, value: LuaValue = 1) => {
        const selection = selectionValue(self);
        if (x != null || y != null) {
            const active = currentContext();
            const absoluteX = active.xstart + luaInteger(x);
            const absoluteY = active.ystart + luaInteger(y);
            if (luaInteger(value ?? 1)) selection.add(absoluteX, absoluteY);
            else selection.remove(absoluteX, absoluteY);
        } else {
            const point = specialSelectionRandomPoint(currentContext())
                .randomCoordinate();
            if (!point) throw new Error('Random point selection is empty');
            selection.add(point.x, point.y);
        }
        return self;
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
    const rndcoord = (self: LuaValue, remove: LuaValue = 0) => pointTable(relativePoint(
        selectionValue(self).randomCoordinate(!!luaInteger(remove ?? 0)),
    ));
    const bounds = (self: LuaValue) => boundsTable(selectionValue(self).bounds());
    const randline = (self: LuaValue, x1: LuaValue, y1: LuaValue, x2: LuaValue, y2: LuaValue, roughness: LuaValue = 7) => {
        const active = currentContext();
        const result = selectionValue(self).clone();
        return wrap(specialSelectionRandLine(
            active.xstart + luaInteger(x1),
            active.ystart + luaInteger(y1),
            active.xstart + luaInteger(x2),
            active.ystart + luaInteger(y2),
            luaInteger(roughness),
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
        clone,
        numpoints,
        negate,
        percentage,
        filter_mapchar: filterMapchar,
        grow,
        rndcoord,
        bounds,
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
        line: (x1, y1, x2, y2) => wrap(specialSelectionLine(
            currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2),
        )),
        rect: (x1, y1, x2, y2) => wrap(specialSelectionRect(
            currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2),
        )),
        fillrect: (x1, y1, x2, y2) => wrap(specialSelectionFillRect(
            currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2),
        )),
        area: (x1, y1, x2, y2) => wrap(specialSelectionFillRect(
            currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2),
        )),
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
