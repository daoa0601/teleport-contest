import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const form of ['human', 'dog']) {
    void test(`deaf shop chat describes hearing in a ${form} body`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        if (form === 'dog')
            installPolymorphedHero('dog');
        game.u.deafTurns = 20;
        resetInputState().feed('chat\nl');
        await rhack('#'.charCodeAt(0));
        assert.equal(game._pending_message, form === 'human'
            ? 'Any response from Ada falls on deaf ears.' : 'Any response from Ada is inaudible.');
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=shop_chat_deaf_form.test.js.map