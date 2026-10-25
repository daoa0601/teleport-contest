import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { playInstrument } from '../js/music.js';
import { FIRE_HORN } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
// C music.c do_improvisation(): the fire horn announcement runs through
// flash_str(type, FALSE), which replaces the real bolt with a random
// hallucinatory blast for a hallucinating hero.
void test('a hallucinating improviser sees a random blast leave the fire horn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.u.hallucinationTurns = 20;
    const horn = await addInventoryObject(FIRE_HORN, { spe: 2 });
    // Every key read observes the topline it answers, so an announcement
    // that a later ray message overwrites is still recorded.
    const toplines = [];
    input.beforeRead = () => {
        toplines.push(game._pending_message);
    };
    // Hallucination skips the "Improvise?" question: a space dismisses
    // the kaleidoscopic announcement and "l" aims the horn.
    pushKeys(' l          ');
    await playInstrument(horn);
    assert.ok(toplines.some(line => /^A blast of .+ blasts out of the horn!$/.test(line)), `No hallucinated blast announcement in ${toplines.join(' / ')}`);
    assert.equal(horn.spe, 1);
});
//# sourceMappingURL=music_horn_hallucination.test.js.map