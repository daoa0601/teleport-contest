import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MENU_COMBINATION, MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL } from '../js/const.js';
import { DAGGER, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';

void test('the inventory category menu accepts object-class symbol shortcuts', async t => {
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

void test('traditional inventory ignores an invalid category key before accepting a class', async t => {
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

const promptMenuStyles: readonly (typeof MENU_TRADITIONAL | typeof MENU_COMBINATION)[] = [MENU_TRADITIONAL, MENU_COMBINATION];
for (const style of promptMenuStyles) {
    void test(`inventory class prompts follow carried object order in menu style ${style}`, async t => {
        freshObjectRoom({ flags: { menu_style: style } });
        await addInventoryObject(POT_HEALING);
        await addInventoryObject(DAGGER);
        await addInventoryObject(POT_HEALING);
        const input = resetInputState();
        planInput(input, t, [{
            prompt: /What type of object do you want an inventory of\? \[!\) /,
            keys: '\x1b',
        }]);

        await rhack('I'.charCodeAt(0));

        assert.equal(game.context.move, 0);
    });
}

void test('inventory of unpaid objects reports the agreed shop price without spending time', async t => {
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

void test('inventory of used-up objects names their consumed quantity and total bill', async t => {
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

void test('used-up potions reveal their appearance on the bill only after sight returns', async t => {
    freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL }, hero: { blindTurns: 10 } });
    await addInventoryObject(DAGGER);
    const used = await knownObject(POT_HEALING, {
        where: 'onbill', quan: 1, dknown: false, bknown: false, known: false, typeKnown: false,
    });
    game.billObjects = [used];
    await createStaffedShop({ bill: [{ bo_id: used.o_id, bquan: 3, price: 10, useup: true }] });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What type of object do you want an inventory of\?/, keys: 'x' },
        { prompt: /x - 3 potions\s+30 zorkmids/, keys: ' ' },
        { prompt: /What type of object do you want an inventory of\?/, keys: 'x' },
        { prompt: /x - 3 \w[\w -]* potions\s+30 zorkmids/, keys: ' ' },
    ]);

    await rhack('I'.charCodeAt(0));
    assert.equal(used.dknown, false);
    game.u.blindTurns = 0;
    await rhack('I'.charCodeAt(0));

    assert.equal(used.dknown, true);
    assert.equal(used.quan, 1);
    assert.equal(game.context.move, 0);
});

const categoryMenuStyles: readonly (typeof MENU_FULL | typeof MENU_PARTIAL)[] = [MENU_FULL, MENU_PARTIAL];
for (const style of categoryMenuStyles) {
    void test(`an empty pack with a used-up bill has no inventory category menu in style ${style}`, async t => {
        freshObjectRoom({ flags: { menu_style: style } });
        const used = await knownObject(DAGGER, { where: 'onbill' });
        game.billObjects = [used];
        await createStaffedShop({ bill: [{ bo_id: used.o_id, bquan: 1, price: 10, useup: true }] });
        const input = resetInputState();
        planInput(input, t, []);
        await rhack('I'.charCodeAt(0));
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, '');
    });
}
