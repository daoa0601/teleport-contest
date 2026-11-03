import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { tryCallObjectType } from '../js/do.js';

import { ARROW, BOW, CLUB, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import type { InputGate } from '../js/input.js';

// dothrow.c:573-576 queues [dowield, <launcher letter>, dofire] for a
// launcher-assist fire. A naming prompt between two canned commands frees
// the dowield entry — windows.c:getlin() pops until a key answers and
// frees the first non-key entry it reaches, and the answer key that C
// queued behind the command returns to the response queue — so the
// launcher letter reaches rhack() as a plain command key ahead of the
// still-queued fire (fresh11609/9c1c97f8; see also
// getlin_canned_drain.test.ts). Which command the letter runs depends on
// the letter, so each test picks it to reach the getobj() caller under
// test: that command's own cmdq_pop() then takes the queued fire as its
// head.
async function drainFireAssist(launcherInvlet: string): Promise<InputGate> {
    const input = freshTurnRoom();
    await setPrimaryWeapon(await addInventoryObject(CLUB, { invlet: 'a' }));
    const bow = await addInventoryObject(BOW, { invlet: launcherInvlet });
    bow.bknown = true;
    await setQuiverObject(await addInventoryObject(ARROW, { invlet: 'k', quan: 3 }));
    input.feed('f');
    await moveloop_core();

    // do.c:trycall() reaches do_name.c:docall()'s getlin() naming prompt,
    // which frees the queued dowield and keeps its launcher-letter tail.
    const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS,
        { typeKnown: false, observed: false, dknown: true });
    const call = tryCallObjectType(glass);
    await input.waitUntilBlocked();
    input.feed('wide\r');
    await call;
    assert.equal(game._objectCallNames?.[glass.otyp], 'wide',
        'the unnamed glass was called through the prompt');
    return input;
}

// Runs one command step and reports whether it blocked on live input.
// C's queue-consuming consumers finish the command without asking, so a
// block is itself the divergence under test.
async function runUntilInput(
    input: InputGate, step: () => Promise<void>,
): Promise<'finished' | 'blocked'> {
    const turn = step();
    const outcome = await Promise.race([
        turn.then(() => 'finished' as const),
        input.waitUntilBlocked().then(() => 'blocked' as const),
    ]);
    if (outcome === 'blocked') input.feed('\x1b');
    await turn;
    return outcome;
}

// C invent.c:1779-1830: getobj()'s entry cmdq_pop() accepts only CMDQ_KEY
// (plus CMDQ_INT counts). Any other entry — here the queued dofire
// extended command reached through the emptied response queue — leaves
// otmp NULL, so cmdq_clear(CQ_CANNED) discards the queue (invent.c:1817-
// 1818) and getobj() returns NULL without any prompt. dowield() turns
// that NULL into ECMD_CANCEL: no wield question, nothing wielded, and the
// queued fire is gone instead of resuming after the command.
void test("wield's object query eats the queued fire and cancels without prompting", async () => {
    const input = await drainFireAssist('w');

    const outcome = await runUntilInput(input, () => moveloop_core());

    assert.equal(outcome, 'finished',
        'the wield query was answered by the queued fire instead of prompting');
    assert.equal(game._cannedCommands?.length ?? 0, 0,
        'cmdq_clear(CQ_CANNED) discarded the remaining queue');
    assert.equal(game.uwep?.otyp, CLUB, 'the cancelled wield chose nothing');
    assert.equal(game.uquiver?.quan, 3, 'the fire never resumed');
});

// The same getobj() cancel through do.c:dodrop(): its getobj("drop")
// returns NULL, so nothing leaves the pack and the "What do you want to
// drop?" question is never asked.
void test("drop's object query eats the queued fire and cancels without prompting", async () => {
    const input = await drainFireAssist('d');
    const carried = game.inventory.length;

    const outcome = await runUntilInput(input, () => moveloop_core());

    assert.equal(outcome, 'finished',
        'the drop query was answered by the queued fire instead of prompting');
    assert.equal(game._cannedCommands?.length ?? 0, 0,
        'cmdq_clear(CQ_CANNED) discarded the remaining queue');
    assert.equal(game.inventory.length, carried, 'nothing was dropped');
    assert.equal(game.uquiver?.quan, 3, 'the fire never resumed');
});
