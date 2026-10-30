import assert from 'node:assert/strict';
import test from 'node:test';
import { findit } from '../js/detect.js';
import { map_invisible } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { STATUE } from '../js/object_data.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
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
    await map_invisible(10, 9);
    assert.equal(game.level.requireAt(10, 9).remembered_glyph?.kind, 'invisible');

    await findit();

    const remembered = game.level.requireAt(10, 9).remembered_glyph;
    assert.equal(remembered?.kind, 'object',
        'the cleared marker must reveal the remembered statue, not background');
    assert.equal(remembered?.otyp, statue.otyp);
    assert.match(game._pending_message ?? '', /You feel less paranoid\./);
});

void test('magical searching remembers an unseen warned monster instead of detecting it again', async () => {
    const level = await freshObjectRoom({
        hero: { hallucinationTurns: 100, warning: true, nv_range: 0 },
    });
    for (const column of level.locations) {
        for (const location of column) location.lit = false;
    }
    const monster = await createMonsterAt('minotaur', 15, 10);
    monster.mpeaceful = false;
    vision_reset_new_level();
    await vision_recalc(0);

    const firstSearch = await findit();
    const secondSearch = await findit();

    assert.equal(firstSearch, 1, 'the first search detects the unseen monster');
    assert.equal(secondSearch, 0, 'the next search must retain the existing unseen-monster marker');
    assert.equal(level.requireAt(15, 10).remembered_glyph?.kind, 'invisible');
});
