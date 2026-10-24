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
        }, (callback, args) => state.callValueAsync(callback, args)),
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
            (callback, args) => state.callValueAsync(callback, args),
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
