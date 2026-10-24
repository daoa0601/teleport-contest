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

    // luaL_checkinteger() argument errors, as Lua 5.4 reports them.
    assert.throws(() => state.execute('area = selection.area(true, 1, 3, 4)'),
        /bad argument #1 to 'area' \(number expected, got boolean\)/);
    assert.throws(() => state.execute('area = selection.area(1.5, 1, 3, 4)'),
        /bad argument #1 to 'area' \(number has no integer representation\)/);
    assert.throws(() => state.execute('area = selection.area({}, 1, 3, 4)'),
        /bad argument #1 to 'area' \(number expected, got table\)/);
    assert.equal(state.getGlobal('area'), null);
});
