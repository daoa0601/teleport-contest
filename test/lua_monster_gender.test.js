import assert from 'node:assert/strict';
import test from 'node:test';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
void test('Lua class and random monster requests default to male after birth', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.in_mklev = true;
    initRng(41n);
    await lua.executeAsync(`
        for i = 1, 8 do
            des.monster({ class = "h", name = "Class birth " .. i, group = 0 })
        end
        des.monster({ name = "Random birth", group = 0 })
    `);
    const monsters = game.level.monsters.filter(monster => monster.mgivenname?.startsWith('Class birth ') || monster.mgivenname === 'Random birth');
    assert.equal(monsters.length, 9);
    for (const monster of monsters) {
        assert.equal(monster.female, false, `${monster.mgivenname} should have the Lua default gender`);
    }
});
void test('Lua honors explicit gender for a named species but preserves a fixed species gender', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.in_mklev = true;
    await lua.executeAsync(`
        des.monster({ id = "dwarf leader", name = "Female dwarf", female = true, group = 0 })
        des.monster({ id = "dwarf lady", name = "Male dwarf", female = false, group = 0 })
        des.monster({ id = "wood nymph", name = "Fixed female", female = false, group = 0 })
    `);
    const femaleDwarf = game.level.monsters.find(monster => monster.mgivenname === 'Female dwarf');
    const maleDwarf = game.level.monsters.find(monster => monster.mgivenname === 'Male dwarf');
    const nymph = game.level.monsters.find(monster => monster.mgivenname === 'Fixed female');
    assert.ok(femaleDwarf && maleDwarf && nymph);
    assert.equal(femaleDwarf.female, true);
    assert.equal(maleDwarf.female, false);
    assert.equal(nymph.female, true);
});
//# sourceMappingURL=lua_monster_gender.test.js.map