import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import {
    grantIntrinsicProperty, propertyIsActive, propertyTimeout, setPropertyTimeout,
} from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('world turns expire temporary resistance while preserving its permanent source', async () => {
    const input = freshTurnRoom({ role: 'caveman' });
    grantIntrinsicProperty('coldResistance', 'outside');
    setPropertyTimeout('coldResistance', 2);
    setPropertyTimeout('sleepResistance', 2);
    const start = game.moves;
    input.feed('...');

    await moveloop_core();
    await moveloop_core();
    assert.equal(game.moves, start + 1);
    assert.equal(propertyIsActive('sleepResistance'), true);
    await moveloop_core();

    assert.equal(game.moves, start + 2);
    assert.equal(propertyIsActive('sleepResistance'), false);
    assert.equal(propertyTimeout('coldResistance'), 0);
    assert.equal(propertyIsActive('coldResistance'), true);
});

void test('timed invulnerability counts down without freezing other properties', async () => {
    const input = freshTurnRoom({ role: 'caveman' });
    setPropertyTimeout('invulnerable', 2);
    setPropertyTimeout('poisonResistance', 2);
    assert.equal(Boolean(game.u.invulnerable), false);
    input.feed('...');

    await moveloop_core();
    await moveloop_core();
    await moveloop_core();

    assert.equal(propertyTimeout('invulnerable'), 0);
    assert.equal(propertyIsActive('invulnerable'), false);
    assert.equal(propertyIsActive('poisonResistance'), false);
});

void test('existing status handlers and ordinary property expiry each consume one tick', async () => {
    const input = freshTurnRoom({ role: 'caveman' });
    setPropertyTimeout('stunned', 2);
    setPropertyTimeout('coldResistance', 2);
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(propertyTimeout('stunned'), 1);
    assert.equal(propertyTimeout('coldResistance'), 1);
});

void test('sleep resistance expires before a permanent sleepiness source takes effect', async () => {
    const input = freshTurnRoom({ role: 'caveman' });
    grantIntrinsicProperty('sleepy', 'outside');
    setPropertyTimeout('sleepy', 1);
    setPropertyTimeout('sleepResistance', 1);
    input.feed('.');

    await moveloop_core();
    await moveloop_core();

    assert.equal(propertyIsActive('sleepResistance'), false);
    assert.ok((game.u.usleep ?? 0) > 0);
    assert.ok((game._helplessTurns ?? 0) > 0);
    assert.ok(propertyTimeout('sleepy') > 1);
});
