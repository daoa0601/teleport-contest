import assert from 'node:assert/strict';
import test from 'node:test';
import { MENU_TRADITIONAL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';

void test('traditional payment buys a single item after its yes-or-no question', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    dagger.unpaid = true;
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
    ] });
    game.flags.menu_style = MENU_TRADITIONAL;
    setHeroGoldAmount(game, 10);
    planInput(resetInputState(), t, [
        { prompt: /dagger.*for 4 zorkmids\.  Pay\?/, keys: 'y' },
        { prompt: /bought .*dagger.*--More--/, keys: ' ' },
    ]);

    await rhack('p'.charCodeAt(0));

    assert.equal(dagger.unpaid, false);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(heroGoldAmount(game), 6);
    assert.equal(game.context.move, 1);
});

void test('traditional itemized payment skips an unaffordable item and buys a later affordable one', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const sack = await addInventoryObject(SACK);
    dagger.unpaid = sack.unpaid = true;
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 8, useup: false },
        { bo_id: sack.o_id, bquan: 1, price: 2, useup: false },
    ] });
    game.flags.menu_style = MENU_TRADITIONAL;
    setHeroGoldAmount(game, 3);
    planInput(resetInputState(), t, [
        { prompt: /Itemized billing\?/, keys: 'y' },
        { prompt: /dagger.*for 8 zorkmids\.  Pay\?/, keys: 'y' },
        { prompt: /enough to pay.*--More--/, keys: ' ' },
        { prompt: /sack.*for 2 zorkmids\.  Pay\?/, keys: 'y' },
        { prompt: /bought .*sack.*--More--/, keys: ' ' },
    ]);

    await rhack('p'.charCodeAt(0));

    assert.equal(dagger.unpaid, true);
    assert.equal(sack.unpaid, false);
    assert.equal(heroGoldAmount(game), 1);
    assert.equal(shopkeeper.eshk.billct, 1);
    assert.equal(game.context.move, 1);
});

void test('declining traditional itemization pays for the whole bill without per-item questions', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const sack = await addInventoryObject(SACK);
    dagger.unpaid = sack.unpaid = true;
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
        { bo_id: sack.o_id, bquan: 1, price: 2, useup: false },
    ] });
    game.flags.menu_style = MENU_TRADITIONAL;
    setHeroGoldAmount(game, 10);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Itemized billing\?/, keys: 'n' },
        { prompt: /bought .*dagger.*--More--/, keys: ' ' },
        { prompt: /bought .*sack.*--More--/, keys: ' ' },
    ]);

    await rhack('p'.charCodeAt(0));

    assert.equal(dagger.unpaid, false);
    assert.equal(sack.unpaid, false);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(heroGoldAmount(game), 4);
    assert.equal(game.context.move, 1);
});

void test('a priest learns blessings and curses when buying without itemization', async (t) => {
    freshObjectRoom({ role: 'priest' });
    const dagger = await addInventoryObject(DAGGER, {
        blessed: true, bknown: false, observed: false,
    });
    const sack = await addInventoryObject(SACK, {
        initialize: false, cursed: true, bknown: false, observed: false,
    });
    dagger.unpaid = sack.unpaid = true;
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
        { bo_id: sack.o_id, bquan: 1, price: 2, useup: false },
    ] });
    game.flags.menu_style = MENU_TRADITIONAL;
    setHeroGoldAmount(game, 10);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    planInput(input, t, [
        { prompt: /Itemized billing\?/, keys: 'n' },
        { prompt: /bought .*dagger.*--More--/, keys: ' ' },
        { prompt: /bought .*sack.*--More--/, keys: ' ' },
    ]);

    await rhack('p'.charCodeAt(0));

    assert.equal(dagger.bknown, true, 'Purchased blessed goods reveal their blessing to a priest');
    assert.equal(sack.bknown, true, 'Purchased cursed goods reveal their curse to a priest');
    assert.match(messages.join('\n'), /bought a blessed .*dagger/);
    assert.match(messages.join('\n'), /bought a cursed sack/);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(heroGoldAmount(game), 4);
    assert.equal(game.context.move, 1);
});

void test('a menu prefix switches traditional payment to item selection', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    dagger.unpaid = true;
    await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
    ] });
    game.flags.menu_style = MENU_TRADITIONAL;
    setHeroGoldAmount(game, 4);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Pay for which items\?/, keys: '\u001b' },
    ]);
    input.feed('p');

    await rhack('m'.charCodeAt(0));

    assert.equal(dagger.unpaid, true);
    assert.equal(heroGoldAmount(game), 4);
    assert.equal(game.context.move, 0);
});
