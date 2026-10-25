import test from 'node:test';
import assert from 'node:assert/strict';
import { PIT, TT_PIT, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { GRAPPLING_HOOK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
// C apply.c:3857-3859: after the yank hurtle, use_grapple() runs
// spoteffects(TRUE), so the landing square triggers its trap.
void test('a hook yank onto an unseen pit drops the hero into it', async () => {
    freshObjectRoom();
    const hook = await addInventoryObject(GRAPPLING_HOOK, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = hook;
    installHeroWeaponSkills({});
    assert.ok(game.level);
    addTrap(game.level, PIT, 11, 10);
    game._travelTipShown = true;
    initRng(203n);
    await applyInventoryObject(hook, 'll. ');
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
    assert.match(game._pending_message, /You fall into a pit!/);
});
//# sourceMappingURL=grapple_yank_landing_trap.test.js.map