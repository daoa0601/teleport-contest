import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import {
    POT_BOOZE, POT_CONFUSION, POT_FRUIT_JUICE, POT_FULL_HEALING,
    POT_GAIN_LEVEL, POT_HEALING, POT_RESTORE_ABILITY, POT_SICKNESS, TOWEL,
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

test('sickness halves a susceptible monster after the common impact chip',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 40,
            msleeping: 1,
        };
        const potion = potionObject(POT_SICKNESS);
        const messages = [];
        let wakeCount = 0;

        initRng(2860n);
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

        assert.deepEqual(getRngLog(), ['rn2(7)=0', 'rn2(5)=2']);
        assert.deepEqual(messages, [
            "The bottle crashes on the purple worm's head and breaks into shards.",
            'The potion of sickness evaporates.',
            'The purple worm looks rather ill.',
        ]);
        assert.equal(monster.mhp, 9);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.angered, true);
        assert.equal(potion.where, 'gone');
    });

test('sickness leaves poison-resistant monsters unharmed after impact',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 1,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
        };
        const potion = potionObject(POT_SICKNESS);
        const messages = [];

        initRng(2861n);
        enableRngLog();
        await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => {},
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=3', 'rn2(5)=4']);
        assert.deepEqual(messages, [
            "The carafe crashes on the killer bee's head and breaks into shards.",
            'The potion of sickness evaporates.',
            'The killer bee looks unharmed.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(potion.where, 'gone');
    });

test('sickness heals Pestilence and clears sleep without anger', async () => {
    resetGame();
    game.u = { hallucinationTurns: 0 };
    const monster = {
        mnum: 312,
        mx: 10,
        my: 10,
        mhp: 20,
        mhpmax: 40,
        msleeping: 1,
    };
    const potion = potionObject(POT_SICKNESS);
    const messages = [];
    let wakeCount = 0;

    initRng(2862n);
    enableRngLog();
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        publish: async message => messages.push(message),
        wakeMonster: async () => { wakeCount++; },
    });

    assert.deepEqual(getRngLog(), ['rn2(7)=1', 'rn2(5)=3']);
    assert.deepEqual(messages, [
        "The phial crashes on Pestilence's head and breaks into shards.",
        'The potion of sickness evaporates.',
        'Pestilence looks sound and hale again.',
    ]);
    assert.equal(monster.mhp, 40);
    assert.equal(monster.msleeping, 0);
    assert.equal(wakeCount, 0);
    assert.equal(result.directEffect.angered, false);
    assert.equal(potion.where, 'gone');
});

test('confusion potion confuses a monster after its resistance draw',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 1,
            m_lev: 1,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mconf: 0,
        };
        const potion = potionObject(POT_CONFUSION);
        const messages = [];
        let wakeCount = 0;

        initRng(2950n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => { wakeCount++; },
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=2', 'rn2(5)=1', 'rn2(105)=52',
        ]);
        assert.deepEqual(messages, [
            "The flagon crashes on the killer bee's head and breaks into shards.",
            'The potion of confusion evaporates.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(monster.mconf, 1);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.resisted, false);
        assert.equal(potion.where, 'gone');
    });

test('booze leaves a magic-resistant monster unconfused but still wakes it',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 312,
            m_lev: 30,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mconf: 0,
        };
        const potion = potionObject(POT_BOOZE);
        const messages = [];
        let wakeCount = 0;

        initRng(2951n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => { wakeCount++; },
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=1', 'rn2(5)=3', 'rn2(76)=5',
        ]);
        assert.deepEqual(messages, [
            "The phial crashes on Pestilence's head and breaks into shards.",
            'The potion of booze evaporates.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(monster.mconf, 0);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(potion.where, 'gone');
    });

test('zero-level player monsters defend with the hero level', async () => {
    resetGame();
    game.u = { hallucinationTurns: 0, ulevel: 20 };
    const monster = {
        mnum: 343,
        m_lev: 0,
        mx: 10,
        my: 10,
        mhp: 20,
        mhpmax: 20,
        mconf: 0,
    };
    const potion = potionObject(POT_CONFUSION);

    initRng(3004n);
    enableRngLog();
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: false,
        publish: async () => {},
        wakeMonster: async () => {},
    });

    assert.deepEqual(getRngLog(), [
        'rn2(7)=2', 'rn2(5)=0', 'rn2(86)=0',
    ]);
    assert.equal(monster.mhp, 20);
    assert.equal(monster.mconf, 0);
    assert.equal(result.directEffect.resisted, true);
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

test('sickness vapor damages only the active polymorph form', async () => {
    resetGame();
    game.urole = { key: 'tourist' };
    game.u = {
        mtimedone: 10,
        mh: 12,
        mhmax: 20,
        uhp: 30,
        uhpmax: 30,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    };

    initRng(2864n);
    enableRngLog();
    await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SICKNESS),
        publish: async () => {},
    });

    assert.deepEqual(getRngLog(), ['rn2(2)=1']);
    assert.equal(game.u.mh, 7);
    assert.equal(game.u.uhp, 30);
    assert.equal(game.u._exercise[2], -1);
});

test('Healer role is immune to sickness vapor', async () => {
    resetGame();
    game.urole = { key: 'healer' };
    game.u = {
        uhp: 12,
        uhpmax: 30,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    };

    initRng(2864n);
    enableRngLog();
    const result = await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SICKNESS),
        publish: async () => {},
    });

    assert.deepEqual(getRngLog(), []);
    assert.equal(result.received, true);
    assert.equal(game.u.uhp, 12);
    assert.equal(game.u._exercise, undefined);
});

test('sickness vapor cannot reduce base HP below one', async () => {
    resetGame();
    game.urole = { key: 'tourist' };
    game.u = {
        uhp: 4,
        uhpmax: 30,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    };

    initRng(2864n);
    enableRngLog();
    await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SICKNESS),
        publish: async () => {},
    });

    assert.deepEqual(getRngLog(), ['rn2(2)=1']);
    assert.equal(game.u.uhp, 1);
    assert.equal(game.u._exercise[2], -1);
});

test('confusion vapor announces and increments a clear hero timeout',
    async () => {
        resetGame();
        game.u = { confusionTurns: 0 };
        const messages = [];

        initRng(2954n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_CONFUSION),
            publish: async message => messages.push(message),
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=3']);
        assert.deepEqual(messages, ['You feel somewhat dizzy.']);
        assert.equal(game.u.confusionTurns, 3);
        assert.equal(result.confusionDuration, 3);
    });

test('booze vapor silently extends and caps an existing confusion timeout',
    async () => {
        resetGame();
        game.u = { confusionTurns: 0x00fffffe };
        const messages = [];

        initRng(2957n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BOOZE),
            publish: async message => messages.push(message),
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=4']);
        assert.deepEqual(messages, []);
        assert.equal(game.u.confusionTurns, 0x00ffffff);
        assert.equal(result.confusionDuration, 4);
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
