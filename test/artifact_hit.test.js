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

test('the Tsurugi bisects small monsters and cuts deeply into large ones',
    async () => {
        freshObjectRoom();
        const weapon = artifactObject('The Tsurugi of Muramasa');
        const messages = [];
        const jackal = liveMonster({ species: 'jackal', hitPoints: 20 });

        const smallHit = await applyArtifactHitToMonster(
            weapon, jackal, 4, {
                state: game,
                dieRoll: 1,
                describeTarget: () => 'the jackal',
                publish: async message => messages.push(message),
                rollOne: maximumRoll,
            },
        );
        const largeHit = await applyArtifactHitToMonster(
            weapon, liveMonster({ species: 'mumak', hitPoints: 20 }), 4, {
                state: game,
                dieRoll: 1,
                describeTarget: () => 'the mumak',
                publish: async message => messages.push(message),
                rollOne: maximumRoll,
            },
        );

        assert.equal(smallHit.damage, 41);
        assert.equal(largeHit.damage, 24);
        assert.match(messages[0], /cuts the jackal in half/);
        assert.match(messages[1], /slice deeply into the mumak/);
    });

test('Vorpal Blade misses a headless creature and beheads a jabberwock',
    async () => {
        freshObjectRoom();
        const weapon = artifactObject('Vorpal Blade');
        const messages = [];
        const headless = await applyArtifactHitToMonster(
            weapon, liveMonster({ species: 'gas spore', hitPoints: 20 }), 4, {
                state: game,
                dieRoll: 1,
                describeTarget: () => 'the gas spore',
                publish: async message => messages.push(message),
                rollOne: maximumRoll,
            },
        );
        const jabberwock = await applyArtifactHitToMonster(
            weapon, liveMonster({ species: 'jabberwock', hitPoints: 20 }), 4, {
                state: game,
                dieRoll: 10,
                describeTarget: () => 'the jabberwock',
                publish: async message => messages.push(message),
                random: () => 0,
                rollOne: maximumRoll,
            },
        );

        assert.equal(headless.damage, 0);
        assert.equal(headless.attackStopped, true);
        assert.equal(jabberwock.damage, 41);
        assert.match(messages[0], /miss the gas spore wildly/);
        assert.match(messages[1], /beheads the jabberwock/);
    });
