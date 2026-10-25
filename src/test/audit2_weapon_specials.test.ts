// Second-pass weapon.c/wield.c audit locks: C-source branches that no earlier
// test exercised. Every expected number below is derived from the pinned C
// sources (weapon.c hitval()/dmg(), weapon.c weapon_hit_bonus()/
// weapon_dam_bonus(), weapon.c select_hwep()/select_rwep()).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AKLYS, DAGGER, DART, DWARVISH_MATTOCK, LONG_SWORD, MACE, OBJECT_NAMES,
} from '../js/object_data.js';
import {
    P_BARE_HANDED_COMBAT, P_BASIC, P_DAGGER, P_EXPERT, P_ISRESTRICTED,
    P_LANCE, P_RIDING, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED,
    W_ARMG, W_WEP, NO_MINVENT,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { artifactByName } from '../js/artifacts.js';
import { nameToMonster } from '../js/mondata.js';
import {
    ensureHeroSkills, weaponSkillDamageBonus, weaponSkillHitBonus,
} from '../js/skills.js';
import { rollPhysicalWeaponDamage } from '../js/weapon_damage.js';
import { weaponHitBonus } from '../js/weapon_accuracy.js';
import {
    selectHandToHandWeapon, selectMonsterRangedWeapon,
} from '../js/monster_weapon.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const typeOf = (name: string): number => {
    const index = OBJECT_NAMES.indexOf(name);
    assert.ok(index >= 0, `object ${name} exists`);
    return index;
};

const maximumRoll = (sides: number): number => sides;
const maximumDice = (count: number, sides: number): number => count * sides;
const minimumRoll = (): number => 1;

const defender = (species: string) => ({ mnum: nameToMonster(species) });

// C weapon.c:hitval(): is_pick() also covers the dwarvish mattock, and the
// target needs both passes_walls() and thick_skinned().
void test('a mattock shares the pick accuracy bonus against an earth elemental', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 1 } });
    initRng(1n);
    const mattock = await uninitializedObject(DWARVISH_MATTOCK, { spe: 0 });
    const elemental = await createMonsterAt('earth elemental', 10, 8, NO_MINVENT);
    const gnome = await createMonsterAt('gnome lord', 10, 7, NO_MINVENT);

    assert.equal(weaponHitBonus(mattock, elemental)
        - weaponHitBonus(mattock, gnome), 2);
});

// C weapon.c:dmgval(): "negative enchantment mustn't produce negative damage"
// and "always subtract erosion even for blunt weapons ... if (tmp < 1) tmp = 1".
// A mace rolls 1d6+1 against man-sized defenders.
void test('weapon damage floors negative enchantment at zero and erosion at one', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 1 } });
    initRng(1n);

    const drained = await uninitializedObject(MACE, { spe: -3 });
    assert.equal(rollPhysicalWeaponDamage(drained, defender('jackal'),
        { rollOne: minimumRoll, rollDice: maximumDice }), 0);
    assert.equal(rollPhysicalWeaponDamage(drained, defender('jackal'),
        { rollOne: maximumRoll, rollDice: maximumDice }), 4);

    const rusted = await uninitializedObject(MACE, { oeroded: 3 });
    assert.equal(rollPhysicalWeaponDamage(rusted, defender('jackal'),
        { rollOne: minimumRoll, rollDice: maximumDice }), 1);
    // greatest_erosion() takes the worse of fire damage and rot.
    const rotted = await uninitializedObject(MACE, { oeroded: 1, oeroded2: 2 });
    assert.equal(rollPhysicalWeaponDamage(rotted, defender('jackal'),
        { rollOne: maximumRoll, rollDice: maximumDice }), 5);
});

// C weapon.c:dmgval() target bonuses: rnd(4) for blessed vs undead/demons,
// rnd(20) for silver vs silver-haters, rnd(8) for a lit light artifact vs a
// gremlin. Maximum rolls pin the exact die sizes.
void test('blessed, silver, and wielded light each add their own damage die', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 1 } });
    initRng(1n);
    const maximum = { rollOne: maximumRoll, rollDice: maximumDice };

    const blessedMace = await uninitializedObject(MACE, { blessed: true });
    assert.equal(rollPhysicalWeaponDamage(blessedMace, defender('human zombie'), maximum), 11);
    assert.equal(rollPhysicalWeaponDamage(blessedMace, defender('jackal'), maximum), 7);

    const silverDagger = await uninitializedObject(typeOf('silver dagger'));
    assert.equal(rollPhysicalWeaponDamage(silverDagger, defender('werewolf'), maximum), 24);
    assert.equal(rollPhysicalWeaponDamage(silverDagger, defender('jackal'), maximum), 4);

    const unlitSunsword = await artifactObject('Sunsword', {});
    assert.equal(rollPhysicalWeaponDamage(unlitSunsword, defender('gremlin'), maximum), 8);
    const litSunsword = await artifactObject('Sunsword', { lamplit: true });
    assert.equal(rollPhysicalWeaponDamage(litSunsword, defender('gremlin'), maximum), 16);
    assert.equal(rollPhysicalWeaponDamage(litSunsword, defender('jackal'), maximum), 8);
});

// C weapon.c:weapon_hit_bonus()/weapon_dam_bonus(): two-weapon combat uses
// the lesser of the two-weapon skill and the weapon's own skill; bare-handed
// combat scales with martial_bonus(); riding penalizes accuracy, adds thrust
// damage, and dual wielding rides worse.
void test('skill bonuses follow the native two-weapon, martial arts, and riding tables', async () => {
    freshObjectRoom({ role: 'samurai', hero: { ulevel: 1 } });
    initRng(1n);
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    const twoWeaponSkill = skills[P_TWO_WEAPON_COMBAT];
    const daggerSkill = skills[P_DAGGER];
    const ridingSkill = skills[P_RIDING];
    const bareHandedSkill = skills[P_BARE_HANDED_COMBAT];
    assert.ok(twoWeaponSkill && daggerSkill && ridingSkill && bareHandedSkill);
    const dagger = await uninitializedObject(DAGGER, { spe: 0 });
    const steed = await createMonsterAt('pony', 9, 8, NO_MINVENT);
    await setPrimaryWeapon(dagger);
    await setSecondaryWeapon(await uninitializedObject(LONG_SWORD, { spe: 0 }));

    twoWeaponSkill.skill = P_EXPERT;
    daggerSkill.skill = P_BASIC;
    game.u.twoweap = true;
    assert.equal(weaponSkillHitBonus(dagger, game), -7);
    assert.equal(weaponSkillDamageBonus(dagger, game), -1);

    daggerSkill.skill = P_EXPERT;
    assert.equal(weaponSkillHitBonus(dagger, game), -3);
    assert.equal(weaponSkillDamageBonus(dagger, game), 1);

    game.u.twoweap = false;
    assert.equal(weaponSkillHitBonus(dagger, game), 3);
    assert.equal(weaponSkillDamageBonus(dagger, game), 2);

    // Mounted with unskilled riding: -2 riding accuracy and -2 more for a
    // mounted dual wield; damage gets no thrusting bonus (C weapon.c).
    game.u.usteed = steed;
    game.u.twoweap = true;
    assert.equal(weaponSkillHitBonus(dagger, game), -7);
    assert.equal(weaponSkillDamageBonus(dagger, game), 1);

    // Dismounted samurai martial arts: the role ceiling already grants Basic
    // (C skill_init() high-potential fighters); skilled +4/+4, then +7/+9.
    game.u.twoweap = false;
    game.u.usteed = null;
    assert.equal(bareHandedSkill.skill, P_BASIC);
    bareHandedSkill.skill = P_SKILLED;
    assert.equal(weaponSkillHitBonus(null, game), 4);
    assert.equal(weaponSkillDamageBonus(null, game), 4);
    bareHandedSkill.skill = 6;
    assert.equal(weaponSkillHitBonus(null, game), 7);
    assert.equal(weaponSkillDamageBonus(null, game), 9);

    // Skilled riding: accuracy unaffected, one thrusting damage; dual
    // wielding rides worse and forgoes the thrust.
    game.u.usteed = steed;
    ridingSkill.skill = P_SKILLED;
    assert.equal(weaponSkillHitBonus(dagger, game), 3);
    assert.equal(weaponSkillDamageBonus(dagger, game), 3);
    game.u.twoweap = true;
    assert.equal(weaponSkillHitBonus(dagger, game), -5);
    assert.equal(weaponSkillDamageBonus(dagger, game), 1);
});

// C weapon.c:select_hwep(): silver weapons are skipped for silver-hating
// wielders, giants love clubs, a Balrog facing an armed hero grabs a whip,
// and a cockatrice corpse is only wielded through gloves.
void test('hand-to-hand monster weapon choice respects the native preferences', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 1 } });
    initRng(1n);

    // hwep[] prefers the silver saber to the mace, so only the
    // mon_hates_silver() skip makes the demon settle for the mace.
    const marilith = await createMonsterAt('marilith', 10, 8);
    await addObjectToMonsterInventory(marilith, await uninitializedObject(typeOf('silver saber')));
    await addObjectToMonsterInventory(marilith, await uninitializedObject(MACE));
    assert.equal(selectHandToHandWeapon(marilith)?.otyp, MACE);
    const orcLeader = await createMonsterAt('orc captain', 9, 7);
    await addObjectToMonsterInventory(orcLeader, await uninitializedObject(typeOf('silver saber')));
    await addObjectToMonsterInventory(orcLeader, await uninitializedObject(MACE));
    assert.equal(selectHandToHandWeapon(orcLeader)?.otyp, typeOf('silver saber'));

    const giant = await createMonsterAt('hill giant', 10, 7);
    await addObjectToMonsterInventory(giant, await uninitializedObject(LONG_SWORD));
    await addObjectToMonsterInventory(giant, await uninitializedObject(typeOf('club')));
    assert.equal(selectHandToHandWeapon(giant)?.otyp, typeOf('club'));

    const balrog = await createMonsterAt('balrog', 9, 8);
    await setPrimaryWeapon(await uninitializedObject(LONG_SWORD), game);
    await addObjectToMonsterInventory(balrog, await uninitializedObject(LONG_SWORD));
    await addObjectToMonsterInventory(balrog, await uninitializedObject(typeOf('bullwhip')));
    assert.equal(selectHandToHandWeapon(balrog)?.otyp, typeOf('bullwhip'));

    const orc = await createMonsterAt('orc captain', 8, 6);
    const corpse = await uninitializedObject(typeOf('corpse'),
        { corpsenm: nameToMonster('cockatrice') });
    await addObjectToMonsterInventory(orc, await uninitializedObject(LONG_SWORD));
    await addObjectToMonsterInventory(orc, corpse);
    assert.equal(selectHandToHandWeapon(orc)?.otyp, LONG_SWORD);
    const gloves = await uninitializedObject(typeOf('leather gloves'));
    gloves.owornmask = W_ARMG;
    orc.misc_worn_check = (orc.misc_worn_check ?? 0) | W_ARMG;
    await addObjectToMonsterInventory(orc, gloves);
    assert.equal(selectHandToHandWeapon(orc)?.otyp, corpse.otyp);
    assert.equal(selectHandToHandWeapon(orc), corpse);
});

// C weapon.c:select_rwep(): polearms are preferred within the squared
// distance 13 while visible; Snickersnee serves as its own propellor; an
// aklys is a throw-and-return weapon for thinking monsters only.
void test('ranged monster weapon choice prefers polearms in reach and returning weapons', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 1 } });
    initRng(1n);

    const ogre = await createMonsterAt('ogre', 8, 8);
    await addObjectToMonsterInventory(ogre, await uninitializedObject(typeOf('halberd')));
    await addObjectToMonsterInventory(ogre, await uninitializedObject(DART, { quan: 5 }));
    ogre.mux = 10; ogre.muy = 8;
    assert.equal(selectMonsterRangedWeapon(ogre)?.weapon.otyp, typeOf('halberd'));
    ogre.mux = 14; ogre.muy = 10;
    assert.equal(selectMonsterRangedWeapon(ogre)?.weapon.otyp, DART);

    const samurai = await createMonsterAt('samurai', 10, 9);
    const snickersnee = artifactByName('Snickersnee');
    assert.ok(snickersnee);
    const katana = await uninitializedObject(typeOf('katana'), { oartifact: snickersnee.id });
    await equipMonsterObject(samurai, katana, W_WEP);
    samurai.mux = 10; samurai.muy = 7;
    const snickSelection = selectMonsterRangedWeapon(samurai);
    assert.equal(snickSelection?.weapon.otyp, typeOf('katana'));
    assert.equal(snickSelection?.launcher, katana);

    const orc = await createMonsterAt('orc', 10, 6);
    await addObjectToMonsterInventory(orc, await uninitializedObject(AKLYS));
    await addObjectToMonsterInventory(orc, await uninitializedObject(DART, { quan: 5 }));
    orc.mux = 10; orc.muy = 7;
    assert.equal(selectMonsterRangedWeapon(orc)?.weapon.otyp, AKLYS);

    const light = await createMonsterAt('yellow light', 10, 5);
    await addObjectToMonsterInventory(light, await uninitializedObject(AKLYS));
    await addObjectToMonsterInventory(light, await uninitializedObject(DART, { quan: 5 }));
    light.mux = 10; light.muy = 5;
    assert.equal(selectMonsterRangedWeapon(light)?.weapon.otyp, DART);
});

// C weapon.c:skill_init(): every role's def_skill table from u_init.c maps to
// the same per-role ceilings, including the roles the brief calls out.
void test('role skill ceilings match the native class tables', async () => {
    for (const [role, skill, ceiling] of [
        ['priest', P_LANCE, P_BASIC],
        ['priest', P_RIDING, P_ISRESTRICTED],
        ['priest', P_BARE_HANDED_COMBAT, P_BASIC],
        ['monk', P_BARE_HANDED_COMBAT, 6],
        ['valkyrie', P_TWO_WEAPON_COMBAT, P_SKILLED],
        ['valkyrie', P_BARE_HANDED_COMBAT, P_EXPERT],
        ['knight', P_RIDING, P_EXPERT],
        ['samurai', P_TWO_WEAPON_COMBAT, P_EXPERT],
    ] as const) {
        freshObjectRoom({ role, hero: { ulevel: 1 } });
        const skills = ensureHeroSkills(game);
        assert.ok(skills, `${role} skills initialize`);
        const entry = skills[skill];
        assert.ok(entry, `${role} has skill ${skill}`);
        assert.equal(entry.maxSkill, ceiling, `${role} skill ${skill} ceiling`);
        if (skill === P_BARE_HANDED_COMBAT && ceiling > P_EXPERT) {
            // C skill_init(): "High potential fighters already know how to
            // use their hands."
            assert.equal(entry.skill, P_BASIC, `${role} begins trained in bare hands`);
        }
    }
    // A weapon in the role's table stays unskilled until carried: the
    // Barbarian kit carries no dagger, so his in-table dagger skill starts
    // untrained (C skill_init() promotes only carried weapons to Basic).
    freshObjectRoom({ role: 'barbarian', hero: { ulevel: 1 } });
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    const daggerSkill = skills[P_DAGGER];
    assert.ok(daggerSkill, 'the barbarian dagger skill must initialize');
    assert.equal(daggerSkill.maxSkill, P_BASIC);
    assert.equal(daggerSkill.skill, P_UNSKILLED);
});
