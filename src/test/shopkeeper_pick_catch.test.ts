import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DWARVISH_MATTOCK, PICK_AXE } from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { floorObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { throwInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

for (const [type, name] of [[PICK_AXE, 'pick-axe'], [DWARVISH_MATTOCK, 'mattock']] as const) {
    void test(`the shopkeeper catches a returned ${name}`, async () => {
        const level = freshObjectRoom({ right: 20 });
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
        shopkeeper.eshk.shknam = 'Izchak';
        // The keeper is away from the merchandise-free doorway square.
        shopkeeper.eshk.shk = { x: 9, y: 10 };
        shopkeeper.mhp = shopkeeper.mhpmax = 100;
        const pick = await floorObject(type, 10, 10);
        pushKeys('        ');
        await pickupAtHero();
        assert.equal(pick.unpaid, true);
        assert.ok(shopkeeper.eshk.bill.length > 0);
        resetInputState();

        await throwInventoryObject(pick, 'l', Array(12).fill(' '));

        assert.equal(game.inventory.includes(pick), false);
        assert.equal(floorObjects(level).some(object => object.otyp === type), false);
        assert.ok(shopkeeper.minvent.some(object => object.otyp === type));
        assert.equal(pick.unpaid, false);
        assert.equal(shopkeeper.eshk.bill.length, 0);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(shopkeeper.eshk.robbed ?? 0, 0);
        assert.match(game._lastPlineMessage, /Izchak snatches up the /);
    });
}
