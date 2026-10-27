import assert from 'node:assert/strict';
import test from 'node:test';
import { findit } from '../js/detect.js';
import { map_invisible } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { STATUE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
// C detect.c:findone() clears a stale "remembered, unseen monster" marker
// through unmap_invisible(), which always follows unmap_object() with
// newsym().  On a visible square newsym() maps the floor objects again, so
// removing the marker reveals what is actually lying there instead of
// leaving bare background, and the detection flash ends on that glyph
// (bac21f26: the 'I' over a statue of a kobold zombie becomes 'Z' again
// after zapping a wand of secret door detection).
void test('clearing an unseen-monster marker during magical searching reveals the statue beneath it', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    const statue = await floorObject(STATUE, 10, 9);
    // The hero senses an unseen monster on the statue's square.
    map_invisible(10, 9);
    assert.equal(game.level.requireAt(10, 9).remembered_glyph?.kind, 'invisible');
    await findit();
    const remembered = game.level.requireAt(10, 9).remembered_glyph;
    assert.equal(remembered?.kind, 'object', 'the cleared marker must reveal the remembered statue, not background');
    assert.equal(remembered?.otyp, statue.otyp);
    assert.match(game._pending_message ?? '', /You feel less paranoid\./);
});
//# sourceMappingURL=findit_invisible_memory.test.js.map