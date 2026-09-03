import test from 'node:test';
import assert from 'node:assert/strict';

import { igniteItems } from '../js/light.js';
import {
    POT_HEALING, RIN_PROTECTION, SCR_IDENTIFY, TALLOW_CANDLE,
} from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import {
    destroyColdInventory, destroyElectricInventory, destroyFireInventory,
} from '../js/zap.js';
import { carriedObject } from './support/game-objects.js';

test.beforeEach(() => initRng(1n));

test('carried paper burns and an exposed candle catches light', async () => {
    const scroll = carriedObject(SCR_IDENTIFY);
    const candle = carriedObject(TALLOW_CANDLE, {
        age: 80,
        lamplit: false,
    });
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
    await igniteItems(state.inventory, {
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
    const potion = carriedObject(POT_HEALING, { quan: 2 });
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
        const ring = carriedObject(RIN_PROTECTION, {
            spe: 0,
        });
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
