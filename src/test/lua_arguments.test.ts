import test from 'node:test';
import assert from 'node:assert/strict';

import { LuaState } from '../js/lua/runtime.js';
import { createSelectionBindings } from '../js/lua/selection.js';

const context = { xstart: 2, ystart: 3, width: 20, height: 12 };

void test('Lua selection coordinates accept integer strings as native Lua does', () => {
    const state = new LuaState({ selection: createSelectionBindings(context) });

    state.execute('count = selection.line("1", "2", "3", "2"):numpoints()');

    assert.equal(state.getGlobal('count'), 3);
});

void test('invalid Lua selection coordinates fail before creating an area', () => {
    const state = new LuaState({ selection: createSelectionBindings(context) });

    assert.throws(() => state.execute('area = selection.area(true, 1, 3, 4)'), /integer/);
    assert.throws(() => state.execute('area = selection.area(1.5, 1, 3, 4)'), /integer/);
    assert.throws(() => state.execute('area = selection.area({}, 1, 3, 4)'), /integer/);
    assert.equal(state.getGlobal('area'), null);
});
