import assert from 'node:assert/strict';
import test from 'node:test';
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
