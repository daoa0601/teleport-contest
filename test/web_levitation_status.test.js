import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { TT_WEB } from '../js/const.js';
import { bot } from '../js/botl.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { setHeroTrap } from '../js/trap.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
function statusLine() {
    const display = requireGameDisplay();
    return (display.grid[23] ?? []).map(cell => cell.ch).join('');
}
// C trap.c:set_utrap() (1041) ends in float_vs_flight(), which stores
// BLevitation|I_SPECIAL for a levitating hero caught in a web, so the
// status line hides Lev while the web holds (botl.c's Levitation reads
// the stored mask, youprop.h:240).
void test('a levitating hero shows Lev as soon as it disentangles itself from a web', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.levitationTurns = 50;
    setHeroTrap(1, TT_WEB, game);
    await bot();
    await flush_screen(1);
    assert.doesNotMatch(statusLine(), /\bLev\b/, 'the web holds the hero down');
    await rhack('l'.charCodeAt(0));
    await flush_screen(1);
    // The escape does not announce float_up(): C domove_core() opens with
    // carrying_too_much() -> weight_cap() (hack.c:2730), whose closing
    // float_vs_flight() (4342) has already set disp.botl; trapmove()'s raw
    // --u.utrap (1576) then prints "You disentangle yourself.", and that
    // pline's flush_screen() (pline.c:274, display.c:1339) runs bot() ->
    // near_capacity() -> weight_cap() with u.utrap already 0, whose
    // float_vs_flight() clears the stale hold.  reset_utrap() (trap.c:1047)
    // therefore reads was_Lev == TRUE and skips float_up()'s message; the
    // status line already shows Lev from that very bot().
    assert.equal(game._pending_message, 'You disentangle yourself.');
    assert.match(statusLine(), /\bLev\b/);
});
//# sourceMappingURL=web_levitation_status.test.js.map