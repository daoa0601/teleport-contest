import assert from 'node:assert/strict';
import test from 'node:test';
import { breakFloorObject } from '../js/object_breakage.js';
import { POT_HEALING } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a visible potion shatter describes its known blessing', async () => {
    freshObjectRoom();
    const potion = await floorObject(POT_HEALING, 11, 10, { blessed: true, bknown: true, dknown: true });
    const messages: string[] = [];

    await breakFloorObject(potion, { random: () => 99, publish: text => { messages.push(text); } });

    assert.match(messages[0] ?? '', /^A blessed .*potion(?: of [^!]+)? shatters!$/);
});

void test('seeing an unseen healing potion shatter reveals its known type', async () => {
    freshObjectRoom();
    const potion = await floorObject(POT_HEALING, 11, 10, { dknown: false, bknown: false });
    const messages: string[] = [];

    await breakFloorObject(potion, { random: () => 99, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'A potion of healing shatters!');
    assert.equal(potion.dknown, true);
});

void test('hearing an unseen potion shatter while blind does not reveal its appearance', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    const potion = await floorObject(POT_HEALING, 11, 10, { dknown: false, bknown: false });
    const messages: string[] = [];

    await breakFloorObject(potion, { random: () => 99, publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'You hear something shatter!');
    assert.equal(potion.dknown, false);
});
