import test from 'node:test';
import assert from 'node:assert/strict';

import {
    artifactByName, artifactDamageBonus, artifactToHitBonus,
    resolveHeroArtifactTouch,
} from '../js/artifacts.js';
import {
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
    W_ARM, W_WEP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { BLACK_DRAGON_SCALES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { freshGame } from './support/game-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const maximumRoll = range => range;
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;

test.beforeEach(() => freshObjectRoom({ recalculateVision: false }));

test('Excalibur gets its accuracy and damage against any monster', async () => {
    const excalibur = artifactObject('Excalibur');
    const jackal = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );

    const accuracy = artifactToHitBonus(excalibur, jackal, maximumRoll);
    const damage = artifactDamageBonus(excalibur, jackal, 7, maximumRoll);

    assert.equal(accuracy, 5);
    assert.equal(damage, 10);
});

test('Orcrist doubles damage only against orcs', async () => {
    const orcrist = artifactObject('Orcrist');
    const orc = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const jackal = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );

    assert.equal(artifactToHitBonus(orcrist, orc, maximumRoll), 5);
    assert.equal(artifactDamageBonus(orcrist, orc, 7, maximumRoll), 7);
    assert.equal(artifactToHitBonus(orcrist, jackal, maximumRoll), 0);
    assert.equal(artifactDamageBonus(orcrist, jackal, 7, maximumRoll), 0);
});

test('Grimtooth damages every target but gets accuracy only against elves',
    async () => {
        const grimtooth = artifactObject('Grimtooth');
        const elf = await createMonsterAt('elf', 11, 10, TEST_MONSTER_FLAGS);
        const jackal = await createMonsterAt(
            'jackal', 12, 10, TEST_MONSTER_FLAGS,
        );

        assert.equal(artifactToHitBonus(grimtooth, elf, maximumRoll), 2);
        assert.equal(artifactToHitBonus(grimtooth, jackal, maximumRoll), 0);
        assert.equal(
            artifactDamageBonus(grimtooth, jackal, 7, maximumRoll), 6,
        );
    });

test('the Sceptre of Might doubles damage against opposing alignments',
    async () => {
        const sceptre = artifactObject('The Sceptre of Might');
        const orc = await createMonsterAt(
            'orc', 11, 10, TEST_MONSTER_FLAGS,
        );
        const angel = await createMonsterAt(
            'Angel', 12, 10, TEST_MONSTER_FLAGS,
        );

        assert.equal(artifactToHitBonus(sceptre, orc, maximumRoll), 5);
        assert.equal(artifactDamageBonus(sceptre, orc, 7, maximumRoll), 7);
        assert.equal(artifactToHitBonus(sceptre, angel, maximumRoll), 0);
        assert.equal(artifactDamageBonus(sceptre, angel, 7, maximumRoll), 0);
    });

test('Frost Brand bonuses stop at cold-resistant monsters', async () => {
    const frostBrand = artifactObject('Frost Brand');
    const jackal = await createMonsterAt(
        'jackal', 11, 10, TEST_MONSTER_FLAGS,
    );
    const winterWolf = await createMonsterAt(
        'winter wolf', 12, 10, TEST_MONSTER_FLAGS,
    );

    assert.equal(artifactToHitBonus(frostBrand, jackal, maximumRoll), 5);
    assert.equal(
        artifactDamageBonus(frostBrand, jackal, 7, maximumRoll),
        7,
    );
    assert.equal(artifactToHitBonus(frostBrand, winterWolf, maximumRoll), 0);
    assert.equal(
        artifactDamageBonus(frostBrand, winterWolf, 7, maximumRoll),
        0,
    );
});

test('an artifact defense blocks the matching special attack', async () => {
    const frostBrand = artifactObject('Frost Brand');
    const jackal = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );
    equipMonsterObject(jackal, artifactObject('Frost Brand'), W_WEP);

    assert.equal(artifactToHitBonus(frostBrand, jackal, maximumRoll), 0);
    assert.equal(
        artifactDamageBonus(frostBrand, jackal, 7, maximumRoll),
        0,
    );
});

test('Stormbringer cannot drain an undead monster', async () => {
    const stormbringer = artifactObject('Stormbringer');
    const vampire = await createMonsterAt(
        'vampire', 12, 10, TEST_MONSTER_FLAGS,
    );

    assert.equal(
        artifactToHitBonus(stormbringer, vampire, maximumRoll),
        0,
    );
    assert.equal(
        artifactDamageBonus(stormbringer, vampire, 7, maximumRoll),
        0,
    );
});

test('black dragon scales protect a monster from Stormbringer', async () => {
    const stormbringer = artifactObject('Stormbringer');
    const scales = uninitializedObject(BLACK_DRAGON_SCALES);
    const jackal = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );
    equipMonsterObject(jackal, scales, W_ARM);

    assert.equal(
        artifactDamageBonus(stormbringer, jackal, 7, maximumRoll),
        0,
    );
});

test('Grimtooth rejects an elf hero', () => {
    freshGame({
        flags: { female: false },
        hero: {
            mtimedone: 0,
            ulycn: -1,
            ualign: { type: -1, record: 10 },
        },
    });
    game.urace = { mnum: 264 };
    initRng(301n);
    const grimtooth = artifactObject('Grimtooth');

    const touch = resolveHeroArtifactTouch(
        grimtooth, artifactByName('Grimtooth'),
    );

    assert.equal(touch.badAlignment, true);
});
