import test from 'node:test';
import assert from 'node:assert/strict';

import { LuaState } from '../js/lua/runtime.js';

test('Lua awaits host operations before continuing the script', async () => {
    const calls = [];
    const state = new LuaState({
        record: async value => {
            await Promise.resolve();
            calls.push(value);
            return value * 2;
        },
    });

    await state.executeAsync(`
        total = 0
        for value = 1, 3 do
            total = total + record(value)
        end
    `);

    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(state.getGlobal('total'), 12);
});
