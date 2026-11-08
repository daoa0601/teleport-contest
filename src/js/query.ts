// query.js — Shared tty line and confirmation input ownership.
// C refs: cmd.c paranoid_query()/paranoid_ynq(), getline.c tty_getlin()
// and tty_get_ext_cmd(), tty getlin/yn_function.

import { COLNO } from './const.js';
import {
    clearMessageWindow, flushPendingTopline, messageWindowMode,
    rememberToplines, resetToplineClip,
} from './topl.js';
import { flush_screen } from './display.js';
import { pline, setTopline, impossible } from './pline.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { cmdq_pop } from './cmd.js';
import type { CommandDirection } from './input.js';
import { NO_COLOR } from './terminal.js';
import { CMDQ_KEY } from './const.js';


import { FUZZER_IMPOSSIBLE_CONTINUE } from './diagnostics.js';
import { paniclog } from './novel_tribute.js';
import { showChoiceWindow } from './windows.js';
import { extcmdsMatch, yn_function } from './cmd.js';
import { ttyDoprevMessage } from './topl.js';
import type { NativeCommand } from './cmd.js';
import { visibleCommandKey } from './hacklib.js';

export interface LineInputOptions {
    suppressStatus?: boolean;
    inMenu?: boolean;
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
                if (!doprev) await ttyDoprevMessage(false);
                await ttyDoprevMessage(false);
                doprev = true;
                game._toplines = `${prompt} ${value}`;
                continue;
            }
            await ttyDoprevMessage(false);
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



// Port only: typed choice wrapper over yn_function for JS callers.
// tty_yn_function behavior: Escape prefers quit, then no; whitespace
// chooses the displayed default. Invalid keys leave the same question
// active.
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



// C getline.c:ext_cmd_getlin_hook().
// The base-completion match is cmd.c:extcmds_match(base, ECM_NOFLAGS):
// prefix match over autocomplete-eligible commands; the eligibility
// filter half is availableExtendedCommands().
export function completeExtendedCommand(prefix: string): string | null {
    const matches = extcmdsMatch(prefix);
    return matches.length === 1 ? matches[0]?.name ?? null : null;
}

// C getline.c:tty_get_ext_cmd()
// Also C getline.c:hooked_tty_getlin(): completion-aware line editing is inlined here
// TTY's extended-command line editor redraws the prompt at every input
// boundary. Completion expands visually while typed input advances the cursor.
// Also C cmd.c:extcmd_initiator(): inlined here (the '#' initiator key).
export async function editExtendedCommand(): Promise<NativeCommand | null> {
    let command = '';
    let completion: string | null = null;
    const initiator = visibleCommandKey(game.commandBindings.keyForCommand('#'));
    // custompline(SUPPRESS_HISTORY) files the line before the prompt, then
    // the loop head makes the "# " line the current topline. show_topl()'s
    // addtopl() ends TOPLINE_SPECIAL_PROMPT as soon as it draws the prompt.
    await setTopline(`${initiator} `);
    game._toplines = `${initiator} `;
    game._pending_message = initiator;
    await flush_screen(1);
    game.nhDisplay?.setCursor(initiator.length + 1, 0);

    const redrawCommand = async () => {
        const displayedCommand = completion || command;
        game._toplines = command ? `${initiator} ${displayedCommand}` : `${initiator} `;
        game._pending_message = command
            ? `${initiator} ${displayedCommand}` : initiator;
        await flush_screen(1);
        const display = game.nhDisplay;
        const columns = display?.cols ?? COLNO;
        // A message-window getlin can physically wrap past the right edge.
        // tty's continuation begins at column 1; once wrapping starts it
        // clears that message row rather than exposing the map below it.
        if (display?.grid && game._pending_message.length >= columns) {
            display.clearRow(1);
            const continuation = game._pending_message.slice(columns);
            for (let index = 0; index < continuation.length; index++)
                display.setCell(1 + index, 1, continuation.charAt(index), NO_COLOR, 0);
        }
        // NEWAUTOCOMP leaves the insertion pointer immediately after the
        // physically typed prefix, not after its displayed suffix.
        const insertion = command.length + initiator.length + 1;
        if (insertion > columns - 1)
            display?.setCursor(insertion - (columns - 1), 1);
        else
            display?.setCursor(insertion, 0);
    };

    let doprev = false;
    for (;;) {
        const key = await nhgetch();
        if (key === 16) {
            // C win/tty/getline.c hooked_tty_getlin(): the "#" editor
            // browses history with ^P like any getlin, with inread clear
            // so full/combination modes page their windows. A wrapped
            // editor line pages on its first recall too.
            const mode = messageWindowMode();
            if (mode === 's' || (mode === 'c' && !doprev)) {
                if (!doprev) await ttyDoprevMessage(false);
                await ttyDoprevMessage(false);
                doprev = true;
            } else {
                await ttyDoprevMessage(false);
                doprev = false;
                game._messageHistoryCursor = null;
                // `*bufp = 0` drops the auto-completed suffix before repainting.
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        if (doprev) {
            // The first ordinary key after single-mode browsing only
            // repaints the prompt; the key itself is still processed.
            game._messageHistoryCursor = null;
            doprev = false;
            completion = null;
            await redrawCommand();
        }
        if (key === 27) {
            // tty_getlin(): Escape first clears non-empty input; only Escape
            // at an already empty prompt cancels the extended command.
            if (command) {
                command = '';
                completion = null;
                await redrawCommand();
                continue;
            }
            game._pending_message = '';
            game._retained_message = '';
            game._toplines = '';
            // getline.c:213 leaves TOPLINE_NON_EMPTY behind its prompt.
            game._promptOwnsTopline = false;
            game.nhDisplay?.clearRow(0);
            game.context.move = 0;
            return null;
        }
        if (key === 10 || key === 13) break;
        if (key === 8 || key === 127) {
            if (command) {
                command = command.slice(0, -1);
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        if (key === 21) {
            // The tty kill character clears both typed text and completion.
            if (command) {
                command = '';
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        const ch = String.fromCharCode(key);
        if (key < 32 || key === 127 || command.length >= COLNO) continue;
        command += ch;
        completion = completeExtendedCommand(command);
        await redrawCommand();
    }

    // tty_getlin() clears its message window on return. The completed
    // editor is not an unread message for a later cls() to acknowledge.
    game._pending_message = '';
    game._retained_message = '';
    game._toplines = '';
    game._promptOwnsTopline = false;
    game.nhDisplay?.clearRow(0);
    const normalizedCommand = (completion || command)
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    if (!normalizedCommand) {
        game._pending_message = '';
        game.nhDisplay?.clearRow(0);
        game.nhDisplay?.setCursor(game.u.ux - 1, game.u.uy + 1);
        game.context.move = 0;
        return null;
    }
    const selected = extcmdsMatch(normalizedCommand,
        { ignoreAutocomplete: true, exactMatch: true })[0];
    if (!selected) await pline(`${initiator}${normalizedCommand.slice(0, 60)}: unknown extended command.`);
    return selected ?? null;
}





// Port only: y/n convenience wrapper.
export function promptYesNo(message: string, defaultAnswer: 'y' | 'n' = 'n', addCommandQueue = true): Promise<'y' | 'n'> {
    return promptChoice(message, ['y', 'n'], defaultAnswer, { addCommandQueue, menuable: true });
}

// Port only: y/n/q convenience wrapper.
export function promptYesNoQuit(message: string, defaultAnswer: 'y' | 'n' | 'q' = 'q'): Promise<'y' | 'n' | 'q'> {
    return promptChoice(message, ['y', 'n', 'q'], defaultAnswer, { menuable: true });
}

// Port only: y/n/a/q convenience wrapper.
export function promptYesNoAllQuit(message: string, defaultAnswer: 'y' | 'n' | 'a' | 'q' = 'y'): Promise<'y' | 'n' | 'a' | 'q'> {
    return promptChoice(message, ['y', 'n', 'a', 'q'], defaultAnswer, { menuable: true });
}

