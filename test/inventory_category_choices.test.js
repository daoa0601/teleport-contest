import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MENU_FULL } from '../js/const.js';
import { DAGGER, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';
void test('the inventory category menu accepts object-class symbol shortcuts', async (t) => {
    freshObjectRoom({ flags: { menu_style: MENU_FULL } });
    await addInventoryObject(DAGGER);
    const potion = await addInventoryObject(POT_HEALING);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What type of object do you want an inventory of\?/, keys: '!' },
        { prompt: /Potions[\s\S]*potion of healing/, keys: potion.invlet },
        { prompt: /Do what with the potion of healing\?/, keys: '\x1b' },
    ]);
    await rhack('I'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('traditional inventory ignores an invalid category key before accepting a class', async (t) => {
    freshObjectRoom({ flags: { menu_style: 0 } });
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What type of object do you want an inventory of\?/, keys: 'v)' },
        { prompt: /Weapons[\s\S]*dagger/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: '\x1b' },
    ]);
    await rhack('I'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('inventory of unpaid objects reports the agreed shop price without spending time', async (t) => {
    freshObjectRoom({ flags: { menu_style: 0 } });
    const dagger = await addInventoryObject(DAGGER, { unpaid: true });
    await createStaffedShop({ bill: [{ bo_id: dagger.o_id, bquan: 1, price: 17, useup: false }] });
    const input = resetInputState();
    planInput(input, t, [{ prompt: /What type of object do you want an inventory of\?/, keys: 'u' }]);
    await rhack('I'.charCodeAt(0));
    assert.match(game._pending_message, /dagger\s+17 zorkmids$/);
    assert.doesNotMatch(game._pending_message, /\(unpaid/);
    assert.equal(game.context.move, 0);
});
void test('inventory of used-up objects names their consumed quantity and total bill', async (t) => {
    freshObjectRoom({ flags: { menu_style: 0 } });
    await addInventoryObject(POT_HEALING);
    const used = await knownObject(DAGGER, { quan: 4, where: 'onbill' });
    game.billObjects = [used];
    await createStaffedShop({ bill: [{ bo_id: used.o_id, bquan: 4, price: 10, useup: true }] });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What type of object do you want an inventory of\?/, keys: 'x' },
        { prompt: /Unpaid articles already used up:[\s\S]*4 .*daggers[\s\S]*Total:\s+40 zorkmids/, keys: ' ' },
    ]);
    await rhack('I'.charCodeAt(0));
    assert.equal(used.quan, 4);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_category_choices.test.js.map