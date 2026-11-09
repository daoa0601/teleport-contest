import assert from 'node:assert/strict';
import test from 'node:test';
import { HWALL, PARANOID_TRAP, SLP_GAS_TRAP } from '../js/const.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';
// C hack.c avoid_trap_andor_region() gates both paranoid prompts with
// test_move(u.ux, u.uy, u.dx, u.dy, TEST_MOVE) (hack.c:2490-2505 for the
// region branch, hack.c:2515-2533 for the trap branch): a known trap is
// only worth confirming when the move itself is viable.  A seen trap under
// a wall (a debug terrain change can produce one) fails test_move(), so
// the hero is never asked to confirm stepping onto it; a seen trap on open
// floor is still confirmed.
void test('paranoid trap prompt follows test_move viability', async () => {
    const input = freshTurnRoom();
    game.flags.paranoia_bits = PARANOID_TRAP;
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const blocked = addTrap(game.level, SLP_GAS_TRAP, ux + 1, uy);
    blocked.tseen = true;
    game.level.requireAt(ux + 1, uy).typ = HWALL;
    input.feed('l');
    await moveloop_core();
    const afterBlockedStep = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trim() ?? '';
    assert.ok(!afterBlockedStep.includes('Really'), `no trap prompt for the walled square, got: ${afterBlockedStep}`);
    const viable = addTrap(game.level, SLP_GAS_TRAP, ux - 1, uy);
    viable.tseen = true;
    input.feed('h');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        const prompt = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trim() ?? '';
        assert.ok(prompt.includes('Really step onto that'), `trap prompt expected for the open square, got: ${prompt}`);
    }
    finally {
        input.feed('n');
        await action;
    }
});
//# sourceMappingURL=paranoid_trap_viability.test.js.map