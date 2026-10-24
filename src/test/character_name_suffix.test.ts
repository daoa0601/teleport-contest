import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

void test('name suffixes override configured character facets before startup', async () => {
    await runSegment({
        seed: 23,
        datetime: '20260831120000',
        nethackrc: 'OPTIONS=name:Ada-Wiz-Elf-Fem-Cha,role:Knight,race:human,gender:male,align:lawful,!legacy,!tutorial,pettype:none',
        moves: '',
        storage: memoryStorage(),
    });

    assert.equal(game.plname, 'Ada');
    assert.equal(game.urole?.key, 'wizard');
    assert.equal(game.urace?.name, 'elf');
    assert.equal(game.flags.female, true);
    assert.equal(game.initAlignment?.name, 'chaotic');
});

void test('typed names echo Unix character replacements before discarding unknown suffixes', async () => {
    const engine = await runSegment({
        seed: 24,
        datetime: '20260831120000',
        nethackrc: 'OPTIONS=role:Rogue,race:human,gender:male,align:chaotic,!legacy,!tutorial,pettype:none',
        moves: 'A,da',
        storage: memoryStorage(),
    });
    const rows = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''));

    assert.ok(rows.some(row => row.includes('Who are you? A_da')),
        'the Unix name reader replaces the comma before displaying it');
    engine.inputGate.feed('-unknown\n');
    await engine.runUntilInputNeeded();

    assert.equal(game.plname, 'A_da');
    assert.equal(game.urole?.key, 'rogue');
});

void test('typed names replace a leading digit and punctuation while retaining character suffixes', async () => {
    await runSegment({
        seed: 24,
        datetime: '20260831120000',
        nethackrc: 'OPTIONS=role:Rogue,race:human,gender:male,align:chaotic,!legacy,!tutorial,pettype:none',
        moves: '9Ada 2@-Wiz-Elf-Fem-Cha\n',
        storage: memoryStorage(),
    });

    assert.equal(game.plname, '_Ada_2@');
    assert.equal(game.urole?.key, 'wizard');
    assert.equal(game.urace?.name, 'elf');
    assert.equal(game.flags.female, true);
    assert.equal(game.initAlignment?.name, 'chaotic');
});
