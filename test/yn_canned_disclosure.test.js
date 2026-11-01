import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { FLINT, SLING } from '../js/object_data.js';
import { setQuiverObject } from '../js/wield.js';
import { SICK_NONVOMITABLE } from '../js/const.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
// C cmd.c:yn_function() pops the one command queue before asking. A canned
// command left queued when the hero dies — here the fire-assist dofire()
// behind a wielded launcher (dothrow.c:571-578) that terminal illness
// forestalls at the end of the wield's turn — is not a key, so the DYWYPI
// possessions question keeps yn_function()'s ESC initializer, reports the
// "Program in disorder!" impossible() feedback, and answers with the
// default instead of ever displaying the question.
void test('a leftover fire-assist command answers death disclosure through the yn impossible', async () => {
    const input = freshTurnRoom();
    const sling = await addInventoryObject(SLING, { invlet: 'b' });
    await setQuiverObject(await addInventoryObject(FLINT, { invlet: 'c', quan: 3 }));
    // Terminal illness expires at the end of the wield turn.
    game.u.sick = true;
    game.u.sickType = SICK_NONVOMITABLE;
    game.u.sickTurns = 1;
    game.u.sickCause = 'rotted gnome corpse';
    input.feed('f');
    await moveloop_core();
    assert.equal(game.uquiver?.quan, 3, 'the fire assist must not fire immediately');
    const pages = [];
    installPagerInput(input, { expected: /[\s\S]/, limit: 40, pages });
    await moveloop_core(); // the canned launcher wield, without a new command key
    // The turn the wield spent completes here; terminal illness kills the
    // hero before the command loop can pop the queued fire again.
    await moveloop_core();
    assert.ok(game.program_state.gameover, 'the illness must kill the hero');
    assert.equal(game.uwep, sling, 'the canned launcher wield ran before the death');
    assert.ok(pages.some(page => /Please report these messages to devteam@nethack\.org\./.test(page)), 'the impossible feedback must reach the message pager');
    assert.ok(!pages.some(page => /Do you want your possessions identified\?/.test(page)), 'the queued command answers the possessions question without asking it');
    assert.ok(pages.some(page => /Do you want to see your attributes\?/.test(page)), 'the following disclosure question is asked live again');
    assert.equal(game.uquiver?.quan, 3, 'the leftover fire never ran: the disclosure cleared it');
});
//# sourceMappingURL=yn_canned_disclosure.test.js.map