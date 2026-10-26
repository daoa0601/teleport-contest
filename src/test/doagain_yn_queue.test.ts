import assert from 'node:assert/strict';
import test from 'node:test';

import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { promptChoice } from '../js/query.js';
import { freshObjectRoom } from './support/object-room.js';

// C cmd.c:yn_function() records a real-input answer into CQ_REPEAT even
// while in_doagain is set, and cmdq_pop() then reads CQ_REPEAT for the next
// question. A death during a ^A replay leaves in_doagain set through the
// end-of-game disclosure, so the typed answer to one disclosure question
// silently answers the following one.
void test('a question answered during do-again feeds the next question', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    game._inDoAgain = true;
    game._repeatCommands = [];
    try {
        const input = resetInputState();
        const first = promptChoice('First question?', ['y', 'n'] as const, 'n');
        await input.waitUntilBlocked();
        input.feed('n');
        assert.equal(await first, 'n');

        const second = promptChoice('Second question?', ['y', 'n'] as const, 'n');
        // If the record was dropped, the prompt blocks for input; the input
        // layer's block signal is the deterministic witness for that state.
        const outcome = await Promise.race([
            second.then(() => 'answered' as const),
            input.waitUntilBlocked().then(() => 'blocked' as const),
        ]);
        if (outcome === 'blocked') input.feed('n');
        assert.equal(outcome, 'answered',
            'The recorded answer must satisfy the next question without new input');
        assert.equal(await second, 'n');
    } finally {
        game._inDoAgain = false;
        game._repeatCommands = [];
    }
});
