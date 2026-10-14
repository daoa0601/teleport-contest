import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { FLINT } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { planInput } from './support/planned-input.js';

void test('an unidentified mineral stone receives the ordinary gem-class sale price', async (t) => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.m_id = 4; // This keeper discounts unknown non-gems.
    shopkeeper.gold = 100;
    const stones = await addInventoryObject(FLINT, { typeKnown: false, quan: 8 });
    assert.equal(objectTypeKnown(stones), false);
    setHeroGoldAmount(game, 0);
    const input = resetInputState();
    input.feed(stones.invlet);
    planInput(input, t, [
        { prompt: /drop.*--More--/, keys: ' ' },
        { prompt: /offers 4 gold pieces for your gray stones\.  Sell them\?/, keys: 'y' },
    ]);

    await rhack('d'.charCodeAt(0));

    assert.equal(heroGoldAmount(game), 4);
    assert.equal(stones.where, 'floor');
    assert.equal(stones.no_charge ?? false, false);
    assert.equal(game.context.move, 1);
});
