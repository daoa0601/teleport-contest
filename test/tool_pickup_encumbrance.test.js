import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_COMBINATION } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DART, ROCK, SACK } from '../js/object_data.js';
import { pickupFloorObject } from '../js/pickup.js';
import { nearCapacity } from '../js/weight.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('consecutive remote pickups report an unchanged burden only once', async () => {
    freshObjectRoom();
    await addInventoryObject(ROCK, { quantity: 70 });
    const darts = await floorObject(DART, 12, 10, { quantity: 2 });
    resetInputState().feed(' '.repeat(8));
    assert.equal(nearCapacity(game), 1, 'the hero starts slightly burdened');
    assert.equal(await pickupFloorObject(darts, 1), true);
    assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
    assert.equal(await pickupFloorObject(darts, 1), true);
    assert.equal(nearCapacity(game), 1, 'both pickups leave the burden unchanged');
    assert.doesNotMatch(game._lastPlineMessage, /trouble lifting/);
    assert.equal(game.inventory.find(object => object.otyp === DART)?.quan, 2);
});
for (const square of ['empty', 'unreachable']) {
    void test(`pickup on an ${square} square preserves load feedback for remote pickups`, async () => {
        freshObjectRoom();
        await addInventoryObject(ROCK, { quantity: 70 });
        const darts = await floorObject(DART, 12, 10, { quantity: 2 });
        if (square === 'unreachable')
            await floorObject(DART, 10, 10);
        resetInputState().feed(' '.repeat(12));
        assert.equal(await pickupFloorObject(darts, 1), true);
        assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
        game.u.levitating = square === 'unreachable';
        await rhack(','.charCodeAt(0));
        assert.equal(game._lastPlineMessage, square === 'empty'
            ? 'There is nothing here to pick up.' : 'You cannot reach the floor.');
        assert.equal(game.context.move, 0);
        game.u.levitating = false;
        assert.equal(await pickupFloorObject(darts, 1), true);
        assert.equal(nearCapacity(game), 1, 'the hero remains slightly burdened');
        assert.doesNotMatch(game._lastPlineMessage, /trouble lifting/);
        assert.equal(game.inventory.find(object => object.otyp === DART)?.quan, 2);
    });
}
void test('an ordinary pickup resets load feedback for the next remote pickup', async () => {
    freshObjectRoom();
    await addInventoryObject(ROCK, { quantity: 70 });
    const darts = await floorObject(DART, 12, 10, { quantity: 2 });
    await floorObject(DART, 10, 10);
    resetInputState().feed(' '.repeat(12));
    await pickupFloorObject(darts, 1);
    await rhack(','.charCodeAt(0));
    await pickupFloorObject(darts, 1);
    assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
    assert.equal(game.inventory.find(object => object.otyp === DART)?.quan, 3);
});
void test('cancelling a combination put-in menu resets load feedback for the next remote pickup', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_COMBINATION } });
    await addInventoryObject(ROCK, { quantity: 70 });
    const sack = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const darts = await floorObject(DART, 12, 10, { quantity: 2 });
    resetInputState().feed(' '.repeat(8));
    await pickupFloorObject(darts, 1);
    assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
    const input = resetInputState();
    await answerPrompts(applyInventoryObject(sack), input, [
        { prompt: /Do what with it\?/, keys: 'i' },
        { prompt: /Put in what\?/, keys: '\x1b' },
    ]);
    assert.equal(sack.contents?.length ?? 0, 0);
    assert.equal(game.context.move, 0, 'cancelling the menu takes no turn');
    input.feed(' '.repeat(8));
    assert.equal(await pickupFloorObject(darts, 1), true);
    assert.equal(nearCapacity(game), 1, 'the hero remains slightly burdened');
    assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
});
//# sourceMappingURL=tool_pickup_encumbrance.test.js.map