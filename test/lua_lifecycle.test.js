import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import { LuaLifecycle } from '../js/lua/lifecycle.js';
import { enableRngLog, getRngLog, initRng, rn2Display } from '../js/rng.js';

function freshLuaGame(seed) {
    resetGame();
    game.u = {};
    initRng(seed);
    enableRngLog();
}

test('nhlib and nhcore load in a persistent Lua 5.4 state using CORE', () => {
    freshLuaGame(123n);
    const untouchedDisplayValue = rn2Display(1000);

    freshLuaGame(123n);
    const lifecycle = new LuaLifecycle();
    const core = lifecycle.startCore(game);

    assert.deepEqual(game.splev_align, ['law', 'chaos', 'neutral']);
    assert.equal(getRngLog().length, 2);
    assert.equal(rn2Display(1000), untouchedDisplayValue);

    core.call('nh_callback_set', 'end_turn', 'tutorial_turn');
    lifecycle.syncVariables(game);
    assert.deepEqual(game.nh_lua_variables, {
        _CB_end_turn: { tutorial_turn: true },
    });

    lifecycle.destroy();
    assert.equal(core.destroyed, true);
});

test('saved nh_lua_variables populate a replacement core state', () => {
    freshLuaGame(124n);
    game.nh_lua_variables = {
        _CB_cmd_before: { tutorial_cmd_before: true },
    };
    const lifecycle = new LuaLifecycle();
    lifecycle.startCore(game);
    lifecycle.syncVariables(game);

    assert.deepEqual(game.nh_lua_variables, {
        _CB_cmd_before: { tutorial_cmd_before: true },
    });
});
