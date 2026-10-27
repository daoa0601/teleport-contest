import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('untrap leaves a rejected direction visible and spends no time', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=number_pad:-1,!cmdassist');
    pushKeys('u\ny');
    await rhack('#'.charCodeAt(0));
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /^What a strange direction!/);
    assert.equal(game.context.move, 0);
});
void test('cancelling an untrap direction leaves no error and spends no time', async () => {
    freshObjectRoom();
    pushKeys('untrap\n\x1b');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=untrap_direction_message.test.js.map