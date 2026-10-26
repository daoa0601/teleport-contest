import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { listVanquished } from '../js/end.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { requireScreenRow } from './support/screen.js';
// C insight.c:dovanquished() -> list_vanquished('A'): the 'm' command prefix
// offers the sort-order menu even when only one species (or none) was
// vanquished; a plain #vanquished with one species shows no such menu.
void test("'m #vanquished' picks the sort order before a single-species list", async (t) => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const newt = MONSTER_NAME.indexOf('newt');
    game.mvitals ??= [];
    game.mvitals[newt] = { born: 1, died: 1, mvflags: 0 };
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Sort order for vanquished monster counts/, keys: 't' },
        { prompt: /Vanquished creatures:/, keys: ' ' },
    ]);
    pushKeys('#vanquished\n');
    await rhack('m'.charCodeAt(0));
    assert.equal(game.flags.vanqSortmode, 0);
});
void test("'m #vanquished' still picks a sort order with nothing vanquished", async (t) => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Sort order for vanquished monster counts/, keys: 't' },
    ]);
    await listVanquished('A');
    assert.equal(game._pending_message, 'No creatures have been vanquished.');
});
// C list_vanquished(): a plain #vanquished with nothing killed pline()s the
// present-tense notice and leaves it on the topl; the disclosure window path
// replaces the topl, but this branch never opens one.
void test('plain #vanquished with nothing vanquished announces it on the topl', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('vanquished\n');
    await rhack('#'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(game._pending_message, 'No creatures have been vanquished.');
    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), 'No creatures have been vanquished.');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=vanquished_sort_menu.test.js.map