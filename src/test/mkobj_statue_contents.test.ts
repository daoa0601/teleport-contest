import test from 'node:test';
import assert from 'node:assert/strict';
import { mksobj } from '../js/mklev.js';
import { SPE_NOVEL, STATUE } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a spellbook generated inside a statue belongs to that statue', async () => {
    freshObjectRoom({ gameplaySeed: 160 });
    let books = 0;

    for (let count = 0; count < 100; count++) {
        const statue = await mksobj(STATUE, true, false);
        for (const book of statue.contents ?? []) {
            books++;
            assert.equal(book.where, 'contained');
            assert.equal(book.container, statue);
            assert.notEqual(book.otyp, SPE_NOVEL);
        }
    }
    assert.ok(books > 0, 'statues at this depth sometimes contain a book');
});
