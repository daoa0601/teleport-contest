import assert from 'node:assert/strict';
import test from 'node:test';

import { PIT, WEB } from '../js/const.js';
import { count_traps, deleteTrap, maketrap } from '../js/trap.js';
import { freshObjectRoom } from './support/object-room.js';

void test('trap counts separate types and follow trap removal', async () => {
    await freshObjectRoom();
    const firstWeb = await maketrap(11, 10, WEB);
    await maketrap(12, 10, WEB);
    await maketrap(13, 10, PIT);
    assert.ok(firstWeb);

    assert.equal(count_traps(WEB), 2);
    assert.equal(count_traps(PIT), 1);
    deleteTrap(firstWeb);
    assert.equal(count_traps(WEB), 1);
    assert.equal(count_traps(PIT), 1);
});

void test('trap counts use the current level after leaving a webbed level', async () => {
    await freshObjectRoom();
    await maketrap(11, 10, WEB);
    assert.equal(count_traps(WEB), 1);

    await freshObjectRoom();

    assert.equal(count_traps(WEB), 0);
});
