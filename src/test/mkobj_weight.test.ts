import test from 'node:test';
import assert from 'node:assert/strict';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a wish for three half-eaten food rations weighs thirty units', async () => {
    freshObjectRoom();

    const result = await readObjectName('3 partly eaten food rations', { wizardWish: true });

    assert.ok(result && 'object' in result);
    assert.equal(result.object.quan, 3);
    assert.equal(result.object.oeaten, 400);
    assert.equal(result.object.owt, 30);
});

void test('a wish for three half-eaten newt corpses weighs fifteen units', async () => {
    freshObjectRoom();

    const result = await readObjectName('3 partly eaten newt corpses', { wizardWish: true });

    assert.ok(result && 'object' in result);
    assert.equal(result.object.quan, 3);
    assert.equal(result.object.oeaten, 10);
    assert.equal(result.object.owt, 15);
});

void test('a wish for 23 half-eaten human corpses caps their full weight before scaling', async () => {
    freshObjectRoom();

    const result = await readObjectName('23 partly eaten human corpses', { wizardWish: true });

    assert.ok(result && 'object' in result);
    assert.equal(result.object.quan, 23);
    assert.equal(result.object.oeaten, 200);
    assert.equal(result.object.owt, 16383);
});
