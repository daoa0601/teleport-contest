import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('command help leaves a space between its question and the typed response', async () => {
    freshObjectRoom();
    const input = resetInputState();
    let asked = false;
    input.beforeRead = () => {
        const question = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
        if (question === 'What command?') {
            assert.equal(requireGameDisplay().cursorCol, 'What command? '.length);
            asked = true;
            input.feed('i');
        } else input.feed(' ');
    };

    await rhack('&'.charCodeAt(0));

    assert.equal(asked, true);
});
