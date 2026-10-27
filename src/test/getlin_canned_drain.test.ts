import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { playerName } from '../js/player_name.js';
import { ARROW, BOW, CLUB } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

// C windows.c getlin() drains the one command queue before prompting:
// queued CMDQ_KEY entries answer the query, and the first non-key entry
// is popped and freed — dropped, not deferred. A naming prompt raised
// between two canned commands therefore eats the queued one, and the
// command after it never resumes on its own.
void test('a getlin naming prompt discards a queued canned command entry', async () => {
    const input = freshTurnRoom();
    await setPrimaryWeapon(await addInventoryObject(CLUB, { invlet: 'a' }));
    const bow = await addInventoryObject(BOW, { invlet: 'b' });
    await setSecondaryWeapon(bow);
    await setQuiverObject(await addInventoryObject(ARROW, { invlet: 'c', quan: 3 }));
    input.feed('f');
    await moveloop_core();
    assert.equal(game._cannedCommands?.length, 2,
        'fire assistance queues the swap and the fire');

    const swap = moveloop_core();
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await swap;
    assert.equal(game.uwep, bow);
    assert.equal(game._cannedCommands?.length, 1, 'the fire stays queued');

    const call = playerName('Call a scroll labeled XIXAXA XOXAXA XUXAXA:');
    await input.waitUntilBlocked();
    input.feed('wide\r');
    assert.equal(await call, 'wide');
    assert.equal(game._cannedCommands?.length, 0,
        'the queued fire was consumed by the prompt instead of resuming');
});
