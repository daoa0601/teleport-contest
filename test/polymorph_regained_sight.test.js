import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { RIN_POLYMORPH_CONTROL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
void test('gaining eyes through polymorph reveals the appearance of carried items', async () => {
    freshRoomWithPolymorphedHero('yellow light', { flags: { debug: true } });
    const ring = await addInventoryObject(RIN_POLYMORPH_CONTROL, { observed: false, dknown: false });
    assert.equal(ring.dknown, false);
    pushKeys('polyself\ngoblin\n                        ');
    await rhack('#'.charCodeAt(0));
    assert.equal(ring.dknown, true);
});
//# sourceMappingURL=polymorph_regained_sight.test.js.map