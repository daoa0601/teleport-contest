import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { FOUNTAIN, HOLE, NO_MINVENT, ROOM, STONE } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { level_difficulty } from '../js/dungeon.js';
import { placeCreatedObject, remove_object } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_YENDOR, FOOD_RATION, LEASH, LEATHER_GLOVES, OIL_LAMP, POT_CONFUSION, SPLINT_MAIL } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer } from '../js/object_timers.js';
import { addInventoryItem } from '../js/u_init.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject, floorObject, knownObject, untimedCorpse } from './support/game-objects.js';
import { installPolymorphedHero, installPunishedHero } from './support/hero-state.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
import { nearCapacity } from '../js/weight.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { answerPrompts } from './support/input-boundaries.js';
import { docrt, flush_screen } from '../js/display.js';
void test('arrival pickup leaves load status for the next turn update', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.flags.pickup_types = '';
    game.level = destination;
    await floorObject(SPLINT_MAIL, 13, 10, { quan: 3 });
    game.level = source;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    resetInputState().display = { async readKey() {
            const line = requireScreenRow(0).map(cell => cell.ch).join('');
            return (line.includes('[yn') ? 'y' : ' ').charCodeAt(0);
        } };
    await gotoLevel({ dlevel: 2 });
    await flush_screen(1);
    assert.ok(game.inventory.some(object => object.otyp === SPLINT_MAIL));
    assert.ok(nearCapacity(game) > 0);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Burdened|Stressed|Strained/);
});
void test('wizard level teleport places the hero before acknowledging the Amulet grant', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    // The Wizard is elsewhere, so arrival has no resurrection pager.
    game.context.no_of_wizards = 1;
    game.dungeons.push(createDungeon({ dname: 'The Elemental Planes', num_dunlevs: 5, depth_start: -5 }));
    game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.specialLevels = new Map([['earth', createSpecialLevel({ dnum: 1, dlevel: 5 })]]);
    const levels = game._levelCache;
    assert.ok(levels);
    const cached = levels.get('0:2');
    assert.ok(cached);
    levels.set('1:5', cached);
    destination.upTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    destination.requireAt(12, 10).typ = FOUNTAIN;
    await docrt();
    await flush_screen(1);
    const input = resetInputState();
    const changing = (async () => {
        await rhack(22);
        await finishScheduledLevelChange();
    })();
    await input.waitUntilBlocked();
    input.feed('?\r');
    await input.waitUntilBlocked();
    assert.ok(game.nhDisplay);
    assert.match(game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n'), /Level teleport to where:/);
    input.feed('a');
    await input.waitUntilBlocked();
    try {
        assert.match(game._pending_message, /Endgame prerequisite: .*the Amulet of Yendor\./);
        assert.equal(game.u.uhave?.amulet, 1);
        assert.ok(game.level === destination, 'destination creation precedes the message acknowledgement');
        assert.equal(game.u.uz.dnum, 1);
        assert.equal(game.u.uz.dlevel, 5);
        assert.equal(requireScreenCell(0, 0).ch, 'E', 'the message window remains visible while the map is paused');
        assert.equal(game.u.ux, 13, 'hero placement also precedes the acknowledgement');
        assert.equal(game.u.uy, 10);
        assert.equal(requireScreenCell(11, 11).ch, '.', 'the old map remains until the prerequisite is acknowledged');
    }
    finally {
        await answerPrompts(changing, input, [
            { prompt: /Endgame prerequisite: .*the Amulet of Yendor\.--More--/, keys: ' ' },
        ]);
    }
    assert.equal(requireScreenCell(11, 11).ch, '{', 'acknowledging the grant reveals the destination map');
    assert.equal(game._pending_message, 'You materialize on a different level!');
});
void test('quest stairs require permission from the leader', async () => {
    const { source } = freshConnectedLevels({ dungeonName: 'The Quest' });
    requirePlayingGame(game);
    game._activeSpecialLevel = { prototype: 'Cav-strt', file: 'Cav-strt.lua' };
    installPagerInput(resetInputState(), {
        expected: /mysterious force prevents you from descending/,
        limit: 1,
    });
    await rhack('>'.charCodeAt(0));
    assert.ok(game.level === source, 'the hero left the quest entrance without permission');
    assert.equal(game.u.uz.dlevel, 1);
    assert.match(game._pending_message, /mysterious force prevents you from descending/);
});
void test('falling down stairs hurts the polymorphed body, not saved human health', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    installPolymorphedHero('stone golem');
    game.u.fumbling = true;
    const humanHealth = game.u.uhp;
    const bodyHealth = game.u.mh;
    installPagerInput(resetInputState(), { expected: /You fall down the stairs/, limit: 2 });
    await rhack('>'.charCodeAt(0));
    assert.ok(game.level === destination, 'the hero did not reach the lower level');
    assert.equal(game.u.uhp, humanHealth);
    assert.ok(game.u.mh < bodyHealth);
});
void test('stair arrivals deliver the destination level message', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const cached = game._levelCache?.get('0:2');
    assert.ok(cached);
    cached.activeSpecialLevel = {
        prototype: 'oracle', file: 'oracle.lua',
        specialMessages: ['A cold wind blows from below.'],
    };
    installPagerInput(resetInputState(), {
        expected: /You descend the stairs|A cold wind blows from below/,
        limit: 2,
    });
    await rhack('>'.charCodeAt(0));
    assert.match(game._last_message, /cold wind blows/);
});
void test('returning upstairs restores the original level and the linked stair', async () => {
    const { source } = freshConnectedLevels({ ladder: true });
    requirePlayingGame(game);
    const departure = game.stairs;
    assert.ok(departure);
    installPagerInput(resetInputState(), { expected: /You climb (?:down|up) the ladder/, limit: 2 });
    await rhack('>'.charCodeAt(0));
    assert.match(game._last_message, /climb down the ladder/);
    await rhack('<'.charCodeAt(0));
    assert.ok(game.level === source, 'returning upstairs rebuilt the original level');
    assert.equal(game.u.ux, departure.sx);
    assert.equal(game.u.uy, departure.sy);
    assert.equal(departure.u_traversed, true);
});
void test('a carried punishment ball is dropped on the destination after a stair tumble', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const { ball, chain } = await installPunishedHero();
    remove_object(ball);
    await addInventoryItem(ball);
    installPagerInput(resetInputState(), {
        expected: /You fall down the stairs|iron ball|You lose your grip|There is a staircase up to level 1 here/,
        limit: 4,
    });
    await rhack('>'.charCodeAt(0));
    assert.equal(game.inventory.includes(ball), false);
    const pile = floorObjectsAt(game.level, game.u.ux, game.u.uy);
    assert.ok(pile.includes(ball));
    assert.ok(pile.includes(chain));
    assert.equal(game.uball, ball);
});
void test('Amulet difficulty remembers the deepest visit after returning upstairs and restoring', async () => {
    freshConnectedLevels({ destinationDepth: 4 });
    requirePlayingGame(game);
    game.plname = 'Climber';
    const storage = memoryStorage();
    installPagerInput(resetInputState(), {
        expected: /You descend the stairs|You climb up the stairs/,
        limit: 2,
    });
    await gotoLevel({ dnum: 0, dlevel: 4 }, { arrival: 'stairs' });
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Climber', storage), true);
    await addInventoryObject(AMULET_OF_YENDOR);
    assert.equal(level_difficulty(), 4);
});
void test('falling can force contact with a wielded cockatrice corpse through gloves', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    game.u.fumbling = true;
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const corpse = await addInventoryItem(await untimedCorpse(MONSTER_NAME.indexOf('cockatrice')));
    await setPrimaryWeapon(corpse);
    installPagerInput(resetInputState(), {
        expected: /You fall down the stairs|cockatrice corpse|turn to stone|But wait|medallion|feel much better/,
        limit: 8,
    });
    await rhack('>'.charCodeAt(0));
    assert.equal(game.inventory.includes(amulet), false, 'the tumble did not trigger life saving');
    assert.ok(game.u.uhp > 0);
    assert.equal(game.uwep, corpse);
});
void test('returning to a level burns out expired lamps and removes decayed corpses before the next command', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /You descend the stairs|You climb up the stairs|lamp/,
        limit: 4,
    });
    await rhack('>'.charCodeAt(0));
    const lamp = await floorObject(OIL_LAMP, 14, 10, { age: 10 });
    beginObjectBurn(lamp);
    const corpse = placeCreatedObject(await untimedCorpse(MONSTER_NAME.indexOf('lichen')), 15, 10);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves + 5);
    await rhack('<'.charCodeAt(0));
    game.moves += 20;
    await rhack('>'.charCodeAt(0));
    assert.equal(lamp.lamplit, false, 'the lamp still burns after its fuel ran out');
    assert.equal(corpse.where, 'gone');
    assert.equal(floorObjectsAt(game.level, 15, 10).includes(corpse), false);
});
void test('arriving downstairs picks up objects when autopickup is enabled', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.pickup = true;
    const ration = placeCreatedObject(await knownObject(FOOD_RATION), 12, 10, {
        ...game, level: destination,
    });
    installPagerInput(resetInputState(), { expected: /You descend the stairs|food ration/, limit: 2 });
    await rhack('>'.charCodeAt(0));
    assert.equal(game.inventory.includes(ration), true);
    assert.equal(floorObjectsAt(destination, 12, 10).includes(ration), false);
});
void test('a sleeping hero does not pick up objects on level arrival', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.pickup = true;
    await putHeroToSleep(3);
    const ration = placeCreatedObject(await knownObject(FOOD_RATION), 12, 10, {
        ...game, level: destination,
    });
    installPagerInput(resetInputState(), { expected: /You descend the stairs|food ration/, limit: 2 });
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    assert.equal(game.inventory.includes(ration), false);
    assert.equal(floorObjectsAt(destination, 12, 10).includes(ration), true);
});
void test('falling through a shaft hurts the hero for each level fallen', async () => {
    const { source, destination } = freshConnectedLevels({ destinationDepth: 4 });
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 4 }, tseen: true });
    installPagerInput(resetInputState(), { expected: /fall through|plunge down|hole|shaft/, limit: 2 });
    await rhack('l'.charCodeAt(0));
    await finishScheduledLevelChange();
    assert.ok(game.level === destination, 'the fall did not reach the shaft destination');
    const damage = 100 - game.u.uhp;
    assert.ok(damage >= 3 && damage <= 18, `a three-level fall dealt ${damage} damage`);
});
void test('a potion falling with the hero breaks unseen before the remembered-level note', async () => {
    const { source } = freshConnectedLevels({ destinationDepth: 4 });
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 4 }, tseen: true });
    await floorObject(POT_CONFUSION, 11, 10);
    game._levelAnnotations = new Map([['0:4', 'the potion drop']]);
    const pages = [];
    resetInputState().display = {
        async readKey() {
            pages.push(game._pending_message ?? '');
            return ' '.charCodeAt(0);
        },
    };
    await rhack('l'.charCodeAt(0));
    await finishScheduledLevelChange();
    // goto_level's obj_delivery(FALSE) lands hero-traveling objects before
    // the new level is in view and before its remembered note.
    const transcript = [...pages, game._last_message ?? ''].join('\n');
    assert.match(transcript, /You hear something shatter![\s\S]*somewhat dizzy[\s\S]*You remember this level as the potion drop/);
});
void test('a flying hero can deliberately descend through a known hole without fall damage', async () => {
    const { source, destination } = freshConnectedLevels({ destinationDepth: 4 });
    requirePlayingGame(game);
    game.stairs = null;
    source.requireAt(10, 10).typ = ROOM;
    installPolymorphedHero('vampire bat');
    const health = game.u.mh;
    addTrap(source, HOLE, 10, 10, { dst: { dnum: 0, dlevel: 4 }, tseen: true });
    installPagerInput(resetInputState(), { expected: /fly down|hole|shaft/, limit: 2 });
    await rhack('>'.charCodeAt(0));
    await finishScheduledLevelChange();
    assert.ok(game.level === destination, 'the flying hero could not descend through the hole');
    assert.equal(game.u.mh, health);
});
void test('a cursed leash holds the hero back when the pet cannot get beside the stairs', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    const pet = await createMonsterAt('housecat', 14, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    const leash = await addInventoryObject(LEASH, { cursed: true, leashmon: pet.m_id });
    pet.mleashed = 1;
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10)
                source.requireAt(x, y).typ = STONE;
        }
    }
    installPagerInput(resetInputState(), { expected: /held back by your pet/, limit: 1 });
    await rhack('>'.charCodeAt(0));
    assert.ok(game.level === source, 'the hero left a pet held by a cursed leash');
    assert.equal(leash.leashmon, pet.m_id);
    assert.equal(pet.mleashed, 1);
    assert.match(game._pending_message, /held back by your pet/);
});
void test('a Tourist earns a threshold level on first arrival but not on a return visit', async () => {
    const { source } = freshConnectedLevels({ role: 'tourist', generateDestination: true });
    requirePlayingGame(game);
    game.u.uexp = 19;
    game.u.urexp = 1996;
    game.flags.beginner = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /Welcome to experience level 2/, limit: 2 });
    await gotoLevel({ dnum: 0, dlevel: 2 });
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.u.uexp, 21);
    assert.equal(game.u.urexp, 2004);
    assert.equal(game.flags.beginner, false);
    const destination = game.level;
    await gotoLevel({ dnum: 0, dlevel: 1 });
    assert.equal(game.level, source);
    await gotoLevel({ dnum: 0, dlevel: 2 });
    assert.equal(game.level, destination);
    assert.equal(game.u.uexp, 21);
    assert.equal(game.u.urexp, 2004);
});
void test('a snake slithers up the stairs when returning to a cached level', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), { expected: /You descend the stairs|You slither up the stairs/, limit: 2 });
    await rhack('>'.charCodeAt(0));
    installPolymorphedHero('garter snake');
    await rhack('<'.charCodeAt(0));
    assert.match(game._last_message, /You slither up the stairs\./);
});
//# sourceMappingURL=level_change.test.js.map