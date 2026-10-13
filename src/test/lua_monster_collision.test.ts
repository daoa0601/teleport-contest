import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { GameMap } from '../js/game.js';
import { mklev } from '../js/mklev.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { createMonsterAt } from './support/monsters.js';

for (const occupant of ['pony', 'long worm'] as const) {
    void test(`Lua places a monster near a square occupied by ${occupant === 'pony' ? 'another monster' : 'a worm tail'}`, async t => {
        freshGame({ flags: { bones: false } });
        requirePlayingGame(game);
        initRng(731n);
        init_objects();
        await init_dungeons();
        await startLuaCore(t);
        await mklev();
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua);
        game.level = new GameMap();
        game.in_mklev = true;
        const floorMap = Array.from({ length: 10 }, () => '.'.repeat(20)).join('\n');
        await lua.executeAsync(`des.map({ x = 0, y = 0, map = [[${floorMap}]] })`);
        let point = { x: 10, y: 5 };
        const first = await createMonsterAt(occupant, point.x, point.y, NO_MINVENT | MM_NOTAIL);
        if (occupant === 'long worm') {
            initializeMonsterWormBody(first, { segmentCount: 1, random: () => 0 });
            const tail = first.wormSegments?.[0];
            assert.ok(tail, 'the occupying worm must have a tail');
            point = { x: tail.x, y: tail.y };
        }
        const requested = { x: point.x, y: point.y };

        await lua.executeAsync(`
            des.monster({ ${occupant === 'pony' ? 'id = "pony",' : ''} name = "Second", x = ${requested.x}, y = ${requested.y} })
        `);

        const second = game.level.monsters.find(monster => monster.mgivenname === 'Second');
        assert.ok(second, 'the second monster must be created rather than discarded');
        assert.equal(monsterAtPosition(game.level, requested.x, requested.y) === first, true);
        assert.equal(Math.max(Math.abs(second.mx - requested.x), Math.abs(second.my - requested.y)), 1);
    });
}
