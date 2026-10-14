import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { shopkeeperName } from '../js/monster_name.js';
import { initRng, rn2 } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const inside of [false, true]) {
    for (const hallucinating of [false, true]) {
        void test(`an empty ${inside ? 'resident' : 'nonresident'} bill names the keeper ${hallucinating ? 'while hallucinating' : 'without its stored prefix'}`, async () => {
            freshObjectRoom();
            const { shopkeeper } = await createStaffedShop({ left: inside ? 8 : 11 });
            shopkeeper.eshk.shknam = '+KeeperControl';
            game.u.hallucinationTurns = hallucinating ? 20 : 0;
            setHeroGoldAmount(game, 37);
            await rhack('p'.charCodeAt(0));
            if (hallucinating) {
                assert.match(game._pending_message, /^You do not owe [A-Za-z].* anything\.$/);
                assert.doesNotMatch(game._pending_message, /KeeperControl/);
            }
            else {
                assert.equal(game._pending_message, 'You do not owe KeeperControl anything.');
            }
            assert.equal(shopkeeper.eshk.shknam, '+KeeperControl');
            assert.equal(heroGoldAmount(game), 37);
            assert.equal(game.context.move, 1);
        });
    }
}
for (const condition of ['asleep', 'paralyzed']) {
    void test(`hallucinated payment names the ${condition} keeper before choosing its response`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.msleeping = condition === 'asleep' ? 1 : 0;
        shopkeeper.mcanmove = condition !== 'paralyzed';
        shopkeeper.mfrozen = condition === 'paralyzed' ? 10 : 0;
        game.u.hallucinationTurns = 20;
        setHeroGoldAmount(game, 37);
        initRng(123n);
        const name = shopkeeperName(shopkeeper, { capitalized: true });
        const response = rn2(2) ? 'seems to be napping' : "doesn't respond";
        initRng(123n);
        await rhack('p'.charCodeAt(0));
        assert.equal(game._pending_message, `${name} ${response}.`);
        assert.equal(shopkeeper.msleeping, condition === 'asleep' ? 1 : 0);
        assert.equal(shopkeeper.mfrozen, condition === 'paralyzed' ? 10 : 0);
        assert.equal(heroGoldAmount(game), 37);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=shop_payment_name.test.js.map