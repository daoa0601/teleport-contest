// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), tty getlin/yn_function.

import { COLNO, PARANOID_CONFIRM, QBUFSZ } from './const.js';
import {
    clearMessageWindow, flushPendingTopline, rememberToplines, resetToplineClip,
} from './tty_topline.js';
import { flush_screen } from './display.js';
import { pline, setTopline } from './pline.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { readchar, cmdq_pop } from './cmd.js';
import type { CommandDirection } from './input.js';
import { NO_COLOR } from './terminal.js';
import { CMDQ_KEY } from './const.js';
import { messageWindowMode } from './prevmsg.js';
import { doprevMessage, keyText } from './cmd.js';
import { visibleCommandKey } from './cmd.js';
import { FUZZER_IMPOSSIBLE_CONTINUE, impossible, paniclog } from './diagnostics.js';
import { truncateRawMessage } from './pline_text.js';
import { showChoiceWindow } from './windows.js';
import { availableExtendedCommands, commandAutocompletes, yn_function } from './cmd.js';

interface LineInputOptions {
    suppressStatus?: boolean;
    inMenu?: boolean;
}

export async function getLine(
    prompt: string,
    accepts: (character: string, key: number) => boolean = ch => /^[0-9+-]$/.test(ch),
    options: LineInputOptions = {},
): Promise<string | null> {
    // C windows.c:getlin(): queued CMDQ_KEY entries answer without any tty
    // prompt and are echoed as pline("%s %s", query, buf). The first
    // non-key entry stops the drain and is discarded; '\n' ends the
    // answer (windows.c:1875-1893).
    const queuedKeys: number[] = [];
    let queued = false;
    for (;;) {
        const entry = cmdq_pop();
        if (!entry || entry.typ !== CMDQ_KEY) break;
        queued = true;
        if (entry.key === 10) break;
        queuedKeys.push(entry.key);
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
    } finally {
        game._statusUpdatesDisabled = statusUpdatesDisabled;
    }
}

// C getline.c:tty_getlin()
// Also C getline.c:hooked_tty_getlin(): line editing is inlined here
// Direct tty callers, such as menu search, read live input without consuming
// queued command answers. Core getlin() owns that queue through getLine().
export async function tty_getlin(
    prompt: string,
    accepts: (character: string, key: number) => boolean,
    { suppressStatus = false, inMenu = false }: LineInputOptions,
): Promise<string | null> {
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
        if (cursorColumn > 0) cursorColumn--;
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
            game.nhDisplay?.putstr(
                0, row, line.slice(row * width, (row + 1) * width),
                NO_COLOR,
            );
        }
        game.nhDisplay?.setCursor(cursorColumn, cursorRow);
        // show_topl() draws the prompt through addtopl(), ending
        // TOPLINE_SPECIAL_PROMPT before any answer is typed.
        game._promptOwnsTopline = false;
    };
    const finish = (result: string | null): string | null => {
        clearMessageWindow(coveredRows);
        return result;
    };
    const clearSuppressedStatus = () => {
        if (!suppressStatus) return;
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    };
    // tty_getlin() acknowledges unread prose before replacing it with its
    // special prompt; the first key must still belong to that prose's pager.
    if (!game._suppressMessagesUntilInput) await flushPendingTopline();
    game._suppressMessagesUntilInput = false;
    if (inMenu) {
        // hooked_tty_getlin() writes to WIN_MESSAGE while the menu stays
        // active. A full screen flush here would replace it with the map.
        rememberToplines();
        game._pending_message = prompt;
        resetToplineClip();
        game._retained_message = '';
    } else {
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
                if (!doprev) await doprevMessage(false);
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
        if (key === -1 || key === 0xff) return finish(null);
        // C hooked_tty_getlin(): Escape first clears non-empty input; only
        // Escape at an already empty prompt cancels with "\033" (Null here).
        if (key === 27) {
            if (value) {
                value = '';
                clearMessageWindow(coveredRows);
                renderedRows = 1;
                cursorColumn = promptColumn;
                cursorRow = promptRow;
            } else return finish(null);
        } else if (key === 10 || key === 13) return finish(value);
        // getline.c tests the erase character ('\b' or, under the recorder's
        // NOMUX terminal synthesis, DEL) before the kill character, so DEL
        // backs over one byte and ^U removes the whole line.
        else if (key === 8 || key === 127) {
            if (value) { value = value.slice(0, -1); eraseCharacter(); }
        } else if (key === 21) {
            for (let index = 0; index < value.length; index++) eraseCharacter();
            value = '';
        }
        else {
            const ch = String.fromCharCode(key);
            if (key >= 32 && key !== 127 && value.length < COLNO && accepts(ch, key)) {
                value += ch;
                if (cursorColumn === width) { cursorColumn = 0; cursorRow++; }
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

function renderChoicePrompt(message: string): void {
    const display = game.nhDisplay;
    if (!display) return;
    const width = display.cols - 1;
    for (let row = 0; row * width < message.length; row++) {
        display.clearRow(row);
        display.putstr(0, row, message.slice(row * width, (row + 1) * width), NO_COLOR);
    }
    const length = message.length;
    display.setCursor(length ? (length - 1) % width + 1 : 0,
        length ? Math.floor((length - 1) / width) : 0);
    // show_topl() draws the prompt through addtopl(), ending
    // TOPLINE_SPECIAL_PROMPT before any answer is typed (topl.c:428).
    game._promptOwnsTopline = false;
}

// C tty_yn_function(): Escape prefers quit, then no; whitespace chooses
// the displayed default. Invalid keys leave the same question active.
export async function promptChoice<Choice extends string>(
    query: string, choices: readonly Choice[], defaultAnswer: Choice,
    { visibleChoices = choices.join(''), addCommandQueue = true, menuable = false }: {
        visibleChoices?: string; addCommandQueue?: boolean; menuable?: boolean;
    } = {},
): Promise<Choice> {
    const result = await yn_function(query, choices.join(''), defaultAnswer, addCommandQueue,
        { visibleChoices, menuable });
    return choices.find(choice => choice === result.answer) ?? defaultAnswer;
}

export interface TtyPromptAnswer { answer: string; count: bigint }

// C getline.c:ext_cmd_getlin_hook().
// Also C cmd.c:extcmds_match(): inlined here (the case-insensitive prefix
// match over autocomplete-eligible commands; the eligibility filter half
// is availableExtendedCommands()).
export function completeExtendedCommand(prefix: string): string | null {
    const matches = availableExtendedCommands().filter(command =>
        commandAutocompletes(command)
        && command.name?.toLowerCase().startsWith(prefix.toLowerCase()));
    return matches.length === 1 ? matches[0]?.name ?? null : null;
}


// Native tty_yn_function returns the answer and sets yn_number. Keep the
// number in the result so each suspended question owns its own answer.
export async function tty_yn_function(
    query: string, responses: string | null, defaultAnswer = '',
    visibleChoices = responses?.split('\x1b')[0] ?? '',
): Promise<TtyPromptAnswer> {
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
    if (!game._suppressMessagesUntilInput) await flushPendingTopline();
    game._suppressMessagesUntilInput = false;
    await setTopline(message);
    await flush_screen(1);
    renderChoicePrompt(message);
    // custompline(SUPPRESS_HISTORY) drew the question through
    // show_topl()'s addtopl(), which already ended TOPLINE_SPECIAL_PROMPT;
    // an unread wrapped question pages on recall like any other line.
    let displayed = message;
    let coveredRows = (game.nhDisplay?.cursorRow ?? 0) + 1;
    const paint = (text: string) => {
        // Removing a wrapped count must erase its old rows as well as
        // repainting the shorter prompt. Cleanup still owns those rows.
        for (let row = 1; row < coveredRows; row++) game.nhDisplay?.clearRow(row);
        displayed = text;
        renderChoicePrompt(text);
        coveredRows = Math.max(coveredRows, (game.nhDisplay?.cursorRow ?? 0) + 1);
    };
    const finish = (answer: string, count = 0n): TtyPromptAnswer => {
        game._ynNumber = count;
        // clean_up rewrites gt.toplines with the answered question; the
        // recorded answer names the key like C key2txt().
        game._toplines = message + (count ? `#${count}` : keyText(answer.charCodeAt(0)));
        game._promptOwnsTopline = false;
        // Native cleanup marks the question seen even when fuzzer input
        // bypasses tty_nhgetch(). Keep a one-line question visible.
        game._pending_message = '';
        game._retained_message = displayed;
        if (coveredRows > 1) clearMessageWindow(coveredRows);
        return { answer, count };
    };
    if (responses === null) return finish(await readAnswer());
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
            } else {
                // Two recalls initially: gt.toplines holds the question
                // prompt, so the first press already shows one entry back.
                if (!doprev) await doprevMessage(true);
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
        if (character === '\x1b') return finish(responses.includes('q') ? 'q'
            : responses.includes('n') ? 'n' : defaultAnswer);
        // strchr(quitchars, q) also matches the string's terminating NUL.
        if (' \n\r\0'.includes(character)) return finish(defaultAnswer);
        const digit = /^[0-9]$/.test(character);
        if (!responses.includes(character) && !(digit && responses.includes('#'))) continue;
        if (character !== '#' && !digit) return finish(character);
        // Digits are numbers only when '#' is among the allowed responses.
        if (!responses.includes('#')) return finish(character);
        const number = await readChoiceNumber(character, message, readAnswer, paint);
        if (number === null) continue;
        return number === 0n ? finish('n') : finish('#', number);
    }
}

// C topl.c:tty_yn_function(): numeric response entry.
// Also C topl.c:removetopl(): inlined here when erasing digits or abandoning the count.
async function readChoiceNumber(
    first: string, prompt: string, readAnswer: () => Promise<string>, paint: (text: string) => void,
): Promise<bigint | null> {
    let digits = first === '#' ? '' : first;
    let value = digits ? BigInt(digits) : 0n;
    paint(prompt + '#' + digits);
    for (;;) {
        const character = await readAnswer();
        if (/^[0-9]$/.test(character)) {
            const next = value * 10n + BigInt(character);
            if (next > 9223372036854775807n) break;
            value = next;
            digits += character;
        } else if (character === 'y' || ' \n\r\x1b\0'.includes(character)) {
            if (character !== '\x1b') return value;
            break;
        } else if (character === '\x7f' || character === '\b') {
            if (!digits) break;
            value /= 10n;
            digits = digits.slice(0, -1);
        } else break;
        paint(prompt + '#' + digits);
    }
    // Escape, overflow, erasing the '#', or an invalid character aborts the
    // number and returns to the same yes/no question without that character.
    paint(prompt);
    return null;
}

export function promptYesNo(message: string, defaultAnswer: 'y' | 'n' = 'n', addCommandQueue = true): Promise<'y' | 'n'> {
    return promptChoice(message, ['y', 'n'], defaultAnswer, { addCommandQueue, menuable: true });
}

export function promptYesNoQuit(message: string, defaultAnswer: 'y' | 'n' | 'q' = 'q'): Promise<'y' | 'n' | 'q'> {
    return promptChoice(message, ['y', 'n', 'q'], defaultAnswer, { menuable: true });
}

export function promptYesNoAllQuit(message: string, defaultAnswer: 'y' | 'n' | 'a' | 'q' = 'y'): Promise<'y' | 'n' | 'a' | 'q'> {
    return promptChoice(message, ['y', 'n', 'a', 'q'], defaultAnswer, { menuable: true });
}

