import assert from 'node:assert/strict';
import test from 'node:test';
import { heroHasInvoluntaryDelay } from '../js/command_state.js';
import { POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('forced hurtling preserves the voluntary movement state and its starting square', async () => {
    freshObjectRoom({ right: 20 });
    game.u.umoved = false;
    game.u.ux0 = 9;
    game.u.uy0 = 10;
    await hurtleHero(1, 0, 2);
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.umoved, false, 'knockback alone must not trigger moving-only fumbling or exertion');
    assert.equal(game.u.ux0, 9, 'forced steps retain the start of the voluntary action');
    assert.equal(game.u.uy0, 10);
});
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
    installPagerInput(resetInputState(), { expected: /fall into the pool of water/, limit: 1 });
    await hurtleHero(1, 0, 1);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uinwater, 1);
    assert.equal(heroHasInvoluntaryDelay(), false);
});
//# sourceMappingURL=pool_hurtle_delay.test.js.map