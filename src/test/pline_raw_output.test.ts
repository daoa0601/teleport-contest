import assert from 'node:assert/strict';
import test from 'node:test';
import { rawPrintf } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('raw formatted output keeps the beginning of oversized text without an ellipsis', () => {
    freshPlayableRoom();

    rawPrintf('A warning begins.\n'
        + ('The warning continues. '.repeat(2) + '\n').repeat(7) + 'Discarded ending.');

    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(text, /^A warning begins\./);
    assert.doesNotMatch(text, /Discarded ending|\.\.\./);
});

void test('a NUL terminates raw formatted output', () => {
    freshPlayableRoom();

    rawPrintf('A warning.\0A hidden suffix.');

    const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(text, /^A warning\./);
    assert.doesNotMatch(text, /hidden suffix/);
});
