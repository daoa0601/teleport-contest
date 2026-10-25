import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { OBJECT_NAMES, POT_CONFUSION, POT_BOOZE, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_GAIN_ENERGY,
    POT_HEALING, POT_LEVITATION, POT_SEE_INVISIBLE, POT_SICKNESS, POT_SPEED, POT_WATER, UNICORN_HORN } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const AMETHYST = OBJECT_NAMES.indexOf('amethyst');

for (const { dippedType, sourceType } of [
    { dippedType: POT_HEALING, sourceType: POT_SPEED },
    { dippedType: POT_SPEED, sourceType: POT_HEALING },
    { dippedType: POT_HEALING, sourceType: POT_GAIN_ENERGY },
    { dippedType: POT_GAIN_ENERGY, sourceType: POT_HEALING },
]) {
    void test(`mixing ${OBJECT_NAMES[dippedType]} into ${OBJECT_NAMES[sourceType]} makes diluted extra healing`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const dipped = await addInventoryObject(dippedType);
        const source = await addInventoryObject(sourceType);
        resetInputState();
        initRng(123n);

        await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

        assert.equal(dipped.otyp, POT_EXTRA_HEALING);
        assert.equal(!!dipped.odiluted, true);
        assert.equal(dipped.blessed, false);
        assert.equal(game.inventory.includes(source), false);
        assert.equal(game.context.move, 1);
    });
}

void test('mixing a large magic stack treats only a rolled subset of bottles', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dipped = await addInventoryObject(POT_HEALING, { quan: 10 });
    const source = await addInventoryObject(POT_SPEED);
    resetInputState();
    initRng(123n);

    await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    const mixture = game.inventory.find(item => item.otyp === POT_EXTRA_HEALING);
    assert.ok(mixture, 'The mixed bottles should become extra healing.');
    // C potion.c potion_dip(): a magic mixture takes three to eight bottles.
    assert.ok(mixture.quan >= 3 && mixture.quan <= 8,
        `Expected between three and eight mixed bottles, saw ${mixture.quan}.`);
    assert.equal(dipped.quan, 10 - mixture.quan);
    assert.equal(!!mixture.odiluted, true);
    assert.equal(mixture.blessed, false);
    assert.equal(mixture.cursed, false);
    assert.match(game._pending_message, /The mixture looks \w+\./);
    assert.match(game._pending_message, /\d+ diluted \w+ potions/);
    assert.equal(game.context.move, 1);
});

void test('an incompatible pair reduces to water that bubbles clear', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dipped = await addInventoryObject(POT_LEVITATION);
    const source = await addInventoryObject(POT_SPEED);
    resetInputState();
    initRng(3n);

    await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(dipped.otyp, POT_WATER);
    assert.equal(!!dipped.odiluted, false, 'Water is never a diluted mixture.');
    assert.equal(dipped.blessed, false);
    assert.equal(dipped.cursed, false);
    assert.match(game._pending_message, /The mixture bubbles, then clears\./);
    assert.equal(game.inventory.includes(source), false);
    assert.equal(game.context.move, 1);
});

void test('an incompatible pair can glow brightly and evaporate', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dipped = await addInventoryObject(POT_LEVITATION);
    const source = await addInventoryObject(POT_SPEED);
    resetInputState();
    initRng(1n);

    await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(dipped.where, 'gone');
    assert.equal(game.inventory.includes(source), false);
    assert.match(game._pending_message, /The mixture glows brightly and evaporates\./);
    assert.equal(game.context.move, 1);
});

void test('mixing diluted healing treats two bottles and leaves the rest of the stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dipped = await addInventoryObject(POT_HEALING, { quan: 10, odiluted: true });
    const source = await addInventoryObject(POT_SPEED);
    resetInputState();
    initRng(123n);

    await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(dipped.otyp, POT_HEALING);
    assert.equal(dipped.quan, 8);
    const mixture = game.inventory.find(item => item.otyp === POT_EXTRA_HEALING);
    assert.ok(mixture, 'The two dipped bottles should remain as extra healing.');
    assert.equal(mixture.quan, 2);
    assert.notEqual(mixture.invlet, dipped.invlet);
});

void test('a cursed dipped potion explodes, hurts the hero and destroys both ingredients', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dipped = await addInventoryObject(POT_HEALING, { cursed: true });
    const source = await addInventoryObject(POT_SPEED);
    resetInputState();

    await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(game.inventory.includes(dipped), false);
    assert.equal(game.inventory.includes(source), false);
    assert.ok(game.u.uhp < 40);
    assert.match(game._pending_message, /They explode/);
});

void test('an exploding unknown see-invisible potion can be called before it is destroyed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dipped = await addInventoryObject(POT_SEE_INVISIBLE, {
        cursed: true, known: false, typeKnown: false,
    });
    const source = await addInventoryObject(POT_SPEED);
    const sibling = await addInventoryObject(POT_SEE_INVISIBLE, {
        blessed: true, known: false, typeKnown: false,
    });
    resetInputState();

    await runExtendedCommand('dip', dipped.invlet + source.invlet + ' '.repeat(20) + 'veil\n');

    assert.equal(game.inventory.includes(dipped), false);
    assert.equal(game.inventory.includes(source), false);
    assert.ok(game.u.uhp < 40);
    assert.equal(game._objectCallNames?.[POT_SEE_INVISIBLE], 'veil');
    assert.match(await inventoryItemDescription(sibling), /potion called veil/);
    assert.equal(game._knownObjectTypes?.has(POT_SEE_INVISIBLE) ?? false, false);
    assert.equal(game.context.move, 1);
});

void test('a unicorn horn clears one sickness bottle without consuming the horn or the other bottles', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const horn = await addInventoryObject(UNICORN_HORN);
    const sickness = await addInventoryObject(POT_SICKNESS, { quan: 3, blessed: true });
    resetInputState();

    await runExtendedCommand('dip', horn.invlet + sickness.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(game.inventory.includes(horn), true);
    assert.equal(sickness.quan, 2);
    const juice = game.inventory.find(item => item.otyp === POT_FRUIT_JUICE);
    assert.ok(juice);
    assert.equal(juice.quan, 1);
    assert.equal(juice.blessed, false);
});

void test('an amethyst makes fruit juice whose curse follows the gem', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const gem = await addInventoryObject(AMETHYST, { cursed: true });
    const booze = await addInventoryObject(POT_BOOZE, { blessed: true });
    resetInputState();

    await runExtendedCommand('dip', gem.invlet + booze.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(booze.otyp, POT_FRUIT_JUICE);
    assert.equal(booze.cursed, true);
    assert.equal(booze.blessed, false);
    assert.equal(game.inventory.includes(gem), true);
});

void test('a cursed horn clears confusion into uncursed undiluted water', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const horn = await addInventoryObject(UNICORN_HORN, { cursed: true });
    const potion = await addInventoryObject(POT_CONFUSION, { cursed: true, odiluted: true });
    resetInputState();

    await runExtendedCommand('dip', horn.invlet + potion.invlet + ' '.repeat(20) + '\n' + ' '.repeat(20));

    assert.equal(potion.otyp, POT_WATER);
    assert.equal(potion.cursed, false);
    assert.equal(!!potion.odiluted, false);
});
