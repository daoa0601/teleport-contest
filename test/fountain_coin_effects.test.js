import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyDippedCoinFate, dippedCoinMessage, resolveDippedCoinFate,
} from '../js/fountain_effects.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { mkgold } from '../js/mklev.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';

test('fate29 amount range shrinks from top to bottom of its dungeon', () => {
    const calls = [];
    const top = resolveDippedCoinFate({
        fate: 29,
        dungeonLevels: 29,
        dungeonLevel: 1,
        random(range) {
            calls.push(range);
            return 7;
        },
    });
    const bottom = resolveDippedCoinFate({
        fate: 29,
        dungeonLevels: 29,
        dungeonLevel: 29,
        random(range) {
            calls.push(range);
            return 2;
        },
    });

    assert.deepEqual(top, {
        handled: true,
        createsCoins: true,
        quantity: 12,
        showMessage: true,
    });
    assert.deepEqual(bottom, {
        handled: true,
        createsCoins: true,
        quantity: 7,
        showMessage: true,
    });
    assert.deepEqual(calls, [58, 2]);
});

test('fate29 blind, looted, and adjacent paths preserve their RNG boundary', () => {
    let calls = 0;
    const random = () => {
        calls++;
        return 1;
    };

    assert.deepEqual(resolveDippedCoinFate({
        fate: 29,
        blind: true,
        random,
    }), {
        handled: true,
        createsCoins: true,
        quantity: 6,
        showMessage: false,
    });
    assert.equal(calls, 1);

    assert.deepEqual(resolveDippedCoinFate({
        fate: 29,
        looted: true,
        random,
    }), {
        handled: true,
        createsCoins: false,
        quantity: 0,
        showMessage: false,
    });
    assert.deepEqual(resolveDippedCoinFate({ fate: 28, random }), {
        handled: false,
        createsCoins: false,
        quantity: 0,
        showMessage: false,
    });
    assert.equal(calls, 1);
    assert.equal(
        dippedCoinMessage('water'),
        'Far below you, you see coins glistening in the water.',
    );
});

test('fate29 creates coins and commits its fountain state', () => {
    const loc = { looted: 0 };
    let createdQuantity = null;
    let liquidResolutions = 0;
    let wisdomExercises = 0;
    let repaints = 0;
    const effect = applyDippedCoinFate({
        fate: 29,
        loc,
        dungeonLevels: 5,
        dungeonLevel: 2,
        random(range) {
            assert.equal(range, 8);
            return 4;
        },
        createGold(quantity) {
            createdQuantity = quantity;
        },
        liquidName() {
            liquidResolutions++;
            return 'water';
        },
        exerciseWisdom() {
            wisdomExercises++;
        },
        repaint() {
            repaints++;
        },
    });

    assert.deepEqual(effect, {
        handled: true,
        createsCoins: true,
        quantity: 9,
        showMessage: true,
        message: 'Far below you, you see coins glistening in the water.',
    });
    assert.equal(loc.looted & 1, 1);
    assert.equal(createdQuantity, 9);
    assert.equal(liquidResolutions, 1);
    assert.equal(wisdomExercises, 1);
    assert.equal(repaints, 1);
});

test('blind and looted fate29 applications skip unavailable work', () => {
    const blindWork = {
        amount: 0, gold: 0, liquid: 0, exercise: 0, repaint: 0,
    };
    const blind = applyDippedCoinFate({
        fate: 29,
        loc: { looted: 0 },
        blind: true,
        random() {
            blindWork.amount++;
            return 1;
        },
        createGold() {
            blindWork.gold++;
        },
        liquidName() {
            blindWork.liquid++;
            return 'water';
        },
        exerciseWisdom() {
            blindWork.exercise++;
        },
        repaint() {
            blindWork.repaint++;
        },
    });
    assert.equal(blind.message, '');
    assert.deepEqual(blindWork, {
        amount: 1, gold: 1, liquid: 0, exercise: 1, repaint: 1,
    });

    const looted = applyDippedCoinFate({
        fate: 29,
        loc: { looted: 1 },
        random() {
            throw new Error('looted fountain must not roll');
        },
        createGold() {
            throw new Error('looted fountain must not create coins');
        },
        liquidName() {
            throw new Error('looted fountain must not resolve liquid text');
        },
        exerciseWisdom() {
            throw new Error('looted fountain must not exercise Wisdom');
        },
        repaint() {
            throw new Error('looted fountain must not repaint');
        },
    });
    assert.deepEqual(looted, {
        handled: true,
        createsCoins: false,
        quantity: 0,
        showMessage: false,
        message: '',
    });
});

test('mkgold allocates once, merges by identity, and repairs coin weight', () => {
    resetGame();
    game.level = new GameMap();
    initRng(4500n);
    enableRngLog();

    const first = mkgold(51, 4, 5);
    const firstId = first.o_id;
    assert.equal(first.otyp, GOLD_PIECE);
    assert.equal(first.quan, 51);
    assert.equal(first.quantity, 51);
    assert.equal(first.owt, 1);
    assert.equal(game.level.objects[4][5][0], first);
    assert.match(getRngLog()[0], /^rnd\(2\)=/);
    assert.equal(getRngLog().length, 1);

    const merged = mkgold(100, 4, 5);
    assert.equal(merged, first);
    assert.equal(merged.o_id, firstId);
    assert.equal(merged.quan, 151);
    assert.equal(merged.quantity, 151);
    assert.equal(merged.owt, 2);
    assert.equal(getRngLog().length, 1);
});
