import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { LuaUserdata } from '../js/lua/runtime.js';
import { LuaLifecycle } from '../js/lua/lifecycle.js';
import { initRng, rn2Display } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
function freshLuaGame(seed) {
    freshGame();
    initRng(seed);
}
void test('Lua game randomness does not change display randomness', async (t) => {
    freshLuaGame(123n);
    const untouchedDisplayValue = rn2Display(1000);
    freshLuaGame(123n);
    const lifecycle = new LuaLifecycle();
    t.after(() => lifecycle.destroy());
    const core = await lifecycle.startCore(game);
    core.execute('roll = nh.rn2(1000)');
    const roll = core.getGlobal('roll');
    assert.ok(typeof roll === 'number');
    assert.ok(roll >= 0 && roll < 1000);
    assert.equal(rn2Display(1000), untouchedDisplayValue);
});
void test('saved Lua variables survive replacing the core state', async (t) => {
    freshLuaGame(124n);
    const lifecycle = new LuaLifecycle();
    t.after(() => lifecycle.destroy());
    const core = await lifecycle.startCore(game);
    core.execute('nh_lua_variables.visited = { forge = true }');
    lifecycle.syncVariables(game);
    const restored = await lifecycle.startCore(game);
    restored.execute('visitedForge = nh_lua_variables.visited.forge');
    assert.equal(restored.getGlobal('visitedForge'), true);
});
void test('a retained Lua player table follows movement and rejects direct changes to the hero', async (t) => {
    freshGameplayRoom();
    const core = await startLuaCore(t);
    core.execute('hero = u; previous_x = hero.ux');
    await rhack('l'.charCodeAt(0));
    core.execute('current_x = hero.ux');
    const previousX = core.getGlobal('previous_x');
    assert.ok(typeof previousX === 'number');
    assert.equal(core.getGlobal('current_x'), previousX + 1);
    assert.throws(() => core.execute('hero.uhp = 100'), /Cannot set u table values/);
    assert.throws(() => core.execute('private_state = hero.uz'), /Unknown u table index/);
});
void test('closing a Lua state rejects new scripts and finishes disposal for both callers', async () => {
    freshObjectRoom();
    const lifecycle = new LuaLifecycle();
    const core = await lifecycle.startCore(game);
    await core.executeAsync('box = obj.new("chest"); rock = obj.new("rock"); box:addcontent(rock)');
    const box = luaObjectValue(core, 'box');
    const rock = luaObjectValue(core, 'rock');
    const firstClose = core.destroy();
    assert.throws(() => core.execute('later = 1'), /destroyed/);
    await core.destroy();
    assert.equal(box.where, 'gone');
    assert.equal(rock.where, 'gone');
    await firstClose;
    await lifecycle.destroy();
});
void test('both lifecycle shutdown callers wait for owned Lua objects to be deleted', async () => {
    freshObjectRoom();
    const lifecycle = new LuaLifecycle();
    const core = await lifecycle.startCore(game);
    await core.executeAsync('box = obj.new("chest"); rock = obj.new("rock"); box:addcontent(rock)');
    const box = luaObjectValue(core, 'box');
    const rock = luaObjectValue(core, 'rock');
    const firstClose = lifecycle.destroy();
    await lifecycle.destroy();
    try {
        assert.equal(box.where, 'gone');
        assert.equal(rock.where, 'gone');
    }
    finally {
        await firstClose;
    }
});
void test('failed themed-state replacement closes both old and unregistered states', async () => {
    freshObjectRoom();
    const lifecycle = new LuaLifecycle();
    const previous = await lifecycle.createThemedState(game, 0, 'themerms.lua');
    const replacementStates = [];
    await assert.rejects(lifecycle.createThemedState(game, 0, 'themerms.lua', {}, state => {
        replacementStates.push(state);
        state.execute('error("setup failed")');
    }), /setup failed/);
    assert.equal(lifecycle.getThemedState(game, 0), null);
    assert.throws(() => previous.execute('later = 1'), /destroyed/);
    const replacement = replacementStates[0];
    assert.ok(replacement);
    assert.throws(() => replacement.execute('later = 1'), /destroyed/);
    await lifecycle.destroy();
});
function luaObjectValue(state, name) {
    const handle = state.getGlobal(name);
    assert.ok(handle instanceof LuaUserdata, `${name} must be an object handle`);
    const value = handle.value;
    assert.ok(value && typeof value === 'object' && 'where' in value, `${name} must retain its object identity`);
    return value;
}
//# sourceMappingURL=lua_lifecycle.test.js.map