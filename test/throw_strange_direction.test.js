import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { DART } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
// C cmd.c getdir(): a key that is not currently bound to a movement fails
// the direction prompt.  With number_pad:-1 (QWERTZ layout) 'y' is no
// longer the upper-left move, so getdir() prints "What a strange
// direction!" and dothrow.c throw_obj() returns ECMD_CANCEL with the
// message left on the topline and the missile still carried.
void test('a throw direction key unbound by the QWERTZ layout is rejected visibly', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    applyNethackrc('OPTIONS=number_pad:-1,!cmdassist');
    const dart = await addInventoryObject(DART, { invlet: 'a' });
    await throwInventoryObject(dart, 'y');
    await flush_screen(1);
    const row = requireScreenRow(0).map(cell => cell.ch).join('').trim();
    assert.match(row, /^What a strange direction!/);
    assert.ok(game.inventory.includes(dart), 'the cancelled throw keeps the missile in inventory');
});
//# sourceMappingURL=throw_strange_direction.test.js.map