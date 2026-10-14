import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { useGrayStone } from '../js/gray_stone.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { objectMaterial } from '../js/object_material.js';
import {
    ACID_VENOM, BLINDFOLD, DAGGER, DIAMOND, FLINT, GOLD_PIECE, LOADSTONE, LUCKSTONE,
    OBJECT_BASES, OBJECT_NAMES, QUARTERSTAFF, SCR_BLANK_PAPER,
    TALLOW_CANDLE, TOUCHSTONE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { races } from '../js/roles.js';
import { objectTypeKnown } from '../js/shk.js';
import { inventoryWeight } from '../js/weight.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const GLASS_GEM = OBJECT_NAMES.indexOf('worthless piece of white glass');
const SILVER_DAGGER = OBJECT_NAMES.indexOf('silver dagger');

function ringMadeOf(material: number) {
    const firstRing = OBJECT_BASES[4];
    const afterRings = OBJECT_BASES[5];
    assert.ok(firstRing !== undefined && afterRings !== undefined);
    const type = Array.from({ length: afterRings - firstRing },
        (_, index) => firstRing + index)
        .find(type => objectMaterial(type) === material);
    assert.ok(type !== undefined, `the initialized ring set has no material ${material}`);
    return type;
}

for (const { name, role = 'caveman', race = 'human', blessed = false, cursed = false, identifies } of [
    { name: 'a blessed stone works for an ordinary human', blessed: true, identifies: true },
    { name: 'an uncursed stone does not work for an ordinary human', identifies: false },
    { name: 'an uncursed stone works for an Archeologist', role: 'archeologist', identifies: true },
    { name: 'an uncursed stone works for a gnome', race: 'gnome', identifies: true },
    { name: 'a cursed stone does not work for an Archeologist', role: 'archeologist', cursed: true, identifies: false },
    { name: 'a cursed stone does not work for a gnome', race: 'gnome', cursed: true, identifies: false },
] as const) {
    void test(`touchstone identification: ${name}`, async () => {
        const heroRace = races.find(candidate => candidate.name === race);
        assert.ok(heroRace);
        freshObjectRoom({ role, race: heroRace });
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE, { blessed, cursed, typeKnown: false });
        const gem = await addInventoryObject(DIAMOND, { typeKnown: false });
        // This seed lets a gem survive a cursed touchstone's 80% resistance.
        initRng(1n);
        resetInputState().feed(gem.invlet);

        const result = await useGrayStone(stone);

        assert.equal(result.spentTime, true);
        assert.equal(objectTypeKnown(gem), identifies);
        assert.equal(objectTypeKnown(stone), identifies);
        assert.equal(gem.quan, 1);
        assert.match(game._pending_message, identifies ? /diamond/ : /white streaks on the stone/);
    });
}

void test('an effective touchstone identifies glass instead of reporting scratch marks', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(TOUCHSTONE, { blessed: true, typeKnown: false });
    const gem = await addInventoryObject(GLASS_GEM, { typeKnown: false });
    resetInputState().feed(gem.invlet);

    await useGrayStone(stone);

    assert.equal(objectTypeKnown(gem), true);
    assert.match(game._pending_message, /worthless piece of white glass/);
    assert.doesNotMatch(game._pending_message, /scratch marks/);
});

for (const [name, hero, message] of [
    ['blind', { blindTurns: 10 }, /"scritch, scritch"/],
    ['hallucinating', { hallucinationTurns: 10 }, /Oh wow, man: Fractals!/],
    ['blind and hallucinating', { blindTurns: 10, hallucinationTurns: 10 }, /"scritch, scritch"/],
] as const) {
    void test(`a ${name} hero cannot identify a gem with a blessed touchstone`, async () => {
        freshObjectRoom({ hero });
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE, {
            blessed: true, observed: false, dknown: false, typeKnown: false,
        });
        const gem = await addInventoryObject(DIAMOND, { typeKnown: false });
        resetInputState().feed(gem.invlet);

        const result = await useGrayStone(stone);

        assert.equal(result.spentTime, true);
        assert.match(game._pending_message, message);
        assert.equal(objectTypeKnown(gem), false);
        assert.equal(objectTypeKnown(stone), false);
        if (hero.blindTurns) assert.equal(stone.dknown, false);
    });
}

for (const [stoneType, expected] of [
    [TOUCHSTONE, /You see white streaks on the stone/],
    [FLINT, /You make white scratch marks on the stone/],
] as const) {
    void test(`diamond rubbing ${stoneType === TOUCHSTONE ? 'streaks a touchstone' : 'scratches flint'}`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const stone = await addInventoryObject(stoneType);
        const gem = await addInventoryObject(DIAMOND, { typeKnown: false });
        resetInputState().feed(gem.invlet);

        await useGrayStone(stone);

        assert.match(game._pending_message, expected);
        assert.equal(objectTypeKnown(gem), false);
    });
}

void test('glass scratches an ineffective touchstone without leaving a colored streak', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(TOUCHSTONE);
    const glass = await addInventoryObject(GLASS_GEM, { typeKnown: false });
    resetInputState().feed(glass.invlet);

    await useGrayStone(stone);

    assert.equal(game._pending_message, 'You make scratch marks on the stone.');
    assert.equal(objectTypeKnown(glass), false);
});

for (const material of [20, 21] as const) {
    void test(`a ring made of ${material === 20 ? 'gemstone' : 'mineral'} leaves streaks but is not identified`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE, { blessed: true });
        const ring = await addInventoryObject(ringMadeOf(material), { typeKnown: false });
        resetInputState().feed(ring.invlet);

        await useGrayStone(stone);

        assert.match(game._pending_message, /^You see .+ streaks on the stone\./);
        assert.equal(objectTypeKnown(ring), false);
    });
}

for (const [name, type, overrides, expected] of [
    ['cloth', BLINDFOLD, {}, /a little more polished now/],
    ['an unknown liquid', ACID_VENOM, { known: false }, /must think this is a wetstone/],
    ['a known liquid', ACID_VENOM, { known: true }, /a little wetter now/],
    ['wax', TALLOW_CANDLE, {}, /You see waxy streaks on the stone/],
    ['wood', QUARTERSTAFF, {}, /You see wooden streaks on the stone/],
    ['gold', GOLD_PIECE, { quan: 25 }, /You make golden scratch marks on the stone/],
    ['silver', SILVER_DAGGER, {}, /You make silvery scratch marks on the stone/],
    ['flimsy paper', SCR_BLANK_PAPER, {}, /^You see .+ streaks on the stone/],
    ['hard iron', DAGGER, {}, /"scritch, scritch"/],
] as const) {
    void test(`rubbing ${name} on a touchstone follows its material`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE);
        const object = await addInventoryObject(type, overrides);
        resetInputState().feed(object.invlet);

        const result = await useGrayStone(stone);

        assert.equal(result.spentTime, true);
        assert.match(game._pending_message, expected);
        assert.equal(object.where, 'inventory');
    });
}

void test('hard iron scratches an ordinary gray stone', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(FLINT);
    const dagger = await addInventoryObject(DAGGER);
    resetInputState().feed(dagger.invlet);

    await useGrayStone(stone);

    assert.equal(game._pending_message, 'You make scratch marks on the stone.');
});

void test('a cursed touchstone destroys one gem and updates stack and carried weight', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(TOUCHSTONE, { cursed: true });
    const gems = await addInventoryObject(DIAMOND, { quan: 3 });
    const weight = inventoryWeight(game);
    const gemWeight = gems.owt;
    // This seed exceeds the source's 80% gem-resistance chance.
    initRng(11n);
    resetInputState().feed(gems.invlet);

    await useGrayStone(stone);

    assert.match(game._pending_message, /A sharp crack shatters one of the diamonds/);
    assert.equal(gems.quan, 2);
    assert.equal(gems.quantity, 2);
    assert.equal(gems.owt, gemWeight * 2 / 3);
    assert.equal(inventoryWeight(game), weight - gemWeight / 3);
    assert.ok(game.inventory.includes(gems));
    assert.equal(stone.where, 'inventory');
});

for (const [name, hero, message] of [
    ['blind', { blindTurns: 10 }, /You feel something shatter/],
    ['hallucinating', { hallucinationTurns: 10 }, /Oh, wow, look at the pretty shards/],
] as const) {
    void test(`cursed touchstone breakage happens before ${name} sensory feedback`, async () => {
        freshObjectRoom({ hero });
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE, { cursed: true });
        const gem = await addInventoryObject(DIAMOND);
        initRng(11n);
        resetInputState().feed(gem.invlet);

        await useGrayStone(stone);

        assert.match(game._pending_message, message);
        assert.equal(gem.where, 'gone');
        assert.ok(!game.inventory.includes(gem));
    });
}

for (const type of [LUCKSTONE, LOADSTONE, FLINT, TOUCHSTONE] as const) {
    void test(`a cursed touchstone cannot shatter ${OBJECT_NAMES[type]}`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE, { cursed: true });
        const target = await addInventoryObject(type, { quan: 3 });
        initRng(11n);
        resetInputState().feed(target.invlet);

        await useGrayStone(stone);

        assert.equal(target.quan, 3);
        assert.equal(target.where, 'inventory');
        assert.doesNotMatch(game._pending_message, /shatter|shards/);
    });
}

void test('one gray stone cannot rub itself and takes no time', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(TOUCHSTONE);
    resetInputState().feed(stone.invlet);

    const result = await useGrayStone(stone);

    assert.equal(result.spentTime, false);
    assert.match(game._pending_message, /can't rub .+ on itself/);
    assert.equal(stone.quan, 1);
});

void test('a stack of gray stones can rub against itself without losing a stone', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stones = await addInventoryObject(FLINT, { quan: 2 });
    resetInputState().feed(stones.invlet);

    const result = await useGrayStone(stones);

    assert.equal(result.spentTime, true);
    assert.match(game._pending_message, /scratch marks on the stones/);
    assert.equal(stones.quan, 2);
});

void test('cancelling the rub target takes no time or changes to the stone', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(TOUCHSTONE);
    resetInputState().feed('\x1b');

    const result = await useGrayStone(stone);

    assert.equal(result.spentTime, false);
    assert.equal(stone.where, 'inventory');
    assert.match(game._pending_message, /Never mind/);
});

for (const command of ['apply', 'rub'] as const) {
    void test(`#${command} can select a gray stone and identify a gem`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const stone = await addInventoryObject(TOUCHSTONE, { blessed: true });
        const gem = await addInventoryObject(DIAMOND, { typeKnown: false });
        assert.ok(stone.invlet !== null && stone.invlet !== undefined);
        assert.ok(gem.invlet !== null && gem.invlet !== undefined);
        await runExtendedCommand(command, stone.invlet + gem.invlet);

        assert.equal(game.context.move, 1);
        assert.equal(objectTypeKnown(gem), true);
        assert.match(game._pending_message, /diamond/);
        assert.equal(game.uwep, null);
    });
}

void test('#apply preserves the no-time refusal when a gray stone is rubbed on itself', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(TOUCHSTONE);
    assert.ok(stone.invlet !== null && stone.invlet !== undefined);
    await runExtendedCommand('apply', stone.invlet + stone.invlet);

    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /can't rub .+ on itself/);
});
