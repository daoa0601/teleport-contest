import test from 'node:test';
import assert from 'node:assert/strict';

import { applyFountainGemDiscovery } from '../js/fountain_effects.js';

test('gem discovery announces before identity and commits state in source order',
    async () => {
        const loc = { looted: 0 };
        const order = [];
        const gem = { otyp: 465 };
        const effect = await applyFountainGemDiscovery({
            loc,
            announce: async message => {
                order.push(`announce:${message}`);
            },
            chooseGem() {
                order.push('choose');
                return 465;
            },
            createGem(gemType) {
                order.push(`create:${gemType}`);
                return gem;
            },
            placeGem(value) {
                order.push(`place:${value.otyp}`);
            },
            repaint() {
                order.push(`repaint:${loc.looted}`);
            },
            exerciseWisdom() {
                order.push('exercise');
            },
        });

        assert.deepEqual(effect, {
            discovered: true,
            message: 'You spot a gem in the sparkling waters!',
            gemType: 465,
            gem,
        });
        assert.equal(loc.looted & 1, 1);
        assert.deepEqual(order, [
            'announce:You spot a gem in the sparkling waters!',
            'choose', 'create:465', 'place:465', 'repaint:1', 'exercise',
        ]);
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
