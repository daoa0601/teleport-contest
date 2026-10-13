import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEMADE_TIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, TIN, TINNING_KIT } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a blessed tinning kit preserves one carried corpse as a known homemade tin', async () => {
    freshPlayableRoom();
    const kit = await addInventoryObject(TINNING_KIT, { blessed: true, spe: 2 });
    const species = MONSTER_NAME.indexOf('newt');
    const corpse = await addInventoryObject(CORPSE, { corpsenm: species, quan: 2 });

    await applyInventoryObject(kit, corpse.invlet);

    const tin = game.inventory.find(object => object.otyp === TIN);
    assert.ok(tin);
    assert.equal(tin.corpsenm, species);
    assert.equal(tin.blessed, true);
    assert.equal(tin.known, true);
    assert.equal(tin.spe, -(HOMEMADE_TIN + 1));
    assert.equal(corpse.quan, 1);
    assert.equal(kit.spe, 1);
    assert.equal(game.context.move, 1);
});

void test('a tinning kit offers a corpse underfoot and uses one from the floor stack', async () => {
    freshPlayableRoom();
    const kit = await addInventoryObject(TINNING_KIT, { spe: 2 });
    const corpse = await floorObject(CORPSE, game.u.ux, game.u.uy, { corpsenm: MONSTER_NAME.indexOf('newt'), quan: 2 });

    await applyInventoryObject(kit, 'y');

    assert.equal(corpse.quan, 1);
    assert.equal(corpse.where, 'floor');
    assert.ok(game.inventory.some(object => object.otyp === TIN));
    assert.equal(kit.spe, 1);
});

void test('an empty tinning kit takes time without selecting or consuming a corpse', async () => {
    freshPlayableRoom();
    const kit = await addInventoryObject(TINNING_KIT, { spe: 0 });

    await applyInventoryObject(kit);

    assert.equal(game._pending_message, 'You seem to be out of tins.');
    assert.equal(game.context.move, 1);
});
