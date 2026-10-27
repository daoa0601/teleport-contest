import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { APPLE, OBJECT_NAMES } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

// C detect.c:map_redisplay() only calls docrt(), which flags the status
// redraw (display.c docrt_flags(): "caller needs to call bot() to actually
// redraw status") without flushing.  The restored map and the turn counter
// therefore repaint together at allmain.c moveloop's once-per-input bot() +
// curs_on_u(), after the command's monster phase and moves++ have settled.
// A completed travel leaves context.run at 8 (hack.c findtravelpath()
// restores it right after arrival's nomul(0)), and allmain.c:262 suppresses
// the per-turn time update while run is set, so the surviving redraw flag is
// the only thing that can advance the displayed turn counter.
void test('a browsed food detection repaints the turn counter with the restored map at the input boundary', async () => {
    const input = freshTurnRoom({ flags: { tips: false, time: true } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(50);
    // Food away from the hero forces detect.c food_detect() into its
    // interactive browse_map() branch.
    await floorObject(APPLE, 13, 10);
    const scroll = await addInventoryObject(OBJECT_NAMES.indexOf('food detection'));
    assert.ok(scroll.invlet, 'the scroll needs an inventory letter');
    installPagerInput(input, {
        expected: /formula|nose|food|Done|instruction|read|scroll/i,
        limit: 30,
    });
    const pager = input.display;
    assert.ok(pager, 'the browse turn needs its configured message pager');
    let browseKeyAnswered = false;
    input.display = {
        // Answer the browse's getpos() cursor read by selecting the current
        // spot; acknowledge anything paged; cancel once the next command
        // input arrives.
        async readKey(): Promise<number> {
            const display = game.nhDisplay;
            assert.ok(display, 'the browse turn needs its display');
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space to continue/.test(screen)) {
                return pager.readKey();
            }
            if (!browseKeyAnswered) {
                browseKeyAnswered = true;
                return '.'.charCodeAt(0);
            }
            return 27;
        },
    };

    // A two-square travel: the final step runs findTravelDirection()'s
    // arrival branch, which leaves the suppressing run value behind.
    input.feed('_ll.');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.ux, 12);
    assert.equal(game.context.run, 8, 'completed travel leaves C\'s lingering run value');

    input.feed(`r${scroll.invlet}`);
    await moveloop_core();
    assert.equal(browseKeyAnswered, true, 'the browse cursor read must be reached');
    assert.equal(game.context.run, 8, 'the lingering run value still suppresses time updates');

    const turnBeforeBoundary = game.moves;
    // cls() in map_redisplay clears the pending message; the boundary check
    // only confirms the turn reached the next command input.  Its ESC resets
    // the command variables, so the suppression is asserted above instead.
    await finishAtCommandInput(input, moveloop_core, /.*/);

    assert.equal(game.moves, turnBeforeBoundary + 1, 'reading the scroll takes one turn');
    const status = game.nhDisplay?.statusLines?.[1] ?? '';
    assert.match(status, new RegExp(`T:${game.moves}\\b`),
        'the restored map refresh repaints the settled turn counter');
});
