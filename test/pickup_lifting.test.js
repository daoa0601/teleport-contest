import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { PIT, POOL, TT_PIT, W_AMUL, W_WEP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKey, pushKeys, resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_LIFE_SAVING, BOW, CHEST, CLUB, CORPSE, DART, FOOD_RATION, HEAVY_IRON_BALL, LEATHER_ARMOR, LOADSTONE, LUCKSTONE, ROCK, SCR_SCARE_MONSTER, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorArtifact, floorObject, knownObject, } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { answerPrompts } from './support/input-boundaries.js';
function freshPickupGame() {
    freshPlayableRoom({ seed: 32001n });
    requirePlayingGame(game);
}
async function addCarriedRocks(count) {
    return await addInventoryObject(ROCK, {
        invlet: 'a',
        quantity: count,
        nomerge: true,
    });
}
async function swallowHeroWith(...objects) {
    const worm = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    worm.mhp = worm.mhpmax = 30;
    worm.m_lev = 15;
    for (const object of objects)
        await addObjectToMonsterInventory(worm, object);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    return worm;
}
void test('floor pickup honors a count chosen from a multi-object pile', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const darts = await floorObject(DART, 10, 10, { quantity: 20 });
    const ration = await floorObject(FOOD_RATION, 10, 10);
    pushKeys('5a\n');
    await rhack(','.charCodeAt(0));
    const carried = game.inventory.find(object => object.otyp === DART);
    assert.ok(carried != null);
    assert.equal(carried.quan, 5);
    assert.equal(darts.quan, 15);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(darts), true);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(ration), true);
});
void test('a new pickup replaces the previous just-picked batch', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB, {
        invlet: 'a', pickup_prev: true,
    });
    const ration = await floorObject(FOOD_RATION, 10, 10);
    await rhack(','.charCodeAt(0));
    assert.equal(club.pickup_prev, false);
    assert.equal(ration.pickup_prev, true);
});
void test('weapons-only autopickup takes a weapon and leaves armor on the floor', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.flags.pickup_types = ')';
    const darts = await floorObject(DART, 11, 10, { quantity: 3 });
    const armor = await floorObject(LEATHER_ARMOR, 11, 10);
    pushKeys(' '.repeat(8));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.inventory.includes(darts), true);
    assert.equal(game.inventory.includes(armor), false);
    assert.equal(floorObjectsAt(requireGameLevel(), 11, 10).includes(armor), true);
});
void test('autopickup takes the hero\'s belongings in a shop but leaves stock for sale', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    game.flags.pickup = true;
    const stock = await floorObject(FOOD_RATION, 11, 10);
    const belongings = await floorObject(DART, 11, 10, { no_charge: true });
    pushKeys(' '.repeat(12));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.inventory.includes(belongings), true);
    assert.equal(belongings.no_charge, false);
    assert.equal(floorObjectsAt(requireGameLevel(), 11, 10).includes(stock), true);
    assert.equal(shopkeeper.eshk.bill.length, 0);
});
for (const [method, howLost, setting, picksUp] of [
    ['thrown', 1, 'pickup_thrown', true],
    ['stolen', 3, 'pickup_stolen', true],
    ['dropped', 2, 'dropped_nopick', false],
]) {
    void test(`autopickup honors the option for ${method} items before the class filter`, async () => {
        freshPickupGame();
        requirePlayingGame(game);
        game.flags.pickup = true;
        game.flags.pickup_types = picksUp ? '$' : ')';
        game.flags[setting] = true;
        const darts = await floorObject(DART, 11, 10, { how_lost: howLost });
        pushKeys(' '.repeat(8));
        await rhack('l'.charCodeAt(0));
        assert.equal(game.inventory.includes(darts), picksUp);
        assert.equal(floorObjectsAt(requireGameLevel(), 11, 10).includes(darts), !picksUp);
    });
}
void test('picking up more luckstones updates luck when they merge into a carried stack', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addInventoryObject(LUCKSTONE, { quantity: 3, cursed: true });
    const carried = await addInventoryObject(LUCKSTONE, { quantity: 2 });
    await floorObject(LUCKSTONE, 10, 10, { quantity: 2 });
    assert.equal(game.u.moreluck, -3);
    await rhack(','.charCodeAt(0));
    assert.equal(carried.quan, 4);
    assert.equal(game.u.moreluck, 3);
});
void test('picking up several stacks applies the combined weight limit', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(150);
    game.flags.pickup = true;
    game.flags.pickup_burden = 5;
    await floorObject(DART, 11, 10, { quantity: 100, nomerge: true });
    await floorObject(DART, 11, 10, { quantity: 100, nomerge: true });
    pushKeys(' '.repeat(12));
    await rhack('l'.charCodeAt(0));
    const carried = game.inventory.filter(object => object.otyp === DART);
    assert.equal(carried.reduce((count, object) => count + object.quan, 0), 149);
    const remaining = floorObjectsAt(requireGameLevel(), 11, 10);
    assert.equal(remaining.length, 1);
    const remainder = remaining[0];
    assert.ok(remainder);
    assert.equal(remainder.quan, 51);
});
void test('picking up a bones bow adjusts it for a left-handed hero', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    game.u.rightHanded = false;
    const bow = await floorObject(BOW, 10, 10, {
        ghostly: true,
        name: 'bow',
    });
    await rhack(','.charCodeAt(0));
    assert.equal(bow.ghostly, false);
    assert.match(game._pending_message, /make adjustments to the bow to suit your left hand\.$/);
});
void test('floor pickup takes the largest stack that remains below overload', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(150);
    const darts = await floorObject(DART, 10, 10, { quantity: 200 });
    pushKeys(' '.repeat(5));
    await rhack(','.charCodeAt(0));
    const carried = game.inventory.find(object => object.otyp === DART);
    assert.ok(carried != null);
    assert.equal(carried.quan, 149);
    assert.equal(darts.quan, 51);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(darts), true);
});
void test('declining a heavier burden leaves the floor object in place', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(70);
    const ball = await floorObject(HEAVY_IRON_BALL, 10, 10);
    pushKey('n');
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(ball), false);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(ball), true);
    assert.equal(game.context.move, 1);
});
void test('accepting a heavier burden picks up the floor object', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(70);
    const ball = await floorObject(HEAVY_IRON_BALL, 10, 10);
    pushKey('y');
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(ball), true);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(ball), false);
});
void test('a full pack rejects a new stack which cannot merge', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const [index, letter] of [...letters].entries()) {
        await addInventoryObject(CLUB, {
            invlet: letter,
            o_id: 32000 + index,
            nomerge: true,
        });
    }
    const dart = await floorObject(DART, 10, 10, { nomerge: true });
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(dart), false);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(dart), true);
});
void test('a loadstone ignores the ordinary weight limit', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(160);
    const loadstone = await floorObject(LOADSTONE, 10, 10, { cursed: true });
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(loadstone), true);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(loadstone), false);
});
void test('container removal uses the same partial-stack limit', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(70);
    const chest = await floorObject(CHEST, 10, 10, {
        cknown: true, olocked: false, otrapped: false,
    });
    const darts = await knownObject(DART, {
        where: 'contained',
        container: chest,
        quantity: 1000,
    });
    chest.contents = [darts];
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Do what with/, keys: 'o' },
        { prompt: /Take out what\?/, keys: 'a\n' },
        { prompt: /You can only carry[\s\S]*--More--/, keys: ' ' },
        { prompt: /Continue\?/, keys: 'y' },
    ]);
    const carried = game.inventory.find(object => object.otyp === DART);
    assert.ok(carried != null);
    assert.equal(carried.quan, 949);
    assert.equal(darts.quan, 51);
    assert.deepEqual(chest.contents, [darts]);
});
void test('a floor artifact can blast the hero and evade pickup', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const orb = await floorArtifact('The Orb of Detection', 10, 10);
    game.u.ualign.type = -1;
    game.u.ualign.record = 0;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(8401n);
    pushKeys(' '.repeat(10));
    await rhack(','.charCodeAt(0));
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(orb), true);
    assert.equal(game.inventory.includes(orb), false);
    assert.ok(game.u.uhp < 100);
});
void test('a fatal floor corpse stops pickup after life saving', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'a',
        worn: true,
        owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    const corpse = await floorObject(CORPSE, 10, 10, {
        corpsenm: 10,
        quantity: 2,
    });
    pushKeys(' '.repeat(10));
    await rhack(','.charCodeAt(0));
    assert.equal(corpse.quan, 2);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(corpse), true);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(game.u.uhp > 0);
});
void test('touching a Rider corpse revives it instead of picking it up', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    game.moves = 40;
    const corpse = await floorObject(CORPSE, 10, 10, {
        age: 40,
        corpsenm: 311,
    });
    pushKeys(' '.repeat(5));
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(corpse), false);
    assert.ok(requireGameLevel().monsters.some(monster => monster.mnum === 311 && monster.mhp > 0));
});
void test('a blessed scare scroll becomes uncursed when picked up', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const scroll = await floorObject(SCR_SCARE_MONSTER, 10, 10, {
        blessed: true,
        dknown: false,
        spe: 0,
    });
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(scroll), true);
    assert.equal(scroll.blessed, false);
    assert.equal(scroll.spe, 0);
    assert.equal(scroll.dknown, true);
    assert.ok(game._encounteredObjectTypes != null);
    assert.equal(game._encounteredObjectTypes.has(SCR_SCARE_MONSTER), true);
});
void test('only the carryable part of a cursed scare-scroll stack turns to dust', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(164);
    game._knownObjectTypes = new Set([SCR_SCARE_MONSTER]);
    const scrolls = await floorObject(SCR_SCARE_MONSTER, 10, 10, {
        cursed: true,
        quantity: 2,
        spe: 0,
    });
    pushKeys(' '.repeat(5));
    await rhack(','.charCodeAt(0));
    assert.equal(scrolls.quan, 1);
    assert.deepEqual(floorObjectsAt(requireGameLevel(), 10, 10), [scrolls]);
    assert.equal(game.inventory.some(object => object.otyp === SCR_SCARE_MONSTER), false);
});
void test('an unliftable scare scroll remains unchanged', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await addCarriedRocks(165);
    const scroll = await floorObject(SCR_SCARE_MONSTER, 10, 10, {
        cursed: false,
        spe: 0,
    });
    const input = resetInputState();
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /scare monster[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(scroll.spe, 0);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(scroll), true);
    assert.equal(game.inventory.includes(scroll), false);
});
void test('a swallowed hero can pick up an object inside the monster', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const club = await knownObject(CLUB, { spe: 0 });
    const worm = await swallowHeroWith(club);
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(club), true);
    assert.equal(worm.minvent.includes(club), false);
    assert.equal(club.where, 'inventory');
    assert.equal(club.carrierMid, undefined);
    assert.equal(game.context.move, 1);
});
void test('a swallowed hero cannot take the monster weapon', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const club = await knownObject(CLUB, {
        spe: 0,
        owornmask: W_WEP,
        wielded: true,
    });
    const worm = await swallowHeroWith();
    await equipMonsterObject(worm, club, W_WEP);
    pushKeys('a\n');
    await rhack(','.charCodeAt(0));
    assert.equal(worm.minvent.includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(club.where, 'minvent');
    assert.equal(game.context.move, 0);
});
void test('a handless form which can carry objects can pick one up', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    game.u.umonster = 260;
    game.u.umonnum = 8;
    game.u.mtimedone = 100;
    const club = await floorObject(CLUB, 10, 10);
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(club), true);
    assert.equal(game.context.move, 1);
});
void test('levitation keeps floor objects out of reach', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    game.u.levitating = true;
    const club = await floorObject(CLUB, 10, 10);
    await rhack(','.charCodeAt(0));
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.context.move, 0);
});
void test('a hero at a pit edge cannot reach an object at the bottom', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    addTrap(requireGameLevel(), PIT, 10, 10, { tseen: true });
    const club = await floorObject(CLUB, 10, 10);
    await rhack(','.charCodeAt(0));
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.context.move, 0);
});
void test('a hero inside a pit can pick up an object at the bottom', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    addTrap(requireGameLevel(), PIT, 10, 10, { tseen: true });
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    const club = await floorObject(CLUB, 10, 10);
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(club), true);
    assert.equal(game.context.move, 1);
});
void test('autopickup leaves an unreachable floor object behind', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.u.levitating = true;
    const club = await floorObject(CLUB, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(floorObjectsAt(requireGameLevel(), 11, 10).includes(club), true);
    assert.equal(game.inventory.includes(club), false);
});
void test('a pickup command count takes that many objects', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const darts = await floorObject(DART, 10, 10, { quantity: 10 });
    pushKeys('3,');
    await rhack(0);
    const carried = game.inventory.find(object => object.otyp === DART);
    assert.ok(carried != null);
    assert.equal(carried.quan, 3);
    assert.equal(darts.quan, 7);
});
void test('a pickup command count chooses one matching stack', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    const darts = await floorObject(DART, 10, 10, { quantity: 10 });
    const rocks = await floorObject(ROCK, 10, 10, { quantity: 10 });
    pushKeys('3,a');
    await rhack(0);
    const carried = game.inventory.find(object => object.otyp === DART);
    assert.ok(carried != null);
    assert.equal(carried.quan, 3);
    assert.equal(darts.quan, 7);
    assert.equal(rocks.quan, 10);
});
void test('an empty digesting monster still consumes a pickup turn', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    await swallowHeroWith();
    pushKeys(' '.repeat(3));
    await rhack(','.charCodeAt(0));
    assert.deepEqual(game.inventory, []);
    assert.equal(game.context.move, 1);
});
void test('water walking cannot reach objects at the bottom of a pool', async () => {
    freshPickupGame();
    requirePlayingGame(game);
    requireGameLevel().requireAt(10, 10).typ = POOL;
    game.u.waterWalking = true;
    const club = await floorObject(CLUB, 10, 10);
    await rhack(','.charCodeAt(0));
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=pickup_lifting.test.js.map