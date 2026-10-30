import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { bot } from '../js/display.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_MAGIC_RESISTANCE, DAGGER, LEATHER_GLOVES, MAGIC_MARKER, POT_EXTRA_HEALING, POT_OIL, RIN_PROTECTION, RIN_REGENERATION, SCR_IDENTIFY, SCR_LIGHT, SPE_FORCE_BOLT, SPE_KNOCK, WAN_FIRE, WAN_MAGIC_MISSILE, } from '../js/object_data.js';
import { createStaffedShop } from './support/shop.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function screenRow(row) {
    return requireScreenRow(row).map(cell => cell.ch).join('').trimEnd();
}
// C select_menu() holds bot_disabled across the whole windowport call, so a
// corner menu that covers the status rows is dismissed by docorner() with
// bot() suppressed: the status stays blank past the menu's left edge until
// the next moveloop bot() redraws it. The item-action menu that opens right
// after the tall inventory menu therefore frames over that damaged status.
void test('an inventory item action frames over the damaged status window', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
    // Eight class headings plus fourteen items: the inventory menu spans 23
    // rows including its (end) pager, deep enough to cover both status rows
    // but still short enough to stay a corner (overlay) menu.
    await addInventoryObject(DAGGER);
    await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE);
    await addInventoryObject(SCR_IDENTIFY);
    await addInventoryObject(SCR_LIGHT);
    await addInventoryObject(SPE_FORCE_BOLT);
    await addInventoryObject(SPE_KNOCK);
    const potion = await addInventoryObject(POT_OIL);
    await addInventoryObject(POT_EXTRA_HEALING);
    await addInventoryObject(RIN_PROTECTION);
    await addInventoryObject(RIN_REGENERATION);
    await addInventoryObject(WAN_MAGIC_MISSILE);
    await addInventoryObject(WAN_FIRE);
    await addInventoryObject(MAGIC_MARKER);
    await addInventoryObject(LEATHER_GLOVES);
    // Normal play has rendered the status window before the hero opens the
    // inventory; model that last bot() here.
    await bot();
    const input = resetInputState();
    const inventory = rhack('i'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(screenRow(0), /Weapons/);
    input.feed(potion.invlet);
    await input.waitUntilBlocked();
    assert.match(screenRow(0), /Do what with the potion of oil\?/);
    // docorner() blanked both status rows from the menu's left edge and the
    // suppressed bot() never redrew them before this frame.
    assert.ok(screenRow(22).startsWith('Hero the Wanderer'), `status row 0 keeps the hero title: ${JSON.stringify(screenRow(22))}`);
    assert.ok(!screenRow(22).includes('St:'), `status row 0 is not redrawn: ${JSON.stringify(screenRow(22))}`);
    assert.ok(screenRow(23).includes('HP:40(40)'), `status row 1 keeps its start: ${JSON.stringify(screenRow(23))}`);
    assert.ok(!screenRow(23).includes('Satiated'), `status row 1 is not redrawn: ${JSON.stringify(screenRow(23))}`);
    input.feed('\x1b');
    await inventory;
    // Back in the main loop, the deferred botlx forces the full redraw the
    // menu dismissal skipped.
    assert.ok(screenRow(22).includes('St:'), `status row 0 is fully redrawn: ${JSON.stringify(screenRow(22))}`);
    assert.ok(screenRow(23).includes('Satiated'), `status row 1 is fully redrawn: ${JSON.stringify(screenRow(23))}`);
});
// A full-screen (offx == 0) menu takes the other C dismissal branch:
// erase_menu_or_text() runs docrt(), whose cls wipes the whole screen, and
// the still-suppressed bot() leaves the status blank until the main loop
// redraws it. The follow-up picker menu therefore frames over blank status.
void test('a full-screen drop-category menu leaves the status blank for the picker', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
    // The "Just picked up:" entry with a called cloak widens the category
    // menu past the corner limit, forcing C's full-screen layout.
    const cloak = await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE, {
        spe: 0, oextra: { oname: 'abcdefghijklmnopqrst' },
    });
    cloak.pickup_prev = true;
    await addInventoryObject(DAGGER);
    await bot();
    const input = resetInputState();
    const dropping = rhack('D'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(screenRow(0), /Drop what type of items\?/);
    input.feed('a\r');
    await input.waitUntilBlocked();
    assert.match(screenRow(0), /What would you like to drop\?/);
    assert.ok(!screenRow(22).includes('St:'), `status row 0 stays blank: ${JSON.stringify(screenRow(22))}`);
    assert.ok(!screenRow(23).includes('Satiated'), `status row 1 stays blank: ${JSON.stringify(screenRow(23))}`);
    input.feed('\x1b');
    await dropping;
    await bot();
    assert.ok(screenRow(22).includes('St:'), `status row 0 is redrawn afterwards: ${JSON.stringify(screenRow(22))}`);
});
// C shows the unpaid-items window with display_nhwindow() and
// destroy_nhwindow() (invent.c:3786), outside select_menu(): bot_disabled
// stays clear, so the dismissal's docrt()/docorner() redraws the wrecked
// status window immediately rather than deferring to the next moveloop.
void test('an unpaid-items overlay redraws the status window at dismissal', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
    const { shopkeeper, roomno } = await createStaffedShop();
    game.u.ushops = [roomno];
    const types = [DAGGER, CLOAK_OF_MAGIC_RESISTANCE, SCR_IDENTIFY, SCR_LIGHT,
        SPE_FORCE_BOLT, SPE_KNOCK, POT_OIL, POT_EXTRA_HEALING, RIN_PROTECTION,
        RIN_REGENERATION, WAN_MAGIC_MISSILE, WAN_FIRE, MAGIC_MARKER, LEATHER_GLOVES];
    for (const otyp of types) {
        const item = await addInventoryObject(otyp, { unpaid: true });
        shopkeeper.eshk.bill.push({ bo_id: item.o_id, bquan: 1, price: 10, useup: false });
        shopkeeper.eshk.billct++;
    }
    await bot();
    const input = resetInputState();
    const listing = rhack('I'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(screenRow(0), /What type of object do you want an inventory of\?/);
    input.feed('u');
    await input.waitUntilBlocked();
    assert.match(screenRow(0), /Unpaid Weapons/);
    assert.ok(!screenRow(22).includes('St:'), `the tall overlay covers the status: ${JSON.stringify(screenRow(22))}`);
    input.feed('\x1b');
    await listing;
    assert.ok(screenRow(22).includes('St:'), `dismissal redraws the status at once: ${JSON.stringify(screenRow(22))}`);
    assert.ok(screenRow(23).includes('Satiated'), `dismissal redraws status row 1: ${JSON.stringify(screenRow(23))}`);
});
//# sourceMappingURL=inventory_action_status.test.js.map