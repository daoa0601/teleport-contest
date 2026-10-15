import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNTAIN, STAIRS, THEMEROOM } from '../js/const.js';
import { flush_screen, newsym, updateLastSeenTerrain } from '../js/display.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

for (const { name, symbol, terrain } of [
    { name: 'fountain', symbol: '{', terrain: FOUNTAIN },
    { name: 'staircase down', symbol: '>', terrain: STAIRS },
]) {
    void test(`a Lua mimic posing as a ${name} displays that feature`, async t => {
        freshGame({ flags: { bones: false } });
        requirePlayingGame(game);
        initRng(731n);
        init_objects();
        await init_dungeons();
        await startLuaCore(t);
        await mklev();
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua, 'the themed-level Lua state must be available');
        await lua.executeAsync(`
            themerooms = {{ name = "Disguise chamber", frequency = 1,
                contents = function()
                    des.room({ type = "themed", w = 8, h = 4, lit = 1, filled = 0, contents = function()
                        des.monster({ id = "large mimic", x = 2, y = 1, appear_as = "ter:${name}" })
                    end })
                end
            }}
        `);
        game.level = new GameMap();
        await mklev();
        const level = game.level;
        const room = level.rooms.slice(0, level.nroom).filter(isRoom)
            .find(candidate => candidate.rtype === THEMEROOM);
        assert.ok(room, 'the Lua definition must create its room');
        const x = room.lx + 2, y = room.ly + 1;
        game.u.ux = x - 1;
        game.u.uy = y;
        game.in_mklev = false;
        vision_reset_new_level();
        vision_recalc(0);

        newsym(x, y);
        await flush_screen(1);

        assert.equal(level.requireAt(x, y).disp_ch, symbol);
        assert.equal(level.requireAt(x, y).remembered_glyph?.ch, symbol);
        assert.equal(level.requireAt(x, y).lastseentyp, terrain,
            'seeing furniture remembers its terrain type');
        updateLastSeenTerrain(x, y);
        assert.equal(level.requireAt(x, y).lastseentyp, terrain,
            'an explicit memory refresh uses the same terrain type');
    });
}
