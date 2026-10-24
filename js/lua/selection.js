import { SpecialSelection, specialSelectionFloodFill, specialSelectionMatch, specialSelectionRandLine, selection_from_mkroom, selection_do_ellipse, selection_do_line, selection_do_gradient, selection_getpoint, selection_setpoint, selection_size_description, SEL_GRADIENT_RADIAL, SEL_GRADIENT_SQUARE, } from '../selvar.js';
import { LuaTable, LuaUserdata } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
import { ANY_LOC, getLocationCoord } from '../special_location.js';
import { game } from '../gstate.js';
import { isRoom } from '../map_types.js';
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
    const origin = () => {
        const active = currentContext();
        return {
            x: active._room?.lx ?? active.xstart,
            y: active._room?.ly ?? active.ystart,
        };
    };
    const relativePoint = (point) => {
        if (!point)
            return null;
        const start = origin();
        return {
            x: point.x - start.x,
            y: point.y - start.y,
        };
    };
    const set = async (...args) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        const selection = self ? selectionValue(self) : new SpecialSelection();
        const coordinate = args.length === 0 ? null
            : { x: luaInteger(args[0]), y: luaInteger(args[1]) };
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        selection_setpoint(point.x, point.y, selection.selection, luaInteger(args[2] ?? 1));
        return self ?? wrap(selection);
    };
    const get = async (self, x, y = null) => {
        const coordinate = x instanceof LuaTable
            ? { x: luaInteger(x.get('x') ?? x.get(1)), y: luaInteger(x.get('y') ?? x.get(2)) }
            : { x: luaInteger(x), y: luaInteger(y) };
        const point = await getLocationCoord(currentContext(), coordinate, ANY_LOC);
        return selection_getpoint(point.x, point.y, selectionValue(self).selection);
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
    const rndcoord = (self, remove = 0) => pointTable(relativePoint(selectionValue(self).randomCoordinate(!!luaInteger(remove ?? 0)))
        ?? { x: -1, y: -1 });
    const bounds = (self) => boundsTable(selectionValue(self).bounds());
    const explicitPoint = (x, y) => {
        const start = origin();
        return {
            x: start.x + (luaInteger(x) & 0xff),
            y: start.y + (luaInteger(y) & 0xff),
        };
    };
    const geometry = (shape, args) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        const result = self ? selectionValue(self).clone() : new SpecialSelection();
        const start = explicitPoint(args[0], args[1]), end = explicitPoint(args[2], args[3]);
        if (shape === 'area') {
            for (let y = start.y; y <= end.y; y++)
                selection_do_line(start.x, y, end.x, y, result.selection);
        }
        else {
            selection_do_line(start.x, start.y, end.x, shape === 'line' ? end.y : start.y, result.selection);
            if (shape === 'rect') {
                selection_do_line(start.x, start.y, start.x, end.y, result.selection);
                selection_do_line(end.x, start.y, end.x, end.y, result.selection);
                selection_do_line(start.x, end.y, end.x, end.y, result.selection);
            }
        }
        return wrap(result);
    };
    const ellipse = (circular, args) => {
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
    const gradient = (options) => {
        if (!(options instanceof LuaTable))
            throw new TypeError('selection.gradient requires a table');
        const type = luaString(options.get('type') ?? 'radial');
        if (type !== 'radial' && type !== 'square')
            throw new TypeError(`Unknown gradient type: ${type}`);
        const start = origin();
        const x = start.x + luaInteger(options.get('x'));
        const y = start.y + luaInteger(options.get('y'));
        const x2 = start.x + luaInteger(options.get('x2') ?? -1);
        const y2 = start.y + luaInteger(options.get('y2') ?? -1);
        const pointCenter = x2 === -1 && y2 === -1;
        const result = new SpecialSelection();
        selection_do_gradient(result.selection, x, y, pointCenter ? x : x2, pointCenter ? y : y2, type === 'radial' ? SEL_GRADIENT_RADIAL : SEL_GRADIENT_SQUARE, luaInteger(options.get('mindist') ?? 0), luaInteger(options.get('maxdist')));
        return wrap(result);
    };
    const randline = (...args) => {
        const self = args[0] instanceof LuaUserdata ? args.shift() : undefined;
        const result = self ? selectionValue(self).clone() : new SpecialSelection();
        const start = explicitPoint(args[0], args[1]), end = explicitPoint(args[2], args[3]);
        return wrap(specialSelectionRandLine(start.x, start.y, end.x, end.y, luaInteger(args[4] ?? 7), 12, result));
    };
    const iterate = async (self, callback) => {
        if (!invoke)
            throw new Error('selection.iterate needs a Lua state');
        const selection = selectionValue(self);
        const bounds = selection.bounds();
        for (let y = bounds.ly; y <= bounds.hy; y++) {
            for (let x = Math.max(1, bounds.lx); x <= bounds.hx; x++) {
                if (!selection.has(x, y))
                    continue;
                const start = origin();
                await invoke(callback, [x - start.x, y - start.y]);
            }
        }
    };
    const methods = {
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
        line: (...args) => geometry('line', args),
        rect: (...args) => geometry('rect', args),
        fillrect: (...args) => geometry('area', args),
        area: (...args) => geometry('area', args),
        circle: (...args) => ellipse(true, args),
        ellipse: (...args) => ellipse(false, args),
        gradient,
        randline,
        iterate,
        describe_size: self => selection_size_description(selectionValue(self).selection),
        floodfill: (x, y, diagonals = false) => wrap(specialSelectionFloodFill(currentContext(), luaInteger(x), luaInteger(y), luaTruthy(diagonals))),
        match: fragment => wrap(specialSelectionMatch(luaString(fragment))),
        room: (...args) => {
            const candidate = args.length === 1
                ? game.level?.rooms[luaInteger(args[0])] : undefined;
            return wrap(new SpecialSelection(selection_from_mkroom(isRoom(candidate) ? candidate : currentContext()._room)));
        },
    };
    const metatable = {
        __index: methods,
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
    return { bindings: methods, wrap };
}
export function createSelectionBindings(context, invoke = null) {
    return createSelectionApi(context, invoke).bindings;
}
export function unwrapSelection(value) {
    return selectionValue(value);
}
//# sourceMappingURL=selection.js.map