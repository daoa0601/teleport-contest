import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ROCK, STATUE, WAN_STRIKING } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('striking a named statue leaves ordinary unnamed rocks', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const statue = await floorObject(STATUE, 10, 10, {
        corpsenm: MONSTER_NAME.indexOf('troll'), oname: 'Masterpiece',
        oextra: { oname: 'Masterpiece' },
    });
    const wand = await addInventoryObject(WAN_STRIKING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /statue|rocks|stones|Masterpiece|here/, limit: 4 });
    input.feed(`${wand.invlet}>`);

    await rhack('z'.charCodeAt(0));
    await rhack(':'.charCodeAt(0));

    assert.equal(statue.otyp, ROCK);
    assert.equal(statue.where, 'floor');
    assert.match(inventoryItemDescription(statue), /rocks|stones/);
    assert.doesNotMatch(inventoryItemDescription(statue), /Masterpiece/);
});
