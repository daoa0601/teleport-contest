import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGIC_PORTAL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { gotoLevel } from '../js/level_change.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
for (const previous of [{ dnum: 0, dlevel: 2 }, { dnum: 1, dlevel: 1 }]) {
    void test(`landing from ${previous.dnum}:${previous.dlevel} does not immediately reactivate a portal`, async () => {
        const { source } = freshConnectedLevels();
        requirePlayingGame(game);
        game.u.uz0 = previous;
        const portal = addTrap(source, MAGIC_PORTAL, 10, 10, { dst: { dnum: 0, dlevel: 2 } });
        await triggerHeroTrap(portal, { gotoLevel });
        assert.equal(game._scheduledLevelChange, undefined);
        assert.equal(game.u.stunnedTurns ?? 0, 0);
        assert.doesNotMatch(game._pending_message || '', /activated a magic portal/);
    });
}
//# sourceMappingURL=magic_portal_landing.test.js.map