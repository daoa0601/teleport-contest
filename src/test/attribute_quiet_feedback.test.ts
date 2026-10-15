import test from 'node:test';
import assert from 'node:assert/strict';
import { A_WIS, ALTAR, Align2amask } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { kickDirection } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('altar wrath omits an unchanged Wisdom message when verbosity is off', async () => {
    const level = freshPlayableRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const altar = level.requireAt(11, 10);
    altar.typ = ALTAR;
    altar.flags = Align2amask(game.u.ualign.type);
    game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 3;
    const messages: string[] = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };

    await kickDirection('l', ' '.repeat(30));

    messages.push(game._pending_message);
    assert.equal(game.u.ualign.record, 9);
    assert.doesNotMatch(messages.join('\n'), /as foolish as you can get/);
});
