import assert from 'node:assert/strict';
import test from 'node:test';
import { HWALL, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { somexy } from '../js/mkroom.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('coordinate selection in a room with subrooms reports exhaustion at its retry limit', async t => {
    const lua = await roomBindings(t);
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 15, h = 8, filled = 0,
                contents = function()
                    des.room({ type = "ordinary", x = 2, y = 2,
                               w = 4, h = 3, filled = 0 })
                end })
        end }}
    `);
    await mklev();
    requirePlayingGame(game);
    const room = game.level.rooms.filter(isRoom).find(room => room.nsubrooms > 0);
    assert.ok(room, 'the generator must create a room with a subroom');
    room.irregular = false;
    // Leave one accessible square outside the child room. This exercises
    // successful selection as well as the native exhaustion boundary.
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            game.level.requireAt(x, y).typ = HWALL;
    game.level.requireAt(room.hx, room.hy).typ = ROOM;
    const position = { x: 0, y: 0 };
    initRng(1);
    assert.equal(somexy(room, position), true, 'an early accessible square must be accepted');

    initRng(604);

    assert.equal(somexy(room, position), false,
        'the hundredth attempt exhausts the native search even when it reaches an accessible square');
});
