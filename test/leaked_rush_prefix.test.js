import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { RING_MAIL } from '../js/object_data.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
// C cmd.c: a 'G' (run) prefix followed by an unbound key leaves
// gd.domove_attempting's DOMOVE_RUSH bit set; rhack()'s unknown-command
// tail only clears context.move, multi, and the command queues.  The
// leaked rush attempt survives arbitrary later commands, and the next
// movement key dispatches through the DOMOVE_RUSH branch of rhack()
// even after nomul() has zeroed context.run: the hero starts a run
// (multi = max(COLNO, ROWNO)) whose steps continue until a move fails.
void test('a run prefix followed by an unknown key keeps a rush pending across a donning delay', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const mail = await addInventoryObject(RING_MAIL, { known: false });
    // 'G' queues the run prefix; '%' is unbound, so the dispatch reports
    // an unknown command and returns without consuming the attempt.
    input.feed('%');
    await rhack('G'.charCodeAt(0));
    assert.match(game._pending_message ?? '', /Unknown command '%'\./);
    // Wearing the ring mail starts a multi-turn dressing delay whose
    // nomul() ends running but must not clear the pending rush attempt.
    input.feed(`${mail.invlet}                    `);
    await rhack('W'.charCodeAt(0));
    for (let turn = 0; turn < 40 && !mail.known; turn++)
        await moveloop_core();
    assert.equal(mail.known, true, 'the dressing maneuver finishes');
    const movesBefore = game.moves;
    const yBefore = game.u.uy;
    // Drop any --More-- dismissal keys the pager did not consume so the
    // probe reads exactly one movement key.
    const probeInput = resetInputState();
    probeInput.feed('k');
    for (let turn = 0; turn < 6; turn++) {
        await moveloop_core();
        if (game.multi === 0)
            break;
    }
    assert.equal(game.u.uy, yBefore - 2, 'the leaked rush runs the hero two squares north before the wall');
    assert.equal(game.moves, movesBefore + 2, 'each automatic run square takes its own turn');
    assert.equal(game.multi, 0, 'the refused step into the wall ends the run');
});
//# sourceMappingURL=leaked_rush_prefix.test.js.map