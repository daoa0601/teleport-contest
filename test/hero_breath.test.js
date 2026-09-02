import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { hitHeroWithBreath } from '../js/hero_breath.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { startHeroSliming } from '../js/slime.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');

function polymorphHeroInto(name) {
    freshObjectRoom({ recalculateVision: false });
    Object.assign(game.u, {
        umonster: PM_ARCHEOLOGIST,
        umonnum: MONSTER_NAME.indexOf(name),
        mtimedone: 100,
        mh: 40,
        mhmax: 40,
    });
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
