import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { PANICLOG } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { OBJECT_NAMES, TIN_WHISTLE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';
import { runExtendedCommand } from './support/commands.js';
import { levelStairs } from './support/level-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshSpecialLevel } from './support/special-level.js';
for (const rebound of [false, true]) {
    void test(`Lua can block an option command${rebound ? ' on a rebound key' : ''} until its callback is removed`, async (t) => {
        freshTurnRoom();
        game.flags.pickup = false;
        if (rebound)
            game.commandBindings.bindKey(33, 'autopickup');
        const core = await startLuaCore(t);
        core.execute(`
            function forbid_pickup(command)
                if command == "autopickup" then
                    nh.pline("Leave those objects alone.")
                    return false
                end
                return true
            end
            nh.callback("cmd_before", "forbid_pickup")
        `);
        const key = rebound ? 33 : 64;
        await rhack(key);
        assert.equal(game.flags.pickup, false);
        assert.match(game._pending_message, /Leave those objects alone/);
        core.execute('nh.callback("cmd_before", "forbid_pickup", true)');
        await rhack(key);
        assert.equal(game.flags.pickup, true);
    });
}
for (const [keys, command, action] of [
    ['l', 'moveeast', 'walking'], ['L', 'runeast', 'running'],
    ['\x0c', 'rusheast', 'rushing with Ctrl-L'],
    ['F', 'fight', 'the force-fight prefix'],
    ['ml', 'moveeast', 'moving without pickup'], ['Fl', 'moveeast', 'force-fighting'],
]) {
    void test(`Lua can block ${action} before movement or an attack`, async (t) => {
        freshTurnRoom();
        const core = await startLuaCore(t);
        core.setGlobal('forbidden_command', command);
        core.execute(`
            function forbid_movement(command)
                if command == forbidden_command then
                    nh.pline("You must stay here.")
                    return false
                end
                return true
            end
            nh.callback("cmd_before", "forbid_movement")
        `);
        pushKeys(keys.slice(1));
        await rhack(keys.charCodeAt(0));
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /You must stay here/);
    });
}
void test('Lua end-turn callbacks run after a command that does not use game time', async (t) => {
    freshTurnRoom();
    const turn = game.moves;
    const core = await startLuaCore(t);
    core.execute(`
        function after_command()
            nh.pline("You survey your surroundings.")
            return true
        end
        nh.callback("end_turn", "after_command")
    `);
    pushKeys('@');
    await moveloop_core();
    assert.equal(game.moves, turn);
    assert.match(game._pending_message, /You survey your surroundings/);
});
void test('Lua end-turn effects continue while the hero is putting on armor', async (t) => {
    const input = freshTurnRoom();
    const armor = await addInventoryObject(OBJECT_NAMES.indexOf('plate mail'), { initialize: false });
    const core = await startLuaCore(t);
    core.execute(`
        function while_dressing()
            nh.pline("The dungeon echoes.")
            return true
        end
        nh.callback("end_turn", "while_dressing")
    `);
    installPagerInput(input, { expected: /The dungeon echoes\./, limit: 2 });
    input.feed(`W${armor.invlet}`);
    await moveloop_core();
    await flushPendingTopline();
    assert.ok(game.multi < 0, 'Putting on plate mail must leave a dressing delay');
    await moveloop_core();
    assert.ok(game.multi < 0, 'The armor is still being put on');
    assert.match(game._pending_message, /The dungeon echoes\./);
});
void test('a Lua world-turn hook grants an item only when global time advances', async (t) => {
    freshTurnRoom();
    game.u.umovement = 24;
    const core = await startLuaCore(t);
    core.execute(`
        function nhcore.moveloop_turn()
            u.giveobj(obj.new("tin whistle"))
        end
    `);
    pushKeys('.\x1b');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.inventory.some(object => object.otyp === TIN_WHISTLE), false);
    pushKeys('.\x1b');
    await moveloop_core();
    await moveloop_core();
    const whistles = game.inventory.filter(object => object.otyp === TIN_WHISTLE);
    assert.equal(whistles.length, 1);
});
void test('Lua can forbid an extended command before it spends a turn', async (t) => {
    freshTurnRoom();
    const core = await startLuaCore(t);
    core.execute(`
        function forbid_sitting(command)
            if command == "sit" then
                nh.pline("Keep standing.")
                return false
            end
            return true
        end
        nh.callback("cmd_before", "forbid_sitting")
    `);
    await runExtendedCommand('sit');
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /Keep standing/);
});
void test('callbacks registered by a level script survive it and see the levels being created and left', async (t) => {
    freshSpecialLevel({ prototype: 'oracle', seed: 3101, depth: 7 });
    game.nhDisplay = new GameDisplay(null);
    game._specialLevelPrototype = 'oracle';
    const core = await startLuaCore(t);
    core.execute(`
        function entering()
            created_depth = u.dlevel
            nh.parse_config("OPTIONS=autopickup")
            return true
        end
        function leaving()
            departed_depth = u.dlevel
            return true
        end
    `);
    const levelScript = currentLuaLifecycle().createSpecialState(game);
    levelScript.execute(`
        nh.callback("level_enter", "entering")
        nh.callback("level_leave", "leaving")
    `);
    await levelScript.destroy();
    await mklev();
    assert.equal(core.getGlobal('created_depth'), 7);
    assert.equal(game.flags.pickup, true);
    const stairs = levelStairs(game).find(stair => !stair.up);
    assert.ok(stairs);
    game.u.ux = stairs.sx;
    game.u.uy = stairs.sy;
    const input = resetInputState();
    await answerPrompts(rhack('>'.charCodeAt(0)), input, [
        { prompt: /You descend the stairs\.--More--/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    assert.equal(game.u.uz.dlevel, 8);
    assert.equal(core.getGlobal('departed_depth'), 7);
    assert.equal(core.getGlobal('created_depth'), 8);
});
void test('removing an unregistered Lua callback reports an impossible count', async (t) => {
    freshTurnRoom();
    game.storage = memoryStorage();
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    const core = await startLuaCore(t);
    await core.executeAsync('nh.callback("cmd_before", "never_added", true)');
    await flushPendingTopline();
    assert.match(game.storage.getItem(PANICLOG) ?? '', /"type":"impossible","reason":"nh\.callback counts are wrong"/);
});
//# sourceMappingURL=lua_callbacks.test.js.map