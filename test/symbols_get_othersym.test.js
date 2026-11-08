import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentBoulderSymbol } from '../js/symbols.js';
import { freshObjectRoom } from './support/object-room.js';
// symbols.c:get_othersym() resolves the boulder glyph from the shown set:
// the set's override, else the default rock-class symbol. The boulder
// option fills both sets' slots, the Blank rogue set replaces every
// symbol, and an unnamed Rogue set keeps the plain rogue default.
void test('the boulder lookup reads the shown set override and falls back to rock', async () => {
    await freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    assert.equal(currentBoulderSymbol(), '`', 'no override shows the rock-class symbol');
    game.boulderSym = '9';
    assert.equal(currentBoulderSymbol(), '9', 'the primary override wins off Rogue');
    game.shownSymbols = { rogue: true, name: null };
    assert.equal(currentBoulderSymbol(), '`', 'an unnamed Rogue set keeps the rogue default');
    game.rogueBoulderSym = '*';
    assert.equal(currentBoulderSymbol(), '*', 'the boulder option reaches the Rogue set slot');
    game.rogueBoulderSym = '';
    game.shownSymbols = { rogue: true, name: 'blank' };
    // dat/symbols:77 fills S_boulder with \032, and options.c escapes()
    // reads a bare \nnn as DECIMAL — a space, not C-style octal 0x1a
    // (octal needs the \o prefix).
    assert.equal(currentBoulderSymbol(), ' ', 'the Blank set blanks the boulder too');
});
//# sourceMappingURL=symbols_get_othersym.test.js.map