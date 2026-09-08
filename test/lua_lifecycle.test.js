import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { LuaLifecycle } from '../js/lua/lifecycle.js';
import { initRng, rn2Display } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshGameplayRoom } from './support/playable-room.js';

function freshLuaGame(seed) {
    freshGame();
    initRng(seed);
}

test('Lua game randomness does not change display randomness', t => {
    freshLuaGame(123n);
    const untouchedDisplayValue = rn2Display(1000);

    freshLuaGame(123n);
    const lifecycle = new LuaLifecycle();
    t.after(() => lifecycle.destroy());
    const core = lifecycle.startCore(game);

    core.execute('roll = nh.rn2(1000)');

    assert.ok(core.getGlobal('roll') >= 0 && core.getGlobal('roll') < 1000);
    assert.equal(rn2Display(1000), untouchedDisplayValue);
});

test('saved Lua variables survive replacing the core state', t => {
    freshLuaGame(124n);
    const lifecycle = new LuaLifecycle();
    t.after(() => lifecycle.destroy());
    const core = lifecycle.startCore(game);
    core.execute('nh_lua_variables.visited = { forge = true }');
    lifecycle.syncVariables(game);

    const restored = lifecycle.startCore(game);
    restored.execute('visitedForge = nh_lua_variables.visited.forge');

    assert.equal(restored.getGlobal('visitedForge'), true);
});

test('a retained Lua player table follows movement and rejects direct changes to the hero', async t => {
    freshGameplayRoom();
    const core = startLuaCore(t);
    core.execute('hero = u; previous_x = hero.ux');

    await rhack('l'.charCodeAt(0));
    core.execute('current_x = hero.ux');

    assert.equal(core.getGlobal('current_x'), core.getGlobal('previous_x') + 1);
    assert.throws(() => core.execute('hero.uhp = 100'), /Cannot set u table values/);
    assert.throws(() => core.execute('private_state = hero.uz'), /Unknown u table index/);
});
