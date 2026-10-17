import assert from 'node:assert/strict';
import test from 'node:test';

import { applyMonsterAntiMagicTrap, finishMonsterAntiMagicTrap } from '../js/anti_magic_trap.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { beginMonsterBearTrap, finishMonsterBearTrap } from '../js/bear_trap.js';
import { heroBlindingObjectHitMessage } from '../js/blinding_attack.js';
import { finishGhostlyPickup } from '../js/bones_object.js';
import { triggerChestTrap } from '../js/chest_trap.js';
import {
    ANTI_MAGIC,
    ARROW_TRAP,
    BEAR_TRAP,
    DBWALL,
    DB_MOAT,
    DB_NORTH,
    DRAWBRIDGE_UP,
    PIT,
    ROCKTRAP,
    SLP_GAS_TRAP,
    VIBRATING_SQUARE,
    WEB,
} from '../js/const.js';
import { useContainer } from '../js/container.js';
import { reviveCorpseImmediately } from '../js/corpse_revival.js';
import { openDrawbridge } from '../js/dbridge.js';
import { fireDamageObject } from '../js/fire_damage.js';
import { announceGlobMerge } from '../js/glob.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { restartAmuletStrangulation } from '../js/hero_strangulation.js';
import { pushKeys } from '../js/input.js';
import { liftObject } from '../js/lift_object.js';
import { lightRoom, lightWieldedArtifact } from '../js/light.js';
import { probeObject } from '../js/magic_probe.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { tryKickReel } from '../js/monster_kick.js';
import { beginMonsterPitTrap, finishMonsterPitTrap } from '../js/monster_pit_trap.js';
import { tryMonsterTrapEscape } from '../js/monster_trap_escape.js';
import { breakFloorObject } from '../js/object_breakage.js';
import {
    AMULET_OF_STRANGULATION,
    BLINDING_VENOM,
    BOULDER,
    BOW,
    CHEST,
    CORPSE,
    DAGGER,
    GLOB_OF_GRAY_OOZE,
    GOLD_DRAGON_SCALE_MAIL,
    OBJECT_NAMES,
    POT_HEALING,
    SPE_FORCE_BOLT,
    STATUE,
} from '../js/object_data.js';
import { dropObjectAtHero } from '../js/object_drop.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { beginMonsterProjectileTrap, finishMonsterProjectileTrap } from '../js/projectile_trap.js';
import { initRng } from '../js/rng.js';
import { beginMonsterRockTrap, finishMonsterRockTrap } from '../js/rock_trap.js';
import { chargeAlteredUnpaidObject } from '../js/shk.js';
import { beginMonsterSleepGasTrap, finishMonsterSleepGasTrap } from '../js/sleep_gas_trap.js';
import { bookCursed, studyBook } from '../js/spellbook_study.js';
import { applyThrowSlip } from '../js/throw_state.js';
import { flyHeroThrownObject } from '../js/thrown_object.js';
import { turnObjectWithUndeadMagic } from '../js/undead_turning.js';
import { untrap } from '../js/untrap.js';
import { beginMonsterVibratingSquare, finishMonsterVibratingSquare } from '../js/vibrating_square_trap.js';
import { addInventoryObject, artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('fire damage describes an unidentified potion by its appearance and personal name', async () => {
    freshObjectRoom();
    const potion = await floorObject(POT_HEALING, 11, 10, {
        typeKnown: false, oextra: { oname: 'Emergency' },
    });
    (game.objectDescriptions ??= [])[POT_HEALING] = 'pink';
    const messages: string[] = [];

    await fireDamageObject(potion, {
        force: true, x: 11, y: 10, publish: text => { messages.push(text); },
    });

    assert.equal(messages[0], 'The pink potion named Emergency boils and explodes.');
});

void test('cracking crystal armor retains its personal name', async () => {
    freshObjectRoom();
    const armor = await floorObject(OBJECT_NAMES.indexOf('crystal plate mail'), 11, 10, { oextra: { oname: 'Prism' } });
    const messages: string[] = [];

    await breakFloorObject(armor, { random: () => 99, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'The crystal plate mail named Prism cracks!');
});

void test('a swallowed corpse stack is described without its species when digested', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    game.u.uswallow = true;
    game.u.ustuck = worm;
    const corpses = await addInventoryObject(CORPSE, {
        corpsenm: MONSTER_NAME.indexOf('newt'), quan: 2,
    });
    const messages: string[] = [];

    await dropObjectAtHero(corpses, { publish: text => { messages.push(text); } });

    assert.ok(messages.includes('The corpses are instantly digested!'), messages.join('\n'));
});

void test('a strangling amulet uses its simple type name without a personal name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_STRANGULATION, {
        typeKnown: true, oextra: { oname: 'Choker' },
    });
    game.uamul = game.u.uamul = amulet;
    const messages: string[] = [];

    await restartAmuletStrangulation(game, text => { messages.push(text); });

    assert.equal(messages[0], 'Your amulet of strangulation begins constricting your neck!');
});

void test('a chest gas trap retains the chest personal name', async () => {
    freshObjectRoom({ hero: { uluck: -13, poisonResistance: true } });
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true, oextra: { oname: 'Cache' } });
    const messages: string[] = [];

    await triggerChestTrap(chest, {
        random: range => range === 26 ? 17 : 0,
        publish: text => { messages.push(text); },
    });

    assert.ok(messages.includes('A cloud of noxious gas billows from the chest named Cache.'), messages.join('\n'));
});

void test('checking a chest for traps retains its personal name', async () => {
    freshObjectRoom();
    const chest = await floorObject(CHEST, 10, 10, { otrapped: false, oextra: { oname: 'Cache' } });
    const messages: string[] = [];

    await untrap({ container: chest, random: () => 1, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'You find no traps on the chest named Cache.');
});

void test('a named ghost keeps its possessive name when a rock trap runs dry', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(ROCKTRAP, {
        monster: { species: 'ghost' }, trap: { once: true, tseen: true },
    });
    setMonsterGivenName(monster, 'James');
    const event = await beginMonsterRockTrap(monster, trap, game, { random: () => 0 });
    const messages: string[] = [];

    await finishMonsterRockTrap(monster, event, game, { publish: text => { messages.push(text); } });

    assert.equal(messages[0], "A trap door above James' ghost opens, but nothing falls out!");
});

void test('a named ghost keeps its possessive name when a projectile trap runs dry', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(ARROW_TRAP, {
        monster: { species: 'ghost' }, trap: { once: true, tseen: true },
    });
    setMonsterGivenName(monster, 'James');
    const event = await beginMonsterProjectileTrap(monster, trap, game, { random: () => 0 });
    const messages: string[] = [];

    await finishMonsterProjectileTrap(monster, event, game, { publish: text => { messages.push(text); } });

    assert.equal(messages[0], "James' ghost triggers a trap but nothing happens.");
});

void test('a named monster disguise is retained in a pit message', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(PIT, { monster: { species: 'kitten' } });
    setMonsterGivenName(monster, 'Mittens');
    const event = beginMonsterPitTrap(monster, trap);
    const messages: string[] = [];

    await finishMonsterPitTrap(monster, event, { rollOne: () => 1, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'Mittens falls into a pit!');
});

void test('a named ghost keeps its possessive name while escaping a bear trap', async () => {
    const { monster } = await freshMonsterTrapRoom(BEAR_TRAP, { monster: { species: 'ghost' } });
    setMonsterGivenName(monster, 'James');
    monster.mtrapped = 1;
    const messages: string[] = [];

    await tryMonsterTrapEscape(monster, game, { random: () => 0, publish: text => { messages.push(text); } });

    assert.equal(messages[0], "James' ghost pulls free of the bear trap.");
});

void test('an invisible but seen sleeper keeps its invisibility adjective', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(SLP_GAS_TRAP, {
        monster: { species: 'kitten' },
    });
    requirePlayingGame(game);
    game.u.seeInvisible = true;
    monster.minvis = true;
    const event = beginMonsterSleepGasTrap(monster, trap, game, { rollOne: () => 5 });
    const messages: string[] = [];

    await finishMonsterSleepGasTrap(monster, event, { publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'The invisible kitten suddenly falls asleep!');
});

void test('putting on luminous armor retains the suit personal name', async () => {
    freshObjectRoom();
    const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { oextra: { oname: 'Dawn' } });
    wearHeroArmor(armor);

    const messages = await applyArmorOnEffects(armor);

    assert.ok(messages.some(text => text.startsWith('Your gold dragon scale mail named Dawn begins to shine ')), messages.join('\n'));
});

void test('a luminous artifact whose identity is not fully known keeps its base item name', async () => {
    freshObjectRoom();
    const sword = await artifactObject('Sunsword');
    const messages: string[] = [];

    await lightWieldedArtifact(sword, game, text => { messages.push(text); });

    assert.ok(messages[0]?.startsWith('The long sword named Sunsword begins to shine '), messages.join('\n'));
});

void test('lighting an engulfing monster uses its personal name and possessive', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    setMonsterGivenName(worm, 'James');
    game.u.uswallow = true;
    game.u.ustuck = worm;

    await lightRoom(true);

    assert.equal(game._pending_message, "James' stomach is lit.");
});

void test('a ghostly bow keeps its personal name when adjusted for the hero', async () => {
    freshObjectRoom();
    const bow = await knownObject(BOW, { ghostly: true, oextra: { oname: 'Heirloom' } });

    const message = finishGhostlyPickup(bow, game);

    assert.equal(message, 'You make adjustments to the bow named Heirloom to suit your right hand.');
});

void test('a locked container keeps its personal name when opened', async () => {
    freshObjectRoom();
    const chest = await floorObject(CHEST, 10, 10, { olocked: true, oextra: { oname: 'Cache' } });

    await useContainer(chest);

    assert.equal(game._pending_message, 'The chest named Cache is locked.');
});

void test('Sokoban pickup refusal retains a boulder personal name', async () => {
    const level = freshObjectRoom();
    level.flags.sokoban_rules = true;
    const boulder = await floorObject(BOULDER, 10, 10, { oextra: { oname: 'Atlas' } });

    await liftObject({ object: boulder });

    assert.equal(game._pending_message, 'You cannot get your hand around this boulder named Atlas.');
});

void test('a potion called by the hero evaporates without its appearance adjective', async () => {
    freshObjectRoom();
    const target = await createMonsterAt('kitten', 11, 10);
    const potion = await knownObject(POT_HEALING, { typeKnown: false });
    (game._objectCallNames ??= {})[POT_HEALING] = 'Rescue';
    const messages: string[] = [];

    await hitMonsterWithSupportedPotion({ monster: target, potion, targetVisible: true,
        publish: text => { messages.push(text); } });

    assert.ok(messages.includes('The potion called Rescue evaporates.'), messages.join('\n'));
});

void test('blinding venom describes a named ghost with its possessive species name', async () => {
    freshObjectRoom();
    const ghost = await createMonsterAt('ghost', 11, 10);
    setMonsterGivenName(ghost, 'James');
    const venom = await knownObject(BLINDING_VENOM);

    const message = heroBlindingObjectHitMessage(ghost, venom, { canBlind: true });

    assert.equal(message, "The venom blinds James' ghost!");
});

void test('a hurled named ghost keeps its possessive name when bumping into the hero', async () => {
    freshObjectRoom();
    const ghost = await createMonsterAt('ghost', 11, 10);
    setMonsterGivenName(ghost, 'James');
    const messages: string[] = [];

    await hurtleMonster(ghost, -1, 0, 1, { announce: text => { messages.push(text); } });

    assert.ok(messages.includes("James' ghost bumps into you."), messages.join('\n'));
});

void test('a slipping stack of named daggers is described and conjugated as a stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.dx = 1;
    const daggers = await knownObject(DAGGER, { greased: true, quan: 2, oextra: { oname: 'Fliers' } });
    const messages: string[] = [];
    initRng(7n);

    await applyThrowSlip({ object: daggers, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'The daggers named Fliers slip as you throw it!');
});

void test('a web snags a named thrown dagger', async () => {
    const level = freshObjectRoom();
    addTrap(level, WEB, 11, 10);
    const dagger = await knownObject(DAGGER, { oextra: { oname: 'Webcatcher' } });
    const messages: string[] = [];

    await flyHeroThrownObject({ object: dagger, dx: 1, dy: 0, range: 1,
        random: () => 0, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'The dagger named Webcatcher gets stuck in a web!');
});

void test('a drawbridge passes through a named ghost without losing its species name', async () => {
    const level = freshObjectRoom();
    const bridge = level.requireAt(12, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    level.requireAt(12, 9).typ = DBWALL;
    const ghost = await createMonsterAt('ghost', 12, 10);
    setMonsterGivenName(ghost, 'James');

    pushKeys(' '.repeat(10));
    await openDrawbridge(12, 10);

    assert.match(game._pending_message, /drawbridge passes through James' ghost!/);
});

void test('glob merging retains a user-assigned type name', async () => {
    freshObjectRoom();
    const first = await floorObject(GLOB_OF_GRAY_OOZE, 11, 10);
    const second = await floorObject(GLOB_OF_GRAY_OOZE, 12, 10);
    (game._objectCallNames ??= {})[GLOB_OF_GRAY_OOZE] = 'Goo';
    const messages: string[] = [];

    await announceGlobMerge(first, second, game, text => { messages.push(text); });

    assert.equal(messages[0], 'The adjacent globs of gray ooze called Goo coalesce.');
});

void test('alteration billing describes an unidentified potion by its simple name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper, roomno } = await createStaffedShop();
    game.u.ushops = [roomno];
    const potion = await addInventoryObject(POT_HEALING, { typeKnown: false, unpaid: true });
    (game.objectDescriptions ??= [])[POT_HEALING] = 'pink';
    shopkeeper.eshk.bill = [{ bo_id: potion.o_id, bquan: 1, useup: false, price: 50 }];
    shopkeeper.eshk.billct = 1;

    await chargeAlteredUnpaidObject(potion, 'dilute');

    assert.match(game._pending_message, /that pink potion, you pay for it!/);
});

void test('an unseen chest appearance is learned after choosing the trap-discovery wording', async () => {
    freshObjectRoom();
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true, tknown: true, dknown: false });
    const messages: string[] = [];

    await untrap({ container: chest, ask: async () => 'n', publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'You find a trap on the chest!');
    assert.equal(chest.dknown, true);
});

void test('anti-magic feedback retains the invisibility of a seen dragon', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(ANTI_MAGIC, {
        room: { hero: { seeInvisible: true } }, monster: { species: 'red dragon', minvis: true },
    });
    const event = applyMonsterAntiMagicTrap(monster, { trap, rollDice: () => 2 });
    const messages: string[] = [];

    await finishMonsterAntiMagicTrap(monster, event, game, { publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'The invisible red dragon seems lethargic.');
});

void test('a bear trap retains the invisibility of a seen troll', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(BEAR_TRAP, {
        room: { hero: { seeInvisible: true } }, monster: { species: 'troll', minvis: true, hitPoints: 30 },
    });
    const event = beginMonsterBearTrap(monster, trap);
    const messages: string[] = [];

    await finishMonsterBearTrap(monster, event, game, { rollDice: () => 2, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'The invisible troll is caught in a bear trap!');
});

void test('vibrations beneath a named ghost retain the ghost species name', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(VIBRATING_SQUARE, { monster: { species: 'ghost' } });
    setMonsterGivenName(monster, 'James');
    const event = beginMonsterVibratingSquare(monster, trap);
    const messages: string[] = [];

    await finishMonsterVibratingSquare(monster, event, { publish: text => { messages.push(text); } });

    assert.equal(messages[0], "You see a strange vibration beneath James' ghost.");
});

void test('a named ghost carrying a reviving corpse retains its species name', async () => {
    freshObjectRoom();
    const ghost = await createMonsterAt('ghost', 11, 10);
    setMonsterGivenName(ghost, 'James');
    const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('troll') });
    await addObjectToMonsterInventory(ghost, corpse);

    const revival = await reviveCorpseImmediately(corpse);

    assert.ok(revival?.messages.includes("Startled, James' ghost drops a troll corpse as it revives!"), revival?.messages.join('\n'));
});

void test('a named ghost reeling from a kick retains its species name', async () => {
    freshObjectRoom();
    const ghost = await createMonsterAt('ghost', 11, 10);
    setMonsterGivenName(ghost, 'James');
    const messages: string[] = [];
    initRng(1n);

    await tryKickReel(ghost, 1, 0, { martial: true, announce: text => { messages.push(text); } });

    assert.ok(messages.includes("James' ghost reels from the blow."), messages.join('\n'));
});

void test('probing a stack of statues names and conjugates the whole stack', async () => {
    freshObjectRoom();
    const statues = await floorObject(STATUE, 11, 10, {
        quan: 2, corpsenm: MONSTER_NAME.indexOf('newt'),
    });

    await probeObject(statues);

    assert.equal(game._pending_message, 'The statues of a newt are empty.');
});

void test('a stack of spellbooks slams shut with its plural name when cursed', async () => {
    freshObjectRoom();
    const books = await addInventoryObject(SPE_FORCE_BOLT, { blessed: true, quan: 2 });
    await studyBook(books);
    books.blessed = false;
    books.cursed = true;
    pushKeys(' '.repeat(5));

    await bookCursed(books);

    assert.match(game._pending_message, /The spellbooks of force bolt slam shut!/);
});

void test('undead turning resurrects Medusa without an article before her personal species name', async () => {
    freshObjectRoom();
    const corpse = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('Medusa') });
    pushKeys(' '.repeat(10));

    await turnObjectWithUndeadMagic(corpse);

    assert.match(game._pending_message, /(?:^|  )Medusa is resurrected!/);
});
