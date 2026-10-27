import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { addObjectToContainer } from '../js/object_container.js';
import { FOOD_RATION, SACK } from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// The recorder sorts loot menus by the partly eaten phrase: an untouched
// food ration stack is offered before a partly eaten ration even when the
// split-off piece sits at the head of the pile or container chain (place_object()
// and add_to_container() both prepend, so the last inserted item is listed
// first in chain order). Recorded in fresh7282 step 429 (floor pickup) and
// fresh6791 step 224 (sack take-out): "a - 2 uncursed food rations" precedes
// "b - an uncursed partly eaten food ration" from a chain headed by the
// partly eaten piece.
function screenRows() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
}
void test('pickup menu lists the whole ration stack before the partly eaten piece on top of the pile', async () => {
    freshObjectRoom();
    // place_object() prepends: the whole stack is placed first and ends below
    // the partly eaten ration, so the pile chain is [partly eaten, whole].
    await floorObject(FOOD_RATION, game.u.ux, game.u.uy, { quantity: 2, quan: 2 });
    await floorObject(FOOD_RATION, game.u.ux, game.u.uy, { oeaten: 400 });
    const input = resetInputState();
    const action = pickupAtHero();
    await input.waitUntilBlocked();
    const rows = screenRows();
    input.feed('\x1b');
    await action;
    const wholeRow = rows.findIndex(row => /2 uncursed food rations/.test(row));
    const partlyRow = rows.findIndex(row => /an uncursed partly eaten food ration/.test(row));
    assert.ok(wholeRow >= 0 && partlyRow >= 0, `both rations must be offered:\n${rows.slice(0, 8).join('\n')}`);
    assert.ok(wholeRow < partlyRow, `the whole stack is listed before the partly eaten ration:\n${rows.slice(0, 8).join('\n')}`);
});
void test('sack take-out menu lists the whole ration stack before the partly eaten piece stashed last', async () => {
    freshObjectRoom();
    const sack = await floorObject(SACK, game.u.ux, game.u.uy, { cknown: true });
    // add_to_container() prepends: stashing the whole stack and then the
    // partly eaten ration leaves the container chain [partly eaten, whole].
    await addObjectToContainer(sack, await knownObject(FOOD_RATION, {
        where: 'free', quantity: 2, quan: 2,
    }));
    await addObjectToContainer(sack, await knownObject(FOOD_RATION, {
        where: 'free', oeaten: 400,
    }));
    const input = resetInputState();
    pushKeys('loot\n');
    const looting = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('o');
    await input.waitUntilBlocked();
    const rows = screenRows();
    input.feed('\x1b');
    await looting;
    const wholeRow = rows.findIndex(row => /2 uncursed food rations/.test(row));
    const partlyRow = rows.findIndex(row => /an uncursed partly eaten food ration/.test(row));
    assert.ok(wholeRow >= 0 && partlyRow >= 0, `both rations must be offered:\n${rows.slice(0, 8).join('\n')}`);
    assert.ok(wholeRow < partlyRow, `the whole stack is taken out before the partly eaten ration:\n${rows.slice(0, 8).join('\n')}`);
});
//# sourceMappingURL=loot_menu_partly_eaten_stack_order.test.js.map