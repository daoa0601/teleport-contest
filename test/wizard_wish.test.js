import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('repeated wizard wishes suppress verbose stack totals and restore verbosity', async () => {
    freshObjectRoom({ flags: { debug: true, verbose: true } });
    requirePlayingGame(game);
    await runExtendedCommand('wizwish', 'rock\n');
    pushKeys('rock\n');
    await rhack(23);
    assert.equal(game.inventory.find(object => object.otyp === ROCK)?.quan, 2);
    assert.equal(game.u.uconduct.wishes, 2);
    assert.doesNotMatch(game._pending_message, /in total/);
    assert.equal(game.flags.verbose, true);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_wish.test.js.map