import test from 'node:test';
import assert from 'node:assert/strict';
import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { game } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const RIN_STEALTH = OBJECT_NAMES.indexOf('stealth');

void test('the first stealth ring announces quiet movement and identifies its visible type', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(RIN_STEALTH, { typeKnown: false });

    await wearHeroAccessory(ring, 'uright');

    assert.equal(game._pending_message, 'You move very quietly.');
    assert.equal(game.u.stealth, true);
    assert.equal(objectTypeKnown(ring), true);
});

void test('an unseen stealth ring gives movement feedback without identifying its appearance', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    const ring = await addInventoryObject(RIN_STEALTH, {
        dknown: false, observed: false, typeKnown: false,
    });

    await wearHeroAccessory(ring, 'uright');

    assert.equal(game._pending_message, 'You move very quietly.');
    assert.equal(objectTypeKnown(ring), false);
});

void test('a second stealth ring stays quiet until the last ring is removed', async () => {
    freshObjectRoom();
    const left = await addInventoryObject(RIN_STEALTH);
    const right = await addInventoryObject(RIN_STEALTH);
    await wearHeroAccessory(left, 'uleft');
    const firstMessage = game._pending_message;

    await wearHeroAccessory(right, 'uright');
    await removeHeroAccessory(left);

    assert.equal(game._pending_message, firstMessage);
    assert.equal(game.u.stealth, true);
    await removeHeroAccessory(right);
    assert.match(game._pending_message, /You sure are noisy\./);
    assert.equal(game.u.stealth, false);
});

void test('intrinsic stealth suppresses ring feedback and discovery', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('stealth', 'outside');
    const ring = await addInventoryObject(RIN_STEALTH, { typeKnown: false });

    await wearHeroAccessory(ring, 'uright');
    await removeHeroAccessory(ring);

    assert.equal(game._pending_message, '');
    assert.equal(game.u.stealth, true);
    assert.equal(objectTypeKnown(ring), false);
});
