import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { CLUB } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryWeapon } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('throwing downward announces the object hitting the floor at the hero', async () => {
    freshObjectRoom();
    const club = await addInventoryWeapon(CLUB);

    await throwInventoryObject(club, '>');

    assert.match(game._pending_message, /club hits the floor\.$/);
    assert.equal(club.where, 'floor');
    assert.equal(club.ox, game.u.ux);
    assert.equal(club.oy, game.u.uy);
    assert.equal(game.context.move, 1);
});
