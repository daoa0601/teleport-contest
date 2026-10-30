import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, POT_HEALING, POT_WATER, ROBE } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
// C iactions.c:itemactions_pushkeys() queues #altdip and the potion letter
// into CQ_CANNED, so potion.c:dip_into() always finds its potion answer
// there. cmd.c:do_repeat() replays dip_into from CQ_REPEAT with CQ_CANNED
// empty, so the replayed item-action dip always reports
// impossible("dip_into: where is potion?") and fails without taking a turn.
void test('do-again of an item-action dip reports the missing potion letter', async () => {
    await freshObjectRoom();
    // A live game can save, so impossible() adds the save-and-reload hint.
    game.program_state.something_worth_saving = true;
    const potion = await addInventoryObject(POT_HEALING, { quan: 2 });
    const robe = await addInventoryObject(ROBE);
    const input = resetInputState();
    // 'i' picks the potion's item-action menu; 'a' dips something into it.
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Potions/, keys: potion.invlet },
        { prompt: /Do what with the .*potion/, keys: 'a' },
    ]);
    // The queued item action runs as a command in its own dispatch.
    await answerPrompts(rhack(0), input, [
        { prompt: /What do you want to dip into/, keys: robe.invlet },
    ]);
    assert.equal(game._pending_message, 'Interesting...');
    assert.equal(game.context.move, 1, 'the dip takes its turn');
    assert.equal(game.inventory.includes(potion), true);
    assert.equal(potion.quan, 2, 'a plain dip does not use up the potion');
    input.feed('\x01');
    await answerPrompts(rhack(0), input, [
        { prompt: /dip_into: where is potion\?--More--/, keys: ' ' },
        { prompt: /Program in disorder!.*--More--/, keys: ' ' },
    ]);
    assert.equal(game._pending_message, 'Please report these messages to devteam@nethack.org.');
    assert.equal(game.context.move, 0, 'the failed replay takes no turn');
    assert.equal(game.inventory.includes(potion), true);
    assert.equal(potion.quan, 2);
    // do_repeat() restores the saved queue even after the failure, so a
    // second ^A repeats the same complaint.
    input.feed('\x01');
    await answerPrompts(rhack(0), input, [
        { prompt: /dip_into: where is potion\?--More--/, keys: ' ' },
        { prompt: /Program in disorder!.*--More--/, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
    assert.equal(potion.quan, 2, 'no dip happens through the replay');
});
// C invent.c:getobj() records every interactively typed inventory letter
// into CQ_REPEAT (invent.c:2053), so a normal #dip replays both of its
// object choices; only the item-action potion letter, answered from
// CQ_CANNED, is missing from the repeat queue.
void test('do-again of a normal dip replays both object choices', async () => {
    await freshObjectRoom();
    game.program_state.something_worth_saving = true;
    const dagger = await addInventoryObject(DAGGER, { cursed: true });
    const water = await addInventoryObject(POT_WATER, { blessed: true, quan: 2 });
    const input = resetInputState();
    await runExtendedCommand('dip', `${dagger.invlet}${water.invlet}`);
    assert.equal(dagger.cursed, false);
    assert.equal(water.quan, 1);
    assert.equal(game.context.move, 1);
    // The replay answers both getobj() prompts from CQ_REPEAT.
    await answerPrompts(rhack('\x01'.charCodeAt(0)), input, []);
    assert.equal(dagger.blessed, true, 'the replayed dip blesses the dagger');
    assert.equal(game.inventory.includes(water), false, 'the last bottle is used up');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=doagain_item_dip.test.js.map