import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DIAMOND } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('#wizbury buries adjacent objects but leaves distant objects on the floor', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const here = await floorObject(DIAMOND, 10, 10);
    const adjacent = await floorObject(DIAMOND, 11, 11);
    const distant = await floorObject(DIAMOND, 12, 10);
    await runExtendedCommand('wizbury');
    assert.equal(here.where, 'buried');
    assert.equal(adjacent.where, 'buried');
    assert.equal(distant.where, 'floor');
    assert.equal(game._pending_message, '2 objects buried.');
    assert.equal(game.context.move, 0);
});
void test('#wizbury reports when no adjacent objects exist', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    await runExtendedCommand('wizbury');
    assert.equal(game._pending_message, 'No objects here or adjacent to bury.');
});
//# sourceMappingURL=wizard_bury.test.js.map