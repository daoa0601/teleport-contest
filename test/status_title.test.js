import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function titleRow() {
    return requireScreenRow(22).map(cell => cell.ch).join('');
}
void test('a long hero name is shortened to keep the rank and attribute columns', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 30 } });
    game.plname = 'abcdefghijklmnopqrstuv';
    game.displayName = 'Abcdefghijklmnopqrstuv';
    await bot();
    assert.ok(titleRow().startsWith('Abcdefghijklmnopqrstu the Mage'));
    assert.equal(titleRow().indexOf('St:'), 31);
});
void test('monster titles use body gender and capitalize only after spaces', async () => {
    freshObjectRoom({ hero: { umonnum: 268, mfemale: true, mtimedone: 50 } });
    game.plname = 'alice';
    game.displayName = 'Alice';
    await bot();
    assert.ok(titleRow().startsWith('Alice the Elf-lady'));
});
void test('a monster body still supplies its title and hit dice at timeout zero', async () => {
    freshObjectRoom({ hero: { umonnum: 0, mtimedone: 0, mh: 3, mhmax: 8 } });
    await bot();
    assert.match(titleRow(), /the Giant Ant/);
    const healthRow = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(healthRow, /HP:3\(8\).*HD:2/);
    assert.doesNotMatch(healthRow, /Xp:/);
});
void test('an absent rank uses the nearest lower rank before the role name', async () => {
    freshObjectRoom({ hero: { ulevel: 10 } });
    requirePlayingGame(game);
    const titles = game.urole.title.slice();
    titles[3] = { m: '', f: '' };
    game.urole = { ...game.urole, title: titles };
    await bot();
    assert.match(titleRow(), /the Wanderer/);
});
//# sourceMappingURL=status_title.test.js.map