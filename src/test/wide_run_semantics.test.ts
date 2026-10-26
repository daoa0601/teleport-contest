import test from 'node:test';
import assert from 'node:assert/strict';
import type { InputGate } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DOOR, ROOM } from '../js/const.js';
import { freshTurnRoom } from './support/playable-room.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenRow } from './support/screen.js';
import { applyNethackrc } from '../js/options.js';
import { DAGGER } from '../js/object_data.js';

// A command has settled once nothing further will elapse on its behalf.
function settled(): boolean {
    return game.multi <= 0 && !game._runState && !game._heroTimePending
        && !game._occupation;
}

// The status window's time field, read from the rendered rows.
function displayedTime(): number {
    for (const row of [22, 23]) {
        const text = requireScreenRow(row).map(cell => cell.ch).join('');
        const match = text.match(/T:(\d+)/);
        if (match) return Number(match[1]);
    }
    throw new Error('the status window shows no time field');
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
void test('after a completed travel the status time field lags one timed command behind', async () => {
    freshTurnRoom();
    const level = requireGameLevel(game);
    requirePlayingGame(game);
    game.flags.time = true;
    for (let x = 11; x <= 14; x++) level.requireAt(x, 10).typ = ROOM;
    const gate = resetInputState();
    const turn = game.moves;
    // The travel itself ends on the arrival step; its pending repaint shows
    // the arrival turn.  The search shares the input stream so no command
    // resets run between the two.
    await runKeys(gate, '_ll.s', () => game.moves === turn + 3 && settled());

    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.equal(game.moves, turn + 3, 'the search after the travel elapsed');
    assert.equal(displayedTime(), turn + 2,
        'a turn taken while run is still 8 keeps the arrival time on screen');

    // A command that resets run (the cleanup Escape above acts as one) lets
    // the next timed command repaint the current time again.
    await runKeys(gate, 'l', () => game.u.ux === 13 && settled());
    assert.equal(game.moves, turn + 4);
    assert.equal(displayedTime(), turn + 4,
        'a timed command after the reset repaints the current time');
});

// C hack.c:1934-1942: during travel the destination pet is spotted and
// nopick is set, and the arrival step's nomul(0) cleared context.travel,
// so the final step reports "Pardon me" through domove_bump_mon() and
// returns early: the turn is spent, the hero stays outside the target,
// and its message flushes the pending time repaint before the turn elapses.
void test('a travel whose target holds a pet ends with the turn spent outside it', async () => {
    freshTurnRoom();
    const level = requireGameLevel(game);
    requirePlayingGame(game);
    game.flags.time = true;
    game.u.uen = game.u.uenmax;
    for (let x = 11; x <= 13; x++) level.requireAt(x, 10).typ = ROOM;
    const pet = await createMonsterAt('kitten', 12, 10);
    pet.mtame = 10;
    pet.mpeaceful = 1;
    const gate = resetInputState();
    const turn = game.moves;

    await runKeys(gate, '_ll.', () => {
        if (game.u.ux !== 11 || !settled()
            || !game._pending_message.includes('Pardon me')) return false;
        return true;
    });

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10],
        'the bumped final step leaves the hero outside the target');
    assert.equal(game.moves, turn + 2, 'the bumped final step still spent its turn');
    assert.equal(displayedTime(), turn + 1,
        'the visible bump message flushes the time before its turn elapses');
});

void test('a hidden travel bump keeps the time repaint pending until its turn elapses', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    game.flags.time = true;
    game.u.uen = game.u.uenmax;
    const pet = await createMonsterAt('kitten', 12, 10);
    pet.mtame = 10;
    pet.mpeaceful = 1;
    applyNethackrc('MSGTYPE=hide "^Pardon me,"');
    const gate = resetInputState();
    const turn = game.moves;

    await runKeys(gate, '_ll.', () =>
        game.moves === turn + 2 && settled());

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.moves, turn + 2);
    assert.equal(displayedTime(), turn + 2,
        'a hidden bump message does not flush the pending time repaint');
});

