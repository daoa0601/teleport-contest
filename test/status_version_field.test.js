import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('the optional native version is right justified before the unused last column', async () => {
    freshObjectRoom({ hero: { uhs: 1 } });
    applyNethackrc('OPTIONS=showvers,versinfo:1');
    await bot();
    const row = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.equal(row.slice(74), '5.0.0 ');
});
void test('versinfo can show the game name and number together', async () => {
    freshObjectRoom({ hero: { uhs: 1 } });
    applyNethackrc('OPTIONS=showvers,versinfo:3');
    await bot();
    assert.ok(requireScreenRow(23).map(cell => cell.ch).join('').endsWith('nethack 5.0.0 '));
    game.flags.showvers = false;
    await bot();
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /5\.0\.0/);
});
//# sourceMappingURL=status_version_field.test.js.map