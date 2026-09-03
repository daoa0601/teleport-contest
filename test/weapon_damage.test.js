import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACID_VENOM, AXE, BOW, BULLWHIP, DAGGER, HEAVY_IRON_BALL, OBJECT_WEIGHT,
} from '../js/object_data.js';
import {
    rollHeroMeleeWeaponDamage, rollPhysicalWeaponDamage,
} from '../js/weapon_damage.js';
import { nameToMonster } from '../js/mondata.js';
import { initRng } from '../js/rng.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';

const maximumRoll = range => range;
const maximumDice = (count, sides) => count * sides;

test.beforeEach(() => initRng(1n));

function maximumDamage(object, species) {
    return rollPhysicalWeaponDamage(
        object,
        { mnum: nameToMonster(species) },
        { rollOne: maximumRoll, rollDice: maximumDice },
    );
}

test('acid venom rolls both of its damage dice', () => {
    const venom = uninitializedObject(ACID_VENOM);

    const damage = maximumDamage(venom, 'jackal');

    assert.equal(damage, 12);
});

test('a leather whip cannot hurt a thick-skinned monster', () => {
    const whip = uninitializedObject(BULLWHIP);

    const damage = maximumDamage(whip, 'mastodon');

    assert.equal(damage, 0);
});

test('a bow swung in melee uses improvised damage without weapon skill', () => {
    const bow = uninitializedObject(BOW);
    const monster = { mnum: nameToMonster('jackal') };

    const hit = rollHeroMeleeWeaponDamage(
        bow, monster, { rollOne: maximumRoll },
    );

    assert.deepEqual(hit, {
        damage: 2,
        usesArtifact: false,
        usesSkill: false,
    });
});

test('a dagger blessing still hurts a shade when its blade passes through', () => {
    const dagger = uninitializedObject(DAGGER);
    const blessedDagger = uninitializedObject(DAGGER, { blessed: true });

    const ordinaryDamage = maximumDamage(dagger, 'shade');
    const blessedDamage = maximumDamage(blessedDagger, 'shade');

    assert.equal(ordinaryDamage, 0);
    assert.equal(blessedDamage, 4);
});

test('an axe gets its extra die against a wood golem', () => {
    const axe = uninitializedObject(AXE);

    const damage = maximumDamage(axe, 'wood golem');

    assert.equal(damage, 8);
});

test('an overweight iron ball gains damage up to the source cap', () => {
    const ball = uninitializedObject(HEAVY_IRON_BALL, {
        owt: OBJECT_WEIGHT[HEAVY_IRON_BALL] + 320,
    });

    const damage = maximumDamage(ball, 'jackal');

    assert.equal(damage, 25);
});

test('a lit Sunsword gets its light damage against a gremlin', () => {
    const sunsword = artifactObject('Sunsword', {
        lamplit: true,
    });

    const damage = maximumDamage(sunsword, 'gremlin');

    assert.equal(damage, 16);
});

test('Grayswandir halves its silver bonus before doubling weapon damage', () => {
    const grayswandir = artifactObject('Grayswandir');

    const damage = maximumDamage(grayswandir, 'vampire');

    assert.equal(damage, 18);
});
