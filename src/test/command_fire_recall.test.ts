import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('fire retains recall when readying a wielded weapon takes time before direction cancellation', async () => {
    const input = freshTurnRoom({ flags: { autoquiver: false } });
    // The refilled quiver skips object selection on repeat, so the saved
    // inventory letter reaches getdir() instead. 'l' also means east.
    const dagger = await addInventoryObject(DAGGER, { invlet: 'l' });
    await setPrimaryWeapon(dagger, game);
    input.feed('f');
    await answerPrompts(rhack(0), input, [
        { prompt: /no ammunition readied\.--More--/, keys: ' ' },
        { prompt: /What do you want to fire\?/, keys: dagger.invlet },
        { prompt: /Ready it instead\?/, keys: 'y' },
        { prompt: /You are now bare handed\.--More--/, keys: ' ' },
        { prompt: /In what direction\?/, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 1, 'unwielding takes a turn');
    assert.equal(game.uwep, null);
    assert.equal(game.uquiver, dagger);

    input.feed('\x01h');
    await rhack(0);

    assert.equal(game.context.move, 1, 'recall fires the readied dagger');
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
