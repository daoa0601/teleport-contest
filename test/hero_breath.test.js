import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { hitHeroWithBreath } from '../js/hero_breath.js';
import { startHeroSliming } from '../js/slime.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

function polymorphHeroInto(name) {
    freshObjectRoom({ recalculateVision: false });
    installPolymorphedHero(name);
}

test('red-dragon breath burns slime without hurting its fireproof body',
    async () => {
        polymorphHeroInto('red dragon');
        startHeroSliming({ state: game, turns: 10 });
        const messages = [];
        const rolls = [1, 1, 1];

        const result = await hitHeroWithBreath({
            state: game,
            publish: async message => messages.push(message),
            random: () => rolls.shift(),
            rollDice: () => 24,
        });

        assert.equal(result.resisted, true);
        assert.equal(game.u.mh, 40);
        assert.equal(game.u.slimed, false);
        assert.deepEqual(messages, [
            "You don't feel hot!",
            'The slime that covers you is burned away!',
        ]);
    });

test('green-dragon breath cannot poison its poison-resistant body',
    async () => {
        polymorphHeroInto('green dragon');
        const messages = [];

        const result = await hitHeroWithBreath({
            state: game,
            publish: async message => messages.push(message),
        });

        assert.equal(result.resisted, true);
        assert.equal(game.u.uhp, 40);
        assert.equal(game.u.mh, 40);
        assert.deepEqual(messages, [
            "The poison doesn't seem to affect you.",
        ]);
    });
