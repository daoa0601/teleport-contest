import test from 'node:test';
import assert from 'node:assert/strict';
import { W_ARM, W_ARMC, W_ARMU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { HAWAIIAN_SHIRT, LEATHER_ARMOR, LEATHER_CLOAK } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const { cloakUnpaid, suitUnpaid, covering } of [
    { cloakUnpaid: true, suitUnpaid: false, covering: "Manlobbi's leather cloak and your leather armor" },
    { cloakUnpaid: false, suitUnpaid: true, covering: "your leather cloak and Manlobbi's leather armor" },
    { cloakUnpaid: true, suitUnpaid: true, covering: "Manlobbi's leather cloak and leather armor" },
    { cloakUnpaid: false, suitUnpaid: false, covering: 'your leather cloak and leather armor' },
]) {
    void test(`dipping a covered shirt names ${covering}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const shirt = await addInventoryObject(HAWAIIAN_SHIRT, { owornmask: W_ARMU });
        const suit = await addInventoryObject(LEATHER_ARMOR, { owornmask: W_ARM });
        const cloak = await addInventoryObject(LEATHER_CLOAK, { owornmask: W_ARMC });
        const { shopkeeper } = await createStaffedShop({ bill: [
                ...(cloakUnpaid ? [{ bo_id: cloak.o_id, bquan: 1, price: 40, useup: false }] : []),
                ...(suitUnpaid ? [{ bo_id: suit.o_id, bquan: 1, price: 5, useup: false }] : []),
            ] });
        shopkeeper.eshk.shknam = 'Manlobbi';
        cloak.unpaid = cloakUnpaid;
        suit.unpaid = suitUnpaid;
        game.uarmu = shirt;
        game.uarm = suit;
        game.uarmc = cloak;
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._lastPlineMessage); };
        await runExtendedCommand('dip', shirt.invlet + ' '.repeat(20));
        messages.push(game._lastPlineMessage);
        assert.ok(messages.some(message => message.includes(`You need to take off ${covering} to dip your Hawaiian shirt.`)), messages.join('\n'));
        assert.equal(game.context.move, 0);
        assert.equal(shirt.owornmask, W_ARMU);
    });
}
//# sourceMappingURL=potion_dip_covering.test.js.map