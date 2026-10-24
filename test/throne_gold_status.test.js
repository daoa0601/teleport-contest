import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a throne updates the displayed purse after taking carried gold', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    setHeroGoldAmount(game, 250);
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:250\b/);
    initRng(125n);
    await runExtendedCommand('sit', ' '.repeat(10));
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:0\b/);
});
//# sourceMappingURL=throne_gold_status.test.js.map