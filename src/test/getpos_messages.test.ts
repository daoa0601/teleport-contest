import assert from 'node:assert/strict';
import test from 'node:test';

import { selectMapPosition } from '../js/getpos.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a long targeting goal uses the message pager when highlighting restores the prompt', async () => {
    freshObjectRoom();
    const goal = 'the staircase beyond the fountain and the altar at the far end of the unexplored room';
    const input = resetInputState();
    input.feed('$');

    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal,
    }), input, [
        { prompt: /Move cursor to the staircase[\s\S]*--More--/, keys: ' ' },
        { prompt: /Move cursor to the staircase/, keys: '.' },
    ]);

    assert.equal(selected?.x, 10);
});
