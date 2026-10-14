import assert from 'node:assert/strict';
import test from 'node:test';
import { dragBallDownStairs } from '../js/ball.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { punishHero } from '../js/punishment.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('descending with an iron ball acknowledges the fall before clearing the old map', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 }, gameplaySeed: 7 });
    requirePlayingGame(game);
    await punishHero(null, game);
    game._pending_message = '';
    await plineWithContinuation('You fall down the stairs.');
    const input = resetInputState();
    let acknowledgedFall = false;
    input.beforeRead = () => {
        const row = requireScreenRow(0).map(cell => cell.ch).join('');
        if (!acknowledgedFall) {
            assert.match(row, /^You fall down the stairs\.--More--/);
            assert.equal(game.u.uhp, 100);
            acknowledgedFall = true;
        }
        input.feed(' ');
    };
    await dragBallDownStairs();
    assert.equal(acknowledgedFall, true);
});
//# sourceMappingURL=ball_stair_message.test.js.map