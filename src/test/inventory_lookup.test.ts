import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { KATANA } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory lookup shows the selected weapon information and consumes its letter', async () => {
    freshObjectRoom();
    const katana = await addInventoryObject(KATANA, { quan: 2 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: katana.invlet },
        { prompt: /Do what with the katana\?/, keys: '/' },
    ]);

    await answerPrompts(rhack(0), input, [
        { prompt: /samurai/i, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
    input.feed('s');
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.context.move, 1);
});
