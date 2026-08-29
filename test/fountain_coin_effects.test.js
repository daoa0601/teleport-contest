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

test('fate29 creates coins and commits its fountain state', () => {
    const loc = { looted: 0 };
    const world = {
        floorGold: [], liquidResolutions: 0,
        wisdomExercises: 0, repaints: 0,
    };
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
            world.floorGold.push(quantity);
        },
        liquidName() {
            world.liquidResolutions++;
            return 'water';
        },
        exerciseWisdom() {
            world.wisdomExercises++;
        },
        repaint() {
            world.repaints++;
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
    assert.deepEqual(world, {
        floorGold: [9], liquidResolutions: 1,
        wisdomExercises: 1, repaints: 1,
    });
});

test('blind and looted fate29 applications skip unavailable work', () => {
    const blindWorld = {
        floorGold: [], liquidResolutions: 0,
        wisdomExercises: 0, repaints: 0,
    };
    const blind = applyDippedCoinFate({
        fate: 29,
        loc: { looted: 0 },
        blind: true,
        random: () => 1,
        createGold(quantity) {
            blindWorld.floorGold.push(quantity);
        },
        liquidName() {
            blindWorld.liquidResolutions++;
            return 'water';
        },
        exerciseWisdom() {
            blindWorld.wisdomExercises++;
        },
        repaint() {
            blindWorld.repaints++;
        },
    });
    assert.equal(blind.message, '');
    assert.deepEqual(blindWorld, {
        floorGold: [6], liquidResolutions: 0,
        wisdomExercises: 1, repaints: 1,
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
