import assert from 'node:assert/strict';
import test from 'node:test';
import { LARGEST_INT, MFAST, MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_ARMG, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { speciesCanBlow } from '../js/monster_anatomy.js';
import { monsterCanCarryObject, monsterCanTouchObject, monsterCarryAmount } from '../js/monster_carry.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { monsterSearchesForItem, monsterWantsFloorObject } from '../js/monster_item_interest.js';
import { setMonsterSpecies } from '../js/monster_species.js';
import { addObjectToContainer } from '../js/object_container.js';
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, BAG_OF_HOLDING, BAG_OF_TRICKS,
    BOULDER, CORPSE, DAGGER, EGG, EXPENSIVE_CAMERA, FIRE_HORN, GOLD_PIECE,
    HEAVY_IRON_BALL, IRON_CHAIN, LEATHER_GLOVES, OBJECT_MATERIAL, OBJECT_NAMES, PICK_AXE,
    POT_BLINDNESS, POT_HEALING, POT_INVISIBILITY, POT_WATER, ROCK, RUBY, SACK,
    SCR_SCARE_MONSTER, SCR_TELEPORTATION, STATUE, TIN, TIN_OPENER, UNICORN_HORN,
    WAN_DIGGING, WAN_FIRE, WAN_MAKE_INVISIBLE, WAN_POLYMORPH, WAN_SPEED_MONSTER,
    WAN_TELEPORTATION, WORTHLESS_PIECE_OF_RED_GLASS,
} from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { objectClassForType } from '../js/object_knowledge.js';
import { objectMaterial } from '../js/object_material.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';
import { artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;

async function interestRoom(species = 'goblin') {
    freshObjectRoom({ gameplaySeed: 97n, context: { mon_moving: true } });
    requirePlayingGame(game);
    const state = game;
    const monster = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
    monster.mpeaceful = false;
    return { monster, state,
        wants: (object: GameObject) => monsterWantsFloorObject(monster, object, state),
        searches: (object: GameObject) => monsterSearchesForItem(monster, object, state) };
}

void test('intelligent monsters seek useful wands and medicine without a general magic-collection trait', async () => {
    const { wants } = await interestRoom();

    assert.equal(wants(await knownObject(WAN_FIRE, { spe: 1 })), true);
    assert.equal(wants(await knownObject(POT_HEALING)), true);
    assert.equal(wants(await knownObject(SCR_TELEPORTATION)), true);
    assert.equal(wants(await knownObject(POT_WATER)), false);
    assert.equal(wants(await knownObject(WAN_FIRE, { spe: 0 })), false);
    assert.equal(wants(await knownObject(FIRE_HORN, { spe: 1 })), true);
    assert.equal(wants(await knownObject(FIRE_HORN, { spe: 0 })), false);
});

void test('teleport restrictions do not erase interest in a charged teleportation wand', async () => {
    const { state, wants } = await interestRoom();
    state.level.flags.noteleport = true;

    assert.equal(wants(await knownObject(WAN_TELEPORTATION, { spe: 1 })), true);
});

for (const { label, species, type, before, after } of [
    { label: 'useful medicine at 75 percent', species: 'dwarf', type: POT_HEALING, before: 74900, after: 75000 },
    { label: 'practical weapons at 75 percent', species: 'dwarf', type: DAGGER, before: 74900, after: 75000 },
    { label: 'gems at 85 percent', species: 'dwarf', type: RUBY, before: 84900, after: 85000 },
    { label: 'gold at 95 percent', species: 'dwarf', type: GOLD_PIECE, before: 94900, after: 95000 },
    // Stone giants carry 1551 units; 776 crosses the integer 50% threshold.
    { label: 'boulders at 50 percent', species: 'stone giant', type: BOULDER, before: 77500, after: 77600 },
    // A lich carries 413 units; 352 crosses the integer 85% threshold.
    { label: 'magical jewelry at 85 percent', species: 'lich', type: OBJECT_NAMES.indexOf('adornment'), before: 35100, after: 35200 },
]) {
    void test(`carried weight stops interest in ${label}`, async () => {
        const { monster, wants } = await interestRoom(species);
        const candidate = await knownObject(type);
        await addObjectToMonsterInventory(monster, await knownObject(GOLD_PIECE, { quantity: before }));
        assert.equal(wants(candidate), true, 'The item should remain attractive below its load threshold');

        await addObjectToMonsterInventory(monster, await knownObject(GOLD_PIECE, { quantity: after - before }));

        assert.equal(wants(candidate), false, 'The item should stop being attractive at its load threshold');
    });
}

void test('the weight of an entire carried corpse stack counts against item interest', async () => {
    const { monster, wants } = await interestRoom('human');
    const medicine = await knownObject(POT_HEALING);
    assert.equal(wants(medicine), true);
    const corpses = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('newt'), quantity: 80 });

    await addObjectToMonsterInventory(monster, corpses);

    assert.equal(wants(medicine), false);
});

void test('carried container contents count against the monster load threshold', async () => {
    const { monster, wants } = await interestRoom('human');
    const sack = await knownObject(SACK);
    await addObjectToContainer(sack, await knownObject(ROCK, { quantity: 80 }));
    sack.owt = objectWeight(sack);
    await addObjectToMonsterInventory(monster, sack);

    assert.equal(wants(await knownObject(POT_HEALING)), false);
});

void test('rock throwers disregard carried boulder weight but leave Sokoban boulders alone', async () => {
    const { monster, state, wants } = await interestRoom('stone giant');
    await addObjectToMonsterInventory(monster, await knownObject(BOULDER, { quantity: 20 }));
    const boulder = await knownObject(BOULDER);
    assert.equal(wants(boulder), true);

    state.level.flags.sokoban_rules = true;

    assert.equal(wants(boulder), false);
});

void test('unicorns distinguish gemstones from glass, minerals, and useful tools', async () => {
    const { wants } = await interestRoom('white unicorn');

    assert.equal(wants(await knownObject(RUBY)), true);
    assert.equal(wants(await knownObject(WORTHLESS_PIECE_OF_RED_GLASS)), false);
    assert.equal(wants(await knownObject(ROCK)), false);
    assert.equal(wants(await knownObject(POT_HEALING)), false);
});

void test('a tame collector avoids cursed objects which its hostile counterpart would want', async () => {
    const { monster, state, wants } = await interestRoom();
    const weapon = await knownObject(DAGGER, { cursed: true });
    assert.equal(wants(weapon), true);

    initializePet(monster, { state });

    assert.equal(wants(weapon), false);
});

void test('interest does not replace artifact touch admission', async () => {
    const { monster, state, wants } = await interestRoom();
    const excalibur = await artifactObject('Excalibur');

    assert.equal(wants(excalibur), true);
    assert.equal(monsterCanCarryObject(monster, excalibur, state), false);
});

void test('a gelatinous cube wants ordinary rocks but avoids boulders, statues, and petrifying corpses', async () => {
    const { monster, wants } = await interestRoom('gelatinous cube');
    monster.mintrinsics = (monster.mintrinsics ?? 0) | 0x80;

    assert.equal(wants(await knownObject(POT_WATER)), true);
    assert.equal(wants(await knownObject(IRON_CHAIN)), true);
    assert.equal(wants(await knownObject(ROCK)), true);
    assert.equal(wants(await knownObject(BOULDER)), false);
    assert.equal(wants(await knownObject(STATUE)), false);
    assert.equal(wants(await knownObject(HEAVY_IRON_BALL)), false);
    assert.equal(wants(await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') })), false);
});

void test('the hero punishment chain is protected even from a gelatinous cube', async () => {
    const { state, wants } = await interestRoom('gelatinous cube');
    await punishHero(await knownObject(HEAVY_IRON_BALL), state);
    assert.ok(state.uchain);
    assert.ok(state.uball);

    assert.equal(wants(state.uchain), false);
    assert.equal(wants(state.uball), false);
});

void test('scary floor protection affects useful-item search only at the monster current square', async () => {
    const { searches } = await interestRoom();
    await floorObject(SCR_SCARE_MONSTER, 11, 10);
    const underfoot = await floorObject(WAN_TELEPORTATION, 11, 10, { spe: 2 });
    const nearby = await floorObject(WAN_TELEPORTATION, 12, 10, { spe: 2 });

    assert.equal(searches(underfoot), false);
    assert.equal(searches(nearby), true);
    assert.equal(searches(await knownObject(WAN_TELEPORTATION, { spe: 2 })), true);
});

for (const species of ['dog', 'stone golem', 'ghost']) {
    void test(`${species} does not search for usable wands or medicine`, async () => {
        const { searches } = await interestRoom(species);

        assert.equal(searches(await knownObject(WAN_FIRE, { spe: 2 })), false);
        assert.equal(searches(await knownObject(POT_HEALING)), false);
    });
}

void test('invisibility and speed interest precedes wand charge checks but respects existing powers', async () => {
    const { monster, searches } = await interestRoom();
    const invisibility = await knownObject(WAN_MAKE_INVISIBLE, { spe: 0 });
    const speed = await knownObject(WAN_SPEED_MONSTER, { spe: 0 });
    assert.equal(searches(invisibility), true);
    assert.equal(searches(speed), true);

    monster.minvis = 1;
    monster.mspeed = MFAST;

    assert.equal(searches(invisibility), false);
    assert.equal(searches(speed), false);
    monster.minvis = 0;
    monster.invis_blkd = 1;
    assert.equal(searches(invisibility), false);
});

void test('a gazing monster rejects blindness and invisibility while still seeking healing', async () => {
    const { searches } = await interestRoom('Medusa');

    assert.equal(searches(await knownObject(POT_BLINDNESS)), false);
    assert.equal(searches(await knownObject(POT_INVISIBILITY)), false);
    assert.equal(searches(await knownObject(POT_HEALING)), true);
});

void test('digging and polymorph wands depend on the prospective user body', async () => {
    const { monster, searches } = await interestRoom();
    const polymorph = await knownObject(WAN_POLYMORPH, { spe: 1 });
    const digging = await knownObject(WAN_DIGGING, { spe: 1 });
    assert.equal(searches(polymorph), true);
    assert.equal(searches(digging), true);

    setMonsterSpecies(monster, MONSTER_NAME.indexOf('mind flayer'));

    assert.equal(searches(polymorph), false);
    assert.equal(searches(digging), true);
    setMonsterSpecies(monster, MONSTER_NAME.indexOf('floating eye'));
    assert.equal(searches(polymorph), true);
    assert.equal(searches(digging), false);
});

void test('vampire shapechangers do not seek life saving, even in a living form', async () => {
    const { monster, searches } = await interestRoom();
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    assert.equal(searches(amulet), true);
    monster.cham = MONSTER_NAME.indexOf('vampire');

    assert.equal(searches(amulet), false);
    assert.equal(searches(await knownObject(AMULET_OF_REFLECTION)), true);
});

void test('horn users need the appropriate anatomy, while charged cameras do not', async () => {
    const { monster, searches } = await interestRoom('wraith');
    const horn = await knownObject(FIRE_HORN, { spe: 1 });
    const camera = await knownObject(EXPENSIVE_CAMERA, { spe: 1 });
    assert.equal(searches(horn), false);
    assert.equal(searches(camera), true);

    setMonsterSpecies(monster, MONSTER_NAME.indexOf('skeleton'));

    assert.equal(speciesCanBlow(monster.mnum), true);
    // A skeleton makes a rattling sound: the silent-body restriction does not apply.
    assert.equal(searches(horn), false, 'Mindless skeletons still do not search for usable items');
});

void test('pick users seek picks and non-unicorns seek usable uncursed horns', async () => {
    const { monster, searches } = await interestRoom('dwarf');
    const pick = await knownObject(PICK_AXE);
    const horn = await knownObject(UNICORN_HORN);
    assert.equal(searches(pick), true);
    assert.equal(searches(horn), true);
    horn.cursed = true;
    assert.equal(searches(horn), false);
    setMonsterSpecies(monster, MONSTER_NAME.indexOf('goblin'));
    assert.equal(searches(pick), false);
});

void test('unlocked bags of tricks are interesting but cursed magical bags and locked containers are not', async () => {
    const { searches } = await interestRoom();
    assert.equal(searches(await knownObject(BAG_OF_TRICKS)), true);
    assert.equal(searches(await knownObject(BAG_OF_TRICKS, { cursed: true })), false);
    assert.equal(searches(await knownObject(BAG_OF_HOLDING, { cursed: true })), false);
    assert.equal(searches(await knownObject(SACK, { cursed: true })), true);
    assert.equal(searches(await knownObject(SACK, { olocked: true })), false);
});

void test('petrifying food and stoning cures have different glove and resistance requirements', async () => {
    const { monster, searches } = await interestRoom();
    const cockatrice = MONSTER_NAME.indexOf('cockatrice');
    const corpse = await knownObject(CORPSE, { corpsenm: cockatrice });
    const lizard = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('lizard') });
    assert.equal(searches(corpse), false);
    assert.equal(searches(lizard), true);
    assert.equal(searches(await knownObject(EGG, { corpsenm: cockatrice })), true);
    await equipMonsterObject(monster, await knownObject(LEATHER_GLOVES), W_ARMG);
    monster.mintrinsics = (monster.mintrinsics ?? 0) | 0x80;

    assert.equal(searches(corpse), true);
    assert.equal(searches(lizard), false);
});

void test('a cursed nonweapon does not stop a monster opening a tin, but a welded weapon does', async () => {
    const { monster, state, searches } = await interestRoom();
    const tin = await knownObject(TIN, { corpsenm: MONSTER_NAME.indexOf('lizard') });
    const opener = await knownObject(TIN_OPENER);
    await addObjectToMonsterInventory(monster, opener);
    const potion = await equipMonsterObject(monster, await knownObject(POT_WATER, { cursed: true }), W_WEP);
    assert.equal(searches(tin), true);
    await removeObjectFromMonsterInventory(monster, potion, state);
    await equipMonsterObject(monster, await knownObject(PICK_AXE, { cursed: true }), W_WEP);

    assert.equal(searches(tin), false);
});

void test('carrying admission weighs the complete incoming corpse stack', async () => {
    const { monster, state } = await interestRoom('human');
    const corpses = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('newt'), quantity: 120 });

    assert.equal(monsterCarryAmount(monster, corpses, state), 0);
    assert.equal(corpses.quan, 120);
    assert.equal(corpses.where, 'free');
});

void test('a partly eaten corpse uses its reduced stored weight for carrying admission', async () => {
    const { monster, state } = await interestRoom('human');
    const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('human'), oeaten: 100 });

    assert.equal(monsterCarryAmount(monster, corpse, state), 1);
});

void test('silver-averse monsters use the shuffled ring material when deciding whether to touch it', async () => {
    const { monster, state } = await interestRoom('werewolf');
    const becameSilver = OBJECT_MATERIAL.findIndex((material, type) =>
        objectClassForType(type) === 4 && material !== 14 && objectMaterial(type, state) === 14);
    const ceasedToBeSilver = OBJECT_MATERIAL.findIndex((material, type) =>
        objectClassForType(type) === 4 && material === 14 && objectMaterial(type, state) !== 14);
    assert.ok(becameSilver >= 0, 'The initialized ring appearances must include a newly silver ring');
    assert.ok(ceasedToBeSilver >= 0, 'The original silver ring type must have a different live material');

    assert.equal(monsterCanTouchObject(monster, await knownObject(becameSilver), state), false);
    assert.equal(monsterCanTouchObject(monster, await knownObject(ceasedToBeSilver), state), true);
});

void test('peaceful untamed rock throwers refuse boulders before the unlimited carrying exception', async () => {
    const { monster, state } = await interestRoom('stone giant');
    const boulder = await knownObject(BOULDER);
    monster.mpeaceful = true;
    assert.equal(monsterCarryAmount(monster, boulder, state), 0);

    initializePet(monster, { state });

    assert.equal(monsterCarryAmount(monster, boulder, state), 1);
});

void test('nymphs carry heavy stolen property and ordinary rocks but refuse boulders and statues', async () => {
    const { monster, state } = await interestRoom('mountain nymph');

    assert.equal(monsterCarryAmount(monster, await knownObject(HEAVY_IRON_BALL), state), 1);
    assert.equal(monsterCarryAmount(monster, await knownObject(ROCK), state), 1);
    assert.equal(monsterCarryAmount(monster, await knownObject(BOULDER), state), 0);
    assert.equal(monsterCarryAmount(monster, await knownObject(STATUE), state), 0);
});

void test('huge coin stacks return a native bounded pickup amount without altering the floor stack', async () => {
    const { monster, state } = await interestRoom('human');
    const ordinary = await floorObject(GOLD_PIECE, 11, 10, { quantity: LARGEST_INT });
    assert.equal(monsterCarryAmount(monster, ordinary, state), LARGEST_INT);
    const huge = await floorObject(GOLD_PIECE, 12, 10, { quantity: 50000 });
    initRng(97n);

    const amount = monsterCarryAmount(monster, huge, state);

    assert.ok(amount >= 20000 && amount <= LARGEST_INT);
    assert.equal(huge.quan, 50000);
    assert.equal(huge.where, 'floor');
});

void test('a dragon carries whole coin and gem stacks but only one ordinary weapon at a time', async () => {
    const { monster, state } = await interestRoom('red dragon');

    assert.equal(monsterCarryAmount(monster, await knownObject(GOLD_PIECE, { quantity: 3 }), state), 3);
    assert.equal(monsterCarryAmount(monster, await knownObject(RUBY, { quantity: 3 }), state), 3);
    assert.equal(monsterCarryAmount(monster, await knownObject(DAGGER, { quantity: 3 }), state), 1);
});

void test('an engulfer can carry a complete weapon stack without hands', async () => {
    const { monster, state } = await interestRoom('purple worm');

    assert.equal(monsterCarryAmount(monster, await knownObject(DAGGER, { quantity: 3 }), state), 3);
});

void test('native one-item mouth pickup is decided before the steed exclusion', async () => {
    const { monster, state } = await interestRoom('pony');
    initializePet(monster, { state });
    state.u.usteed = monster;

    assert.equal(monsterCarryAmount(monster, await knownObject(DAGGER, { quantity: 2 }), state), 1);
    assert.equal(monsterCarryAmount(monster, await knownObject(DAGGER), state), 0);
});
