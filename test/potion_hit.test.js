import test from 'node:test';
import assert from 'node:assert/strict';

import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import {
    POT_BOOZE, POT_CONFUSION, POT_FRUIT_JUICE, POT_FULL_HEALING,
    POT_GAIN_LEVEL, POT_HEALING, POT_RESTORE_ABILITY, POT_SICKNESS, TOWEL,
    LENSES, POT_BLINDNESS, POT_PARALYSIS, POT_SLEEPING, POT_SPEED,
    POT_INVISIBILITY, POT_WATER, RIN_POLYMORPH_CONTROL, SPEED_BOOTS,
} from '../js/object_data.js';
import {
    applySupportedPotionVapor, hitMonsterWithInertPotion,
    hitMonsterWithSupportedPotion,
} from '../js/potion_hit.js';
import { pushKey, pushKeys, resetInputState } from '../js/input.js';
import { parseNethackrc } from '../js/options.js';
import { initRng } from '../js/rng.js';

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

function installDirectWereHero({ beast = false } = {}) {
    resetGame();
    resetInputState();
    game.level = new GameMap();
    game.inventory = [];
    game.flags = { female: false };
    game.urole = { key: 'archeologist', mnum: 0 };
    game.urace = {
        name: 'human', noun: 'human', adj: 'human', mnum: 260,
    };
    game.u = {
        ux: 10, uy: 10,
        umonster: 331, umonnum: beast ? 21 : 331, ulycn: 21,
        mtimedone: beast ? 350 : 0,
        mh: beast ? 18 : 0,
        mhmax: beast ? 24 : 0,
        uhp: 40, uhpmax: 40,
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
        macurr: { a: Array(6).fill(12) },
        mamax: { a: Array(6).fill(12) },
    };
}

function installPolymorphControl() {
    const ring = {
        otyp: RIN_POLYMORPH_CONTROL, worn: true, owornmask: 1,
    };
    game.u.uright = game.uright = ring;
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

        initRng(2601n);
        const result = await hitMonsterWithInertPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
        });
        assert.deepEqual(messages, [
            'The jar crashes on the purple worm\'s head and breaks into shards.',
            'The potion of fruit juice evaporates.',
        ]);
        assert.equal(result.impactDamage, 1);
        assert.equal(monster.mhp, 7);
        assert.equal(potion.where, 'gone');
        assert.deepEqual(potion.objectTimers, []);
    });

test('an existing potion call name suppresses trycall and remains visible',
    async () => {
        resetGame();
        resetInputState();
        game.u = { hallucinationTurns: 0 };
        game._knownObjectTypes = new Set();
        game._objectCallNames = { [POT_FRUIT_JUICE]: 'mystery' };
        const monster = {
            mnum: PM_PURPLE_WORM, mx: 10, my: 10, mhp: 8, mhpmax: 8,
        };
        const potion = potionObject(POT_FRUIT_JUICE);
        potion.typeKnown = false;
        const messages = [];

        initRng(2601n);
        const result = await hitMonsterWithInertPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
        });

        assert.match(messages[1], /potion called mystery evaporates\.$/);
        assert.equal(result.typeCall.prompted, false);
        assert.equal(game._objectCallNames[POT_FRUIT_JUICE], 'mystery');
        assert.equal(potion.where, 'gone');
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
        await hitMonsterWithInertPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => {},
        });
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

        initRng(2830n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The flagon crashes on Pestilence's head and breaks into shards.",
            'The potion of healing evaporates.',
            'Pestilence looks rather ill.',
        ]);
        assert.equal(monster.mhp, 9);
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

        initRng(2860n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The bottle crashes on the purple worm's head and breaks into shards.",
            'The potion of sickness evaporates.',
            'The purple worm looks rather ill.',
        ]);
        assert.equal(monster.mhp, 9);
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
        await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
            wakeMonster: async () => {},
        });
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

    initRng(2862n);
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        publish: async message => messages.push(message),
    });
    assert.deepEqual(messages, [
        "The phial crashes on Pestilence's head and breaks into shards.",
        'The potion of sickness evaporates.',
        'Pestilence looks sound and hale again.',
    ]);
    assert.equal(monster.mhp, 40);
    assert.equal(monster.msleeping, 0);
    assert.equal(result.directEffect.angered, false);
    assert.equal(potion.where, 'gone');
});

test('confusion potion leaves a susceptible monster confused',
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

        initRng(2950n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The flagon crashes on the killer bee's head and breaks into shards.",
            'The potion of confusion evaporates.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(monster.mconf, 1);
        assert.equal(result.directEffect.resisted, false);
        assert.equal(potion.where, 'gone');
    });

test('booze leaves a magic-resistant monster unconfused but hostile',
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

        initRng(2951n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async message => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The phial crashes on Pestilence's head and breaks into shards.",
            'The potion of booze evaporates.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(monster.mconf, 0);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(result.directEffect.angered, true);
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

        initRng(3002n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_PARALYSIS),
            targetVisible: true,
            publish: async () => {},
        });
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 18);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0x20);
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_PARALYSIS),
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });
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

        initRng(3050n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async message => messages.push(message),
        });
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 9);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0x20000020);
        assert.equal(result.directEffect.slept, true);
        assert.equal(messages.at(-1), 'The killer bee falls asleep.');
    });

test('sleep-resistant monster shields and remains awake',
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
        assert.equal(monster.mcanmove, 1);
        assert.equal(monster.mfrozen, 0);
        assert.equal(shieldCount, 1);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(result.directEffect.slept, false);
    });

test('magic-resistant sleep target shields and remains awake',
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async () => {},
            wakeMonster: async () => {},
            showShield: async () => { shieldCount++; },
        });
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SLEEPING),
            targetVisible: true,
            publish: async message => messages.push(message),
        });
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

        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SPEED),
            targetVisible: true,
            targetSpotted: true,
            publish: async message => messages.push(message),
        });
        assert.equal(monster.permspeed, 2);
        assert.equal(monster.mspeed, 2);
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SPEED),
            targetVisible: true,
            targetSpotted: true,
            publish: async message => messages.push(message),
        });
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_SPEED),
            targetVisible: true,
            targetSpotted: true,
            publish: async message => messages.push(message),
        });
        assert.equal(monster.msleeping, 0);
        assert.equal(monster.mspeed, 2);
        assert.equal(result.directEffect.speedMessage, null);
        assert.deepEqual(messages.slice(-1), [
            'The potion of speed evaporates.',
        ]);
    });

test('a resistant monster remains sighted after blindness impact',
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_BLINDNESS),
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_BLINDNESS),
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });
        assert.equal(monster.mcansee, 0);
        assert.equal(monster.mblinded, 70);
        assert.equal(result.directEffect.resisted, true);
        assert.equal(result.directEffect.blindnessAdded, 65);
    });

test('eyeless and permanently blind monsters retain their sight state',
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
            const result = await hitMonsterWithSupportedPotion({
                state: game,
                monster,
                potion: potionObject(POT_BLINDNESS),
                targetVisible: false,
                publish: async () => {},
                wakeMonster: async () => {},
            });
            assert.equal(result.directEffect.blinded, false);
        }
    });

test('uncursed invisibility hides a spotted monster without anger',
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

        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion: potionObject(POT_INVISIBILITY),
            targetVisible: true,
            spotMonster: target => !target.minvis,
            repaintMonster: async () => {},
            rememberInvisible: async () => {},
            publish: async message => messages.push(message),
        });
        assert.equal(monster.perminvis, 1);
        assert.equal(monster.minvis, 1);
        assert.equal(monster.msleeping, 0);
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

        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: target => !target.minvis,
            repaintMonster: async () => {},
            rememberInvisible: async () => {},
            publish: async message => messages.push(message),
        });
        assert.equal(monster.perminvis, 0);
        assert.equal(monster.minvis, 0);
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
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: () => true,
            repaintMonster: async () => {},
            rememberInvisible: async () => {},
            publish: async message => messages.push(message),
        });
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
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion: potionObject(POT_INVISIBILITY),
        targetVisible: true,
        spotMonster: () => true,
        repaintMonster: async () => {},
        rememberInvisible: async () => {},
        publish: async () => {},
    });
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
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: false,
        publish: async () => {},
        wakeMonster: async () => {},
    });
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

    initRng(2831n);
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        publish: async message => messages.push(message),
    });
    assert.deepEqual(messages, [
        "The jar crashes on the purple worm's head and breaks into shards.",
        'The potion of restore ability evaporates.',
        'The purple worm looks sound and hale again.',
    ]);
    assert.equal(monster.mhp, 12);
    assert.equal(monster.msleeping, 0);
    assert.equal(monster.mpeaceful, 1);
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
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });
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
        await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });
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
    await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SICKNESS),
        publish: async () => {},
    });
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
    const result = await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SICKNESS),
        publish: async () => {},
    });
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
    await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SICKNESS),
        publish: async () => {},
    });
    assert.equal(game.u.uhp, 1);
    assert.equal(game.u._exercise[2], -1);
});

test('confusion vapor announces and increments a clear hero timeout',
    async () => {
        resetGame();
        game.u = { confusionTurns: 0 };
        const messages = [];

        initRng(2954n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_CONFUSION),
            publish: async message => messages.push(message),
        });
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
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BOOZE),
            publish: async message => messages.push(message),
        });
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
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_PARALYSIS),
            publish: async message => messages.push(message),
        });
        assert.deepEqual(messages, ['Something seems to be holding you.']);
        assert.equal(game._helplessTurns, 5);
        assert.equal(game._helplessReason, 'frozen by a potion');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(game.u._exercise[1], -1);
        assert.equal(result.helplessDuration, 5);
    });

test('paralysis vapor identifies an unknown type instead of asking to call it',
    async () => {
        resetGame();
        resetInputState();
        game._knownObjectTypes = new Set();
        game._encounteredObjectTypes = new Set();
        game._objectDiscoveryOrder = [];
        game._objectCallNames = {};
        game.u = {
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        };
        const potion = potionObject(POT_PARALYSIS);
        potion.typeKnown = false;
        const messages = [];

        initRng(3011n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async message => messages.push(message),
        });

        assert.deepEqual(messages, ['Something seems to be holding you.']);
        assert.equal(result.identifiesType, true);
        assert.equal(result.typeCall.prompted, false);
        assert.equal(game._knownObjectTypes.has(POT_PARALYSIS), true);
        assert.equal(game._encounteredObjectTypes.has(POT_PARALYSIS), true);
        assert.equal(game._objectCallNames[POT_PARALYSIS], undefined);
    });

test('free action converts paralysis vapor into a momentary stiffen',
    async () => {
        resetGame();
        game.u = { freeAction: true };
        const messages = [];

        initRng(3002n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_PARALYSIS),
            publish: async message => messages.push(message),
        });
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
    const result = await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SLEEPING),
        publish: async message => messages.push(message),
    });
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
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_SLEEPING),
            publish: async message => messages.push(message),
            monsterCanSeeHero: monster => monster.mhp > 0,
        });
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
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_SPEED),
            publish: async message => messages.push(message),
        });
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
        await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_SPEED),
            publish: async message => messages.push(message),
        });
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
    await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_SPEED),
        publish: async () => {},
    });
    assert.equal(game.u.veryFastTurns, 0x00ffffff);
    assert.equal(game.u._exercise[1], 1);
});

test('blindness vapor darkens sight immediately and extends the live timeout',
    async () => {
        resetGame();
        game.u = { blindTurns: 0 };
        game.blind = false;
        const messages = [];

        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async message => messages.push(message),
            recalculateVision: () => {},
        });
        assert.deepEqual(messages, ['It suddenly gets dark.']);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(game.vision_full_recalc, 1);
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

        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async message => messages.push(message),
            recalculateVision: () => {},
        });
        assert.deepEqual(messages, [
            'It suddenly gets dark.', 'Your vision clears.',
        ]);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, false);
        assert.equal(result.sightToggled, false);
    });

test('unaware blindness vapor mutates sight without transition prose',
    async () => {
        resetGame();
        game.u = { blindTurns: 0, unaware: true };
        game.blind = false;
        const messages = [];

        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async message => messages.push(message),
            recalculateVision: () => {},
        });
        assert.deepEqual(messages, []);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(result.sightToggled, true);
    });

test('blindness vapor saturates an already-blind timeout without repaint',
    async () => {
        resetGame();
        game.u = { blindTurns: 0x00fffffe };
        game.blind = true;

        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion: potionObject(POT_BLINDNESS),
            publish: async () => assert.fail('active blindness announced'),
            recalculateVision: () => {},
        });
        assert.equal(game.u.blindTurns, 0x00ffffff);
        assert.equal(game.blind, true);
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
            const result = await applySupportedPotionVapor({
                state: game,
                potion: potionObject(POT_INVISIBILITY),
                publish: async message => messages.push(message),
            });
            assert.deepEqual(messages, witness.messages);
            assert.equal(result.invisibilityGlimpse, witness.glimpse);
        }
    });

test('water vapor leaves an ordinary non-lycanthrope hero unchanged',
    async () => {
    resetGame();
    game.u = { uhp: 7, uhpmax: 12 };
    const messages = [];

    initRng(3400n);
    const result = await applySupportedPotionVapor({
        state: game,
        potion: potionObject(POT_WATER),
        publish: async message => messages.push(message),
    });
    assert.deepEqual(messages, []);
    assert.equal(game.u.uhp, 7);
    assert.equal(result.received, true);
    assert.deepEqual(result.waterEffect, {
        kind: 'ordinary', changed: false,
    });
});

test('blessed water vapor returns a werewolf hero to human form', async () => {
    installDirectWereHero({ beast: true });
    const potion = potionObject(POT_WATER);
    potion.blessed = true;
    const messages = [];

    initRng(3401n);
    const result = await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async message => messages.push(message),
    });
    assert.deepEqual(messages, ['You return to human form!']);
    assert.equal(result.waterEffect.kind, 'rehumanized');
    assert.equal(result.waterEffect.changed, true);
    assert.equal(game.u.umonnum, 331);
    assert.equal(game.u.mtimedone, 0);
    assert.equal(game.u.mh, 0);
    assert.equal(game.u.mhmax, 0);
});

test('controlled cursed vapor accepts change despite a nearby threat',
    async () => {
        installDirectWereHero();
        installPolymorphControl();
        game.u.detectMonsters = true;
        game.level.monsters = [{
            mnum: PM_PURPLE_WORM,
            mx: 11, my: 10,
            mhp: 20, mcanmove: 1, msleeping: 0, mpeaceful: 0,
        }];
        const potion = potionObject(POT_WATER);
        potion.cursed = true;

        pushKey('y');
        initRng(3410n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });

        assert.equal(result.waterEffect.kind, 'transformed');
        assert.equal(game.u.umonnum, 21);
        assert.equal(game.were_changes, 1);
        assert.equal(game.u.uconduct.polyselfs, 1);
    });

test('controlled cursed vapor rejection preserves the human form',
    async () => {
        installDirectWereHero();
        installPolymorphControl();
        const potion = potionObject(POT_WATER);
        potion.cursed = true;

        pushKey('n');
        initRng(3411n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result.waterEffect.kind, 'declined');
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.were_changes ?? 0, 0);
        assert.equal(game.u.uconduct?.polyselfs ?? 0, 0);
    });

test('controlled blessed vapor keeps or leaves beast form by answer polarity',
    async () => {
        for (const witness of [
            { answer: 'y', kind: 'remained', mnum: 21, messages: [] },
            {
                answer: 'n', kind: 'rehumanized', mnum: 331,
                messages: ['You return to human form!'],
            },
        ]) {
            installDirectWereHero({ beast: true });
            installPolymorphControl();
            const potion = potionObject(POT_WATER);
            potion.blessed = true;
            const messages = [];

            pushKey(witness.answer);
            initRng(3412n);
            const result = await applySupportedPotionVapor({
                state: game,
                potion,
                publish: async message => messages.push(message),
            });
            assert.equal(result.waterEffect.kind, witness.kind);
            assert.equal(game.u.umonnum, witness.mnum);
            assert.deepEqual(messages, witness.messages);
        }
    });

test('a nearby threat blocks controlled blessed vapor before prompting',
    async () => {
        installDirectWereHero({ beast: true });
        installPolymorphControl();
        game.u.mtimedone = 0;
        game.u.detectMonsters = true;
        game.level.monsters = [{
            mnum: PM_PURPLE_WORM,
            mx: 11, my: 10,
            mhp: 20, mcanmove: 1, msleeping: 0, mpeaceful: 0,
        }];
        const potion = potionObject(POT_WATER);
        potion.blessed = true;

        initRng(3414n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result.waterEffect.kind, 'duration-restored');
        assert.equal(game.u.umonnum, 21);
        assert.ok(game.u.mtimedone >= 200 && game.u.mtimedone <= 399);
    });

test('were-change paranoia rejects y but accepts a committed yes line',
    async () => {
        const outcomes = [
            { keys: ['y', '\n'], kind: 'declined', mnum: 331 },
            { keys: ['y', 'e', 's', '\n'], kind: 'transformed', mnum: 21 },
        ];
        for (const witness of outcomes) {
            installDirectWereHero();
            installPolymorphControl();
            game.flags = {
                ...game.flags,
                ...parseNethackrc(
                    'OPTIONS=paranoid_confirmation:Were-change',
                ).flags,
            };
            const potion = potionObject(POT_WATER);
            potion.cursed = true;

            pushKeys(witness.keys);
            initRng(3413n);
            const result = await applySupportedPotionVapor({
                state: game, potion, publish: async () => {},
            });

            assert.equal(result.waterEffect.kind, witness.kind);
            assert.equal(game.u.umonnum, witness.mnum);
        }
    });

test('global paranoia rejects a short n and repeats until committed no',
    async () => {
        installDirectWereHero();
        installPolymorphControl();
        game.flags = {
            ...game.flags,
            ...parseNethackrc(
                'OPTIONS=paranoid_confirmation:Confirm Were-change',
            ).flags,
        };
        const potion = potionObject(POT_WATER);
        potion.cursed = true;
        const inputPrompts = [];
        game._preNhgetchHook = () => {
            inputPrompts.push(game._pending_message);
        };

        pushKeys(['n', '\n', 'n', 'o', '\n']);
        initRng(3415n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        delete game._preNhgetchHook;
        assert.equal(result.waterEffect.kind, 'declined');
        assert.equal(game.u.umonnum, 331);
        assert.ok(inputPrompts.some(prompt =>
            prompt.startsWith(
                '"Yes" or "No": Do you want to change into a wolf?',
            )));
    });

test('a spotted adjacent threat suppresses cursed-water were change',
    async () => {
        installDirectWereHero();
        game.u.detectMonsters = true;
        game.level.monsters = [{
            mnum: PM_PURPLE_WORM,
            mx: 11, my: 10,
            mhp: 20, mcanmove: 1, msleeping: 0, mpeaceful: 0,
        }];
        const potion = potionObject(POT_WATER);
        potion.cursed = true;

        initRng(3402n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result.waterEffect.kind, 'blocked');
        assert.equal(result.waterEffect.changed, false);
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.u.mtimedone, 0);
        assert.equal(game.u.uconduct?.polyselfs ?? 0, 0);
    });

test('Unchanging restores a zero were-form duration instead of rehumanizing',
    async () => {
        installDirectWereHero({ beast: true });
        game.u.mtimedone = 0;
        game.u.unchanging = true;
        const potion = potionObject(POT_WATER);
        potion.blessed = true;

        initRng(3403n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result.waterEffect.kind, 'duration-restored');
        assert.ok(game.u.mtimedone >= 200 && game.u.mtimedone <= 399);
        assert.equal(game.u.umonnum, 21);
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
