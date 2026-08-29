import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import {
    POT_FRUIT_JUICE, POT_GAIN_LEVEL,
} from '../js/object_data.js';
import { hitMonsterWithInertPotion } from '../js/potion_hit.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';

const PM_ENERGY_VORTEX = 109;
const PM_PURPLE_WORM = 115;

function inertPotion(otyp) {
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
        const potion = inertPotion(POT_FRUIT_JUICE);
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
        const potion = inertPotion(POT_GAIN_LEVEL);
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
