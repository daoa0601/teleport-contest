import assert from 'node:assert/strict';
import test from 'node:test';
import { disintegrateWornArmor, wearHeroArmor } from '../js/armor.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_DISPLACEMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('disintegrating a displacement cloak announces the loss of displacement', async () => {
    freshObjectRoom();
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT);
    wearHeroArmor(cloak);
    const input = resetInputState();
    installPagerInput(input, { expected: /cloak|location/, limit: 4 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    await disintegrateWornArmor(cloak);
    await flushPendingTopline();
    assert.match(messages.join('\n'), /monsters no longer have difficulty pinpointing your location/);
    assert.equal(game.u.displaced, false);
});
//# sourceMappingURL=pool_cloak_loss.test.js.map