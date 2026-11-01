import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { GRAPPLING_HOOK } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/wield.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('cancelling grappling targeting leaves no command available to repeat', async () => {
    const input = freshTurnRoom({ flags: { tips: false, verbose: false } });
    const hook = await addInventoryObject(GRAPPLING_HOOK);
    await setPrimaryWeapon(hook);
    game._travelTipShown = true;

    await applyInventoryObject(hook, '\x1b');
    input.feed('\x01\x1b');
    await rhack(0);

    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
