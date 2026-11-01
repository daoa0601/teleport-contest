import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { findit } from '../js/detect.js';
import { game } from '../js/gstate.js';
import { setMonsterPermanentInvisibility } from '../js/monster_invisibility.js';
import { initializeMonsterWormBody } from '../js/worm.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { assertWormBody } from './support/worms.js';

// C detect.c:findone() uses m_at(), which returns the worm at each occupied
// tail square. Each unseen square gets its own marker and detection count.
for (const concealment of ['darkness', 'invisibility']) {
    void test(`magical searching counts and remembers every worm square hidden by ${concealment}`, async () => {
        const level = await freshObjectRoom({ right: 25, hero: { nv_range: 0 } });
        const worm = await createMonsterAt('long worm', 14, 10, MM_NOTAIL | NO_MINVENT);
        await initializeMonsterWormBody(worm, { segmentCount: 3, random: () => 0 });
        assertWormBody(worm);
        assert.equal(worm.wormSegments.length, 3);
        if (concealment === 'darkness') {
            for (const column of level.locations) {
                for (const location of column) location.lit = false;
            }
            vision_reset_new_level();
            await vision_recalc(0);
        } else {
            setMonsterPermanentInvisibility(worm);
        }

        const detected = await findit();

        assert.equal(detected, 4, 'the unseen head and three tail squares each count');
        assert.equal(game._pending_message, 'You detect 4 unseen monsters!');
        for (const { x, y } of [{ x: worm.mx, y: worm.my }, ...worm.wormSegments]) {
            assert.equal(level.requireAt(x, y).remembered_glyph?.kind, 'invisible',
                `The unseen worm square at ${x},${y} must be marked.`);
        }

        const detectedAgain = await findit();

        assert.equal(detectedAgain, 0, 'remembered worm squares are not new detections');
        for (const { x, y } of worm.wormSegments) {
            assert.equal(level.requireAt(x, y).remembered_glyph?.kind, 'invisible',
                `Searching again must retain the occupied tail marker at ${x},${y}.`);
        }
    });
}

void test('magical searching detects an unseen tail within range while leaving its distant head unmarked', async () => {
    const level = await freshObjectRoom({ right: 25 });
    const worm = await createMonsterAt('long worm', 19, 10, MM_NOTAIL | NO_MINVENT);
    await initializeMonsterWormBody(worm, { segmentCount: 3, random: () => 0 });
    assertWormBody(worm);
    assert.equal(worm.wormSegments.length, 3);
    setMonsterPermanentInvisibility(worm);

    const detected = await findit();

    assert.equal(detected, 3, 'only the three tail squares are within radius eight');
    assert.equal(game._pending_message, 'You detect 3 unseen monsters!');
    assert.notEqual(level.requireAt(worm.mx, worm.my).remembered_glyph?.kind, 'invisible');
    for (const { x, y } of worm.wormSegments) {
        assert.equal(level.requireAt(x, y).remembered_glyph?.kind, 'invisible',
            `The in-range tail square at ${x},${y} must be marked.`);
    }
});
