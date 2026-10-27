import assert from 'node:assert/strict';
import test from 'node:test';
import { docrt, flush_screen } from '../js/display.js';
import { makeWish } from '../js/wish.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
async function hallucinatingWishRoom() {
    const input = freshTurnRoom({
        flags: { verbose: false, cmdassist: true }, hero: { hallucinationTurns: 20 },
    });
    await createMonsterAt('newt', 12, 10);
    await docrt();
    await flush_screen(1);
    return input;
}
void test('closing wish help gives a visible monster one fresh hallucinated appearance', async () => {
    await hallucinatingWishRoom();
    // Native text dismissal performs one complete redraw of the live view.
    await docrt();
    await flush_screen(1);
    const { ch, color } = requireScreenCell(11, 11);
    const input = await hallucinatingWishRoom();
    input.feed('help\n');
    const wishing = makeWish();
    try {
        await input.waitUntilBlocked();
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /^Wish details:/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /For what do you wish/);
        assert.equal(requireScreenCell(11, 11).ch, ch, 'the help caller must preserve the monster restored by text dismissal');
        assert.equal(requireScreenCell(11, 11).color, color, 'the restored hallucination color must also survive the next wish prompt');
    }
    finally {
        input.feed('nothing\n');
        await wishing;
    }
});
//# sourceMappingURL=wish_help_redraw.test.js.map