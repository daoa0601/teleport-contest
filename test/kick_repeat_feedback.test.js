import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { clearMessageWindow } from '../js/display.js';
import { rhack } from '../js/cmd.js';
import { pushKeys, queueCommandKeys, resetInputState } from '../js/input.js';
import { CLUB } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a queued object kick omits its repeated announcement without asking for a direction', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 18;
    const club = await floorObject(CLUB, 11, 10, { initialize: false });
    await kickDirection('l');
    assert.match(game._pending_message, /You kick/);
    game.u.ux = club.ox - 1;
    resetInputState();
    clearMessageWindow();
    queueCommandKeys('l');
    pushKeys(' '.repeat(10));
    await rhack(4);
    assert.match(game._pending_message, /Thump!/);
    assert.doesNotMatch(game._pending_message, /You kick/);
});
//# sourceMappingURL=kick_repeat_feedback.test.js.map