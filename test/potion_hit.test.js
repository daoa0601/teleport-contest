import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import {
    POT_FRUIT_JUICE, POT_FULL_HEALING, POT_GAIN_LEVEL, POT_HEALING,
    POT_RESTORE_ABILITY, TOWEL,
} from '../js/object_data.js';
import {
    applySupportedPotionVapor, hitMonsterWithInertPotion,
    hitMonsterWithSupportedPotion,
} from '../js/potion_hit.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';

const PM_ENERGY_VORTEX = 109;
const PM_PURPLE_WORM = 115;

function potionObject(otyp) {
    return {
        otyp,
        oclass: 8,
        quan: 1,
        quantity: 1,
        dknown: true,
        typeKnown: true,
        where: 'free',
        objectTimers: [],
    };
}

test('visible inert potion impact names a headed monster and evaporates',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM, mx: 10, my: 10, mhp: 8, mhpmax: 8,
        };
        const potion = potionObject(POT_FRUIT_JUICE);
        const messages = [];
        let wakeCount = 0;

        initRng(2601n);
        enableRngLog();
        const result = await hitMonsterWithInertPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => { wakeCount++; },
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.deepEqual(messages, [
            'The jar crashes on the purple worm\'s head and breaks into shards.',
            'The potion of fruit juice evaporates.',
        ]);
        assert.equal(result.impactDamage, 1);
        assert.equal(monster.mhp, 7);
        assert.equal(wakeCount, 1);
        assert.equal(potion.where, 'gone');
        assert.deepEqual(potion.objectTimers, []);
    });

test('hallucinated inert potion impact names a visible headless monster',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 4 };
        const monster = {
            mnum: PM_ENERGY_VORTEX, mx: 10, my: 10, mhp: 8, mhpmax: 8,
        };
        const potion = potionObject(POT_GAIN_LEVEL);
        const messages = [];

        initRng(2602n);
        enableRngLog();
        await hitMonsterWithInertPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => {},
        });

        assert.deepEqual(getRngLog(), ['rn2(24)=19', 'rn2(5)=1']);
        assert.deepEqual(messages, [
            'The amphora crashes on the energy vortex and breaks into shards.',
            'The potion of gain level evaporates.',
        ]);
        assert.equal(monster.mhp, 7);
        assert.equal(potion.where, 'gone');
    });

test('healing potion makes Pestilence ill and retains hostile wake policy',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 312,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 40,
            mcansee: 1,
            msleeping: 1,
        };
        const potion = potionObject(POT_HEALING);
        const messages = [];
        let wakeCount = 0;

        initRng(2830n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async target => {
                wakeCount++;
                target.msleeping = 0;
            },
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=2', 'rn2(5)=2']);
        assert.deepEqual(messages, [
            "The flagon crashes on Pestilence's head and breaks into shards.",
            'The potion of healing evaporates.',
            'Pestilence looks rather ill.',
        ]);
        assert.equal(monster.mhp, 9);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.angered, true);
        assert.equal(potion.where, 'gone');
    });

test('ability potion heals a peaceful monster without angering it', async () => {
    resetGame();
    game.u = { hallucinationTurns: 0 };
    const monster = {
        mnum: PM_PURPLE_WORM,
        mx: 10,
        my: 10,
        mhp: 3,
        mhpmax: 12,
        mcansee: 1,
        msleeping: 1,
        mpeaceful: 1,
    };
    const potion = potionObject(POT_RESTORE_ABILITY);
    const messages = [];
    let wakeCount = 0;

    initRng(2831n);
    enableRngLog();
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        publish: async message => messages.push(message),
        wakeMonster: async () => { wakeCount++; },
    });

    assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=2']);
    assert.deepEqual(messages, [
        "The jar crashes on the purple worm's head and breaks into shards.",
        'The potion of restore ability evaporates.',
        'The purple worm looks sound and hale again.',
    ]);
    assert.equal(monster.mhp, 12);
    assert.equal(monster.msleeping, 0);
    assert.equal(monster.mpeaceful, 1);
    assert.equal(wakeCount, 0);
    assert.equal(result.directEffect.angered, false);
    assert.equal(potion.where, 'gone');
});

test('uncursed restore-ability vapor repairs only the first reduced attribute',
    async () => {
        resetGame();
        game.u = {
            acurr: { a: [12, 10, 12, 12, 8, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        };
        const potion = potionObject(POT_RESTORE_ABILITY);

        initRng(2845n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });

        assert.deepEqual(getRngLog(), ['rn2(6)=4']);
        assert.equal(result.abilityStart, 4);
        assert.deepEqual(game.u.acurr.a, [12, 10, 12, 12, 9, 12]);
    });

test('full-healing vapor heals both polymorph and base HP per fallthrough',
    async () => {
        resetGame();
        game.u = {
            mtimedone: 10,
            mh: 1,
            mhmax: 10,
            uhp: 20,
            uhpmax: 30,
            blindTurns: 4,
            deafTurns: 5,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        };
        const potion = potionObject(POT_FULL_HEALING);
        potion.cursed = true;

        initRng(2847n);
        enableRngLog();
        await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });

        assert.deepEqual(getRngLog(), ['rn2(19)=15']);
        assert.equal(game.u.mh, 4);
        assert.equal(game.u.uhp, 23);
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(game.u._exercise[2], 1);
    });

test('vapor respects breathless forms with and without eyes', async () => {
    resetGame();
    game.u = {
        umonnum: 109,
        uhp: 10,
        uhpmax: 20,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    };
    const healing = potionObject(POT_FULL_HEALING);
    const silentMessages = [];
    const blocked = await applySupportedPotionVapor({
        state: game,
        potion: healing,
        publish: async message => silentMessages.push(message),
    });

    assert.equal(blocked.received, false);
    assert.equal(game.u.uhp, 10);
    assert.deepEqual(silentMessages, []);

    game.u.umonnum = 29;
    const restore = potionObject(POT_RESTORE_ABILITY);
    restore.cursed = true;
    const eyeMessages = [];
    const received = await applySupportedPotionVapor({
        state: game,
        potion: restore,
        publish: async message => eyeMessages.push(message),
    });

    assert.equal(received.received, true);
    assert.deepEqual(eyeMessages, ['Your eyes sting!']);

    delete game.u.umonnum;
    game.ublindf = { otyp: TOWEL, spe: 1 };
    const shieldedMessages = [];
    const shielded = await applySupportedPotionVapor({
        state: game,
        potion: healing,
        publish: async message => shieldedMessages.push(message),
    });

    assert.equal(shielded.shielded, true);
    assert.equal(game.u.uhp, 10);
    assert.deepEqual(shieldedMessages,
        ['Some vapor passes harmlessly around you.']);
});
