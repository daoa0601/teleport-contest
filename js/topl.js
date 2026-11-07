// Message history and physical topline: C win/tty/topl.c.
// Message-window entry points also follow win/tty/wintty.c.
// cmd.c:doprev_message() dispatch stays in cmd.ts; cmd.c:key2txt() too.
import { game } from './gstate.js';
import { bot } from './botl.js';
import { _buildScreenOutput, writeMapRow } from './wintty.js';
import { plineWithContinuation, setTopline } from './pline.js';
import { nhgetch } from './input.js';
import { COLNO, ROWNO, MAX_MSG_HISTORY, PICK_NONE, PICK_ONE, QBUFSZ } from './const.js';
import { DEC_TO_UNICODE, NO_COLOR } from './terminal.js';
import { readchar, keyText, doprevMessage } from './cmd.js';
import { flush_screen } from './display.js';
import { showDisclosureOverlay } from './windows.js';
// Part of C wintty.c:tty_clear_nhwindow(): the WIN_MESSAGE branch.
// C win/tty/wintty.c:tty_clear_nhwindow(WIN_MESSAGE). A seen prompt still occupies the
// physical message row; clearing it is separate from acknowledging input.
export function clearMessageWindow(coveredRows) {
    const text = game._pending_message || game._retained_message || '';
    const display = game.nhDisplay;
    if (display?.preserveEmptyMessageRow && !text && !game._promptOwnsTopline)
        return;
    resetToplineClip();
    // The line editor wraps at character boundaries, unlike update_topl().
    // Its rendered row count is authoritative when clearing its prompt.
    const rows = coveredRows ?? toplineRows(text, display?.cols ?? COLNO).length;
    game._pending_message = '';
    game._retained_message = '';
    game._promptOwnsTopline = false;
    game._toplineGlyphPainted = false;
    if (!display)
        return;
    display.clearRow(0);
    // tty_clear_nhwindow(WIN_MESSAGE) calls docorner() only for rows the
    // message covered. Menus and text windows below those rows stay visible.
    for (let row = 1; row < Math.min(rows, display.rows); row++) {
        display.clearRow(row);
        if (row <= ROWNO && !game._suppressMapStatusForFlush)
            writeMapRow(display, row - 1);
    }
    // docorner() asks bot() to restore covered status rows. getlin() keeps
    // status updates disabled through this cleanup, leaving those rows blank.
    if (rows > ROWNO + 1) {
        if (game._statusUpdatesDisabled)
            display.statusVisible = false;
        bot();
    }
    display.setCursor(0, 0);
}
export const CTRL_P = 16;
// Port only: decode the runtime message-history mode option.
// iflags.prevmsg_window holds the option's first letter; initoptions
// leaves the tty default 'single'.
export function messageWindowMode() {
    const mode = (game.iflags.prevmsg_window ?? 's').charAt(0).toLowerCase();
    return mode === 'c' || mode === 'f' || mode === 'r' ? mode : 's';
}
// Part of C topl.c:tty_doprev_message(): step backward through the recall ring.
// One step back through the recall ring. tty_doprev_message decrements
// cw->maxcol and resets it to maxrow once the walk leaves the filled slots.
// In a full ring the oldest message occupies maxrow's own slot, so the walk
// reaches the pending line there instead of displaying that entry.
// C win/tty/topl.c:tty_doprev_message.
export function stepHistoryBack() {
    const history = game._messageHistory;
    const cursor = game._messageHistoryCursor;
    if (cursor === null) {
        game._messageHistoryCursor = history.length ? history.length - 1 : null;
        return;
    }
    if (cursor <= 0) {
        game._messageHistoryCursor = null;
        return;
    }
    // In a full ring the oldest message occupies maxrow's own slot, so a
    // walk about to reach it returns to the pending line instead.
    game._messageHistoryCursor = cursor - 1 === 0
        && history.length === messageHistoryCapacity()
        ? null : cursor - 1;
}
// Part of C topl.c:tty_doprev_message(): construct and display the recall menu.
// tty_doprev_message's putstr-built NHW_MENU: "Message History", a blank
// line, the ring, and the pending topline. tty_display_nhwindow pages it
// through process_text_window because putstr (unlike add_menu) owns
// cw->data, and destroy_nhwindow erases the corner again.
// C win/tty/topl.c:tty_doprev_message.
export async function showMessageHistoryWindow({ reversed, acceptCtrlP }) {
    const lines = ['Message History', ''];
    if (reversed) {
        lines.push(game._toplines);
        // A full ring keeps its oldest message in maxrow's own slot, where
        // the reversed walk stops before listing it.
        const oldest = game._messageHistory.length === messageHistoryCapacity() ? 1 : 0;
        for (let index = game._messageHistory.length - 1; index >= oldest; index--)
            lines.push(game._messageHistory[index] ?? '');
    }
    else {
        lines.push(...game._messageHistory, game._toplines);
    }
    // tty_display_nhwindow() pages a NEED_MORE topline before the window
    // (wintty.c:1969-1970); only a prompt's TOPLINE_SPECIAL_PROMPT line is
    // erased without paging.
    return await showDisclosureOverlay(lines, {
        restoreUnderlay: true,
        extraDismissKey: acceptCtrlP ? CTRL_P : null,
        skipPendingPager: !!game._promptOwnsTopline,
    });
}
// Part of C topl.c:redotoplin(): Install and repaint a physical topline.
export function replaceTopline(msg) {
    // update_topl()/redotoplin() repaint the whole physical line.
    resetToplineClip();
    if (game.nhDisplay) {
        game.nhDisplay.preserveEmptyMessageRow = false;
        game.nhDisplay.stoppedTopline = game._suppressMessagesUntilInput ? msg : null;
    }
    // putmixed()'s graphics kludge painted this line's leading glyph onto
    // the physical row (topl.c redotoplin() with ttyDisplay->mixed); a
    // plain line paints no glyph cell.
    game._toplineGlyphPainted = msg.includes('\x0e');
    game._pending_message = msg;
    game._retained_message = '';
    game._last_message = msg;
    game._promptOwnsTopline = false;
    // tty message output continues while level arrival pauses map flushing.
    // redotoplin() paints immediately; a later flush is not its display owner.
    const display = game.nhDisplay;
    if (display && game._mapFlushPaused) {
        for (const [row, line] of toplineRows(msg, display.cols, { splitWords: false }).entries()) {
            display.clearRow(row);
            for (const [column, cell] of line.entries())
                display.setCell(column, row, cell.ch, NO_COLOR, 0);
        }
    }
}
// C topl.c:redotoplin()
// C tty topl.c:redotoplin(): repaint a recalled line at the top. A line
// covering several rows pages with --More-- accepting ^P so one press can
// keep walking, except when the previous topline state was
// TOPLINE_SPECIAL_PROMPT (topl.c:139) — the prompt's own repaint owns that
// boundary. Ring entries carry update_topl()'s word wrap; raw
// putmsghistory entries only get topl_putsym()'s hard column wrap.
export async function redotoplin(text) {
    const fromPrompt = !!game._promptOwnsTopline;
    game._promptOwnsTopline = false;
    const display = game.nhDisplay;
    // redotoplin() repaints the recalled line across the whole row.
    resetToplineClip();
    const columns = display?.cols ?? 80;
    const lines = toplineRows(text, columns, { splitWords: false });
    if (lines.length > 1 && !fromPrompt)
        return await pageTopline(text, { dismissKey: CTRL_P, rawGlyphs: true });
    if (display) {
        for (const [row, line] of lines.entries()) {
            display.clearRow(row);
            for (const [column, cell] of line.entries())
                // redotoplin() runs without ttyDisplay->mixed: its putsyms()
                // copy of the leading graphics byte never reaches the tty
                // shadow, so a recorded recall shows a blank in that cell
                // whether or not the live display painted the glyph.
                display.setCell(column, row, cell.dec ? ' ' : cell.ch, NO_COLOR, 0);
        }
        const last = lines.at(-1) ?? lines[0];
        display.setCursor(last.length, lines.length - 1);
    }
    // The recalled repaint blanked the glyph cell.
    game._toplineGlyphPainted = false;
    game._pending_message = text;
    game._retained_message = '';
    return 0;
}
// Part of C wintty.c:tty_create_nhwindow(): the NHW_MESSAGE recall-ring capacity.
// C win/tty/wintty.c:tty_create_nhwindow(NHW_MESSAGE) sizes the recall ring: iflags.msg_history
// clamped into 20..MAX_MSG_HISTORY slots.
export function messageHistoryCapacity() {
    return Math.max(20, Math.min(MAX_MSG_HISTORY, game.iflags.msg_history ?? 20));
}
// C topl.c:remember_topl()
// C win/tty/topl.c:remember_topl(): archive gt.toplines into the WIN_MESSAGE
// recall ring and clear the negotiated topline. The port keeps the ring
// oldest-first on game state so ^P recall and save/restore share it.
export function rememberToplines() {
    const toplines = game._toplines;
    if (!toplines)
        return;
    const capacity = messageHistoryCapacity();
    game._messageHistory.push(toplines);
    if (game._messageHistory.length > capacity)
        game._messageHistory.shift();
    game._messageHistoryWriteIndex = (game._messageHistoryWriteIndex + 1) % capacity;
    game._toplines = '';
    game._messageHistoryCursor = null;
}
// Part of C win/tty/topl.c:tty_yn_function(): paints the question line and
// cursor on the tty.
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
// C win/tty/topl.c:tty_yn_function().
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
        if (!responses.includes('#'))
            return finish(character);
        // The count entry: digits after '#' build yn_number; backspace
        // erases digits (removetopl()), Escape or junk abandons the count.
        let digits = character === '#' ? '' : character;
        let value = digits ? BigInt(digits) : 0n;
        paint(message + '#' + digits);
        for (;;) {
            const next = await readAnswer();
            if (/^[0-9]$/.test(next)) {
                const combined = value * 10n + BigInt(next);
                if (combined > 9223372036854775807n)
                    break;
                value = combined;
                digits += next;
            }
            else if (next === 'y' || ' \n\r\x1b\0'.includes(next)) {
                if (next !== '\x1b')
                    return value === 0n ? finish('n') : finish('#', value);
                break;
            }
            else if (next === '\x7f' || next === '\b') {
                if (!digits)
                    break;
                value /= 10n;
                digits = digits.slice(0, -1);
            }
            else
                break;
            paint(message + '#' + digits);
        }
        // Escape, overflow, erasing the '#', or an invalid character aborts
        // the number and returns to the same yes/no question.
        paint(message);
        continue;
    }
}
// Part of C topl.c:tty_putmsghistory(): the non-restoring message insertion path.
// C win/tty/topl.c:tty_putmsghistory(msg, FALSE): remember what is pending and
// make this line the current topline without displaying it. The quest pager
// synopsis, novel tribute attribution, and count echoes use this path.
export function putMessageHistory(message) {
    // putmsghistory() marks a displayed topline as seen before replacing it.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    rememberToplines();
    game._toplines = message;
}
// Port only: decode terminal graphics and spacing into visible cells.
export function decodeMixedTopline(message) {
    const cells = [];
    let dec = false;
    for (let index = 0; index < message.length; index++) {
        const ch = message.charAt(index);
        if (ch === '\x0e') {
            dec = true;
            continue;
        }
        if (ch === '\x0f') {
            dec = false;
            continue;
        }
        if (ch === '\x1b' && message[index + 1] === '[') {
            let end = index + 2;
            while (end < message.length && /[0-9;]/.test(message.charAt(end)))
                end++;
            if (message[end] === 'C') {
                const count = Number(message.slice(index + 2, end)) || 1;
                for (let offset = 0; offset < count; offset++)
                    cells.push({ ch: ' ', dec: false });
                index = end;
                continue;
            }
        }
        cells.push({
            ch: dec ? (DEC_TO_UNICODE[ch] || ch) : ch,
            dec,
        });
    }
    return cells;
}
// Port only: clear the browser display's temporary topline clipping.
// Every write that starts or extends a topline message goes through
// update_topl/addtopl, whose output repaints the physical row, so a
// docorner clip of that row ends as soon as new text is written.
export function resetToplineClip() {
    if (game.nhDisplay)
        game.nhDisplay.toplineClipColumn = null;
}
// Port only: clip encoded terminal text by visible columns.
// docorner clears physical columns through cl_end, while a mixed topline also carries
// \x0e/\x0f markers and ESC[nC spacing that occupy no cell. Keep the raw
// byte segments whose decoded cells fall before the clip column, replacing
// a partially covered spacing run with plain blanks so no code is cut in
// half.
export function clipToplineToColumn(message, column) {
    let clipped = '';
    let cells = 0;
    let dec = false;
    for (let index = 0; index < message.length; index++) {
        const ch = message.charAt(index);
        if (ch === '\x0e' || ch === '\x0f') {
            dec = ch === '\x0e';
            clipped += ch;
            continue;
        }
        if (ch === '\x1b' && message[index + 1] === '[') {
            let end = index + 2;
            while (end < message.length && /[0-9;]/.test(message.charAt(end)))
                end++;
            if (message[end] === 'C') {
                const count = Number(message.slice(index + 2, end)) || 1;
                if (cells + count <= column)
                    clipped += message.slice(index, end + 1);
                else
                    clipped += ' '.repeat(column - cells);
                cells += count;
                index = end;
                if (cells >= column)
                    break;
                continue;
            }
        }
        if (cells >= column)
            break;
        clipped += ch;
        cells++;
    }
    // A cut inside a graphics run still closes it, so the decoder reads
    // the same cells the tty had on screen.
    if (dec)
        clipped += '\x0f';
    return clipped;
}
// Part of C topl.c:update_topl(): word breaks, followed by topl_putsym() hard wrapping.
export function toplineRows(message, columns, { splitWords = true } = {}) {
    const cells = decodeMixedTopline(message);
    // tty update_topl() replaces a space with a newline. A single oversized
    // word is left intact; topl_putsym() then wraps it at the last column.
    let start = 0;
    while (splitWords && cells.length - start >= columns) {
        let split = start + columns - 1;
        while (split > start && cells[split]?.ch !== ' ')
            split--;
        if (split === start) {
            split = cells.findIndex((cell, index) => index >= start && cell.ch === ' ');
            if (split < 0)
                break;
        }
        cells[split] = { ch: '\n', dec: false };
        start = split + 1;
    }
    let line = [];
    const lines = [line];
    for (const cell of cells) {
        if (cell.ch === '\n') {
            line = [];
            lines.push(line);
        }
        else {
            if (line.length === columns - 1) {
                line = [];
                lines.push(line);
            }
            line.push(cell);
        }
    }
    return lines;
}
// Part of C topl.c:show_topl(): used for SUPPRESS_HISTORY prose such as getpos
// autodescribe: addtopl() wraps at the last column without update_topl()'s
// word splitting, and its extra rows never ask for --More--.
export function showUnrememberedTopline(message, { flushPending = false } = {}) {
    // C tty_putstr(ATR_NOHISTORY) first moves whatever is pending on the
    // top line into the recall history, then shows the unremembered text.
    if (flushPending)
        rememberToplines();
    const display = game.nhDisplay;
    if (!display?.grid)
        return;
    // show_topl() repaints the row from home().
    resetToplineClip();
    const lines = toplineRows(message, display.cols, { splitWords: false });
    for (const [row, line] of lines.entries()) {
        display.clearRow(row);
        for (const [column, cell] of line.entries())
            display.setCell(column, row, cell.ch, NO_COLOR, 0);
    }
}
// Part of C topl.c:topl_putsym(): key queries wrap without a More prompt.
// Return the rows covered so tty_yn_function's cleanup can restore the map.
// Also C topl.c:putsyms(): inlined here to write the prompt's cells.
export function renderKeyPrompt(message, cursorOffset = 0) {
    const display = game.nhDisplay;
    const lines = toplineRows(message, display?.cols ?? COLNO);
    if (!display)
        return lines.length;
    resetToplineClip();
    for (const [row, line] of lines.entries()) {
        display.clearRow(row);
        for (const [column, cell] of line.entries())
            display.setCell(column, row, cell.ch, NO_COLOR, 0);
    }
    const lastLine = lines.at(-1) ?? lines[0];
    display.setCursor(lastLine.length + cursorOffset, lines.length - 1);
    return lines.length;
}
// Port only: publish and page a message through the shared topline boundary.
export async function moreUntilDismissed(message, { urgent = false } = {}) {
    await setTopline(message);
    return pageTopline(message, { urgent });
}
// C topl.c:more()
// C win/tty/topl.c:more() acknowledges existing output. A window-only display does not
// call bot(), so it must retain status even if game state changed meanwhile.
export async function pageTopline(message, { urgent = false, dismissKey, rawGlyphs = false } = {}) {
    // C tty more() returns before painting or reading during fuzzer mode.
    if (game.iflags.debug_fuzzer)
        return 0;
    const display = game.nhDisplay;
    const columns = display?.cols ?? 80;
    // The stored toplines already carry update_topl()'s word wrap; more()
    // only adds topl_putsym()'s hard column wrap.
    const lines = toplineRows(message, columns, { splitWords: false });
    const moreCells = [...'--More--'].map(ch => ({ ch, dec: false }));
    const finalMessageLine = lines.at(-1) ?? lines[0];
    let finalLine = finalMessageLine;
    if (finalMessageLine.length + moreCells.length < columns)
        finalMessageLine.push(...moreCells);
    else {
        finalLine = moreCells;
        lines.push(finalLine);
    }
    // tty more() only acknowledges the message window. Map changes queued
    // after that message stay buffered until their caller flushes the map.
    if (display?.grid) {
        for (const [row, line] of lines.entries()) {
            display.clearRow(row);
            for (const [col, cell] of line.entries())
                display.setCell(col, row, rawGlyphs && cell.dec ? ' ' : cell.ch, NO_COLOR, 0);
        }
        display.setCursor(finalLine.length, lines.length - 1);
    }
    let key;
    do
        key = await nhgetch();
    while (key !== dismissKey && ![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    // more() repairs covered map rows after any dismissal. Escape also
    // erases a one-line message; WIN_NOSTOP only prevents output suppression.
    game._retained_message = '';
    if (lines.length > 1) {
        _buildScreenOutput();
        display?.setCursor(0, 0);
    }
    else if (key === 27) {
        display?.clearRow(0);
        display?.setCursor(0, 0);
    }
    else {
        game._retained_message = message + '--More--';
    }
    if (key === 27 && !urgent) {
        game._suppressMessagesUntilInput = true;
        // more() erases the display but retains gt.toplines for hidden prose.
        if (display)
            display.stoppedTopline = message;
    }
    return key;
}
// Part of C wintty.c:tty_display_nhwindow(): flush the older topline before a text window.
// Opening a tty text window flushes any older topline before the window is
// displayed.  Quest pages and other modal producers use this boundary when a
// time-consuming command has left ordinary prose pending for the scheduler.
export async function flushPendingTopline() {
    const pending = game._pending_message || '';
    return pending ? pageTopline(pending) : null;
}
// Part of C wintty.c:tty_display_nhwindow(): the WIN_MESSAGE branch.
// C win/tty/wintty.c:tty_display_nhwindow(WIN_MESSAGE): unlike a direct more(), the window
// display honors Escape's WIN_STOP/WIN_CANCELLED flag before acknowledging.
// Only TOPLINE_NEED_MORE erases the row; answered questions remain visible.
export async function displayMessageWindow() {
    if (game._suppressMessagesUntilInput)
        return null;
    if (!game._pending_message) {
        game._retained_message = '';
        game._promptOwnsTopline = false;
        if (game.nhDisplay)
            game.nhDisplay.preserveEmptyMessageRow = true;
        return null;
    }
    const dismissal = await flushPendingTopline();
    clearMessageWindow();
    return dismissal;
}
// Part of C topl.c:update_topl(): the WIN_STOP branch for prose that cannot restart the pager
// (only "You die" does): gt.toplines and the recall history advance, but
// redotoplin() never runs, so the screen keeps its suppressed line.
export function appendSuppressedTopline(msg) {
    const stopped = game.nhDisplay?.stoppedTopline ?? (game._pending_message || '');
    const visibleLength = (message) => /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message)
        ? decodeMixedTopline(message).length : message.length;
    const columns = game.nhDisplay?.cols ?? 80;
    const fits = visibleLength(msg) + visibleLength(stopped) + 3 < columns - 8;
    const stored = (message) => wrapStoredToplines(message, columns);
    if (game.nhDisplay)
        game.nhDisplay.stoppedTopline = fits ? stored(`${stopped}  ${msg}`) : stored(msg);
    if (fits)
        game._toplines = stored(`${game._toplines}  ${msg}`);
    else {
        rememberToplines();
        game._toplines = stored(msg);
    }
}
// C topl.c:update_topl()
// C win/tty/topl.c:update_topl() also owns bare tty_putstr() output from singleton menus.
// Sample WIN_STOP on entry: Escape at an older line suppresses subsequent
// calls, while the incoming line from this call still gets drawn.
export async function updateTopline(msg, options = {}) {
    const paging = { ...options };
    const urgent = paging.urgent ?? false;
    const pending = game._pending_message || '';
    const visibleLength = (message) => /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message)
        ? decodeMixedTopline(message).length : message.length;
    const columns = game.nhDisplay?.cols ?? 80;
    // update_topl() stores gt.toplines with its word wrap already applied
    // (a space replaced by a newline), so recall and paging never re-split.
    const stored = (message) => wrapStoredToplines(message, columns);
    const msgToplines = stored(msg);
    const wraps = toplineRows(msgToplines, columns, { splitWords: false }).length > 1;
    if (!urgent && game._suppressMessagesUntilInput) {
        const stopped = game.nhDisplay?.stoppedTopline ?? pending;
        // Escape's more() resets the message cursor to row zero. Hidden
        // prose changes gt.toplines without moving that cursor, even if
        // pending still holds an earlier wrapped message.
        const fits = visibleLength(msg) + visibleLength(stopped) + 3 < columns - 8;
        const restarts = fits && msg.startsWith('You die');
        if (!restarts) {
            appendSuppressedTopline(msg);
            return null;
        }
        // update_topl() always remembers the stopped line and installs the
        // new one before redotoplin() resumes output.
        rememberToplines();
        game._toplines = msgToplines;
        game._suppressMessagesUntilInput = false;
        replaceTopline(msgToplines);
        return wraps ? await pageTopline(msgToplines, paging) : null;
    }
    let dismissal;
    if (!pending) {
        rememberToplines();
        game._toplines = msgToplines;
        replaceTopline(msgToplines);
        dismissal = wraps
            ? await pageTopline(msgToplines, paging) : null;
    }
    else if (!msg.startsWith('You die')
        && visibleLength(msg) + visibleLength(pending) + 3 < columns - 8) {
        game._toplines = stored(`${game._toplines}  ${msg}`);
        // addtopl() appends to the visible line, which can include
        // SUPPRESS_HISTORY text absent from gt.toplines.
        replaceTopline(`${pending}  ${msg}`);
        dismissal = null;
    }
    else {
        dismissal = await pageTopline(pending, paging);
        // xwaitforspace() replaces dismiss_more with 1 on Escape.
        if (dismissal === 27)
            paging.dismissKey = 1;
        // Escape suppresses later lines, not the line which forced this pager.
        rememberToplines();
        game._toplines = msgToplines;
        replaceTopline(msgToplines);
        if (wraps)
            dismissal = await pageTopline(msgToplines, paging);
    }
    return dismissal;
}
// Part of C topl.c:update_topl(): the storage wrap: from each CO-1 boundary search back to the
// nearest space and replace it with a newline; a huge token is split after
// its end, and text with no space at all is left to topl_putsym()'s hard
// column wrap at render time.  tty_putmixed() folds each DEC-graphics pair
// and each cursor-right escape into plain columns before update_topl() sees
// the line (windows.c:decode_mixed()), so the wrap measures screen columns,
// not raw marker bytes.
function wrapStoredToplines(message, columns) {
    const cells = [];
    let dec = false;
    for (let raw = 0; raw < message.length; raw++) {
        const ch = message.charAt(raw);
        if (ch === '\x0e') {
            dec = true;
            continue;
        }
        if (ch === '\x0f') {
            dec = false;
            continue;
        }
        if (ch === '\x1b' && message.charAt(raw + 1) === '[') {
            let end = raw + 2;
            while (end < message.length && /[0-9;]/.test(message.charAt(end)))
                end++;
            if (message.charAt(end) === 'C') {
                const count = Number(message.slice(raw + 2, end)) || 1;
                // The editor emits cursor-right escapes; the columns they
                // advance are spaces on screen but cannot be replaced by a
                // newline inside the sequence.
                for (let offset = 0; offset < count; offset++)
                    cells.push({ text: ' ', splittable: false, raw });
                raw = end;
                continue;
            }
        }
        cells.push({
            text: dec ? DEC_TO_UNICODE[ch] ?? ch : ch,
            splittable: !dec && ch === ' ',
            raw,
        });
    }
    let start = 0;
    const breaks = new Set();
    while (cells.length - start >= columns) {
        let split = start + columns - 1;
        while (split > start && !cells[split]?.splittable)
            split--;
        if (split === start) {
            const next = cells.findIndex((cell, index) => index >= start && cell.splittable);
            if (next < 0)
                break;
            split = next;
        }
        breaks.add(cells[split]?.raw ?? split);
        start = split + 1;
    }
    if (!breaks.size)
        return message;
    let wrapped = '';
    for (let raw = 0; raw < message.length; raw++)
        wrapped += breaks.has(raw) ? '\n' : message.charAt(raw);
    return wrapped;
}
//# sourceMappingURL=topl.js.map