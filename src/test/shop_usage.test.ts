import { requireScreenRow } from './support/screen.js';
import type { KnownObjectOverrides } from './support/game-objects.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { A_CHA } from '../js/const.js';
import { clearMessageWindow, pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    BAG_OF_TRICKS, MAGIC_LAMP, OIL_LAMP, SPE_FORCE_BOLT, WAN_LIGHT,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { chargeUnpaidUsage } from '../js/shk.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

async function pickUpMerchandise(type: number, properties: KnownObjectOverrides = {}, charisma = 12) {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_CHA] = charisma;
    game.u.amax.a[A_CHA] = charisma;
    const { shopkeeper } = await createStaffedShop();
    const object = await floorObject(type, game.u.ux, game.u.uy, properties);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await rhack(','.charCodeAt(0));
    assert.equal(object.unpaid, true);
    clearMessageWindow();
    return { object, shopkeeper, input };
}

void test('studying charges the rounded partial price and leaves the book on its bill', async () => {
    const { object: book, shopkeeper } = await pickUpMerchandise(SPE_FORCE_BOLT, {}, 18);
    requirePlayingGame(game);
    const bill = shopkeeper.eshk.bill.find(entry => entry.bo_id === book.o_id);
    assert.ok(bill != null, 'Expected bill to be initialized');
    assert.equal(bill.price, 67);

    await chargeUnpaidUsage(book);

    assert.equal(shopkeeper.eshk.debit, 54);
    assert.equal(book.unpaid, true);
    assert.equal(game.inventory.includes(book), true);
    assert.equal(bill.useup, false);
    assert.match(game._pending_message, /You owe 54 zorkmids\./u);
    clearMessageWindow();
    await chargeUnpaidUsage(book);
    assert.equal(shopkeeper.eshk.debit, 108);
    assert.match(game._pending_message, /You owe an additional 54 zorkmids\./u);
});

void test('the usage warning finishes before the shop adds the debt', async () => {
    const { object: book, shopkeeper, input } = await pickUpMerchandise(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    input.beforeRead = null;
    await pline('You finish reading the many intricate runes on the last page of the book.');
    const charging = chargeUnpaidUsage(book);
    await input.waitUntilBlocked();
    assert.equal(shopkeeper.eshk.debit, 0);
    input.beforeRead = () => input.feed(' ');
    input.feed(' ');
    await charging;
    assert.equal(shopkeeper.eshk.debit, 80);
});

void test('deaf readers still owe a fee without hearing a warning', async () => {
    const { object: book, shopkeeper } = await pickUpMerchandise(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    game.u.deafTurns = 10;
    await chargeUnpaidUsage(book);
    assert.equal(shopkeeper.eshk.debit, 80);
    assert.equal(game._pending_message, '');
});

void test('an unpaid item incurs no usage fee outside a shop', async () => {
    const { object: book, shopkeeper } = await pickUpMerchandise(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    // Four steps south leave the real room and update shop membership.
    for (let step = 0; step < 4; step++) await rhack('j'.charCodeAt(0));
    assert.equal(game.u.ushops.length, 0);
    const debt = shopkeeper.eshk.debit;
    await chargeUnpaidUsage(book);
    assert.equal(shopkeeper.eshk.debit, debt);
});

void test('using the last wand charge costs more than using a well-charged wand', async () => {
    const { object: wand, shopkeeper } = await pickUpMerchandise(WAN_LIGHT, { spe: 3 });
    requirePlayingGame(game);
    await chargeUnpaidUsage(wand);
    assert.equal(shopkeeper.eshk.debit, 25);
    wand.spe = 1;
    await chargeUnpaidUsage(wand);
    assert.equal(shopkeeper.eshk.debit, 125);
    wand.spe = 0;
    await chargeUnpaidUsage(wand);
    assert.equal(shopkeeper.eshk.debit, 125);
});

void test('releasing a magic lamp costs more than lighting it', async () => {
    const { object: lamp, shopkeeper } = await pickUpMerchandise(MAGIC_LAMP, { spe: 1 });
    requirePlayingGame(game);
    await chargeUnpaidUsage(lamp);
    assert.equal(shopkeeper.eshk.debit, 10);
    await chargeUnpaidUsage(lamp, { alternate: true });
    assert.equal(shopkeeper.eshk.debit, 76);
});

void test('emptying a bag at once costs the full price instead of one-use rent', async () => {
    const { object: bag, shopkeeper } = await pickUpMerchandise(BAG_OF_TRICKS, { spe: 10 });
    requirePlayingGame(game);
    await chargeUnpaidUsage(bag);
    assert.equal(shopkeeper.eshk.debit, 20);
    initRng(1n);
    await chargeUnpaidUsage(bag, { alternate: true });
    assert.equal(shopkeeper.eshk.debit, 120);
    assert.match(game._pending_message, /Emptying that will cost you 100 zorkmids\./u);
});


void test('rubbing a shop magic lamp charges for releasing its djinni before it becomes an oil lamp', async () => {
    const { object: lamp, shopkeeper, input } = await pickUpMerchandise(MAGIC_LAMP, { spe: 1 });
    requirePlayingGame(game);
    assert.ok(lamp.invlet);
    input.feed(lamp.invlet);
    await rhack('w'.charCodeAt(0));
    assert.equal(game.uwep, lamp);
    initRng(1n);
    input.feed(`rub\n${lamp.invlet}`);
    const messages: string[] = [];
    input.beforeRead = () => {
        const message = game._pending_message || '';
        messages.push(message);
        const row = requireScreenRow(0);
        assert.ok(row);
        const top = row.map(cell => cell.ch).join('');
        input.feed(top.includes('--More--') ? ' '
            : /For what do you wish/u.test(message) ? 'nothing\n' : ' ');
    };

    await rhack('#'.charCodeAt(0));

    messages.push(game._pending_message || '');
    assert.equal(lamp.otyp, OIL_LAMP);
    assert.equal(shopkeeper.eshk.debit, 66);
    assert.equal(lamp.unpaid, true);
    assert.match(messages.join('\n'), /Usage fee, 66 zorkmids\./u);
});


for (const [species, insult] of [['quasit', 'beast'], ['vrock', 'fiend']] as const) {
    void test(`the library warning addresses a ${species} as ${insult}`, async () => {
        const { object: book, shopkeeper } = await pickUpMerchandise(SPE_FORCE_BOLT);
        requirePlayingGame(game);
        await polymonHero(MONSTER_NAME.indexOf(species));
        clearMessageWindow();
        initRng(8n);
        await chargeUnpaidUsage(book);
        assert.equal(shopkeeper.eshk.debit, 80);
        assert.ok(game._pending_message.includes(`This is no free library, ${insult}!`));
    });
}
