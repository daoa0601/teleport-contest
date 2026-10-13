import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { cansee, couldsee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { startLuaCore } from './support/lua-game.js';
import { freshSpecialLevel } from './support/special-level.js';
void test('inside a generated dark Rogue room, geometric sight reaches the room boundary', async (t) => {
    freshSpecialLevel({ prototype: 'rogue', seed: 43n, depth: 15 });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    game.flags.bones = false;
    await startLuaCore(t);
    await mklev();
    const room = game.level.rooms.filter(isRoom).find(candidate => candidate.hx - candidate.lx >= 4);
    assert.ok(room, 'The generated Rogue level needs a room wider than night vision');
    room.rlit = 0;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            game.level.requireAt(x, y).lit = false;
    game.u.ux = room.lx + 1;
    game.u.uy = room.ly;
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(couldsee(room.hx, room.hy), true);
    assert.equal(cansee(room.hx, room.hy), false);
});
//# sourceMappingURL=rogue_room_vision.test.js.map