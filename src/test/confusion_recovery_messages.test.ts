import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { setPropertyTimeout, propertyTimeout } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('confusion recovery feels less trippy while hallucination continues', async () => {
    const input = freshTurnRoom({ role: 'caveman' });
    setPropertyTimeout('confusion', 1);
    setPropertyTimeout('hallucination', 20);
    input.feed('.');
    installPagerInput(input, { expected: /less trippy/, limit: 1 });

    await moveloop_core();
    await finishAtCommandInput(input, () => moveloop_core(), /You feel less trippy now\./);

    assert.equal(propertyTimeout('confusion'), 0);
    assert.ok(propertyTimeout('hallucination') > 0);
});
