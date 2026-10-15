import assert from 'node:assert/strict';
import test from 'node:test';
import { FUZZER_IMPOSSIBLE_PANIC } from '../js/diagnostics.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { PanicTermination } from '../js/panic_termination.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
void test('shop selection reports a doorway with no adjacent room floor', async (t) => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 2 };
    game.flags.debug_fuzzer = FUZZER_IMPOSSIBLE_PANIC;
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "ordinary", w = 6, h = 4, filled = 0,
                contents = function()
                    des.terrain(selection.room(), "I")
                end })
        end }}
    `);
    initRng(2);
    await assert.rejects(mklev(), error => error instanceof PanicTermination
        && error.message === 'invalid_shop_shape: no squares inside door?');
});
//# sourceMappingURL=shop_shape_diagnostic.test.js.map