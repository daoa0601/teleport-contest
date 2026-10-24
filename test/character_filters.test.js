import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
async function start(moves) {
    return await runSegment({
        seed: 27,
        datetime: '20260831120000',
        nethackrc: 'OPTIONS=name:Filtered,!legacy,!tutorial,pettype:none',
        moves,
        storage: memoryStorage(),
    });
}
void test('the second filter page can exclude male characters', async () => {
    await start('n~>M\nky');
    assert.equal(game.moves, 1);
    assert.equal(game.urole?.key, 'knight');
    assert.equal(game.flags.female, true);
});
void test('alignment filters remove roles with no permitted alignment', async () => {
    await start('n~>LN\n');
    const rows = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''));
    assert.ok(rows.some(row => row.includes('a Rogue')));
    assert.equal(rows.some(row => row.includes('a Knight')), false);
    assert.equal(rows.some(row => row.includes('a Healer')), false);
});
void test('cancelling filter edits keeps all races available', async () => {
    await start('n~H\x1bkmy');
    assert.equal(game.moves, 1);
    assert.equal(game.urole?.key, 'knight');
    assert.equal(game.urace?.name, 'human');
});
void test('gender selection can open the filter editor', async () => {
    await start('nk~>M\nky');
    assert.equal(game.moves, 1);
    assert.equal(game.urole?.key, 'knight');
    assert.equal(game.flags.female, true);
});
void test('alignment selection can open the filter editor', async () => {
    await start('nmm~>LN\nmmy');
    assert.equal(game.moves, 1);
    assert.equal(game.urole?.key, 'monk');
    assert.equal(game.initAlignment?.name, 'chaotic');
});
//# sourceMappingURL=character_filters.test.js.map