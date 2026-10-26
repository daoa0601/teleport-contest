import test from 'node:test';
import assert from 'node:assert/strict';
import type { InputGate } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DOOR, ROOM } from '../js/const.js';
import { freshTurnRoom } from './support/playable-room.js';
import { floorObject } from './support/game-objects.js';
import { requireScreenRow } from './support/screen.js';
import { DAGGER } from '../js/object_data.js';

// A command has settled once nothing further will elapse on its behalf.
function settled(): boolean {
    return game.multi <= 0 && !game._runState && !game._heroTimePending
        && !game._occupation;
}

// Drive the turn loop until the game waits for another key, answering any
// --More-- pagination with spaces.
async function runKeys(gate: InputGate, keys: string, done: () => boolean): Promise<void> {
    let stopped = false;
    const drive = (async () => {
        for (let attempts = 0; !stopped; attempts++) {
            assert.ok(attempts < 60, 'the command must finish or request input');
            await moveloop_core();
            if (done()) break;
        }
    })();
    gate.feed(keys);
    try {
        for (let waits = 0; ; waits++) {
            assert.ok(waits < 200, 'the command must finish or request input');
            if (done()) break;
            await Promise.race([gate.waitUntilBlocked(), drive]);
            if (done()) break;
            const topline = requireScreenRow(0).map(cell => cell.ch).join('');
            if (topline.includes('--More--')) {
                gate.feed(' ');
                continue;
            }
            // Still processing: give the turn loop another scheduler slot.
            // (Executor form: the build's lib target predates withResolvers.)
            await new Promise<void>(resolve => {
                setImmediate(resolve);
            });
        }
    } finally {
        stopped = true;
        gate.feed('\x1b');
        await drive;
    }
}

// C o_init.c:doclassdisco()/dodiscovered() return plain ECMD_OK on every
// path, so rhack()'s reset_cmd_vars() keeps context.move FALSE: browsing
// discoveries never elapses a turn, including a cancelled class prompt.
void test('browsing discoveries after a timed command elapses no further turn', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    game.flags.time = true;
    const gate = resetInputState();
    const turn = game.moves;

    // One input stream: the discovery command must observe the previous
    // command's leftover context.move without an intervening reset.
    await runKeys(gate, 's`', () =>
        game.moves === turn + 1 && settled() && game._pending_message !== '');

    assert.equal(game.moves, turn + 1, 'the discovery browse takes no turn');
    assert.equal(game.context.move, 0);

});

// C hack.c:domove_core() (2937-2942) ends only a real run (context.run
// 1..7) when the hero enters a doorway; a counted walk (run == 0) keeps
// its remaining steps.
void test('a counted walk keeps its remaining steps through a doorway', async () => {
    freshTurnRoom();
    const level = requireGameLevel(game);
    requirePlayingGame(game);
    for (let y = 6; y <= 9; y++) level.requireAt(10, y).typ = ROOM;
    level.requireAt(10, 8).typ = DOOR;
    const gate = resetInputState();
    const turn = game.moves;

    await runKeys(gate, '4k', () => game.u.uy === 6 && settled());

    assert.deepEqual([game.u.ux, game.u.uy], [10, 6]);
    assert.equal(game.moves, turn + 4, 'all four counted steps elapse');
});

// C pickup.c:check_here() and pickup() stop only a real run (context.run
// != 0 and != 8) for an object pile; a counted walk crosses the pile and
// only looks at it.
void test('a counted walk crosses an object pile without stopping', async () => {
    freshTurnRoom();
    const level = requireGameLevel(game);
    requirePlayingGame(game);
    for (let y = 7; y <= 10; y++) level.requireAt(10, y).typ = ROOM;
    await floorObject(DAGGER, 10, 9);
    const gate = resetInputState();
    const turn = game.moves;

    await runKeys(gate, '3k', () => game.u.uy === 7 && settled());

    assert.deepEqual([game.u.ux, game.u.uy], [10, 7]);
    assert.equal(game.moves, turn + 3, 'all three counted steps elapse');
});

// C hack.c:findtravelpath() arrival (1404-1414) restores context.run to 8
// after nomul(0), and that lingering 8 suppresses allmain.c:262's
// time_botl on later turns until a command resets run through
// reset_cmd_vars() or set_move_cmd().  The status window's time field
// therefore keeps its pre-arrival value across those turns.
void test('a completed travel keeps run at 8 and suppresses the time repaint', async () => {
    freshTurnRoom();
    const level = requireGameLevel(game);
    requirePlayingGame(game);
    game.flags.time = true;
    for (let x = 11; x <= 14; x++) level.requireAt(x, 10).typ = ROOM;
    const gate = resetInputState();
    const turn = game.moves;

    let runAtArrival: number | undefined;
    await runKeys(gate, '_ll.', () => {
        if (game.u.ux !== 12 || !settled()) return false;
        runAtArrival ??= game.context.run;
        return true;
    });

    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.equal(game.moves, turn + 2);
    assert.equal(runAtArrival, 8, "the arrival leaves C's run at 8");

    // C cmd.c:reset_cmd_vars() zeroes context.run directly, without the
    // end_running() time repaint; the cleanup Escape takes that path.
    assert.equal(game.context.run, 0, 'reset_cmd_vars() clears the lingering run');
    assert.equal(game.context.time_botl, false,
        'reset_cmd_vars() queues no time repaint');
});
