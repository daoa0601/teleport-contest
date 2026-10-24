import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGIC_PORTAL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { installPagerInput } from './support/pager-input.js';

// C do.c:1730-1741: when a portal arrival cannot find its corresponding
// magic portal on the destination (the quest-expelled case, or a wizard
// transplant), goto_level() falls back to u_on_rndspot(0) — the down-teleport
// region, not the up one.
void test('a portal arrival without its matching portal lands in the down-teleport region', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.u.uz0 = { dnum: 0, dlevel: 1 };
    const portal = addTrap(source, MAGIC_PORTAL, game.u.ux, game.u.uy, {
        dst: { dnum: 0, dlevel: 2 },
    });
    destination.upTeleportRegion = { lx: 11, ly: 10, hx: 11, hy: 10 };
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    installPagerInput(resetInputState(), { expected: /portal|dizzy/, limit: 4 });

    await triggerHeroTrap(portal, { gotoLevel });
    await finishScheduledLevelChange();

    assert.ok(game.level === destination, 'the portal reached its destination');
    assert.equal(game.u.ux, 13, 'the fallback arrival uses the down region');
    assert.equal(game.u.uy, 10);
});
