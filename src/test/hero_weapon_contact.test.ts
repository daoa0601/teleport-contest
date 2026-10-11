import test from 'node:test';
import assert from 'node:assert/strict';
import { P_AXE, P_LONG_SWORD, P_SKILLED, P_TWO_HANDED_SWORD, W_WEP, NO_MINVENT, MM_NOGRP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { remove_object } from '../js/floor_object.js';
import { prepareHeroWeaponContact } from '../js/hero_weapon_contact.js';
import {
    ARROW, BATTLE_AXE, BOOMERANG, BOW, DAGGER, FOOD_RATION, KATANA,
    OBJECT_NAMES, TWO_HANDED_SWORD,
} from '../js/object_data.js';
import { ownedObjectAction, ownedObjectName } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills, installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import type { RoleKey } from '../js/roles.js';
import type { HeroPhysicalAttackMode } from '../js/hero_physical_types.js';

async function contactRoom(role: RoleKey = 'tourist', species = 'hill giant') {
    freshObjectRoom({ role, flags: { verbose: false } });
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };
    return { monster, state: game, messages, publish };
}

for (const mode of ['melee', 'thrown', 'kicked', 'applied', 'dragged'] as const) {
    void test(`a bow used as the striking object is improvised in ${mode} combat`, async () => {
        const { monster, state, publish } = await contactRoom();
        const bow = await addInventoryObject(BOW, { spe: 20 });

        const hit = await prepareHeroWeaponContact(monster, bow, { mode, dieRoll: 10, state, publish });

        assert.ok(hit);
        assert.ok(hit.damage >= 1 && hit.damage <= 2);
        assert.equal(hit.useWeaponSkill, false);
        assert.equal(hit.trainWeaponSkill, false);
    });
}

void test('arrows receive their weapon damage only when actually shot from the matching launcher', async () => {
    const { monster, state, publish } = await contactRoom();
    const arrow = await knownObject(ARROW, { spe: 20 });
    const shotOptions = { mode: 'thrown' as const, dieRoll: 10, state, publish };

    const withoutBow = await prepareHeroWeaponContact(monster, arrow, shotOptions);
    await setPrimaryWeapon(await addInventoryObject(BOW));
    const shot = await prepareHeroWeaponContact(monster, arrow, shotOptions);
    const kicked = await prepareHeroWeaponContact(monster, arrow, { ...shotOptions, mode: 'kicked' });

    assert.ok(withoutBow && shot && kicked);
    assert.ok(withoutBow.damage <= 2);
    assert.equal(withoutBow.useWeaponSkill, false);
    assert.ok(shot.damage > 20);
    assert.equal(shot.useWeaponSkill, true);
    assert.ok(kicked.damage <= 2);
    assert.equal(kicked.useWeaponSkill, false);
});

void test('an unmounted lance uses its normal damage when applied at range', async () => {
    const { monster, state, publish } = await contactRoom();
    const lance = await addInventoryObject(OBJECT_NAMES.indexOf('lance'), { spe: 20 });
    await setPrimaryWeapon(lance);

    const bashed = await prepareHeroWeaponContact(monster, lance, { mode: 'melee', dieRoll: 10, state, publish });
    const applied = await prepareHeroWeaponContact(monster, lance, { mode: 'applied', dieRoll: 10, state, publish });

    assert.ok(bashed && applied);
    assert.ok(bashed.damage <= 2);
    assert.equal(bashed.useWeaponSkill, false);
    assert.ok(applied.damage > 20);
    assert.equal(applied.useWeaponSkill, true);
});

void test('Snickersnee retains proper weapon damage in unmounted melee', async () => {
    const { monster, state, publish } = await contactRoom();
    const weapon = await addInventoryItem(await artifactObject('Snickersnee', { spe: 20 }));
    await setPrimaryWeapon(weapon);

    const hit = await prepareHeroWeaponContact(monster, weapon, { mode: 'melee', dieRoll: 10, state, publish });

    assert.ok(hit && hit.damage > 20);
    assert.equal(hit.useWeaponSkill, true);
});

void test('improvised silver hurts a shade while ordinary ammunition passes through', async () => {
    const { monster, state, publish } = await contactRoom('tourist', 'shade');
    const ordinary = await knownObject(ARROW);
    const silver = await knownObject(OBJECT_NAMES.indexOf('silver arrow'));

    const miss = await prepareHeroWeaponContact(monster, ordinary, { mode: 'melee', dieRoll: 10, state, publish });
    const hit = await prepareHeroWeaponContact(monster, silver, { mode: 'melee', dieRoll: 10, state, publish });

    assert.equal(miss?.damage, 0);
    assert.ok(hit && hit.damage >= 2 && hit.damage <= 22);
    assert.equal(hit.useWeaponSkill, false);
});

for (const quantity of [1, 3]) {
    void test(`a splintered boomerang ${quantity === 1 ? 'clears the primary slot' : 'consumes only one item from the wielded stack'}`, async () => {
        const { monster, state, publish, messages } = await contactRoom();
        const boomerang = await addInventoryObject(BOOMERANG, { quan: quantity });
        await setPrimaryWeapon(boomerang);
        initRng(10n);

        const hit = await prepareHeroWeaponContact(monster, boomerang, { mode: 'melee', dieRoll: 10, state, publish });

        assert.ok(hit);
        assert.equal(hit.specialMessage, true);
        assert.ok(hit.damage >= 2 && hit.damage <= 3);
        assert.match(messages.join('\n'), /breaks into splinters/);
        if (quantity === 1) {
            assert.equal(state.uwep, null);
            assert.equal(boomerang.where, 'gone');
            assert.equal(state._unweapon, true);
        } else {
            assert.equal(state.uwep, boomerang);
            assert.equal(boomerang.quan, 2);
            assert.match(messages.join('\n'), /one of your boomerangs/);
        }
    });
}

void test('thrown boomerangs use their normal damage and do not splinter from melee contact', async () => {
    const { monster, state, publish } = await contactRoom();
    const boomerang = await knownObject(BOOMERANG, { spe: 20 });
    initRng(10n);

    const hit = await prepareHeroWeaponContact(monster, boomerang, { mode: 'thrown', dieRoll: 10, state, publish });

    assert.ok(hit && hit.damage > 20);
    assert.equal(hit.useWeaponSkill, true);
    assert.equal(boomerang.where, 'free');
});

void test('Healer anatomy improves a knife by at most three damage without granting skill training', async () => {
    const { monster, state, publish } = await contactRoom('healer');
    const knife = await addInventoryObject(OBJECT_NAMES.indexOf('scalpel'), { spe: -20 });
    await setPrimaryWeapon(knife);
    requireMonsterVital(monster.mnum).died = 24;

    const hit = await prepareHeroWeaponContact(monster, knife, { mode: 'melee', dieRoll: 10, state, publish });

    assert.equal(hit?.damage, 3);
    assert.equal(hit.trainWeaponSkill, false);
});

void test('a Healer cannot apply anatomy knowledge to a thrown knife', async () => {
    const { monster, state, publish } = await contactRoom('healer');
    const knife = await knownObject(OBJECT_NAMES.indexOf('scalpel'), { spe: -20 });
    requireMonsterVital(monster.mnum).died = 24;

    const hit = await prepareHeroWeaponContact(monster, knife, { mode: 'thrown', dieRoll: 10, state, publish });

    assert.equal(hit?.damage, 0);
});

void test('a Rogue can backstab a visible fleeing opponent with an applied polearm', async () => {
    const { monster, state, publish, messages } = await contactRoom('rogue');
    const weapon = await addInventoryObject(OBJECT_NAMES.indexOf('glaive'), { spe: 20 });
    await setPrimaryWeapon(weapon);
    monster.mflee = 1;

    const hit = await prepareHeroWeaponContact(monster, weapon, { mode: 'applied', dieRoll: 10, state, publish });

    assert.ok(hit?.specialMessage);
    assert.match(messages.join('\n'), /You strike the hill giant from behind!/);
});

for (const restriction of ['thrown', 'unseen', 'held', 'two weapons', 'polymorphed'] as const) {
    void test(`a ${restriction} Rogue attack cannot gain the backstab bonus`, async () => {
        const { monster, state, publish, messages } = await contactRoom('rogue');
        const weapon = await addInventoryObject(DAGGER, { spe: 20 });
        await setPrimaryWeapon(weapon);
        monster.mflee = 1;
        let mode: HeroPhysicalAttackMode = 'melee';
        if (restriction === 'thrown') mode = 'thrown';
        if (restriction === 'unseen') await makeBlinded(20, { state, talk: false });
        if (restriction === 'held') state.u.ustuck = monster;
        if (restriction === 'two weapons') setTwoWeaponCombat(true, state);
        if (restriction === 'polymorphed') installPolymorphedHero('orc');

        const hit = await prepareHeroWeaponContact(monster, weapon, { mode, dieRoll: 10, state, publish });

        assert.equal(hit?.specialMessage, false);
        assert.equal(messages.length, 0);
    });
}

for (const species of ['acid blob', 'floating eye', 'brown mold', 'air elemental', 'ghost']) {
    void test(`a fleeing ${species} has no vulnerable back for a Rogue`, async () => {
        const { monster, state, publish, messages } = await contactRoom('rogue', species);
        const weapon = await addInventoryObject(DAGGER, { spe: 20 });
        await setPrimaryWeapon(weapon);
        monster.mflee = 1;

        const hit = await prepareHeroWeaponContact(monster, weapon, { mode: 'melee', dieRoll: 10, state, publish });

        assert.equal(hit?.specialMessage, false);
        assert.equal(messages.length, 0);
    });
}

for (const samurai of [false, true]) {
    void test(`${samurai ? 'a skilled Samurai katana strike' : 'a skilled two-handed strike'} can shatter the defender's weapon`, async () => {
        const { monster, state, publish, messages } = await contactRoom(samurai ? 'samurai' : 'tourist');
        const weapon = await addInventoryObject(samurai ? KATANA : TWO_HANDED_SWORD, { spe: 20 });
        await setPrimaryWeapon(weapon);
        installHeroWeaponSkills({ [samurai ? P_LONG_SWORD : P_TWO_HANDED_SWORD]: P_SKILLED });
        const defenderWeapon = await equipMonsterObject(monster, await knownObject(DAGGER, { oeroded: 3, oeroded2: 3 }), W_WEP);
        initRng(71n);

        const hit = await prepareHeroWeaponContact(monster, weapon, { mode: 'melee', dieRoll: 2, state, publish });

        assert.ok(hit?.specialMessage);
        assert.equal(defenderWeapon.where, 'gone');
        assert.equal(monster.mw, null);
        assert.equal(monster.minvent?.includes(defenderWeapon), false);
        assert.match(messages.join('\n'), /The hill giant's dagger shatters from the force of your blow!/);
    });
}

void test('Cleaver cannot shatter weapons or gain a Rogue backstab during its sweep', async () => {
    const { monster, state, publish, messages } = await contactRoom('rogue');
    const cleaver = await addInventoryItem(await artifactObject('Cleaver', { spe: 20 }));
    await setPrimaryWeapon(cleaver);
    installHeroWeaponSkills({ [P_AXE]: P_SKILLED });
    const defenderWeapon = await equipMonsterObject(monster, await knownObject(DAGGER, { oeroded: 3 }), W_WEP);
    monster.mflee = 1;

    const hit = await prepareHeroWeaponContact(monster, cleaver, { mode: 'melee', dieRoll: 2, state, publish });

    assert.equal(hit?.specialMessage, false);
    assert.equal(monster.mw, defenderWeapon);
    assert.equal(messages.length, 0);
});

void test('an artifact defender weapon resists a shattering blow', async () => {
    const { monster, state, publish } = await contactRoom();
    await setPrimaryWeapon(await addInventoryObject(BATTLE_AXE, { spe: 20 }));
    const weapon = state.uwep;
    assert.ok(weapon);
    installHeroWeaponSkills({ [P_AXE]: P_SKILLED });
    const defenderWeapon = await equipMonsterObject(monster, await artifactObject('Sting', { oeroded: 3 }), W_WEP);

    const hit = await prepareHeroWeaponContact(monster, weapon, { mode: 'melee', dieRoll: 2, state, publish });

    assert.equal(hit?.specialMessage, false);
    assert.equal(monster.mw, defenderWeapon);
    assert.equal(defenderWeapon.where, 'minvent');
});

void test('non-weapons leave contact resolution to their object-specific owner', async () => {
    const { monster, state, publish } = await contactRoom();
    const food = await knownObject(FOOD_RATION);

    const hit = await prepareHeroWeaponContact(monster, food, { mode: 'melee', dieRoll: 10, state, publish });

    assert.equal(hit, null);
    assert.equal(food.where, 'free');
});

void test('monster equipment naming uses the actual carrier and correct sentence case', async () => {
    const { monster, state } = await contactRoom();
    const weapon = await equipMonsterObject(monster, await knownObject(DAGGER), W_WEP);

    assert.equal(ownedObjectAction(weapon, 'shatter', state), "The hill giant's dagger shatters");
    assert.equal(ownedObjectName(weapon, state, { capitalized: false }), "the hill giant's dagger");
    monster.mtame = 10;
    assert.equal(ownedObjectName(weapon, state), "Your hill giant's dagger");
});

void test('shop floor stock names its keeper until a monster takes ownership', async () => {
    const { state } = await contactRoom();
    const { shopkeeper } = await createStaffedShop({ left: 12, right: 16, keeperX: 15, keeperY: 10 });
    shopkeeper.eshk.shknam = 'Izchak';
    const carrier = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    const weapon = await floorObject(DAGGER, 13, 10);

    assert.equal(ownedObjectAction(weapon, 'shatter', state), "Izchak's dagger shatters");
    assert.equal(state.u.ux, 10);

    remove_object(weapon, state);
    await equipMonsterObject(carrier, weapon, W_WEP);

    assert.equal(ownedObjectAction(weapon, 'shatter', state), "The orc's dagger shatters");
    assert.equal(!!weapon.unpaid, false);
});

void test('an unclaimed floor item has no invented hero ownership', async () => {
    const { state } = await contactRoom();
    const weapon = await floorObject(DAGGER, 12, 10);

    assert.equal(ownedObjectName(weapon, state), 'The dagger');
});
