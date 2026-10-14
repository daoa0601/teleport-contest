import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { throwMonsterProjectile } from '../js/monster_throw.js';
import { ELVEN_DAGGER } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('seeing an unnamed missile in flight does not prevent stacking it with an unrecognized weapon', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const elf = await createMonsterAt('Grey-elf', 12, 10, MM_NOGRP | NO_MINVENT);
    elf.minvis = true;
    const original = await floorObject(ELVEN_DAGGER, 14, 10, { dknown: false });
    const missile = await knownObject(ELVEN_DAGGER, { dknown: true });
    await addObjectToMonsterInventory(elf, missile);

    await throwMonsterProjectile(elf, missile, { state: game, dx: 1, dy: 0, range: 2 });

    const pile = floorObjectsAt(level, 14, 10);
    assert.equal(pile.length, 1, 'the unseen thrower leaves a compatible unrecognized dagger');
    const stack = pile[0];
    assert.ok(stack);
    assert.equal(stack.quan, 2);
    assert.equal(stack.dknown, false);
});
