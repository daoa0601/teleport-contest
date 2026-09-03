import test from 'node:test';
import assert from 'node:assert/strict';

import {
    artifactByName, artifactDamageBonus, artifactToHitBonus,
    resolveHeroArtifactTouch,
} from '../js/artifacts.js';
import { W_ARM, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BLACK_DRAGON_SCALES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { freshGame } from './support/game-state.js';
import { equipMonsterObject, liveMonster } from './support/monsters.js';

const maximumRoll = range => range;

test.beforeEach(() => initRng(1n));

test('Excalibur gets its accuracy and damage against any monster', () => {
    const excalibur = artifactObject('Excalibur');
    const jackal = liveMonster({ species: 'jackal' });

    const accuracy = artifactToHitBonus(excalibur, jackal, maximumRoll);
    const damage = artifactDamageBonus(excalibur, jackal, 7, maximumRoll);

    assert.equal(accuracy, 5);
    assert.equal(damage, 10);
});

test('Orcrist doubles damage only against orcs', () => {
    const orcrist = artifactObject('Orcrist');
    const orc = liveMonster({ species: 'orc' });
    const jackal = liveMonster({ species: 'jackal' });

    assert.equal(artifactToHitBonus(orcrist, orc, maximumRoll), 5);
    assert.equal(artifactDamageBonus(orcrist, orc, 7, maximumRoll), 7);
    assert.equal(artifactToHitBonus(orcrist, jackal, maximumRoll), 0);
    assert.equal(artifactDamageBonus(orcrist, jackal, 7, maximumRoll), 0);
});

test('Grimtooth damages every target but gets accuracy only against elves', () => {
    const grimtooth = artifactObject('Grimtooth');
    const elf = liveMonster({ species: 'elf' });
    const jackal = liveMonster({ species: 'jackal' });

    assert.equal(artifactToHitBonus(grimtooth, elf, maximumRoll), 2);
    assert.equal(artifactToHitBonus(grimtooth, jackal, maximumRoll), 0);
    assert.equal(artifactDamageBonus(grimtooth, jackal, 7, maximumRoll), 6);
});

test('the Sceptre of Might doubles damage against opposing alignments', () => {
    const sceptre = artifactObject('The Sceptre of Might');
    const orc = liveMonster({ species: 'orc' });
    const angel = liveMonster({ species: 'Angel' });

    assert.equal(artifactToHitBonus(sceptre, orc, maximumRoll), 5);
    assert.equal(artifactDamageBonus(sceptre, orc, 7, maximumRoll), 7);
    assert.equal(artifactToHitBonus(sceptre, angel, maximumRoll), 0);
    assert.equal(artifactDamageBonus(sceptre, angel, 7, maximumRoll), 0);
});

test('Frost Brand bonuses stop at cold-resistant monsters', () => {
    const frostBrand = artifactObject('Frost Brand');
    const jackal = liveMonster({ species: 'jackal' });
    const winterWolf = liveMonster({ species: 'winter wolf' });

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

test('an artifact defense blocks the matching special attack', () => {
    const frostBrand = artifactObject('Frost Brand');
    const jackal = liveMonster({ species: 'jackal' });
    equipMonsterObject(jackal, artifactObject('Frost Brand'), W_WEP);

    assert.equal(artifactToHitBonus(frostBrand, jackal, maximumRoll), 0);
    assert.equal(
        artifactDamageBonus(frostBrand, jackal, 7, maximumRoll),
        0,
    );
});

test('Stormbringer cannot drain an undead monster', () => {
    const stormbringer = artifactObject('Stormbringer');
    const vampire = liveMonster({ species: 'vampire' });

    assert.equal(
        artifactToHitBonus(stormbringer, vampire, maximumRoll),
        0,
    );
    assert.equal(
        artifactDamageBonus(stormbringer, vampire, 7, maximumRoll),
        0,
    );
});

test('black dragon scales protect a monster from Stormbringer', () => {
    const stormbringer = artifactObject('Stormbringer');
    const scales = uninitializedObject(BLACK_DRAGON_SCALES, {
        owornmask: W_ARM,
    });
    const jackal = liveMonster({ species: 'jackal', inventory: [scales] });

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
