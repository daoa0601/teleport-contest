import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { VIBRATING_SQUARE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { PICK_AXE } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('down starts digging with a wielded pick when autodig is enabled', async () => {
    freshObjectRoom({ flags: { autodig: true } });
    requirePlayingGame(game);
    const pick = await addInventoryObject(PICK_AXE);
    await setPrimaryWeapon(pick);
    await rhack('>'.charCodeAt(0));
    assert.equal(game._occupation?.key, 'dig');
    assert.equal(game.context.digging?.down, true);
    assert.equal(game._pending_message, 'You start digging downward.');
    assert.equal(game.context.move, 1);
});
void test('down at an unopened vibrating square says it cannot be used yet', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    addTrap(game.level, VIBRATING_SQUARE, game.u.ux, game.u.uy, { tseen: true });
    await rhack('>'.charCodeAt(0));
    assert.equal(game._pending_message, "You can't go down here yet.");
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=stairs_autodig.test.js.map