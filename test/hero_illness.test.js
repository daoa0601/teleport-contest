import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CON, SICK_NONVOMITABLE, SICK_VOMITABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    advanceHeroSickness, startHeroSickness,
} from '../js/hero_illness.js';
import { freshObjectRoom } from './support/object-room.js';

function freshIllnessRoom() {
    freshObjectRoom({
        heroX: 13,
        heroY: 10,
        recalculateVision: false,
    });
}

test('fatal illness worsens and reaches the normal death path', async () => {
    freshIllnessRoom();
    startHeroSickness({
        state: game,
        turns: 7,
        cause: 'rotted goblin corpse',
        type: SICK_NONVOMITABLE,
    });
    const messages = [];
    const deaths = [];

    for (let turn = 0; turn < 7; turn++) {
        await advanceHeroSickness({
            state: game,
            publish: async message => messages.push(message),
            die: async details => {
                deaths.push(details);
                return true;
            },
        });
    }

    assert.deepEqual(messages.slice(0, 3), [
        'Your illness feels worse.',
        'Your illness is severe.',
        "You are at Death's door.",
    ]);
    assert.equal(deaths.length, 1);
    assert.equal(deaths[0].killer, 'rotted goblin corpse');
    assert.equal(game.u.sickTurns, 0);
});

test('the Constitution recovery roll can cure food poisoning', async () => {
    freshIllnessRoom();
    const constitution = game.u.acurr.a[A_CON];
    startHeroSickness({
        state: game,
        turns: 1,
        cause: 'tainted meat',
        type: SICK_VOMITABLE,
    });
    const messages = [];

    const result = await advanceHeroSickness({
        state: game,
        publish: async message => messages.push(message),
        random: () => 0,
        die: async () => {
            assert.fail('recoverable food poisoning should not kill');
        },
    });

    assert.equal(result.recovered, true);
    assert.equal(game.u.acurr.a[A_CON], constitution - 1);
    assert.deepEqual(messages, ['You have recovered from your illness.']);
});
