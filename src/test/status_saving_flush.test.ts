import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen, timebot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a suppressed save flush retains the pending health update', async () => {
    freshObjectRoom();
    await bot();
    game.u.uhp = 35;
    game.context.botl = true;
    game.program_state.saving = 1;

    await flush_screen(1);
    game.program_state.saving = 0;
    await flush_screen(1);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:35\(40\)/);
});

void test('a time update attempted during saving is consumed without redrawing', async () => {
    freshObjectRoom({ moves: 40, flags: { time: true } });
    await bot();
    game.moves = 41;
    game.context.time_botl = true;
    game.program_state.saving = 1;

    timebot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:40\b/);
    game.program_state.saving = 0;
    await flush_screen(1);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:40\b/);
});

void test('a save flush defers a pending time update until saving ends', async () => {
    freshObjectRoom({ moves: 40, flags: { time: true } });
    await bot();
    game.moves = 41;
    game.context.time_botl = true;
    game.program_state.saving = 1;

    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:40\b/);
    game.program_state.saving = 0;
    await flush_screen(1);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:41\b/);
});
