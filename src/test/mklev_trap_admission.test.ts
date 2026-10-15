import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVEL_TELEP, PIT } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('Fort Ludios rejects explicit level-teleport traps during level creation', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 12 };
    game.knox_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    game.specialLevels?.clear();
    game.branches = [];
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ w = 5, h = 3, lit = 1, filled = 0, contents = function()
                des.trap({ type = "level teleport", x = 1, y = 1, victim = false })
                des.trap({ type = "pit", x = 3, y = 1, victim = false })
            end })
        end }}
        function post_level_generate() end
    `);

    await mklev();

    const level = requireGameLevel();
    assert.ok(level.traps.some(trap => trap.ttyp === PIT), 'ordinary traps must still be placed');
    assert.ok(!level.traps.some(trap => trap.ttyp === LEVEL_TELEP),
        'an explicit request cannot bypass the single-level branch restriction');
});
