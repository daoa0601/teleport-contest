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
void test('role choices check race and alignment filters independently', async () => {
    await start('n~HEGO>L\n');
    const rows = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''));
    assert.ok(rows.some(row => row.includes('a - an Archeologist')), 'Archeologist permits dwarf and an unfiltered alignment independently');
    assert.ok(rows.some(row => row.includes('c - a Caveman/Cavewoman')));
    assert.ok(rows.some(row => row.includes('v - a Valkyrie')));
    assert.equal(rows.some(row => row.includes('w - a Wizard')), false);
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
void test('choosing race first offers only races compatible with an unfiltered role', async () => {
    const engine = await start('n~abchkmprRstv\n/');
    const rows = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''));
    assert.ok(rows.some(row => row.includes('Pick a race or species')));
    assert.equal(rows.some(row => row.includes('d - dwarf')), false, 'dwarf cannot lead to the only unfiltered role, Wizard');
    assert.ok(rows.some(row => row.includes('e - elf')));
    engine.inputGate.feed('ewmy');
    await engine.runUntilInputNeeded();
    assert.equal(game.moves, 1);
    assert.equal(game.urole?.key, 'wizard');
    assert.equal(game.urace?.name, 'elf');
});
void test('clearing the female filter retains the implied Valkyrie exclusion on reopening', async () => {
    const engine = await start('n~>F\n~>F\n');
    const rows = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''));
    assert.equal(rows.some(row => row.includes('a Valkyrie')), false, 'the reopened filter editor preselects the role excluded by the female filter');
    engine.inputGate.feed('kfy');
    await engine.runUntilInputNeeded();
    assert.equal(game.moves, 1);
    assert.equal(game.urole?.key, 'knight');
    assert.equal(game.flags.female, true, 'clearing female permits other female roles');
});
for (const { facet, exclusions } of [
    { facet: 'role', exclusions: 'abchkmprRstvw' },
    { facet: 'race', exclusions: 'HEDGO' },
    { facet: 'gender', exclusions: '>MF' },
    { facet: 'alignment', exclusions: '>LNC' },
]) {
    void test(`Random falls back to legal choices when every ${facet} is filtered`, async () => {
        const engine = await start(`n~${exclusions}\n`);
        for (let choices = 0; game.moves === 0 && choices < 8; choices++) {
            engine.inputGate.feed('\n');
            await engine.runUntilInputNeeded();
        }
        assert.equal(game.moves, 1, 'the default Random choice must permit game startup');
        assert.ok(game.urole && game.urace && game.initAlignment);
    });
}
//# sourceMappingURL=character_filters.test.js.map