import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CON, SICK_NONVOMITABLE, SICK_VOMITABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    advanceHeroSickness, advanceHeroVomiting, startHeroSickness,
    startHeroVomiting, vomitHero,
} from '../js/hero_illness.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_SEWER_RAT = 88;
const PM_ARCHEOLOGIST = 331;

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

test('nausea worsens, confuses, stuns, and ends in vomiting', async () => {
    freshIllnessRoom();
    game.u.uhunger = 900;
    startHeroSickness({
        state: game,
        turns: 30,
        cause: 'tainted meat',
        type: SICK_VOMITABLE,
    });
    startHeroVomiting({ state: game, turns: 15 });
    const messages = [];

    for (let turn = 0; turn < 15; turn++) {
        await advanceHeroVomiting({
            state: game,
            publish: async message => messages.push(message),
            rollDice: count => count,
        });
    }

    assert.deepEqual(messages, [
        'You are feeling mildly nauseated.',
        'You feel slightly confused.',
        "You can't seem to think straight.",
        'You feel incredibly sick.',
        'You are about to vomit.',
        'You vomit!',
        'You feel cured.  What a relief!',
        'You feel much less nauseated now.',
    ]);
    assert.equal(game.u.uhunger, 880);
    assert.equal(game.u.sick, false);
    assert.equal(game.u.vomiting, false);
    assert.equal(game._helplessTurns, 2);
});

test('a rat form cannot vomit away food poisoning', async () => {
    freshIllnessRoom();
    Object.assign(game.u, {
        umonster: PM_ARCHEOLOGIST,
        umonnum: PM_SEWER_RAT,
        mtimedone: 20,
    });
    startHeroSickness({
        state: game,
        turns: 30,
        cause: 'tainted meat',
        type: SICK_VOMITABLE,
    });
    const messages = [];

    const result = await vomitHero({
        state: game,
        publish: async message => messages.push(message),
    });

    assert.deepEqual(messages, ['Your jaw gapes convulsively.']);
    assert.equal(result.spewed, false);
    assert.equal(game.u.sick, true);
    assert.equal(game._helplessTurns, 2);
});
