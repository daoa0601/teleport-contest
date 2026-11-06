import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { showTextMenuOverlay } from '../js/windows.js';
import { addInventoryItem } from '../js/invent.js';
import { knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';
function screen() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
}
function pager(row) {
    return (row ?? '').slice(1, 9);
}
// C invent.c:dounpaid() fills its window with putstr() and shows it with
// display_nhwindow(), so wintty.c:process_text_window() pages it: every
// full page ends in dmore() on the bottom row, and only quitchars
// (" \r\n\033", decl.c:96) answer that pager.
async function unpaidPutstrRoom(itemCount) {
    await freshObjectRoom({ left: 4, right: 16, top: 4, bottom: 14 });
    game.u.uz = { dnum: 0, dlevel: 1 };
    const { shopkeeper } = await createStaffedShop({
        left: 9, right: 13, top: 9, bottom: 11, keeperX: 12, keeperY: 10,
        doorX: 9, doorY: 10,
    });
    const bill = [];
    for (let index = 0; index < itemCount; index++) {
        // Distinct enchantments keep these real inventory objects separate.
        const item = await knownObject(DAGGER, { spe: index, unpaid: true });
        await addInventoryItem(item);
        bill.push({ bo_id: item.o_id, bquan: 1, useup: false, price: 100 + index });
    }
    shopkeeper.eshk.bill = bill;
    shopkeeper.eshk.billct = bill.length;
}
void test("'I u' pages a putstr unpaid window one screen at a time", async () => {
    // 24 items make 27 rows: a class heading, 24 price lines, a blank and
    // the total — more than the 23 text rows a 24-row terminal shows.
    await unpaidPutstrRoom(24);
    const input = resetInputState();
    input.feed('u'); // answer for the inventory category menu
    const listing = rhack('I'.charCodeAt(0));
    await input.waitUntilBlocked();
    let rows = screen();
    // Page 1 holds 23 text rows (wintty.c:1779) and the pager one column
    // past the origin on the bottom row (dmore(), offset 2).
    assert.match(rows[0] ?? '', /^Unpaid/, `page 1 heading: ${rows[0]}`);
    assert.ok((rows[1] ?? '').startsWith('a - '), `first item row: ${rows[1]}`);
    assert.ok((rows[22] ?? '').startsWith('v - '), `last page-one item row: ${rows[22]}`);
    assert.equal(pager(rows[23]), '--More--', `page 1 pager row: ${rows[23]}`);
    assert.equal((rows[23] ?? '').charAt(0), ' ', `pager starts one column in: ${rows[23]}`);
    // A non-quitchar neither advances the page nor selects anything
    // (xwaitforspace() rings the bell and waits again).
    input.feed('x');
    await input.waitUntilBlocked();
    assert.equal(pager(screen()[23]), '--More--', 'page 1 is still shown');
    // Return is a quitchar: it clears the screen and continues
    // (wintty.c:1787-1792), unlike a menu where Return commits.
    input.feed('\r');
    await input.waitUntilBlocked();
    rows = screen();
    assert.ok((rows[0] ?? '').startsWith('w - '), `page 2 first item row: ${rows[0]}`);
    assert.ok((rows[1] ?? '').startsWith('x - '), `page 2 second item row: ${rows[1]}`);
    assert.match(rows[3] ?? '', /Total/, `page 2 total row: ${rows[3]}`);
    // The final pager sits one row past the last line (wintty.c:1844-1847).
    assert.equal(pager(rows[4]), '--More--', `final pager row: ${rows[4]}`);
    const display = requireGameDisplay();
    assert.deepEqual([display.cursorCol, display.cursorRow], [9, 4]);
    input.feed(' ');
    await listing;
});
void test("Escape at a putstr window's page pager cancels the rest of the window", async () => {
    await unpaidPutstrRoom(24);
    const input = resetInputState();
    input.feed('u');
    const listing = rhack('I'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(screen()[0] ?? '', /^Unpaid/);
    // dmore() leaves morc = '\033', so process_text_window() sets
    // WIN_CANCELLED and drops the remaining lines (wintty.c:1783-1786).
    input.feed('\x1b');
    await listing;
    const rows = screen();
    assert.doesNotMatch(rows[0] ?? '', /^Unpaid/, 'the dismissal redraws the map');
    assert.doesNotMatch(rows.join('\n'), /--More--|\(\d+ of \d+\)/);
});
void test('a putstr window that fits on one screen keeps its single pager', async () => {
    freshPlayableRoom({ flags: { menu_overlay: false } });
    const input = resetInputState();
    const lines = Array.from({ length: 23 }, (_, index) => `line ${index + 1}`);
    const shown = showTextMenuOverlay(lines, { viaPutstr: true });
    await input.waitUntilBlocked();
    const rows = screen();
    assert.ok((rows[0] ?? '').startsWith('line 1'), `first row: ${rows[0]}`);
    assert.ok((rows[22] ?? '').startsWith('line 23'), `last row: ${rows[22]}`);
    assert.equal(pager(rows[23]), '--More--', `pager row: ${rows[23]}`);
    const display = requireGameDisplay();
    assert.deepEqual([display.cursorCol, display.cursorRow], [9, 23]);
    input.feed('x');
    await input.waitUntilBlocked();
    assert.equal(pager(screen()[23]), '--More--');
    input.feed(' ');
    await shown;
});
void test('a 24-row putstr window pages its last row alone', async () => {
    freshPlayableRoom({ flags: { menu_overlay: false } });
    const input = resetInputState();
    const lines = Array.from({ length: 24 }, (_, index) => `line ${index + 1}`);
    const shown = showTextMenuOverlay(lines, { viaPutstr: true });
    await input.waitUntilBlocked();
    assert.equal(pager(screen()[23]), '--More--');
    input.feed(' ');
    await input.waitUntilBlocked();
    const rows = screen();
    assert.ok((rows[0] ?? '').startsWith('line 24'), `page 2 shows the one remaining row: ${rows[0]}`);
    assert.equal(pager(rows[1]), '--More--', `final pager row: ${rows[1]}`);
    input.feed(' ');
    await shown;
});
//# sourceMappingURL=putstr_window_paging.test.js.map