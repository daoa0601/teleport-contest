import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { BLINDFOLD } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
import { wearEyewear } from '../js/eyewear.js';
// C apply.c:doapply()'s BLINDFOLD/LENSES case applies a worn item by
// taking it off, guarded by do_wear.c cursed(): a cursed blindfold
// refuses with "You can't.  It is cursed.", reveals its BUC, and still
// spends the turn.
void test('applying a worn cursed blindfold refuses and reveals the curse', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    const blindfold = await addInventoryObject(BLINDFOLD, { invlet: 'a' });
    blindfold.cursed = true;
    blindfold.bknown = false;
    await wearEyewear(blindfold);
    await applyInventoryObject('a');
    await flush_screen(1);
    const row = requireScreenRow(0).map(cell => cell.ch).join('').trim();
    assert.match(row, /^You can't\.  It is cursed\./);
    assert.equal(blindfold.bknown, true);
    assert.equal(game.ublindf, blindfold, 'the cursed blindfold stays worn');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=apply_cursed_blindfold.test.js.map