import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, POT_CONFUSION, POT_HEALING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('drowning pauses at a dilution message before wetting later inventory', async () => {
    const level = freshObjectRoom({ hero: { breathless: true, uluck: -5 } });
    level.requireAt(11, 10).typ = POOL;
    await addInventoryObject(DAGGER);
    await addInventoryObject(POT_HEALING);
    const laterPotion = await addInventoryObject(POT_CONFUSION);
    const input = resetInputState();
    let sawDilution = false;
    input.beforeRead = () => {
        if (!sawDilution && game._pending_message?.includes('dilutes')) {
            sawDilution = true;
            assert.equal(!!laterPotion.odiluted, false,
                'a pending earlier dilution must suspend the inventory walk');
        }
        input.feed(' ');
    };
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.equal(sawDilution, true);
    assert.equal(laterPotion.odiluted, true);
});
