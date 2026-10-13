import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { igniteItems } from '../js/light.js';
import { POT_OIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a known oil potion catches light with one potion prefix', async () => {
    freshObjectRoom();
    const potion = await addInventoryObject(POT_OIL);
    const messages = [];
    await igniteItems([potion], { state: game, publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'Your potion of oil catches light!');
    assert.equal(potion.lamplit, true);
});
//# sourceMappingURL=pool_oil_naming.test.js.map