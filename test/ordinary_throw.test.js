import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_DEX, A_LAWFUL, A_STR, P_BASIC, P_BOW, P_CROSSBOW, P_DART, P_SKILLED,
    W_ARMG, W_WEP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    ARROW, BLINDING_VENOM, BOW, CLUB, CROSSBOW, CROSSBOW_BOLT, DART,
    ELVEN_ARROW, ELVEN_BOW, GAUNTLETS_OF_POWER, YA, YUMI,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { races } from '../js/roles.js';
import { throwInventoryObject } from './support/commands.js';
import {
    addInventoryObject, addInventoryWeapon,
} from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { floorObjects } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function carriedClub() {
    return addInventoryWeapon(CLUB, { invlet: 'a', spe: 0 });
}

async function fireBowAtJackal({
    role = 'caveman',
    race = 'human',
    bowType = BOW,
    arrowType = ARROW,
    glovesType = null,
    seed = 1n,
    heroLevel = 1,
    dexterity = 10,
    strength = 10,
    damageBonus = 0,
    targetArmorClass = 10,
} = {}) {
    freshObjectRoom({ right: 20, role, gameplaySeed: 4900n });
    game.urace = races.find(candidate => candidate.name === race);
    game.u.ulevel = heroLevel;
    game.u.acurr.a[A_DEX] = dexterity;
    game.u.acurr.a[A_STR] = strength;
    game.u.udaminc = damageBonus;
    installHeroWeaponSkills({ [P_BOW]: P_BASIC });
    const bow = addInventoryWeapon(bowType, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const arrow = addInventoryWeapon(arrowType, { invlet: 'b' });
    game.uwep = game.u.uwep = bow;
    if (glovesType !== null) {
        const gloves = addInventoryObject(glovesType, {
            invlet: 'c', owornmask: W_ARMG, worn: true,
        });
        game.uarmg = game.u.uarmg = gloves;
    }
    const jackal = addMonster({
        species: 'jackal', x: 11, y: 10,
        hitPoints: 20, mac: targetArmorClass,
    });
    initRng(seed);

    await throwInventoryObject(arrow, 'l', Array(6).fill(' '));

    return 20 - jackal.mhp;
}

test('throwing a club carries it across its strength-based range', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4101n });
    game.u.acurr.a[A_STR] = 10;
    const club = carriedClub();

    await throwInventoryObject(club, 'l');

    assert.equal(game.inventory.includes(club), false);
    assert.equal(floorObjects(level).includes(club), true);
    assert.deepEqual([club.ox, club.oy], [15, 10]);
});

test('a thrown club can hit a monster and land on its square', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4102n });
    game.u.ulevel = 20;
    game.u.acurr.a[A_DEX] = 18;
    const club = carriedClub();
    const jackal = addMonster({
        species: 'jackal',
        x: 13,
        y: 10,
        hitPoints: 20,
        mac: 10,
        mcanmove: 0,
    });

    await throwInventoryObject(club, 'l', Array(4).fill(' '));

    assert.ok(jackal.mhp < 20);
    assert.equal(floorObjects(level).includes(club), true);
    assert.deepEqual([club.ox, club.oy], [13, 10]);
});

test('thrown blinding venom blinds a monster without hurting it', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4108n });
    game.u.acurr.a[A_DEX] = 18;
    const venom = addInventoryObject(BLINDING_VENOM, { invlet: 'a' });
    const jackal = addMonster({
        species: 'jackal', x: 13, y: 10, hitPoints: 20,
    });
    initRng(1n);

    await throwInventoryObject(venom, 'l');

    assert.equal(jackal.mhp, 20);
    assert.equal(jackal.mcansee, 0);
    assert.equal(game.inventory.includes(venom), false);
    assert.equal(floorObjects(level).includes(venom), false);
});

test('grease can make a thrown club slip away from its chosen path', async () => {
    freshObjectRoom({ right: 20, gameplaySeed: 4103n });
    game.u.acurr.a[A_STR] = 10;
    const club = carriedClub();
    club.greased = true;
    initRng(2333n);

    await throwInventoryObject(club, 'l');

    assert.notDeepEqual([club.ox, club.oy], [15, 10]);
    assert.match(game._pending_message, /slips as you throw it/);
});

test('a crossbow sends its bolt eight squares regardless of Strength', async () => {
    const level = freshObjectRoom({ right: 22, gameplaySeed: 4104n });
    game.u.acurr.a[A_STR] = 3;
    const crossbow = addInventoryWeapon(CROSSBOW, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const bolt = addInventoryWeapon(CROSSBOW_BOLT, { invlet: 'b' });
    game.uwep = game.u.uwep = crossbow;

    await throwInventoryObject(bolt, 'l');

    assert.equal(floorObjects(level).includes(bolt), true);
    assert.deepEqual([bolt.ox, bolt.oy], [18, 10]);
});

test('a skilled Ranger can fire several crossbow bolts in one turn', async () => {
    const level = freshObjectRoom({
        right: 22,
        role: 'ranger',
        gameplaySeed: 4106n,
    });
    game.u.acurr.a[A_STR] = 18;
    installHeroWeaponSkills({ [P_CROSSBOW]: P_SKILLED });
    const crossbow = addInventoryWeapon(CROSSBOW, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const bolts = addInventoryWeapon(CROSSBOW_BOLT, {
        invlet: 'b', quan: 3, quantity: 3,
    });
    game.uwep = game.u.uwep = crossbow;
    initRng(4n);

    await throwInventoryObject(bolts, 'l');

    const landedBolts = floorObjects(level)
        .filter(object => object.otyp === CROSSBOW_BOLT);
    assert.equal(game.inventory.includes(bolts), false);
    assert.equal(landedBolts.reduce(
        (count, object) => count + (object.quan ?? 1), 0,
    ), 3);
});

test('a launcher uses ring damage but not Strength damage', async () => {
    const shot = overrides => fireBowAtJackal({
        heroLevel: 20,
        dexterity: 18,
        seed: 1n,
        ...overrides,
    });

    const baseDamage = await shot({ strength: 3 });
    const ringDamage = await shot({ strength: 3, damageBonus: 3 });
    const strongDamage = await shot({ strength: 18 });

    assert.equal(ringDamage, baseDamage + 3);
    assert.equal(strongDamage, baseDamage);
});

test('an elf is more accurate with an elven bow', async () => {
    const humanDamage = await fireBowAtJackal({
        role: 'ranger',
        bowType: ELVEN_BOW,
        arrowType: ELVEN_ARROW,
        targetArmorClass: 8,
        seed: 11n,
    });
    const elfDamage = await fireBowAtJackal({
        role: 'ranger',
        race: 'elf',
        bowType: ELVEN_BOW,
        arrowType: ELVEN_ARROW,
        targetArmorClass: 8,
        seed: 11n,
    });

    assert.equal(humanDamage, 0);
    assert.ok(elfDamage > 0);
});

test('a Samurai does extra damage with a yumi and ya', async () => {
    const ordinaryDamage = await fireBowAtJackal({
        bowType: YUMI,
        arrowType: YA,
        heroLevel: 20,
        dexterity: 18,
        seed: 1n,
    });
    const samuraiDamage = await fireBowAtJackal({
        role: 'samurai',
        bowType: YUMI,
        arrowType: YA,
        heroLevel: 20,
        dexterity: 18,
        seed: 1n,
    });

    assert.equal(samuraiDamage, ordinaryDamage + 1);
});

test('gauntlets of power hinder a bow shot', async () => {
    const bareDamage = await fireBowAtJackal({ seed: 11n });
    const glovedDamage = await fireBowAtJackal({
        glovesType: GAUNTLETS_OF_POWER,
        seed: 11n,
    });

    assert.ok(bareDamage > 0);
    assert.equal(glovedDamage, 0);
});

test('a poisoned thrown dart harms the target and costs lawful alignment', async () => {
    const throwDart = async poisoned => {
        freshObjectRoom({
            right: 20,
            gameplaySeed: 4910n,
            hero: { ualign: { type: A_LAWFUL, record: 10 } },
        });
        game.u.ulevel = 20;
        game.u.acurr.a[A_DEX] = 18;
        installHeroWeaponSkills({ [P_DART]: P_BASIC });
        const dart = addInventoryWeapon(DART, {
            invlet: 'a', opoisoned: poisoned,
        });
        const jackal = addMonster({
            species: 'jackal', x: 11, y: 10,
            hitPoints: 20, mac: 10,
        });
        initRng(1n);

        await throwInventoryObject(dart, 'l', Array(6).fill(' '));

        return {
            damage: 20 - jackal.mhp,
            alignment: game.u.ualign.record,
        };
    };

    const plain = await throwDart(false);
    const poisoned = await throwDart(true);

    assert.ok(
        poisoned.damage > plain.damage,
        `plain dart dealt ${plain.damage}; poisoned dart dealt ${
            poisoned.damage
        }`,
    );
    assert.equal(poisoned.alignment, 9);
});
