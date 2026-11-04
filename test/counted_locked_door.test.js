import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun } from '../js/hack.js';
import { rhack } from '../js/cmd.js';
import { A_CON, A_DEX, A_STR, DOOR, D_LOCKED } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
// C hack.c:1098-1111: when autounlock has nothing to offer, doopen_indir()
// leaves the door locked and test_move() reports door_opened FALSE, so
// domove_core() resets context.move and calls nomul(0) (hack.c:2841-2847):
// a counted walk into the locked door stops after its first attempt
// instead of retrying every remaining step.
void test('a counted walk into a locked door stops after one attempt', async () => {
    const input = freshTurnRoom({ flags: { autoopen: true } });
    const door = requireGameLevel().requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    input.feed('5l');
    await rhack(0);
    await flush_screen(1);
    const screen = () => requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen(), /This door is locked\./);
    assert.equal(door.doormask, D_LOCKED, 'the door never opened');
    assert.equal(game.u.ux, 10);
    // nomul(0) ended the count; no further step retries the locked door.
    assert.equal(game.multi, 0);
    assert.equal((await continueRun()).tookTime, false);
    assert.doesNotMatch(screen(), /This door is locked\..*This door is locked\./s);
});
//# sourceMappingURL=counted_locked_door.test.js.map