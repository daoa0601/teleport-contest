import test from 'node:test';
import assert from 'node:assert/strict';

import { applyFountainGemDiscovery } from '../js/fountain_effects.js';

test('gem discovery commits one announced floor identity and Wisdom exercise',
    async () => {
        const loc = { looted: 0 };
        const world = {
            messages: [], floor: [], wisdomExercises: 0, repaints: 0,
        };
        const gem = { otyp: 465 };
        const effect = await applyFountainGemDiscovery({
            loc,
            announce: async message => world.messages.push(message),
            chooseGem: () => 465,
            createGem: gemType => {
                assert.equal(gemType, 465);
                return gem;
            },
            placeGem: value => world.floor.push(value),
            repaint: () => { world.repaints++; },
            exerciseWisdom: () => { world.wisdomExercises++; },
        });

        assert.deepEqual(effect, {
            discovered: true,
            message: 'You spot a gem in the sparkling waters!',
            gemType: 465,
            gem,
        });
        assert.equal(loc.looted & 1, 1);
        assert.deepEqual(world.messages, [
            'You spot a gem in the sparkling waters!',
        ]);
        assert.deepEqual(world.floor, [gem]);
        assert.equal(world.wisdomExercises, 1);
        assert.equal(world.repaints, 1);
    });

test('blind discovery uses tactile prose and a looted fountain does no work',
    async () => {
        const messages = [];
        const blind = await applyFountainGemDiscovery({
            loc: { looted: 0 },
            blind: true,
            announce: async message => messages.push(message),
            chooseGem: () => 466,
        });
        assert.equal(blind.message, 'You feel a gem here!');
        assert.deepEqual(messages, ['You feel a gem here!']);

        const looted = await applyFountainGemDiscovery({
            loc: { looted: 1 },
            announce: async () => {
                throw new Error('looted fountain must not announce');
            },
            chooseGem: () => {
                throw new Error('looted fountain must not choose a gem');
            },
        });
        assert.deepEqual(looted, {
            discovered: false,
            message: '',
            gemType: null,
            gem: null,
        });
    });
