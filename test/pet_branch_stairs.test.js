import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, STAIRS } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
void test('a whistled pet stays beside its master on branch stairs without needing a food lure', async () => {
    const level = freshObjectRoom({ left: 10, right: 12, top: 10, bottom: 10 });
    level.requireAt(10, 10).typ = STAIRS;
    game.stairs = { sx: 10, sy: 10, up: false, isladder: false,
        tolev: { dnum: 1, dlevel: 1 }, next: null, u_traversed: false };
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.edog.whistletime = game.moves;
    dog.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /dog/, limit: 2 });
    await finishAtCommandInput(input, moveloop_core, /^$/);
    assert.equal(dog.mx, 11, 'A recently called pet should remain ready to follow down the stairs');
    assert.equal(dog.my, 10);
});
//# sourceMappingURL=pet_branch_stairs.test.js.map