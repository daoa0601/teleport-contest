import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/botl.js';
import { applyNethackrc } from '../js/options.js';
import { CLR_RED, NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
for (const match of ['polymorphed', '(polymorphed)', 'none-of-the-above-(polymorphed)']) {
    void test(`title rule '${match}' colors an unmatched monster title`, async () => {
        await freshObjectRoom({ hero: { umonnum: 0, mh: 3, mhmax: 8 } });
        applyNethackrc(`OPTIONS=hilite_status:title/${match}/red`);
        await bot();
        assert.equal(requireScreenRow(22)[0]?.color, CLR_RED);
    });
}
void test('a polymorphed title fallback does not color a human rank', async () => {
    await freshObjectRoom();
    applyNethackrc('OPTIONS=hilite_status:title/polymorphed/red');
    await bot();
    assert.equal(requireScreenRow(22)[0]?.color, NO_COLOR);
});
void test('a rank-specific title rule takes precedence over the polymorphed fallback', async () => {
    await freshObjectRoom({ hero: { umonnum: 0, mh: 3, mhmax: 8 } });
    applyNethackrc('OPTIONS=hilite_status:title/giant ant/red title/polymorphed/blue');
    await bot();
    assert.equal(requireScreenRow(22)[0]?.color, CLR_RED);
});
//# sourceMappingURL=status_polymorphed_title_hilite.test.js.map