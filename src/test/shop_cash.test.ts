import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE, DAGGER } from '../js/object_data.js';
import { addCreatedObjectToMonsterInventory } from '../js/monster_inventory.js';
import { knownObject, addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { planInput, withMessagePages } from './support/planned-input.js';

void test('paying a usage debt transfers real coins into the shopkeeper inventory', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    const capital = await knownObject(GOLD_PIECE, { quan: 10 });
    await addCreatedObjectToMonsterInventory(shopkeeper, capital);
    shopkeeper.eshk.debit = 25;
    setHeroGoldAmount(game, 100);

    await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(),
        /owe|pay that debt|Thank you/, 3);

    const coins = shopkeeper.minvent?.find(object => object.otyp === GOLD_PIECE);
    assert.equal(coins?.quan, 35);
    assert.equal(coins?.ocarry, shopkeeper);
    assert.equal(heroGoldAmount(game), 75);
    assert.equal(shopkeeper.eshk.debit, 0);
});

void test('a shopkeeper pays for dropped goods from its carried coins', async (t) => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    const capital = await knownObject(GOLD_PIECE, { quan: 2 });
    await addCreatedObjectToMonsterInventory(shopkeeper, capital);
    const dagger = await addInventoryObject(DAGGER);
    setHeroGoldAmount(game, 0);
    const input = resetInputState();
    input.feed(dagger.invlet);
    planInput(input, t, [
        { prompt: /drop.*--More--/, keys: ' ' },
        { prompt: /offers 2 gold pieces.*Sell it\?/, keys: 'y' },
    ]);

    await rhack('d'.charCodeAt(0));

    assert.equal(heroGoldAmount(game), 2);
    assert.ok(!shopkeeper.minvent?.some(object => object.otyp === GOLD_PIECE));
    assert.equal(capital.where, 'inventory');
    assert.equal(capital.ocarry, null);
    assert.equal(shopkeeper.eshk.credit ?? 0, 0);
});
