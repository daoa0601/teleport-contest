import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, SINK } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const typ of [SINK, LAVAPOOL]) {
    void test(`monochrome terrain ${typ} remains distinct from its matching fountain or water symbol`, async () => {
        const level = freshObjectRoom({ flags: { color: false, use_inverse: true } });
        level.requireAt(11, 10).typ = typ;

        newsym(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).attr & ATR_INVERSE, ATR_INVERSE);
    });
}
