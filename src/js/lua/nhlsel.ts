import {
    SpecialSelection,
    selection_from_mkroom,
    selection_do_ellipse,
    selection_do_line,
    selection_do_gradient,
    selection_getpoint,
    selection_setpoint,
    selection_new,
    selection_do_randline,
    selection_recalc_bounds,
    selection_getbounds,
    selection_not,
    selection_size_description,
    SEL_GRADIENT_RADIAL,
    SEL_GRADIENT_SQUARE,
} from '../selvar.js';
import { LuaTable, LuaUserdata, luaType } from './runtime.js';
import { luaInteger, luaString, luaTruthy } from './arguments.js';
import { LuaArgumentError, NethackLuaError } from './errors.js';
import { ANY_LOC, get_location_coord } from '../sp_lev.js';
import { mapCharacterType } from './lifecycle.js';
import { game } from '../gstate.js';
import { isok } from '../cmd.js';
import { match_maptyps, set_floodfillchk_match_under } from '../sp_lev.js';
import { COLNO, INVALID_TYPE, MAP_Y_LIM, MAX_TYPE, ROWNO, STONE } from '../const.js';
import { isRoom } from '../map_types.js';
import type { Coordinate, Selection, SelectionArea, SelectionBounds } from '../selvar.js';
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

// Port only: wrap to C's 16-bit coordxy range.
function coordxy(value: number): number {
    return (value << 16) >> 16;
}

// Part of C nhlsel.c:l_selection_setpoint(), l_selection_rect(): the
// luaL_checkinteger coordinate read.
function luaCoordinate(value: LuaValue | undefined): number {
    return coordxy(luaInteger(value));
}

// Part of C nhlsel.c:l_selection_line(): the integer argument read.
function luaInt(value: LuaValue | undefined): number {
    return luaInteger(value) | 0;
}

// Part of C nhlsel.c:l_selection_getpoint(): lua_tointeger()
// returns zero on failure.
function getAxis(value: LuaValue | undefined): number {
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
    return Number.isInteger(number) ? coordxy(number) : 0;
}

// C lauxlib.c:luaL_typeerror(): the typearg half — the __name metatable
// field, "light userdata", luaL_typename(), and "no value" past the top;
// the "%s expected, got %s" message and the raise are LuaArgumentError's,
// shared with every other check* argument read below.
function argumentType(value: LuaValue | undefined): string {
    if (value === undefined) return 'no value';
    if (value instanceof LuaUserdata) return value.metatable.__name ?? 'userdata';
    return luaType(value);
}

// Part of C lauxlib.c:luaL_checkinteger(): the raising form, with its
// "number has no integer representation" message.
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

// C nhlsel.c:l_selection_check(): the selection userdata, or an error.
function selectionValue(value: LuaValue | undefined, argument = 1): SpecialSelection {
    if (!(value instanceof LuaUserdata))
        throw new LuaArgumentError(argument, `userdata expected, got ${argumentType(value)}`);
    if (!(value.value instanceof SpecialSelection))
        throw new LuaArgumentError(argument, `selection expected, got ${argumentType(value)}`);
    return value.value;
}

// Part of C nhlsel.c:l_selection_clone(): the two-argument form's copy into
// the second slot — C's "*tmp = *sel; tmp->map = dupstr(sel->map)".
// (l_selection_push_copy(), the userdata-creating form its filter callers
// use, has no port site yet; wrap() plays the userdata role at each method.)
function copySelectionInto(target: SpecialSelection, source: SpecialSelection): void {
    const copy = source.clone().selection;
    target.selection.wid = copy.wid;
    target.selection.hei = copy.hei;
    target.selection.bounds_dirty = copy.bounds_dirty;
    target.selection.bounds = copy.bounds;
    target.selection.map = copy.map;
}

// Part of C nhlsel.c:l_selection_rndcoord(): the {x, y} result table.
function pointTable(point: Coordinate | null): LuaTable | null {
    if (!point) return null;
    const table = new LuaTable();
    table.set('x', point.x);
    table.set('y', point.y);
    return table;
}

// Part of C nhlsel.c:l_selection_getbounds(): the lx/ly/hx/hy table.
function boundsTable(bounds: SelectionBounds): LuaTable {
    const table = new LuaTable();
    for (const field of ['lx', 'ly', 'hx', 'hy'] as const)
        table.set(field, bounds[field]);
    return table;
}

// Part of C sp_lev.c:get_location_coord(): the relative-to-absolute
// adjustment for selection coordinates.
function absolute(context: SelectionArea, x: number, y: number): Coordinate {
    return {
        x: (context._room?.lx ?? context.xstart) + (x & 0xff),
        y: (context._room?.ly ?? context.ystart) + (y & 0xff),
    };
}

// Part of C nhlsel.c:l_selection_and(), l_selection_or(),
// l_selection_xor(), l_selection_sub(): the shared bounds-union cell loop.
function selection_binary(left: Selection, right: Selection, operation: (left: number, right: number) => number): Selection {
    selection_recalc_bounds(left);
    selection_recalc_bounds(right);
    const bounds = {
        lx: Math.min(left.bounds.lx, right.bounds.lx),
        ly: Math.min(left.bounds.ly, right.bounds.ly),
        hx: Math.max(left.bounds.hx, right.bounds.hx),
        hy: Math.max(left.bounds.hy, right.bounds.hy),
    };
    const result = selection_new();
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            selection_setpoint(x, y, result, operation(
                selection_getpoint(x, y, left),
                selection_getpoint(x, y, right),
            ));
    return result;
}

// C nhlsel.c:l_selection_and().
export function selection_and(left: Selection, right: Selection) {
    return selection_binary(left, right, (a, b) => a & b);
}

// C nhlsel.c:l_selection_or().
export function selection_or(left: Selection, right: Selection) {
    const result = selection_binary(left, right, (a, b) => a | b);
    selection_recalc_bounds(result);
    return result;
}

// C nhlsel.c:l_selection_xor().
export function selection_xor(left: Selection, right: Selection) {
    const result = selection_binary(left, right, (a, b) => a ^ b);
    selection_recalc_bounds(result);
    return result;
}

// C nhlsel.c:l_selection_sub().
export function selection_sub(left: Selection, right: Selection) {
    const result = selection_binary(left, right, (a, b) => (a ^ b) & a);
    selection_recalc_bounds(result);
    return result;
}

// C nhlsel.c:l_selection_numpoints(): counts selected points within the bounds.
export function selection_numpoints(selection: Selection): number {
    let count = 0;
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (selection_getpoint(x, y, selection)) count++;
    return count;
}

// C nhlsel.c:l_selection_flood(): with get_location_coord resolution.
// The Lua flood operation matches the starting square's terrain.
export function specialSelectionFloodFill(context: SelectionArea, x: number, y: number, diagonals = false) {
    const start = absolute(context, x, y);
    if (!isok(start.x, start.y)) return new SpecialSelection();
    const terrain = game.level?.at?.(start.x, start.y)?.typ;
    return new SpecialSelection().floodFill(
        start.x, start.y, diagonals,
        set_floodfillchk_match_under(terrain),
    );
}

// C nhlsel.c:l_selection_match(): the map fragment match. The fragment
// parse and mapfrag_error()'s odd-dimension and valid-center checks are
// inlined above; mapfrag_free() has no port (no owned buffer).
export function specialSelectionMatch(fragment: string) {
    const data = (fragment.split('\0', 1)[0] ?? '').replace(/[0-9]/g, '');
    const rows = data.split('\n');
    if (rows.at(-1) === '') rows.pop();
    if (rows.length > MAP_Y_LIM + 1) throw new NethackLuaError('mapfragment error');
    const width = Math.max(0, ...rows.map(row => row.length));
    if (!(width % 2) || !(rows.length % 2))
        throw new NethackLuaError('mapfragment needs to have odd height and width');
    const xRadius = Math.trunc(width / 2);
    const yRadius = Math.trunc(rows.length / 2);
    // mapfrag_get() indexes the original buffer with a fixed row stride.
    const terrainAt = (x: number, y: number) =>
        mapCharacterType(data[y * (width + 1) + x]) ?? INVALID_TYPE;
    const center = terrainAt(xRadius, yRadius);
    if (center === INVALID_TYPE || center === MAX_TYPE)
        throw new NethackLuaError('mapfragment center must be valid terrain');

    const selection = selection_new();
    for (let y = 0; y <= ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            let matched = true;
            for (let offsetX = -xRadius;
                offsetX <= xRadius && matched; offsetX++) {
                for (let offsetY = -yRadius;
                    offsetY <= yRadius; offsetY++) {
                    const expected = terrainAt(offsetX + xRadius, offsetY + yRadius);
                    const actual = isok(x + offsetX, y + offsetY)
                        ? game.level?.at?.(x + offsetX, y + offsetY)?.typ
                        : STONE;
                    if (!match_maptyps(expected, actual ?? STONE)) {
                        matched = false;
                        break;
                    }
                }
            }
            selection_setpoint(x, y, selection, matched ? 1 : 0);
        }
    }
    selection_recalc_bounds(selection);
    return new SpecialSelection(selection);
}

// C nhlsel.c:l_selection_randline().
export function specialSelectionRandLine(
    x1: number, y1: number, x2: number, y2: number, roughness: number, recursion = 12,
    result = new SpecialSelection(),
) {
    selection_do_randline(
        x1, y1, x2, y2, roughness, recursion, result.selection,
    );
    return result;
}

// C nhlsel.c:l_selection_register(): the selection method table and its
// metatable. Entries without a helper of their own below: new
// (l_selection_new()), floodfill (l_selection_flood()), match
// (l_selection_match()), room (l_selection_room()), describe_size
// (l_selection_size_description()), __band (l_selection_and()), __bor and
// __add (l_selection_or()), __bxor (l_selection_xor()), __sub
// (l_selection_sub()); __unm and __bnot route to negate()
// (l_selection_not()), and __gc (l_selection_gc()) has no port because the
// interpreter owns the selection objects.
export function createSelectionApi(context: ContextSource, invoke: InvokeSelection = null) {
// C nhlsel.c:l_selection_push_new(): wrap a selection in the userdata whose
// metatable carries the operators; the caller builds the SpecialSelection.
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
// C nhlsel.c:l_selection_setpoint(): the zero- to three-argument forms all
// resolve their coordinate through get_location_coord() first.
    const set = async (...args: LuaValue[]) => {
        if (args.length === 0) throw new NethackLuaError('Selection setpoint error');
        const self = args.length === 2 ? undefined : args.shift();
        const selection = self === undefined ? new SpecialSelection() : selectionValue(self);
        const coordinate = args.length === 0 ? null
            : { x: luaCoordinate(args[0]), y: luaCoordinate(args[1]) };
        const value = luaInt(args[2] ?? 1);
        const point = await get_location_coord(currentContext(), coordinate, ANY_LOC);
        selection_setpoint(point.x, point.y, selection.selection, value);
        return self ?? wrap(selection);
    };
// C nhlsel.c:l_selection_getpoint(): x and y, an {x,y} table or a two-entry
// array, resolved through get_location_coord() before the point is read.
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
        const point = await get_location_coord(currentContext(), coordinate, ANY_LOC);
        return selection_getpoint(point.x, point.y, selection.selection);
    };
// C nhlsel.c:l_selection_clone(): a copy of the selection, or the reverse
// copy-into-second-slot form.
    const clone = (...args: LuaValue[]) => {
        const source = selectionValue(args[0]);
        if (args.length === 1) return wrap(source.clone());
        // Native copies into stack slot two and returns the new empty selection on top.
        copySelectionInto(selectionValue(args[1], 2), source);
        return wrap(new SpecialSelection());
    };
// C nhlsel.c:l_selection_numpoints(): count the selected points.
    const numpoints = (self: LuaValue) => selection_numpoints(selectionValue(self).selection);
// C nhlsel.c:l_selection_not(): negate a fresh selection or a clone.
    const negate = (...args: LuaValue[]) => {
        if (args.length === 0) return wrap(new SpecialSelection().negate());
        const result = clone(...args);
        const target = args.length === 1 ? result.value : selectionValue(args[1]);
        selection_not(target.selection);
        return result;
    };
// C nhlsel.c:l_selection_filter_percent(): keep points with that chance.
    const filterPercent = (self: LuaValue, percent: LuaValue) => wrap(
        selectionValue(self).percentage(luaInt(percent)),
    );
// C nhlsel.c:l_selection_filter_mapchar(): keep points whose map character
// and lighting match.
    const filterMapchar = (self: LuaValue, character: LuaValue, lit: LuaValue = -2) => wrap(
        selectionValue(self).filterMapCharacter(luaString(character), luaInt(lit ?? -2)),
    );
// C nhlsel.c:l_selection_grow(): grow in the named direction (or a random
// one), on a clone.
    const grow = (self: LuaValue, direction: LuaValue = 'all', ...extra: LuaValue[]) => {
        const selection = selectionValue(self);
        const name = luaString(direction ?? 'all');
        if (!['all', 'random', 'north', 'south', 'east', 'west'].includes(name))
            throw new TypeError(`Unknown selection growth direction: ${name}`);
        // With extra arguments native leaves the direction in clone's second slot.
        if (extra.length) selectionValue(direction, 2);
        return wrap(selection.grow(name));
    };
// C nhlsel.c:l_selection_rndcoord(): a random point, optionally removed,
// reported relative to the current room or map origin.
    const rndcoord = (self: LuaValue, remove: LuaValue = 0) => pointTable(
        relativePoint(selectionValue(self).randomCoordinate(!!luaInt(remove ?? 0)))
            ?? { x: -1, y: -1 },
    );
// C nhlsel.c:l_selection_getbounds(): the selection's bounds rectangle.
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
// C nhlsel.c:l_selection_line(), l_selection_rect() and l_selection_fillrect()
// (the area alias), with params_sel_2coords()' four- or five-argument forms
// inlined in the argc handling.
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
// C nhlsel.c:l_selection_circle() and l_selection_ellipse(): one or two
// radii, optionally filled, both through selection_do_ellipse().
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
// C nhlsel.c:l_selection_gradient(): the radial or square gradient table;
// x2/y2 defaulting to -1 means a single center.
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
// C nhlsel.c:l_selection_randline(): a rough line between two points,
// defaulting to roughness 7.
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
// C nhlsel.c:l_selection_iterate(): visit every selected point with the
// callback, room- or map-relative, aborting on a callback error.
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
        percentage: filterPercent,
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
            new SpecialSelection(selection_or(selectionValue(left).selection, selectionValue(right, 2).selection)),
        ),
        __band: (left, right) => wrap(
            new SpecialSelection(selection_and(selectionValue(left).selection, selectionValue(right, 2).selection)),
        ),
        __bxor: (left, right) => wrap(
            new SpecialSelection(selection_xor(selectionValue(left).selection, selectionValue(right, 2).selection)),
        ),
        __bnot: value => wrap(selectionValue(value).negate()),
        __unm: value => wrap(selectionValue(value).negate()),
        __add: (left, right) => wrap(
            new SpecialSelection(selection_or(selectionValue(left).selection, selectionValue(right, 2).selection)),
        ),
        __sub: (left, right) => wrap(
            new SpecialSelection(selection_sub(selectionValue(left).selection, selectionValue(right, 2).selection)),
        ),
    };
    const currentContext = () => {
        const value = typeof context === 'function' ? context() : context;
        if (!value) throw new Error('selection needs an active level context');
        return value;
    };

    return { bindings: methods, wrap };
}

// Port only: bindings-only view of createSelectionApi().
export function createSelectionBindings(context: ContextSource, invoke: InvokeSelection = null) {
    return createSelectionApi(context, invoke).bindings;
}

// Port only: exported l_selection_check() wrapper.
export function unwrapSelection(value: LuaValue | undefined) {
    return selectionValue(value);
}
