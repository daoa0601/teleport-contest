import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { APPLE, GOLD_PIECE, SACK } from '../js/object_data.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('Lua container contents stay in the monster inventory and later objects return to the floor', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);

    await lua.executeAsync(`
        des.map({ x = 10, y = 6, map = [[.......
.......
.......]] })
        des.monster({ id = "hobgoblin", name = "Porter", x = 2, y = 1,
            group = false, inventory = function()
                des.object({ id = "sack", contents = function()
                    des.object({ id = "apple", quantity = 3 })
                end })
            end })
        des.object({ id = "apple", quantity = 2, x = 5, y = 1 })
    `);

    const porter = game.level.monsters.find(monster => monster.mgivenname === 'Porter');
    assert.ok(porter, 'the level script creates its named monster');
    const sack = porter.minvent?.find(object => object.otyp === SACK);
    assert.ok(sack, 'the custom inventory receives its container');
    const carriedApples = sack.contents?.find(object => object.otyp === APPLE);
    assert.equal(carriedApples?.quan, 3, 'nested contents belong to the sack');
    const floorApples = game.level.objects[15]?.[7]?.find(object => object.otyp === APPLE);
    assert.equal(floorApples?.quan, 2, 'the inventory scope ends before the next floor object');
});

void test('Lua map contents use map coordinates and restore whole-level coordinates afterwards', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);

    await lua.executeAsync(`
        des.level_init({ style = "solidfill", fg = "." })
        des.map({ x = 10, y = 6, map = [[.....
.....
.....]], contents = function()
            des.gold(37, {1, 1})
        end })
        des.gold({ amount = 19, coord = {2, 1} })
    `);

    const mapGold = game.level.objects[11]?.[7]?.find(object => object.otyp === GOLD_PIECE);
    assert.equal(mapGold?.quan, 37, 'the contents callback uses the map origin');
    const levelGold = game.level.objects[3]?.[1]?.find(object => object.otyp === GOLD_PIECE);
    assert.equal(levelGold?.quan, 19, 'the next operation uses the whole-level origin');
});
