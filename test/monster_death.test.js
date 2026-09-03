import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { CORPSE, OBJECT_NAMES, ROCK, STATUE } from '../js/object_data.js';
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

test('a stone golem leaves a statue of itself', async () => {
    const level = freshObjectRoom({ gameplaySeed: 21n });
    const golem = addMonster({
        species: 'stone golem', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(golem, game, {
        visible: false,
        publish: async () => {},
    });

    const [statue] = floorObjectsAt(level, 11, 10);
    assert.equal(statue?.otyp, STATUE);
    assert.equal(statue?.corpsenm, golem.mnum);
});

test('a clay golem collapses into a pile of rocks', async () => {
    const level = freshObjectRoom({ gameplaySeed: 22n });
    const golem = addMonster({
        species: 'clay golem', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(golem, game, {
        visible: false,
        publish: async () => {},
    });

    const [rocks] = floorObjectsAt(level, 11, 10);
    assert.equal(rocks?.otyp, ROCK);
    assert.ok(rocks.quan >= 50 && rocks.quan <= 69);
});

test('golems leave the materials they were made from', async () => {
    const cases = [
        {
            species: 'glass golem', minimum: 2, maximum: 8,
            isMaterial: name => name.startsWith('worthless piece'),
        },
        {
            species: 'wood golem', minimum: 2, maximum: 8,
            materials: [
                'quarterstaff', 'small shield', 'club', 'elven spear',
                'boomerang',
            ],
        },
        {
            species: 'rope golem', minimum: 0, maximum: 2,
            materials: ['leash', 'bullwhip', 'grappling hook'],
        },
        {
            species: 'leather golem', minimum: 2, maximum: 8,
            materials: ['leather armor', 'leather cloak', 'saddle'],
        },
        {
            species: 'paper golem', minimum: 1, maximum: 4,
            materials: ['blank paper'],
        },
        {
            species: 'gold golem', minimum: 1, maximum: 1,
            materials: ['gold piece'],
        },
    ];

    for (const golemCase of cases) {
        const {
            species, minimum, maximum, materials,
        } = golemCase;
        const level = freshObjectRoom({ gameplaySeed: 23n });
        const golem = addMonster({
            species, x: 11, y: 10, hitPoints: 1,
        });

        await finishEnvironmentalMonsterDeath(golem, game, {
            visible: false,
            publish: async () => {},
        });

        const remains = floorObjectsAt(level, 11, 10);
        assert.ok(remains.length >= minimum && remains.length <= maximum,
            `${species} left ${remains.length} objects`);
        const isMaterial = golemCase.isMaterial
            || (name => materials.includes(name));
        assert.equal(remains.every(object => isMaterial(
            OBJECT_NAMES[object.otyp],
        )), true, species);
    }
});
