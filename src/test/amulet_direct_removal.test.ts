import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_RESTFUL_SLEEP, OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive, revokeIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { createPoisonGasCloud } from '../js/regions.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('putting on a restful-sleep amulet starts the real sleepiness timeout', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_RESTFUL_SLEEP);
    resetInputState().feed(amulet.invlet);

    await rhack('P'.charCodeAt(0));

    assert.ok((game.u.sleepyTurns ?? 0) >= 3 && (game.u.sleepyTurns ?? 0) <= 100);
    assert.equal(propertyIsActive('sleepy'), true);
});

void test('removing a restful-sleep amulet directly clears its sleepiness timeout', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_RESTFUL_SLEEP);
    resetInputState().feed(`${amulet.invlet}        `);
    await rhack('P'.charCodeAt(0));
    setPropertyTimeout('sleepy', 15);

    await rhack('R'.charCodeAt(0));

    assert.equal(game.uamul, null);
    assert.equal(game.u.sleepyTurns, 0);
    assert.equal(propertyIsActive('sleepy'), false);
});

void test('removing a flying amulet directly announces landing and discovers the amulet', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('flying', 'outside');
    const amulet = await addInventoryObject(OBJECT_NAMES.indexOf('amulet of flying'), { typeKnown: false });
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${amulet.invlet}           `);
    await rhack('P'.charCodeAt(0));
    revokeIntrinsicProperty('flying', 'outside');
    await bot();
    assert.match(game.nhDisplay?.statusLines?.join(' ') ?? '', /Fly/);
    game.context.botl = false;

    await rhack('R'.charCodeAt(0));

    assert.equal(game.uamul, null);
    assert.equal(propertyIsActive('flying'), false);
    assert.doesNotMatch(game.nhDisplay?.statusLines?.join(' ') ?? '', /Fly/, 'the landing message refreshes the visible flight status');
    assert.equal(objectTypeKnown(amulet), true);
    assert.match([...messages, game._pending_message].join(' '), /You land\./);
});

void test('removing a breathing amulet directly warns about surrounding poison gas', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(OBJECT_NAMES.indexOf('amulet of magical breathing'), { typeKnown: false });
    resetInputState().feed(`${amulet.invlet}           `);
    await rhack('P'.charCodeAt(0));
    await createPoisonGasCloud(game, game.u.ux, game.u.uy, 1, 8);

    await rhack('R'.charCodeAt(0));

    assert.equal(game.uamul, null);
    assert.equal(objectTypeKnown(amulet), true);
    assert.match(game._pending_message, /You are breathing poison gas!/);
});
