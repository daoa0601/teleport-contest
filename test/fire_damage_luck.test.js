import test from 'node:test';
import assert from 'node:assert/strict';
import { fireDamageObject } from '../js/trap.js';
import { CHEST, SCR_TELEPORTATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C trap.c:4484/4507 fire_damage() compares (Luck + 5) > rn2(...), and Luck
// is u.uluck + u.moreluck (you.h:464). A hero with u.uluck 0 carrying a
// blessed luckstone has Luck 3 (attrib.c:set_moreluck()), so rolls up to 7
// protect items that plain u.uluck would have destroyed at 5.
async function freshLuckyRoom() {
    return await freshObjectRoom({ hero: { uluck: 0, moreluck: 3 } });
}
void test('a carried luckstone bonus protects a container from fire damage', async () => {
    await freshLuckyRoom();
    const chest = await floorObject(CHEST, 12, 10);
    const messages = [];
    const burned = await fireDamageObject(chest, { x: 12, y: 10, random: () => 7,
        publish: async (message) => { messages.push(message); } });
    assert.equal(burned, false);
    assert.notEqual(chest.where, 'gone');
    assert.equal(messages.length, 0);
});
void test('a carried luckstone bonus protects a scroll from fire damage', async () => {
    await freshLuckyRoom();
    const scroll = await floorObject(SCR_TELEPORTATION, 12, 10, { known: false, typeKnown: false });
    const messages = [];
    const burned = await fireDamageObject(scroll, { x: 12, y: 10, random: () => 7,
        publish: async (message) => { messages.push(message); } });
    assert.equal(burned, false);
    assert.notEqual(scroll.where, 'gone');
    assert.equal(messages.length, 0);
});
void test('fire damage past the luckstone-protected window still burns items', async () => {
    await freshLuckyRoom();
    const scroll = await floorObject(SCR_TELEPORTATION, 12, 10, { known: false, typeKnown: false });
    const messages = [];
    const burned = await fireDamageObject(scroll, { x: 12, y: 10, random: () => 8,
        publish: async (message) => { messages.push(message); } });
    assert.equal(burned, true);
    assert.equal(scroll.where, 'gone');
});
//# sourceMappingURL=fire_damage_luck.test.js.map