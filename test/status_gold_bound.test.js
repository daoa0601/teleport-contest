import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('the status purse stops at six digits without discarding carried gold', async () => {
    freshObjectRoom();
    setHeroGoldAmount(game, 1234567);
    await bot();
    const row = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(row, /\$:999999 HP:/);
    assert.equal(game.inventory.find(object => object.oclass === 12)?.quan, 1234567);
});
//# sourceMappingURL=status_gold_bound.test.js.map