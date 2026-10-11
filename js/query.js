// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), tty getlin/yn_function.
import { COLNO, PARANOID_CONFIRM } from './const.js';
import { clearMessageWindow, flushPendingTopline, flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';
export async function getLine(prompt, accepts = ch => /^[0-9+-]$/.test(ch), { suppressStatus = false } = {}) {
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
            game.nhDisplay?.putstr(0, row, line.slice(row * width, (row + 1) * width), NO_COLOR);
        }
        const length = line.length;
        const cursorRow = length ? Math.floor((length - 1) / width) : 0;
        const cursorX = length ? ((length - 1) % width) + 1 : 0;
        game.nhDisplay?.setCursor(cursorX, cursorRow);
    };
    const finish = (result) => {
        game._pending_message = '';
        game._retained_message = '';
        clearEditorRows();
        return result;
    };
    const clearSuppressedStatus = () => {
        if (!suppressStatus)
            return;
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    };
    // tty_getlin() acknowledges unread prose before replacing it with its
    // special prompt; the first key must still belong to that prose's pager.
    await flushPendingTopline();
    await pline(prompt);
    await flush_screen(1);
    clearSuppressedStatus();
    renderEditor();
    for (;;) {
        const key = await nhgetch();
        // C hooked_tty_getlin(): Escape first clears non-empty input; only
        // Escape at an already empty prompt cancels with "\033" (Null here).
        if (key === 27) {
            if (value) {
                value = '';
            }
            else
                return finish(null);
        }
        else if (key === 10 || key === 13)
            return finish(value);
        // getline.c tests the erase character ('\b' or, under the recorder's
        // NOMUX terminal synthesis, DEL) before the kill character, so DEL
        // backs over one byte and ^U removes the whole line.
        else if (key === 8 || key === 127)
            value = value.slice(0, -1);
        else if (key === 21)
            value = '';
        else {
            const ch = String.fromCharCode(key);
            if (value.length < 80 && accepts(ch, key))
                value += ch;
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
// C tty_yn_function(): Escape prefers quit, then no; whitespace chooses
// the displayed default. Invalid keys leave the same question active.
async function promptChoice(message, choices, defaultAnswer, cursorOffset) {
    game._suppressMessagesUntilInput = false;
    await flushPendingTopline();
    await pline(message);
    await flush_screen(1);
    placeToplinePromptCursor(message.length + cursorOffset);
    const wrapped = (game.nhDisplay?.cursorRow ?? 0) > 0;
    for (;;) {
        const key = await nhgetch();
        const character = String.fromCharCode(key).toLowerCase();
        let answer;
        if (key === 27) {
            answer = choices.find(choice => choice === 'q')
                ?? choices.find(choice => choice === 'n') ?? defaultAnswer;
        }
        else if ([32, 10, 13].includes(key)) {
            answer = defaultAnswer;
        }
        else
            answer = choices.find(choice => choice === character);
        if (answer === undefined)
            continue;
        // nhgetch marks the question as seen. tty_yn_function keeps a
        // one-line question visible and clears only prompts covering the map.
        if (wrapped)
            clearMessageWindow();
        return answer;
    }
}
export function promptYesNo(message, defaultAnswer = 'n', cursorOffset = 0) {
    return promptChoice(message, ['y', 'n'], defaultAnswer, cursorOffset);
}
export function promptYesNoQuit(message, defaultAnswer = 'q', cursorOffset = 0) {
    return promptChoice(message, ['y', 'n', 'q'], defaultAnswer, cursorOffset);
}
export function promptYesNoAllQuit(message, defaultAnswer = 'y', cursorOffset = 0) {
    return promptChoice(message, ['y', 'n', 'a', 'q'], defaultAnswer, cursorOffset);
}
// A per-question paranoia bit changes affirmative input from `y` to the full
// line `yes`.  PARANOID_CONFIRM additionally removes the default and requires
// `no` (or Escape) to reject, retrying other committed lines up to six times.
export async function paranoidQuery(beParanoid, prompt, paranoiaBits = game.flags?.paranoia_bits ?? 0) {
    if (!beParanoid)
        return await promptYesNo(`${prompt} [yn] (n) `) === 'y';
    const confirmAll = !!(paranoiaBits & PARANOID_CONFIRM);
    const responseType = confirmAll ? '[yes|no]' : '[yes|n] (n)';
    let prefix = '';
    let tries = 6;
    do {
        const line = await getLine(`${prefix}${prompt} ${responseType}`, (_ch, key) => key >= 32 && key < 127);
        if (line === null)
            return false;
        const answer = line.trim().replace(/\s+/g, ' ').toLowerCase();
        if (answer === 'yes')
            return true;
        if (!confirmAll || answer === 'no' || answer === 'quit')
            return false;
        prefix = '"Yes" or "No": ';
    } while (--tries);
    return false;
}
//# sourceMappingURL=query.js.map