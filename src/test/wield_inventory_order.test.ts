import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ARROW, DAGGER, LONG_SWORD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the wield prompt lists lowercase inventory slots before uppercase slots', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await addInventoryObject(ARROW, { invlet: 'z' });
    await addInventoryObject(LONG_SWORD, { invlet: 'B' });
    const input = resetInputState();
    const wielding = rhack('w'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /\[- azB or \?\*\]/);
    } finally {
        input.feed('\x1b');
        await wielding;
    }
});
