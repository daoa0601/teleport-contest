import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { UNICORN_HORN } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
// C apply.c:2279-2281 guards the cursed-horn confusion feedback with
// !Confusion only; plain You() prints for an unconscious hero as well,
// without the dream rephrase You_feel() would add.
void test('a cursed unicorn horn announces sudden confusion to a sleeping hero', async () => {
    freshPlayableRoom();
    const horn = await addInventoryObject(UNICORN_HORN, { cursed: true });
    game._helplessTurns = 5;
    game.u.usleep = 1;
    initRng(20n);
    await applyInventoryObject(horn, ' ');
    assert.equal(game._pending_message, 'You suddenly feel confused.');
    assert.ok((game.u.confusionTurns ?? 0) > 0);
});
//# sourceMappingURL=unicorn_horn_unaware_confusion.test.js.map