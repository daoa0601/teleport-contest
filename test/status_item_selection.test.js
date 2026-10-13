import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NOT_HUNGRY, SATIATED } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { FOOD_RATION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
void test('selecting a food ration redraws the first silent bite hunger change', async () => {
    const input = freshTurnRoom({ hero: { uhunger: 880, uhs: NOT_HUNGRY } });
    const food = await addInventoryObject(FOOD_RATION);
    await bot();
    input.feed(`e${food.invlet}`);
    await moveloop_core();
    await flush_screen(1);
    assert.equal(game.u.uhs, SATIATED);
    assert.equal(game._occupation?.key, 'eat-food');
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bSatiated\b/);
});
//# sourceMappingURL=status_item_selection.test.js.map