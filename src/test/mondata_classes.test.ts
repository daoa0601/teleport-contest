import assert from 'node:assert/strict';
import test from 'node:test';
import { nameToMonsterClass } from '../js/mondata.js';

void test('monster classes singularize ordinary and irregular plural nouns', () => {
    assert.equal(nameToMonsterClass('horses'), 21);
    assert.equal(nameToMonsterClass('vampires'), 48);
    assert.equal(nameToMonsterClass('zombies'), 52);
    assert.equal(nameToMonsterClass('vortices'), 22);
    assert.equal(nameToMonsterClass('fungi'), 32);
});

