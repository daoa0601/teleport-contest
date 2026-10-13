import assert from 'node:assert/strict';
import test from 'node:test';
import { encyclopediaEntries } from '../js/encyclopedia.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an armor lookup containing a literal star still matches the armor wildcard', () => {
    freshObjectRoom();
    const entries = encyclopediaEntries('armor*and more');
    assert.equal(entries.length, 1);
    assert.ok(entries[0]?.lines.some(line => line.includes('jousting team')), 'The armor entry should describe the jousting team');
});
//# sourceMappingURL=encyclopedia_lookup.test.js.map