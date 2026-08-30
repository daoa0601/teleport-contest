import test from 'node:test';
import assert from 'node:assert/strict';

import {
    dippedCoinMessage, resolveDippedCoinFate,
} from '../js/fountain_effects.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { mkgold } from '../js/mklev.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';

test('fate29 amount range shrinks from top to bottom of its dungeon', () => {
    const top = resolveDippedCoinFate({
        fate: 29,
        dungeonLevels: 29,
        dungeonLevel: 1,
        random: range => range,
    });
    const bottom = resolveDippedCoinFate({
        fate: 29,
        dungeonLevels: 29,
        dungeonLevel: 29,
        random: range => range,
    });

    assert.deepEqual(top, {
        handled: true,
        createsCoins: true,
        quantity: 63,
        showMessage: true,
    });
    assert.deepEqual(bottom, {
        handled: true,
        createsCoins: true,
        quantity: 7,
        showMessage: true,
    });
});

test('fate29 blindness changes presentation but not the created amount', () => {
    assert.deepEqual(resolveDippedCoinFate({
        fate: 29,
        blind: true,
        random: () => 1,
    }), {
        handled: true,
        createsCoins: true,
        quantity: 6,
        showMessage: false,
    });
});

test('looted and adjacent fountain fates perform no coin work', () => {
    const unavailable = () => {
        throw new Error('ineligible coin fate must not resolve an amount');
    };
    assert.deepEqual(resolveDippedCoinFate({
        fate: 29,
        looted: true,
        random: unavailable,
    }), {
        handled: true,
        createsCoins: false,
        quantity: 0,
        showMessage: false,
    });
    assert.deepEqual(resolveDippedCoinFate({ fate: 28, random: unavailable }), {
        handled: false,
        createsCoins: false,
        quantity: 0,
        showMessage: false,
    });
    assert.equal(
        dippedCoinMessage('water'),
        'Far below you, you see coins glistening in the water.',
    );
});

test('mkgold allocates once, merges by identity, and repairs coin weight', () => {
    resetGame();
    game.level = new GameMap();
    initRng(4500n);
    const first = mkgold(51, 4, 5);
    const firstId = first.o_id;
    assert.equal(first.otyp, GOLD_PIECE);
    assert.equal(first.quan, 51);
    assert.equal(first.quantity, 51);
    assert.equal(first.owt, 1);
    assert.equal(game.level.objects[4][5][0], first);
    const merged = mkgold(100, 4, 5);
    assert.equal(merged, first);
    assert.equal(merged.o_id, firstId);
    assert.equal(merged.quan, 151);
    assert.equal(merged.quantity, 151);
    assert.equal(merged.owt, 2);
});
