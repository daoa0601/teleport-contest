import test from 'node:test';
import assert from 'node:assert/strict';
import { G_GENOD } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
// C nhlua.c:nhl_is_genocided() resolves its argument with name_to_mon(),
// so articles, plurals, and alternate spellings name the same species.
void test('nh.is_genocided resolves species names like name_to_mon', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    const grayDragon = MONSTER_NAME.indexOf('gray dragon');
    const vampire = MONSTER_NAME.indexOf('vampire');
    game.mvitals ??= [];
    game.mvitals[grayDragon] = { born: 0, died: 0, mvflags: G_GENOD };
    game.mvitals[vampire] = { born: 0, died: 0, mvflags: G_GENOD };
    await lua.executeAsync(`
        grey_alias = nh.is_genocided("grey dragon")
        plural = nh.is_genocided("vampires")
        article = nh.is_genocided("the vampire")
        ungenocided = nh.is_genocided("grid bug")
        unknown = nh.is_genocided("purple reader")
    `);
    assert.equal(lua.getGlobal('grey_alias'), true, 'alternate spelling matches');
    assert.equal(lua.getGlobal('plural'), true, 'plural matches');
    assert.equal(lua.getGlobal('article'), true, 'leading article matches');
    assert.equal(lua.getGlobal('ungenocided'), false);
    assert.equal(lua.getGlobal('unknown'), false);
});
void test('nh.is_genocided rejects extra arguments', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(732n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    await assert.rejects(lua.executeAsync('nh.is_genocided("vampire", true)'), /Wrong args \(line 1/);
    // nhl_is_genocided() reads its name through luaL_checkstring.
    await assert.rejects(lua.executeAsync('nh.is_genocided(nil)'), /bad argument #1 to 'is_genocided' \(string expected, got nil\)/);
    await assert.rejects(lua.executeAsync('nh.is_genocided({})'), /bad argument #1 to 'is_genocided' \(string expected, got table\)/);
});
//# sourceMappingURL=lua_genocide_query.test.js.map