import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { takeFromContainer } from '../js/container.js';
import { CHEST, DAGGER, DART, ROCK, SHORT_SWORD } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/wield.js';

void test('container removal describes the picked quantity and the merged inventory total', async () => {
    freshPlayableRoom();
    const carried = await addInventoryObject(DART, { invlet: 'a', quantity: 3 });
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const darts = await knownObject(DART, { where: 'contained', container: chest, quantity: 2 });
    chest.contents = [darts];

    await runExtendedCommand('loot', 'oa\n');

    assert.equal(carried.quan, 5);
    assert.match(game._pending_message, /^a - 2 .*darts \(5 in total\)\.$/);
});

void test('container removal into a two-weapon primary names the wielded hand', async () => {
    freshPlayableRoom();
    const sword = await addInventoryWeapon(SHORT_SWORD);
    const dagger = await addInventoryWeapon(DAGGER);
    await setPrimaryWeapon(dagger);
    await setSecondaryWeapon(sword);
    setTwoWeaponCombat(true);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const daggers = await knownObject(DAGGER, {
        where: 'contained', container: chest, quantity: 2,
        spe: 0, enchantment: 0, oeroded: 0, oeroded2: 0,
    });
    chest.contents = [daggers];

    const removal = await takeFromContainer(chest, daggers);

    assert.ok(removal.moved);
    assert.equal(dagger.quan, 3);
    assert.match(removal.message, / - 2 \+0 daggers \(wielded in right hand\) \(3 in total\)\.$/);
});

void test('container removal announces a burden increase on its first added item', async () => {
    freshPlayableRoom();
    await addInventoryObject(ROCK, { quantity: 50 });
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const darts = await knownObject(DART, { where: 'contained', container: chest, quantity: 100 });
    chest.contents = [darts];

    await runExtendedCommand('loot', 'oa\n');

    assert.equal(game.inventory.includes(darts), true);
    assert.match(game._pending_message, /^You have a little trouble removing/);
});
