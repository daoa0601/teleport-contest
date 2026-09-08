import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { beginObjectBurn } from '../js/light.js';
import { CHEST, FOOD_RATION, GOLD_PIECE, OIL_LAMP, ROCK } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

test('Lua creates a blessed food ration and places it on the live map', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);

    await core.executeAsync(`
        ration = obj.new("blessed food ration")
        ration:placeobj(u.ux, u.uy)
    `);

    const ration = floorObjectsAt(game.level, game.u.ux, game.u.uy)
        .find(object => object.otyp === FOOD_RATION);
    assert.ok(ration);
    assert.equal(ration.blessed, true);
    assert.equal(ration.cursed, false);
});

test('Lua moves a container into inventory without breaking its contents or their handles', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);

    await core.executeAsync(`
        box = obj.new({id = "chest"})
        initial_gold = 0
        local content = box:contents()
        while not content:isnull() do
            local details = content:totable()
            if details.oclass == "$" then initial_gold = initial_gold + details.quan end
            content = content:next()
        end
        coins = obj.new("12 gold pieces")
        box:addcontent(coins)
        u.giveobj(box)
        carried_container = coins:container():totable().where
    `);

    const box = game.inventory.find(object => object.otyp === CHEST);
    const coins = box?.contents.find(object => object.otyp === GOLD_PIECE);
    assert.ok(coins);
    assert.equal(coins.quan, core.getGlobal('initial_gold') + 12);
    assert.equal(coins.container, box);
    assert.equal(core.getGlobal('carried_container'), 3); // OBJ_INVENT

    await core.executeAsync('u.clear_inventory(); contents_deleted = coins:isnull()');
    assert.equal(game.inventory.includes(box), false);
    assert.equal(core.getGlobal('contents_deleted'), true);
});

test('a Lua handle follows its stack when the item merges into inventory', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);

    await core.executeAsync(`
        first = obj.new("3 rocks")
        second = obj.new("5 rocks")
        u.giveobj(first)
        u.giveobj(second)
        combined_quantity = second:totable().quan
    `);

    const rocks = game.inventory.filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan, 8);
    assert.equal(core.getGlobal('combined_quantity'), 8);
});

test('adding luckstones to an existing stack changes the carried luck balance', async t => {
    freshObjectRoom({ flags: { debug: true } });
    const core = startLuaCore(t);
    await core.executeAsync(`
        u.giveobj(obj.new("3 cursed luckstones"))
        u.giveobj(obj.new("2 uncursed luckstones"))
    `);
    assert.equal(game.u.moreluck, -3);

    await core.executeAsync('u.giveobj(obj.new("2 uncursed luckstones"))');

    assert.equal(game.u.moreluck, 3);
});

test('Lua object reports describe the item without letting table edits change it', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);

    await core.executeAsync(`
        rocks = obj.new("3 rocks")
        local report = rocks:totable()
        report.quan = 99
        quantity = rocks:totable().quan
        material = rocks:class().material
        empty_square = obj.at(1, 1):isnull()
        merged_with_ground = rocks:bury(u.ux, u.uy)
        removed = rocks:isnull()
    `);

    assert.equal(core.getGlobal('quantity'), 3);
    assert.equal(core.getGlobal('material'), 'stone');
    assert.equal(core.getGlobal('empty_square'), true);
    assert.equal(core.getGlobal('merged_with_ground'), true);
    assert.equal(core.getGlobal('removed'), true);
});

test('stopping a burn timer from Lua extinguishes the lamp and preserves unused fuel', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);
    await core.executeAsync('lamp = obj.new("oil lamp"); lamp:placeobj(u.ux, u.uy)');
    const lamp = floorObjectsAt(game.level, game.u.ux, game.u.uy)
        .find(item => item.otyp === OIL_LAMP);
    const fuel = lamp.age;
    beginObjectBurn(lamp, game, game.moves);
    game.moves += 3;

    await core.executeAsync(`
        remaining = lamp:stop_timer("burn-obj")
        still_burning = lamp:has_timer("burn-obj")
    `);

    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, fuel - 3);
    assert.ok(core.getGlobal('remaining') > 0);
    assert.equal(core.getGlobal('still_burning'), false);
});

test('burying a lit lamp extinguishes it without consuming its remaining fuel', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);
    await core.executeAsync('lamp = obj.new("oil lamp"); lamp:placeobj(u.ux, u.uy)');
    const lamp = floorObjectsAt(game.level, game.u.ux, game.u.uy)
        .find(item => item.otyp === OIL_LAMP);
    const fuel = lamp.age;
    beginObjectBurn(lamp);
    game.moves += 3;

    await core.executeAsync('lamp:bury()');

    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, fuel - 3);
    assert.ok(game.level.buriedObjects.includes(lamp));
});

test('Lua object names can select the current shuffled appearance', async t => {
    freshObjectRoom();
    const core = startLuaCore(t);

    await core.executeAsync(`
        local wand = obj.new({id = "marble", class = "/"})
        appearance = wand:class().descr
    `);

    assert.equal(core.getGlobal('appearance'), 'marble');
});

test('the tutorial hunger callback supplies food once through the game loop', async t => {
    const input = freshTurnRoom();
    startLuaCore(t);
    await currentLuaLifecycle().changeTutorialMode(game, true);
    game.u.uhunger = 140;
    pushKeys('.    ');

    await moveloop_core();

    const food = floorObjectsAt(game.level, game.u.ux, game.u.uy)
        .filter(object => object.otyp === FOOD_RATION);
    assert.equal(food.length, 1);
    assert.equal(food[0].blessed, true);
    input.clear();
    pushKeys('.    ');
    await moveloop_core();
    assert.equal(floorObjectsAt(game.level, game.u.ux, game.u.uy)
        .filter(object => object.otyp === FOOD_RATION).length, 1);
});
