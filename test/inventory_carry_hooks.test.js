import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ACH_AMUL, ACH_BELL, ACH_BOOK, ACH_CNDL, LOST_THROWN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, DAGGER, SACK, SPE_BOOK_OF_THE_DEAD } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const [otyp, achievement] of [
    [AMULET_OF_YENDOR, ACH_AMUL], [BELL_OF_OPENING, ACH_BELL],
    [CANDELABRUM_OF_INVOCATION, ACH_CNDL], [SPE_BOOK_OF_THE_DEAD, ACH_BOOK],
]) {
    void test(`picking up invocation object ${otyp} records its achievement`, async (t) => {
        assert.ok(otyp !== undefined && achievement !== undefined);
        freshObjectRoom();
        await floorObject(otyp, game.u.ux, game.u.uy);
        const input = resetInputState();
        planInput(input, t, []);
        await rhack(','.charCodeAt(0));
        assert.ok(game.u.uachieved?.includes(achievement));
        assert.equal(game.context.move, 1);
    });
}
void test('picking up a container clears its contents no-charge flags outside a shop', async (t) => {
    freshObjectRoom();
    const sack = await floorObject(SACK, game.u.ux, game.u.uy, { cknown: true });
    const dagger = await knownObject(DAGGER, { no_charge: true });
    await addCreatedObjectToContainer(sack, dagger);
    const input = resetInputState();
    planInput(input, t, []);
    await rhack(','.charCodeAt(0));
    assert.equal(dagger.no_charge, false);
    assert.equal(dagger.container, sack);
});
void test('recovering a thrown weapon fills an empty quiver even when autoquiver is off', async (t) => {
    freshObjectRoom({ flags: { autoquiver: false, pickup_thrown: true } });
    const dagger = await floorObject(DAGGER, game.u.ux, game.u.uy, { how_lost: LOST_THROWN });
    const input = resetInputState();
    planInput(input, t, []);
    await rhack(','.charCodeAt(0));
    assert.equal(game.uquiver, dagger);
    assert.equal(dagger.how_lost, 0);
});
//# sourceMappingURL=inventory_carry_hooks.test.js.map