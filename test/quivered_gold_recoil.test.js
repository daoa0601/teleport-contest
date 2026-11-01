import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { setPropertyTimeout } from '../js/properties.js';
import { setQuiverObject } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('firing a quivered coin while levitating recoils after its shortened flight', async () => {
    const level = await freshObjectRoom({ right: 35 });
    setPropertyTimeout('levitation', 20);
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 3 });
    await setQuiverObject(gold);
    resetInputState().feed('l');
    await rhack('f'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.equal(game._pending_message, 'You float in the opposite direction.');
    assert.equal(gold.quan, 2);
    const coin = floorObjects(level).find(object => object.otyp === GOLD_PIECE);
    assert.ok(coin, 'the fired coin lands on the floor');
    assert.deepEqual([coin.ox, coin.oy], [15, 10]);
});
//# sourceMappingURL=quivered_gold_recoil.test.js.map