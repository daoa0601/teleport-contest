import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { TT_PIT } from '../js/const.js';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroTrap } from '../js/hero_traps.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
void test('running out of a pit displays the elapsed escape turn before continuing', async () => {
    const input = freshTurnRoom({ moves: 6, flags: { time: true } });
    setHeroTrap(2, TT_PIT);
    await bot();
    input.feed('L');
    await moveloop_core();
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.utrap, 0);
    assert.equal(game.moves, 8);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:8\b/);
});
//# sourceMappingURL=trap_escape_status.test.js.map