import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { holdAnotherObject } from '../js/hero_hold_object.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE, OIL_LAMP } from '../js/object_data.js';
import { objectQuantity } from '../js/object_stack.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
function holdingRoom(verbose = true) {
    freshObjectRoom({ gameplaySeed: 97n, flags: { verbose } });
    installPagerInput(resetInputState(), {
        expected: /You catch|You steal|a -|b -/,
        limit: 4,
    });
}
async function displayedMessage() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('a caught object announces its inventory letter after the catch prefix', async () => {
    holdingRoom();
    const dagger = await knownObject(DAGGER, { known: false, bknown: false, spe: 0 });
    const held = await holdAnotherObject(dagger, { holdMessage: 'You catch the dagger!' });
    assert.equal(held.object, dagger);
    assert.equal(dagger.where, 'inventory');
    assert.equal(await displayedMessage(), 'You catch the dagger! a - a dagger.');
});
void test('successful acquisition with only a drop message prints an ordinary inventory line', async () => {
    holdingRoom();
    const dagger = await knownObject(DAGGER, { known: false, bknown: false, spe: 0 });
    await holdAnotherObject(dagger, { dropMessage: 'You drop the dagger!' });
    assert.equal(await displayedMessage(), 'a - a dagger.');
});
void test('an empty hold prefix still requests an ordinary inventory announcement', async () => {
    holdingRoom();
    const dagger = await knownObject(DAGGER, { known: false, bknown: false, spe: 0 });
    await holdAnotherObject(dagger, { holdMessage: '' });
    assert.equal(await displayedMessage(), 'a - a dagger.');
});
for (const verbose of [true, false]) {
    void test(`merged acquisition reports the new quantity${verbose ? ' and total' : ' without a total when terse'}`, async () => {
        holdingRoom(verbose);
        const carried = await addInventoryObject(DAGGER, { quantity: 3, known: false, bknown: false, spe: 0 });
        const caught = await knownObject(DAGGER, { quantity: 2, known: false, bknown: false, spe: 0 });
        const held = await holdAnotherObject(caught, { holdMessage: 'You catch:' });
        assert.equal(held.object, carried);
        assert.equal(objectQuantity(carried), 5);
        assert.equal(carried.quantity, 5);
        assert.equal(caught.where, 'gone');
        assert.equal(await displayedMessage(), verbose
            ? 'You catch: a - 2 daggers (5 in total).'
            : 'You catch: a - 2 daggers');
    });
}
void test('merging a caught weapon preserves the held weapon identity in the inventory description', async () => {
    holdingRoom();
    const carried = await addInventoryObject(DAGGER, { quantity: 2, known: false, bknown: false, spe: 0 });
    await setPrimaryWeapon(carried);
    const caught = await knownObject(DAGGER, { known: false, bknown: false, spe: 0 });
    const held = await holdAnotherObject(caught, { holdMessage: 'You catch:' });
    assert.equal(held.object, carried);
    assert.equal(game.uwep, carried);
    assert.equal(objectQuantity(carried), 3);
    assert.equal(await displayedMessage(), 'You catch: a - a dagger (weapon in right hand) (3 in total).');
});
void test('nonconstant inventory letters are reassigned before announcing a caught object', async () => {
    holdingRoom();
    game.flags.fixinv = false;
    const lamp = await addInventoryObject(OIL_LAMP, { invlet: 'm' });
    const gold = await addInventoryObject(GOLD_PIECE, { quantity: 10 });
    const caught = await knownObject(DAGGER, { invlet: 'Z', known: false, bknown: false, spe: 0 });
    await holdAnotherObject(caught, { holdMessage: 'You catch:' });
    assert.equal(lamp.invlet, 'a');
    assert.equal(caught.invlet, 'b');
    assert.equal(gold.invlet, '$');
    assert.equal(await displayedMessage(), 'You catch: b - a dagger.');
});
void test('a caller-supplied trailing space is retained before the native prinv separator', async () => {
    holdingRoom();
    const dagger = await knownObject(DAGGER, { known: false, bknown: false, spe: 0 });
    await holdAnotherObject(dagger, { holdMessage: 'You steal: ' });
    assert.equal(await displayedMessage(), 'You steal:  a - a dagger.');
});
//# sourceMappingURL=hero_hold_object.test.js.map