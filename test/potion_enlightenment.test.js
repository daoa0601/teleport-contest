import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { A_INT, A_WIS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_ENLIGHTENMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
// potion.c peffect_enlightenment(): a blessed potion raises Intelligence and
// Wisdom through adjattrib() before do_enlightenment_effect(); every message
// shares the tty top line until it needs --More--.
void test('a blessed enlightenment potion reports its attribute gains before self-knowledge', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.u.acurr.a[A_INT] = game.u.amax.a[A_INT] = 10;
    game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 10;
    const potion = await addInventoryObject(POT_ENLIGHTENMENT, { blessed: true });
    const input = resetInputState();
    input.feed(potion.invlet);
    const quaffing = rhack('q'.charCodeAt(0));
    await input.waitUntilBlocked();
    const topline = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    input.feed(' '.repeat(10));
    await quaffing;
    assert.equal(topline, 'You feel smart!  You feel wise!  You feel self-knowledgeable...--More--');
    assert.equal(game.u.acurr.a[A_INT], 11);
    assert.equal(game.u.acurr.a[A_WIS], 11);
});
//# sourceMappingURL=potion_enlightenment.test.js.map