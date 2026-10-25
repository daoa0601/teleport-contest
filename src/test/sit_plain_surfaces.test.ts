import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAVE, LADDER, SINK, STAIRS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

// sit.c:dosit() plain surfaces: each feature names itself and costs a turn.
for (const [surface, typ, line] of [
    ['stairs', STAIRS, 'You sit on the stairs.'],
    ['ladder', LADDER, 'You sit on the ladder.'],
    ['grave', GRAVE, 'You sit on the grave.'],
] as const) {
    void test(`sitting on the ${surface} announces the seat`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.requireAt(10, 10).typ = typ;
        resetInputState().feed(' '.repeat(10));
        initRng(1n);

        await runExtendedCommand('sit', ' '.repeat(10));

        assert.equal(game._pending_message, line);
        assert.equal(game.context.move, 1);
    });
}

// sit.c:dosit() IS_SINK: a humanoid wets the rump; a blob wets the underside.
void test('sitting on a sink wets the humanoid rump', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = SINK;
    resetInputState().feed(' '.repeat(10));
    initRng(1n);

    await runExtendedCommand('sit', ' '.repeat(10));

    assert.equal(game._pending_message, 'You sit on the sink.  Your rump gets wet.');
    assert.equal(game.context.move, 1);
});
