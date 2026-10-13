import assert from 'node:assert/strict';
import test from 'node:test';
import { encyclopediaEntries } from '../js/encyclopedia.js';
import { initializeFruitRegistry } from '../js/fruit.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an unfamiliar custom fruit uses the edible fruit encyclopedia entry', () => {
    freshObjectRoom();
    initializeFruitRegistry('moonberry');
    const entries = encyclopediaEntries('2 uncursed moonberries');
    assert.equal(entries.length, 1);
    assert.ok(entries[0]?.lines.some(line => line.includes('this is edible')));
});
void test('an article-prefixed custom fruit shows only the fruit entry even when its name is a weapon', () => {
    freshObjectRoom();
    initializeFruitRegistry('dagger');
    const entries = encyclopediaEntries('a dagger');
    assert.equal(entries.length, 1);
    assert.ok(entries[0]?.lines.some(line => line.includes('this is edible')));
});
void test('a longer prefix preserves the weapon entry after the custom fruit entry', () => {
    freshObjectRoom();
    initializeFruitRegistry('dagger');
    const entries = encyclopediaEntries('an uncursed dagger');
    assert.equal(entries.length, 2);
    assert.ok(entries[0]?.lines.some(line => line.includes('this is edible')));
    assert.ok(entries[1]?.lines.some(line => line.includes('dagger')));
});
//# sourceMappingURL=custom_fruit_lookup.test.js.map