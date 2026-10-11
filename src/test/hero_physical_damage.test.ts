import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHeroBarehandContact } from '../js/barehand_combat.js';
import {
    A_STR, P_BARE_HANDED_COMBAT, P_BASIC, P_BOW, P_DAGGER, P_EXPERT,
    P_POLEARMS, P_RIDING, P_SKILLED, P_TWO_WEAPON_COMBAT, STR18,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { recalculateHeroPhysicalDamage } from '../js/hero_physical_damage.js';
import { ARROW, BOW, DAGGER, OBJECT_NAMES, TWO_HANDED_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills, installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const damageBonuses = {
    mode: 'melee', twoHits: 0, getDamageBonus: true,
    useWeaponSkill: false, trainWeaponSkill: false,
} as const;

void test('two-handed melee adds three halves of Strength while keeping ring damage unchanged', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR18(50);
    game.u.udaminc = 2;
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);

    const melee = await recalculateHeroPhysicalDamage(4, sword, damageBonuses);
    const applied = await recalculateHeroPhysicalDamage(4, sword, { ...damageBonuses, mode: 'applied' });
    assert.equal(melee, 11);
    assert.equal(applied, 9);
});

void test('multiple weapon strikes take three quarters of Strength before the two-handed rule', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR18(50);
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);

    assert.equal(await recalculateHeroPhysicalDamage(4, sword, { ...damageBonuses, twoHits: 2 }), 6);
});

void test('two-handed Strength penalties round away from zero and cannot turn a hit into a miss', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 3;
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);

    assert.equal(await recalculateHeroPhysicalDamage(5, sword, damageBonuses), 3);
    game.u.udaminc = -20;
    assert.equal(await recalculateHeroPhysicalDamage(2, sword, damageBonuses), 1);
});

void test('launched arrows receive ring damage but no Strength, while kicked and unmatched arrows receive both', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR18(50);
    game.u.udaminc = 2;
    const bow = await addInventoryObject(BOW);
    const arrow = await knownObject(ARROW);
    await setPrimaryWeapon(bow);

    assert.equal(await recalculateHeroPhysicalDamage(4, arrow, { ...damageBonuses, mode: 'thrown' }), 6);
    assert.equal(await recalculateHeroPhysicalDamage(4, arrow, { ...damageBonuses, mode: 'kicked' }), 9);
    await setPrimaryWeapon(null);
    assert.equal(await recalculateHeroPhysicalDamage(4, arrow, { ...damageBonuses, mode: 'thrown' }), 9);
});

void test('polymorphed heroes keep ring damage without human Strength bonuses', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('minotaur');
    game.u.acurr.a[A_STR] = 125;
    game.u.udaminc = 2;
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);

    assert.equal(await recalculateHeroPhysicalDamage(4, sword, damageBonuses), 6);
});

void test('damage skill recognizes the exact wielded weapon, not another dagger of the same type', async () => {
    freshObjectRoom();
    installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT, [P_TWO_WEAPON_COMBAT]: P_BASIC });
    const primary = await addInventoryObject(DAGGER);
    const alternate = await addInventoryObject(DAGGER);
    const thrown = await knownObject(DAGGER);
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(alternate);
    setTwoWeaponCombat(true);
    const skilled = { ...damageBonuses, getDamageBonus: false, useWeaponSkill: true };

    assert.equal(await recalculateHeroPhysicalDamage(5, primary, skilled), 4);
    assert.equal(await recalculateHeroPhysicalDamage(5, alternate, skilled), 4);
    assert.equal(await recalculateHeroPhysicalDamage(5, thrown, { ...skilled, mode: 'thrown' }), 7);
});

void test('melee practice uses two-weapon combat while a thrown dagger trains its own skill', async () => {
    freshObjectRoom();
    const skills = installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT, [P_TWO_WEAPON_COMBAT]: P_BASIC });
    const primary = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    setTwoWeaponCombat(true);
    await recalculateHeroPhysicalDamage(5, primary, {
        ...damageBonuses, useWeaponSkill: true, trainWeaponSkill: true,
    });
    const thrown = await knownObject(DAGGER);
    await recalculateHeroPhysicalDamage(5, thrown, {
        ...damageBonuses, mode: 'thrown', useWeaponSkill: true, trainWeaponSkill: true,
    });

    assert.equal(skills[P_TWO_WEAPON_COMBAT]?.advance, 1);
    assert.equal(skills[P_DAGGER]?.advance, 1);
});

void test('a projectile uses its matching launcher for damage skill and training', async () => {
    freshObjectRoom();
    const skills = installHeroWeaponSkills({ [P_BOW]: P_EXPERT });
    const bow = await addInventoryObject(BOW);
    const arrow = await knownObject(ARROW);
    await setPrimaryWeapon(bow);
    const damage = await recalculateHeroPhysicalDamage(5, arrow, {
        ...damageBonuses, mode: 'thrown', getDamageBonus: false,
        useWeaponSkill: true, trainWeaponSkill: true,
    });

    assert.equal(damage, 7);
    assert.equal(skills[P_BOW]?.advance, 1);
});

void test('applied polearms use their skill and ordinary Strength without two-handed scaling', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR18(50);
    const skills = installHeroWeaponSkills({ [P_POLEARMS]: P_SKILLED });
    const halberdType = OBJECT_NAMES.indexOf('halberd');
    assert.ok(halberdType >= 0);
    const halberd = await addInventoryObject(halberdType);
    await setPrimaryWeapon(halberd);
    const damage = await recalculateHeroPhysicalDamage(5, halberd, {
        ...damageBonuses, mode: 'applied', useWeaponSkill: true, trainWeaponSkill: true,
    });

    assert.equal(damage, 9);
    assert.equal(skills[P_POLEARMS]?.advance, 1);
});

void test('riding adds thrust to an ordinary weapon but not to a two-weapon strike', async () => {
    freshObjectRoom();
    installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT, [P_TWO_WEAPON_COMBAT]: P_EXPERT, [P_RIDING]: P_EXPERT });
    game.u.usteed = await createSaddledSteed();
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    const skilled = { ...damageBonuses, getDamageBonus: false, useWeaponSkill: true };
    assert.equal(await recalculateHeroPhysicalDamage(5, dagger, skilled), 9);
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    setTwoWeaponCombat(true);
    assert.equal(await recalculateHeroPhysicalDamage(5, dagger, skilled), 6);
});

void test('raw barehand preparation leaves bonuses and practice to the later damage stage', async () => {
    freshObjectRoom({ role: 'monk' });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 125;
    game.u.udaminc = 10;
    const skills = installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_EXPERT });
    const target = await createMonsterAt('lichen', 11, 10);
    const contact = prepareHeroBarehandContact(target);

    assert.ok(contact.damage >= 1 && contact.damage <= 4);
    assert.equal(contact.useWeaponSkill, true);
    assert.equal(contact.trainWeaponSkill, contact.damage > 1);
    assert.equal(skills[P_BARE_HANDED_COMBAT]?.advance, 0);
    const damage = await recalculateHeroPhysicalDamage(contact.damage, null, {
        ...damageBonuses, useWeaponSkill: contact.useWeaponSkill,
        trainWeaponSkill: contact.trainWeaponSkill,
    });
    assert.equal(damage, contact.damage + 22);
    assert.equal(skills[P_BARE_HANDED_COMBAT]?.advance, contact.damage > 1 ? 1 : 0);
});

void test('contact flags can disable ring and Strength bonuses without disabling skill', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 125;
    game.u.udaminc = 10;
    installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT });
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);

    assert.equal(await recalculateHeroPhysicalDamage(5, dagger, {
        ...damageBonuses, getDamageBonus: false, useWeaponSkill: true,
    }), 7);
});
