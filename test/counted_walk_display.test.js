import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { bot } from '../js/botl.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
// C domove_core() reaches runmode_delay_output() for counted walks too.
// The displayed time can still precede moves after travel suppressed it.
for (const { runmode, turn, refresh } of [
    { runmode: 'walk', turn: 2, refresh: true },
    { runmode: 'crawl', turn: 2, refresh: true },
    { runmode: 'leap', turn: 7, refresh: true },
    { runmode: 'leap', turn: 6, refresh: false },
    { runmode: 'teleport', turn: 2, refresh: false },
]) {
    void test(`a counted walk in ${runmode} mode ${refresh ? 'refreshes' : 'retains'} the displayed turn at turn ${turn}`, async () => {
        const input = freshTurnRoom({ flags: { time: true, runmode, pickup: false } });
        await bot();
        const shownTurn = game.moves;
        game.moves = turn;
        const startX = game.u.ux;
        input.feed('2l');
        await rhack(0);
        assert.equal(game.u.ux, startX + 1);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`T:${refresh ? turn : shownTurn}\\b`));
    });
}
//# sourceMappingURL=counted_walk_display.test.js.map