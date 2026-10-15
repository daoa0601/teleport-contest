import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPLINT_MAIL } from '../js/object_data.js';
import { nearCapacity, SLT_ENCUMBER } from '../js/weight.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
for (const ladder of [false, true]) {
    const noun = ladder ? 'ladder' : 'stairs';
    void test(`a stressed hero spends a turn failing to climb the ${noun}`, async () => {
        freshConnectedLevels({ ladder });
        requirePlayingGame(game);
        installPagerInput(resetInputState(), { expected: /stairs|ladder|load is too heavy/, limit: 3 });
        await rhack('>'.charCodeAt(0));
        const level = game.level;
        await addInventoryObject(SPLINT_MAIL, { quan: 3, quantity: 3 });
        assert.ok(nearCapacity(game) > SLT_ENCUMBER, 'the load exceeds the stair-climbing limit');
        await rhack('<'.charCodeAt(0));
        assert.ok(game.level === level, 'the heavy load prevents departure');
        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message, `Your load is too heavy to climb the ${noun}.`);
    });
}
//# sourceMappingURL=stairs_load.test.js.map