// C cmd.c:set_move_cmd() runs for every plain movement command and clears
// context.travel/context.travel1.  A travel run interrupted after one step
// (for example the canned travel from #therecmdmenu toward an adjacent
// square whose direct diagonal is blocked, so the path detours) therefore
// never redirects the next movement key: 'b' after that step moves
// southwest, not toward the leftover travel destination.
import test from 'node:test';
import assert from 'node:assert/strict';
import { D_ISOPEN, DOOR, ROOM, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a movement key ignores an interrupted travel destination', async () => {
    // A room whose west wall has an open doorway at (10,11); the hero
    // stands in the doorway.  The square southwest of the doorway is open
    // floor, but the diagonal out of a doorway is blocked, so #therecmdmenu
    // there falls back to a canned travel whose first step goes west and
    // leaves the destination pending with the run already stopped.
    const level = freshPlayableRoom({ left: 8, right: 20, top: 8, bottom: 14, heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    for (let y = 9; y <= 13; y++) {
        if (y === 11)
            continue;
        level.requireAt(10, y).typ = VWALL;
    }
    level.requireAt(10, 11).typ = DOOR;
    level.requireAt(10, 11).doormask = D_ISOPEN;
    level.requireAt(9, 11).typ = ROOM;
    level.requireAt(9, 12).typ = ROOM;
    game.u.ux = 10;
    game.u.uy = 11;
    await runExtendedCommand('therecmdmenu', 'b');
    pushKeys('m');
    await rhack('m'.charCodeAt(0));
    assert.equal(game.u.ux, 9, 'the canned travel detours west out of the doorway');
    assert.equal(game.u.uy, 11);
    assert.ok(game.context.travel, 'the travel destination is still pending');
    pushKeys('b');
    await rhack('b'.charCodeAt(0));
    assert.equal(game.context.travel, false, 'set_move_cmd clears the interrupted travel destination');
    assert.deepEqual([game.u.ux, game.u.uy], [8, 12], 'the movement key moves the hero southwest, not toward the old destination');
});
void test('any command drops an interrupted travel destination', async () => {
    // C rhack() clears context.travel before dispatching every command
    // (cmd.c:3674), not just movement keys.
    const level = freshPlayableRoom({ left: 8, right: 20, top: 8, bottom: 14, heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    for (let y = 9; y <= 13; y++) {
        if (y === 11)
            continue;
        level.requireAt(10, y).typ = VWALL;
    }
    level.requireAt(10, 11).typ = DOOR;
    level.requireAt(10, 11).doormask = D_ISOPEN;
    level.requireAt(9, 11).typ = ROOM;
    level.requireAt(9, 12).typ = ROOM;
    game.u.ux = 10;
    game.u.uy = 11;
    await runExtendedCommand('therecmdmenu', 'b');
    pushKeys('m');
    await rhack('m'.charCodeAt(0));
    assert.ok(game.context.travel, 'the travel destination is still pending');
    await rhack('s'.charCodeAt(0));
    assert.equal(game.context.travel, false, 'rhack drops the interrupted travel destination for a search command');
    assert.equal(game.u.ux, 9, 'the search did not move the hero');
});
//# sourceMappingURL=movement_clears_interrupted_travel.test.js.map