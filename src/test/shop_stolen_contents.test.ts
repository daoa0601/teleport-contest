import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { createMonsterAt } from './support/monsters.js';
import { withMessagePages } from './support/planned-input.js';

void test('dropping a billed container and a whole billed stack into an engulfer charges all its contents', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const sack = await addInventoryObject(SACK);
    const daggers = await knownObject(DAGGER, { quan: 5 });
    await addCreatedObjectToContainer(sack, daggers);
    sack.unpaid = daggers.unpaid = true;
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: sack.o_id, bquan: 1, price: 2, useup: false },
        { bo_id: daggers.o_id, bquan: 5, price: 4, useup: false },
    ] });
    game.u.uswallow = 1;
    game.u.ustuck = await createMonsterAt('purple worm', 10, 10);
    const input = resetInputState();
    input.feed(sack.invlet);
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await withMessagePages(() => rhack('d'.charCodeAt(0)), input, /drop|owe/, 3);
    messages.push(game._pending_message);

    assert.match(messages.join('\n'), /22 zorkmids for it and its contents!/);
    assert.equal(shopkeeper.eshk.debit, 22);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(daggers.unpaid, false);
});
