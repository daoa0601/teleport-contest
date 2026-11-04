import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { POT_FRUIT_JUICE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

// C cmd.c:rhack() adds the command an extended-command editor selected to
// CQ_REPEAT after it ran and shifts it to the front (cmd.c:3752-3759), so
// answers the command recorded while it ran — here the potion letter
// getobj() pushes (invent.c:2051-2053) — stay queued behind it. The ^A
// replay therefore answers its getobj() from CQ_REPEAT instead of reading
// a fresh key, which getobj() would do silently while in_doagain is set.
void test('a do-again replay of an extended command answers getobj from the recorded letter', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    const potion = await addInventoryObject(POT_FRUIT_JUICE, { invlet: 'a', quan: 2 });
    assert.ok(potion);

    // '#' opens the extended-command editor; 'quaff' runs dodrink, whose
    // getobj() prompt the pushed letter answers.
    pushKeys('quaff\na');
    await rhack('#'.charCodeAt(0));
    assert.equal(potion.quan, 1, 'the first drink consumed one potion');

    input.feed('\x01'); // ^A: do_repeat() replays [dodrink, 'a'].
    const replay = rhack(0);
    const outcome = await Promise.race([
        replay.then(() => 'finished' as const),
        input.waitUntilBlocked().then(() => 'blocked' as const),
    ]);
    assert.equal(outcome, 'finished',
        'the replayed quaff must answer getobj() from CQ_REPEAT');
    await replay;
    assert.equal(game.inventory.includes(potion), false, 'the replay drank the recorded letter');
});
