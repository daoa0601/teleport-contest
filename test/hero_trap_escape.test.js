import assert from 'node:assert/strict';
import test from 'node:test';
import { PIT, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a known pit can be escaped without losing health or becoming trapped', async () => {
    let escaped = false;
    for (let seed = 1; seed <= 20 && !escaped; seed++) {
        const level = freshObjectRoom();
        const trap = addTrap(level, PIT, 10, 10, { tseen: true });
        resetInputState().feed(' '.repeat(10));
        initRng(seed);
        await triggerHeroTrap(trap);
        escaped = !game.u.utrap;
        if (escaped) {
            assert.equal(game.u.uhp, 40);
            assert.match(game._pending_message, /You escape a pit\./);
        }
    }
    assert.ok(escaped, 'known pits allow a one-in-five escape');
});
void test('a forced known pit still traps the hero', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const trap = addTrap(level, PIT, 10, 10, { tseen: true });
    resetInputState().feed(' '.repeat(10));
    await triggerHeroTrap(trap, { forceTrap: true });
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok(game.u.uhp < 40);
});
//# sourceMappingURL=hero_trap_escape.test.js.map