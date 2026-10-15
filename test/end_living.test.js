import assert from 'node:assert/strict';
import test from 'node:test';
import { finishLivingGame } from '../js/end.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
void test('escaping pets use their given names and native companion order', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: 'none' } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const first = await createMonsterAt('little dog', 11, 10);
    const second = await createMonsterAt('kitten', 9, 10);
    first.mtame = second.mtame = 10;
    setMonsterGivenName(first, 'Alpha');
    setMonsterGivenName(second, 'Beta');
    const screens = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
            assert.ok(screens.length < 8, 'Escaping with two pets must finish the summary');
            return 32;
        },
    };
    await finishLivingGame('escaped');
    assert.ok(screens.some(screen => screen.includes('You and Alpha and Beta')), 'The summary must preserve each companion name and native list order');
});
void test('a diagonally adjacent grid bug cannot accompany an escape', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: 'none' } });
    game.iflags.toptenwin = false;
    const bug = await createMonsterAt('grid bug', 11, 11);
    bug.mtame = 10;
    const input = resetInputState();
    input.feed('    ');
    await finishLivingGame('escaped');
    assert.equal(requireGameLevel().monsters.includes(bug), true);
    assert.equal(bug.mx, 11);
    assert.equal(bug.my, 11);
});
void test('ascension pluralizes the final maximum hit point count', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 1 }, flags: { bones: false, disclose: 'none' } });
    game.iflags.toptenwin = false;
    let summary = '';
    const input = resetInputState();
    input.display = {
        async readKey() {
            summary = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(summary, /You were level/, 'Ascension should reach its summary page');
            return 32;
        },
    };
    await finishLivingGame('ascended');
    assert.match(summary, /a maximum of 1 hit point when you ascended\./);
});
//# sourceMappingURL=end_living.test.js.map