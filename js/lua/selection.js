import { SpecialSelection, specialSelectionFillRect, specialSelectionFloodFill, specialSelectionLine, specialSelectionMatch, specialSelectionRandLine, specialSelectionRect, selection_from_mkroom, selection_do_ellipse, } from '../selvar.js';
import { LuaTable, LuaUserdata } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
import { ANY_LOC, getLocationCoord } from '../special_location.js';
function selectionValue(value) {
    if (!(value instanceof LuaUserdata)
        || !(value.value instanceof SpecialSelection))
        throw new TypeError('selection operation requires a selection');
    return value.value;
}
function pointTable(point) {
    if (!point)
        return null;
    const table = new LuaTable();
    table.set('x', point.x);
    table.set('y', point.y);
    return table;
}
function boundsTable(bounds) {
    const table = new LuaTable();
    for (const field of ['lx', 'ly', 'hx', 'hy'])
        table.set(field, bounds[field]);
    return table;
}
export function createSelectionApi(context, invoke = null) {
    const wrap = (selection) => new LuaUserdata(selection, metatable);
    const relativePoint = (point) => {
        if (!point)
            return null;
        const active = currentContext();
        return {
            x: point.x - active.xstart,
            y: point.y - active.ystart,
        };
    };
    const set = async (self, x = null, y = null, value = 1) => {
        const selection = selectionValue(self);
        const coordinate = x === null && y === null ? null
            : { x: luaInteger(x), y: luaInteger(y) };
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        if (luaInteger(value ?? 1))
            selection.add(point.x, point.y);
        else
            selection.remove(point.x, point.y);
        return self;
    };
    const clone = (self) => wrap(selectionValue(self).clone());
    const numpoints = (self) => selectionValue(self).numPoints();
    const negate = (self) => wrap(self == null
        ? new SpecialSelection().negate()
        : selectionValue(self).negate());
    const percentage = (self, percent) => wrap(selectionValue(self).percentage(luaInteger(percent)));
    const filterMapchar = (self, character, lit = -2) => wrap(selectionValue(self).filterMapCharacter(luaString(character), luaInteger(lit ?? -2)));
    const grow = (self, direction = 'all') => {
        const name = luaString(direction ?? 'all');
        if (!['all', 'random', 'north', 'south', 'east', 'west'].includes(name))
            throw new TypeError(`Unknown selection growth direction: ${name}`);
        return wrap(selectionValue(self).grow(name));
    };
    const rndcoord = (self, remove = 0) => pointTable(relativePoint(selectionValue(self).randomCoordinate(!!luaInteger(remove ?? 0))));
    const bounds = (self) => boundsTable(selectionValue(self).bounds());
    const ellipse = async (circular, args) => {
        const hasSelection = args[0] instanceof LuaUserdata;
        const result = hasSelection ? selectionValue(args.shift()) : new SpecialSelection();
        const x = luaInteger(args[0]), y = luaInteger(args[1]);
        const radiusX = luaInteger(args[2]);
        const radiusY = circular ? radiusX : luaInteger(args[3]);
        const filled = luaInteger(args[circular ? 3 : 4] ?? 0);
        const point = await getLocationCoord(currentContext(), { x, y }, ANY_LOC);
        selection_do_ellipse(result.selection, point.x, point.y, radiusX, radiusY, !filled);
        return wrap(result);
    };
    const randline = (self, x1, y1, x2, y2, roughness = 7) => {
        const active = currentContext();
        const result = selectionValue(self).clone();
        return wrap(specialSelectionRandLine(active.xstart + luaInteger(x1), active.ystart + luaInteger(y1), active.xstart + luaInteger(x2), active.ystart + luaInteger(y2), luaInteger(roughness), 12, result));
    };
    const iterate = async (self, callback) => {
        if (!invoke)
            throw new Error('selection.iterate needs a Lua state');
        const points = [];
        const active = currentContext();
        selectionValue(self).forEachLua((x, y) => points.push([
            x - active.xstart,
            y - active.ystart,
        ]));
        for (const point of points)
            await invoke(callback, point);
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
        circle: (...args) => ellipse(true, args),
        ellipse: (...args) => ellipse(false, args),
        randline,
        iterate,
    };
    const metatable = {
        __index: {
            ...methods,
        },
        __bor: (left, right) => wrap(selectionValue(left).union(selectionValue(right))),
        __band: (left, right) => wrap(selectionValue(left).intersect(selectionValue(right))),
        __bxor: (left, right) => wrap(selectionValue(left).xor(selectionValue(right))),
        __bnot: value => wrap(selectionValue(value).negate()),
        __unm: value => wrap(selectionValue(value).negate()),
        __add: (left, right) => wrap(selectionValue(left).union(selectionValue(right))),
        __sub: (left, right) => wrap(selectionValue(left).subtract(selectionValue(right))),
    };
    const currentContext = () => {
        const value = typeof context === 'function' ? context() : context;
        if (!value)
            throw new Error('selection needs an active level context');
        return value;
    };
    const bindings = {
        new: () => wrap(new SpecialSelection()),
        ...methods,
        line: (x1, y1, x2, y2) => wrap(specialSelectionLine(currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2))),
        rect: (x1, y1, x2, y2) => wrap(specialSelectionRect(currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2))),
        fillrect: (x1, y1, x2, y2) => wrap(specialSelectionFillRect(currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2))),
        area: (x1, y1, x2, y2) => wrap(specialSelectionFillRect(currentContext(), luaInteger(x1), luaInteger(y1), luaInteger(x2), luaInteger(y2))),
        floodfill: (x, y, diagonals = false) => wrap(specialSelectionFloodFill(currentContext(), luaInteger(x), luaInteger(y), luaTruthy(diagonals))),
        match: fragment => wrap(specialSelectionMatch(luaString(fragment))),
        room: () => wrap(new SpecialSelection(selection_from_mkroom(currentContext()._room))),
    };
    return { bindings, wrap };
}
export function createSelectionBindings(context, invoke = null) {
    return createSelectionApi(context, invoke).bindings;
}
export function unwrapSelection(value) {
    return selectionValue(value);
}
//# sourceMappingURL=selection.js.map