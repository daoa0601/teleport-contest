import assert from 'node:assert/strict';
import test from 'node:test';
import { flushPendingTopline, flush_screen, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { strangulationDialogue } from '../js/hero_strangulation.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a fatal countdown warning remains visible after Escape stops ordinary prose', async () => {
    freshObjectRoom();
    const input = resetInputState();
    await plineWithContinuation('An ordinary message.');
    input.feed('\u001b');
    await flushPendingTopline();
    game.u.strangledTurns = 5;

    await strangulationDialogue();
    await flush_screen(1);

    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /breathe|constricted/);
});
