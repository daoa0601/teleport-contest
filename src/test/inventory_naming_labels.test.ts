import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { ARROW, FORTUNE_COOKIE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('the item action prompt describes the full arrow stack', async () => {
    freshObjectRoom();
    const arrows = await addInventoryObject(ARROW, { quan: 4 });
    const input = resetInputState();
    let title = '';
    input.beforeRead = () => {
        const row = requireScreenRow(0).map(cell => cell.ch).join('').trim();
        if (row.startsWith('Do what with')) title = row;
    };

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: arrows.invlet },
        { prompt: /Do what with/, keys: '\x1b' },
    ]);

    assert.equal(title, 'Do what with the arrows?');
});

void test('the item action prompt describes the full fortune cookie stack', async () => {
    freshObjectRoom();
    const cookies = await addInventoryObject(FORTUNE_COOKIE, { quan: 3 });
    const input = resetInputState();

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Comestibles/, keys: cookies.invlet },
        { prompt: /Do what with the fortune cookies\?/, keys: '\x1b' },
    ]);

    assert.equal(cookies.quan, 3);
});

for (const quantity of [1, 4]) {
    void test(`the naming action describes ${quantity === 1 ? 'one arrow' : 'a stack of arrows'}`, async () => {
        freshObjectRoom();
        const arrows = await addInventoryObject(ARROW, { quan: quantity });
        const input = resetInputState();
        let namingLabel = '';
        input.beforeRead = () => {
            for (let row = 0; row < 14; row++) {
                const text = requireScreenRow(row).map(cell => cell.ch).join('');
                if (text.includes('c - ')) namingLabel = text.trim();
            }
        };
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: arrows.invlet },
            { prompt: /Do what with/, keys: '\x1b' },
        ]);

        assert.equal(namingLabel, quantity === 1
            ? 'c - Name this specific arrow'
            : 'c - Name this stack of arrows');
    });
}
