import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { moveObject } from '../js/floor_object.js';
import { resetInputState } from '../js/input.js';
import { unlinkObject } from '../js/object_location.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
// C ball.c:drag_ball() case 8: the hero ends two squares diagonally from the
// ball, so the chain is seated at the midpoint between them without dragging
// the ball and without costing extra time.
void test('a two-space diagonal step seats the chain at the midpoint', async () => {
    const level = freshObjectRoom({
        heroX: 9, heroY: 9, flags: { pickup: false, verbose: true },
    });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball/i, limit: 5,
    });
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 8, 8);
    await moveObject(chain, 8, 8);
    initRng(11n);
    await rhack('n'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(chain.ox, 9, 'the chain takes the diagonal midpoint');
    assert.equal(chain.oy, 9);
    assert.equal(ball.ox, 8, 'the ball stays within chain reach');
    assert.equal(ball.oy, 8);
    assert.ok(floorObjectsAt(level, 9, 9).includes(chain));
    assert.ok(!floorObjectsAt(level, 9, 9).includes(ball));
    assert.equal(game._helplessTurns ?? 0, 0, 'a chain-only move never imposes the dragging delay');
});
// C ball.c:drag_ball() case 5: the hero ends a knight's move from the ball;
// the chain takes whichever of the two between squares is closer to it.
void test('a diagonal squeeze pulls the chain to the nearer between square', async () => {
    freshObjectRoom({ heroX: 9, heroY: 9, flags: { pickup: false, verbose: true } });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball/i, limit: 5,
    });
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 8, 8);
    await moveObject(chain, 8, 8);
    initRng(11n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 9);
    assert.deepEqual([chain.ox, chain.oy], [9, 8], 'the chain stays beside the ball, closer than the hero vacated diagonal');
    assert.deepEqual([ball.ox, ball.oy], [8, 8]);
    assert.equal(game._helplessTurns ?? 0, 0);
});
// C ball.c:drag_ball(): when the destination already touches the chain,
// nothing is moved at all and the pair keeps its squares under the hero.
void test('stepping next to the chain leaves both attachments in place', async () => {
    const level = freshObjectRoom({
        heroX: 10, heroY: 10, flags: { pickup: false, verbose: true },
    });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball/i, limit: 5,
    });
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 10, 8);
    await moveObject(chain, 10, 9);
    initRng(11n);
    await rhack('k'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 9]);
    assert.ok(floorObjectsAt(level, 10, 9).includes(chain), 'the hero may share the chain square');
    assert.deepEqual([ball.ox, ball.oy], [10, 8]);
    assert.deepEqual([chain.ox, chain.oy], [10, 9]);
    assert.equal(game._helplessTurns ?? 0, 0);
});
// C ball.c:drag_ball() carried(uball) path: a carried ball never drags, but
// the chain hops to the hero's previous square once it is more than one step
// behind, and that never costs extra time or requires capacity.
void test('a carried ball lets the chain trail one square behind the hero', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10, flags: { pickup: false, verbose: true } });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball/i, limit: 5,
    });
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    unlinkObject(ball);
    await addInventoryItem(ball);
    initRng(11n);
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([chain.ox, chain.oy], [10, 10], 'the chain stays while the hero is still adjacent to it');
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.deepEqual([chain.ox, chain.oy], [11, 10], 'the chain follows to the square the hero just left');
    assert.equal(ball.where, 'inventory');
    assert.equal(game._helplessTurns ?? 0, 0);
});
// C ball.c:drag_ball() drag label water branch: a chain over a pool that is
// not a mere continuation of the ball's water jerks the hero back onto the
// chain square and drags the ball onto it as well.
void test('a pool under the chain jerks the hero back into the water', async () => {
    const level = freshObjectRoom({
        heroX: 10, heroY: 10, flags: { pickup: false, verbose: true },
    });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball|jerked/i, limit: 5,
    });
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 8, 10);
    await moveObject(chain, 9, 10);
    level.requireAt(9, 10).typ = POOL;
    game.u.waterWalking = true;
    initRng(11n);
    await rhack('l'.charCodeAt(0));
    assert.match(game._last_message, /You are jerked back by the iron ball!/);
    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.deepEqual([ball.ox, ball.oy], [9, 10]);
    assert.deepEqual([chain.ox, chain.oy], [9, 10]);
    assert.ok(floorObjectsAt(level, 9, 10).includes(ball));
    assert.ok(!game.u.uinwater, 'water walking keeps the hero above the pool');
    assert.equal(game.context.move, 1, 'being jerked back spends the move');
});
//# sourceMappingURL=ball_drag_geometry.test.js.map