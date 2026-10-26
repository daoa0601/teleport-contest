import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { TT_BEARTRAP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('an extended-command prompt allows the bear-trap warning to be shown again', async () => {
    const input = freshTurnRoom({ hero: { utrap: 10, utraptype: TT_BEARTRAP } });
    await rhack('u'.charCodeAt(0));
    input.feed('#\x1b');
    await rhack(0);

    await rhack('u'.charCodeAt(0));
    await flush_screen(1);

    const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(message, 'You are caught in a bear trap.');
});
