// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), tty getlin/yn_function.

import { COLNO, PARANOID_CONFIRM } from './const.js';
import { flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';

export async function getLine(
    prompt,
    accepts = ch => /^[0-9+-]$/.test(ch),
    { suppressStatus = false } = {},
) {
    let value = '';
    let renderedRows = 1;
    const clearEditorRows = () => {
        for (let row = 0; row < renderedRows; row++)
            game.nhDisplay?.clearRow(row);
    };
    const renderEditor = () => {
        const line = `${prompt} ${value}`;
        clearEditorRows();
        const width = 79; // tty safe margin; column79 remains wrap sentinel
        renderedRows = Math.max(1, Math.ceil(line.length / width));
        for (let row = 0; row < renderedRows; row++) {
            game.nhDisplay?.putstr(
                0, row, line.slice(row * width, (row + 1) * width),
                NO_COLOR,
            );
        }
        const length = line.length;
        const cursorRow = length ? Math.floor((length - 1) / width) : 0;
        const cursorX = length ? ((length - 1) % width) + 1 : 0;
        game.nhDisplay?.setCursor(cursorX, cursorRow);
    };
    const finish = result => {
        game._pending_message = '';
        game._retained_message = '';
        clearEditorRows();
        return result;
    };
    const clearSuppressedStatus = () => {
        if (!suppressStatus) return;
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    };
    await pline(prompt);
    await flush_screen(1);
    clearSuppressedStatus();
    renderEditor();
    for (;;) {
        const key = await nhgetch();
        if (key === 27) return finish(null);
        if (key === 10 || key === 13) return finish(value);
        if (key === 8 || key === 127) value = value.slice(0, -1);
        else {
            const ch = String.fromCharCode(key);
            if (value.length < 80 && accepts(ch, key)) value += ch;
        }
        game._pending_message = `${prompt} ${value}`;
        await flush_screen(1);
        clearSuppressedStatus();
        renderEditor();
    }
}

function placeToplinePromptCursor(position) {
    const display = game.nhDisplay;
    const columns = display?.cols ?? COLNO;
    if (position > columns - 1)
        display?.setCursor(position - (columns - 1), 1);
    else
        display?.setCursor(position, 0);
}

// yn_function() owns one key at a time.  Escape, space, and either newline
// select the displayed default; unrelated keys leave the query active.
export async function promptYesNo(
    message, defaultAnswer = 'n', cursorOffset = 0,
) {
    game._suppressMessagesUntilInput = false;
    await pline(message);
    await flush_screen(1);
    placeToplinePromptCursor(message.length + cursorOffset);
    for (;;) {
        const key = await nhgetch();
        const answer = String.fromCharCode(key).toLowerCase();
        if (answer !== 'y' && answer !== 'n'
            && ![27, 32, 10, 13].includes(key)) continue;
        game._pending_message = '';
        game._retained_message = '';
        return answer === 'y' || answer === 'n' ? answer : defaultAnswer;
    }
}

// A per-question paranoia bit changes affirmative input from `y` to the full
// line `yes`.  PARANOID_CONFIRM additionally removes the default and requires
// `no` (or Escape) to reject, retrying other committed lines up to six times.
export async function paranoidQuery(
    beParanoid,
    prompt,
    paranoiaBits = game.flags?.paranoia_bits ?? 0,
) {
    if (!beParanoid)
        return await promptYesNo(`${prompt} [yn] (n) `) === 'y';

    const confirmAll = !!(paranoiaBits & PARANOID_CONFIRM);
    const responseType = confirmAll ? '[yes|no]' : '[yes|n] (n)';
    let prefix = '';
    let tries = 6;
    do {
        const line = await getLine(
            `${prefix}${prompt} ${responseType}`,
            (_ch, key) => key >= 32 && key < 127,
        );
        if (line === null) return false;
        const answer = line.trim().replace(/\s+/g, ' ').toLowerCase();
        if (answer === 'yes') return true;
        if (!confirmAll || answer === 'no' || answer === 'quit') return false;
        prefix = '"Yes" or "No": ';
    } while (--tries);
    return false;
}
