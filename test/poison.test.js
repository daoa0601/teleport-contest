import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CON, A_STR } from '../js/const.js';
import { resolvePoisonedHero } from '../js/poison.js';

function heroState(hitPoints) {
    return {
        inventory: [],
        u: {
            uhp: hitPoints,
            uhpmax: hitPoints,
            ulevel: 5,
            acurr: { a: [10, 10, 10, 10, 10, 10] },
            amax: { a: [18, 18, 18, 18, 18, 18] },
        },
        urace: {
            attrmin: [3, 3, 3, 3, 3, 3],
            attrmax: [18, 18, 18, 18, 18, 18],
        },
    };
}

test('surviving severe poison lowers maximum HP and attributes', async () => {
    const state = heroState(40);
    const messages = [];

    const result = await resolvePoisonedHero({
        reason: "The killer bee's sting",
        attribute: A_STR,
        state,
        random: () => 0,
        rollDice: () => 4,
        publish: message => {
            messages.push(message);
        },
    });

    assert.equal(result.deadly, false);
    assert.equal(state.u.uhpmax, 35);
    assert.equal(state.u.uhp, 30);
    assert.equal(state.u.acurr.a[A_CON], 9);
    assert.equal(state.u.acurr.a[A_STR], 7);
    assert.ok(messages.includes('You feel very sick!'));
    assert.ok(messages.includes('You feel weaker!'));
});

test('severe poison reports death when its damage reaches current HP',
    async () => {
        const state = heroState(10);
        const messages = [];

        const result = await resolvePoisonedHero({
            reason: "The killer bee's sting",
            attribute: A_STR,
            state,
            random: () => 0,
            rollDice: () => 4,
            publish: message => {
                messages.push(message);
            },
        });

        assert.equal(result.deadly, true);
        assert.equal(state.u.uhp, -1);
        assert.equal(messages.at(-1), 'The poison was deadly...');
    });
