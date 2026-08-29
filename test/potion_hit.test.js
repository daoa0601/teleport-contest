import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import {
    POT_BOOZE, POT_CONFUSION, POT_FRUIT_JUICE, POT_FULL_HEALING,
    POT_GAIN_LEVEL, POT_HEALING, POT_RESTORE_ABILITY, POT_SICKNESS, TOWEL,
    LENSES, POT_BLINDNESS, POT_PARALYSIS, POT_SLEEPING, POT_SPEED,
    POT_INVISIBILITY, POT_WATER, SPEED_BOOTS,
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

test('paralysis freezes a moving monster and clears its wait strategy',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 1,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 1,
            mfrozen: 0,
            meating: 3,
            mstrategy: 0x20000020,
        };
        let wakeCount = 0;

        initRng(3002n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_PARALYSIS),
            targetVisible: true,
            publish: async () => {},
            wakeMonster: async () => { wakeCount++; },
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=4', 'rn2(5)=2', 'rnd(25)=18',
        ]);
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 18);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0x20);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.paralyzed, true);
    });

test('paralysis does not reroll or replace an existing frozen duration',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 1,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 0,
            mfrozen: 9,
            meating: 2,
            mstrategy: 0x20000020,
        };

        initRng(3003n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_PARALYSIS),
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=4', 'rn2(5)=2']);
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 9);
        assert.equal(monster.meating, 2);
        assert.equal(monster.mstrategy, 0x20000020);
        assert.equal(result.directEffect.paralyzed, false);
    });

test('sleeping potion pays duration then resistance and freezes a target',
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
            mcanmove: 1,
            mfrozen: 2,
            meating: 4,
            mstrategy: 0x20000020,
        };
        const messages = [];
        let wakeCount = 0;

        initRng(3050n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async target => {
                wakeCount++;
                target.msleeping = 0;
            },
            showShield: async () => assert.fail('susceptible target shielded'),
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=5', 'rn2(5)=3', 'rnd(12)=7', 'rn2(105)=10',
        ]);
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 9);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0x20000020);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.slept, true);
        assert.equal(messages.at(-1), 'The killer bee falls asleep.');
    });

test('sleep-resistant monster shields without a magic-resistance draw',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_ENERGY_VORTEX,
            m_lev: 6,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 1,
            mfrozen: 0,
        };
        let shieldCount = 0;

        initRng(3051n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async () => {},
            wakeMonster: async () => {},
            showShield: async target => {
                shieldCount++;
                assert.equal(target, monster);
            },
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=2', 'rn2(5)=1', 'rnd(12)=10',
        ]);
        assert.equal(monster.mcanmove, 1);
        assert.equal(monster.mfrozen, 0);
        assert.equal(shieldCount, 1);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(result.directEffect.slept, false);
    });

test('magic-resistant sleep target pays its potion resistance draw and shields',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 48,
            m_lev: 9,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 1,
            mfrozen: 0,
        };
        let shieldCount = 0;

        initRng(3050n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async () => {},
            wakeMonster: async () => {},
            showShield: async () => { shieldCount++; },
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=5', 'rn2(5)=3', 'rnd(12)=7', 'rn2(97)=54',
        ]);
        assert.equal(monster.mcanmove, 1);
        assert.equal(monster.mfrozen, 0);
        assert.equal(shieldCount, 1);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(result.directEffect.slept, false);
    });

test('successful sleeping potion releases a non-engulfing monster grip',
    async () => {
        resetGame();
        const monster = {
            mnum: 1,
            m_lev: 1,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 1,
            mfrozen: 0,
        };
        game.u = {
            hallucinationTurns: 0,
            uswallow: 0,
            ustuck: monster,
        };
        const messages = [];

        initRng(3050n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => {},
            showShield: async () => assert.fail('susceptible target shielded'),
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=5', 'rn2(5)=3', 'rnd(12)=7', 'rn2(105)=10',
        ]);
        assert.equal(result.directEffect.slept, true);
        assert.equal(game.u.ustuck, null);
        assert.deepEqual(messages.slice(-2), [
            'The killer bee falls asleep.',
            "The killer bee's grip relaxes.",
        ]);
    });

test('speed potion makes an active normal-speed monster permanently fast',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 1,
            msleeping: 0,
            mfrozen: 0,
            permspeed: 0,
            mspeed: 0,
            minvent: [],
        };
        const messages = [];
        let wakeCount = 0;

        initRng(3200n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SPEED),
            targetVisible: true,
            targetSpotted: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => { wakeCount++; },
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.equal(monster.permspeed, 2);
        assert.equal(monster.mspeed, 2);
        assert.equal(wakeCount, 0);
        assert.equal(result.directEffect.angered, false);
        assert.deepEqual(messages.slice(-1), [
            'The purple worm is suddenly moving faster.',
        ]);
    });

test('worn speed boots keep effective speed fast while potion removes slow',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcanmove: 1,
            msleeping: 0,
            mfrozen: 0,
            permspeed: 1,
            mspeed: 2,
            minvent: [{ otyp: SPEED_BOOTS, owornmask: 0x20 }],
        };
        const messages = [];

        initRng(3200n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SPEED),
            targetVisible: true,
            targetSpotted: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => assert.fail('speed angered target'),
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.equal(monster.permspeed, 0);
        assert.equal(monster.mspeed, 2);
        assert.equal(result.directEffect.speedChanged, false);
        assert.deepEqual(messages.slice(-1), [
            'The potion of speed evaporates.',
        ]);
    });

test('speed potion silently wakes a sleeping monster without hostile wakeup',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
            mfrozen: 0,
            permspeed: 0,
            mspeed: 0,
            minvent: [],
        };
        const messages = [];

        initRng(3200n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SPEED),
            targetVisible: true,
            targetSpotted: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => assert.fail('speed angered target'),
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.equal(monster.msleeping, 0);
        assert.equal(monster.mspeed, 2);
        assert.equal(result.directEffect.speedMessage, null);
        assert.deepEqual(messages.slice(-1), [
            'The potion of speed evaporates.',
        ]);
    });

test('blindness pays both duration draws before failed monster resistance',
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
            mcansee: 1,
            mblinded: 10,
        };

        initRng(3202n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_BLINDNESS),
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=5', 'rn2(5)=0', 'rn2(32)=5', 'rn2(32)=19',
            'rn2(105)=37',
        ]);
        assert.equal(monster.mcansee, 0);
        assert.equal(monster.mblinded, 98);
        assert.equal(result.directEffect.resisted, false);
        assert.equal(result.directEffect.blindnessAdded, 88);
    });

test('resisted blindness excludes only the second already-consumed duration',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: 48,
            m_lev: 9,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            mcansee: 1,
            mblinded: 5,
        };

        initRng(3210n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_BLINDNESS),
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });

        assert.deepEqual(getRngLog(), [
            'rn2(7)=3', 'rn2(5)=3', 'rn2(32)=1', 'rn2(32)=3',
            'rn2(97)=75',
        ]);
        assert.equal(monster.mcansee, 0);
        assert.equal(monster.mblinded, 70);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(result.directEffect.blindnessAdded, 65);
    });

test('eyeless and permanently blind monsters skip blindness effect RNG',
    async () => {
        for (const [mnum, mcansee, mblinded] of [
            [PM_ENERGY_VORTEX, 1, 0],
            [1, 0, 0],
        ]) {
            resetGame();
            game.u = { hallucinationTurns: 0 };
            const monster = {
                mnum, mx: 10, my: 10, mhp: 20, mhpmax: 20,
                mcansee, mblinded,
            };
            initRng(3202n);
            enableRngLog();
            const result = await hitMonsterWithSupportedPotion({
                state: game,
                monster,
                potion: potionObject(POT_BLINDNESS),
                targetVisible: false,
                publish: async () => {},
                wakeMonster: async () => {},
            });
            assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=0']);
            assert.equal(result.directEffect.blinded, false);
        }
    });

test('uncursed invisibility hides a spotted monster and records map memory',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            minvis: 0,
            perminvis: 0,
            invis_blkd: 0,
            msleeping: 1,
        };
        const messages = [];
        let repaintCount = 0;
        let memoryCount = 0;

        initRng(3200n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_INVISIBILITY),
            targetVisible: true,
            spotMonster: target => !target.minvis,
            repaintMonster: async () => { repaintCount++; },
            rememberInvisible: async () => { memoryCount++; },
            publish: async message => messages.push(message),
            wakeMonster: async () => assert.fail('invisibility angered target'),
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.equal(monster.perminvis, 1);
        assert.equal(monster.minvis, 1);
        assert.equal(monster.msleeping, 0);
        assert.equal(repaintCount, 1);
        assert.equal(memoryCount, 1);
        assert.equal(result.directEffect.angered, false);
        assert.deepEqual(messages, [
            "The jar crashes on the purple worm's head and breaks into shards.",
            'The potion of invisibility evaporates.',
        ]);
    });

test('cursed invisibility reveals an unseen invisible monster and angers it',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            minvis: 1,
            perminvis: 1,
            invis_blkd: 0,
            msleeping: 1,
        };
        const potion = potionObject(POT_INVISIBILITY);
        potion.cursed = true;
        const messages = [];
        let wakeCount = 0;
        let repaintCount = 0;

        initRng(3200n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: target => !target.minvis,
            repaintMonster: async () => { repaintCount++; },
            rememberInvisible: async () => assert.fail('visible target mapped'),
            publish: async message => messages.push(message),
            wakeMonster: async target => {
                wakeCount++;
                target.msleeping = 0;
            },
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.equal(monster.perminvis, 0);
        assert.equal(monster.minvis, 0);
        assert.equal(monster.msleeping, 0);
        assert.equal(repaintCount, 1);
        assert.equal(wakeCount, 1);
        assert.equal(result.directEffect.angered, true);
        assert.deepEqual(messages.slice(-1), ['The purple worm appears!']);
    });

test('cursed invisibility uses sensor-spotted transparency presentation',
    async () => {
        resetGame();
        game.u = { hallucinationTurns: 0 };
        const monster = {
            mnum: PM_PURPLE_WORM,
            mx: 10,
            my: 10,
            mhp: 20,
            mhpmax: 20,
            minvis: 1,
            perminvis: 1,
            invis_blkd: 0,
        };
        const potion = potionObject(POT_INVISIBILITY);
        potion.cursed = true;
        const messages = [];

        initRng(3200n);
        enableRngLog();
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: () => true,
            repaintMonster: async () => {},
            rememberInvisible: async () => assert.fail('sensed target mapped'),
            publish: async message => messages.push(message),
            wakeMonster: async () => {},
        });

        assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
        assert.equal(monster.minvis, 0);
        assert.equal(result.directEffect.angered, true);
        assert.deepEqual(messages.slice(-1), [
            'The purple worm briefly seems to be transparent.',
        ]);
    });

test('blocked invisibility changes only the permanent property', async () => {
    resetGame();
    game.u = { hallucinationTurns: 0 };
    const monster = {
        mnum: PM_PURPLE_WORM,
        mx: 10,
        my: 10,
        mhp: 20,
        mhpmax: 20,
        minvis: 0,
        perminvis: 0,
        invis_blkd: 1,
        msleeping: 1,
    };

    initRng(3200n);
    enableRngLog();
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion: potionObject(POT_INVISIBILITY),
        targetVisible: true,
        spotMonster: () => true,
        repaintMonster: async () => assert.fail('blocked target repainted'),
        rememberInvisible: async () => assert.fail('blocked target mapped'),
        publish: async () => {},
        wakeMonster: async () => assert.fail('invisibility angered target'),
    });

    assert.deepEqual(getRngLog(), ['rn2(7)=5', 'rn2(5)=4']);
    assert.equal(monster.perminvis, 1);
    assert.equal(monster.minvis, 0);
    assert.equal(monster.msleeping, 0);
    assert.equal(result.directEffect.angered, false);
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

test('paralysis vapor installs live helpless state and Dexterity exercise',
    async () => {
        resetGame();
        game.u = {
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        };
        const messages = [];

        initRng(3011n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_PARALYSIS),
            publish: async message => messages.push(message),
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=5', 'rn2(2)=1']);
        assert.deepEqual(messages, ['Something seems to be holding you.']);
        assert.equal(game._helplessTurns, 5);
        assert.equal(game._helplessReason, 'frozen by a potion');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(game.u._exercise[1], -1);
        assert.equal(result.helplessDuration, 5);
    });

test('free action converts paralysis vapor into a zero-RNG momentary stiffen',
    async () => {
        resetGame();
        game.u = { freeAction: true };
        const messages = [];

        initRng(3002n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_PARALYSIS),
            publish: async message => messages.push(message),
        });

        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(messages, ['You stiffen momentarily.']);
        assert.equal(game._helplessTurns, undefined);
        assert.equal(result.resisted, true);
    });

test('sleeping vapor installs its distinct helpless reason', async () => {
    resetGame();
    game.u = {
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    };
    const messages = [];

    initRng(3001n);
    enableRngLog();
    const result = await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SLEEPING),
        publish: async message => messages.push(message),
    });

    assert.deepEqual(getRngLog(), ['rnd(5)=5', 'rn2(2)=0']);
    assert.deepEqual(messages, ['You feel rather tired.']);
    assert.equal(game._helplessTurns, 5);
    assert.equal(game._helplessReason, 'sleeping off a magical draught');
    assert.equal(game._helplessDoneMessage, 'You can move again.');
    assert.equal(game.u._exercise[1], 0);
    assert.equal(result.helplessDuration, 5);
});

test('sleep resistance teaches only eligible observers on the yawn path',
    async () => {
        resetGame();
        game.u = {
            ux: 10, uy: 10, sleepResistance: true,
        };
        game.level = {
            monsters: [
                { mnum: 1, mx: 11, my: 10, mhp: 4, seen_resistance: 1 },
                { mnum: 1, mx: 12, my: 10, mhp: 0, seen_resistance: 2 },
            ],
        };
        const messages = [];

        initRng(3001n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_SLEEPING),
            publish: async message => messages.push(message),
            monsterCanSeeHero: monster => monster.mhp > 0,
        });

        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(messages, ['You yawn.']);
        assert.equal(game._helplessTurns, undefined);
        assert.equal(game.level.monsters[0].seen_resistance, 0x0009);
        assert.equal(game.level.monsters[1].seen_resistance, 2);
        assert.equal(result.resisted, true);
    });

test('speed vapor installs timed very-fast movement and exercises Dexterity',
    async () => {
        resetGame();
        game.u = {
            fast: false,
            veryFast: false,
            veryFastTurns: 0,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        };
        const messages = [];

        initRng(3220n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_SPEED),
            publish: async message => messages.push(message),
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=1', 'rn2(19)=18']);
        assert.deepEqual(messages, ['Your knees seem more flexible now.']);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 1);
        assert.equal(game.u._exercise[1], 1);
        assert.equal(result.speedDuration, 1);
    });

test('existing intrinsic speed suppresses prose but not duration or exercise',
    async () => {
        resetGame();
        game.u = {
            fast: true,
            veryFast: false,
            veryFastTurns: 3,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        };
        const messages = [];

        initRng(3220n);
        enableRngLog();
        await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_SPEED),
            publish: async message => messages.push(message),
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=1', 'rn2(19)=18']);
        assert.deepEqual(messages, []);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 4);
        assert.equal(game.u._exercise[1], 1);
    });

test('speed vapor saturates the timed very-fast counter', async () => {
    resetGame();
    game.u = {
        fast: true,
        veryFast: true,
        veryFastTurns: 0x00fffffe,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    };

    initRng(3222n);
    enableRngLog();
    await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SPEED),
        publish: async () => {},
    });

    assert.deepEqual(getRngLog(), ['rnd(5)=4', 'rn2(19)=17']);
    assert.equal(game.u.veryFastTurns, 0x00ffffff);
    assert.equal(game.u._exercise[1], 1);
});

test('blindness vapor darkens sight immediately and extends the live timeout',
    async () => {
        resetGame();
        game.u = { blindTurns: 0 };
        game.blind = false;
        const messages = [];
        let recalcCount = 0;

        initRng(3222n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async message => messages.push(message),
            recalculateVision: () => { recalcCount++; },
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=4']);
        assert.deepEqual(messages, ['It suddenly gets dark.']);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(game.vision_full_recalc, 1);
        assert.equal(recalcCount, 1);
        assert.equal(result.blindnessDuration, 4);
        assert.equal(result.sightToggled, true);
    });

test('Eyes-blocked blindness vapor brackets the timeout with vision prose',
    async () => {
        resetGame();
        game.u = { blindTurns: 0 };
        game.ublindf = {
            otyp: LENSES,
            oartifact: 0,
            oextra: { oname: 'The Eyes of the Overworld' },
        };
        const messages = [];
        let recalcCount = 0;

        initRng(3222n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async message => messages.push(message),
            recalculateVision: () => { recalcCount++; },
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=4']);
        assert.deepEqual(messages, [
            'It suddenly gets dark.', 'Your vision clears.',
        ]);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, false);
        assert.equal(recalcCount, 0);
        assert.equal(result.sightToggled, false);
    });

test('unaware blindness vapor mutates sight without transition prose',
    async () => {
        resetGame();
        game.u = { blindTurns: 0, unaware: true };
        game.blind = false;
        const messages = [];
        let recalcCount = 0;

        initRng(3222n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async message => messages.push(message),
            recalculateVision: () => { recalcCount++; },
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=4']);
        assert.deepEqual(messages, []);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(recalcCount, 1);
        assert.equal(result.sightToggled, true);
    });

test('blindness vapor saturates an already-blind timeout without repaint',
    async () => {
        resetGame();
        game.u = { blindTurns: 0x00fffffe };
        game.blind = true;
        let recalcCount = 0;

        initRng(3222n);
        enableRngLog();
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async () => assert.fail('active blindness announced'),
            recalculateVision: () => { recalcCount++; },
        });

        assert.deepEqual(getRngLog(), ['rnd(5)=4']);
        assert.equal(game.u.blindTurns, 0x00ffffff);
        assert.equal(game.blind, true);
        assert.equal(recalcCount, 0);
        assert.equal(result.sightToggled, false);
    });

test('invisibility vapor reports only the clear visible-self glimpse',
    async () => {
        const cases = [
            {
                hero: {},
                messages: ["For an instant you couldn't see yourself!"],
                glimpse: 'unseen',
            },
            {
                hero: { seeInvisible: true },
                messages: ['For an instant you could see right through yourself!'],
                glimpse: 'transparent',
            },
            { hero: { blindTurns: 1 }, messages: [], glimpse: null },
            { hero: { invisibleTurns: 1 }, messages: [], glimpse: null },
        ];

        for (const witness of cases) {
            resetGame();
            game.u = witness.hero;
            const messages = [];
            initRng(3200n);
            enableRngLog();
            const result = await applySupportedPotionVapor({
                state: game,
                potion: potionObject(POT_INVISIBILITY),
                publish: async message => messages.push(message),
            });
            assert.deepEqual(getRngLog(), []);
            assert.deepEqual(messages, witness.messages);
            assert.equal(result.invisibilityGlimpse, witness.glimpse);
        }
    });

test('water vapor is a received zero-RNG no-op', async () => {
    resetGame();
    game.u = { uhp: 7, uhpmax: 12 };
    const messages = [];

    initRng(3400n);
    enableRngLog();
    const result = await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_WATER),
        publish: async message => messages.push(message),
    });

    assert.deepEqual(getRngLog(), []);
    assert.deepEqual(messages, []);
    assert.equal(game.u.uhp, 7);
    assert.equal(result.received, true);
    assert.equal(result.waterEffect, null);
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
