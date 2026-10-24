import test from 'node:test';
import assert from 'node:assert/strict';

import { LuaState } from '../js/lua/runtime.js';
import { createSelectionBindings } from '../js/lua/selection.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { ROOM, ROOMOFFSET } from '../js/const.js';
import type { Room } from '../js/map_types.js';

function selectionRoom(lx: number, ly: number, hx: number, hy: number, index = 0): Room {
    return {
        lx, ly, hx, hy, roomnoidx: index, rtype: 0, rlit: 0,
        doorct: 0, fdoor: 0, irregular: false, needjoining: false,
        nsubrooms: 0, sbrooms: [], needfill: 0,
    };
}

void test('Lua selection methods and operators use the selvar backend', () => {
    const context = { xstart: 2, ystart: 3, width: 20, height: 12 };
    const state = new LuaState({
        selection: createSelectionBindings(context),
    });

    state.execute(`
        local horizontal = selection.line(1, 2, 3, 2)
        local vertical = selection.line(2, 1, 2, 3)
        local cross = horizontal | vertical
        count = cross:numpoints()
        box = selection.area(0, 0, 1, 1):numpoints()
    `);

    assert.equal(state.getGlobal('count'), 5);
    assert.equal(state.getGlobal('box'), 4);
});

void test('randline validates the native selection stack when its argument count skips coordinate parsing', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());
    const cases = [
        { source: 'selection.randline()', message: "bad argument #1 to 'randline' (userdata expected, got no value)" },
        { source: 'selection.randline(1)', message: "bad argument #1 to 'randline' (userdata expected, got number)" },
        { source: 'selection.randline(selection.new(), 1, 2, 3, 4)', message: "bad argument #2 to 'randline' (userdata expected, got number)" },
        { source: 'selection.new():randline(1, 2, 3, 4)', message: "bad argument #1 to 'randline' (userdata expected, got number)" },
        { source: 'selection.randline("1", 2, 3, 4, 0)', message: "bad argument #1 to 'randline' (userdata expected, got string)" },
        { source: 'selection.randline(1, 2, 3, 4, 0, 0)', message: "bad argument #1 to 'randline' (userdata expected, got number)" },
    ];

    for (const { source, message } of cases) {
        await t.test(source, async () => {
            await assert.rejects(state.executeAsync(source, '=randline.lua'), error => {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes(`randline.lua:1: ${message}`), error.message);
                return true;
            });
        });
    }
});

void test('randline clones selections without adding points when coordinate parsing is skipped', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 2, ystart: 3, width: 20, height: 12 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local source = selection.set(1, 1)
        local line = selection.randline(source)
        copied = line:get(1, 1)
        degenerate_point = line:get(0, 0)
        source_unchanged = source:get(0, 0)
        local target = selection.new()
        returned_count = selection.randline(source, target):numpoints()
        target_count = target:numpoints()
    `);

    assert.equal(state.getGlobal('copied'), 1);
    assert.equal(state.getGlobal('degenerate_point'), 0);
    assert.equal(state.getGlobal('source_unchanged'), 0);
    assert.equal(state.getGlobal('returned_count'), 0);
    assert.equal(state.getGlobal('target_count'), 1);
});

void test('selection growth and geometry report the first invalid Lua argument', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());
    const cases = [
        { source: 'selection.grow(selection.new(), "north", 1)', message: "bad argument #2 to 'grow' (userdata expected, got string)" },
        { source: 'selection.new():grow("north", 1)', message: "bad argument #1 to 'grow' (userdata expected, got string)" },
        { source: 'selection.grow(selection.new(), nil, 1)', message: "bad argument #2 to 'grow' (userdata expected, got nil)" },
        { source: 'selection.grow(1, "north", 1)', message: "bad argument #1 to 'grow' (userdata expected, got number)" },
        { source: 'selection.line(1, 2, 3, 4, 5)', message: "bad argument #1 to 'line' (userdata expected, got number)" },
        { source: 'selection.rect(1, 2, 3, 4, 5)', message: "bad argument #1 to 'rect' (userdata expected, got number)" },
        { source: 'selection.fillrect(1, 2, 3, 4, 5)', message: "bad argument #1 to 'fillrect' (userdata expected, got number)" },
        { source: 'selection.area(1, 2, 3, 4, 5)', message: "bad argument #1 to 'area' (userdata expected, got number)" },
        { source: 'selection.line(selection.new(), 1, 2, 3)', message: "bad argument #1 to 'line' (number expected, got selection)" },
        { source: 'selection.circle(selection.new(), 1, 2)', message: "bad argument #1 to 'circle' (number expected, got selection)" },
        { source: 'selection.ellipse(selection.new(), 1, 2, 3)', message: "bad argument #1 to 'ellipse' (number expected, got selection)" },
        { source: 'selection.circle(1, 2, 3, 0, 5)', message: "bad argument #1 to 'circle' (userdata expected, got number)" },
        { source: 'selection.ellipse(1, 2, 3, 4, 0, 5)', message: "bad argument #1 to 'ellipse' (userdata expected, got number)" },
        { source: 'selection.line(selection.new(), "x", 2, 3, 4)', message: "bad argument #2 to 'line' (number expected, got string)" },
        { source: 'selection.new():randline(1, 2, 3, 4, 0.5)', message: "bad argument #5 to 'randline' (number has no integer representation)" },
    ];

    for (const { source, message } of cases) {
        await t.test(source, async () => {
            await assert.rejects(state.executeAsync(source, '=selection-arguments.lua'), error => {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes(`selection-arguments.lua:1: ${message}`), error.message);
                return true;
            });
        });
    }
});

void test('explicit selection coordinates wrap each axis to eight bits before the map origin', async t => {
    freshGame();
    initRng(17);
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 2, ystart: 3, width: 20, height: 12 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local points = selection.new()
        points:set(-1, 0)
        outside_count = points:numpoints()
        points:set(257, 258)
        wrapped_count = points:numpoints()
        local bounds = points:bounds()
        wrapped_x = bounds.lx
        wrapped_y = bounds.ly
    `);

    assert.equal(state.getGlobal('outside_count'), 0, 'a negative explicit axis must not add a random point');
    assert.equal(state.getGlobal('wrapped_count'), 1);
    assert.equal(state.getGlobal('wrapped_x'), 3);
    assert.equal(state.getGlobal('wrapped_y'), 5);
});

void test('map-character filters ignore lighting for values other than random, dark or lit', t => {
    const game = freshGame();
    game.level.requireAt(12, 6).typ = ROOM;
    game.level.requireAt(12, 6).lit = true;
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    state.execute(`
        local floor = selection.area(12, 6, 12, 6)
        negative = floor:filter_mapchar(".", -3):numpoints()
        positive = floor:filter_mapchar(".", 2):numpoints()
        dark = floor:filter_mapchar(".", 0):numpoints()
        lit = floor:filter_mapchar(".", 1):numpoints()
    `);

    assert.equal(state.getGlobal('negative'), 1);
    assert.equal(state.getGlobal('positive'), 1);
    assert.equal(state.getGlobal('dark'), 0);
    assert.equal(state.getGlobal('lit'), 1);
});

void test('a gradient projects its center segment with native single-precision rounding', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local center = selection.gradient({ x = 1, y = 0, x2 = 23, y2 = 0, maxdist = 0 })
        start = center:get(1, 0)
        rounded_away = center:get(14, 0)
        finish = center:get(23, 0)
    `);

    assert.equal(state.getGlobal('start'), 1);
    assert.equal(state.getGlobal('rounded_away'), 0);
    assert.equal(state.getGlobal('finish'), 1);
});

void test('selection drawing and returned coordinates use the enclosing room origin', async t => {
    freshGame();
    initRng(17);
    const state: LuaState = new LuaState({
        selection: createSelectionBindings({
            xstart: 2, ystart: 3, width: 40, height: 15,
            _room: selectionRoom(20, 8, 30, 18),
        }, async (callback, args) => {
            await state.callValueAsync(callback, args);
            return true;
        }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        line = selection.line(1, 1, 3, 1):get(1, 1)
        rect = selection.rect(1, 1, 3, 3):get(1, 1)
        area = selection.area(1, 1, 3, 3):get(2, 2)
        circle = selection.circle(3, 3, 1, 1):get(3, 3)
        ellipse = selection.ellipse(3, 3, 2, 1, 1):get(3, 3)
        randline = selection.randline(1, 1, 3, 1, 0):get(1, 1)
        gradient = selection.gradient({x = 3, y = 3, x2 = 3, y2 = 3, maxdist = 0}):get(3, 3)
        local point = selection.set(2, 2)
        local chosen = point:rndcoord()
        chosen_x, chosen_y = chosen.x, chosen.y
        point:iterate(function(x, y) visited_x, visited_y = x, y end)
    `);

    for (const shape of ['line', 'rect', 'area', 'circle', 'ellipse', 'randline', 'gradient'])
        assert.equal(state.getGlobal(shape), 1, `${shape} uses room-relative coordinates`);
    assert.equal(state.getGlobal('chosen_x'), 2);
    assert.equal(state.getGlobal('chosen_y'), 2);
    assert.equal(state.getGlobal('visited_x'), 2);
    assert.equal(state.getGlobal('visited_y'), 2);
});

void test('selection iteration observes points added and removed by its callback', async t => {
    freshGame();
    const state: LuaState = new LuaState({
        selection: createSelectionBindings(
            { xstart: 0, ystart: 0, width: 80, height: 21 },
            async (callback, args) => {
                await state.callValueAsync(callback, args);
                return true;
            },
        ),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local points = selection.set(10, 4) | selection.set(12, 4)
        visited = ""
        points:iterate(function(x, y)
            visited = visited .. x .. ","
            if x == 10 then
                points:set(11, 4)
                points:set(12, 4, 0)
                points:set(13, 4)
            end
        end)
    `);

    assert.equal(state.getGlobal('visited'), '10,11,',
        'visit current points in the original bounds, in row order');
});

void test('selection.room selects a numbered room and falls back to the enclosing room', t => {
    const game = freshGame();
    const first = selectionRoom(10, 4, 12, 6);
    const second = selectionRoom(20, 8, 22, 10, 1);
    game.level.rooms = [first, second];
    for (const room of [first, second])
        for (let x = room.lx; x <= room.hx; x++)
            for (let y = room.ly; y <= room.hy; y++)
                game.level.requireAt(x, y).roomno = ROOMOFFSET + room.roomnoidx;
    game.level.requireAt(20, 8).edge = true;
    game.level.requireAt(22, 10).roomno = 0;
    const state = new LuaState({
        selection: createSelectionBindings({
            xstart: 0, ystart: 0, width: 80, height: 21, _room: first,
        }),
    });
    t.after(() => state.destroy());

    state.execute(`
        local selected = selection.room(1)
        count = selected:numpoints()
        left = selected:bounds().lx
        enclosing = selection.room():bounds().lx
        invalid = selection.room(99):bounds().lx
    `);

    assert.equal(state.getGlobal('count'), 7, 'exclude edges and squares outside room membership');
    assert.equal(state.getGlobal('left'), 20);
    assert.equal(state.getGlobal('enclosing'), 10);
    assert.equal(state.getGlobal('invalid'), 10);
});

void test('selection methods describe rectangular and irregular bounds', t => {
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    state.execute(`
        square = selection.area(10, 4, 11, 5):describe_size()
        rectangle = selection.describe_size(selection.area(10, 4, 12, 5))
        irregular = (selection.area(10, 4, 12, 5) - selection.area(11, 5, 11, 5)):describe_size()
        local factory = selection.new()
        empty = factory.new():numpoints()
    `);

    assert.equal(state.getGlobal('square'), 'square 2 by 2');
    assert.equal(state.getGlobal('rectangle'), 'rectangular 3 by 2');
    assert.equal(state.getGlobal('irregular'), 'irregularly shaped 3 by 2');
    assert.equal(state.getGlobal('empty'), 0);
});

void test('flood fills wrap explicit coordinates and reject off-map starting squares', async t => {
    const game = freshGame();
    game.level.requireAt(1, 2).typ = ROOM;
    game.level.requireAt(2, 3).typ = ROOM;
    const context = { xstart: 0, ystart: 0, width: 80, height: 21 };
    const state = new LuaState({ selection: createSelectionBindings(context) });
    t.after(() => state.destroy());

    await state.executeAsync(`
        off_map = selection.floodfill(0, 0):numpoints()
        wrapped = selection.floodfill(257, 258):numpoints()
        diagonal = selection.floodfill(257, 258, true):numpoints()
    `);

    assert.equal(state.getGlobal('off_map'), 0, 'column zero cannot start a flood into the level');
    assert.equal(state.getGlobal('wrapped'), 1);
    assert.equal(state.getGlobal('diagonal'), 2);

    game.level.requireAt(21, 9).typ = ROOM;
    const roomState = new LuaState({
        selection: createSelectionBindings({ ...context, _room: selectionRoom(20, 8, 30, 18) }),
    });
    t.after(() => roomState.destroy());
    await roomState.executeAsync('inside_room = selection.floodfill(1, 1):get(1, 1)');
    assert.equal(roomState.getGlobal('inside_room'), 1);
});

void test('selection matches strip numeric labels and a final newline from map fragments', t => {
    const game = freshGame();
    game.level.requireAt(12, 6).typ = ROOM;
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    state.execute(`
        labelled = selection.match("1.2\\n"):numpoints()
        wildcard = selection.match("?.?"):numpoints()
    `);

    assert.equal(state.getGlobal('labelled'), 1);
    assert.equal(state.getGlobal('wildcard'), 1, 'unknown noncentral characters are transparent');
    assert.throws(() => state.execute('selection.match(".?.")'), /center must be valid terrain/);
    assert.throws(() => state.execute('selection.area(12, 6, 12, 6):filter_mapchar("[")'), /Erroneous map char/);
});

void test('random lines narrow roughness to the native signed-byte range before subdividing', t => {
    freshGame();
    initRng(17);
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    state.execute(`
        local line = selection.randline(10, 5, 20, 5, 128)
        local box = line:bounds()
        top, bottom, count = box.ly, box.hy, line:numpoints()
    `);

    assert.equal(state.getGlobal('top'), 5);
    assert.equal(state.getGlobal('bottom'), 5);
    assert.equal(state.getGlobal('count'), 11);
});

void test('selection point values retain native signed character storage and bitwise operations', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local point = selection.new()
        point:set(10, 4, 127)
        value = point:get(10, 4)
        cloned = point:clone():get(10, 4)
        negated = (-point):get(10, 4)
        local left, right = selection.new(), selection.new()
        left:set(10, 4, 3)
        right:set(10, 4, 5)
        union = (left | right):get(10, 4)
        intersection = (left & right):get(10, 4)
        difference = (left - right):get(10, 4)
        exclusive = (left ~ right):get(10, 4)
    `);

    assert.equal(state.getGlobal('value'), -129);
    assert.equal(state.getGlobal('cloned'), -129);
    assert.equal(state.getGlobal('negated'), 0);
    assert.equal(state.getGlobal('union'), 7);
    assert.equal(state.getGlobal('intersection'), 1);
    assert.equal(state.getGlobal('difference'), 2);
    assert.equal(state.getGlobal('exclusive'), 6);
});

void test('selection point and gradient arguments use native coordinate conversion', async t => {
    freshGame();
    initRng(17);
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 10, ystart: 4, width: 1, height: 1 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local point = selection.set(65535, 65535)
        random_count = point:numpoints()
        random_value = point:get(65535, 65535)
        converted_get = point:get("not a number", false)
        gradient = selection.gradient({x = 65536, y = 65536, x2 = 65536, y2 = 65536,
            maxdist = 65536}):get(0, 0)
    `);

    assert.equal(state.getGlobal('random_count'), 1);
    assert.equal(state.getGlobal('random_value'), 1);
    assert.equal(state.getGlobal('converted_get'), 1, 'two-axis get uses lua_tointeger conversion');
    assert.equal(state.getGlobal('gradient'), 1);
    await assert.rejects(state.executeAsync('selection.set()'), /Selection setpoint error/);
    await assert.rejects(state.executeAsync('selection.set(1, 2, 3)'), /userdata expected, got number/);
    await assert.rejects(state.executeAsync('selection.new():get({x = 0, [2] = 0})'), /Not a coordinate/);
});

void test('selection integer options narrow before percentage, removal, lighting and fill decisions', async t => {
    const game = freshGame();
    game.level.requireAt(12, 6).typ = ROOM;
    game.level.requireAt(12, 6).lit = true;
    initRng(17);
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local point = selection.set(12, 6)
        percentage = point:percentage(4294967296):numpoints()
        point:rndcoord(4294967296)
        remaining = point:numpoints()
        lighting = point:filter_mapchar(".", 4294967296):numpoints()
        filled = selection.circle(12, 6, 1, 4294967296):get(12, 6)
    `);

    assert.equal(state.getGlobal('percentage'), 0);
    assert.equal(state.getGlobal('remaining'), 1);
    assert.equal(state.getGlobal('lighting'), 0);
    assert.equal(state.getGlobal('filled'), 0);
});

void test('selection geometry and iteration reject unsupported argument counts', async t => {
    freshGame();
    const state: LuaState = new LuaState({
        selection: createSelectionBindings(
            { xstart: 0, ystart: 0, width: 80, height: 21 },
            async (callback, args) => {
                await state.callValueAsync(callback, args);
                return true;
            },
        ),
    });
    t.after(() => state.destroy());

    for (const source of [
        'selection.line(1, 2, 3, 4, 5)',
        'selection.rect(1, 2, 3, 4, 5)',
        'selection.area(1, 2, 3, 4, 5)',
        'selection.circle(1, 2, 3, 0, 5)',
        'selection.ellipse(1, 2, 3, 4, 0, 5)',
        'selection.randline(1, 2, 3, 4)',
        'selection.match(".", 1)',
        'selection.floodfill(1, 2, false, 0)',
        'selection.new():iterate(function() end, 1)',
        'selection.new():describe_size(1)',
        'selection.negate(nil)',
        'selection.clone(selection.new(), 1)',
        'selection.grow(selection.new(), "north", 1)',
        'selection.gradient({x = 1, y = 1, maxdist = 0}, 1)',
    ]) {
        await assert.rejects(state.executeAsync(source), source);
    }
});

void test('clone and negate retain native second-selection copy targets', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 0, ystart: 0, width: 80, height: 21 }),
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        local source = selection.set(12, 6)
        local target = selection.new()
        clone_result = selection.clone(source, target):numpoints()
        copied = target:get(12, 6)
        negate_result = selection.negate(source, target):numpoints()
        cleared = target:get(12, 6)
        inverted = target:get(13, 6)
        original = source:get(12, 6)
    `);

    assert.equal(state.getGlobal('clone_result'), 0);
    assert.equal(state.getGlobal('copied'), 1);
    assert.equal(state.getGlobal('negate_result'), 0);
    assert.equal(state.getGlobal('cleared'), 0);
    assert.equal(state.getGlobal('inverted'), 1);
    assert.equal(state.getGlobal('original'), 1);
});

void test('invalid selection point arguments leave the next random location unchanged', async t => {
    freshGame();
    const state = new LuaState({
        selection: createSelectionBindings({ xstart: 1, ystart: 0, width: 79, height: 21 }),
    });
    t.after(() => state.destroy());
    const choosePoint = async () => {
        await state.executeAsync(`
            local point = selection.new()
            point:set()
            local box = point:bounds()
            chosen_x, chosen_y = box.lx, box.ly
        `);
        return { x: state.getGlobal('chosen_x'), y: state.getGlobal('chosen_y') };
    };
    initRng(17);
    const expected = await choosePoint();

    for (const source of [
        'selection.new():set(-1, -1, false)',
        'selection.get(nil, -1, -1)',
    ]) {
        initRng(17);
        await assert.rejects(state.executeAsync(source), source);

        const chosen = await choosePoint();

        assert.equal(chosen.x, expected.x, `${source} must not change the next chosen column`);
        assert.equal(chosen.y, expected.y, `${source} must not change the next chosen row`);
    }
});
