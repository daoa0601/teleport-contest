import assert from 'node:assert/strict';
import test from 'node:test';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { showDisclosureOverlay, showTextWindow } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('an empty text window still waits at its bottom-row More prompt', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const window = showTextWindow([]);
    try {
        const state = await Promise.race([window.then(() => 'closed'), input.waitUntilBlocked().then(() => 'waiting')]);
        assert.equal(state, 'waiting');
        assert.equal(requireGameDisplay().cursorRow, 23);
        assert.equal(requireGameDisplay().cursorCol, 8);
    } finally {
        input.feed(' ');
        await window;
    }
});

void test('a corner text-backed menu ignores ordinary keys at More', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const window = showDisclosureOverlay(['No creatures have died.']);
    try {
        await input.waitUntilBlocked();
        input.feed('x');
        const state = await Promise.race([window.then(() => 'closed'), input.waitUntilBlocked().then(() => 'waiting')]);
        assert.equal(state, 'waiting');
    } finally {
        input.feed(' ');
        await window;
    }
});

void test('tty text output compresses spaces in long lines before wrapping', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const window = showTextWindow(['     The   passage   continues   to   a   chamber   full   of   old   maps   and   scrolls.']);
    try {
        await input.waitUntilBlocked();
        const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
        assert.equal(text, 'The passage continues to a chamber full of old maps and scrolls.');
    } finally {
        input.feed(' ');
        await window;
    }
});
