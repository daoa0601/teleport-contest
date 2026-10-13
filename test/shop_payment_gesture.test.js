import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { withMessagePages } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';
for (const keeper of ['giant eel', 'shopkeeper']) {
    void test(`a ${keeper} gestures to reject buying a partly used stack before its used portion`, async () => {
        freshObjectRoom();
        const daggers = await addInventoryObject(DAGGER, { quan: 2 });
        const { shopkeeper } = await createStaffedShop({ bill: [
                { bo_id: daggers.o_id, bquan: 3, price: 4, useup: false },
            ] });
        daggers.unpaid = true;
        shopkeeper.mnum = MONSTER_NAME.indexOf(keeper);
        shopkeeper.eshk.shknam = 'Ada';
        // Eels cannot speak; deafness forces the human keeper to gesture too.
        game.u.deafTurns = keeper === 'shopkeeper' ? 20 : 0;
        setHeroGoldAmount(game, 8);
        const input = resetInputState();
        input.feed('b\n');
        await withMessagePages(() => rhack('p'.charCodeAt(0)), input, /other dagger/, 2);
        assert.match(game._pending_message, keeper === 'giant eel'
            ? /Ada motions to your bill for the other dagger first\./
            : /Ada points out your bill for the other dagger first\./);
        assert.equal(game.context.move, 0);
        assert.equal(heroGoldAmount(game), 8);
        assert.equal(daggers.unpaid, true);
        assert.equal(shopkeeper.eshk.billct, 1);
    });
}
//# sourceMappingURL=shop_payment_gesture.test.js.map