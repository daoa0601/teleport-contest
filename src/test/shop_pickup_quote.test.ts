import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';

for (const deaf of [false, true]) {
    void test(`picking up a stack gives a ${deaf ? 'list' : 'spoken per-item'} price`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        game.u.deafTurns = deaf ? 10 : 0;
        const daggers = await floorObject(DAGGER, 10, 10, { quan: 3 });
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };

        await withMessagePages(() => rhack(','.charCodeAt(0)), input,
            /list price|For you|daggers/, 2);
        messages.push(game._pending_message);

        assert.match(messages.join('\n'), deaf ? /The list price of the daggers is 4 zorkmids each\./
            : /only 4 zorkmids per dagger\."/);
        assert.equal(daggers.unpaid, true);
        assert.equal(daggers.where, 'inventory');
        assert.equal(shopkeeper.eshk.bill[0]?.bquan, 3);
        assert.equal(shopkeeper.eshk.bill[0]?.price, 4);
        assert.equal(game.context.move, 1);
    });
}
