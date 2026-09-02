import test from 'node:test';
import assert from 'node:assert/strict';

import { A_DEX, STONING } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    advanceHeroPetrification, startHeroPetrification,
} from '../js/stoning.js';
import { freshObjectRoom } from './support/object-room.js';

function freshStoningRoom() {
    freshObjectRoom({
        heroX: 13,
        heroY: 10,
        recalculateVision: false,
    });
}

test('petrification stops actions as the hero stiffens', async () => {
    freshStoningRoom();
    game.u.fast = true;
    game.u.veryFast = true;
    game.u.veryFastTurns = 30;
    game.u._woundedLegTurns = 12;
    game.u._woundedLegSide = 'left';
    game.u.acurr.a[A_DEX] = 9;
    game._occupation = { key: 's', remaining: 8 };
    startHeroPetrification({ killer: 'cockatrice egg' });
    const messages = [];
    const publish = async message => messages.push(message);

    await advanceHeroPetrification({ state: game, publish });
    assert.equal(game.u.fast, false);
    assert.equal(game.u.stonedTurns, 4);
    assert.ok(game._occupation);

    await advanceHeroPetrification({ state: game, publish });
    assert.equal(game._occupation, null);

    await advanceHeroPetrification({ state: game, publish });
    assert.equal(game._helplessReason, 'getting stoned');
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.u.acurr.a[A_DEX], 10);
    assert.deepEqual(messages, [
        'You are slowing down.',
        'Your limbs are stiffening.',
        'Your limbs have turned to stone.',
    ]);
});

test('the final petrification turn invokes a stoning death', async () => {
    freshStoningRoom();
    startHeroPetrification({ turns: 1, killer: 'cockatrice egg' });
    const deaths = [];

    const result = await advanceHeroPetrification({
        state: game,
        publish: async () => {},
        die: async details => {
            deaths.push(details);
            return true;
        },
    });

    assert.equal(result.died, true);
    assert.equal(game.u.stonedTurns, 0);
    assert.equal(deaths[0].deathType, STONING);
    assert.equal(deaths[0].killer, 'cockatrice egg');
});
