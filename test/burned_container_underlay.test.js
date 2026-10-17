import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_LAVA, DRAWBRIDGE_UP } from '../js/const.js';
import { fireDamageObject } from '../js/fire_damage.js';
import { CHEST, CLUB, SCR_TELEPORTATION } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('contents spilled from a burning chest fall into lava below a raised bridge', async () => {
    const level = freshObjectRoom();
    const chest = await floorObject(CHEST, 12, 10);
    const club = await knownObject(CLUB, { where: 'free' });
    await addObjectToContainer(chest, club);
    const square = level.requireAt(12, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_LAVA;
    await fireDamageObject(chest, { force: true, x: 12, y: 10, publish: () => { } });
    assert.equal(club.where, 'gone');
    assert.equal(chest.where, 'gone');
});
void test('a burning scroll the hero has not identified is named by its label', async () => {
    freshObjectRoom();
    const scroll = await floorObject(SCR_TELEPORTATION, 12, 10, { known: false, typeKnown: false });
    const messages = [];
    await fireDamageObject(scroll, { force: true, x: 12, y: 10, random: () => 0,
        publish: async (message) => { messages.push(message); } });
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? '', /^The scroll labeled [A-Z ]+ catches fire and burns\.$/);
});
//# sourceMappingURL=burned_container_underlay.test.js.map