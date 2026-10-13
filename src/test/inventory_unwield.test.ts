import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory unwielding selects empty hands and takes a turn', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    const input = resetInputState();

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: '-' },
    ]);
    await rhack(0);

    assert.equal(game.uwep, null);
    assert.equal((dagger.owornmask ?? 0) & W_WEP, 0);
    assert.equal(game._pending_message, 'You are bare handed.');
    assert.equal(game.context.move, 1);
});
