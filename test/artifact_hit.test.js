import test from 'node:test';
import assert from 'node:assert/strict';

import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import {
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { SCR_IDENTIFY } from '../js/object_data.js';
import {
    artifactObject, uninitializedObject,
} from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const maximumRoll = range => range;
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;

test('Fire Brand can burn a monster inventory and add its damage', async () => {
    freshObjectRoom();
    const scroll = uninitializedObject(SCR_IDENTIFY);
    const monster = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );
    addObjectToMonsterInventory(monster, scroll, game);
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
    const target = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );
    const sleeper = await createMonsterAt(
        'lichen', 13, 10, TEST_MONSTER_FLAGS,
    );
    sleeper.msleeping = 1;

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
    const monster = await createMonsterAt(
        'pony', 12, 10, TEST_MONSTER_FLAGS,
    );
    monster.mhp = monster.mhpmax = 20;
    const levelBefore = monster.m_lev;

    const hit = await applyArtifactHitToMonster(
        artifactObject('Stormbringer'), monster, 4, {
            state: game,
            describeTarget: () => 'the pony',
            publish: async () => {},
            random: () => 1,
            rollOne: maximumRoll,
        },
    );

    assert.equal(hit.damage, 14);
    assert.equal(monster.m_lev, levelBefore - 1);
    assert.equal(monster.mhpmax, 12);
    assert.equal(game.u.uhp, 9);
});

test('Magicbane cancels a spellcaster and absorbs its magic', async () => {
    freshObjectRoom({
        hero: { uen: 2, uenmax: 3, uenpeak: 3 },
    });
    const monster = await createMonsterAt(
        'gnomish wizard', 12, 10, TEST_MONSTER_FLAGS,
    );
    const messages = [];

    const hit = await applyArtifactHitToMonster(
        artifactObject('Magicbane', { spe: 0 }), monster, 4, {
            state: game,
            dieRoll: 1,
            describeTarget: () => 'the gnomish wizard',
            publish: async message => messages.push(message),
            random: range => range - 1,
            rollOne: maximumRoll,
        },
    );

    assert.equal(hit.damage, 24);
    assert.equal(monster.mcan, 1);
    assert.equal(game.u.uen, 3);
    assert.equal(game.u.uenmax, 4);
    assert.equal(game.u.uenpeak, 4);
    assert.match(messages[0], /cancels the gnomish wizard/);
    assert.match(messages[1], /absorb magical energy/);
});

test('Magicbane scares a surviving monster for three turns', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );
    monster.mhp = monster.mhpmax = 30;
    const messages = [];

    const hit = await applyArtifactHitToMonster(
        artifactObject('Magicbane', { spe: 0 }), monster, 4, {
            state: game,
            dieRoll: 3,
            describeTarget: () => 'the jackal',
            publish: async message => messages.push(message),
            random: range => range - 1,
            rollOne: maximumRoll,
        },
    );

    assert.equal(hit.damage, 20);
    assert.equal(monster.mflee, 1);
    assert.equal(monster.mfleetim, 3);
    assert.equal(monster.mstun, undefined);
    assert.match(messages[0], /scares the jackal/);
});

test('the Tsurugi bisects small monsters and cuts deeply into large ones',
    async () => {
        freshObjectRoom();
        const weapon = artifactObject('The Tsurugi of Muramasa');
        const messages = [];
        const jackal = await createMonsterAt(
            'jackal', 11, 10, TEST_MONSTER_FLAGS,
        );
        jackal.mhp = jackal.mhpmax = 20;
        const mumak = await createMonsterAt(
            'mumak', 12, 10, TEST_MONSTER_FLAGS,
        );
        mumak.mhp = mumak.mhpmax = 20;

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
            weapon, mumak, 4, {
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
        const gasSpore = await createMonsterAt(
            'gas spore', 11, 10, TEST_MONSTER_FLAGS,
        );
        gasSpore.mhp = gasSpore.mhpmax = 20;
        const headless = await applyArtifactHitToMonster(
            weapon, gasSpore, 4, {
                state: game,
                dieRoll: 1,
                describeTarget: () => 'the gas spore',
                publish: async message => messages.push(message),
                rollOne: maximumRoll,
            },
        );
        const jabberwockTarget = await createMonsterAt(
            'jabberwock', 12, 10, TEST_MONSTER_FLAGS,
        );
        jabberwockTarget.mhp = jabberwockTarget.mhpmax = 20;
        const jabberwock = await applyArtifactHitToMonster(
            weapon, jabberwockTarget, 4, {
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
