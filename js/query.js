// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), tty getlin/yn_function.
import { COLNO, PARANOID_CONFIRM, QBUFSZ } from './const.js';
import { clearMessageWindow, flushPendingTopline, flush_screen, pline, rememberToplines, resetToplineClip, setTopline } from './display.js';
import { game } from './gstate.js';
import { nhgetch, readchar, takeCommandResponse } from './input.js';
import { restoreCannedCommandTail } from './cmd.js';
import { NO_COLOR } from './terminal.js';
import { clearCannedCommands } from './command_state.js';
import { rememberYnAnswerKey, takeRepeatCommand } from './command_repeat.js';
import { doprevMessage, keyText, messageWindowMode } from './prevmsg.js';
import { visibleCommandKey } from './command_keys.js';
import { FUZZER_IMPOSSIBLE_CONTINUE, impossible, paniclog } from './diagnostics.js';
import { truncateRawMessage } from './pline_text.js';
export async function getLine(prompt, accepts = ch => /^[0-9+-]$/.test(ch), options = {}) {
    // C windows.c:getlin(): queued CMDQ_KEY entries answer without any tty
    // prompt and are echoed as pline("%s %s", query, buf). A queued non-key
    // entry stops the drain and is discarded; '\n' ends the answer.
    const queuedKeys = [];
    let queued = false;
    for (;;) {
        const entry = game._inDoAgain ? takeRepeatCommand() : takeCommandResponse();
        const queuedKey = typeof entry === 'number' ? entry
            : typeof entry === 'object' && 'kind' in entry && entry.kind === 'key'
                ? entry.key : undefined;
        if (queuedKey === undefined) {
            // windows.c:getlin() pops the one command queue until a key
            // answers, then frees the first non-key entry it reaches — one
            // dropped entry per prompt. A non-key response from
            // takeCommandResponse() is that consumed entry already; only an
            // empty response queue leaves the next pop to the canned
            // command entries, whose bundled key or direction tails return
            // to the response queue (cmd.c queues them behind the command).
            if (entry === undefined && !game._inDoAgain) {
                const dropped = game._cannedCommands?.shift();
                if (dropped)
                    restoreCannedCommandTail(dropped);
            }
            break;
        }
        queued = true;
        if (queuedKey === 10)
            break;
        queuedKeys.push(queuedKey);
    }
    if (queued) {
        // The C buffer ends at its first NUL for both the echo and callers.
        const joined = String.fromCharCode(...queuedKeys);
        const text = joined.includes('\0') ? joined.slice(0, joined.indexOf('\0')) : joined;
        await pline(`${prompt} ${text}`);
        // C getlin() leaves "\033" in the buffer; callers cancel on it, the
        // same cancellation the typed path reports as null.
        return text.charCodeAt(0) === 27 ? null : text;
    }
    // windows.c:getlin() disables bot() through tty's prompt cleanup.
    // Covered status rows stay blank until a later status update.
    const statusUpdatesDisabled = game._statusUpdatesDisabled ?? false;
    game._statusUpdatesDisabled = true;
    try {
        return await tty_getlin(prompt, accepts, options);
    }
    finally {
        game._statusUpdatesDisabled = statusUpdatesDisabled;
    }
}
// Direct tty callers, such as menu search, read live input without consuming
// queued command answers. Core getlin() owns that queue through getLine().
export async function tty_getlin(prompt, accepts, { suppressStatus = false, inMenu = false }) {
    let value = '';
    let renderedRows = 1;
    // Rows this editor ever covered, kept apart from the current content
    // height: shortening a wrapped answer (backspace, Ctrl-U) does not
    // repaint the deeper rows, so cleanup must still clear them all.
    let coveredRows = 1;
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
    const renderEditor = () => {
        const line = `${prompt} ${value}`;
        const contentRows = Math.max(1, Math.ceil(line.length / width));
        coveredRows = Math.max(coveredRows, contentRows);
        // topl_putsym() clears each row it wraps onto with cl_end()
        // before echoing there, so a freshly wrapped row cannot keep
        // stale cells from earlier message-window output.  A getlin
        // running under an open menu writes behind that menu; the menu
        // keeps repainting its own rows, so only the rows this editor
        // already painted are cleared there.
        const rowsToClear = inMenu ? renderedRows : Math.max(renderedRows, contentRows);
        for (let row = 0; row < rowsToClear; row++)
            game.nhDisplay?.clearRow(row);
        renderedRows = inMenu ? Math.max(renderedRows, contentRows) : contentRows;
        for (let row = 0; row < contentRows; row++) {
            game.nhDisplay?.putstr(0, row, line.slice(row * width, (row + 1) * width), NO_COLOR);
        }
        game.nhDisplay?.setCursor(cursorColumn, cursorRow);
        // show_topl() draws the prompt through addtopl(), ending
        // TOPLINE_SPECIAL_PROMPT before any answer is typed.
        game._promptOwnsTopline = false;
    };
    const finish = (result) => {
        clearMessageWindow(coveredRows);
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
        rememberToplines();
        game._pending_message = prompt;
        resetToplineClip();
        game._retained_message = '';
    }
    else {
        await setTopline(prompt);
        await flush_screen(1);
    }
    clearSuppressedStatus();
    renderEditor();
    // hooked_tty_getlin()'s loop head keeps gt.toplines equal to the
    // query and typed text; typing uses putsyms(), without word wrapping.
    game._toplines = `${prompt} ${value}`;
    let doprev = false;
    for (;;) {
        const key = await nhgetch();
        if (key === 16) {
            // C hooked_tty_getlin(): ^P browses with inread clear. Single
            // and first-press combination walk two entries and keep the
            // recalled line visible; the other modes page the full window
            // and repaint the prompt with the typed text.
            const mode = messageWindowMode();
            if (mode === 's' || (mode === 'c' && !doprev)) {
                if (!doprev)
                    await doprevMessage(false);
                await doprevMessage(false);
                doprev = true;
                game._toplines = `${prompt} ${value}`;
                continue;
            }
            await doprevMessage(false);
            doprev = false;
            game._messageHistoryCursor = null;
            game._pending_message = `${prompt} ${value}`;
            game._toplines = game._pending_message;
            clearSuppressedStatus();
            renderEditor();
            continue;
        }
        if (doprev) {
            // The first ordinary key after browsing only resets the walk;
            // it is still processed by this pass.
            game._messageHistoryCursor = null;
            doprev = false;
        }
        // pgetchar() returns signed char in the pinned build: 0xff becomes
        // EOF, which hooked_tty_getlin() cancels even after typed text.
        if (key === -1 || key === 0xff)
            return finish(null);
        // C hooked_tty_getlin(): Escape first clears non-empty input; only
        // Escape at an already empty prompt cancels with "\033" (Null here).
        if (key === 27) {
            if (value) {
                value = '';
                clearMessageWindow(coveredRows);
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
        // The loop head rebuilds gt.toplines from the query and typed text.
        game._toplines = game._pending_message;
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
    // show_topl() draws the prompt through addtopl(), ending
    // TOPLINE_SPECIAL_PROMPT before any answer is typed (topl.c:428).
    game._promptOwnsTopline = false;
}
// C tty_yn_function(): Escape prefers quit, then no; whitespace chooses
// the displayed default. Invalid keys leave the same question active.
export async function promptChoice(query, choices, defaultAnswer, { visibleChoices = choices.join(''), addCommandQueue = true } = {}) {
    const result = await yn_function(query, choices.join(''), defaultAnswer, addCommandQueue, visibleChoices);
    return choices.find(choice => choice === result.answer) ?? defaultAnswer;
}
// C cmd.c:yn_function() records the answer key, while yn_number remains
// the last tty question's value. Replaying '#' does not read another count.
export async function yn_function(query, responses, defaultAnswer = '', addCommandQueue = true, visibleChoices = responses?.split('\x1b')[0] ?? '') {
    const queued = addCommandQueue ? takeRepeatCommand() : undefined;
    let result;
    if (queued) {
        // A non-key CQ_REPEAT entry keeps the ESC initializer, and
        // cmdq_clear(CQ_CANNED) drops every canned command behind it.
        if (queued.kind !== 'key')
            clearCannedCommands();
        const answer = queued.kind === 'key' ? String.fromCharCode(queued.key) : '\x1b';
        result = { answer, count: game._ynNumber ?? 0n };
    }
    else {
        // C cmdq_pop() takes CQ_CANNED here, but never while a do-again
        // replay owns the input. That one entry decides the outcome: a
        // key answers, a user-input placeholder asks live, and any other
        // entry — or a canned command reached through an empty response
        // queue — keeps the ESC initializer while cmdq_clear(CQ_CANNED)
        // drops the remaining canned entries, so the question is never
        // shown.
        const response = addCommandQueue && !game._inDoAgain
            ? takeCommandResponse() : undefined;
        const cannedCommand = response === undefined && addCommandQueue && !game._inDoAgain
            ? game._cannedCommands?.shift() ?? null : null;
        if (typeof response === 'number') {
            result = { answer: String.fromCharCode(response), count: game._ynNumber ?? 0n };
        }
        else if (cannedCommand || (response !== undefined && response !== 'user-input')) {
            clearCannedCommands();
            result = { answer: '\x1b', count: game._ynNumber ?? 0n };
        }
        else {
            result = await tty_yn_function(query, responses, defaultAnswer, visibleChoices);
            if (addCommandQueue)
                rememberYnAnswerKey(result.answer ? result.answer.charCodeAt(0) : 0);
        }
    }
    if (!responses || !result.answer || result.answer === '\0' || responses.includes(result.answer))
        return result;
    const alternative = defaultAnswer || '\x1b';
    if (!game._inDoAgain || game.flags.debug)
        await reportInvalidYnAnswer(query, responses, defaultAnswer, result.answer, alternative);
    return { ...result, answer: alternative };
}
async function reportInvalidYnAnswer(query, responses, defaultAnswer, answer, alternative) {
    const shownDefault = defaultAnswer ? visibleCommandKey(defaultAnswer.charCodeAt(0)) : '';
    const question = query.length >= QBUFSZ ? `${query.slice(0, QBUFSZ - 4)}...` : query;
    paniclog('yn debug', truncateRawMessage(`${question} [${responses}] (${shownDefault})`));
    // C uses fuzzer continue mode for this known diagnostic, preventing
    // both a panic and message-pager input while impossible() reports it.
    const previousMode = game.flags.debug_fuzzer;
    const previousInputFuzzer = game.iflags.debug_fuzzer;
    game.flags.debug_fuzzer = FUZZER_IMPOSSIBLE_CONTINUE;
    game.iflags.debug_fuzzer = true;
    try {
        const originalKey = visibleCommandKey(answer.charCodeAt(0));
        const alternativeKey = visibleCommandKey(alternative.charCodeAt(0));
        await impossible(`yn_function() returned '${originalKey}'; using '${alternativeKey}' instead`);
    }
    finally {
        if (previousMode === undefined)
            delete game.flags.debug_fuzzer;
        else
            game.flags.debug_fuzzer = previousMode;
        if (previousInputFuzzer === undefined)
            delete game.iflags.debug_fuzzer;
        else
            game.iflags.debug_fuzzer = previousInputFuzzer;
    }
}
// Native tty_yn_function returns the answer and sets yn_number. Keep the
// number in the result so each suspended question owns its own answer.
export async function tty_yn_function(query, responses, defaultAnswer = '', visibleChoices = responses?.split('\x1b')[0] ?? '') {
    game._ynNumber = 0n;
    const question = query.length >= QBUFSZ
        ? `${query.slice(0, QBUFSZ - 4)}...` : query;
    const choices = visibleChoices.split('\x1b')[0] ?? '';
    const message = responses === null ? `${question} `
        : `${question} [${choices}]${defaultAnswer ? ` (${defaultAnswer})` : ''} `;
    const preserveCase = responses === null || /[A-Z]/.test(responses);
    const readAnswer = async () => {
        // readchar() returns a signed C char; strings represent its byte.
        const key = (await readchar()) & 255;
        return String.fromCharCode(!preserveCase && key >= 65 && key <= 90 ? key + 32 : key);
    };
    if (!game._suppressMessagesUntilInput)
        await flushPendingTopline();
    game._suppressMessagesUntilInput = false;
    await setTopline(message);
    await flush_screen(1);
    renderChoicePrompt(message);
    // custompline(SUPPRESS_HISTORY) drew the question through
    // show_topl()'s addtopl(), which already ended TOPLINE_SPECIAL_PROMPT;
    // an unread wrapped question pages on recall like any other line.
    let displayed = message;
    let coveredRows = (game.nhDisplay?.cursorRow ?? 0) + 1;
    const paint = (text) => {
        // Removing a wrapped count must erase its old rows as well as
        // repainting the shorter prompt. Cleanup still owns those rows.
        for (let row = 1; row < coveredRows; row++)
            game.nhDisplay?.clearRow(row);
        displayed = text;
        renderChoicePrompt(text);
        coveredRows = Math.max(coveredRows, (game.nhDisplay?.cursorRow ?? 0) + 1);
    };
    const finish = (answer, count = 0n) => {
        game._ynNumber = count;
        // clean_up rewrites gt.toplines with the answered question; the
        // recorded answer names the key like C key2txt().
        game._toplines = message + (count ? `#${count}` : keyText(answer.charCodeAt(0)));
        game._promptOwnsTopline = false;
        // Native cleanup marks the question seen even when fuzzer input
        // bypasses tty_nhgetch(). Keep a one-line question visible.
        game._pending_message = '';
        game._retained_message = displayed;
        if (coveredRows > 1)
            clearMessageWindow(coveredRows);
        return { answer, count };
    };
    if (responses === null)
        return finish(await readAnswer());
    let doprev = false;
    for (;;) {
        const character = await readAnswer();
        if (character === '\x10') {
            if (messageWindowMode() !== 's') {
                // Full, combination, and reverse page the window with
                // inread clear, then repaint the question.
                await doprevMessage(false);
                clearMessageWindow();
                game._messageHistoryCursor = null;
                await setTopline(message);
                await flush_screen(1);
                renderChoicePrompt(message);
            }
            else {
                // Two recalls initially: gt.toplines holds the question
                // prompt, so the first press already shows one entry back.
                if (!doprev)
                    await doprevMessage(true);
                await doprevMessage(true);
                doprev = true;
            }
            continue;
        }
        if (doprev) {
            // The key typed after single-mode browsing is discarded and the
            // question repainted, exactly like tty_yn_function().
            clearMessageWindow();
            game._messageHistoryCursor = null;
            doprev = false;
            await setTopline(message);
            await flush_screen(1);
            renderChoicePrompt(message);
            continue;
        }
        if (character === '\x1b')
            return finish(responses.includes('q') ? 'q'
                : responses.includes('n') ? 'n' : defaultAnswer);
        // strchr(quitchars, q) also matches the string's terminating NUL.
        if (' \n\r\0'.includes(character))
            return finish(defaultAnswer);
        const digit = /^[0-9]$/.test(character);
        if (!responses.includes(character) && !(digit && responses.includes('#')))
            continue;
        if (character !== '#' && !digit)
            return finish(character);
        // Digits are numbers only when '#' is among the allowed responses.
        if (!responses.includes('#'))
            return finish(character);
        const number = await readChoiceNumber(character, message, readAnswer, paint);
        if (number === null)
            continue;
        return number === 0n ? finish('n') : finish('#', number);
    }
}
async function readChoiceNumber(first, prompt, readAnswer, paint) {
    let digits = first === '#' ? '' : first;
    let value = digits ? BigInt(digits) : 0n;
    paint(prompt + '#' + digits);
    for (;;) {
        const character = await readAnswer();
        if (/^[0-9]$/.test(character)) {
            const next = value * 10n + BigInt(character);
            if (next > 9223372036854775807n)
                break;
            value = next;
            digits += character;
        }
        else if (character === 'y' || ' \n\r\x1b\0'.includes(character)) {
            if (character !== '\x1b')
                return value;
            break;
        }
        else if (character === '\x7f' || character === '\b') {
            if (!digits)
                break;
            value /= 10n;
            digits = digits.slice(0, -1);
        }
        else
            break;
        paint(prompt + '#' + digits);
    }
    // Escape, overflow, erasing the '#', or an invalid character aborts the
    // number and returns to the same yes/no question without that character.
    paint(prompt);
    return null;
}
export function promptYesNo(message, defaultAnswer = 'n', addCommandQueue = true) {
    return promptChoice(message, ['y', 'n'], defaultAnswer, { addCommandQueue });
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
    return await paranoidYesNoQuit(beParanoid, prompt, false, paranoiaBits) === 'y';
}
// C cmd.c:paranoid_ynq(). Confirmation answers are deliberately excluded
// from command recall: every repeated dangerous action asks again.
export async function paranoidYesNoQuit(beParanoid, prompt, acceptQuit = true, paranoiaBits = game.flags?.paranoia_bits ?? 0) {
    if (!beParanoid)
        return acceptQuit
            ? promptChoice(prompt, ['y', 'n', 'q'], 'n', { addCommandQueue: false })
            : promptYesNo(prompt, 'n', false);
    const confirmAll = !!(paranoiaBits & PARANOID_CONFIRM);
    const responseType = confirmAll ? acceptQuit ? '[yes|no|quit]' : '[yes|no]'
        : acceptQuit ? '[yes|n|q] (n)' : '[yes|n] (n)';
    let prefix = '', question = prompt.slice(0, 255);
    for (let attempt = 0; attempt < 6; attempt++) {
        const extra = prefix.length + 1 + responseType.length;
        if (question.length + extra > QBUFSZ - 1)
            question = question.slice(0, QBUFSZ - 1 - extra - 4) + '...?';
        const line = await getLine(`${prefix}${question} ${responseType}`, (_ch, key) => key >= 32 && key < 127);
        if (line === null)
            return acceptQuit ? 'q' : 'n';
        const answer = line.trim().replace(/\s+/g, ' ').toLowerCase();
        if (answer === 'yes')
            return 'y';
        if (answer === 'quit')
            return acceptQuit ? 'q' : 'n';
        if (!confirmAll || answer === 'no')
            return 'n';
        prefix = '"Yes" or "No": ';
    }
    return 'n';
}
//# sourceMappingURL=query.js.map