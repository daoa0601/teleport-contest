import test from 'node:test';
import assert from 'node:assert/strict';

import { POOL } from '../js/const.js';
import {
    flush_screen, glyphAt, show_glyph_cell, under_ground, under_water,
} from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { detectObjects } from '../js/magic_detection.js';
import { POT_HEALING, SPE_DETECT_TREASURE } from '../js/object_data.js';
import { floorObject, uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

function dismissViews() { pushKeys(' '.repeat(16)); }

// C detect.c:map_redisplay() ends a detection browse by reconstraining the
// hero and deferring a full restricted redraw (under_water(2)/under_ground(2));
// the turn's under_water(0)/under_ground(0) then performs the full clear.
for (const mode of ['underwater', 'buried'] as const) {
    void test(`a ${mode} hero's detection browse defers a full map reset to the next update`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        if (mode === 'underwater') {
            for (let x = 7; x <= 16; x++)
                for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = POOL;
            game.u.uinwater = 1;
        } else {
            game.u.uburied = true;
        }
        await floorObject(POT_HEALING, 14, 8, { dknown: false });
        dismissViews();

        await detectObjects(await uninitializedObject(SPE_DETECT_TREASURE, { blessed: true }));

        // The browse redisplays the restricted viewport around the hero.
        assert.equal(glyphAt(14, 8)?.kind !== 'object', true);

        if (mode === 'underwater') {
            // A transient glyph beyond the three-by-three viewport must not
            // survive the turn's restricted update.
            show_glyph_cell(16, 10, '!');
            await flush_screen(1);
            assert.equal(requireScreenCell(15, 11).ch, '!');

            await under_water(0);
            await flush_screen(1);
            assert.equal(requireScreenCell(15, 11).ch, ' ');
        } else {
            // The buried update clears the map instead of drawing the hero.
            await under_ground(0);
            await flush_screen(1);
            assert.equal(requireScreenCell(9, 11).ch, ' ');
        }
    });
}

// An engulfed hero's map_redisplay only reconstrains; the stomach projection
// is redrawn by docrt() and no deferred restricted reset is armed.
void test('an engulfed hero gets no deferred restricted reset from a detection browse', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const engulfer = await createMonsterAt('purple worm', 10, 10);
    game.u.uswallow = 1;
    game.u.ustuck = engulfer;
    await floorObject(POT_HEALING, 14, 8, { dknown: false });
    dismissViews();

    await detectObjects(await uninitializedObject(SPE_DETECT_TREASURE, { blessed: true }));

    // The detection stays in hero memory; the screen shows the engulfer's
    // stomach border rather than the detected potion.
    assert.equal(level.requireAt(14, 8).remembered_glyph?.kind, 'object');
    assert.equal(requireScreenCell(13, 11).ch, ' ');
});
