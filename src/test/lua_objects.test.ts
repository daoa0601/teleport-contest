import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { beginObjectBurn } from '../js/light.js';
import { BELL_OF_OPENING, CHEST, FOOD_RATION, GOLD_PIECE, LOADSTONE, OIL_LAMP, ROCK, SPE_LIGHT } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('Lua creates a blessed food ration and places it on the live map', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);

    await core.executeAsync(`
        ration = obj.new("blessed food ration")
        ration:placeobj(u.ux, u.uy)
    `);

    const ration = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .find(object => object.otyp === FOOD_RATION);
    assert.ok(ration);
    assert.equal(ration.blessed, true);
    assert.equal(ration.cursed, false);
});

void test('Lua moves a container into inventory without breaking its contents or their handles', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);

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
    assert.ok(box);
    const coins = box.contents?.find(object => object.otyp === GOLD_PIECE);
    assert.ok(coins);
    const initialGold = core.getGlobal('initial_gold');
    assert.ok(typeof initialGold === 'number');
    assert.equal(coins.quan, initialGold + 12);
    assert.equal(coins.container, box);
    assert.equal(core.getGlobal('carried_container'), 3); // OBJ_INVENT

    await core.executeAsync('u.clear_inventory(); contents_deleted = coins:isnull()');
    assert.equal(game.inventory.includes(box), false);
    assert.equal(core.getGlobal('contents_deleted'), true);
});

void test('a Lua handle follows its stack when the item merges into inventory', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);

    await core.executeAsync(`
        first = obj.new("3 rocks")
        second = obj.new("5 rocks")
        u.giveobj(first)
        u.giveobj(second)
        combined_quantity = second:totable().quan
    `);

    const rocks = game.inventory.filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.ok(rocks[0]);
    assert.equal(rocks[0].quan, 8);
    assert.equal(core.getGlobal('combined_quantity'), 8);
});

void test('adding luckstones to an existing stack changes the carried luck balance', async t => {
    freshObjectRoom({ flags: { debug: true } });
    const core = await startLuaCore(t);
    await core.executeAsync(`
        u.giveobj(obj.new("3 cursed luckstones"))
        u.giveobj(obj.new("2 uncursed luckstones"))
    `);
    assert.equal(game.u.moreluck, -3);

    await core.executeAsync('u.giveobj(obj.new("2 uncursed luckstones"))');

    assert.equal(game.u.moreluck, 3);
});

void test('Lua object reports describe the item without letting table edits change it', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);

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

void test('stopping a burn timer from Lua extinguishes the lamp and preserves unused fuel', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);
    await core.executeAsync('lamp = obj.new("oil lamp"); lamp:placeobj(u.ux, u.uy)');
    const lamp = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .find(item => item.otyp === OIL_LAMP);
    assert.ok(lamp);
    const fuel = lamp.age;
    beginObjectBurn(lamp, game, game.moves);
    game.moves += 3;

    await core.executeAsync(`
        remaining = lamp:stop_timer("burn-obj")
        still_burning = lamp:has_timer("burn-obj")
    `);

    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, fuel - 3);
    const remaining = core.getGlobal('remaining');
    assert.ok(typeof remaining === 'number' && remaining > 0);
    assert.equal(core.getGlobal('still_burning'), false);
});

void test('burying a lit lamp extinguishes it without consuming its remaining fuel', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);
    await core.executeAsync('lamp = obj.new("oil lamp"); lamp:placeobj(u.ux, u.uy)');
    const lamp = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .find(item => item.otyp === OIL_LAMP);
    assert.ok(lamp);
    const fuel = lamp.age;
    beginObjectBurn(lamp);
    game.moves += 3;

    await core.executeAsync('lamp:bury()');

    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, fuel - 3);
    assert.ok(requireGameLevel(game).buriedObjects?.includes(lamp));
});

void test('Lua object names can select the current shuffled appearance', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);

    await core.executeAsync(`
        local wand = obj.new({id = "marble", class = "/"})
        appearance = wand:class().descr
    `);

    assert.equal(core.getGlobal('appearance'), 'marble');
});

void test('the tutorial hunger callback supplies food once through the game loop', async t => {
    const input = freshTurnRoom();
    await startLuaCore(t);
    await currentLuaLifecycle().changeTutorialMode(game, true);
    game.u.uhunger = 140;
    pushKeys('.    ');

    await moveloop_core();

    const food = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .filter(object => object.otyp === FOOD_RATION);
    assert.equal(food.length, 1);
    assert.ok(food[0]);
    assert.equal(food[0].blessed, true);
    input.clear();
    pushKeys('.    ');
    await moveloop_core();
    assert.equal(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .filter(object => object.otyp === FOOD_RATION).length, 1);
});

void test('Lua burial applies carried effects only to items which leave inventory', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);
    await core.executeAsync(`
        stone = obj.new("uncursed loadstone")
        bell = obj.new({id = "Bell of Opening"})
        u.giveobj(stone)
        u.giveobj(bell)
        stone_was_cursed = stone:totable().cursed
        stone_absorbed = stone:bury(u.ux, u.uy)
        bell_absorbed = bell:bury(u.ux, u.uy)
        stone_is_cursed = stone:totable().cursed
    `);

    assert.equal(core.getGlobal('stone_was_cursed'), 0);
    assert.equal(core.getGlobal('stone_is_cursed'), 1);
    assert.equal(core.getGlobal('stone_absorbed'), false);
    assert.equal(core.getGlobal('bell_absorbed'), false);
    assert.ok(requireGameLevel(game).buriedObjects?.some(object => object.otyp === LOADSTONE));
    assert.ok(game.inventory.some(object => object.otyp === BELL_OF_OPENING));
    requirePlayingGame(game);
    assert.equal(game.u.uhave.bell, true);
});

void test('a studied spellbook reports its study tally through obj:totable() usecount', async t => {
    freshObjectRoom({ role: 'wizard' });
    const core = await startLuaCore(t);
    await core.executeAsync('spellbook = obj.new("blessed spellbook of light"); u.giveobj(spellbook)');
    const source = game.inventory.find(object => object.otyp === SPE_LIGHT);
    assert.ok(source?.invlet, 'The studied book needs an inventory letter');

    game._moveloopStarted = true;
    game.u.umovement = 12;
    pushKeys(`${source.invlet}    `);
    await rhack('r'.charCodeAt(0));
    for (let turn = 0; turn < 30 && game._occupation; turn++) await moveloop_core();
    assert.equal(source.spestudied, 1);

    await core.executeAsync('studies = spellbook:totable().usecount');
    assert.equal(core.getGlobal('studies'), 1);
});

void test('boxing an object off the floor keeps its last square in its Lua report', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);
    await core.executeAsync(`
        rock = obj.new("rock")
        rock:placeobj(u.ux, u.uy)
        box = obj.new("chest")
        box:addcontent(rock)
        rock_x = rock:totable().ox
        hero_x = u.ux
        rock_where = rock:totable().where
    `);
    assert.equal(core.getGlobal('rock_x'), core.getGlobal('hero_x'));
    assert.equal(core.getGlobal('rock_where'), 2); // OBJ_CONTAINED
});

void test('Lua object methods ignore extra arguments except where native code checks the count', async t => {
    freshObjectRoom();
    const core = await startLuaCore(t);
    await core.executeAsync(`
        first = obj.new("rock")
        first:placeobj(u.ux, u.uy)
        second = obj.new("rock")
        second:placeobj(u.ux + 1, u.uy)
        square_chain_ends = second:next(true):isnull()
        wide_call = second:next(true, 0)
        wide_call_left_square = (wide_call:totable().ox ~= second:totable().ox)
        wide_call_real = not wide_call:isnull()
        kept_quan = second:totable(1, 2, 3).quan
        still_real = not second:isnull("junk")
    `);
    assert.equal(core.getGlobal('square_chain_ends'), true);
    assert.equal(core.getGlobal('wide_call_left_square'), true);
    assert.equal(core.getGlobal('wide_call_real'), true);
    assert.equal(core.getGlobal('kept_quan'), 1);
    assert.equal(core.getGlobal('still_real'), true);

    await assert.rejects(core.executeAsync('obj.new("rock", 1)'));
    await assert.rejects(core.executeAsync('obj.at(1)'));
});
