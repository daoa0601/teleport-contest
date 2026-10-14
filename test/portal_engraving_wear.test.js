import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DUST, MAGIC_PORTAL } from '../js/const.js';
import { makeEngravingAt, engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
void test('stepping into a portal wears departure dust before leaving the level', async () => {
    const { source, destination } = freshConnectedLevels();
    addTrap(source, MAGIC_PORTAL, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
    addTrap(destination, MAGIC_PORTAL, 12, 10, { dst: { dnum: 0, dlevel: 1 } });
    makeEngravingAt(10, 10, 'X', null, game.moves, DUST);
    pushKeys(' '.repeat(10));
    await rhack('l'.charCodeAt(0));
    await finishScheduledLevelChange();
    assert.equal(engravingAt(10, 10, source), null);
    assert.equal(game.level, destination);
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 10);
});
//# sourceMappingURL=portal_engraving_wear.test.js.map