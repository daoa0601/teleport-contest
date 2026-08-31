import test from 'node:test';
import assert from 'node:assert/strict';

import { igniteInventoryItems } from '../js/light.js';
import {
    POT_HEALING, RIN_PROTECTION, SCR_IDENTIFY, TALLOW_CANDLE,
} from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import {
    destroyColdInventory, destroyElectricInventory, destroyFireInventory,
} from '../js/zap.js';

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

test('cold shatters carried potions', async () => {
    const potion = {
        otyp: POT_HEALING,
        oclass: 8,
        name: 'healing',
        quan: 2,
        quantity: 2,
        where: 'inventory',
    };
    const state = {
        inventory: [potion],
        u: { uhp: 20, acurr: { a: Array(6).fill(10) } },
    };
    const messages = [];
    initRng(2n);

    await destroyColdInventory(5, {
        state,
        publish: async message => messages.push(message),
        random: () => 0,
        rollOne: () => 4,
    });

    assert.equal(state.inventory.length, 0);
    assert.equal(state.u.uhp, 16);
    assert.deepEqual(messages, [
        'Both of your potions of healing freeze and shatter!',
    ]);
});

test('electricity can recharge a charged ring instead of destroying it',
    async () => {
        const ring = {
            otyp: RIN_PROTECTION,
            oclass: 4,
            name: 'protection',
            quan: 1,
            quantity: 1,
            spe: 0,
            where: 'inventory',
        };
        const state = {
            inventory: [ring],
            u: { uhp: 20, uac: 10 },
        };
        const messages = [];
        const rolls = [0, 1, 6];

        await destroyElectricInventory(5, {
            state,
            publish: async message => messages.push(message),
            random: () => rolls.shift(),
        });

        assert.equal(state.inventory[0], ring);
        assert.equal(ring.spe, 1);
        assert.equal(state.u.uhp, 20);
        assert.deepEqual(messages, [
            'Your ring of protection spins clockwise for a moment.',
        ]);
    });
