import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { STONE } from '../js/const.js';
import { POT_HALLUCINATION } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C potion.c:potionbreathe(): case POT_HALLUCINATION only prints a one-off
// vision line; hallucination itself is untouched and its kn counter stays
// zero, so an unknown bottle still reaches the trycall() naming prompt.
// The bottle reaches the vapor via dothrow.c breakobj() on a wall next to
// the hero, which announces the peculiar odor first.
function freshVisionRoom() {
    freshObjectRoom({
        hero: {
            uz: { dnum: 0, dlevel: 4 },
            ulevel: 4,
            uhp: 30,
            uhpmax: 30,
            acurr: { a: [12, 12, 18, 12, 12, 12] },
            amax: { a: [12, 12, 18, 12, 12, 12] },
            ualign: { type: 0, record: 0 },
            uconduct: {},
            uhave: {},
            uswallow: 0,
            ustuck: null,
        },
        context: { move: 0 },
        moves: 60,
        objectInitializationSeed: 1n,
    });
    requirePlayingGame(game);
    game.level.monsters = [];
    game.level.requireAt(11, 10).typ = STONE;
}
void test('hallucination vapors show a momentary vision without causing hallucination', async () => {
    freshVisionRoom();
    const potion = await addInventoryObject(POT_HALLUCINATION, {
        known: false, typeKnown: false,
    });
    // A settled call name keeps trycall() quiet so the vision line remains
    // the last displayed message.
    game._objectCallNames = { [POT_HALLUCINATION]: 'dream' };
    resetInputState();
    initRng(2850n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ']);
    assert.equal(game._pending_message, 'You smell a peculiar odor...  You have a momentary vision.');
    assert.equal(game.u.hallucinationTurns ?? 0, 0);
    assert.equal(potion.where, 'gone');
    assert.equal(game._knownObjectTypes?.has(POT_HALLUCINATION) ?? false, false);
    assert.equal(game.context.move, 1);
});
void test('an unknown hallucination vapor offers the call-name prompt', async () => {
    freshVisionRoom();
    const potion = await addInventoryObject(POT_HALLUCINATION, {
        known: false, typeKnown: false,
    });
    resetInputState();
    initRng(2850n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ', 'vision\n', ' ']);
    assert.equal(game._objectCallNames?.[POT_HALLUCINATION], 'vision');
    assert.equal(game._knownObjectTypes?.has(POT_HALLUCINATION) ?? false, false);
    assert.equal(game.u.hallucinationTurns ?? 0, 0);
    assert.equal(potion.where, 'gone');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=potion_vapor_hallucination.test.js.map