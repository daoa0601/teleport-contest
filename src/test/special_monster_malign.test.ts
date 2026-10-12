import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { init_dungeons } from '../js/dungeon.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

for (const fixedCoordinate of [true, false]) {
    void test(`killing a pony forced hostile by Lua ${fixedCoordinate ? 'at a fixed coordinate' : 'at a random location'} rewards the co-aligned hero`, async t => {
        freshGame({
            flags: { bones: false },
            hero: { ulevel: 8, ualign: { type: 0, record: 0 } },
        });
        requirePlayingGame(game);
        initRng(731n);
        init_objects();
        await init_dungeons();
        await startLuaCore(t);
        await mklev();
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua, 'level generation should initialize themed-room Lua');
        const room = game.level.rooms.find(isRoom);
        assert.ok(room, 'level generation should create a room');
        const coordinates = fixedCoordinate
            ? `x = ${room.lx}, y = ${room.ly + 1},` : '';
        game.in_mklev = true;
        initRng(2n);

        await lua.executeAsync(`
            des.monster({ id = "pony", name = "Lua pony", peaceful = 0, ${coordinates} })
        `);
        const pony = game.level.monsters.find(monster => monster.mgivenname === 'Lua pony');
        assert.ok(pony, 'the level file should create its named pony');
        assert.equal(pony.mpeaceful, 0);
        game.in_mklev = false;

        await finishHeroMonsterKill(pony, pony.mx, pony.my, {
            showKillMessage: false, noCorpse: true,
        });

        assert.equal(game.u.ualign.record, 3);
    });
}
