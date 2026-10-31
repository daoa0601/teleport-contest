import assert from 'node:assert/strict';
import test from 'node:test';
// C botl.c:bot(): when a full refresh is pending, it subsumes the
// time-only update — every field is resent from live state and both
// request flags (disp.botl, disp.time_botl) are cleared together.
import { bot, updateStatusLines } from '../js/botl.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a pending full status refresh subsumes the time-only update', async () => {
    await freshObjectRoom({ flags: { time: true } });
    setHeroGoldAmount(game, 90);
    await bot();
    const before = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(before, /\$:90\b/);
    // Both a field change and a turn advance before the next update.
    setHeroGoldAmount(game, 123);
    game.moves = 100;
    game.context.botl = true;
    game.context.time_botl = true;
    updateStatusLines();
    const row = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(row, /\$:123\b/);
    assert.match(row, /T:100\b/);
    assert.equal(game.context.botl, false);
    assert.equal(game.context.time_botl, false);
});
//# sourceMappingURL=botl_refresh_precedence.test.js.map