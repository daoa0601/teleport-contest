import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an elven cloak identifies its new stealth and announces its loss on takeoff', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    const cloak = await addInventoryObject(OBJECT_NAMES.indexOf('elven cloak'), { typeKnown: false });
    pushKeys(`${cloak.invlet}     `);
    await rhack('W'.charCodeAt(0));
    assert.equal(propertyIsActive('stealth'), true);
    assert.equal(objectTypeKnown(cloak), true);
    assert.match(messages(), /move very quietly/);
    await rhack('T'.charCodeAt(0));
    assert.equal(propertyIsActive('stealth'), false);
    assert.match(messages(), /sure are noisy/);
});
void test('an elven cloak adds no stealth discovery when the hero already has intrinsic stealth', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    grantIntrinsicProperty('stealth', 'outside');
    const cloak = await addInventoryObject(OBJECT_NAMES.indexOf('elven cloak'), { typeKnown: false });
    pushKeys(`${cloak.invlet}     `);
    await rhack('W'.charCodeAt(0));
    await rhack('T'.charCodeAt(0));
    assert.equal(propertyIsActive('stealth'), true);
    assert.equal(objectTypeKnown(cloak), false);
    assert.doesNotMatch(messages(), /quietly|noisy/);
});
void test('wearing a cloak of protection discovers its type without another visible effect', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    const cloak = await addInventoryObject(OBJECT_NAMES.indexOf('cloak of protection'), { typeKnown: false });
    pushKeys(cloak.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(objectTypeKnown(cloak), true);
    assert.equal(cloak.known, true);
});
void test('an alchemy smock grants both poison and acid resistance and removes both', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    const smock = await addInventoryObject(OBJECT_NAMES.indexOf('alchemy smock'));
    pushKeys(`${smock.invlet}     `);
    await rhack('W'.charCodeAt(0));
    assert.equal(propertyIsActive('poisonResistance'), true);
    assert.equal(propertyIsActive('acidResistance'), true);
    await rhack('T'.charCodeAt(0));
    assert.equal(propertyIsActive('poisonResistance'), false);
    assert.equal(propertyIsActive('acidResistance'), false);
});
void test('mummy wrapping blocks and then restores intrinsic invisibility with visible feedback', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    grantIntrinsicProperty('invisible', 'outside');
    const wrapping = await addInventoryObject(OBJECT_NAMES.indexOf('mummy wrapping'));
    pushKeys(`${wrapping.invlet}     `);
    await rhack('W'.charCodeAt(0));
    assert.equal(game.u.invisible, false);
    assert.match(messages(), /You can see yourself!/);
    await rhack('T'.charCodeAt(0));
    assert.equal(game.u.invisible, true);
    assert.match(messages(), /You can no longer see yourself\./);
});
void test('a sighted hero identifies an invisibility cloak from becoming transparent', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    grantIntrinsicProperty('seeInvisible', 'outside');
    const cloak = await addInventoryObject(OBJECT_NAMES.indexOf('cloak of invisibility'), { typeKnown: false });
    pushKeys(`${cloak.invlet}     `);
    await rhack('W'.charCodeAt(0));
    assert.equal(objectTypeKnown(cloak), true);
    assert.match(messages(), /Suddenly you can see through yourself\./);
    await rhack('T'.charCodeAt(0));
    assert.match(messages(), /Suddenly you can no longer see through yourself\./);
});
void test('an oilskin cloak announces its tight fit', async () => {
    freshObjectRoom();
    const messages = captureMessages();
    const cloak = await addInventoryObject(OBJECT_NAMES.indexOf('oilskin cloak'));
    pushKeys(`${cloak.invlet}     `);
    await rhack('W'.charCodeAt(0));
    assert.match(messages(), /The oilskin cloak fits very tightly\./);
});
function captureMessages() {
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    return () => [...messages, game._pending_message].join(' ');
}
//# sourceMappingURL=cloak_callbacks.test.js.map