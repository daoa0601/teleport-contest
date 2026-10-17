import { clearBypasses } from '../js/object_bypass.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { punishHero } from '../js/punishment.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('turn cleanup clears bypasses on a swallowed hero’s floating ball and chain', async () => {
    freshObjectRoom();
    await installSwallowedHero(await createMonsterAt('purple worm', 11, 10));
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    ball.bypass = chain.bypass = true;
    game.context.bypasses = true;

    clearBypasses();

    assert.equal(ball.bypass, false);
    assert.equal(chain.bypass, false);
    assert.equal(game.context.bypasses, false);
});
