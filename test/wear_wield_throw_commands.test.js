// Command-front-end behavior for the do_wear.c, wield.c, and dothrow.c
// owners moved out of cmd.js: swapping weapons (wield.c:doswapweapon()),
// choosing a ring finger while putting a ring on (do_wear.c:doputon() ->
// accessory_or_armor_on()), clearing the quiver (wield.c:dowieldquiver() ->
// doquiver_core()), and refusing gold thrown at the hero (dothrow.c
// throw_gold() via throw_obj()).
import test from 'node:test';
import assert from 'node:assert/strict';
import { doputon } from '../js/do_wear.js';
import { dothrow } from '../js/dothrow.js';
import { doready, doswapweapon } from '../js/wield.js';
import { ECMD_CANCEL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ARROW, DAGGER, MACE, RIN_PROTECTION } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { carriedGold } from './support/gold-arena.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function commandRoom(expected) {
    await freshObjectRoom();
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 20 });
}
// C wield.c:doswapweapon(): after ready_weapon() installs the old secondary
// as the new primary, the displaced primary becomes the secondary and its
// inventory description is reported before the turn is spent.
void test('swapping weapons reports the displaced primary as the new secondary', async () => {
    await commandRoom(/dagger|mace|weapon/);
    const dagger = await addInventoryObject(DAGGER, { invlet: 'a' });
    const mace = await addInventoryObject(MACE, { invlet: 'b' });
    await setPrimaryWeapon(dagger);
    await setSecondaryWeapon(mace);
    await doswapweapon();
    assert.equal(game.uwep, mace, 'the old secondary becomes the primary');
    assert.equal(game.uswapwep, dagger, 'the old primary becomes the secondary');
    assert.equal(game.context.move, 1, 'ready_weapon() spent the turn');
    assert.match(String(game._pending_message ?? ''), /^a - .*dagger.*$/m, 'prinv() names the displaced primary');
});
// C do_wear.c:doputon() -> accessory_or_armor_on(): with both ring slots
// empty, the command asks which finger to use; the answer installs the ring
// in that slot and spends the turn.
void test("answering 'l' wears a ring on the left hand", async () => {
    await commandRoom(/ring|finger|protection/);
    const ring = await addInventoryObject(RIN_PROTECTION, {
        invlet: 'c', dknown: true, bknown: true,
    });
    pushKeys(`${ring.invlet}l`);
    await doputon();
    assert.equal(game.uleft, ring, 'the ring is worn on the left hand');
    assert.ok(!game.uright, 'the right ring slot stays empty');
    assert.equal(game.context.move, 1);
});
void test("answering 'r' wears a ring on the right hand", async () => {
    await commandRoom(/ring|finger|protection/);
    const ring = await addInventoryObject(RIN_PROTECTION, {
        invlet: 'c', dknown: true, bknown: true,
    });
    pushKeys(`${ring.invlet}r`);
    await doputon();
    assert.equal(game.uright, ring, 'the ring is worn on the right hand');
    assert.ok(!game.uleft, 'the left ring slot stays empty');
    assert.equal(game.context.move, 1);
});
// C wield.c:dowieldquiver() -> doquiver_core(): '-' empties the quiver
// without spending a turn.
void test('readying the empty quiver clears the readied ammunition', async () => {
    await commandRoom(/readied|quiver|arrow/);
    const arrows = await addInventoryObject(ARROW, { invlet: 'a', quan: 5 });
    await setQuiverObject(arrows);
    pushKeys('-');
    await doready();
    assert.equal(game.uquiver, null);
    assert.equal(game.context.move, 0);
    assert.match(String(game._pending_message ?? ''), /You now have no ammunition readied\./);
});
// C dothrow.c:throw_gold(): gold thrown at the hero is refused with
// ECMD_CANCEL, the purse stays carried, and no turn passes.
void test('throwing gold at the hero is refused without spending the turn', async () => {
    await commandRoom(/gold|throw|direction/);
    const purse = await carriedGold(100);
    pushKeys('.');
    await dothrow(purse);
    assert.match(String(game._pending_message ?? ''), /You cannot throw gold at yourself\./);
    assert.equal(game.context.move, 0);
    assert.ok((game._commandResult ?? 0) & ECMD_CANCEL, 'throw_gold() returns ECMD_CANCEL');
    assert.ok(game.inventory.includes(purse), 'the purse is still carried');
});
//# sourceMappingURL=wear_wield_throw_commands.test.js.map