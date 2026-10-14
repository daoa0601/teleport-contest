import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { STRAT_CLOSE, STRAT_WAITFORU, STRAT_WAITMASK } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const condition of ['responsive', 'asleep', 'paralyzed']) {
    void test(`deaf chat ${condition === 'responsive' ? 'rouses' : 'does not rouse'} a ${condition} waiting shopkeeper`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.mstrategy = STRAT_CLOSE | STRAT_WAITFORU;
        if (condition === 'asleep')
            shopkeeper.msleeping = 1;
        if (condition === 'paralyzed')
            shopkeeper.mcanmove = 0;
        game.u.deafTurns = 20;
        resetInputState().feed('chat\nl');
        await rhack('#'.charCodeAt(0));
        assert.equal((shopkeeper.mstrategy ?? 0) & STRAT_WAITMASK, condition === 'responsive' ? 0 : STRAT_CLOSE | STRAT_WAITFORU);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, condition === 'responsive' ? /falls on deaf ears\./ : /seems not to notice you\./);
    });
}
//# sourceMappingURL=shop_chat_waiting.test.js.map