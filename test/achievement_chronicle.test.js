// C insight.c:record_achievement(): every newly recorded achievement appends
// its achieve_msg[] line to the chronicle (livelog_printf -> gamelog_add) at
// the current turn, except during final disclosure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLogEvents } from '../js/gamelog.js';
import { game } from '../js/gstate.js';
import { requireFixtureGame } from './support/game-state.js';
import { resetInputState } from '../js/input.js';
import { checkSpecialRoom } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('entering a staffed shop chronicles the shop achievement', async () => {
    freshObjectRoom({ left: 3, right: 28, top: 3, bottom: 17 });
    requireFixtureGame(game);
    game.plname = 'Ada';
    resetInputState();
    await createStaffedShop({ left: 9, right: 13, top: 8, bottom: 12, keeperX: 12 });
    const turn = game.moves;
    game.u.ushops_entered = [...game.u.ushops];
    game.u.ushops = [];
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    await checkSpecialRoom();
    const events = gameLogEvents();
    assert.ok(events.some(entry => entry.turn === turn && entry.text === 'entered a shop'), `chronicle must hold the shop entry: ${JSON.stringify(events)}`);
    // record_achievement() does not duplicate a repeated achievement
    assert.equal(events.filter(entry => entry.text === 'entered a shop').length, 1);
});
//# sourceMappingURL=achievement_chronicle.test.js.map