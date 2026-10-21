import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { MM_ANGRY, NO_MINVENT, NOT_HUNGRY } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

function statusRows(): string {
    return requireGameDisplay().grid.slice(-2)
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
}

void test('bumping into solid stone repaints a stale status line', async () => {
    const input = freshTurnRoom({ right: 10, energy: 2 });
    requirePlayingGame(game);
    await flush_screen(1);
    assert.match(statusRows(), /Pw:2\(2\)/);

    // Energy changes that do not request a status update stay undrawn.
    game.u.uen = 4;
    game.u.uenmax = 4;
    input.feed('l');
    await moveloop_core();
    await flush_screen(1);

    assert.equal(game.u.ux, 10, 'the stone blocks the step');
    assert.match(statusRows(), /Pw:4\(4\)/, "test_move()'s nomul(0) requests a status update");
});

void test('attacking a hostile monster repaints a stale status line', async () => {
    const input = freshTurnRoom({ energy: 2 });
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const target = await createMonsterAt('newt', ux + 1, uy, MM_ANGRY | NO_MINVENT);
    // A frozen, sturdy target neither dies nor hits back this turn.
    target.mhp = target.mhpmax = 200;
    target.mcanmove = 0;
    target.mfrozen = 10;
    game.u.uhunger = 900;
    game.u.uhs = NOT_HUNGRY;
    await flush_screen(1);
    assert.match(statusRows(), /Pw:2\(2\)/);

    game.u.uen = 4;
    game.u.uenmax = 4;
    input.feed('l');
    await moveloop_core();
    await flush_screen(1);

    assert.equal(game.u.ux, ux, 'the hero attacks instead of stepping');
    assert.match(statusRows(), /Pw:4\(4\)/, "domove_core()'s nomul(0) requests a status update");
});
