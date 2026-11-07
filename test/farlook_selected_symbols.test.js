import assert from 'node:assert/strict';
import test from 'node:test';
import { displaySelf, flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { ALTAR } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { serializeCapture } from '../js/jsmain.js';
import { applyNethackrc } from '../js/cfgfiles.js';
import { POT_HEALING } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { farlookText } from './support/farlook.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('farlook identifies the potion class through the RogueIBM symbol', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:RogueIBM');
    await floorObject(POT_HEALING, 11, 10);
    await newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '\xad');
    const text = await farlookText('l.');
    assert.match(text, /a potion \(/, text);
});
// win/tty/topl.c's putmixed kludge keeps the leading glyph on the physical
// row through g_putch(), so a full-screen rebuild (_buildScreenOutput)
// repaints the message row with the DEC glyph still inside its shift.
void test('a flushed DEC farlook description keeps its glyph shift on the message row', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    level.requireAt(11, 10).typ = ALTAR;
    await newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '\u03c0', 'the altar shows the DEC glyph');
    const input = resetInputState();
    input.feed('l.');
    input.display = { async readKey() { return ' '.charCodeAt(0); } };
    await rhack(';'.charCodeAt(0));
    await flush_screen(1);
    const row = serializeCapture(requireGameDisplay()).split('\n')[0] ?? '';
    assert.ok(row.includes('\x0e{\x0f'), `the message-row glyph keeps its alternate-font shift: ${JSON.stringify(row)}`);
});
void test('farlook identifies the human class through the RogueEpyx hero symbol', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:RogueEpyx');
    await displaySelf();
    await flush_screen(1);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '\x01');
    const text = await farlookText('.');
    assert.match(text, /a human or elf/, text);
});
//# sourceMappingURL=farlook_selected_symbols.test.js.map