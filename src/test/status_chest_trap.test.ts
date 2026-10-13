import assert from 'node:assert/strict';
import test from 'node:test';
import { triggerChestTrap } from '../js/chest_trap.js';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { CHEST } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a chest gas trap displays its new impairments before returning', async () => {
    freshObjectRoom();
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    await bot();

    await triggerChestTrap(chest, { random: () => 0, publish: async () => undefined });

    assert.equal(game.u.stunnedTurns, 16);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bHallu Stun\b/);
});
