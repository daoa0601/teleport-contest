import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, TIMEOUT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { floatHeroDown } from '../js/terrain_movement.js';
import { runExtendedCommand } from './support/commands.js';
import { requireFixtureGame } from './support/game-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
function recordMessages(messages) {
    const input = resetInputState();
    installPagerInput(input, {
        expected: /pony|water|sink|thunder|crawl|Pheew/,
        limit: 20,
    });
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
}
// C trap.c drown(): after the teleport attempt, a mounted hero dismounts
// (DISMOUNT_GENERIC).  A pony cannot survive the pool, so steed.c
// dismount_steed() kills it with the hero's blame and leaves the hero in
// place; its closing float_down() re-enters drown(), and the hero crawls
// out unmounted.
void test('a riding hero who floats down into water loses the drowning steed', async () => {
    freshTurnRoom({ role: 'knight', heroLevel: 30 });
    requireFixtureGame(game);
    game.flags.debug = true;
    const messages = [];
    recordMessages(messages);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'ly');
    assert.equal(game.u.usteed, pony);
    await flushPendingTopline();
    messages.length = 0;
    const { ux, uy } = game.u;
    game.level.requireAt(ux, uy).typ = POOL;
    game.u.levitationTurns = 5;
    await floatHeroDown(TIMEOUT, 0);
    await flushPendingTopline();
    assert.equal(game.u.usteed, null, 'the hero no longer rides the pony');
    assert.ok(pony.dead || pony.mhp <= 0, 'the pony drowned');
    assert.notDeepEqual([game.u.ux, game.u.uy], [ux, uy], 'the hero crawled out');
    assert.ok(!game.program_state?.gameover);
    assert.deepEqual(messages, [
        'You fall into the pool of water!  You sink like a rock.',
        'The saddled pony falls into the water!',
        'You kill the poor saddled pony!',
        'You hear the rumble of distant thunder...',
        'You fall into the pool of water!  You sink like a rock.',
        'You try to crawl out of the water.  Pheew!  That was close.',
    ]);
});
//# sourceMappingURL=steed_drowning.test.js.map