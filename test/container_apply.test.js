import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { W_AMUL } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { takeFromContainer } from '../js/container.js';
import { addInventoryItem } from '../js/u_init.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_YENDOR, BAG_OF_HOLDING, CHEST, CLUB, CORPSE, DART, ICE_BOX, LEATHER_GLOVES, LOADSTONE, } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, artifactObject, floorObject, knownObject, unopenedCatBox, } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
async function unlockedContainer(otyp, invlet, overrides = {}) {
    const container = await addInventoryObject(otyp, {
        invlet,
        initialize: false,
        olocked: false,
        otrapped: false,
        ...overrides,
    });
    container.contents ??= [];
    return container;
}
test.beforeEach(() => freshPlayableRoom({ seed: 48201n }));
void test('applying a carried chest can put an ordinary item inside', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: false });
    const club = await addInventoryObject(CLUB, { invlet: 'b' });
    await applyInventoryObject('a', 'ib\n');
    assert.deepEqual(game.inventory, [chest]);
    assert.deepEqual(chest.contents, [club]);
    assert.equal(club.where, 'contained');
    assert.equal(club.container, chest);
    assert.equal(chest.cknown, true);
    assert.equal(game.context.move, 1);
});
void test('applying a carried chest can take its item back out', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', {
        cknown: true,
        pickup_prev: true,
    });
    const club = await knownObject(CLUB, {
        invlet: 'b',
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    await applyInventoryObject('a', 'oa\n');
    assert.equal(chest.contents?.length ?? 0, 0);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(club.where, 'inventory');
    assert.equal(club.container, null);
    assert.equal(chest.pickup_prev, false);
    assert.equal(club.pickup_prev, true);
    assert.equal(game.context.move, 1);
});
void test('a container menu can move part of a carried stack', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const darts = await addInventoryObject(DART, {
        invlet: 'b',
        quantity: 5,
    });
    await applyInventoryObject('a', 'i2b\n');
    assert.equal(darts.quan, 3);
    assert.equal(game.inventory.includes(darts), true);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.equal(chest.contents.length, 1);
    assert.ok(chest.contents[0]);
    assert.equal(chest.contents[0].quan, 2);
    assert.ok(chest.contents[0]);
    assert.equal(chest.contents[0].where, 'contained');
});
void test('a container menu can take part of a contained stack', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const darts = await knownObject(DART, {
        invlet: 'b',
        where: 'contained',
        container: chest,
        quantity: 5,
    });
    chest.contents = [darts];
    await applyInventoryObject('a', 'o2a\n');
    assert.equal(darts.quan, 3);
    assert.deepEqual(chest.contents, [darts]);
    const carried = game.inventory.find((object) => object.otyp === DART);
    assert.ok(carried);
    assert.equal(carried.quan, 2);
    assert.equal(carried.where, 'inventory');
});
void test('a rejected partial transfer restores the carried stack', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const loadstones = await addInventoryObject(LOADSTONE, {
        invlet: 'b',
        cursed: true,
        quantity: 5,
    });
    await applyInventoryObject('a', 'i2b\n');
    assert.equal(loadstones.quan, 5);
    assert.deepEqual(game.inventory, [chest, loadstones]);
    assert.equal(chest.contents?.length ?? 0, 0);
});
void test('moving some gold keeps the purse and container amounts separate', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const gold = setHeroGoldAmount(game, 5);
    assert.ok(gold);
    await applyInventoryObject('a', 'i2$\n');
    assert.equal(gold.quan, 3);
    assert.equal(heroGoldAmount(game), 3);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(chest.contents[0]);
    assert.equal(chest.contents[0].quan, 2);
    assert.ok(chest.contents[0]);
    assert.equal(chest.contents[0].where, 'contained');
});
void test('touching one cockatrice corpse restores its stack and stops transfer', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const corpse = await addInventoryObject(CORPSE, {
        invlet: 'b',
        corpsenm: 10,
        quantity: 2,
    });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'c',
        worn: true,
        owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    await applyInventoryObject('a', `ic\n1b\n${' '.repeat(10)}`);
    assert.equal(game.inventory.includes(corpse), true);
    assert.equal(corpse.quan, 2);
    assert.deepEqual(chest.contents, []);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(game.u.uhp > 0);
});
void test('gloves make a cockatrice corpse safe to put away', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const corpse = await addInventoryObject(CORPSE, {
        invlet: 'b',
        corpsenm: 10,
    });
    const gloves = await addInventoryObject(LEATHER_GLOVES, {
        invlet: 'c',
        worn: true,
    });
    game.uarmg = game.u.uarmg = gloves;
    await applyInventoryObject('a', 'ic\nb\n');
    assert.deepEqual(chest.contents, [corpse]);
    assert.ok(game.u.uhp > 0);
});
void test('a self-willed artifact can refuse to leave a container', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const orb = await artifactObject('The Orb of Detection', {
        where: 'contained',
        container: chest,
    });
    chest.contents = [orb];
    game.u.ualign.type = -1;
    game.u.ualign.record = 0;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(8401n);
    await applyInventoryObject('a', `oa\n${' '.repeat(10)}`);
    assert.deepEqual(chest.contents, [orb]);
    assert.equal(orb.where, 'contained');
    assert.ok(game.u.uhp < 100);
});
void test('a carried locked chest must be put down before it can be opened', async () => {
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        cknown: false,
        lknown: false,
        olocked: true,
    });
    await applyInventoryObject('a');
    assert.equal(chest.lknown, true);
    assert.equal(chest.cknown, false);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /put it down to unlock/);
});
void test('applying a trapped chest discharges its trap and spends the turn', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { otrapped: true });
    initRng(1n);
    await applyInventoryObject('a', ' ');
    assert.equal(chest.otrapped, false);
    assert.equal(chest.tknown, true);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /explosive charge is a dud/);
});
void test('invocation items cannot be hidden in a container', async () => {
    requirePlayingGame(game);
    const chest = await unlockedContainer(CHEST, 'a', { cknown: true });
    const amulet = await addInventoryObject(AMULET_OF_YENDOR, { invlet: 'b' });
    await applyInventoryObject('a', 'ib\n');
    assert.deepEqual(game.inventory, [chest, amulet]);
    assert.deepEqual(chest.contents, []);
    assert.equal(amulet.where, 'inventory');
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /cannot be confined/);
});
void test('an ice box pauses and resumes corpse decay', async () => {
    requirePlayingGame(game);
    await unlockedContainer(ICE_BOX, 'a', { cknown: true });
    const corpse = await addInventoryObject(CORPSE, {
        invlet: 'b',
        age: 10,
        corpsenm: 0,
    });
    game.moves = 40;
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, 80, game);
    await applyInventoryObject('a', 'ib\n');
    assert.equal(corpse.ageRelative, true);
    assert.deepEqual(objectTimers(corpse), []);
    await applyInventoryObject('a', 'oa\n');
    assert.equal(corpse.ageRelative, false);
    assert.equal(corpse.where, 'inventory');
    assert.ok(objectTimers(corpse).some((timer) => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
});
void test('floor loot uses the same container transfer as apply', async () => {
    requirePlayingGame(game);
    const level = freshPlayableRoom({ seed: 48202n });
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 10, 10, {
        cknown: true,
        olocked: false,
        otrapped: false,
    });
    const club = await knownObject(CLUB, {
        invlet: 'b',
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    pushKeys('loot\noa\n');
    await rhack('#'.charCodeAt(0));
    assert.deepEqual(chest.contents, []);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(floorObjectsAt(level, 10, 10).includes(chest), true);
    assert.equal(game.context.move, 1);
});
void test('opening a cursed bag of holding can make its contents vanish', async () => {
    requirePlayingGame(game);
    const bag = await unlockedContainer(BAG_OF_HOLDING, 'a', {
        cursed: true,
        cknown: true,
    });
    const club = await knownObject(CLUB, {
        invlet: 'b',
        where: 'contained',
        container: bag,
    });
    bag.contents = [club];
    initRng(17n);
    await applyInventoryObject('a', ' q');
    assert.deepEqual(bag.contents, []);
    assert.equal(club.where, 'gone');
    assert.equal(game.context.move, 1);
});
void test('putting one bag of holding inside another destroys both bags', async () => {
    requirePlayingGame(game);
    const outer = await unlockedContainer(BAG_OF_HOLDING, 'a', {
        cknown: true,
    });
    const inner = await unlockedContainer(BAG_OF_HOLDING, 'b', {
        cknown: true,
    });
    const club = await knownObject(CLUB, {
        invlet: 'c',
        where: 'contained',
        container: outer,
    });
    outer.contents = [club];
    game.u.uhp = game.u.uhpmax = 100;
    const hitPoints = game.u.uhp;
    await applyInventoryObject('a', 'ib\n ');
    assert.equal(outer.where, 'gone');
    assert.equal(inner.where, 'gone');
    assert.equal(game.inventory.includes(outer), false);
    assert.equal(game.inventory.includes(inner), false);
    assert.ok(game.u.uhp < hitPoints);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(club), true);
    assert.equal(game.context.move, 1);
});
void test('opening a quantum box resolves its cat once', async () => {
    requirePlayingGame(game);
    const box = await addInventoryItem(await unopenedCatBox({ invlet: 'a' }));
    assert.ok(box.contents);
    const corpse = box.contents[0];
    assert.ok(corpse);
    game.moves = 40;
    initRng(1n);
    const input = resetInputState();
    await answerPrompts(applyInventoryObject(box), input, [
        { prompt: /inside the box is dead![\s\S]*--More--/, keys: ' ' },
        { prompt: /Do what with/, keys: 'q' },
    ]);
    assert.equal(game.context.move, 1);
    await answerPrompts(applyInventoryObject(box), input, [
        { prompt: /Do what with/, keys: 'q' },
    ]);
    assert.equal(box.spe, 0);
    assert.ok(objectTimers(corpse).some((timer) => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
    assert.equal(game.u.uexp, 20);
    assert.equal(game.u.urexp, 90);
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.context.move, 0);
    const removal = await takeFromContainer(box, corpse);
    assert.ok(removal.moved);
    assert.match(removal.message, /named Schroedinger's Cat/);
});
void test('opening a living cat box releases a peaceful cat beside the hero', async () => {
    requirePlayingGame(game);
    const box = await addInventoryItem(await unopenedCatBox({ invlet: 'a' }));
    game.u.ulevel = 8;
    initRng(4n);
    const input = resetInputState();
    await answerPrompts(applyInventoryObject(box), input, [
        { prompt: /inside the box is still alive![\s\S]*--More--/, keys: ' ' },
        { prompt: /Do what with/, keys: 'q' },
    ]);
    const cat = requireGameLevel().monsters.find((monster) => monster.name === "Schroedinger's Cat");
    assert.ok(cat, 'the box did not release its living cat');
    assert.equal(cat.mpeaceful, 1);
    assert.ok(cat.mx !== game.u.ux || cat.my !== game.u.uy);
    assert.ok(box.contents);
    assert.equal(box.contents.length, 0);
    assert.equal(game.u.uexp, 10);
    assert.equal(game.u.urexp, 60);
});
//# sourceMappingURL=container_apply.test.js.map