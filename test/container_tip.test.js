import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { LAVAPOOL } from '../js/const.js';
import { BAG_OF_HOLDING, CAN_OF_GREASE, CHEST, CLUB, HORN_OF_PLENTY, ROCK, SACK, WAN_CANCELLATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { floorObjectsAt } from './support/level-state.js';
void test('tipping the discovered Eyes of the Overworld uses a plural drop verb', async () => {
    const level = freshPlayableRoom();
    level.requireAt(10, 10).typ = LAVAPOOL;
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    const eyes = await artifactObject('The Eyes of the Overworld', {
        where: 'contained', container: sack,
    });
    assert.ok(eyes.oartifact);
    game._artifactDiscoveries = [eyes.oartifact];
    sack.contents = [club, eyes];
    await runExtendedCommand('tip', 'a\n' + ' '.repeat(10));
    assert.equal(club.where, 'gone');
    assert.equal(floorObjectsAt(level, 10, 10).includes(eyes), true);
    assert.match(game._pending_message, /Eyes of the Overworld drop to the lava\./);
});
void test('tipping switches to full drop messages after an item burns in lava', async () => {
    const level = freshPlayableRoom();
    level.requireAt(10, 10).typ = LAVAPOOL;
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    const rock = await knownObject(ROCK, { where: 'contained', container: sack });
    sack.contents = [club, rock];
    await runExtendedCommand('tip', 'a\n' + ' '.repeat(10));
    assert.equal(club.where, 'gone');
    assert.equal(floorObjectsAt(level, 10, 10).includes(rock), true);
    assert.match(game._pending_message, /rock drops to the lava\./);
});
void test('tip empties a floor chest onto the floor without picking up its contents', async () => {
    const level = freshPlayableRoom();
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: false,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    await runExtendedCommand('tip', 'y\n    ');
    assert.equal(chest.contents.length, 0);
    assert.equal(chest.cknown, true);
    assert.equal(floorObjectsAt(level, 10, 10).includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(club.how_lost, 2);
    assert.equal(game.context.move, 1);
});
void test('cancelling the tipping destination leaves contents alone but spends the command turn', async () => {
    freshPlayableRoom();
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    sack.contents = [club];
    await runExtendedCommand('tip', 'a\x1b');
    assert.equal(sack.contents.includes(club), true);
    assert.equal(club.where, 'contained');
    assert.equal(game.context.move, 1);
});
void test('declining the floor chest offers the carried sack instead', async () => {
    const level = freshPlayableRoom();
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false });
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    sack.contents = [club];
    await runExtendedCommand('tip', 'na\n    ');
    assert.equal(!!chest.cknown, false);
    assert.equal(sack.contents.length, 0);
    assert.equal(floorObjectsAt(level, 10, 10).includes(club), true);
});
void test('tip chooses one of several floor containers', async () => {
    const level = freshPlayableRoom();
    const first = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false });
    const second = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false });
    const club = await knownObject(CLUB, { where: 'contained', container: first });
    first.contents = [club];
    await runExtendedCommand('tip', 'b\n    ');
    assert.equal(first.contents.length, 0);
    assert.equal(!!second.cknown, false);
    assert.equal(floorObjectsAt(level, 10, 10).includes(club), true);
});
void test('tip discovers a locked source after choosing the destination', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: true, lknown: false,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    await runExtendedCommand('tip', 'a\n');
    assert.equal(chest.lknown, true);
    assert.equal(chest.contents.includes(club), true);
    assert.match(game._pending_message, /chest is locked\./);
    assert.equal(game.context.move, 1);
});
void test('tip triggers a trapped source before spilling its contents', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, otrapped: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    initRng(1n);
    await runExtendedCommand('tip', 'a\n    ');
    assert.equal(chest.otrapped, false);
    assert.equal(chest.contents.includes(club), true);
    assert.equal(game._helplessReason, 'tipping a container');
    assert.equal(game.context.move, 1);
});
void test('tipping a cancellation wand into a bag destroys the target and stops the spill', async () => {
    freshPlayableRoom();
    game.u.uhp = game.u.uhpmax = 100;
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const bag = await addInventoryObject(BAG_OF_HOLDING, { invlet: 'b', initialize: false });
    const wand = await knownObject(WAN_CANCELLATION, { where: 'contained', container: sack, spe: 1 });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    sack.contents = [wand, club];
    await runExtendedCommand('tip', 'ab' + ' '.repeat(10));
    assert.equal(bag.where, 'gone');
    assert.equal(wand.where, 'gone');
    assert.equal(sack.contents.includes(club), true);
    assert.ok(game.u.uhp < 100);
});
void test('tip can transfer a carried sack into another carried container', async () => {
    freshPlayableRoom();
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const target = await addInventoryObject(BAG_OF_HOLDING, { invlet: 'b', initialize: false });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    sack.contents = [club];
    await runExtendedCommand('tip', 'ab    ');
    assert.equal(sack.contents.length, 0);
    assert.equal(target.contents?.includes(club), true);
    assert.equal(club.container, target);
    assert.equal(game.context.move, 1);
});
void test('tip drains every charge of a horn onto the floor', async () => {
    const level = freshPlayableRoom();
    const horn = await addInventoryObject(HORN_OF_PLENTY, { invlet: 'a', spe: 3, blessed: true });
    await runExtendedCommand('tip', 'a\n' + ' '.repeat(20));
    assert.equal(horn.spe, 0);
    assert.equal(horn.cknown, true);
    const food = floorObjectsAt(level, 10, 10);
    assert.equal(food.reduce((sum, object) => sum + object.quan, 0), 3);
    assert.ok(food.every(object => object.blessed && [7, 8].includes(object.oclass)));
    assert.equal(game.inventory.length, 1);
    assert.equal(game.context.move, 1);
});
void test('tip consumes one grease charge even though the spill is useless', async () => {
    freshPlayableRoom();
    const grease = await addInventoryObject(CAN_OF_GREASE, { invlet: 'a', spe: 3 });
    await runExtendedCommand('tip', 'a');
    assert.equal(grease.spe, 2);
    assert.equal(game._pending_message, 'Some grease spills onto the floor.');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=container_tip.test.js.map