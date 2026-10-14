import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SACK, POT_HEALING } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

for (const descriptionKnown of [false, true]) {
    void test(`unpaid report preserves ${descriptionKnown ? 'known' : 'unseen'} contained potion appearance`, async () => {
        freshPlayableRoom({ flags: { menu_style: 0 } });
        const bag = await addInventoryObject(SACK, { initialize: false, cknown: true });
        const potion = await knownObject(POT_HEALING, {
            dknown: descriptionKnown, known: false, typeKnown: false,
        });
        await addCreatedObjectToContainer(bag, potion);
        potion.unpaid = true;
        await createStaffedShop({ bill: [{ bo_id: potion.o_id, bquan: 1, price: 50, useup: false }] });
        const input = resetInputState();
        input.feed('u');

        await rhack('I'.charCodeAt(0));

        assert.equal(potion.dknown, descriptionKnown);
        const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? game._pending_message;
        assert.match(game._pending_message || message, descriptionKnown ? /potion/ : /an uncursed potion\s+50 zorkmids/);
        assert.equal(game.context.move, 0);
    });
}
