import test from 'node:test';
import assert from 'node:assert/strict';

import { igniteInventoryItems } from '../js/light.js';
import { SCR_IDENTIFY, TALLOW_CANDLE } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { destroyFireInventory } from '../js/zap.js';

test('carried paper burns and an exposed candle catches light', async () => {
    const scroll = {
        otyp: SCR_IDENTIFY,
        oclass: 9,
        name: 'identify',
        quan: 1,
        quantity: 1,
        where: 'inventory',
    };
    const candle = {
        otyp: TALLOW_CANDLE,
        oclass: 6,
        name: 'tallow candle',
        quan: 1,
        quantity: 1,
        age: 80,
        lamplit: false,
        where: 'inventory',
        objectTimers: [],
    };
    const state = {
        moves: 10,
        inventory: [scroll, candle],
        u: {
            uhp: 20,
            acurr: { a: Array(6).fill(10) },
        },
    };
    const messages = [];
    const publish = async message => messages.push(message);
    const alwaysZero = () => 0;
    initRng(1n);

    await destroyFireInventory(5, {
        state,
        publish,
        random: alwaysZero,
    });
    await igniteInventoryItems(state.inventory, {
        state,
        publish,
        random: alwaysZero,
    });

    assert.deepEqual(state.inventory, [candle]);
    assert.equal(state.u.uhp, 19);
    assert.equal(candle.lamplit, true);
    assert.deepEqual(objectTimers(candle).map(timer => [
        timer.kind, timer.deadline,
    ]), [[OBJECT_TIMER_KIND.BURN_OBJECT, 15]]);
    assert.deepEqual(messages, [
        'Your scroll of identify catches fire and burns!',
        'Your tallow candle catches light!',
    ]);
});
