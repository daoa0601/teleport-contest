import test from 'node:test';
import assert from 'node:assert/strict';

import { identifyPack } from '../js/invent.js';
import { CLUB } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('identifying the whole pack reveals every part of an object', async () => {
    freshGameplayRoom();
    const club = addInventoryObject(CLUB, {
        invlet: 'a',
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
    });

    await identifyPack(0);

    assert.equal(club.typeKnown, true);
    assert.equal(club.known, true);
    assert.equal(club.bknown, true);
    assert.equal(club.dknown, true);
    assert.equal(club.rknown, true);
});
