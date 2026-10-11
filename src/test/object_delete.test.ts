import { createMonsterAt } from './support/monsters.js';
import { doeat } from '../js/eat.js';
import { pushKeys } from '../js/input.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/display.js';
import { beginObjectBurn } from '../js/light.js';
import { cansee } from '../js/vision.js';
import { deleteObject, delobj } from '../js/object_delete.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { unlinkObject } from '../js/object_location.js';
import { addObjectToContainer } from '../js/object_container.js';
import { addShopObjectToBill, carriedShopBill } from '../js/shk.js';
import {
    AMULET_OF_YENDOR, MAGIC_LAMP, OIL_LAMP, OBJECT_NAMES,
} from '../js/object_data.js';
import {
    MONSTER_NAME,
} from '../js/monster_data.js';
import { knownObject, addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

const SCORPION = MONSTER_NAME.indexOf('scorpion');

async function hiddenHiderAt(x: number, y: number) {
    const monster = await createMonsterAt(SCORPION, x, y);
    monster.mundetected = 1;
    return monster;
}

void test('a floor object deleted through delobj reveals the hider beneath', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const chest = await knownObject(OBJECT_NAMES.indexOf('chest'));
    placeCreatedObject(chest, 12, 10);
    const hider = await hiddenHiderAt(12, 10);

    await delobj(chest);

    assert.equal(chest.where, 'gone');
    assert.deepEqual(floorObjectsAt(requireGameLevel(game), 12, 10), []);
    assert.equal(hider.mundetected, 0);
});

void test('the Amulet of Yendor survives delobj', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    placeCreatedObject(amulet, 10, 10);
    amulet.in_use = true;

    await delobj(amulet);

    assert.equal(amulet.in_use, false);
    assert.equal(amulet.where, 'floor');
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).includes(amulet));
});

void test('an ordinary deletion still removes the object entirely', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await knownObject(OBJECT_NAMES.indexOf('gain energy'));
    placeCreatedObject(potion, 10, 10);

    await delobj(potion);

    assert.equal(potion.where, 'gone');
    assert.deepEqual(floorObjectsAt(requireGameLevel(game), 10, 10), []);
});

void test('being eaten food stops being the meal when deleted', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ration = await addInventoryObject(OBJECT_NAMES.indexOf('food ration'));
    assert.ok(ration.invlet);
    pushKeys(ration.invlet);
    await doeat();
    assert.equal(game.context.victual?.piece, ration);

    await deleteObject(ration);

    assert.equal(game.context.victual, null);
});

void test('an attached leash is released through the leash owner', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const leash = await knownObject(OBJECT_NAMES.indexOf('leash'));
    const monster = await createMonsterAt('housecat', 11, 10);
    monster.mleashed = 1;
    leash.leashmon = monster.m_id;
    // The leash owner scans the hero's inventory for the attachment.
    game.inventory = [leash];

    await deleteObject(leash);

    assert.equal(leash.leashmon, 0);
    assert.equal(monster.mleashed, 0);
});

void test('nested billed content survives container destruction on the bill', async () => {
    freshObjectRoom({ hero: { ux: 10, uy: 10 } });
    requirePlayingGame(game);
    game.u.ux = 10;
    game.u.uy = 10;
    const { shopkeeper: resident } = await createStaffedShop({ keeperX: 12, keeperY: 10 });

    const chest = await knownObject(OBJECT_NAMES.indexOf('chest'));
    const potion = await knownObject(OBJECT_NAMES.indexOf('gain energy'));
    placeCreatedObject(potion, 13, 10);
    await addShopObjectToBill(potion, game, { ininv: false, silent: true });
    assert.equal(potion.unpaid, true);
    unlinkObject(potion);
    await addObjectToContainer(chest, potion);
    potion.in_use = potion.bypass = true;

    await deleteObject(chest);

    assert.equal(chest.where, 'gone');
    // The billed content is preserved as a used-up bill identity, not
    // freed with its container.
    assert.equal(potion.where, 'onbill');
    assert.equal(potion.unpaid, false);
    assert.equal(!!potion.in_use, false);
    assert.equal(!!potion.bypass, false);
    const entry = resident.eshk.bill.find(candidate =>
        candidate.bo_id === potion.o_id);
    assert.ok(entry, 'the bill entry must survive container destruction');
    assert.equal(entry.useup, true);
    assert.ok(carriedShopBill(resident).some(item => item.object === potion));
});

for (const [name, type] of [['magic lamp', MAGIC_LAMP], ['oil lamp', OIL_LAMP]] as const) {
    void test(`deleting a lit ${name} removes its light before the next message`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        for (let x = 8; x <= 18; x++) {
            for (let y = 8; y <= 12; y++)
                game.level.requireAt(x, y).lit = false;
        }
        const lamp = await knownObject(type, { spe: 1, age: 200 });
        placeCreatedObject(lamp, 14, 10);
        beginObjectBurn(lamp);
        await pline('You look around.');
        assert.equal(cansee(13, 10), true);

        await deleteObject(lamp);
        await pline('You look around.');

        assert.equal(cansee(13, 10), false);
    });
}
