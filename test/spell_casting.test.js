import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { P_SKILLED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { SPE_HASTE_SELF } from '../js/object_data.js';
import { castSpell } from '../js/spell.js';
import { learnSpell } from './support/spells.js';
import { freshCasterRoom } from './support/hero-state.js';
void test('haste self makes the hero very fast without asking for a direction', async () => {
    freshCasterRoom({ gameplaySeed: 701n });
    requirePlayingGame(game);
    await learnSpell(SPE_HASTE_SELF, { skill: P_SKILLED });
    await castSpell(SPE_HASTE_SELF);
    assert.equal(game.u.veryFast, true);
    assert.ok(game.u.veryFastTurns != null, 'Expected game.u.veryFastTurns to be initialized');
    assert.ok(game.u.veryFastTurns >= 160);
    assert.ok(game.u.veryFastTurns <= 169);
    assert.equal(game.u.uen, 25);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=spell_casting.test.js.map