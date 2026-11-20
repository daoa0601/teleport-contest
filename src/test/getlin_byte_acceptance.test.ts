// C win/tty/getline.c hooked_tty_getlin() accepts every byte with
// `' ' <= (unsigned char) c && c != '\177'` up to its length limit for
// EVERY caller (getline.c:166-169); the tty frame stores no glyph for a
// high bit byte because termcap.c:nomux_putch() skips it, but the cursor
// still advances (wintty.c:topl_putsym()).  Callers cannot filter the
// typed bytes; they only see the finished buffer, and their C parse of a
// high bit byte follows the same code as any other unrecognized input.
import assert from 'node:assert/strict';
import test from 'node:test';
import { paranoidYesNoQuit, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { InputGate, bindInputGate } from '../js/input.js';
import { changePreferredFruit } from '../js/message_types.js';
import { applyNethackrc } from '../js/cfgfiles.js';
import { PARANOID_CONFIRM } from '../js/const.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a typed high bit byte in a class letter getlin advances the cursor', async () => {
    await freshObjectRoom({});
    applyNethackrc('OPTIONS=menustyle:traditional');
    await addInventoryObject(DAGGER);
    const gate = new InputGate();
    bindInputGate(gate);
    const display = game.nhDisplay;
    assert.ok(display);
    const command = rhack('D'.charCodeAt(0));
    await gate.waitUntilBlocked();
    const row = display.grid[0];
    assert.ok(row);
    // The rendered line is "prompt" + " " with the cursor after the space.
    const cursorStart = display.cursorCol;
    assert.ok(cursorStart > 1, 'the drop prompt must be on the message row');

    gate.feed('\u00cf');
    await gate.waitUntilBlocked();
    // nomux_putch() stores nothing for the byte, but the cursor moved on.
    assert.equal(row[cursorStart]?.ch, ' ');
    assert.equal(display.cursorCol, cursorStart + 1);

    gate.feed('q');
    await gate.waitUntilBlocked();
    // The next key lands one column further right than without the byte.
    assert.equal(row[cursorStart + 1]?.ch, 'q');
    assert.equal(display.cursorCol, cursorStart + 2);

    gate.feed('\u0085');
    await gate.waitUntilBlocked();
    assert.equal(display.cursorCol, cursorStart + 3);

    // Leave the editor: Escape clears the typed text, a second one cancels.
    gate.feed('\x1b');
    await gate.waitUntilBlocked();
    gate.feed('\x1b');
    await command;
});

void test('a high bit class letter reaches ggetobj as an unknown symbol', async () => {
    await freshObjectRoom({});
    applyNethackrc('OPTIONS=menustyle:traditional');
    await addInventoryObject(DAGGER);
    const gate = new InputGate();
    bindInputGate(gate);
    const command = rhack('D'.charCodeAt(0));
    await gate.waitUntilBlocked();
    gate.feed('\u00cf\n');
    await gate.waitUntilBlocked();
    gate.feed('\x1b');
    await gate.waitUntilBlocked();
    gate.feed('q');
    await command;
    assert.ok(game._messageHistory.includes(`You don't have any \u00cf's.`),
        'the unknown class letter message must carry the typed byte');
});

void test('paranoid confirm keeps a high bit whitespace byte in the answer', async () => {
    // C cmd.c:paranoid_ynq() mungspaces()es the buffer and compares it
    // with strcmpi(); hacklib.c:mungspaces() only folds ' ' and '\t', so a
    // byte like 0x85 stays and "no\x85" is not "no": PARANOID_CONFIRM
    // re-prompts with the "Yes" or "No" prefix instead of returning 'n'.
    await freshObjectRoom({});
    game.flags.paranoia_bits = PARANOID_CONFIRM;
    const gate = new InputGate();
    bindInputGate(gate);
    const answer = paranoidYesNoQuit(true, 'Really quit?');
    await gate.waitUntilBlocked();
    assert.equal(game._pending_message, 'Really quit? [yes|no|quit]');
    gate.feed('no\u0085\n');
    // On the fixed path the second prompt blocks the gate again; if the
    // byte were dropped the query would already have answered 'n'.
    await Promise.race([gate.waitUntilBlocked(), answer.then(() => 'answered')]);
    assert.equal(game._pending_message, '"Yes" or "No": Really quit? [yes|no|quit]');
    gate.feed('no\n');
    assert.equal(await answer, 'n');
});

void test('a typed high bit fruit name is sanitized one byte at a time', async () => {
    // C options.c:optfn_fruit() mungspaces()es the answer, copies it into
    // pl_fruit, then bones.c:sanitize_name() masks each byte with the high
    // bit set to '_' when the tty has no eight bit input: one byte in,
    // one character out.
    await freshObjectRoom({});
    const result = changePreferredFruit('\u00cf');
    assert.equal(result.message, 'Fruit is now "_".');
});
