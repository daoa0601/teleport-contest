import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
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
void test('typed names discard unknown suffixes and replace record-file commas', async () => {
    await runSegment({
        seed: 24,
        datetime: '20260831120000',
        nethackrc: 'OPTIONS=role:Rogue,race:human,gender:male,align:chaotic,!legacy,!tutorial,pettype:none',
        moves: 'A,da-unknown\n',
        storage: memoryStorage(),
    });
    assert.equal(game.plname, 'A da');
    assert.equal(game.urole?.key, 'rogue');
});
//# sourceMappingURL=character_name_suffix.test.js.map