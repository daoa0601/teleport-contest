import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';
import { GOLD_PIECE, POT_HEALING, LEATHER_ARMOR } from '../js/object_data.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveDippedBucFate, resolveDippedSensationFate,
} from '../js/fountain_effects.js';

void test('dip fountain fate16 silently curses an eligible object', async () => {
    freshObjectRoom();
    const object = await knownObject(POT_HEALING, {
        blessed: true,
        cursed: false,
        buc: 'blessed',
    });

    const effect = resolveDippedBucFate({ fate: 16, object });

    assert.deepEqual(effect, { handled: true, message: '' });
    assert.deepEqual(
        [object.blessed, object.cursed, object.buc],
        [false, true, 'cursed'],
    );
});

void test('dip fountain fate16 leaves coins unchanged', async () => {
    freshObjectRoom();
    const coin = await knownObject(GOLD_PIECE, {
        blessed: true,
        cursed: false,
        buc: 'blessed',
    });

    const effect = resolveDippedBucFate({ fate: 16, object: coin });

    assert.deepEqual(effect, { handled: true, message: '' });
    assert.deepEqual(
        [coin.blessed, coin.cursed, coin.buc],
        [true, false, 'blessed'],
    );
});

void test('dip fountain fates17 through20 visibly uncurse an object', async () => {
    freshObjectRoom();
    for (const fate of [17, 18, 19, 20] as const) {
        const object = await knownObject(LEATHER_ARMOR, {
            blessed: false,
            cursed: true,
            buc: 'cursed',
        });

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

void test('blind fate17 uncurses without resolving or printing liquid text', async () => {
    freshObjectRoom();
    const object = await knownObject(LEATHER_ARMOR, {
        blessed: false,
        cursed: true,
        buc: 'cursed',
    });
    const effect = resolveDippedBucFate({
        fate: 17,
        object,
        blind: true,
        liquidName() {
            throw new Error('blind glow must not resolve liquid text');
        },
    });

    assert.deepEqual(effect, { handled: true, message: '' });
    assert.deepEqual(
        [object.blessed, object.cursed, object.buc],
        [false, false, 'uncursed'],
    );
});

void test('fates17 through20 report loss when no curse can be removed', async () => {
    freshObjectRoom();
    for (const fate of [17, 18, 19, 20] as const) {
        const object = await knownObject(LEATHER_ARMOR, {
            blessed: false,
            cursed: false,
            buc: 'uncursed',
        });
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

void test('hands receive the loss message instead of a BUC mutation', async () => {
    freshObjectRoom();
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

void test('fate26 resolves the current arm noun into the exact tingling line', async () => {
    freshObjectRoom();
    const effect = resolveDippedSensationFate({
        fate: 26,
        armName: () => 'tentacle',
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'A strange tingling runs up your tentacle.',
    });
});

void test('fate27 does not resolve anatomy for the exact sudden-chill line', async () => {
    freshObjectRoom();
    const effect = resolveDippedSensationFate({
        fate: 27,
        armName() {
            throw new Error('sudden chill must not resolve anatomy');
        },
    });

    assert.deepEqual(effect, {
        handled: true,
        message: 'You feel a sudden chill.',
    });
});

void test('sensation reducer leaves adjacent fountain fates to their owners', async () => {
    freshObjectRoom();
    assert.deepEqual(resolveDippedSensationFate({ fate: 25 }), {
        handled: false,
        message: '',
    });
    assert.deepEqual(resolveDippedSensationFate({ fate: 28 }), {
        handled: false,
        message: '',
    });
});
