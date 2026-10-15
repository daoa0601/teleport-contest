import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NEED_WEAPON, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove, commitPetPickup } from '../js/monmove.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a weapon-using pet readies a fetched weapon before it can drop it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(goblin);
    goblin.weaponCheck = NEED_WEAPON;
    const dagger = await floorObject(DAGGER, 11, 10);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    const action = await beginMonsterMove(goblin, game, () => 0, count => count, () => 1);
    await commitPetPickup(goblin, action.movement, game);
    assert.equal(dagger.where, 'minvent');
    assert.ok(goblin.mw === dagger, 'the pet must wield the weapon it fetched');
});
//# sourceMappingURL=pet_pickup_weapon.test.js.map