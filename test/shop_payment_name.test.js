import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
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
//# sourceMappingURL=shop_payment_name.test.js.map