import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { bindInputGate, InputGate } from '../js/input.js';
import { readchar } from '../js/cmd.js';
import { initRng } from '../js/rng.js';
import { freshGameplayRoom } from './support/playable-room.js';
// C cmd.c:randomkey() keeps its table index and repeat key in function
// statics; the port scopes them to one game, and every game binds a freshly
// built input gate (jsmain start() -> bindInputGate), so a new game must
// start the table from its head instead of continuing the previous game's
// position and stale ^A/^P repeat key.
void test('binding a fresh input gate restarts the fuzzer key table', async () => {
    freshGameplayRoom();
    game.iflags.debug_fuzzer = true;
    const readFuzzerKeys = async (count) => {
        const keys = [];
        for (let index = 0; index < count; index++)
            keys.push(await readchar('command'));
        return keys;
    };
    // The same seed before both captures gives the same rn2()/rn1() draws,
    // so any key difference can only come from randomkey()'s own state.
    initRng(0x5eedn);
    const firstGame = await readFuzzerKeys(64);
    // This game keeps reading: the table index advances and the last command
    // key is remembered for the ^A/^P repeat rule.
    await readFuzzerKeys(64);
    // A new game builds its own gate and binds it, exactly like jsmain.
    bindInputGate(new InputGate());
    initRng(0x5eedn);
    const newGame = await readFuzzerKeys(64);
    assert.deepEqual(newGame, firstGame);
});
//# sourceMappingURL=fuzzer_key_state.test.js.map