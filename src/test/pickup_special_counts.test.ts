import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER, CHEST, LOADSTONE } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a giant can pick up a counted subset of a boulder stack', async () => {
    freshPlayableRoom();
    game.u.umonster = 260;
    game.u.umonnum = MONSTER_NAME.indexOf('hill giant');
    game.u.mtimedone = 100;
    const boulders = await floorObject(BOULDER, 10, 10, { quantity: 5 });
    pushKeys('2,');

    await rhack(0);

    assert.equal(game.inventory.find(object => object.otyp === BOULDER)?.quan, 2);
    assert.equal(boulders.quan, 3);
});

void test('a counted container selection splits loadstones before lifting them', async () => {
    freshPlayableRoom();
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const stones = await knownObject(LOADSTONE, {
        where: 'contained', container: chest, quantity: 5, cursed: true,
    });
    chest.contents = [stones];

    await runExtendedCommand('loot', 'o2a\n    ');

    assert.equal(game.inventory.find(object => object.otyp === LOADSTONE)?.quan, 2);
    assert.equal(stones.quan, 3);
    assert.equal(chest.contents.includes(stones), true);
});
