import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PEAR } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('picking up a matching known item needs only one comparison acknowledgement', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pear = await addInventoryObject(PEAR, { bknown: false });
    await floorObject(PEAR, game.u.ux, game.u.uy, { bknown: true });
    installPagerInput(resetInputState(), { expected: /comparing them/, limit: 1 });

    await rhack(','.charCodeAt(0));

    assert.equal(pear.quan, 2);
    assert.equal(pear.bknown, true);
    assert.equal(game.inventory.filter(object => object.otyp === PEAR).length, 1);
    assert.match(game._pending_message ?? '', /pear \(2 in total\)/);
    assert.equal(game.context.move, 1);
});
