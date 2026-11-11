import test from 'node:test';
import assert from 'node:assert/strict';
import { bot } from '../js/botl.js';
import { BL_TH_VAL_PERCENTAGE, BL_XP, GT_VALUE, HL_NONE, MAXBLSTATS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { CLR_GREEN } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
// C botl.c initblstats[] "Fix experience-level up/down hilighting": the
// experience-level field takes its percentage against BL_XP itself
// (percentage(XP, XP), always 100), no longer against the experience
// points, so a percentage threshold on the level holds even before any
// experience is gained.
void test('an experience-level percentage threshold sees 100 percent', async () => {
    const thresholds = Array.from({ length: MAXBLSTATS }, (_, fld) => fld === BL_XP ? [{
            fld: BL_XP, set: true, anytype: 'int', value: 50,
            behavior: BL_TH_VAL_PERCENTAGE, rel: GT_VALUE, textmatch: '',
            coloridx: CLR_GREEN | (HL_NONE << 8),
        }] : []);
    await freshObjectRoom({ iflags: { statusThresholds: thresholds, hiliteDelta: 3 } });
    await bot();
    const highlights = game.nhDisplay?.statusHighlights;
    assert.ok(highlights);
    const span = highlights.spans[1].find((entry) => entry.field === BL_XP);
    assert.ok(span, 'the status line has an experience-level field');
    assert.equal(highlights.style(span).color, CLR_GREEN, 'the >50% rule applies to the experience level with no points');
});
//# sourceMappingURL=experience_level_hilite.test.js.map