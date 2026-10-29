import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { FOOD_RATION, FORTUNE_COOKIE, SACK } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C invent.c:loot_xname()/sortloot_cmp() sort rations under "food ration",
// regardless of oeaten. Tied rations keep chain order; both precede cookies.
for (const partlyFirst of [true, false]) {
    void test(`loot lists rations before cookies and keeps ${partlyFirst ? 'partly eaten' : 'whole'} rations first when stashed last`, async () => {
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
        assert.ok(partlyRow >= 0 && wholeRow >= 0 && cookieRow >= 0, `all foods must be listed:\n${menu}`);
        assert.ok((partlyFirst ? partlyRow < wholeRow : wholeRow < partlyRow), `equal ration names must keep container chain order:\n${menu}`);
        assert.ok(partlyRow < cookieRow && wholeRow < cookieRow, `both rations sort under food ration before fortune cookie:\n${menu}`);
    });
}
for (const partlyFirst of [true, false]) {
    void test(`loot lists fresh rations before rotten rations when ${partlyFirst ? 'rotten' : 'fresh'} rations were stashed last`, async () => {
        freshObjectRoom();
        const sack = await floorObject(SACK, 10, 10, { cknown: true });
        const rotten = await knownObject(FOOD_RATION, { where: 'free', oeaten: 400, orotten: true });
        const fresh = await knownObject(FOOD_RATION, { where: 'free', quan: 2, quantity: 2 });
        await addObjectToContainer(sack, partlyFirst ? fresh : rotten);
        await addObjectToContainer(sack, partlyFirst ? rotten : fresh);
        const input = resetInputState();
        pushKeys('loot\n');
        const looting = rhack('#'.charCodeAt(0));
        await input.waitUntilBlocked();
        input.feed('o');
        await input.waitUntilBlocked();
        const rows = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
        input.feed('\x1b');
        await looting;
        const rottenRow = rows.findIndex(row => /an uncursed partly eaten food ration/.test(row));
        const freshRow = rows.findIndex(row => /2 uncursed food rations/.test(row));
        const menu = rows.slice(0, 10).join('\n');
        assert.ok(rottenRow >= 0 && freshRow >= 0, `both ration stacks must be listed:\n${menu}`);
        assert.ok(freshRow < rottenRow, `fresh rations must precede rotten rations:\n${menu}`);
        assert.equal(rotten.orotten, true, 'sorting preserves the food condition');
    });
}
//# sourceMappingURL=loot_menu_partly_eaten_order.test.js.map