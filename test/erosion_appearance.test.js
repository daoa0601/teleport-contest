import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, RUST_TRAP, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { erodeObject } from '../js/object_erosion.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { equipMonsterObject } from './support/monsters.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
void test('erosion names an unfamiliar monster weapon by its visible appearance', async () => {
    freshObjectRoom();
    const troll = await createMonsterAt('water troll', 11, 10, NO_MINVENT);
    const weapon = await uninitializedObject(OBJECT_NAMES.indexOf('ranseur'), { typeKnown: false });
    await addObjectToMonsterInventory(troll, weapon);
    const messages = [];
    await erodeObject(weapon, 'rust', {
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(weapon.oeroded, 1);
    assert.deepEqual(messages, ["The water troll's hilted polearm rusts!"]);
});
for (const arm of [1, 2]) {
    void test(`a rust trap hitting arm ${arm} names an unfamiliar wielded polearm by appearance`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP, { monster: { species: 'water troll' } });
        const weapon = await uninitializedObject(OBJECT_NAMES.indexOf('ranseur'), { typeKnown: false });
        await equipMonsterObject(monster, weapon, W_WEP);
        const messages = [];
        const event = await beginMonsterRustTrap(monster, trap, game, { random: () => arm });
        await finishMonsterRustTrap(monster, event, game, {
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(weapon.oeroded, 1);
        assert.equal(messages[1], "The water troll's hilted polearm rusts!");
    });
}
//# sourceMappingURL=erosion_appearance.test.js.map