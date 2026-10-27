import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { APPLE, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';

// C cmd.c:getdir() reads the next physical key directly while gi.in_doagain
// is set — no "In what direction?" question is painted, because the
// yn_function() call that paints it is skipped (cmd.c:3985-3989). A throw
// started from the item-actions menu reaches that path: its object letter is
// consumed from CQ_CANNED by getobj() without being recorded (invent.c
// cmdq_pop fast path), so CQ_REPEAT holds only the dothrow handler and the
// direction key. The do-again replay then feeds that recorded direction key
// to getobj() as an object letter, and when the letter names a carried
// object, throw_obj() asks for the direction again — silently.
void test('a repeated menu throw asks its direction without painting the question', async () => {
    const input = freshTurnRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 2 });
    const apple = await addInventoryObject(APPLE, { invlet: 'h' });

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /2 gold pieces/, keys: '$' },
        { prompt: /Do what with /, keys: 't' },
    ]);
    // The queued item action runs in its own dispatch; its canned object
    // letter answers the throw selection and the typed key answers the
    // direction, which getdir() records in CQ_REPEAT.
    await answerPrompts(rhack(0), input, [
        { prompt: /In what direction\?/, keys: 'h' },
    ]);
    assert.equal(game.context.move, 1, 'the gold throw takes the turn');

    input.feed('\x01'); // ^A: do_repeat() replays [dothrow, 'h'].
    const repeat = rhack(0);
    const blocked = await Promise.race([
        repeat.then(() => 'done'),
        input.waitUntilBlocked().then(() => 'input'),
    ]);
    assert.equal(blocked, 'input', 'the replayed throw waits for the direction key');
    const screen = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
    assert.doesNotMatch(screen, /In what direction/, 'do-again getdir() paints no question');

    input.feed('h'); // The silent direction read: west.
    await repeat;
    assert.equal(game.inventory.includes(apple), false, 'the replay throws the object named by the recorded direction key');
    assert.equal(game.context.move, 1);
});
