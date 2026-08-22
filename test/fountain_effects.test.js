import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveDippedBucFate, resolveDippedSensationFate,
} from '../js/fountain_effects.js';

test('dip fountain fate16 silently curses an eligible object', () => {
    const object = {
        oclass: 8,
        blessed: true,
        cursed: false,
        buc: 'blessed',
    };

    const effect = resolveDippedBucFate({ fate: 16, object });

    assert.deepEqual(effect, { handled: true, message: '' });
    assert.deepEqual(
        [object.blessed, object.cursed, object.buc],
        [false, true, 'cursed'],
    );
});

test('dip fountain fate16 leaves coins unchanged', () => {
    const coin = {
        oclass: 12,
        blessed: true,
        cursed: false,
        buc: 'blessed',
    };

    const effect = resolveDippedBucFate({ fate: 16, object: coin });

    assert.deepEqual(effect, { handled: true, message: '' });
    assert.deepEqual(
        [coin.blessed, coin.cursed, coin.buc],
        [true, false, 'blessed'],
    );
});

test('dip fountain fates17 through20 visibly uncurse an object', () => {
    for (const fate of [17, 18, 19, 20]) {
        const object = {
            oclass: 3,
            blessed: false,
            cursed: true,
            buc: 'cursed',
        };

        const effect = resolveDippedBucFate({
            fate,
            object,
            liquidName: 'water',
        });

        assert.deepEqual(effect, {
            handled: true,
            message: 'The water glows for a moment.',
        });
        assert.deepEqual(
            [object.blessed, object.cursed, object.buc],
            [false, false, 'uncursed'],
        );
    }
});

test('blind fate17 uncurses without resolving or printing liquid text', () => {
    const object = {
        oclass: 3,
        blessed: false,
        cursed: true,
        buc: 'cursed',
    };
    let liquidLookups = 0;

    const effect = resolveDippedBucFate({
        fate: 17,
        object,
        blind: true,
        liquidName() {
            liquidLookups++;
            return 'water';
        },
    });

    assert.deepEqual(effect, { handled: true, message: '' });
    assert.equal(liquidLookups, 0);
    assert.deepEqual(
        [object.blessed, object.cursed, object.buc],
        [false, false, 'uncursed'],
    );
});

test('fates17 through20 report loss when no curse can be removed', () => {
    for (const fate of [17, 18, 19, 20]) {
        const object = {
            oclass: 3,
            blessed: false,
            cursed: false,
            buc: 'uncursed',
        };
        const effect = resolveDippedBucFate({ fate, object });
        assert.deepEqual(effect, {
            handled: true,
            message: 'A feeling of loss comes over you.',
        });
        assert.deepEqual(
            [object.blessed, object.cursed, object.buc],
            [false, false, 'uncursed'],
        );
    }
});

test('hands receive the loss message instead of a BUC mutation', () => {
    const effect = resolveDippedBucFate({
        fate: 20,
        object: null,
        isHands: true,
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'A feeling of loss comes over you.',
    });
});

test('fate26 resolves the current arm noun into the exact tingling line', () => {
    let armLookups = 0;
    const effect = resolveDippedSensationFate({
        fate: 26,
        armName() {
            armLookups++;
            return 'tentacle';
        },
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'A strange tingling runs up your tentacle.',
    });
    assert.equal(armLookups, 1);
});

test('fate27 does not resolve anatomy for the exact sudden-chill line', () => {
    let armLookups = 0;
    const effect = resolveDippedSensationFate({
        fate: 27,
        armName() {
            armLookups++;
            return 'arm';
        },
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'You feel a sudden chill.',
    });
    assert.equal(armLookups, 0);
});

test('sensation reducer leaves adjacent fountain fates to their owners', () => {
    assert.deepEqual(resolveDippedSensationFate({ fate: 25 }), {
        handled: false,
        message: '',
    });
    assert.deepEqual(resolveDippedSensationFate({ fate: 28 }), {
        handled: false,
        message: '',
    });
});
