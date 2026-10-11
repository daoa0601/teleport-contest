import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { flipCoin } from '../js/coin_flip.js';
import { A_DEX, HOLE, NO_MINVENT } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { GAUNTLETS_OF_FUMBLING, GOLD_PIECE, LEATHER_GLOVES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [seed, face] of [
    [1n, 'heads'],
    [4n, 'tails'],
] as const) {
    void test(`a caught coin shows ${face} and preserves the purse`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });
        initRng(seed);

        const result = await flipCoin(purse);

        assert.equal(result.spentTime, true);
        assert.match(game._pending_message, new RegExp(`It comes up ${face}\\.`));
        assert.match(game._pending_message, /You flip a gold piece\./);
        assert.equal(heroGoldAmount(game), 50);
        assert.ok(game.inventory.includes(purse));
        assert.equal((requireGameLevel().objects?.[10]?.[10] ?? []).length, 0);
    });
}

for (const [name, hero, message] of [
    ['underwater', { uinwater: 1 }, /It tumbles away/],
    ['with slippery fingers', { glibTurns: 10 }, /It slips between your fingers/],
    ['while fumbling', { fumbling: true }, /It slips between your fingers/],
] as const) {
    void test(`a coin flipped ${name} removes and lands exactly one coin`, async () => {
        freshObjectRoom({ hero });
        requirePlayingGame(game);
        const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });

        await flipCoin(purse);

        assert.match(game._pending_message, message);
        assert.equal(heroGoldAmount(game), 49);
        assert.ok(game.inventory.includes(purse));
        const [dropped] = floorObjectsAt(requireGameLevel(), 10, 10);
        assert.ok(dropped);
        assert.equal(dropped.otyp, GOLD_PIECE);
        assert.equal(dropped.quan, 1);
        assert.equal(dropped.where, 'floor');
        assert.ok(!game.inventory.includes(dropped));
    });
}

void test('losing the last coin removes the purse object from inventory', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    const coin = await addInventoryObject(GOLD_PIECE);

    await flipCoin(coin);

    assert.equal(heroGoldAmount(game), 0);
    assert.ok(!game.inventory.includes(coin));
    assert.ok(floorObjectsAt(requireGameLevel(), 10, 10).includes(coin));
});

void test('lost coins merge with the floor purse', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    await floorObject(GOLD_PIECE, 10, 10, { quan: 9 });
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });

    await flipCoin(purse);

    assert.equal(heroGoldAmount(game), 49);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).length, 1);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10)[0]?.quan, 10);
});

void test('a lost coin over a hole migrates to the lower level', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    addTrap(game.level, HOLE, 10, 10, { tseen: true });
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });
    // Known holes have a one-in-three shipping chance.
    initRng(1n);
    resetInputState().feed(' ');

    await flipCoin(purse);

    assert.equal(heroGoldAmount(game), 49);
    assert.equal((requireGameLevel().objects?.[10]?.[10] ?? []).length, 0);
    assert.ok(game.migratingObjects);
    const [coin] = game.migratingObjects;
    assert.ok(coin);
    assert.ok(coin.migration);
    assert.equal(coin.otyp, GOLD_PIECE);
    assert.equal(coin.quan, 1);
    assert.equal(coin.where, 'migrating');
    assert.equal(coin.migration.destination.dlevel, 9);
});

void test('a lost coin can stay beside a known hole', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    addTrap(game.level, HOLE, 10, 10, { tseen: true });
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });
    // Both dropx and flooreffects test whether the coin enters this hole.
    initRng(4n);

    await flipCoin(purse);

    assert.equal(heroGoldAmount(game), 49);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10)[0]?.quan, 1);
    assert.equal(game.migratingObjects?.length ?? 0, 0);
});

void test('a lost coin while swallowed enters the real engulfer inventory', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 10, 10, NO_MINVENT);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });

    const result = await flipCoin(purse);

    assert.equal(result.heroDied, false);
    assert.equal(heroGoldAmount(game), 49);
    const coin = worm.minvent.find((object) => object.otyp === GOLD_PIECE);
    assert.ok(coin);
    assert.equal(coin.quan, 1);
    assert.equal(coin.where, 'minvent');
    assert.equal((requireGameLevel().objects?.[10]?.[10] ?? []).length, 0);
});

for (const [seed, loses] of [
    [1n, true],
    [2n, false],
] as const) {
    void test(`low Dexterity can ${loses ? 'lose' : 'catch'} a flipped coin`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_DEX] = 3;
        const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });
        initRng(seed);

        await flipCoin(purse);

        assert.equal(heroGoldAmount(game), loses ? 49 : 50);
        assert.match(
            game._pending_message,
            loses ? /slips between your fingers/ : /comes up (heads|tails)/,
        );
    });
}

for (const [seed, message] of [
    [1n, /Wow, a double header/],
    [167n, /coin miraculously lands on its edge/],
] as const) {
    void test(`hallucinated coin flipping can show ${seed === 1n ? 'two heads' : 'an edge landing'}`, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: 10 } });
        requirePlayingGame(game);
        const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });
        initRng(seed);

        await flipCoin(purse);

        assert.match(game._pending_message, message);
        assert.equal(heroGoldAmount(game), 50);
    });
}

void test('a lost coin waits for flip prose to be dismissed before leaving the purse', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const input = resetInputState();
    game._pending_message = 'A distant bell rings through the quiet corridors of the dungeon.';

    const flipping = flipCoin(purse);
    await input.waitUntilBlocked();
    assert.equal(heroGoldAmount(game), 50);
    assert.match(game._pending_message, /distant bell/);
    input.feed(' ');
    await flipping;

    assert.match(game._pending_message, /You flip a gold piece\.  It slips between your fingers/);
    assert.equal(heroGoldAmount(game), 49);
});

void test('wearing gloves still names fingers when a coin slips', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });

    await flipCoin(purse);

    assert.match(game._pending_message, /slips between your fingers/);
});

void test('worn gauntlets of fumbling cause a coin to slip without low Dexterity', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(GAUNTLETS_OF_FUMBLING));
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });

    await flipCoin(purse);

    assert.equal(heroGoldAmount(game), 49);
    assert.match(game._pending_message, /slips between your fingers/);
});

void test('a clawed humanoid still has fingers in coin-flip prose', async () => {
    freshObjectRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    installPolymorphedHero('troll');
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50 });

    await flipCoin(purse);

    assert.match(game._pending_message, /slips between your fingers/);
});
