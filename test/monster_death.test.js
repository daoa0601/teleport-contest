import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { CORPSE } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('a large monster leaves a corpse without a random chance', async () => {
    const level = freshObjectRoom();
    const giant = addMonster({
        species: 'giant', x: 11, y: 10, hitPoints: 1,
    });

    const death = await finishEnvironmentalMonsterDeath(giant, game, {
        visible: false,
        random: range => range - 1,
        publish: async () => {},
    });

    assert.equal(death.corpse?.otyp, CORPSE);
    assert.equal(floorObjectsAt(level, 11, 10).includes(death.corpse), true);
});

test('a visible lich crumbles to dust instead of leaving a corpse', async () => {
    freshObjectRoom();
    const lich = addMonster({
        species: 'lich', x: 11, y: 10, hitPoints: 1,
    });
    const messages = [];

    const death = await finishEnvironmentalMonsterDeath(lich, game, {
        visible: true,
        random: () => 0,
        publish: async message => messages.push(message),
    });

    assert.equal(death.corpse, null);
    assert.deepEqual(messages, ["The lich's body crumbles into dust."]);
});
