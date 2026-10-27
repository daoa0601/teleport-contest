import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a repeated engraving reports a rejected inventory count before waiting for another choice', async () => {
    const input = freshTurnRoom();
    input.feed('E- X\r');
    await rhack(0);
    input.feed('\x014');
    const repeating = rhack(0);
    await input.waitUntilBlocked();
    try {
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(), 'No count allowed with this command.');
    }
    finally {
        input.feed('\x1b');
        await repeating;
    }
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_count_rejection.test.js.map