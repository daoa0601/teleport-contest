import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGIC_PORTAL, TT_BURIEDBALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { LEASH } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { activateMagicPortal } from '../js/magic_portal.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { buryFloorObjectsAt } from '../js/buried_object.js';
import { punishHero } from '../js/punishment.js';
import { addTrap } from './support/level-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshConnectedLevels } from './support/connected-levels.js';
// C teleport.c:domagicportal() (1449-1451): a buried ball surfaces before
// the leashed-follower check, so a completed portal unearths the punishment
// instead of dragging it between levels.
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
// The unearthing precedes next_to_u() (teleport.c:1450 before 1453): a
// pet that cannot follow makes the hero shudder, but the ball still comes
// back up and no travel is scheduled.
void test('a buried ball still surfaces when a stuck leashed pet shudders the portal', async () => {
    const { source } = freshConnectedLevels();
    pushKeys(' '.repeat(200));
    const { ux, uy } = game.u;
    await punishHero();
    const ball = game.uball;
    assert.ok(ball, 'punishment supplies the ball');
    await buryFloorObjectsAt(ux, uy);
    assert.equal(game.u.utraptype, TT_BURIEDBALL);
    // A cursed leash on a pet with no reachable square beside the hero is
    // C's stuck follower (apply.c:904): mnexto() fails everywhere, and the
    // cursed leash blocks the slack release, so next_to_u() fails and the
    // portal shudders.
    const pet = await createMonsterAt('newt', 8, 8);
    pet.mleashed = 1;
    await addInventoryObject(LEASH, { cursed: true, leashmon: pet.m_id });
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            if ((x !== ux || y !== uy) && !(x === 8 && y === 8))
                await createMonsterAt('newt', x, y);
        }
    }
    const portal = addTrap(source, MAGIC_PORTAL, ux, uy, { dst: { dnum: 0, dlevel: 2 } });
    await activateMagicPortal(portal, gotoLevel);
    assert.equal(game.uball, ball, 'the buried ball surfaces even though the portal shuddered');
    assert.notEqual(game.u.utraptype, TT_BURIEDBALL);
    assert.equal(game._scheduledLevelChange === undefined, true, 'the shuddered portal schedules no travel');
    assert.equal(game.level === source, true);
});
//# sourceMappingURL=portal_buried_ball.test.js.map