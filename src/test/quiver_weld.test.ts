import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const count of ['', '2']) {
    void test(`quivering ${count ? 'part of' : 'all of'} an unknown welded stack reports its name and native time`, async () => {
        freshObjectRoom();
        const daggers = await addInventoryObject(DAGGER, { cursed: true, bknown: false, quan: 5 });
        await setPrimaryWeapon(daggers);
        resetInputState();

        pushKeys(`${count}${daggers.invlet}`);
        await rhack('Q'.charCodeAt(0));

        assert.equal(game._pending_message, 'Your 5 daggers are welded to your hand!');
        assert.equal(game.context.move, count ? 0 : 1);
        assert.equal(daggers.bknown, true);
        assert.equal(game.uwep, daggers);
        assert.equal(game.uquiver, null);
        assert.equal(daggers.quan, 5);
    });
}
