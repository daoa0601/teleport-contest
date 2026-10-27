import test from 'node:test';
import assert from 'node:assert/strict';
import { continueRun } from '../js/cmd.js';
import { D_BROKEN, D_ISOPEN, D_NODOOR, DOOR, FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { startRun } from '../js/runmode.js';
import { freshObjectRoom } from './support/object-room.js';
// C hack.c:lookaround() skips open doorways when context.run is 8,
// even if context.travel is no longer set.
for (const doorway of [
    { name: 'open', mask: D_ISOPEN },
    { name: 'doorless', mask: D_NODOOR },
    { name: 'broken', mask: D_BROKEN },
]) {
    void test(`a repeat with live run value 8 crosses a doorway (${doorway.name})`, async () => {
        const level = freshObjectRoom();
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = doorway.mask;
        startRun(1, 0, game, 3);
        game.context.run = 8;
        const result = await continueRun();
        assert.equal(result.tookTime, true, 'the repeat takes its next step');
        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    });
}
void test('a repeat uses the live run value when it changes before the next step', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = FOUNTAIN;
    startRun(1, 0, game, 3);
    game.context.run = 0;
    const result = await continueRun();
    assert.equal(result.tookTime, true, 'walking continues onto the fountain');
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
});
//# sourceMappingURL=run_live_state.test.js.map