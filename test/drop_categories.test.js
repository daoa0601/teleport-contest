import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_COMBINATION, PARANOID_AUTOALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const response of ['', ' ', 'A']) {
    void test(`combination drop with no category (${JSON.stringify(response)}) returns when Autoall is disabled`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_COMBINATION, paranoia_bits: 0 } });
        const dagger = await addInventoryObject(DAGGER);
        const input = resetInputState();
        input.feed(`${response}\n`);
        const action = rhack('D'.charCodeAt(0));
        try {
            const completed = await Promise.race([
                action.then(() => true), input.waitUntilBlocked().then(() => false),
            ]);
            assert.equal(completed, true, 'an empty filter must finish without requesting another key');
            assert.equal(game.context.move, 0);
            assert.equal(dagger.where, 'inventory');
        }
        finally {
            if (input.isBlocked)
                input.feed('\x1b');
            await action;
        }
        const startX = game.u.ux;
        input.feed('l');
        await rhack(0);
        assert.equal(game.u.ux, startX + 1, 'the next key remains a movement command');
    });
}
for (const [response, paranoia] of [['', PARANOID_AUTOALL], ['m', 0]]) {
    void test(`combination drop allows all items for ${response === 'm' ? 'an explicit menu request' : 'an empty filter with Autoall enabled'}`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_COMBINATION, paranoia_bits: paranoia, verbose: false } });
        const dagger = await addInventoryObject(DAGGER);
        resetInputState().feed(`${response}\n${dagger.invlet}\n`);
        await rhack('D'.charCodeAt(0));
        assert.equal(dagger.where, 'floor');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=drop_categories.test.js.map