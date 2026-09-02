import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, SICK_NONVOMITABLE, SICK_VOMITABLE, W_ARM,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    advanceHeroSickness, advanceHeroVomiting, startHeroSickness,
    startHeroVomiting, vomitHero,
} from '../js/hero_illness.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CHAIN_MAIL, LONG_SWORD } from '../js/object_data.js';
import {
    knownInventoryObject, knownInventoryWeapon,
} from './support/game-objects.js';
import { wearHeroObject } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_SEWER_RAT = MONSTER_NAME.indexOf('sewer rat');
const PM_YELLOW_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
const PM_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');

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

test('a vomiting yellow dragon breathes acid on its weapon and armor',
    async () => {
        freshIllnessRoom();
        Object.assign(game.u, {
            umonster: PM_ARCHEOLOGIST,
            umonnum: PM_YELLOW_DRAGON,
            mtimedone: 20,
            mh: 40,
            mhmax: 40,
        });
        const sword = knownInventoryWeapon(LONG_SWORD);
        game.uwep = sword;
        game.u.uwep = sword;
        const mail = wearHeroObject(
            knownInventoryObject(CHAIN_MAIL), 'uarm', W_ARM,
        );
        const rolls = [0, 0, 1];
        const messages = [];

        await vomitHero({
            state: game,
            publish: async message => messages.push(message),
            random: range => {
                const value = rolls.shift();
                assert.ok(value >= 0 && value < range);
                return value;
            },
        });

        assert.deepEqual(messages, [
            'You breathe acid on yourself...',
            "The acid doesn't hurt.",
            'Your long sword corrodes!',
            'Your chain mail corrodes!',
        ]);
        assert.equal(game.u.mh, 40);
        assert.equal(sword.oeroded2, 1);
        assert.equal(mail.oeroded2, 1);
    });
