import test from 'node:test';
import assert from 'node:assert/strict';

import { LuaState } from '../js/lua/runtime.js';
import { createSelectionBindings } from '../js/lua/selection.js';

test('Lua selection methods and operators use the selvar backend', () => {
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
