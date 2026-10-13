import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NEED_HTH_WEAPON, NEED_PICK_OR_AXE, NEED_RANGED_WEAPON, NO_MINVENT, W_ARMG, W_ARMS, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { monsterCanCarryObject, monsterCanTouchObject } from '../js/monster_carry.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { selectHandToHandWeapon, updateMonsterWeaponAfterPolymorph, wieldMonsterWeapon } from '../js/monster_weapon.js';
import { AKLYS, BELL_OF_OPENING, CLUB, CRYSKNIFE, DAGGER, DWARVISH_MATTOCK, LEATHER_GLOVES, OBJECT_NAMES, PICK_AXE, SMALL_SHIELD, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { artifactObject, knownObject, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
void test('wielding identifies a visible invisible monster by its current appearance', async () => {
    freshObjectRoom({ hero: { seeInvisible: true } });
    const hobbit = await createMonsterAt('hobbit', 11, 10, NO_MINVENT);
    hobbit.minvis = true;
    await addObjectToMonsterInventory(hobbit, await knownObject(DAGGER));
    hobbit.weaponCheck = NEED_HTH_WEAPON;
    const messages = [];
    await wieldMonsterWeapon(hobbit, game, { publish: async (message) => { messages.push(message); } });
    assert.match(messages[0] ?? '', /^The invisible hobbit wields /);
});
void test('a hallucinating hero sees a hallucinated monster wield the weapon', async () => {
    freshObjectRoom({ hero: { hallucination: true, hallucinationTurns: 10 } });
    const hobbit = await createMonsterAt('hobbit', 11, 10, NO_MINVENT);
    await addObjectToMonsterInventory(hobbit, await knownObject(DAGGER));
    hobbit.weaponCheck = NEED_HTH_WEAPON;
    const messages = [];
    await wieldMonsterWeapon(hobbit, game, { publish: async (message) => { messages.push(message); } });
    assert.match(messages[0] ?? '', / wields /);
    assert.doesNotMatch(messages[0] ?? '', /hobbit/);
});
void test('a visible monster names an unidentified tethered weapon by its appearance', async () => {
    freshObjectRoom();
    const gnome = await createMonsterAt('gnome', 11, 10, NO_MINVENT);
    const weapon = await knownObject(AKLYS, { known: false, typeKnown: false, dknown: false });
    await addObjectToMonsterInventory(gnome, weapon);
    gnome.weaponCheck = NEED_RANGED_WEAPON;
    gnome.mux = game.u.ux;
    gnome.muy = game.u.uy;
    const messages = [];
    await wieldMonsterWeapon(gnome, game, { publish: async (message) => { messages.push(message); } });
    assert.equal(messages[1], 'The gnome secures the tether on the thonged club.');
    assert.equal(weapon.dknown, true);
    assert.equal(gnome.mw, weapon);
});
void test('a digging monster uses a mattock with free hands and a pick-axe with a shield', async () => {
    for (const shield of [false, true]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const dwarf = await createMonsterAt('dwarf', 11, 10, NO_MINVENT);
        await addObjectToMonsterInventory(dwarf, await knownObject(DWARVISH_MATTOCK));
        await addObjectToMonsterInventory(dwarf, await knownObject(PICK_AXE));
        if (shield)
            await equipMonsterObject(dwarf, await knownObject(SMALL_SHIELD), W_ARMS);
        dwarf.weaponCheck = NEED_PICK_OR_AXE;
        const spentTurn = await wieldMonsterWeapon(dwarf, game, { publish: async () => { } });
        assert.equal(spentTurn, true);
        assert.equal(dwarf.mw?.otyp, shield ? PICK_AXE : DWARVISH_MATTOCK);
    }
});
void test('a lawful giant prefers Excalibur to its otherwise favored club', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    const sword = await addObjectToMonsterInventory(giant, await artifactObject('Excalibur'));
    assert.ok(sword);
    await addObjectToMonsterInventory(giant, await knownObject(CLUB));
    assert.equal(selectHandToHandWeapon(giant)?.o_id, sword.o_id);
});
void test('an ordinary monster refuses another role\'s self-willed quest weapon', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    await addObjectToMonsterInventory(giant, await knownObject(CLUB));
    const bow = await addObjectToMonsterInventory(giant, await artifactObject('The Longbow of Diana'));
    assert.ok(bow);
    assert.equal(monsterCanTouchObject(giant, bow), false);
    assert.equal(selectHandToHandWeapon(giant)?.otyp, CLUB);
});
void test('gloves let a monster choose a petrifying corpse as its weapon', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    soldier.mpeaceful = false;
    await addObjectToMonsterInventory(soldier, await knownObject(DAGGER));
    const corpse = await addObjectToMonsterInventory(soldier, await untimedCorpse(MONSTER_NAME.indexOf('cockatrice')));
    assert.ok(corpse);
    assert.equal(monsterCanCarryObject(soldier, corpse), false);
    assert.equal(selectHandToHandWeapon(soldier)?.otyp, DAGGER);
    await equipMonsterObject(soldier, await knownObject(LEATHER_GLOVES), W_ARMG);
    assert.equal(monsterCanCarryObject(soldier, corpse), true);
    assert.equal(selectHandToHandWeapon(soldier)?.o_id, corpse.o_id);
});
void test('a werewolf avoids silver and uses a safe dagger', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const werewolf = await createMonsterAt('werewolf', 11, 10, NO_MINVENT);
    await addObjectToMonsterInventory(werewolf, await knownObject(DAGGER));
    const saber = await addObjectToMonsterInventory(werewolf, await knownObject(SILVER_SABER));
    assert.ok(saber);
    assert.equal(monsterCanTouchObject(werewolf, saber), false);
    assert.equal(selectHandToHandWeapon(werewolf)?.otyp, DAGGER);
});
void test('a shield prevents choosing a two-handed weapon', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    await addObjectToMonsterInventory(soldier, await knownObject(TWO_HANDED_SWORD));
    await addObjectToMonsterInventory(soldier, await knownObject(DAGGER));
    await equipMonsterObject(soldier, await knownObject(SMALL_SHIELD), W_ARMS);
    assert.equal(selectHandToHandWeapon(soldier)?.otyp, DAGGER);
});
void test('a monster keeps inventory order among safe weapons of the same type', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    await addObjectToMonsterInventory(soldier, await knownObject(DAGGER, { spe: 6 }));
    const first = await addObjectToMonsterInventory(soldier, await knownObject(DAGGER, { spe: -2 }));
    assert.ok(first);
    assert.equal(selectHandToHandWeapon(soldier)?.o_id, first.o_id);
});
void test('Orcus can touch the invocation bell but not silver weapons or Demonbane', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const orcus = await createMonsterAt('Orcus', 11, 10, NO_MINVENT);
    assert.equal(monsterCanTouchObject(orcus, await knownObject(BELL_OF_OPENING)), true);
    assert.equal(monsterCanTouchObject(orcus, await knownObject(SILVER_SABER)), false);
    assert.equal(monsterCanTouchObject(orcus, await artifactObject('Excalibur')), true);
    assert.equal(monsterCanTouchObject(orcus, await artifactObject('Demonbane')), false);
    assert.equal(monsterCanTouchObject(orcus, await untimedCorpse(MONSTER_NAME.indexOf('Death'))), false);
});
void test('a fixed crysknife can stay intact when a new monster form drops it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('bugbear', 11, 10, NO_MINVENT);
    const knife = await equipMonsterObject(monster, await knownObject(CRYSKNIFE, { oerodeproof: true }), W_WEP);
    monster.mnum = MONSTER_NAME.indexOf('kitten');
    initRng(5n);
    await updateMonsterWeaponAfterPolymorph(monster);
    assert.equal(monster.mw, null);
    assert.ok(floorObjectsAt(game.level, 11, 10).includes(knife));
    assert.equal(knife.otyp, CRYSKNIFE);
    assert.equal(knife.oerodeproof, true);
});
//# sourceMappingURL=monster_weapon.test.js.map