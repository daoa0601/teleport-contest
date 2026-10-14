import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
for (const situation of ['deaf', 'invisible', 'deaf robbed', 'deaf surcharge', 'deaf angry']) {
    void test(`shop entry gives its native feedback to a ${situation} customer`, async () => {
        freshObjectRoom({ left: 3, hero: { ux: 7, uy: 10 } });
        const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.female = true;
        shopkeeper.eshk.customer = game.plname;
        shopkeeper.eshk.visitct = 1;
        game.u.deafTurns = situation.startsWith('deaf') ? 10 : 0;
        game.u.invis = situation === 'invisible';
        let expected;
        switch (situation) {
            case 'deaf':
                expected = /You enter Ada's general store again!/;
                break;
            case 'invisible':
                expected = /Invisible customers are not welcome!/;
                break;
            case 'deaf robbed':
                shopkeeper.eshk.robbed = 25;
                expected = /Ada is combing through her inventory list\./;
                break;
            case 'deaf surcharge':
                shopkeeper.eshk.surcharge = true;
                expected = /The atmosphere at Ada's general store seems unwelcoming\./;
                break;
            case 'deaf angry':
                shopkeeper.mpeaceful = 0;
                expected = /Ada seems (quite upset|ticked off|furious) over your return to her general store!/;
                break;
        }
        await withMessagePages(() => rhack('l'.charCodeAt(0)), resetInputState(), /presence|welcome|inventory|return/, 2);
        assert.match(game._pending_message, expected);
        assert.equal(game.u.ux, 8);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=shop_entry_feedback.test.js.map