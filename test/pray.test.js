import test from 'node:test';
import assert from 'node:assert/strict';

import {
    angryGodMaximum, rebasePrayerAfterLifeSaving,
} from '../js/pray.js';

test('angrygods computes the live same-alignment range', () => {
    assert.equal(angryGodMaximum({
        responseAlignment: 0,
        heroAlignment: 0,
        alignmentRecord: 0,
        anger: 1,
        luck: -3,
    }), 6);
    assert.equal(angryGodMaximum({
        responseAlignment: 1,
        heroAlignment: 1,
        alignmentRecord: 4,
        anger: 1,
        luck: -3,
    }), 4);
});

test('angrygods clamps cross-alignment ranges to source bounds', () => {
    assert.equal(angryGodMaximum({
        responseAlignment: -1,
        heroAlignment: 1,
        alignmentRecord: -20,
        anger: 0,
        luck: 13,
    }), 1);
    assert.equal(angryGodMaximum({
        responseAlignment: -1,
        heroAlignment: 1,
        alignmentRecord: 40,
        anger: 0,
        luck: -13,
    }), 15);
});

test('savelife rebases only an already-installed prayer callback', () => {
    const idle = {};
    assert.equal(rebasePrayerAfterLifeSaving(idle), false);
    assert.deepEqual(idle, {});

    const praying = {
        _prayerTurnsRemaining: 3,
        _prayerCompletionMessage: 'You finish your prayer.',
    };
    assert.equal(rebasePrayerAfterLifeSaving(praying), true);
    assert.equal(praying._prayerTurnsRemaining, 1);
    assert.equal(praying._prayerCompletionMessage,
        'You survived that attempt on your life.');
});
