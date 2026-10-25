import assert from 'node:assert/strict';
import test from 'node:test';
import { dragBallDownStairs } from '../js/ball.js';
import { rhack } from '../js/cmd.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
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
// C ball.c:drag_down(): a loose ball left on the floor smacks into the
// descending hero before the ordinary tumbling damage.
void test('a surviving stair descent collision with the loose ball still costs blood', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    pushKeys(' '.repeat(30));
    await punishHero();
    initRng(1n);
    await rhack('>'.charCodeAt(0));
    assert.equal(game.level, destination);
    assert.ok(game.u.uhp < 1000, 'the ball collision and tumble both draw blood');
    assert.ok(game.u.uhp > 950);
    assert.ok(game.uball && game.uchain, 'the punishment survives the landing');
});
//# sourceMappingURL=ball_stair_message.test.js.map