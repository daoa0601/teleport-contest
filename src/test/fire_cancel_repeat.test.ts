import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { DAGGER } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryWeapon } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

// C dothrow.c:dofire() returns the quiver refill's ECMD_TIME in place of a
// cancelled throw's ECMD_CANCEL (dothrow.c:585), and rhack() clears the
// command queues only for CANCEL|FAIL.  Readying the wielded weapon stack,
// then refusing the direction, must therefore leave the fire repeatable.
void test('a cancelled fire after an unwielding quiver refill stays repeatable', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    const daggers = await addInventoryWeapon(DAGGER, { quan: 2, quantity: 2 });
    await setPrimaryWeapon(daggers);
    input.display = { async readKey() { return 27; } };
    input.feed('f any\x1b');
    await moveloop_core();
    input.feed('\x01');
    await moveloop_core();

    assert.doesNotMatch(game._pending_message ?? '', /There is no command available to repeat\./,
        `The refill's spent turn keeps the repeat queue, saw: ${game._pending_message}`);
    assert.equal(game.uquiver?.otyp ?? game.u?.uquiver?.otyp, DAGGER,
        'the wielded stack moved into the quiver');
});
