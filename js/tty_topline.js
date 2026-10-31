// Message history and physical topline: C win/tty/topl.c.
// Message-window entry points also follow win/tty/wintty.c.
import { game } from './gstate.js';
import { _buildScreenOutput, refreshStatusLines, writeMapRow } from './display.js';
import { plineWithContinuation, setTopline } from './pline.js';
import { nhgetch } from './input.js';
import { COLNO, ROWNO, MAX_MSG_HISTORY, PICK_NONE, PICK_ONE } from './const.js';
import { DEC_TO_UNICODE, NO_COLOR } from './terminal.js';
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
        refreshStatusLines();
    }
    display.setCursor(0, 0);
}
// C win/tty/topl.c:redotoplin(). Install and repaint a physical topline.
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
// C win/tty/wintty.c:tty_create_nhwindow(NHW_MESSAGE) sizes the recall ring: iflags.msg_history
// clamped into 20..MAX_MSG_HISTORY slots.
export function messageHistoryCapacity() {
    return Math.max(20, Math.min(MAX_MSG_HISTORY, game.iflags.msg_history ?? 20));
}
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
// Every write that starts or extends a topline message goes through
// update_topl()/addtopl(), whose output repaints the physical row, so a
// docorner() clip of that row ends as soon as new text is written.
export function resetToplineClip() {
    if (game.nhDisplay)
        game.nhDisplay.toplineClipColumn = null;
}
// docorner() cl_end()s physical columns, while a mixed topline also carries
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
// C win/tty/topl.c:update_topl()/topl_putsym(): word breaks and physical wrapping.
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
// C win/tty/topl.c:show_topl(), used for SUPPRESS_HISTORY prose such as getpos
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
// C win/tty/topl.c:topl_putsym(): key queries wrap without a More prompt.
// Return the rows covered so tty_yn_function's cleanup can restore the map.
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
export async function moreUntilDismissed(message, { urgent = false } = {}) {
    await setTopline(message);
    return pageTopline(message, { urgent });
}
// C win/tty/wintty.c:tty_message_menu(): the preceding prompt has already been answered.
// A selectable singleton uses bare tty output, without pline's status update.
export async function showMessageMenu(letter, pickMode, message) {
    if (pickMode === PICK_NONE) {
        await plineWithContinuation(message);
        return 0;
    }
    // dismiss_more is set first, so the letter also acknowledges older prose.
    const menuLetter = letter.charCodeAt(0);
    let key = await updateTopline(message, { dismissKey: menuLetter });
    // Wrapped text has already paged. A stopped window may have kept older
    // visible prose, but update_topl() never draws the suppressed choice.
    if (game._pending_message) {
        key = await pageTopline(game._pending_message, {
            dismissKey: key === 27 ? 1 : menuLetter,
        });
        clearMessageWindow();
    }
    // tty_message_menu() treats Escape as cancelling this selection only.
    game._suppressMessagesUntilInput = false;
    return key === menuLetter || key === 27 ? key : 0;
}
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
// Opening a tty text window flushes any older topline before the window is
// displayed.  Quest pages and other modal producers use this boundary when a
// time-consuming command has left ordinary prose pending for the scheduler.
export async function flushPendingTopline() {
    const pending = game._pending_message || '';
    return pending ? pageTopline(pending) : null;
}
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
// C win/tty/topl.c:update_topl()'s WIN_STOP branch for prose that cannot restart the pager
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
// C win/tty/topl.c:update_topl()'s storage wrap: from each CO-1 boundary search back to the
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
//# sourceMappingURL=tty_topline.js.map