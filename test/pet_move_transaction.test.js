import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { DAGGER, TRIPE_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C dogmove.c:dog_move() runs dog_invent() inside the pet's own movement
// transaction: the visible "picks up" line is awaited there, and
// obj_extract_self() plus mpickobj() follow it before the move returns.
// postmov() and the rest of dochug() may only run afterwards.
void test('a pet prints its pickup line and lifts the object inside its own move', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.edog.apport = 1;
    const dagger = await floorObject(DAGGER, 12, 10);
    const action = await runMonsterAction(dog, game, () => 0, count => count, () => 1);
    assert.ok(action.movement);
    assert.match(game._lastPlineMessage ?? '', /little dog picks up a .*dagger\./);
    assert.equal(dagger.where, 'minvent', 'mpickobj() ran inside the same move');
    assert.ok(dog.minvent.includes(dagger));
    assert.equal(game.level.objects[12]?.[10]?.length ?? 0, 0, 'the floor pile lost the dagger when the pet lifted it');
});
// C dogmove.c:dog_invent() -> dog_eat(): a pet standing on food consumes it
// within the same dog_move() call; only then may postmov() observe the
// changed floor pile.
void test('a pet standing on food consumes its meal inside its own move', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    const tripe = await floorObject(TRIPE_RATION, 12, 10);
    const action = await runMonsterAction(dog, game, limit => (limit > 1 ? 1 : 0), count => count, () => 1);
    assert.ok(action.movement);
    assert.equal(tripe.where, 'gone', 'dog_eat() ran inside the same move');
    assert.ok((dog.meating ?? 0) > 0, 'the pet started chewing');
    assert.equal(game.level.objects[12]?.[10]?.length ?? 0, 0);
});
//# sourceMappingURL=pet_move_transaction.test.js.map