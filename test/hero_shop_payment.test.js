import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
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
//# sourceMappingURL=hero_shop_payment.test.js.map