import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a native involuntary multi-turn delay can display the optional Busy condition', async () => {
    freshObjectRoom();
    game.multi = -2;
    applyNethackrc('OPTIONS=cond_busy');
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bBusy\b/);
});
void test('an unconscious native delay shows Out instead of the optional Busy condition', async () => {
    freshObjectRoom();
    game.multi = -2;
    game._helplessDoneMessage = 'You regain consciousness.';
    applyNethackrc('OPTIONS=cond_unconscious,cond_busy');
    await bot();
    const row = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(row, /\bOut\b/);
    assert.doesNotMatch(row, /\bBusy\b/);
});
//# sourceMappingURL=status_busy_delay.test.js.map