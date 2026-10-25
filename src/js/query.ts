// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), tty getlin/yn_function.

import { COLNO, PARANOID_CONFIRM, QBUFSZ } from './const.js';
import { clearMessageWindow, flushPendingTopline, flush_screen, setTopline } from './display.js';
import { game } from './gstate.js';
import { nhgetch, readchar } from './input.js';
import { NO_COLOR } from './terminal.js';
import { rememberCommandKey, takeRepeatCommand } from './command_repeat.js';
import { doprevMessage, keyText, messageWindowMode } from './prevmsg.js';

interface LineInputOptions {
    suppressStatus?: boolean;
    inMenu?: boolean;
}

export async function getLine(
    prompt: string,
    accepts: (character: string, key: number) => boolean = ch => /^[0-9+-]$/.test(ch),
    options: LineInputOptions = {},
): Promise<string | null> {
    // windows.c:getlin() disables bot() through tty's prompt cleanup.
    // Covered status rows stay blank until a later status update.
    const statusUpdatesDisabled = game._statusUpdatesDisabled ?? false;
    game._statusUpdatesDisabled = true;
    try {
        return await editLine(prompt, accepts, options);
    } finally {
        game._statusUpdatesDisabled = statusUpdatesDisabled;
    }
}

async function editLine(
    prompt: string,
    accepts: (character: string, key: number) => boolean,
    { suppressStatus = false, inMenu = false }: LineInputOptions,
): Promise<string | null> {
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
        if (cursorColumn > 0) cursorColumn--;
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
            game.nhDisplay?.putstr(
                0, row, line.slice(row * width, (row + 1) * width),
                NO_COLOR,
            );
        }
        game.nhDisplay?.setCursor(cursorColumn, cursorRow);
    };
    const finish = (result: string | null): string | null => {
        clearMessageWindow(renderedRows);
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
        game._pending_message = prompt;
        game._retained_message = '';
    } else {
        await setTopline(prompt);
        await flush_screen(1);
    }
    clearSuppressedStatus();
    renderEditor();
    // The loop head keeps gt.toplines equal to the query and typed text.
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
                clearMessageWindow(renderedRows);
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
}

// C tty_yn_function(): Escape prefers quit, then no; whitespace chooses
// the displayed default. Invalid keys leave the same question active.
export async function promptChoice<Choice extends string>(
    query: string, choices: readonly Choice[], defaultAnswer: Choice,
    { visibleChoices = choices.join(''), addCommandQueue = true }: { visibleChoices?: string; addCommandQueue?: boolean } = {},
): Promise<Choice> {
    const result = await yn_function(query, choices.join(''), defaultAnswer, addCommandQueue, visibleChoices);
    return choices.find(choice => choice === result.answer) ?? defaultAnswer;
}

export interface TtyPromptAnswer { answer: string; count: bigint }

// C cmd.c:yn_function() records the answer key, while yn_number remains
// the last tty question's value. Replaying '#' does not read another count.
export async function yn_function(
    query: string, responses: string | null, defaultAnswer = '', addCommandQueue = true,
    visibleChoices = responses?.split('\x1b')[0] ?? '',
): Promise<TtyPromptAnswer> {
    const queued = addCommandQueue ? takeRepeatCommand() : undefined;
    if (queued) {
        const answer = queued.kind === 'key' ? String.fromCharCode(queued.key) : '\x1b';
        const valid = !responses || answer === '\0' || responses.includes(answer);
        return { answer: valid ? answer : defaultAnswer || '\x1b', count: game._ynNumber ?? 0n };
    }
    const result = await tty_yn_function(query, responses, defaultAnswer, visibleChoices);
    if (addCommandQueue) rememberCommandKey(result.answer ? result.answer.charCodeAt(0) : 0);
    return result;
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
    return promptChoice(message, ['y', 'n'], defaultAnswer, { addCommandQueue });
}

export function promptYesNoQuit(message: string, defaultAnswer: 'y' | 'n' | 'q' = 'q'): Promise<'y' | 'n' | 'q'> {
    return promptChoice(message, ['y', 'n', 'q'], defaultAnswer);
}

export function promptYesNoAllQuit(message: string, defaultAnswer: 'y' | 'n' | 'a' | 'q' = 'y'): Promise<'y' | 'n' | 'a' | 'q'> {
    return promptChoice(message, ['y', 'n', 'a', 'q'], defaultAnswer);
}

// A per-question paranoia bit changes affirmative input from `y` to the full
// line `yes`.  PARANOID_CONFIRM additionally removes the default and requires
// `no` (or Escape) to reject, retrying other committed lines up to six times.
export async function paranoidQuery(
    beParanoid: boolean,
    prompt: string,
    paranoiaBits = game.flags?.paranoia_bits ?? 0,
): Promise<boolean> {
    return await paranoidYesNoQuit(beParanoid, prompt, false, paranoiaBits) === 'y';
}

// C cmd.c:paranoid_ynq(). Confirmation answers are deliberately excluded
// from command recall: every repeated dangerous action asks again.
export async function paranoidYesNoQuit(
    beParanoid: boolean, prompt: string, acceptQuit = true,
    paranoiaBits = game.flags?.paranoia_bits ?? 0,
): Promise<'y' | 'n' | 'q'> {
    if (!beParanoid) return acceptQuit
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
        const line = await getLine(`${prefix}${question} ${responseType}`,
            (_ch, key) => key >= 32 && key < 127);
        if (line === null) return acceptQuit ? 'q' : 'n';
        const answer = line.trim().replace(/\s+/g, ' ').toLowerCase();
        if (answer === 'yes') return 'y';
        if (answer === 'quit') return acceptQuit ? 'q' : 'n';
        if (!confirmAll || answer === 'no') return 'n';
        prefix = '"Yes" or "No": ';
    }
    return 'n';
}
