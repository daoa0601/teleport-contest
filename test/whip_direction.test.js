import test from 'node:test';
import assert from 'node:assert/strict';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BULLWHIP } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('cancelling the direction for a wielded whip takes no time and adds no message', async () => {
    freshPlayableRoom();
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    await applyInventoryObject(whip, '\x1b');
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, '');
});
//# sourceMappingURL=whip_direction.test.js.map