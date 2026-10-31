// C windows.c:decode_mixed() reduces a glyph escape to one showsyms byte
// before tty_putmixed() calls update_topl(). Storage wrapping therefore
// counts the glyph as one column and breaks at the last space that fits.
// tty_putmixed() resets ttyDisplay->mixed after the initial print. A later
// redotoplin() recall sends the stored high-bit glyph byte through putsyms(),
// so the recorder shows a blank in that column instead of the DEC symbol.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { pline } from '../js/pline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a DEC glyph does not count as three columns when storing toplines', async () => {
    await freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const under = `\x0eq\x0f${'x'.repeat(70)} ${'y'.repeat(7)}`;
    input.feed(' ');
    await pline(under);
    const recall = rhack(16);
    try {
        await Promise.race([recall, input.waitUntilBlocked()]);
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(), ` ${'x'.repeat(70)} ${'y'.repeat(7)}`, 'recall keeps all 79 visible columns on one row');
        assert.doesNotMatch(requireScreenRow(1).map(cell => cell.ch).join(''), /--More--/);
    }
    finally {
        input.feed(' ');
        await recall;
    }
});
void test('a wrapped DEC-mixed topline breaks at its last visible column', async () => {
    await freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const mixed = `\x0eq\x0f${'ab '.repeat(30)}`;
    input.feed(' ');
    await pline(mixed);
    const recall = rhack(16);
    try {
        await input.waitUntilBlocked();
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(), ` ${'ab '.repeat(25)}ab`, 'recall fits the last complete word before the terminal edge');
        assert.match(requireScreenRow(1).map(cell => cell.ch).join(''), /^ab ab ab ab\s*--More--/);
    }
    finally {
        input.feed(' ');
        await recall;
    }
});
//# sourceMappingURL=stored_topline_wrap.test.js.map