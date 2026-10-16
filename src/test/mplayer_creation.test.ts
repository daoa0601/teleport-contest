import assert from 'node:assert/strict';
import test from 'node:test';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a level-script knight receives player hit points and a weapon', async t => {
    freshObjectRoom({ flags: { bones: false }, gameplaySeed: 731n });
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation must initialize themed-room Lua');
    const room = game.level.rooms.find(isRoom);
    assert.ok(room, 'the level must have room for the knight');
    game.in_mklev = true;
    initRng(2n);

    await lua.executeAsync(`des.monster({ id = "knight", name = "Script knight",
        x = ${room.lx}, y = ${room.ly}, peaceful = 0 })`);

    const knight = game.level.monsters.find(monster => monster.mgivenname === 'Script knight');
    assert.ok(knight, 'the script must create its named knight');
    assert.equal(knight.mnum, MONSTER_NAME.indexOf('knight'));
    assert.ok(knight.m_lev >= 1 && knight.m_lev <= 16);
    assert.ok(knight.mhp >= knight.m_lev + 30,
        `Player hit dice plus 30 must exceed ordinary monster HP; got ${knight.mhp} at level ${knight.m_lev}`);
    assert.equal(knight.mhp, knight.mhpmax);
    assert.ok(knight.minvent?.some(object => object.oclass === 2));
});
