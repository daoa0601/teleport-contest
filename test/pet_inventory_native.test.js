import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { beginMonsterMove, commitPetPickup } from '../js/monmove.js';
import { BAG_OF_HOLDING } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const prize of ['mines', 'sokoban']) {
    void test(`a pet leaves the unclaimed ${prize} prize on the floor`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        initializePet(dog);
        const bag = await floorObject(BAG_OF_HOLDING, 11, 10, { initialize: false });
        game.context.achieveo = prize === 'mines'
            ? { mines_prize_oid: bag.o_id } : { soko_prize_oid: bag.o_id };
        const action = await beginMonsterMove(dog, game, () => 0, count => count, () => 1);
        await commitPetPickup(dog, action.movement, game);
        assert.equal(bag.where, 'floor');
        assert.equal(dog.minvent.includes(bag), false);
    });
}
//# sourceMappingURL=pet_inventory_native.test.js.map