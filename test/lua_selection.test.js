import test from 'node:test';
import assert from 'node:assert/strict';
import { LuaState } from '../js/lua/runtime.js';
import { createSelectionBindings } from '../js/lua/selection.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { ROOM } from '../js/const.js';
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
void test('explicit selection coordinates wrap each axis to eight bits before the map origin', async (t) => {
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
//# sourceMappingURL=lua_selection.test.js.map