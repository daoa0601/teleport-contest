import test from 'node:test';
import assert from 'node:assert/strict';
import { dosounds } from '../js/ambient_sounds.js';
import { SINK } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { breakSinkAt } from '../js/sink_terrain.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a broken sink stops making sink sounds even after mksink counted it twice', async () => {
    const level = freshPlayableRoom({ seed: 3n });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = SINK;
    // C mklev.c:mksink() increments nsinks after set_levltyp() already counted it.
    level.flags.nsinks = 2;
    await breakSinkAt(11, 10, game);
    resetInputState();
    pushKeys(' '.repeat(200));
    initRng(5n);
    const heard = [];
    for (let turn = 0; turn < 3000; turn++) {
        await dosounds(game);
        await flush_screen(1);
        heard.push(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '');
    }
    assert.ok(heard.some(line => /You hear/.test(line)), 'the new fountain is audible');
    assert.equal(heard.some(line => /slow drip|gurgling noise|dishes being washed/.test(line)), false);
});
//# sourceMappingURL=sink_feature_count.test.js.map