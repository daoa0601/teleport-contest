import test from 'node:test';
import assert from 'node:assert/strict';

import { LuaState } from '../js/lua/runtime.js';

void test('Lua uses awaited host results in loop expressions', async t => {
    const state = new LuaState({
        double: async value => {
            await Promise.resolve();
            assert.ok(typeof value === 'number', 'double needs a number');
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
