import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_NOVEL } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('Death recognizes a carried Discworld novel and speaks without quotation marks', async () => {
    freshObjectRoom();
    await createMonsterAt('Death', 11, 10);
    await addInventoryObject(SPE_NOVEL, { novelidx: 0 });
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await runExtendedCommand('chat', 'l');

    assert.equal(game._lastPlineMessage, 'AH, SO YOU HAVE A COPY OF /THE COLOUR OF MAGIC/.  I MAY HAVE BEEN MISQUOTED THERE.');
    assert.equal(game.context.move, 1);
});
