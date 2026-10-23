import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGIC_PORTAL } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { activateMagicPortal } from '../js/magic_portal.js';
import { addTrap } from './support/level-state.js';
import { freshConnectedLevels } from './support/connected-levels.js';

void test('portal dizziness pages the activation message on the departure level', async () => {
    const { source, destination } = freshConnectedLevels();
    const portal = addTrap(source, MAGIC_PORTAL, 10, 10, { dst: { dnum: 0, dlevel: 2 } });
    addTrap(destination, MAGIC_PORTAL, 12, 10, { dst: { dnum: 0, dlevel: 1 } });
    await plineWithContinuation('You see here 2000 gold pieces.');
    const input = resetInputState();
    await activateMagicPortal(portal, gotoLevel);
    const operation = finishScheduledLevelChange();

    await input.waitUntilBlocked();
    assert.equal(game.level === source, true, 'the activation pager precedes destination construction and restoration');
    assert.equal(game.u.stunnedTurns, 3, 'the native stun is already active when the pre-travel message flushes');
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '',
        /You activated a magic portal!--More--/);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.equal(game.level === destination, true);
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '',
        /You feel slightly dizzy.--More--/);
    input.feed(' ');
    await operation;
});

void test('a hero knocked across a magic portal is carried to its destination', async () => {
    const { source, destination } = freshConnectedLevels();
    const portal = addTrap(source, MAGIC_PORTAL, game.u.ux + 1, game.u.uy, { dst: { dnum: 0, dlevel: 2 } });
    addTrap(destination, MAGIC_PORTAL, 12, 10, { dst: { dnum: 0, dlevel: 1 } });
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    // A knockback hurtle carries no level-change callback of its own.
    await hurtleHero(1, 0, 3);
    assert.equal(game.level === source, true, 'the portal defers the level change');
    assert.deepEqual([game.u.ux, game.u.uy], [portal.tx, portal.ty]);
    await finishScheduledLevelChange();

    assert.equal(game.level === destination, true);
    assert.equal(game.u.stunnedTurns, 3);
});
