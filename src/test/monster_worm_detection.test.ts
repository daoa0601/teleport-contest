import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { glyphAt } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { InputGate, bindInputGate } from '../js/input.js';
import { detectMonsters } from '../js/magic_detection.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { assertWormBody } from './support/worms.js';

for (const female of [false, true]) {
    for (const tame of [false, true]) {
        void test(`monster detection preserves ${female ? 'female' : 'male'} ${tame ? 'pet' : 'wild'} worm glyphs from head to tail`, async () => {
            freshObjectRoom({ right: 25, flags: { tips: false } });
            const worm = await createMonsterAt('long worm', 20, 10,
                MM_ANGRY | MM_NOTAIL | NO_MINVENT);
            initializeMonsterWormBody(worm, { segmentCount: 3, random: () => 0 });
            assertWormBody(worm);
            assert.equal(worm.wormSegments.length, 3);
            worm.female = female;
            if (tame) initializePet(worm);
            const gate = new InputGate();
            bindInputGate(gate);

            const detection = detectMonsters(null);
            await gate.waitUntilBlocked();
            try {
                const category = tame
                    ? female ? GlyphOffset.petFemale : GlyphOffset.petMale
                    : female ? GlyphOffset.monFemale : GlyphOffset.monMale;
                assert.equal(glyphAt(worm.mx, worm.my)?.glyph, category + worm.mnum,
                    'Detection must retain the head\'s sex and pet category.');
                for (const segment of worm.wormSegments) {
                    assert.equal(glyphAt(segment.x, segment.y)?.glyph,
                        category + MONSTER_NAME.indexOf('long worm tail'),
                        `The tail at ${segment.x},${segment.y} must share the head's sex and pet category.`);
                }
            } finally {
                gate.feed('.');
                await detection;
            }
        });
    }
}
