import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { dodown, doup } from '../js/do.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
// C do.c:doup() (do.c:1313-1315): with no up stairway under the hero the
// command refuses with "You_cant("go up here.")" and takes no time
// (ECMD_OK), before any steed, encumbrance or exit confirmation check.
void test("doup refuses without an up stairway and takes no time", async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    resetInputState();
    game._pending_message = '';
    const spentTurn = await doup();
    assert.match(game._pending_message ?? '', /You can't go up here\./);
    assert.equal(spentTurn, false);
    assert.equal(game.context.move, 0);
});
// C do.c:dodown() (do.c:1224-1240): away from any down stairway, seen
// pit, hole or trap door, and with no pick-axe autodig request, the
// command refuses with "You_cant("go down here%s.")" and takes no time
// (ECMD_OK); the level is left untouched.
void test("dodown refuses away from any down stairway and takes no time", async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    resetInputState();
    assert.ok(game.stairs);
    game.stairs.sx = 5;
    game._pending_message = '';
    const spentTurn = await dodown();
    assert.match(game._pending_message ?? '', /You can't go down here\./);
    assert.equal(spentTurn, false);
    assert.equal(game.context.move, 0);
    assert.ok(game.level === source);
});
//# sourceMappingURL=do_stairs_commands.test.js.map