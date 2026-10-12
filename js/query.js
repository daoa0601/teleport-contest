// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), tty getlin/yn_function.
import { COLNO, PARANOID_CONFIRM, QBUFSZ } from './const.js';
import { clearMessageWindow, flushPendingTopline, flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';
export async function getLine(prompt, accepts = ch => /^[0-9+-]$/.test(ch), { suppressStatus = false, inMenu = false } = {}) {
    let value = '';
    let renderedRows = 1;
    const width = (game.nhDisplay?.cols ?? COLNO) - 1;
    const promptLength = prompt.length + 1;
    const promptRow = Math.floor((promptLength - 1) / width);
    const promptColumn = (promptLength - 1) % width + 1;
    let cursorRow = promptRow;
    let cursorColumn = promptColumn;
    const eraseCharacter = () => {
        if (cursorColumn === 0 && cursorRow > 0) {
            cursorRow--;
            cursorColumn = width;
        }
        if (cursorColumn > 0)
            cursorColumn--;
    };
    const clearEditorRows = () => {
        for (let row = 0; row < renderedRows; row++)
            game.nhDisplay?.clearRow(row);
    };
    const renderEditor = () => {
        const line = `${prompt} ${value}`;
        clearEditorRows();
        const contentRows = Math.max(1, Math.ceil(line.length / width));
        renderedRows = Math.max(renderedRows, contentRows);
        for (let row = 0; row < contentRows; row++) {
            game.nhDisplay?.putstr(0, row, line.slice(row * width, (row + 1) * width), NO_COLOR);
        }
        game.nhDisplay?.setCursor(cursorColumn, cursorRow);
    };
    const finish = (result) => {
        clearMessageWindow(renderedRows);
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
    if (!game._suppressMessagesUntilInput)
        await flushPendingTopline();
    game._suppressMessagesUntilInput = false;
    if (inMenu) {
        // hooked_tty_getlin() writes to WIN_MESSAGE while the menu stays
        // active. A full screen flush here would replace it with the map.
        game._pending_message = prompt;
        game._retained_message = '';
    }
    else {
        await pline(prompt);
        await flush_screen(1);
    }
    clearSuppressedStatus();
    renderEditor();
    for (;;) {
        const key = await nhgetch();
        // C hooked_tty_getlin(): Escape first clears non-empty input; only
        // Escape at an already empty prompt cancels with "\033" (Null here).
        if (key === 27) {
            if (value) {
                value = '';
                clearMessageWindow(renderedRows);
                renderedRows = 1;
                cursorColumn = promptColumn;
                cursorRow = promptRow;
            }
            else
                return finish(null);
        }
        else if (key === 10 || key === 13)
            return finish(value);
        // getline.c tests the erase character ('\b' or, under the recorder's
        // NOMUX terminal synthesis, DEL) before the kill character, so DEL
        // backs over one byte and ^U removes the whole line.
        else if (key === 8 || key === 127) {
            if (value) {
                value = value.slice(0, -1);
                eraseCharacter();
            }
        }
        else if (key === 21) {
            for (let index = 0; index < value.length; index++)
                eraseCharacter();
            value = '';
        }
        else {
            const ch = String.fromCharCode(key);
            if (key >= 32 && key !== 127 && value.length < COLNO && accepts(ch, key)) {
                value += ch;
                if (cursorColumn === width) {
                    cursorColumn = 0;
                    cursorRow++;
                }
                cursorColumn++;
            }
        }
        game._pending_message = `${prompt} ${value}`;
        clearSuppressedStatus();
        renderEditor();
    }
}
function renderChoicePrompt(message) {
    const display = game.nhDisplay;
    if (!display)
        return;
    const width = display.cols - 1;
    for (let row = 0; row * width < message.length; row++) {
        display.clearRow(row);
        display.putstr(0, row, message.slice(row * width, (row + 1) * width), NO_COLOR);
    }
    const length = message.length;
    display.setCursor(length ? (length - 1) % width + 1 : 0, length ? Math.floor((length - 1) / width) : 0);
}
// C tty_yn_function(): Escape prefers quit, then no; whitespace chooses
// the displayed default. Invalid keys leave the same question active.
export async function promptChoice(query, choices, defaultAnswer, { visibleChoices = choices.join('') } = {}) {
    const message = `${query.slice(0, QBUFSZ - 1)} [${visibleChoices}] (${defaultAnswer}) `;
    const preserveCase = choices.some(choice => /[A-Z]/.test(choice));
    game._suppressMessagesUntilInput = false;
    await flushPendingTopline();
    await pline(message);
    await flush_screen(1);
    renderChoicePrompt(message);
    const wrapped = (game.nhDisplay?.cursorRow ?? 0) > 0;
    for (;;) {
        const key = await nhgetch();
        const character = preserveCase ? String.fromCharCode(key) : String.fromCharCode(key).toLowerCase();
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
        if (game.nhDisplay)
            game.nhDisplay.toplines = message + answer;
        // nhgetch marks the question as seen. tty_yn_function keeps a
        // one-line question visible and clears only prompts covering the map.
        if (wrapped)
            clearMessageWindow();
        return answer;
    }
}
export function promptYesNo(message, defaultAnswer = 'n') {
    return promptChoice(message, ['y', 'n'], defaultAnswer);
}
export function promptYesNoQuit(message, defaultAnswer = 'q') {
    return promptChoice(message, ['y', 'n', 'q'], defaultAnswer);
}
export function promptYesNoAllQuit(message, defaultAnswer = 'y') {
    return promptChoice(message, ['y', 'n', 'a', 'q'], defaultAnswer);
}
// A per-question paranoia bit changes affirmative input from `y` to the full
// line `yes`.  PARANOID_CONFIRM additionally removes the default and requires
// `no` (or Escape) to reject, retrying other committed lines up to six times.
export async function paranoidQuery(beParanoid, prompt, paranoiaBits = game.flags?.paranoia_bits ?? 0) {
    if (!beParanoid)
        return await promptYesNo(prompt) === 'y';
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