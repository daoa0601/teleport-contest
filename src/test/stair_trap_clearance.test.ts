import assert from 'node:assert/strict';
import test from 'node:test';

import { PIT } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { levelStairs } from './support/level-state.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('special-level stairs remove a trap already on their square', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 4 };
    game.specialLevels?.clear();
    game.branches = [];
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ w = 5, h = 3, lit = 1, filled = 0, contents = function()
                des.trap({ type = "pit", x = 1, y = 1, victim = false })
                des.trap({ type = "pit", x = 3, y = 1, victim = false })
                des.stair("up", 1, 1)
            end })
        end }}
        function post_level_generate() end
    `);

    await mklev();

    const level = requireGameLevel();
    const stairs = levelStairs(game).filter(stair => stair.up);
    assert.ok(stairs.length > 0, 'the rooms must hold the requested upstairs');
    assert.ok(level.traps.some(trap => trap.ttyp === PIT), 'other traps remain');
    for (const stair of stairs)
        assert.ok(!level.traps.some(trap => trap.tx === stair.sx && trap.ty === stair.sy),
            `no trap shares the stair square ${stair.sx},${stair.sy}`);
});
