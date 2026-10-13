import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ddoinv } from '../js/invent.js';
import { SACK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a carried sack offers opening through its inventory action menu', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const input = resetInputState();
    input.feed(sack.invlet);
    const menu = ddoinv();
    await input.waitUntilBlocked();
    try {
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /a - Open this container/);
    } finally {
        input.feed('\x1b');
        await menu;
    }
});

void test('the inventory opening action applies the selected sack after its menu closes', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Tools/, keys: sack.invlet },
        { prompt: /a - Open this container/, keys: 'a' },
    ]);

    await answerPrompts(rhack(0), input, [
        { prompt: /The bag is empty\.  Do what with it\?/, keys: 'q' },
    ]);

    assert.equal(sack.cknown, true);
    assert.equal(game.inventory.includes(sack), true);
});
