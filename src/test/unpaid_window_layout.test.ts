import assert from 'node:assert/strict';
import test from 'node:test';

import { SHOPBASE } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ELVEN_BOOTS, FOOD_RATION } from '../js/object_data.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addInventoryItem } from '../js/u_init.js';
import { knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';
// C invent.c dounpaid() fills its window with putstr(), so tty_putstr's
// measurement (strlen + 1, never tty_end_menu's strlen + 2) places the
// corner, and dmore() falls back to the default "--More--" prompt.
void test('the unpaid-items window measures putstr lines and pagers natively', async () => {
    await freshObjectRoom({ left: 4, right: 16, top: 4, bottom: 14 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({
        left: 9, right: 13, top: 9, bottom: 11, keeperX: 12, keeperY: 10,
        doorX: 9, doorY: 10, shopType: SHOPBASE,
    });
    const boots = await knownObject(ELVEN_BOOTS, { dknown: true, unpaid: true });
    const food = await knownObject(FOOD_RATION, { dknown: true, unpaid: true });
    shopkeeper.eshk.bill = [
        { bo_id: boots.o_id, bquan: 1, useup: false, price: 100 },
        { bo_id: food.o_id, bquan: 1, useup: false, price: 23 },
    ];
    await addInventoryItem(boots);
    await addInventoryItem(food);
    shopkeeper.eshk.billct = 2;
    const input = resetInputState();
    let rows: string[] = [];
    input.beforeRead = () => {
        rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
        return Promise.resolve();
    };
    input.feed('u');
    await answerPrompts(rhack('I'.charCodeAt(0)), input, [
        { prompt: /--More--/, keys: ' ' },
    ]);
    const content = rows.filter(row => /\S/.test(row));
    assert.ok(content.length >= 2, 'the unpaid window should list its items');
    const firstText = content[0]?.search(/\S/) ?? -1;
    // The widest line is 65 characters ("c - " + a name padded to 45 +
    // " <6-wide price> zorkmids"), so the corner origin is 80 - 66 - 1 = 13
    // and the leading putstr space puts the text at column 14.
    for (const row of content) assert.equal(row.search(/\S/), firstText);
    assert.equal(firstText, 14);
    assert.match(content[content.length - 1] ?? '', /--More--/);
});
