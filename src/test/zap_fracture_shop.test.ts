import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER, ROCK, WAN_STRIKING } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('striking a shop boulder charges for the boulder before turning it into rocks', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const boulder = await floorObject(BOULDER, 10, 10, { no_charge: false });
    const wand = await addInventoryObject(WAN_STRIKING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /boulder|fracture|owe/, limit: 8 });
    input.feed(`${wand.invlet}>`);

    await rhack('z'.charCodeAt(0));

    assert.equal(boulder.otyp, ROCK);
    assert.equal(boulder.where, 'floor');
    assert.ok(boulder.quan >= 7 && boulder.quan <= 66);
    assert.ok(shopkeeper.eshk.debit > 0, 'Unbilled shop stock must incur a fracture charge.');
    assert.equal(shopkeeper.mpeaceful, 1);
});
