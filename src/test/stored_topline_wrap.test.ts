// C update_topl()'s storage wrap measures screen columns: tty_putmixed()
// folds each DEC-graphics marker pair into a single byte before the line
// reaches update_topl() (win/tty/wintty.c decode_mixed()), so a line whose
// raw marker bytes reach CO but whose visible columns do not must stay
// unwrapped, and a wrapped line breaks at the last space within the
// column budget, not the raw byte budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a DEC glyph does not count as three columns when storing toplines', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    resetInputState();
    const under = `\x0e+\x0f${'x'.repeat(70)} ${'y'.repeat(7)}`;

    await pline(under);

    assert.equal(game._toplines, under,
        '79 visible columns fit the 80-column line and stay unwrapped');
});

void test('a wrapped DEC-mixed topline breaks at its last visible column', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    const mixed = `\x0e+\x0f${'ab '.repeat(30)}`;
    input.feed(' ');

    await pline(mixed);

    assert.equal(game._toplines, `${mixed.slice(0, 80)}\n${mixed.slice(81)}`,
        'the newline replaces the space at visible column 79');
});
