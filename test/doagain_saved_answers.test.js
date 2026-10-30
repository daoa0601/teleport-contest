import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { removeHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { DUST } from '../js/const.js';
import { engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { RIN_PROTECTION, ROCK } from '../js/object_data.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requireFixtureGame } from './support/game-state.js';
// C do_wear.c:doputon(): the ring-finger question goes through
// yn_function(qbuf, rightleftchars, '\0', TRUE), so a live answer is
// recorded into CQ_REPEAT and cmd.c:do_repeat() replays it without
// drawing the question again.
void test('do-again replays the saved ring-finger answer without asking again', async () => {
    await freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION, { invlet: 'a' });
    const input = resetInputState();
    input.feed('a');
    // Escape cancels the put-on without using time; the answer is saved.
    await answerPrompts(rhack('P'.charCodeAt(0)), input, [
        { prompt: /Which ring-finger, Right or Left\? \[rl\]/, keys: '\x1b' },
    ]);
    assert.ok(!game.uright && !game.uleft);
    assert.equal(game.context.move, 0);
    input.feed('\x01');
    const replay = rhack(0);
    const outcome = await Promise.race([
        replay.then(() => 'done'),
        input.waitUntilBlocked().then(() => 'blocked'),
    ]);
    if (outcome === 'blocked')
        input.feed('\x1b');
    await replay;
    assert.equal(outcome, 'done', 'the replay must answer the finger question from the queue');
    assert.ok(!game.uright && !game.uleft);
    assert.equal(game.context.move, 0);
    assert.equal(game.inventory.includes(ring), true);
});
// C windows.c:getlin() drains queued CMDQ_KEY entries and echoes the
// assembled answer as pline("%s %s", query, buf). During a do-again the
// live answer recorded by the engraving add-to question becomes the text
// of the replayed writing question, so the engraving is written again.
void test('do-again feeds the live add-to answer into the engraving text question', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const rock = await addInventoryObject(ROCK);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\? \[- .* or \?\*\]/, keys: rock.invlet ?? '' },
        { prompt: /You write in the dust with /, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'hi\r' },
    ]);
    await moveloop_core();
    const first = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(first, 'the first engraving must exist');
    assert.equal(first.text, 'hi');
    input.feed('\x01');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /Do you want to add to the current engraving\? \[ynq\] \(y\)/, keys: 'n' },
        { prompt: /You wipe out the message that was written in the dust here\./, keys: ' ' },
        { prompt: /You write in the dust with /, keys: ' ' },
    ]);
    // The writing question was answered by the queued 'n' and echoed with
    // it, exactly like C getlin() answering from the command queue.
    assert.match(game._pending_message || game._retained_message || '', /What do you want to write in the dust here\? n/);
    await moveloop_core();
    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving, 'the replayed engraving must exist');
    assert.equal(engraving.text, 'n');
    assert.equal(engraving.engr_type, DUST);
});
// C yn_function() records only tty_yn_function()'s accepted answer. After
// the ring is removed, do-again puts it back on the same finger silently.
void test('do-again replays the accepted finger after a rejected live key', async () => {
    await freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION, { invlet: 'a' });
    const input = resetInputState();
    input.feed('a');
    await answerPrompts(rhack('P'.charCodeAt(0)), input, [
        { prompt: /Which ring-finger, Right or Left\? \[rl\]/, keys: 'x' },
        { prompt: /Which ring-finger, Right or Left\? \[rl\]/, keys: 'r' },
    ]);
    assert.ok(game.uright === ring, 'the second answer must put the ring on');
    assert.equal(game.context.move, 1);
    await removeHeroAccessory(ring);
    input.feed('\x01');
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.uright, ring, 'replay must use the accepted right finger');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=doagain_saved_answers.test.js.map