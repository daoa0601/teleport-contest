import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POOL } from '../js/const.js';
import { CHEST, CLUB, DART, SADDLE } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('counted loot inside a swallower picks up the whole selected stack', async () => {
    freshPlayableRoom();
    const worm = await createMonsterAt('purple worm', 11, 10);
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    const darts = await knownObject(DART, { quantity: 5 });
    await addObjectToMonsterInventory(worm, darts);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    pushKeys('3#loot\n.');

    await rhack(0);

    assert.equal(game.inventory.find(object => object.otyp === DART)?.quan, 5);
    assert.equal(worm.minvent.includes(darts), false);
    assert.equal(game.context.move, 1);
});

void test('loot can remove the saddle from an adjacent monster', async () => {
    freshPlayableRoom();
    const horse = await createSaddledSteed('horse');
    const saddle = horse.minvent.find(object => object.otyp === SADDLE);
    assert.ok(saddle);

    await runExtendedCommand('loot', 'ly    ');

    assert.equal(game.inventory.includes(saddle), true);
    assert.equal(horse.minvent.includes(saddle), false);
    assert.equal(horse.saddle, null);
    assert.equal(game.context.move, 1);
});

void test('loot selects a floor container before offering its actions', async () => {
    freshPlayableRoom();
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    const other = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: false });

    await runExtendedCommand('loot', 'b\noa\n    ');

    assert.equal(game.inventory.includes(club), true);
    assert.equal(chest.contents.length, 0);
    assert.equal(other.cknown, false);
    assert.equal(game.context.move, 1);
});

void test('loot cannot reach a submerged container even when underwater', async () => {
    const level = freshPlayableRoom();
    level.requireAt(10, 10).typ = POOL;
    game.u.uinwater = true;
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, lknown: false,
    });

    await runExtendedCommand('loot', 'q');

    assert.equal(chest.lknown, false);
    assert.equal(game._pending_message, 'You cannot loot things that are deep in the water.');
    assert.equal(game.context.move, 0);
});
