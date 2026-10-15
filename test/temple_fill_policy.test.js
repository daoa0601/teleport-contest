import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_SHRINE, FILL_NONE, TEMPLE } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
void test('random temple conversion builds its shrine without changing the room fill policy', async (t) => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 20 };
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "ordinary", w = 8, h = 4, filled = 0 })
        end }}
    `);
    for (let seed = 1; seed <= 128; seed++) {
        game.level = new GameMap();
        initRng(seed);
        await mklev();
        const temple = game.level.rooms.filter(isRoom).find(room => room.rtype === TEMPLE);
        if (!temple)
            continue;
        assert.equal(temple.needfill, FILL_NONE, 'mktemple builds its own contents immediately');
        const priest = game.level.monsters.find(monster => monster.ispriest);
        assert.ok(priest?.epri, 'the temple needs a resident priest and shrine');
        const shrine = game.level.requireAt(priest.epri.shrpos.x, priest.epri.shrpos.y);
        assert.equal(shrine.typ, ALTAR);
        assert.ok(shrine.flags & AM_SHRINE);
        assert.equal(priest.msleeping, 0);
        assert.equal(priest.mpeaceful, 1);
        return;
    }
    assert.fail('ordinary level generation must reach temple conversion');
});
//# sourceMappingURL=temple_fill_policy.test.js.map