import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

void test('mail offers reading without promising to activate magic', async t => {
    freshObjectRoom();
    const mail = await addInventoryObject(OBJECT_NAMES.indexOf('mail'));
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Scrolls/, keys: mail.invlet },
        { prompt: /r - Read this scroll\s*\n/, keys: '\x1b' },
    ]);

    await rhack('i'.charCodeAt(0));

    assert.equal(game.context.move, 0);
});
