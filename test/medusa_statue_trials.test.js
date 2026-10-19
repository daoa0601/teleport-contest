import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { BATTLE_AXE, CLUB, STATUE } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { requireMonsterVital } from './support/monsters.js';
import { createRoomLevel } from './support/playable-room.js';
import { floorObjects } from './support/level-state.js';
void test('Medusa keeps a chameleon statue whose temporary monster becomes a flesh golem', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation must initialize the real Lua des bindings');
    game.level = createRoomLevel({ left: 1, right: 78, top: 0, bottom: 20 });
    game.u.uz = { dnum: 0, dlevel: 21 };
    game.u.ulevel = 21;
    game.in_mklev = true;
    game._activeSpecialLevel = { prototype: 'medusa', file: 'medusa-1.lua' };
    const chameleon = MONSTER_NAME.indexOf('chameleon');
    const survivors = ['chameleon', 'flesh golem', 'stone golem', 'ettin']
        .map(name => MONSTER_NAME.indexOf(name));
    game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
        mvflags: survivors.includes(species) ? 0 : G_GENOD, born: 0, died: 0,
    }));
    // This seed gives the first chameleon trial a flesh-golem form.
    // C checks that form's stone resistance but the original species'
    // ability to turn into a stone golem.
    initRng(1380n);
    await lua.executeAsync('des.object({ id = "statue", x = 11, y = 10, contents = 0 })');
    const statues = floorObjects(game.level).filter(object => object.otyp === STATUE);
    assert.equal(statues.length, 1);
    assert.equal(statues[0]?.corpsenm, chameleon, 'an eligible first trial keeps its original species');
    assert.equal(requireMonsterVital(chameleon).born, 1);
    assert.equal(game.level.monsters.length, 0, 'the temporary monster is removed after petrification');
});
void test('a Medusa statue with emptied contents keeps the petrified monster\'s gear', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation must initialize the real Lua des bindings');
    game.level = createRoomLevel({ left: 1, right: 78, top: 0, bottom: 20 });
    game.u.uz = { dnum: 0, dlevel: 21 };
    game.u.ulevel = 21;
    game.in_mklev = true;
    game._activeSpecialLevel = { prototype: 'medusa', file: 'medusa-1.lua' };
    // Ogre leaders always start with a club or a battle-axe.
    const ogreLeader = MONSTER_NAME.indexOf('ogre leader');
    game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
        mvflags: species === ogreLeader ? 0 : G_GENOD, born: 0, died: 0,
    }));
    await lua.executeAsync('des.object({ id = "statue", x = 11, y = 10, contents = 0 })');
    const statues = floorObjects(game.level).filter(object => object.otyp === STATUE);
    assert.equal(statues.length, 1);
    assert.equal(statues[0]?.corpsenm, ogreLeader);
    const weapons = (statues[0]?.contents ?? []).map(object => object.otyp)
        .filter(otyp => otyp === CLUB || otyp === BATTLE_AXE);
    assert.equal(weapons.length, 1, 'the statue holds the ogre leader\'s weapon');
});
//# sourceMappingURL=medusa_statue_trials.test.js.map