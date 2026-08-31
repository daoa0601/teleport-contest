import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { identifyPack } from '../js/invent.js';
import { CLUB } from '../js/object_data.js';
import {
    freshWeaponArena, inventoryObject,
} from './support/weapon-arena.js';

test('identifying the whole pack reveals every part of an object', async () => {
    freshWeaponArena();
    const club = inventoryObject(CLUB, 'a', {
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
    });
    game.inventory = [club];

    await identifyPack(0);

    assert.equal(club.typeKnown, true);
    assert.equal(club.known, true);
    assert.equal(club.bknown, true);
    assert.equal(club.dknown, true);
    assert.equal(club.rknown, true);
});
