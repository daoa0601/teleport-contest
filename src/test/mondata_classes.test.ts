import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMonsterClass } from '../js/mondata.js';

void test('monster classes singularize ordinary and irregular plural nouns', () => {
    assert.equal(resolveMonsterClass('horses').monsterClass, 21);
    assert.equal(resolveMonsterClass('vampires').monsterClass, 48);
    assert.equal(resolveMonsterClass('zombies').monsterClass, 52);
    assert.equal(resolveMonsterClass('vortices').monsterClass, 22);
    assert.equal(resolveMonsterClass('fungi').monsterClass, 32);
});

void test('a space denotes the ghost class', () => {
    assert.equal(resolveMonsterClass(' ').monsterClass, 54);
});

