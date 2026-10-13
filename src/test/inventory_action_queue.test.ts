import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { startLuaCore } from './support/lua-game.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('failed inventory engraving leaves the next player command available', async () => {
    const level = freshObjectRoom();
    level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'E' },
    ]);
    await rhack(0);
    assert.equal(game._pending_message, "You can't write on the fountain!");

    input.feed('s');
    await answerPrompts(rhack(0), input, []);

    assert.equal(game.context.move, 1);
    assert.equal(game.inventory.includes(dagger), true);
});

void test('an unread end-turn message does not consume an inventory drop choice', async t => {
    const input = freshTurnRoom();
    const dagger = await addInventoryObject(DAGGER);
    const core = await startLuaCore(t);
    core.execute(`
        function after_inventory()
            if not considered then
                nh.pline("You consider your possessions.")
                considered = true
            end
            return true
        end
        nh.callback("end_turn", "after_inventory")
    `);
    input.feed('i');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'd' },
    ]);
    assert.match(game._pending_message, /You consider your possessions/);

    await answerPrompts(moveloop_core(), input, []);

    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(dagger.where, 'floor');
});

