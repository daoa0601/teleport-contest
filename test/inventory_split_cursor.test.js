import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the split count cursor follows the digits and the empty count after erasing them', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 40 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /I - Adjust inventory by splitting this stack/, keys: 'I' },
    ]);
    const splitting = rhack(0);
    try {
        await input.waitUntilBlocked();
        input.feed('3');
        for (const { text, key } of [
            { text: 'Count: 3', key: '2' },
            { text: 'Count: 32', key: '\b' },
            { text: 'Count: 3', key: '\b' },
            { text: 'Count: ', key: '\x1b' },
        ]) {
            await input.waitUntilBlocked();
            const display = requireGameDisplay();
            const message = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
            assert.ok(message.startsWith(text), `expected split count ${JSON.stringify(text)}`);
            assert.equal(display.cursorRow, 0);
            assert.equal(display.cursorCol, text.length, `cursor after ${JSON.stringify(text)}`);
            input.feed(key);
        }
    }
    finally {
        input.feed('\x1b');
        await splitting;
    }
});
//# sourceMappingURL=inventory_split_cursor.test.js.map