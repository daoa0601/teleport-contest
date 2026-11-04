import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { OIL_LAMP } from '../js/object_data.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { planInput } from './support/planned-input.js';

// C apply.c:dorub() queues itself and the lamp's letter after wield_tool().
// upstream invent.c:getobj():1825 returns the queued object: "return otmp;",
// without reaching its interactive prompt. Both actions share the unread
// message line, which must still be acknowledged before later prose.
void test('a queued rub keeps the wield message until the combined line is read', async t => {
    const input = freshTurnRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { invlet: 'a' });
    planInput(input, t, [
        { prompt: /# /, keys: 'rub\n' },
        { prompt: /What do you want to rub\?/, keys: lamp.invlet },
        { prompt: /You now wield .*oil lamp\.  Nothing happens\.--More--/, keys: ' ' },
    ]);

    await rhack('#'.charCodeAt(0));
    await rhack(0);
    await flushPendingTopline();

    const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(topline, /You now wield .*oil lamp\.  Nothing happens\./);
    assert.equal(game.uwep, lamp);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, '', 'acknowledging the combined line reads both messages');
});
