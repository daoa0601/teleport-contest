import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { tryCallObjectType } from '../js/object_call.js';
import { ARROW, BOW, CLUB, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

// C windows.c getlin() drains the one command queue before prompting:
// queued CMDQ_KEY entries answer the query, and the first non-key entry
// is popped and freed — dropped, not deferred. A naming prompt raised
// between two canned commands therefore eats the queued one (do.c trycall
// reaching docall()'s getlin), and the command after it never resumes:
// the next key goes to a fresh command instead of the fire's direction
// query, and no arrow leaves the quiver.
void test('a trycall naming prompt eats the queued fire-assist fire', async () => {
    const input = freshTurnRoom();
    await setPrimaryWeapon(await addInventoryObject(CLUB, { invlet: 'a' }));
    const bow = await addInventoryObject(BOW, { invlet: 'b' });
    await setSecondaryWeapon(bow);
    await setQuiverObject(await addInventoryObject(ARROW, { invlet: 'c', quan: 3 }));
    input.feed('f');
    await moveloop_core();

    const swap = moveloop_core();
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await swap;
    assert.equal(game.uwep, bow);

    const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS,
        { typeKnown: false, observed: false, dknown: true });
    const call = tryCallObjectType(glass);
    await input.waitUntilBlocked();
    input.feed('wide\r');
    await call;

    assert.equal(game._objectCallNames?.[glass.otyp], 'wide',
        'the unnamed glass was called through the prompt');

    // The fire never resumes: the engine waits for a plain command instead
    // of a fire direction, and the quiver keeps all three arrows.
    const after = moveloop_core();
    try {
        await input.waitUntilBlocked();
        assert.doesNotMatch(game._pending_message ?? '', /In what direction/,
            'the eaten fire no longer asks for a direction');
    } finally {
        input.feed('\x1b');
        await after;
    }
    assert.equal(game.uquiver?.quan, 3, 'no arrow was fired');
});
