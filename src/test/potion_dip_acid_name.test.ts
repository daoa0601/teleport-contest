import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { DAGGER, POT_ACID } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const quantity of [1, 3]) {
    void test(`acid corrosion keeps the personal name of ${quantity === 1 ? 'a dagger' : 'stacked daggers'}`, async () => {
        freshObjectRoom();
        const daggers = await addInventoryObject(DAGGER, { quan: quantity, oname: 'Toothpick' });
        const acid = await addInventoryObject(POT_ACID);

        await runExtendedCommand('dip', daggers.invlet + acid.invlet + ' '.repeat(20));

        const noun = quantity === 1 ? 'dagger' : 'daggers';
        const verb = quantity === 1 ? 'corrodes' : 'corrode';
        assert.ok(game._pending_message.includes(`Your ${noun} named Toothpick ${verb}!`),
            game._pending_message);
        assert.equal(daggers.oeroded2, 1);
        assert.equal(daggers.quan, quantity);
        assert.equal(game.inventory.includes(acid), false);
        assert.equal(game.context.move, 1);
    });
}
