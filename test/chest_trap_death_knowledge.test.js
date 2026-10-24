import assert from 'node:assert/strict';
import test from 'node:test';
import { CHEST } from '../js/object_data.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerChestTrap } from '../js/chest_trap.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C trap.c:6497: chest_trap() marks the chest known-trap-free even when the
// trap killed the hero (only an exploding-away chest keeps tknown clear).
void test('a fatal poisoned needle still marks the chest no longer trapped', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 40 } });
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 10, 10);
    chest.otrapped = true;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(1n);
    // Luck save fails (rn2(13) <= 7), the 1-in-20 fork selects outcome 14
    // (poisoned needle), and the needle's poison damage kills the hero.
    const result = await triggerChestTrap(chest, {
        random: limit => (limit === 13 ? 0 : limit === 20 ? 0 : limit === 26 ? 14 : 0),
        rollDice: () => 20,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result?.outcome, 'poisoned-needle');
    assert.equal(result.died, true, `the needle must kill: ${messages.join(' | ')}`);
    assert.equal(game.program_state.gameover, true);
    assert.equal(chest.otrapped, false, 'the one-shot trap flag is cleared');
    assert.equal(chest.tknown, true, 'C sets tknown after every non-exploding outcome, even a fatal one');
});
//# sourceMappingURL=chest_trap_death_knowledge.test.js.map