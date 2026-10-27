import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { FOOD_RATION, SACK } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C invent.c:sortloot()/loot_xname(): with the default sortloot:'l', loot
// menus (container take-out, floor pickup) order their entries by class,
// subclass, discovery status, and then the alphabetized minimal name. A
// partly eaten ration carries that phrase in its loot name, so the untouched
// stack is offered first even though add_to_container() prepends each new
// item, leaving the partly eaten piece (put in last) at the chain head.
void test('a loot menu offers an untouched stack before a partly eaten ration', async () => {
    freshObjectRoom();
    const sack = await floorObject(SACK, 10, 10, { cknown: true });
    const partlyEaten = await knownObject(FOOD_RATION,
        { where: 'contained', container: sack, oeaten: 400 });
    const untouched = await knownObject(FOOD_RATION,
        { where: 'contained', container: sack, quan: 2 });
    sack.contents = [partlyEaten, untouched];

    const input = resetInputState();
    pushKeys('loot\n');
    const looting = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('o');
    await input.waitUntilBlocked();

    const rows = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
    const plainRow = rows.findIndex(row => /a - 2 uncursed food rations/.test(row));
    const partlyRow = rows.findIndex(row => /b - an uncursed partly eaten food ration/.test(row));
    assert.notEqual(plainRow, -1, `menu must list the untouched stack first: ${JSON.stringify(rows.slice(0, 8))}`);
    assert.notEqual(partlyRow, -1, `menu must list the partly eaten ration second: ${JSON.stringify(rows.slice(0, 8))}`);
    assert.ok(plainRow < partlyRow, 'the untouched stack must be offered before the partly eaten ration');

    input.feed('\x1b');
    await looting;
});
