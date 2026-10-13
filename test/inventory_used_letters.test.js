import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { selectUsedInventoryLetter } from '../js/invent.js';
import { CLUB, DAGGER, FOOD_RATION } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const sortpack of [true, false]) {
    void test(`the used-letter menu preserves carried order with full loot sorting and sortpack ${sortpack}`, async () => {
        freshObjectRoom({ flags: { sortloot: 'f', sortpack, inv_order: [7, 2] } });
        const club = await knownObject(CLUB, { where: 'inventory', invlet: 'z' });
        const dagger = await knownObject(DAGGER, { where: 'inventory', invlet: 'a' });
        const food = await knownObject(FOOD_RATION, { where: 'inventory', invlet: 'b' });
        game.inventory.push(club, dagger, food);
        const input = resetInputState();
        const menu = selectUsedInventoryLetter(null);
        await input.waitUntilBlocked();
        try {
            const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
            const clubRow = rows.findIndex(row => /z - .*club/.test(row));
            const daggerRow = rows.findIndex(row => /a - .*dagger/.test(row));
            const foodRow = rows.findIndex(row => /b - .*food ration/.test(row));
            assert.ok(clubRow >= 0 && daggerRow >= 0 && foodRow >= 0, 'all three carried items are listed');
            assert.ok(clubRow < daggerRow, 'the club carried before the dagger is listed first');
            assert.equal(foodRow < clubRow, sortpack, 'only sortpack groups items in pack class order');
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
//# sourceMappingURL=inventory_used_letters.test.js.map