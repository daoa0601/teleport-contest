import assert from 'node:assert/strict';
import test from 'node:test';
import { TT_WEB, WEB } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { setHeroTrap } from '../js/hero_traps.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { requireFixtureGame } from './support/game-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C zap.c:zap_over_floor(): a fire ray burns a web through delfloortrap(),
// which releases a trapped hero via trap.c:reset_utrap(TRUE) and reports
// "You can fly." after the burst message.
void test('a fire ray burning the web holding a flying hero sets it flying again', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    game.u.flyingTurns = 50;
    const { ux, uy } = game.u;
    addTrap(requireGameLevel(), WEB, ux, uy, { tseen: true });
    setHeroTrap(4, TT_WEB);
    assert.equal(game.u.flying, false, 'the web holds the hero down');

    await applyRayFloorFeatures('fire', ux, uy);

    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.flying, true);
    assert.equal(
        game._pending_message,
        'A web bursts into flames!  You can fly.',
    );
    assert.ok(!requireGameLevel().traps.some(trap =>
        trap.tx === ux && trap.ty === uy));
});
