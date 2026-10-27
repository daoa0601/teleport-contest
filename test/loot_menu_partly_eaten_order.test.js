import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { FOOD_RATION, FORTUNE_COOKIE, SACK } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// The recorder's loot menus order partly eaten food under its full phrase:
// the whole ration stack is offered before the partly eaten piece whichever
// way add_to_container() stacked them, and both rations precede cookies
// ("food ration"/"partly eaten food ration" < "fortune cookie").
for (const partlyFirst of [true, false]) {
    void test(`loot lists rations before cookies with ${partlyFirst ? 'partly eaten' : 'whole'} rations stashed last`, async () => {
        freshObjectRoom();
        const sack = await floorObject(SACK, 10, 10, { cknown: true });
        const partly = await knownObject(FOOD_RATION, { where: 'free', oeaten: 400 });
        const whole = await knownObject(FOOD_RATION, { where: 'free', quan: 2, quantity: 2 });
        await addObjectToContainer(sack, partlyFirst ? whole : partly);
        await addObjectToContainer(sack, partlyFirst ? partly : whole);
        await addObjectToContainer(sack, await knownObject(FORTUNE_COOKIE, { where: 'free' }));
        const input = resetInputState();
        pushKeys('loot\n');
        const looting = rhack('#'.charCodeAt(0));
        await input.waitUntilBlocked();
        input.feed('o');
        await input.waitUntilBlocked();
        const rows = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
        input.feed('\x1b');
        await looting;
        const partlyRow = rows.findIndex(row => /an uncursed partly eaten food ration/.test(row));
        const wholeRow = rows.findIndex(row => /2 uncursed food rations/.test(row));
        const cookieRow = rows.findIndex(row => /an uncursed fortune cookie/.test(row));
        const menu = rows.slice(0, 10).join('\n');
        assert.ok(wholeRow < partlyRow, `the whole ration stack is offered before the partly eaten piece:\n${menu}`);
        assert.ok(wholeRow < cookieRow && cookieRow < partlyRow, `the whole stack sorts under "food ration", the partly eaten piece\n`
            + `under its full phrase, so the cookie falls between:\n${menu}`);
    });
}
//# sourceMappingURL=loot_menu_partly_eaten_order.test.js.map