import assert from 'node:assert/strict';
import test from 'node:test';
import { heroHasInvoluntaryDelay } from '../js/command_state.js';
import { POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a knockback cannot shorten an existing sleep', async () => {
    freshObjectRoom({ right: 20 });
    putHeroToSleep(8);
    await hurtleHero(1, 0, 1);
    assert.equal(game.u.ux, 11);
    assert.equal(game._helplessTurns, 8);
    assert.equal(game._helplessReason, 'moving through the air');
    assert.equal(game._helplessDoneMessage, '');
});
void test('a second knockback cannot shorten time already spent moving through the air', async () => {
    freshObjectRoom({ right: 20 });
    await hurtleHero(1, 0, 2);
    await hurtleHero(1, 0, 1);
    assert.equal(game.u.ux, 13);
    assert.equal(game._helplessTurns, 2);
});
void test('hurtling into water releases a swimming hero from the movement delay', async () => {
    const level = freshObjectRoom({ hero: { swimming: true } });
    level.requireAt(11, 10).typ = POOL;
    await hurtleHero(1, 0, 1);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uinwater, 1);
    assert.equal(heroHasInvoluntaryDelay(), false);
});
//# sourceMappingURL=pool_hurtle_delay.test.js.map