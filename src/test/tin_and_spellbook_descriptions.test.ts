import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ORCISH_DAGGER, SPE_FORCE_BOLT, TIN } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { freshTurnRoom } from './support/playable-room.js';

// C eat.c:start_tin() names the wielded opener with yobjnam(), which
// includes the stack count.  The wider line also crosses tty update_topl()'s
// joining threshold, so both the text and the paging boundary need the count.
void test('opening a tin with a stack of daggers counts the weapons', async t => {
    freshTurnRoom({ flags: { tips: false } });
    const daggers = await addInventoryObject(ORCISH_DAGGER, { quan: 11, quantity: 11 });
    game.uwep = daggers;
    daggers.worn = true;
    const tin = await addInventoryObject(TIN);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What do you want to eat\?/, keys: `${tin.invlet ?? 'a'}` },
    ]);
    await rhack('e'.charCodeAt(0));
    assert.match(String(game._pending_message ?? ''),
        /^Using your 11 orcish daggers you try to open the tin\./);
});

// C apply.c:flip_through_book() clamps the fadeness index to
// MAX_SPELL_STUDY (3); a book studied four times is still "extremely
// faded", never "barely visible".  The flip prose pages through --More--
// before the ink description becomes the pending line.
void test('a four-times-studied spellbook is extremely faded', async t => {
    freshTurnRoom({ flags: { tips: false } });
    const book = await addInventoryObject(SPE_FORCE_BOLT, { spestudied: 4 });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What do you want to use or apply\?/, keys: `${book.invlet ?? 'a'}` },
        { prompt: /You flip through the pages/, keys: ' ' },
    ]);
    await rhack('a'.charCodeAt(0));
    assert.equal(game._pending_message, 'The magical ink in this spellbook is extremely faded.');
});
