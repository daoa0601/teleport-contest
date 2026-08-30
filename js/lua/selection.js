import {
    SpecialSelection,
    specialSelectionFillRect,
    specialSelectionLine,
    specialSelectionMatch,
    specialSelectionRandLine,
    specialSelectionRandomPoint,
    specialSelectionRect,
} from '../selvar.js';
import { LuaTable, LuaUserdata } from './runtime.js';

function selectionValue(value) {
    if (!(value instanceof LuaUserdata)
        || !(value.value instanceof SpecialSelection))
        throw new TypeError('selection operation requires a selection');
    return value.value;
}

function pointTable(point) {
    if (!point) return null;
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
    const wrap = selection => new LuaUserdata(selection, metatable);
    const relativePoint = point => {
        if (!point) return null;
        const active = currentContext();
        return {
            x: point.x - active.xstart,
            y: point.y - active.ystart,
        };
    };
    const set = (self, x = null, y = null, value = 1) => {
        const selection = selectionValue(self);
        if (Number.isInteger(x) && Number.isInteger(y)) {
            const active = currentContext();
            const absoluteX = active.xstart + x;
            const absoluteY = active.ystart + y;
            if (value) selection.add(absoluteX, absoluteY);
            else selection.remove(absoluteX, absoluteY);
        } else {
            const point = specialSelectionRandomPoint(currentContext())
                .randomCoordinate();
            selection.add(point.x, point.y);
        }
        return self;
    };
    const clone = self => wrap(selectionValue(self).clone());
    const numpoints = self => selectionValue(self).numPoints();
    const negate = self => wrap(selectionValue(self).negate());
    const percentage = (self, percent) => wrap(
        selectionValue(self).percentage(percent),
    );
    const grow = (self, direction = 'all') => wrap(
        selectionValue(self).grow(direction),
    );
    const rndcoord = (self, remove = false) => pointTable(relativePoint(
        selectionValue(self).randomCoordinate(remove),
    ));
    const bounds = self => boundsTable(selectionValue(self).bounds());
    const randline = (self, x1, y1, x2, y2, roughness = 7) => {
        const active = currentContext();
        const result = selectionValue(self).clone();
        return wrap(specialSelectionRandLine(
            active.xstart + x1,
            active.ystart + y1,
            active.xstart + x2,
            active.ystart + y2,
            roughness,
            12,
            result,
        ));
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
        for (const point of points) await invoke(callback, point);
    };
    const methods = {
        set,
        clone,
        numpoints,
        negate,
        percentage,
        grow,
        rndcoord,
        bounds,
        randline,
        iterate,
    };
    const metatable = {
        __index: {
            ...methods,
        },
        __bor: (left, right) => wrap(
            selectionValue(left).union(selectionValue(right)),
        ),
        __band: (left, right) => wrap(
            selectionValue(left).intersect(selectionValue(right)),
        ),
        __bnot: value => wrap(selectionValue(value).negate()),
    };
    const currentContext = () => {
        const value = typeof context === 'function' ? context() : context;
        if (!value) throw new Error('selection needs an active level context');
        return value;
    };

    const bindings = {
        new: () => wrap(new SpecialSelection()),
        ...methods,
        line: (x1, y1, x2, y2) => wrap(specialSelectionLine(
            currentContext(), x1, y1, x2, y2,
        )),
        rect: (x1, y1, x2, y2) => wrap(specialSelectionRect(
            currentContext(), x1, y1, x2, y2,
        )),
        fillrect: (x1, y1, x2, y2) => wrap(specialSelectionFillRect(
            currentContext(), x1, y1, x2, y2,
        )),
        area: (x1, y1, x2, y2) => wrap(specialSelectionFillRect(
            currentContext(), x1, y1, x2, y2,
        )),
        match: fragment => wrap(specialSelectionMatch(String(fragment))),
    };
    return { bindings, wrap };
}

export function createSelectionBindings(context, invoke = null) {
    return createSelectionApi(context, invoke).bindings;
}

export function unwrapSelection(value) {
    return selectionValue(value);
}
