import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGIC_PORTAL, TT_BURIEDBALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { activateMagicPortal } from '../js/magic_portal.js';
import { buryFloorObjectsAt } from '../js/buried_object.js';
import { punishHero } from '../js/punishment.js';
import { addTrap } from './support/level-state.js';
import { freshConnectedLevels } from './support/connected-levels.js';
// C teleport.c:domagicportal() (1449-1451): a buried ball surfaces before
// the leashed-follower check, so even a shuddered or completed portal
// travel unearths the punishment instead of dragging it between levels.
void test('a magic portal surfaces a buried ball before travelling', async () => {
    const { source, destination } = freshConnectedLevels();
    pushKeys(' '.repeat(200));
    const { ux, uy } = game.u;
    await punishHero();
    const ball = game.uball;
    assert.ok(ball, 'punishment supplies the ball');
    await buryFloorObjectsAt(ux, uy);
    assert.equal(game.uball, null, 'the ball is buried before the portal is used');
    assert.equal(game.u.utraptype, TT_BURIEDBALL);
    const portal = addTrap(source, MAGIC_PORTAL, ux, uy, { dst: { dnum: 0, dlevel: 2 } });
    await activateMagicPortal(portal, gotoLevel);
    assert.equal(game.uball, ball, 'the portal unearths the buried ball');
    assert.notEqual(game.u.utraptype, TT_BURIEDBALL, 'unearthing releases the buried-ball trap');
    await finishScheduledLevelChange();
    assert.equal(game.level === destination, true, 'the portal still travels');
});
//# sourceMappingURL=portal_buried_ball.test.js.map