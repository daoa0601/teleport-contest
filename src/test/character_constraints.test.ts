import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

async function start(choices: string) {
    return await runSegment({
        seed: 22,
        datetime: '20260831120000',
        nethackrc: `OPTIONS=name:Chosen,${choices},!legacy,!tutorial,pettype:none`,
        moves: '',
        storage: memoryStorage(),
    });
}

for (const random of ['random', '*', '@']) {
    void test(`explicit ${random} choices start without a selection prompt`, async () => {
        await start(`role:${random},race:${random},gender:${random},align:${random}`);

        assert.equal(game.moves, 1, 'a fully requested random character reaches game startup');
        assert.ok(game.urole && game.urace && game.initAlignment);
        assert.ok(game.inventory.length > 0, 'the selected role receives its starting gear');
    });
}

void test('a random role honors a specified dwarven lawful male character', async () => {
    await start('role:random,race:dwarf,gender:male,align:lawful');

    assert.ok(game.urole?.key === 'archeologist' || game.urole?.key === 'caveman');
    assert.equal(game.urace?.name, 'dwarf');
    assert.equal(game.initAlignment?.name, 'lawful');
    assert.equal(game.flags.female, false);
});

void test('a Knight with forced missing facets goes directly to confirmation', async () => {
    await start('role:Knight,gender:male');
    const heading = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');

    assert.match(heading ?? '', /Is this ok\? \[ynaq\]/);
});

void test('the sole valid Knight race and alignment replace incompatible options', async () => {
    await start('role:Knight,race:orc,gender:male,align:chaotic');

    assert.equal(game.urace?.name, 'human');
    assert.equal(game.initAlignment?.name, 'lawful');
    assert.equal(game.moves, 1);
});

void test('a Valkyrie with a configured male gender starts female', async () => {
    await start('role:Valkyrie,race:human,gender:male,align:lawful');

    assert.equal(game.flags.female, true);
    assert.equal(game.moves, 1);
});
