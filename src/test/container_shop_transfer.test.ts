import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

void test('looting shop merchandise from a floor chest bills it before acquisition', async () => {
    freshPlayableRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];

    await runExtendedCommand('loot', 'oa\n    ');

    assert.equal(game.inventory.includes(club), true);
    assert.equal(club.unpaid, true);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(shopkeeper.eshk.bill[0]?.bo_id, club.o_id);
});

void test('returning looted merchandise to a shop floor chest clears its bill', async () => {
    freshPlayableRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    await runExtendedCommand('loot', 'oa\n    ');
    assert.equal(club.unpaid, true);

    await runExtendedCommand('loot', `s${club.invlet}\n    `);

    assert.equal(chest.contents.includes(club), true);
    assert.equal(club.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
});
