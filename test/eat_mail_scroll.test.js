import test from 'node:test';
import assert from 'node:assert/strict';
import { NOT_HUNGRY } from '../js/const.js';
import { doeat } from '../js/eat.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('consuming one mail scroll provides no nutrition and reports unsatisfying junk mail', async () => {
    freshObjectRoom({ hero: { uhunger: 200, uhs: NOT_HUNGRY } });
    requirePlayingGame(game);
    installPolymorphedHero('fire elemental');
    const mail = await addInventoryObject(OBJECT_NAMES.indexOf('mail'), { quantity: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /junk mail|Needs salt/, limit: 3 });
    input.feed(mail.invlet);
    await doeat();
    assert.equal(game.u.uhunger, 200);
    assert.equal(mail.quantity, 1);
    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game._lastPlineMessage, 'This junk mail is less than satisfying.');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=eat_mail_scroll.test.js.map