import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { POOL } from '../js/const.js';
import { CHEST, CLUB, SADDLE } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
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
//# sourceMappingURL=floor_loot.test.js.map