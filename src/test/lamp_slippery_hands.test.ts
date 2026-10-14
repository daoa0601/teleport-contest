import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { OIL_LAMP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('oil spilled by applying a cursed lamp makes the hands slippery immediately', async () => {
    freshPlayableRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { cursed: true, age: 100 });
    initRng(5n);

    await applyInventoryObject(lamp);

    assert.equal(game.u.glib, true);
    assert.ok((game.u.glibTurns ?? 0) > 0);
    assert.equal(lamp.lamplit, false);
});
