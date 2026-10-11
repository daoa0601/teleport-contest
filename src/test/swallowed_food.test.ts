import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroArmor } from '../js/armor.js';
import { W_AMUL } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, FOOD_RATION, LEATHER_GLOVES, STATUE, TRIPE_RATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

async function swallowedBy(species: string) {
    freshObjectRoom({ hero: { uhitinc: 0, uluck: 0 }, context: { move: 0 } });
    requirePlayingGame(game);
    const engulfer = await createMonsterAt(species, 11, 10);
    engulfer.mx = game.u.ux;
    engulfer.my = game.u.uy;
    engulfer.mhp = engulfer.mhpmax = 40;
    game.u.uswallow = 1;
    game.u.ustuck = engulfer;
    initRng(7101n);
    return engulfer;
}

void test('food thrown inside a vortex enters its inventory without impact damage', async () => {
    const engulfer = await swallowedBy('energy vortex');
    const food = await addInventoryObject(FOOD_RATION, { quan: 3, quantity: 3 });

    await throwInventoryObject(food);

    assert.equal(engulfer.mhp, 40);
    assert.equal(food.quan, 2);
    assert.equal(food.where, 'inventory');
    const swallowed = engulfer.minvent.find(object => object.otyp === FOOD_RATION);
    assert.ok(swallowed);
    assert.equal(swallowed.quan, 1);
    assert.equal(swallowed.where, 'minvent');
    assert.equal(swallowed.carrierMid, engulfer.m_id);
    assert.equal(game.context.move, 1);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''),
        /food ration vanishes into the energy vortex's currents/);
});

void test('feeding a tame engulfer expels the hero and consumes its caught meal', async () => {
    const engulfer = await swallowedBy('purple worm');
    initializePet(engulfer);
    const food = await addInventoryObject(TRIPE_RATION);
    const input = resetInputState();
    installPagerInput(input, { expected: /regurgitated|purple worm catches|purple worm eats/, limit: 3 });

    await throwInventoryObject(food);

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.ok(engulfer.mx !== game.u.ux || engulfer.my !== game.u.uy);
    assert.equal(food.where, 'gone');
    assert.equal(engulfer.minvent.some(object => object.otyp === TRIPE_RATION), false);
    assert.ok((engulfer.meating ?? 0) > 0);
});

void test('food rejected by a busy engulfer lands at the impact square after expulsion', async () => {
    const engulfer = await swallowedBy('purple worm');
    requirePlayingGame(game);
    initializePet(engulfer);
    engulfer.meating = 5;
    const x = game.u.ux, y = game.u.uy;
    const food = await addInventoryObject(TRIPE_RATION);
    const input = resetInputState();
    installPagerInput(input, { expected: /regurgitated|tripe ration misses/, limit: 2 });

    await throwInventoryObject(food);

    assert.equal(game.u.uswallow, 0);
    assert.equal(food.where, 'floor');
    assert.ok(floorObjectsAt(game.level, x, y).includes(food));
    assert.equal(engulfer.minvent.includes(food), false);
    assert.equal(engulfer.meating, 5);
});

void test('a thrown cockatrice corpse petrifies an animal engulfer without entering its statue', async () => {
    const engulfer = await swallowedBy('purple worm');
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
    const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const input = resetInputState();
    installPagerInput(input, { expected: /^The purple worm turns to stone\.$/, limit: 1 });

    await throwInventoryObject(corpse);

    assert.equal(game.u.uswallow, 0);
    assert.equal(engulfer.dead, true);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(corpse.where, 'gone');
    const statue = floorObjects(game.level).find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(statue.corpsenm, MONSTER_NAME.indexOf('purple worm'));
    assert.equal(statue.contents?.some(object => object.otyp === CORPSE) ?? false, false);
    assert.equal(floorObjects(game.level).some(object => object.otyp === CORPSE), false);
});

void test('life saving keeps the animal engulfer alive and retains the thrown corpse', async () => {
    const engulfer = await swallowedBy('purple worm');
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
    const amulet = await equipMonsterObject(engulfer, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const input = resetInputState();
    installPagerInput(input, { expected: /purple worm|medallion|amulet|resuscitated/, limit: 5 });

    await throwInventoryObject(corpse);

    assert.equal(game.u.uswallow, 1);
    assert.ok(game.u.ustuck === engulfer);
    assert.ok(engulfer.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(corpse.where, 'minvent');
    assert.ok(engulfer.minvent.includes(corpse));
    assert.equal(corpse.carrierMid, engulfer.m_id);
    assert.equal(floorObjects(game.level).some(object => object.otyp === STATUE), false);
});

void test('a non-animal engulfer retains a petrifying corpse without turning to stone', async () => {
    const engulfer = await swallowedBy('energy vortex');
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
    const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });

    await throwInventoryObject(corpse);

    assert.equal(game.u.uswallow, 1);
    assert.equal(engulfer.mhp, 40);
    assert.equal(corpse.where, 'minvent');
    assert.ok(engulfer.minvent.includes(corpse));
    assert.equal(corpse.carrierMid, engulfer.m_id);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''),
        /The cockatrice corpse vanishes into the energy vortex's currents/);
});
