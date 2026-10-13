import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ddoinv } from '../js/invent.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { APPLE, DAGGER, FOOD_RATION } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { name, species, type, quantity, text } of [
    { name: 'a ration stack', species: 'human', type: FOOD_RATION, quantity: 3, text: 'Eat one of these' },
    { name: 'a metal dagger in rust monster form', species: 'rust monster', type: DAGGER, quantity: 1, text: 'Eat this' },
]) {
    void test(`the inventory action menu offers eating ${name}`, async () => {
        freshObjectRoom({ hero: { umonnum: MONSTER_NAME.indexOf(species), mh: 20, mhmax: 20 } });
        const item = await addInventoryObject(type, { quan: quantity });
        const input = resetInputState();
        input.feed(item.invlet);
        const menu = ddoinv();
        await input.waitUntilBlocked();
        try {
            const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
            assert.ok(rows.some(row => row.includes(`e - ${text}`)), `Missing eating action: ${text}`);
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
void test('the inventory eating action starts the selected meal without asking about food on the floor', async () => {
    freshObjectRoom();
    const ration = await addInventoryObject(FOOD_RATION, { quan: 3 });
    const apple = await floorObject(APPLE, game.u.ux, game.u.uy);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Comestibles/, keys: ration.invlet },
        { prompt: /e - Eat one of these/, keys: 'e' },
    ]);
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.context.victual?.piece?.otyp, FOOD_RATION);
    assert.equal(apple.where, 'floor');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=inventory_action_food.test.js.map