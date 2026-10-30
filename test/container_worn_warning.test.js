import assert from 'node:assert/strict';
import test from 'node:test';
import { useContainer } from '../js/container.js';
import { MENU_FULL, W_ARM, W_ARMF } from '../js/const.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FOOD_RATION, LEATHER_ARMOR, OBJECT_NAMES, SACK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('putting everything in a bag warns once for consecutive worn items', async () => {
    await freshObjectRoom({ flags: { menu_style: MENU_FULL } });
    await addInventoryObject(LEATHER_ARMOR, { owornmask: W_ARM });
    await addInventoryObject(OBJECT_NAMES.indexOf('low boots'), { owornmask: W_ARMF });
    const food = await addInventoryObject(FOOD_RATION, { quan: 4 });
    const sack = await addInventoryObject(SACK, { cknown: true });
    const input = resetInputState();
    const pagedMessages = [];
    input.beforeRead = () => {
        const top = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        if (top.includes('--More--'))
            pagedMessages.push(top);
    };
    input.feed(`iaA\n${' '.repeat(20)}`);
    await useContainer(sack, { held: true });
    assert.equal(pagedMessages.filter(line => /You cannot stash something you are wearing/.test(line)).length, 1);
    assert.ok(pagedMessages.some(line => /You put 4 .*food rations into the sack/.test(line)));
    assert.ok(sack.contents?.includes(food));
});
//# sourceMappingURL=container_worn_warning.test.js.map