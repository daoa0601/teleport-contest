import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { TT_WEB } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroTrap } from '../js/hero_traps.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

// C hack.c:trapmove() zeroes u.utrap with a bare field write and relies on
// domove()'s reset_utrap(TRUE) to end the trap, so the was-flying snapshot is
// taken while flight is still blocked by the web; trap.c:reset_utrap() then
// reports "You can fly." right after the disentangling message.
void test('a flying hero can fly again as soon as it disentangles itself from a web', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.flyingTurns = 50;
    setHeroTrap(1, TT_WEB);
    await bot();
    await flush_screen(1);
    assert.equal(game.u.flying, false, 'the web holds the hero down');

    await rhack('l'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(
        game._pending_message,
        'You disentangle yourself.  You can fly.',
    );
    assert.equal(game.u.flying, true);
    assert.equal(game.u.utrap, 0);
});
