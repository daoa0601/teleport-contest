import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, SDOOR } from '../js/const.js';
import { automaticSearch } from '../js/detect.js';
import { flush_screen, newsym } from '../js/display.js';
import { cansee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('discovering a hidden door remembers it even outside the visible area', async () => {
    const level = freshObjectRoom({
        recalculateVision: false, gameplaySeed: 811n, hero: { nv_range: 0 },
    });
    for (const column of level.locations) {
        for (const location of column) {
            location.lit = false;
            location.waslit = false;
        }
    }
    const door = level.requireAt(9, 9);
    door.typ = SDOOR;
    door.horizontal = true;
    vision_reset_new_level();
    vision_recalc(0);
    newsym(9, 9);
    assert.equal(cansee(9, 9), false, 'the dark door is outside night vision');
    for (let attempt = 0; attempt < 100 && door.typ === SDOOR; attempt++) {
        await automaticSearch();
    }
    await flush_screen(1);
    assert.equal(door.typ, DOOR, 'searching must discover the adjacent door');
    assert.equal(door.disp_ch, '+');
    assert.equal(door.remembered_glyph?.ch, '+');
});
//# sourceMappingURL=secret_door_discovery_display.test.js.map