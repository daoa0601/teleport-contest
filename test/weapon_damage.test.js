import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName } from '../js/artifacts.js';
import {
    ACID_VENOM, AXE, BULLWHIP, DAGGER, HEAVY_IRON_BALL, LONG_SWORD,
    OBJECT_NAMES, OBJECT_WEIGHT,
} from '../js/object_data.js';
import { rollPhysicalWeaponDamage } from '../js/weapon_damage.js';
import { carriedObject } from './support/game-objects.js';
import { liveMonster } from './support/monsters.js';

const maximumRoll = range => range;
const maximumDice = (count, sides) => count * sides;

function maximumDamage(object, species) {
    return rollPhysicalWeaponDamage(
        object,
        liveMonster({ species }),
        { rollOne: maximumRoll, rollDice: maximumDice },
    );
}

test('acid venom rolls both of its damage dice', () => {
    const venom = carriedObject(ACID_VENOM);

    const damage = maximumDamage(venom, 'jackal');

    assert.equal(damage, 12);
});

test('a leather whip cannot hurt a thick-skinned monster', () => {
    const whip = carriedObject(BULLWHIP);

    const damage = maximumDamage(whip, 'mastodon');

    assert.equal(damage, 0);
});

test('a dagger blessing still hurts a shade when its blade passes through', () => {
    const dagger = carriedObject(DAGGER);
    const blessedDagger = carriedObject(DAGGER, { blessed: true });

    const ordinaryDamage = maximumDamage(dagger, 'shade');
    const blessedDamage = maximumDamage(blessedDagger, 'shade');

    assert.equal(ordinaryDamage, 0);
    assert.equal(blessedDamage, 4);
});

test('an axe gets its extra die against a wood golem', () => {
    const axe = carriedObject(AXE);

    const damage = maximumDamage(axe, 'wood golem');

    assert.equal(damage, 8);
});

test('an overweight iron ball gains damage up to the source cap', () => {
    const ball = carriedObject(HEAVY_IRON_BALL, {
        owt: OBJECT_WEIGHT[HEAVY_IRON_BALL] + 320,
    });

    const damage = maximumDamage(ball, 'jackal');

    assert.equal(damage, 25);
});

test('a lit Sunsword gets its light damage against a gremlin', () => {
    const sunsword = carriedObject(LONG_SWORD, {
        oartifact: artifactByName('Sunsword').id,
        lamplit: true,
    });

    const damage = maximumDamage(sunsword, 'gremlin');

    assert.equal(damage, 16);
});

test('Grayswandir halves its silver bonus before doubling weapon damage', () => {
    const grayswandir = carriedObject(
        OBJECT_NAMES.indexOf('silver saber'),
        { oartifact: artifactByName('Grayswandir').id },
    );

    const damage = maximumDamage(grayswandir, 'vampire');

    assert.equal(damage, 18);
});
