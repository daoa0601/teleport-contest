// C hack.c:test_move() obstacle feedback: the raised drawbridge, Sokoban's
// unphaseable walls, the amorphous ooze failure, and the mounted door bump.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DBWALL, D_CLOSED, DOOR, VWALL, W_NONPASSWALL } from '../js/const.js';
import { ORCISH_HELM } from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { installPagerInput } from './support/pager-input.js';
void test('moving into a raised drawbridge reports the closed bridge', async () => {
    const level = freshObjectRoom({ flags: { autoopen: false } });
    const gate = level.requireAt(11, 10);
    gate.typ = DBWALL;
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, 'That drawbridge is up!');
});
void test('a phasing hero cannot enter Sokoban unphaseable walls', async () => {
    const level = freshObjectRoom({ flags: { autoopen: false } });
    const wall = level.requireAt(11, 10);
    wall.typ = VWALL;
    wall.wall_info = W_NONPASSWALL;
    level.flags.sokoban_rules = true;
    installPolymorphedHero('xorn');
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, 'The Sokoban walls resist your ability.');
});
void test('an amorphous hero with unsqueezable possessions fails to ooze under a door', async () => {
    const level = freshObjectRoom({ flags: { autoopen: false } });
    const door = level.requireAt(11, 9);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    installPolymorphedHero('black pudding');
    await addInventoryObject(ORCISH_HELM);
    initRng(1n);
    await rhack('u'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(door.doormask, D_CLOSED);
    assert.equal(game._pending_message, "You try to ooze under the door, but can't squeeze your possessions through.");
});
void test('a fumbling rider cannot lead the steed through a closed door', async () => {
    const level = freshObjectRoom({
        role: 'knight',
        flags: { autoopen: false, pickup: false },
    });
    installPagerInput(resetInputState(), {
        expected: /mount|lead|door/,
        limit: 8,
    });
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    const door = level.requireAt(game.u.ux + 1, game.u.uy);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    game.u.fumblingTurns = 10;
    initRng(1n);
    const x = game.u.ux, y = game.u.uy;
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [x, y]);
    assert.equal(door.doormask, D_CLOSED);
    assert.equal(game._pending_message, "You can't lead your pony through that closed door.");
});
//# sourceMappingURL=test_move_wall_feedback.test.js.map