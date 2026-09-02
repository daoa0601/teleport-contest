import test from 'node:test';
import assert from 'node:assert/strict';

import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import { game } from '../js/gstate.js';
import { SCR_IDENTIFY } from '../js/object_data.js';
import {
    artifactObject, carriedObject,
} from './support/game-objects.js';
import { liveMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const maximumRoll = range => range;

test('Fire Brand can burn a monster inventory and add its damage', async () => {
    freshObjectRoom();
    const scroll = carriedObject(SCR_IDENTIFY, { where: 'minvent' });
    const monster = liveMonster({
        species: 'jackal',
        x: 12,
        y: 10,
        inventory: [scroll],
    });
    const messages = [];

    const hit = await applyArtifactHitToMonster(
        artifactObject('Fire Brand'), monster, 4, {
            state: game,
            describeTarget: () => 'the jackal',
            describeCarrier: () => 'jackal',
            publish: async message => messages.push(message),
            random: () => 0,
            rollOne: maximumRoll,
        },
    );

    assert.equal(hit.damage, 9);
    assert.equal(monster.inventory.length, 0);
    assert.match(messages[0], /fiery blade burns the jackal/);
});

test('Mjollnir wakes monsters near a target struck by lightning', async () => {
    freshObjectRoom();
    const target = liveMonster({
        species: 'jackal', x: 12, y: 10,
    });
    const sleeper = liveMonster({
        species: 'lichen', x: 13, y: 10, msleeping: 1,
    });
    game.level.monsters = [target, sleeper];

    const hit = await applyArtifactHitToMonster(
        artifactObject('Mjollnir'), target, 4, {
            state: game,
            publish: async () => {},
            random: () => 1,
            rollOne: maximumRoll,
        },
    );

    assert.equal(hit.damage, 28);
    assert.equal(sleeper.msleeping, 0);
});

test('Stormbringer drains a monster level and heals its wielder', async () => {
    freshObjectRoom({ hero: { uhp: 5, uhpmax: 12 } });
    const monster = liveMonster({
        species: 'jackal',
        x: 12,
        y: 10,
        level: 3,
        hitPoints: 20,
    });

    const hit = await applyArtifactHitToMonster(
        artifactObject('Stormbringer'), monster, 4, {
            state: game,
            describeTarget: () => 'the jackal',
            publish: async () => {},
            random: () => 1,
            rollOne: maximumRoll,
        },
    );

    assert.equal(hit.damage, 14);
    assert.equal(monster.m_lev, 2);
    assert.equal(monster.mhpmax, 12);
    assert.equal(game.u.uhp, 9);
});
