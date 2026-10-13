import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an accepting command callback keeps its prose before an inventory action', async t => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    const core = await startLuaCore(t);
    core.execute(`
        function prepare_drop(command)
            if command == "drop" then
                nh.pline("You steady your hand.")
            end
            return true
        end
        nh.callback("cmd_before", "prepare_drop")
    `);
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'd' },
    ]);

    await answerPrompts(rhack(0), input, []);

    assert.match(game._pending_message, /You steady your hand\./);
    assert.match(game._pending_message, /You drop/);
    assert.equal(game.inventory.includes(dagger), false);
});

for (const action of ['wield', 'unwield'] as const) {
    void test(`an accepting command callback keeps its prose before inventory ${action}`, async t => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER);
        if (action === 'unwield') game.uwep = dagger;
        const input = resetInputState();
        const core = await startLuaCore(t);
        core.execute(`
            function prepare_wield(command)
                if command == "wield" then
                    nh.pline("You steady your hand.")
                end
                return true
            end
            nh.callback("cmd_before", "prepare_wield")
        `);
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: dagger.invlet },
            { prompt: /Do what with the dagger\?/, keys: action === 'wield' ? 'w' : '-' },
        ]);

        await answerPrompts(rhack(0), input, []);

        assert.match(game._pending_message, /You steady your hand\./);
        assert.match(game._pending_message, action === 'wield' ? /dagger/ : /You are bare handed\./);
        assert.equal(game.uwep, action === 'wield' ? dagger : null);
    });
}

for (const action of ['name', 'lookup', 'unready'] as const) {
    void test(`inventory ${action} preserves unread command callback prose`, async t => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER);
        if (action === 'unready') await setSecondaryWeapon(dagger);
        const input = resetInputState();
        const core = await startLuaCore(t);
        const command = action === 'name' ? 'call' : action === 'lookup' ? 'whatis' : 'altunwield';
        core.execute(`
            function prepare_item_action(command)
                if command == "${command}" then
                    nh.pline("You steady your hand.")
                end
                return true
            end
            nh.callback("cmd_before", "prepare_item_action")
        `);
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: dagger.invlet },
            { prompt: /Do what with the dagger\?/, keys: action === 'name' ? 'c' : action === 'lookup' ? '/' : '-' },
        ]);

        const operation = rhack(0);
        try {
            if (action === 'unready') {
                await answerPrompts(operation, input, []);
                assert.match(game._pending_message, /You steady your hand\./);
                assert.match(game._pending_message, /You no longer have a second weapon readied\./);
                assert.equal(game.uswapwep, null);
            } else {
                await answerPrompts(operation, input, [
                    { prompt: /You steady your hand\.--More--/, keys: ' ' },
                    action === 'name'
                        ? { prompt: /What do you want to name this dagger\?/, keys: 'Needle\n' }
                        : { prompt: /dagger[\s\S]*--More--/i, keys: ' ' },
                ]);
                if (action === 'name') assert.equal(dagger.oextra?.oname, 'Needle');
                assert.equal(game.context.move, 0);
            }
        } finally {
            input.feed('\x1b\x1b\x1b');
            await operation;
        }
    });
}
