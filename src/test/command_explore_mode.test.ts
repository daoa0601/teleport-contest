import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

function topl(): string {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

// C cmd.c:enter_explore_mode(): the warning pages behind --More-- before the
// yn query takes the topl, and answering yes switches flags.explore on (and
// flags.debug off) without spending a turn.
void test('entering explore mode from a normal game switches the play mode', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('#exploremode\n');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.ok(topl().includes('Beware!  From explore mode there will be no return to normal game,'),
            topl());
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.ok(topl().includes('Do you want to enter explore mode? [yn] (n)'), topl());
        input.feed('y');
        await action;
    } catch (error) {
        input.feed('\x1b\x1b');
        await action;
        throw error;
    }
    assert.equal(game._last_message, 'You are now in non-scoring explore mode.');
    assert.equal(game.flags.explore, true);
    assert.equal(game.context.move, 0);
});

void test('declining explore mode continues the current game', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('#exploremode\n');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        input.feed(' n');
        await action;
    } catch (error) {
        input.feed('\x1b\x1b');
        await action;
        throw error;
    }
    assert.equal(game._last_message, 'Continuing with normal game.');
    assert.ok(!game.flags.explore);
    assert.equal(game.context.move, 0);
});

void test('entering explore mode from wizard mode names debug mode and clears it', async () => {
    const input = freshTurnRoom({ flags: { tips: false, debug: true } });
    input.feed('#exploremode\n');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.ok(topl().includes('Beware!  From explore mode there will be no return to debug mode,'),
            topl());
        input.feed(' y');
        await action;
    } catch (error) {
        input.feed('\x1b\x1b');
        await action;
        throw error;
    }
    assert.equal(game._last_message, 'You are now in non-scoring explore mode.');
    assert.equal(game.flags.explore, true);
    assert.equal(game.flags.debug, false);
});

void test('an explore game reports it is already in explore mode', async () => {
    const input = freshTurnRoom({ flags: { tips: false, explore: true } });
    input.feed('#exploremode\n');
    await rhack(0);
    assert.equal(game._last_message, 'You are already in explore mode.');
    assert.equal(game.flags.explore, true);
    assert.equal(game.context.move, 0);
});
