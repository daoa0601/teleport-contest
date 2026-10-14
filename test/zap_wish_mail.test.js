import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES, WAN_WISHING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a wished mail scroll uses its nonmagical description while unidentified', async () => {
    freshObjectRoom({ flags: { debug: true, verbose: false } });
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_WISHING, { spe: 2 });
    const input = resetInputState();
    input.feed(`${wand.invlet}scroll of mail\n`);
    await rhack('z'.charCodeAt(0));
    const mail = game.inventory.find(object => object.otyp === OBJECT_NAMES.indexOf('mail'));
    assert.ok(mail, 'The wish must grant a mail scroll.');
    assert.equal(game._pending_message, `${mail.invlet} - a stamped scroll.`);
    assert.equal(wand.spe, 1);
});
//# sourceMappingURL=zap_wish_mail.test.js.map