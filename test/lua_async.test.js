import test from 'node:test';
import assert from 'node:assert/strict';

import { LuaState } from '../js/lua/runtime.js';

test('Lua uses awaited host results in loop expressions', async t => {
    const state = new LuaState({
        double: async value => {
            await Promise.resolve();
            return value * 2;
        },
    });
    t.after(() => state.destroy());

    await state.executeAsync(`
        total = 0
        for value = 1, 3 do
            total = total + double(value)
        end
    `);

    assert.equal(state.getGlobal('total'), 12);
});
