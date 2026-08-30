import {
    SpecialSelection,
    specialSelectionFillRect,
    specialSelectionLine,
    specialSelectionMatch,
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

export function createSelectionBindings(context, invoke = null) {
    const wrap = selection => new LuaUserdata(selection, metatable);
    const metatable = {
        __index: {
            clone: self => wrap(selectionValue(self).clone()),
            numpoints: self => selectionValue(self).numPoints(),
            percentage: (self, percent) => wrap(
                selectionValue(self).percentage(percent),
            ),
            grow: (self, direction = 'all') => wrap(
                selectionValue(self).grow(direction),
            ),
            rndcoord: (self, remove = false) => pointTable(
                selectionValue(self).randomCoordinate(remove),
            ),
            iterate: async (self, callback) => {
                if (!invoke)
                    throw new Error('selection.iterate needs a Lua state');
                const points = [];
                selectionValue(self).forEachLua((x, y) => points.push([x, y]));
                for (const point of points) await invoke(callback, point);
            },
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

    return {
        new: () => wrap(new SpecialSelection()),
        clone: value => wrap(selectionValue(value).clone()),
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
}

export function unwrapSelection(value) {
    return selectionValue(value);
}
