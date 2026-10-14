import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ARROW, DAGGER, OIL_LAMP, POT_HEALING, POT_OIL, POT_SICKNESS, POT_WATER } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('dipping a cursed dagger in holy water uncurses it and consumes one bottle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER, { cursed: true });
    const water = await addInventoryObject(POT_WATER, { blessed: true, quan: 2 });
    resetInputState();

    await runExtendedCommand('dip', dagger.invlet + water.invlet + ' '.repeat(20));

    assert.equal(dagger.cursed, false);
    assert.equal(dagger.blessed, false);
    assert.equal(water.quan, 1);
    assert.match(game._pending_message, /glows amber/);
    assert.equal(game.context.move, 1);
});

void test('unholy water removes a blessing before it can curse the target', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER, { blessed: true });
    const water = await addInventoryObject(POT_WATER, { cursed: true });
    resetInputState();

    await runExtendedCommand('dip', dagger.invlet + water.invlet + ' '.repeat(20));

    assert.equal(dagger.blessed, false);
    assert.equal(dagger.cursed, false);
    assert.equal(game.inventory.includes(water), false);
});

void test('sickness poisons a stack of arrows and healing removes its coating', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const arrows = await addInventoryObject(ARROW, { quan: 12 });
    const sickness = await addInventoryObject(POT_SICKNESS);
    const healing = await addInventoryObject(POT_HEALING);
    resetInputState();

    await runExtendedCommand('dip', arrows.invlet + sickness.invlet + ' '.repeat(20));
    assert.equal(arrows.opoisoned, true);
    assert.equal(arrows.quan, 12);
    assert.equal(game.inventory.includes(sickness), false);
    assert.match(game._pending_message, /forms a coating on the arrows\./);
    await runExtendedCommand('dip', arrows.invlet + healing.invlet + ' '.repeat(20));
    assert.equal(arrows.opoisoned, false);
    assert.equal(game.inventory.includes(healing), false);
    assert.match(game._pending_message, /wears off the poisoned arrows\./);
});

void test('oil repairs one degree of rust and corrosion on a weapon', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER, { oeroded: 2, oeroded2: 3 });
    const oil = await addInventoryObject(POT_OIL);
    resetInputState();

    await runExtendedCommand('dip', dagger.invlet + oil.invlet + ' '.repeat(20));

    assert.equal(dagger.oeroded, 1);
    assert.equal(dagger.oeroded2, 2);
    assert.equal(game.inventory.includes(oil), false);
    assert.match(game._pending_message, /less corroded and rusty/);
});

void test('dipping an oil lamp fills it using the bottle fuel', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const lamp = await addInventoryObject(OIL_LAMP, { age: 100, spe: 0 });
    const oil = await addInventoryObject(POT_OIL, { age: 200 });
    resetInputState();

    await runExtendedCommand('dip', lamp.invlet + oil.invlet + ' '.repeat(20));

    assert.equal(lamp.age, 500);
    assert.equal(lamp.spe, 1);
    assert.equal(game.inventory.includes(oil), false);
});

void test('a single bottle cannot be dipped into itself and takes no time', async () => {
    freshObjectRoom();
    const water = await addInventoryObject(POT_WATER);
    resetInputState();

    await runExtendedCommand('dip', water.invlet + water.invlet + ' '.repeat(20));

    assert.equal(game.inventory.includes(water), true);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /not a Klein bottle/);
});
