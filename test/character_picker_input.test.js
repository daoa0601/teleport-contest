import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
async function start(moves, choices = '') {
    return await runSegment({
        seed: 25,
        datetime: '20260831120000',
        nethackrc: `OPTIONS=name:Picker,!legacy,!tutorial,pettype:none${choices ? ',' + choices : ''}`,
        moves,
        storage: memoryStorage(),
    });
}
for (const moves of ['q', '\x1b', 'nq', 'n\x1b', 'yq', 'y\x1b']) {
    void test(`character selection can quit with ${JSON.stringify(moves)}`, async () => {
        const engine = await start(moves);
        assert.deepEqual(await engine.runUntilInputNeeded(), { kind: 'stopped' });
        assert.equal(game.moves, 0, 'quitting must not create a level or spend a turn');
        assert.equal(game.level, null);
    });
}
for (const choice of ['*', '@']) {
    void test(`${choice} at the automatic-selection question starts without confirmation`, async () => {
        await start(choice);
        assert.equal(game.moves, 1);
        assert.ok(game.urole);
    });
}
void test('an invalid automatic-selection answer repeats the question', async () => {
    await start('x');
    const heading = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
    assert.match(heading ?? '', /Shall I pick/);
    assert.equal(game.urole, null);
});
void test('rejecting a manual character discards the configured constraints', async () => {
    await start('nhn', 'race:gnome,gender:male,align:neutral');
    const rows = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''));
    assert.ok(rows.some(row => row.includes('Pick a role or profession')));
    assert.ok(rows.some(row => row.includes('a Knight')), 'the new picker permits a formerly incompatible role');
    assert.ok(rows.some(row => row.includes('<role> <race> <gender> <alignment>')));
});
//# sourceMappingURL=character_picker_input.test.js.map