import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { advanceHeroSliming } from '../js/slime.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';

void test('an already green slime form survives a forced sliming timeout', async () => {
    freshObjectRoom();
    installPolymorphedHero('green slime');
    game.u.slimed = true;
    game.u.slimedTurns = 1;

    const result = await advanceHeroSliming({
        transform: () => { assert.fail('An existing slime must not transform again'); },
        die: () => { assert.fail('An existing slime must not die from the slime timeout'); },
    });

    assert.equal(result.died, false);
    assert.equal(game.u.slimedTurns, 0);
    assert.equal(game.u.slimed, false);
});
