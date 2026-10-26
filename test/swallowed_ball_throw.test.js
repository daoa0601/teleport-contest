import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { IRON_CHAIN, HEAVY_IRON_BALL } from '../js/object_data.js';
import { MM_NOGRP, NO_MINVENT, W_BALL, W_CHAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { placeCreatedObject } from '../js/floor_object.js';
// C dothrow.c swallowit() (1466-1474) never hands the chained ball to the
// engulfer: throwing the carried attached ball while swallowed hits the
// engulfer, then the ball stays with the punished hero at her position.
void test('a swallowed hero throwing the attached iron ball keeps it chained', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    const ball = await addInventoryObject(HEAVY_IRON_BALL, { owornmask: W_BALL });
    const chain = await knownObject(IRON_CHAIN, { owornmask: W_CHAIN });
    placeCreatedObject(chain, game.u.ux, game.u.uy);
    game.uball = game.u.uball = ball;
    game.uchain = game.u.uchain = chain;
    game.u.punished = true;
    const vortex = await createMonsterAt('steam vortex', 10, 10, MM_NOGRP | NO_MINVENT);
    vortex.mhp = 60;
    vortex.mhpmax = 60;
    await installSwallowedHero(vortex);
    input.feed(`t${ball.invlet}l`);
    await rhack(0);
    assert.ok(vortex.mhp < 60, 'the guaranteed engulfed hit must land');
    assert.equal(vortex.minvent?.length ?? 0, 0, 'swallowit never picks up the chained ball');
    assert.equal(game.uball, ball, 'the hero stays punished');
    assert.equal(ball.where, 'free');
    assert.deepEqual([ball.ox, ball.oy], [game.u.ux, game.u.uy], 'throwit parks the ball on the hero (dothrow.c:1569-1573)');
});
// C thitmonst's ball branch returns early for the chained ball when it kills
// the engulfer (dothrow.c:2239-2241) and xkilled() skips its mpickobj
// (mon.c:3526-3538): expulsion's placebc() keeps the ball with the hero.
void test('a swallowed hero killing the engulfer with the attached iron ball keeps it', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    const ball = await addInventoryObject(HEAVY_IRON_BALL, { owornmask: W_BALL });
    const chain = await knownObject(IRON_CHAIN, { owornmask: W_CHAIN });
    placeCreatedObject(chain, game.u.ux, game.u.uy);
    game.uball = game.u.uball = ball;
    game.uchain = game.u.uchain = chain;
    game.u.punished = true;
    const vortex = await createMonsterAt('steam vortex', 10, 10, MM_NOGRP | NO_MINVENT);
    vortex.mhp = 1;
    vortex.mhpmax = 1;
    await installSwallowedHero(vortex);
    input.feed(`t${ball.invlet}l    `);
    await rhack(0);
    assert.equal(vortex.mhp <= 0, true, 'the weak engulfer must die');
    assert.equal(vortex.minvent?.includes(ball) ?? false, false, 'xkilled never takes the chained ball');
    assert.equal(game.uball, ball, 'the hero stays punished');
    assert.equal(ball.where, 'floor', 'expulsion placebc() puts the ball back on the map');
});
//# sourceMappingURL=swallowed_ball_throw.test.js.map