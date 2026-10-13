import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { RUST_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { RING_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a rust trap washes grease off the full name of a worn suit', async () => {
    const level = freshObjectRoom();
    const suit = await addInventoryObject(RING_MAIL, { greased: true });
    await wearHeroArmor(suit);
    suit.oname = 'Raincoat';
    suit.dknown = false;
    const trap = addTrap(level, RUST_TRAP, 10, 10);
    pushKeys(' '.repeat(20));
    initRng(2n);
    await triggerHeroTrap(trap);
    assert.match(game._pending_message, /The grease on your ring mail named Raincoat washes off\./);
    assert.equal(suit.greased, false);
    assert.equal(suit.oeroded ?? 0, 0);
    assert.equal(suit.dknown, true);
});
//# sourceMappingURL=pool_grease_naming.test.js.map