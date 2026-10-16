import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_LAWFUL, AM_SANCTUM, AM_SHRINE } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { CLR_BRIGHT_MAGENTA, CLR_RED } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
for (const { mask, color, name } of [
    { mask: AM_SANCTUM | AM_LAWFUL, color: CLR_BRIGHT_MAGENTA, name: 'a sanctum altar' },
    { mask: AM_SHRINE, color: CLR_RED, name: 'an unaligned shrine' },
]) {
    void test(`${name} uses its native altar glyph color`, async () => {
        const level = freshObjectRoom();
        const altar = level.requireAt(11, 10);
        altar.typ = ALTAR;
        altar.flags = mask;
        newsym(11, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(10, 11).color, color);
    });
}
//# sourceMappingURL=altar_glyph_color.test.js.map