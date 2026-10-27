import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameLevel } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { STONE } from '../js/const.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { freshTurnRoom } from './support/playable-room.js';
// C zap.c bhit() opens every thrown-object flight with
// tmp_at(DISP_FLASH, ...), and tmp_at()'s init calls flush_screen(0)
// (display.c). A quivered coin leaves the '$' status field dirty via
// freeinv_core(), so the purse update reaches the terminal during the
// fire command itself — even when the missile stops at its first square
// and no projectile cell is ever painted.
void test('firing quivered gold at a wall publishes the purse during the command', async () => {
    const input = freshTurnRoom({ flags: { tips: false, time: true } });
    // The square west of the hero blocks the flight immediately, so the
    // whole path is empty and only bhit()'s init flush can draw anything.
    requireGameLevel().requireAt(9, 10).typ = STONE;
    setHeroGoldAmount(game, 5);
    input.feed('Q$');
    await rhack(0);
    const movesBeforeThrow = game.moves;
    input.feed('fh');
    await rhack(0);
    assert.equal(game.inventory.filter(item => (item.oclass ?? 0) === 12)[0]?.quan, 4, 'one coin left the purse stack');
    const status = game.nhDisplay?.statusLines?.[1] ?? '';
    assert.match(status, /\$:4/, 'the freed coin is already on the status line');
    assert.match(status, new RegExp(`T:${movesBeforeThrow}\\b`), 'the turn has not passed yet, so the time field keeps the pre-throw value');
});
//# sourceMappingURL=flight_start_status_flush.test.js.map