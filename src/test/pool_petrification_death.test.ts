import { advanceHeroPetrification } from './support/condition-turn.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';

import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('the final petrification stage offers an explorer recovery after its statue announcement', async () => {
    freshObjectRoom({ flags: { explore: true }, hero: { stonedTurns: 1, stoned: true } });
    const input = resetInputState();
    const messages: string[] = [];
    input.display = { async readKey() {
        const text = requireScreenRow(0).map(cell => cell.ch).join('');
        messages.push(text);
        return text.includes('Die?') ? 110 : 32;
    } };

    await advanceHeroPetrification({ publish: plineWithContinuation });

    assert.match(messages.join('\n'), /Die\? \[yn\] \(n\)/);
    assert.doesNotMatch(messages.join('\n'), /You die/);
    assert.equal(game.u.stonedTurns, 0);
});
