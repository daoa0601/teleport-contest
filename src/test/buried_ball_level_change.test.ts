import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPagerInput } from './support/pager-input.js';
import { installHeroChainedToBuriedBall } from './support/hero-state.js';

// C do.c:1594: goto_level() converts a buried-ball tether back into ordinary
// ball-and-chain punishment before the departing level is saved.  Leaving the
// level any other way would strand the ball underground forever.
void test('descending with a buried ball tether restores the punishment', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    const ball = await installHeroChainedToBuriedBall({ x: 10, y: 10 });
    game.u.uhp = game.u.uhpmax = 500; // survive the dragged iron ball
    installPagerInput(resetInputState(), {
        expected: /descend|fall|ball|chain|stair/,
        limit: 6,
    });

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === destination, 'the hero descended the stairway');
    assert.equal(game.uball, ball, 'the buried ball rejoined the hero as punishment');
    assert.equal((source.buriedObjects ?? []).includes(ball), false,
        'the ball did not stay behind in the ground');
    assert.equal(game.u.utrap ?? 0, 0, 'the tether trap ended');
});
