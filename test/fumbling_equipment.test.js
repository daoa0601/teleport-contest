import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive, setPropertyTimeout } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('wearing fumbling gauntlets starts a timeout and removing them ends their fumbling', async () => {
    freshObjectRoom();
    const gloves = await addInventoryObject(OBJECT_NAMES.indexOf('gauntlets of fumbling'));
    await equip('W', gloves, 1);
    assert.equal(propertyIsActive('fumbling'), true);
    assert.ok((game.u.fumblingTurns ?? 0) > 0, 'fumbling must have a scheduled timeout');
    await equip('T', gloves, 1);
    assert.equal(propertyIsActive('fumbling'), false);
    assert.equal(game.u.fumblingTurns, 0);
});
void test('removing fumble boots keeps fumbling supplied by worn gauntlets', async () => {
    freshObjectRoom();
    const gloves = await addInventoryObject(OBJECT_NAMES.indexOf('gauntlets of fumbling'));
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('fumble boots'));
    await equip('W', gloves, 1);
    await equip('W', boots, 2);
    setPropertyTimeout('fumbling', 12);
    await equip('T', boots, 2);
    assert.equal(game.uarmg, gloves);
    assert.equal(propertyIsActive('fumbling'), true);
    assert.ok((game.u.fumblingTurns ?? 0) > 0, 'the remaining gloves keep their next fumble scheduled');
    assert.equal(game.u.fumblingFromArmor, true);
});
void test('permanent fumbling remains scheduled after fumble boots come off', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('fumbling', 'outside');
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('fumble boots'));
    await equip('W', boots, 2);
    setPropertyTimeout('fumbling', 12);
    await equip('T', boots, 2);
    assert.equal(propertyIsActive('fumbling'), true);
    assert.ok((game.u.fumblingTurns ?? 0) > 0);
});
async function equip(command, object, delay) {
    assert.ok(object.invlet);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    resetInputState().feed(`${object.invlet}          \x1b`);
    await rhack(command.charCodeAt(0));
    for (let turn = 0; turn <= delay; turn++) {
        pushKeys('\x1b');
        await moveloop_core();
    }
}
//# sourceMappingURL=fumbling_equipment.test.js.map