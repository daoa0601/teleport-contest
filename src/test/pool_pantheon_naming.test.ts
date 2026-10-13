import assert from 'node:assert/strict';
import test from 'node:test';

import { deityName } from '../js/alignment.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

void test('a Priest borrowing the Rogue pantheon prays to Kos when chaotic', async () => {
    const capture = await runSegment({
        seed: 12, datetime: '20010101090000', storage: memoryStorage(), moves: ' ',
        nethackrc: 'OPTIONS=name:Reader,role:priest,race:human,gender:female,align:chaotic\nOPTIONS=!legacy,!tutorial,!news',
    });

    assert.equal(deityName(-1, capture.state), 'Kos');
});
