import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { bot } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { fullyIdentifyObject } from '../js/invent.js';
import { luaText } from '../js/lua/messages.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function screenRow(row: number): string {
    return requireScreenRow(row).map(cell => cell.ch).join('').trimEnd();
}

for (const lineCount of [22, 28]) {
    void test(`dismissing a ${lineCount}-line Lua text menu leaves covered status rows blank`, async () => {
        freshObjectRoom();
        await bot();
        assert.match(screenRow(22), /St:/);
        assert.match(screenRow(23), /Satiated/);
        const input = resetInputState();

        // nh.text uses select_menu(), including when no entries are selectable.
        const text = luaText(Array.from({ length: lineCount }, (_, index) =>
            `The runes describe a doorway on the current level: ${index + 1}\n`).join(''));
        try {
            await input.waitUntilBlocked();
            assert.match(screenRow(0), /The runes describe a doorway/);
            assert.doesNotMatch(screenRow(22), /St:/);
        } finally {
            input.feed('\x1b');
            await text;
        }

        assert.doesNotMatch(screenRow(22), /St:/,
            `status row 0 after dismissal: ${JSON.stringify(screenRow(22))}`);
        assert.doesNotMatch(screenRow(23), /Satiated/,
            `status row 1 after dismissal: ${JSON.stringify(screenRow(23))}`);
        if (lineCount === 22) {
            assert.match(screenRow(22), /^Hero the Wanderer/);
            assert.match(screenRow(23), /HP:40\(40\)/);
        } else {
            assert.equal(screenRow(22), '');
            assert.equal(screenRow(23), '');
        }
    });
}

void test('dismissing wizard identify for identified items defers the status redraw', async () => {
    freshObjectRoom({ flags: { debug: true, menu_overlay: false } });
    fullyIdentifyObject(await addInventoryObject(DAGGER));
    await bot();
    assert.match(screenRow(22), /St:/);
    const input = resetInputState();

    const identifying = rhack(9);
    try {
        await input.waitUntilBlocked();
        assert.match(screenRow(0), /Debug Identify/);
        assert.match(screenRow(1), /all items are permanently identified already/);
    } finally {
        input.feed('\x1b');
        await identifying;
    }

    assert.equal(screenRow(22), '', 'select_menu leaves status row 0 blank');
    assert.equal(screenRow(23), '', 'select_menu leaves status row 1 blank');
});
