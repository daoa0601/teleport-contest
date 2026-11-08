import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVEL_TIMER_KIND } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { startTimerAt } from '../js/lua/lifecycle.js';
import { levelTimers } from '../js/timeout.js';
import { freshObjectRoom } from './support/object-room.js';

function meltTimer(x: number, y: number) {
    return levelTimers(game).find(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY && timer.x === x && timer.y === y);
}

// nhlua.c:nhl_timer_start_at() registers a level timer at a map position:
// the coordinates are room-relative, cvt_to_abscoord() adds the room
// origin, only melt-ice is a position timer, and a second call at the
// same square stops the first timer before scheduling its replacement.
void test('start_timer_at schedules a melt-ice timer at the room-relative square', async () => {
    await freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const start = game.moves ?? 0;

    startTimerAt(10, 5, [0, 0, 'melt-ice', 10]);
    const timer = meltTimer(10, 5);
    assert.ok(timer, 'melt-ice is a position timer and is scheduled');
    assert.equal(timer.deadline, start + 10);

    startTimerAt(12, 6, [-2, -1, 'melt-ice', 5]);
    const replacement = meltTimer(10, 5);
    assert.ok(replacement);
    assert.equal(replacement.deadline, start + 5,
        'a second call at the same square replaces the timer');

    // nhl_get_timertype() accepts object timer names; timer_is_pos()
    // rejects them, so the call schedules nothing.
    startTimerAt(11, 11, [0, 0, 'burn-obj', 10]);
    assert.equal(meltTimer(11, 11), undefined);
    assert.equal(levelTimers(game).length, 1);
});

void test('start_timer_at rejects unknown timer names and malformed arguments', async () => {
    await freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);

    assert.throws(() => startTimerAt(10, 5, [0, 0, 'meltdown', 10]),
        /invalid option 'meltdown'/);
    assert.throws(() => startTimerAt(10, 5, ['melt-ice']),
        /string expected, got function/);
    assert.throws(() => startTimerAt(10, 5, [0, 'melt-ice', 10]),
        /nhl_timer_start_at: Wrong args/);
    assert.equal(levelTimers(game).length, 0);
});
