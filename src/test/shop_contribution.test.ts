import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { DAGGER } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';

void test('dropping a contribution clears a peaceful robbed shopkeeper\'s loss balance', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.robbed = 100;
    const dagger = await addInventoryObject(DAGGER);
    setHeroGoldAmount(game, 0);
    const input = resetInputState();
    input.feed(dagger.invlet);

    await withMessagePages(() => rhack('d'.charCodeAt(0)), input,
        /drop|contribution to restock/, 2);

    assert.equal(shopkeeper.eshk.robbed, 0);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.no_charge ?? false, false);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(game.context.move, 1);
});
