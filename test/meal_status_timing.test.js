import test from 'node:test';
import assert from 'node:assert/strict';
import { NOT_HUNGRY, SATIATED } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { doeat } from '../js/eat.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { CRAM_RATION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the first meal bite defers its hunger status until a status update', async () => {
    freshObjectRoom({ hero: { uhunger: 884, uhs: NOT_HUNGRY } });
    const food = await addInventoryObject(CRAM_RATION);
    await bot();
    pushKeys(food.invlet);
    await doeat();
    await flush_screen(1);
    assert.equal(game.u.uhs, SATIATED);
    assert.doesNotMatch(status(), /Satiated/);
    await bot();
    assert.match(status(), /Satiated/);
});
function status() {
    return requireGameDisplay().grid[23]?.map(cell => cell.ch).join('') ?? '';
}
//# sourceMappingURL=meal_status_timing.test.js.map