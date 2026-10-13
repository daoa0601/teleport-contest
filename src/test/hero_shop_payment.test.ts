import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { withMessagePages } from './support/planned-input.js';

for (const goldLocation of ['none', 'purse', 'sack'] as const) {
    void test(`paying an empty resident bill takes a turn with gold kept in ${goldLocation}`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        setHeroGoldAmount(game, goldLocation === 'purse' ? 37 : 0);
        if (goldLocation === 'sack') {
            const sack = await addInventoryObject(SACK);
            await addCreatedObjectToContainer(sack, await knownObject(GOLD_PIECE, { quan: 37 }));
        }

        await rhack('p'.charCodeAt(0));

        assert.match(game._pending_message, /You do not owe Ada anything\./);
        if (goldLocation === 'purse') assert.doesNotMatch(game._pending_message, /no gold/);
        else assert.match(game._pending_message, goldLocation === 'sack'
            ? /Moreover, you seem to have no gold\./ : /Moreover, you have no gold\./);
        assert.equal(game.context.move, 1);
        assert.equal(heroGoldAmount(game), goldLocation === 'purse' ? 37 : 0);
    });
}

for (const condition of ['sleeping', 'paralyzed'] as const) {
    void test(`paying an empty bill leaves a ${condition} shopkeeper helpless without spending a turn`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.msleeping = condition === 'sleeping' ? 1 : 0;
        shopkeeper.mcanmove = condition === 'paralyzed' ? 0 : 1;
        shopkeeper.mfrozen = condition === 'paralyzed' ? 5 : 0;
        setHeroGoldAmount(game, 37);

        await rhack('p'.charCodeAt(0));

        assert.equal(game.context.move, 0, 'A helpless shopkeeper cannot receive a payment');
        assert.match(game._pending_message, /^Ada (seems to be napping|doesn't respond)\.$/);
        assert.equal(shopkeeper.msleeping, condition === 'sleeping' ? 1 : 0);
        assert.equal(shopkeeper.mcanmove, condition === 'paralyzed' ? 0 : 1);
        assert.equal(shopkeeper.mfrozen, condition === 'paralyzed' ? 5 : 0);
        assert.equal(heroGoldAmount(game), 37);
    });

    void test(`offering to pay a usage debt rouses a ${condition} shopkeeper and settles the debt`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.eshk.debit = 25;
        shopkeeper.msleeping = condition === 'sleeping' ? 1 : 0;
        shopkeeper.mcanmove = condition === 'paralyzed' ? 0 : 1;
        shopkeeper.mfrozen = condition === 'paralyzed' ? 5 : 0;
        setHeroGoldAmount(game, 100);

        await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(),
            /Ada|pay that debt|Thank you/, 3);

        assert.equal(shopkeeper.msleeping, 0, 'Offering payment should wake the shopkeeper');
        assert.equal(shopkeeper.mcanmove, 1, 'Offering payment should end the paralysis');
        assert.equal(shopkeeper.mfrozen, 0);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(heroGoldAmount(game), 75);
        assert.equal(game.context.move, 1);
    });
}

void test('counted walking into a peaceful shopkeeper pays the merchandise usage debt', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.debit = 25;
    setHeroGoldAmount(game, 100);
    pushKeys('3l' + ' '.repeat(20));
    initRng(1n);

    await rhack(0);

    assert.equal(game.u.ux, 10);
    assert.equal(shopkeeper.mx, 11);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(heroGoldAmount(game), 75);
    assert.equal(game.context.move, 1);
});
