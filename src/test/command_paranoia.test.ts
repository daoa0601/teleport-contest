import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PARANOID_CONFIRM, PARANOID_QUIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const [bits, responses] of [
    [PARANOID_QUIT, '[yes|n] (n)'],
    [PARANOID_QUIT | PARANOID_CONFIRM, '[yes|no]'],
] as const) {
    void test(`quit honors paranoid confirmation ${responses}`, async () => {
        const input = freshTurnRoom({ flags: { paranoia_bits: bits } });
        input.feed('#quit\n');
        const action = rhack(0);
        try {
            await input.waitUntilBlocked();
            const question = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
            assert.ok(question.includes(`Really quit without saving? ${responses}`), question);
        } finally {
            input.feed('\x1b');
            await action;
        }
        assert.equal(game.program_state.gameover, undefined);
        assert.equal(game.context.move, 0);
    });
}
