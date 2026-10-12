import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACID_VENOM, AXE, BULLWHIP, CREAM_PIE, DAGGER, HEAVY_IRON_BALL,
    DWARVISH_MATTOCK, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_WEIGHT,
    TWO_HANDED_SWORD, WAN_LIGHT, WAN_LIGHTNING,
} from '../js/object_data.js';
import {
    rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero,
    shadeBlocksWeaponBaseDamage,
} from '../js/weapon_damage.js';
import { nameToMonster } from '../js/mondata.js';
import { initRng } from '../js/rng.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { game } from '../js/gstate.js';
import { artifactDamageBonus } from '../js/artifacts.js';
import { heroSpecies } from '../js/hero_species.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { installPolymorphedHero } from './support/hero-state.js';

const maximumRoll = (range: number) => range;
const maximumDice = (count: number, sides: number) => count * sides;

test.beforeEach(() => initRng(1n));

function maximumDamage(object: GameObject, species: string) {
    return rollPhysicalWeaponDamage(
        object,
        { mnum: nameToMonster(species) },
        { rollOne: maximumRoll, rollDice: maximumDice },
    );
}

void test('acid venom rolls both of its damage dice', async () => {
    const venom = await uninitializedObject(ACID_VENOM);

    const damage = maximumDamage(venom, 'jackal');

    assert.equal(damage, 12);
});

for (const type of [OBJECT_NAMES.indexOf('tsurugi'), DWARVISH_MATTOCK, TWO_HANDED_SWORD]) {
    void test(`large-target damage for weapon ${type} includes two independent extra dice`, async () => {
        const weapon = await uninitializedObject(type, { spe: 0 });
        const giant = { mnum: nameToMonster('hill giant') };
        const damages: number[] = [];
        for (let seed = 1; seed <= 20; seed++) {
            initRng(seed);
            // Hold the base die at its minimum; the two extra dice still roll.
            damages.push(rollPhysicalWeaponDamage(weapon, giant, { rollOne: () => 1 }));
        }

        assert.ok(damages.every(damage => damage >= 3 && damage <= 13));
        assert.ok(damages.some(damage => damage > 3), 'the extra 2d6 must vary independently of the base die');
    });
}

void test('a leather whip cannot hurt a thick-skinned monster', async () => {
    const whip = await uninitializedObject(BULLWHIP);

    const damage = maximumDamage(whip, 'mastodon');

    assert.equal(damage, 0);
});

void test('a dagger blessing still hurts a shade when its blade passes through', async () => {
    const dagger = await uninitializedObject(DAGGER);
    const blessedDagger = await uninitializedObject(DAGGER, { blessed: true });

    const ordinaryDamage = maximumDamage(dagger, 'shade');
    const blessedDamage = maximumDamage(blessedDagger, 'shade');

    assert.equal(ordinaryDamage, 0);
    assert.equal(blessedDamage, 4);
});

void test('an axe gets its extra die against a wood golem', async () => {
    const axe = await uninitializedObject(AXE);

    const damage = maximumDamage(axe, 'wood golem');

    assert.equal(damage, 8);
});

void test('an overweight iron ball gains damage up to the source cap', async () => {
    const weight = OBJECT_WEIGHT[HEAVY_IRON_BALL];
    assert.ok(weight !== undefined);
    const ball = await uninitializedObject(HEAVY_IRON_BALL, {
        owt: weight + 320,
    });

    const damage = maximumDamage(ball, 'jackal');

    assert.equal(damage, 25);
});

void test('a lit Sunsword gets its light damage against a gremlin', async () => {
    const sunsword = await artifactObject('Sunsword', {
        lamplit: true,
    });

    const damage = maximumDamage(sunsword, 'gremlin');

    assert.equal(damage, 16);
});

void test('Grayswandir halves its silver bonus before doubling weapon damage', async () => {
    const grayswandir = await artifactObject('Grayswandir');

    const damage = maximumDamage(grayswandir, 'vampire');

    assert.equal(damage, 18);
});

void test('shade contact recognizes a silver wand after its material has been shuffled', async () => {
    freshObjectRoom();
    assert.ok(game.objectMaterials);
    const type = game.objectMaterials.findIndex((material, otyp) =>
        otyp >= WAN_LIGHT && otyp <= WAN_LIGHTNING
        && material === 14 && OBJECT_MATERIAL[otyp] !== 14);
    assert.ok(type >= WAN_LIGHT, 'The shuffled wand class needs a silver wand whose original material differed');
    const wand = await uninitializedObject(type);

    assert.equal(shadeBlocksWeaponBaseDamage(wand, { mnum: nameToMonster('shade') }), false);
});

void test('a wand which lost its silver material passes through a shade', async () => {
    freshObjectRoom();
    assert.ok(game.objectMaterials);
    const type = game.objectMaterials.findIndex((material, otyp) =>
        otyp >= WAN_LIGHT && otyp <= WAN_LIGHTNING
        && material !== 14 && OBJECT_MATERIAL[otyp] === 14);
    assert.ok(type >= WAN_LIGHT, 'The shuffled wand class needs a former silver type with a different material');
    const wand = await uninitializedObject(type);

    assert.equal(shadeBlocksWeaponBaseDamage(wand, { mnum: nameToMonster('shade') }), true);
});

void test('a cream pie has no physical weapon damage', async () => {
    const pie = await uninitializedObject(CREAM_PIE);
    assert.equal(maximumDamage(pie, 'jackal'), 0);
});

void test('the hero cold resistance stops Frost Brand doubling without reducing blessed contact damage', async () => {
    freshObjectRoom();
    installPolymorphedHero('vampire');
    const frostBrand = await artifactObject('Frost Brand', { blessed: true });
    const defender = { mnum: heroSpecies(game) };
    const unresistedPhysical = rollPhysicalWeaponDamageAgainstHero(frostBrand, game, {
        rollOne: maximumRoll, rollDice: maximumDice,
    });
    const unresistedBonus = artifactDamageBonus(frostBrand, defender, unresistedPhysical,
        maximumRoll, { hero: true, state: game });
    grantIntrinsicProperty('coldResistance', 'outside');
    const resistedPhysical = rollPhysicalWeaponDamageAgainstHero(frostBrand, game, {
        rollOne: maximumRoll, rollDice: maximumDice,
    });
    const resistedBonus = artifactDamageBonus(frostBrand, defender, resistedPhysical,
        maximumRoll, { hero: true, state: game });

    assert.equal(unresistedPhysical + unresistedBonus, 20);
    assert.equal(resistedPhysical, 12, 'the sword and its blessing still damage an undead hero');
    assert.equal(resistedBonus, 0);
});
