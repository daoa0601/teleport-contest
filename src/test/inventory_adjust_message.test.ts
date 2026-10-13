import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory adjustment acknowledges command callback prose before asking for a destination', async t => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    const core = await startLuaCore(t);
    core.execute(`
        function prepare_adjust(command)
            if command == "adjust" then
                nh.pline("You consider a new inventory letter.")
            end
            return true
        end
        nh.callback("cmd_before", "prepare_adjust")
    `);
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'i' },
    ]);

    const operation = rhack(0);
    try {
        await answerPrompts(operation, input, [
            { prompt: /You consider a new inventory letter\.--More--/, keys: ' ' },
            { prompt: /Adjust letter to what/, keys: 'z' },
        ]);
    } finally {
        input.feed('\x1b\x1b');
        await operation;
    }

    assert.equal(dagger.invlet, 'z');
    assert.match(game._pending_message, /Moving: z - .*dagger/);
    assert.equal(game.context.move, 0);
});
