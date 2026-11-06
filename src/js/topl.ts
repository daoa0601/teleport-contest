// Message history and physical topline: C win/tty/topl.c.
// Message-window entry points also follow win/tty/wintty.c.
// cmd.c:doprev_message() dispatch stays in cmd.ts; cmd.c:key2txt() too.
import { game } from './gstate.js';
import { refreshStatusLines } from './botl.js';
import { _buildScreenOutput, writeMapRow } from './wintty.js';
import { plineWithContinuation, setTopline } from './pline.js';
import type { ToplineOptions } from './pline.js';
import { nhgetch } from './input.js';
import { COLNO, ROWNO, MAX_MSG_HISTORY, PICK_NONE, PICK_ONE } from './const.js';
import { DEC_TO_UNICODE, NO_COLOR } from './terminal.js';
import { showDisclosureOverlay } from './windows.js';

interface ToplineCell { ch: string; dec: boolean }
interface ToplinePagingOptions { urgent?: boolean; dismissKey?: number; rawGlyphs?: boolean }

// Part of C wintty.c:tty_clear_nhwindow(): the WIN_MESSAGE branch.
// C win/tty/wintty.c:tty_clear_nhwindow(WIN_MESSAGE). A seen prompt still occupies the
// physical message row; clearing it is separate from acknowledging input.
export function clearMessageWindow(coveredRows?: number) {
    const text = game._pending_message || game._retained_message || '';
    const display = game.nhDisplay;
    if (display?.preserveEmptyMessageRow && !text && !game._promptOwnsTopline) return;
    resetToplineClip();
    // The line editor wraps at character boundaries, unlike update_topl().
    // Its rendered row count is authoritative when clearing its prompt.
    const rows = coveredRows ?? toplineRows(text, display?.cols ?? COLNO).length;
    game._pending_message = '';
    game._retained_message = '';
    game._promptOwnsTopline = false;
    game._toplineGlyphPainted = false;
    if (!display) return;
    display.clearRow(0);
    // tty_clear_nhwindow(WIN_MESSAGE) calls docorner() only for rows the
    // message covered. Menus and text windows below those rows stay visible.
    for (let row = 1; row < Math.min(rows, display.rows); row++) {
        display.clearRow(row);
        if (row <= ROWNO && !game._suppressMapStatusForFlush) writeMapRow(display, row - 1);
    }
    // docorner() asks bot() to restore covered status rows. getlin() keeps
    // status updates disabled through this cleanup, leaving those rows blank.
    if (rows > ROWNO + 1) {
        if (game._statusUpdatesDisabled) display.statusVisible = false;
        refreshStatusLines();
    }
    display.setCursor(0, 0);
}

export const CTRL_P = 16;

export type MessageWindowMode = 's' | 'c' | 'f' | 'r';

// iflags.prevmsg_window holds the option's first letter; initoptions()
// leaves the tty default 'single'.
export function messageWindowMode(): MessageWindowMode {
    const mode = (game.iflags.prevmsg_window ?? 's').charAt(0).toLowerCase();
    return mode === 'c' || mode === 'f' || mode === 'r' ? mode : 's';
}


// One step back through the recall ring. tty_doprev_message() decrements
// cw->maxcol and resets it to maxrow once the walk leaves the filled slots.
// In a full ring the oldest message occupies maxrow's own slot, so the walk
// reaches the pending line there instead of displaying that entry.
// C win/tty/topl.c:tty_doprev_message().
export function stepHistoryBack(): void {
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


// tty_doprev_message()'s putstr-built NHW_MENU: "Message History", a blank
// line, the ring, and the pending topline. tty_display_nhwindow() pages it
// through process_text_window() because putstr() (unlike add_menu()) owns
// cw->data, and destroy_nhwindow() erases the corner again.
// C win/tty/topl.c:tty_doprev_message().
export async function showMessageHistoryWindow(
    { reversed, acceptCtrlP }: { reversed: boolean; acceptCtrlP?: boolean },
): Promise<number> {
    const lines: string[] = ['Message History', ''];
    if (reversed) {
        lines.push(game._toplines);
        // A full ring keeps its oldest message in maxrow's own slot, where
        // the reversed walk stops before listing it.
        const oldest = game._messageHistory.length === messageHistoryCapacity() ? 1 : 0;
        for (let index = game._messageHistory.length - 1; index >= oldest; index--)
            lines.push(game._messageHistory[index] ?? '');
    } else {
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
export function replaceTopline(msg: string): void {
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
export async function redotoplin(text: string): Promise<number> {
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
export function messageHistoryCapacity(): number {
    return Math.max(20, Math.min(MAX_MSG_HISTORY, game.iflags.msg_history ?? 20));
}

// C topl.c:remember_topl()
// C win/tty/topl.c:remember_topl(): archive gt.toplines into the WIN_MESSAGE
// recall ring and clear the negotiated topline. The port keeps the ring
// oldest-first on game state so ^P recall and save/restore share it.
export function rememberToplines(): void {
    const toplines = game._toplines;
    if (!toplines) return;
    const capacity = messageHistoryCapacity();
    game._messageHistory.push(toplines);
    if (game._messageHistory.length > capacity)
        game._messageHistory.shift();
    game._messageHistoryWriteIndex = (game._messageHistoryWriteIndex + 1) % capacity;
    game._toplines = '';
    game._messageHistoryCursor = null;
}

// Part of C topl.c:tty_putmsghistory(): the non-restoring message insertion path.
// C win/tty/topl.c:tty_putmsghistory(msg, FALSE): remember what is pending and
// make this line the current topline without displaying it. The quest pager
// synopsis, novel tribute attribution, and count echoes use this path.
export function putMessageHistory(message: string): void {
    // putmsghistory() marks a displayed topline as seen before replacing it.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    rememberToplines();
    game._toplines = message;
}

export function decodeMixedTopline(message: string): ToplineCell[] {
    const cells: ToplineCell[] = [];
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
            while (end < message.length && /[0-9;]/.test(message.charAt(end))) end++;
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
export function resetToplineClip(): void {
    if (game.nhDisplay) game.nhDisplay.toplineClipColumn = null;
}

// docorner() cl_end()s physical columns, while a mixed topline also carries
// \x0e/\x0f markers and ESC[nC spacing that occupy no cell. Keep the raw
// byte segments whose decoded cells fall before the clip column, replacing
// a partially covered spacing run with plain blanks so no code is cut in
// half.
export function clipToplineToColumn(message: string, column: number): string {
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
            while (end < message.length && /[0-9;]/.test(message.charAt(end))) end++;
            if (message[end] === 'C') {
                const count = Number(message.slice(index + 2, end)) || 1;
                if (cells + count <= column) clipped += message.slice(index, end + 1);
                else clipped += ' '.repeat(column - cells);
                cells += count;
                index = end;
                if (cells >= column) break;
                continue;
            }
        }
        if (cells >= column) break;
        clipped += ch;
        cells++;
    }
    // A cut inside a graphics run still closes it, so the decoder reads
    // the same cells the tty had on screen.
    if (dec) clipped += '\x0f';
    return clipped;
}

// Part of C topl.c:update_topl(): word breaks, followed by topl_putsym() hard wrapping.
export function toplineRows(
    message: string, columns: number, { splitWords = true }: { splitWords?: boolean } = {},
): [ToplineCell[], ...ToplineCell[][]] {
    const cells = decodeMixedTopline(message);
    // tty update_topl() replaces a space with a newline. A single oversized
    // word is left intact; topl_putsym() then wraps it at the last column.
    let start = 0;
    while (splitWords && cells.length - start >= columns) {
        let split = start + columns - 1;
        while (split > start && cells[split]?.ch !== ' ') split--;
        if (split === start) {
            split = cells.findIndex((cell, index) => index >= start && cell.ch === ' ');
            if (split < 0) break;
        }
        cells[split] = { ch: '\n', dec: false };
        start = split + 1;
    }
    let line: ToplineCell[] = [];
    const lines: [ToplineCell[], ...ToplineCell[][]] = [line];
    for (const cell of cells) {
        if (cell.ch === '\n') {
            line = [];
            lines.push(line);
        } else {
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
export function showUnrememberedTopline(message: string, { flushPending = false } = {}): void {
    // C tty_putstr(ATR_NOHISTORY) first moves whatever is pending on the
    // top line into the recall history, then shows the unremembered text.
    if (flushPending) rememberToplines();
    const display = game.nhDisplay;
    if (!display?.grid) return;
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
export function renderKeyPrompt(message: string, cursorOffset = 0): number {
    const display = game.nhDisplay;
    const lines = toplineRows(message, display?.cols ?? COLNO);
    if (!display) return lines.length;
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

export async function moreUntilDismissed(message: string, { urgent = false }: ToplineOptions = {}): Promise<number> {
    await setTopline(message);
    return pageTopline(message, { urgent });
}

// C topl.c:more()
// C win/tty/topl.c:more() acknowledges existing output. A window-only display does not
// call bot(), so it must retain status even if game state changed meanwhile.
export async function pageTopline(
    message: string, { urgent = false, dismissKey, rawGlyphs = false }: ToplinePagingOptions = {},
): Promise<number> {
    // C tty more() returns before painting or reading during fuzzer mode.
    if (game.iflags.debug_fuzzer) return 0;
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
    do key = await nhgetch();
    while (key !== dismissKey && ![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    // more() repairs covered map rows after any dismissal. Escape also
    // erases a one-line message; WIN_NOSTOP only prevents output suppression.
    game._retained_message = '';
    if (lines.length > 1) {
        _buildScreenOutput();
        display?.setCursor(0, 0);
    } else if (key === 27) {
        display?.clearRow(0);
        display?.setCursor(0, 0);
    } else {
        game._retained_message = message + '--More--';
    }
    if (key === 27 && !urgent) {
        game._suppressMessagesUntilInput = true;
        // more() erases the display but retains gt.toplines for hidden prose.
        if (display) display.stoppedTopline = message;
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

// Part of C wintty.c:tty_display_nhwindow(): the WIN_MESSAGE branch.
// C win/tty/wintty.c:tty_display_nhwindow(WIN_MESSAGE): unlike a direct more(), the window
// display honors Escape's WIN_STOP/WIN_CANCELLED flag before acknowledging.
// Only TOPLINE_NEED_MORE erases the row; answered questions remain visible.
export async function displayMessageWindow(): Promise<number | null> {
    if (game._suppressMessagesUntilInput) return null;
    if (!game._pending_message) {
        game._retained_message = '';
        game._promptOwnsTopline = false;
        if (game.nhDisplay) game.nhDisplay.preserveEmptyMessageRow = true;
        return null;
    }
    const dismissal = await flushPendingTopline();
    clearMessageWindow();
    return dismissal;
}

// Part of C topl.c:update_topl(): the WIN_STOP branch for prose that cannot restart the pager
// (only "You die" does): gt.toplines and the recall history advance, but
// redotoplin() never runs, so the screen keeps its suppressed line.
export function appendSuppressedTopline(msg: string): void {
    const stopped = game.nhDisplay?.stoppedTopline ?? (game._pending_message || '');
    const visibleLength = (message: string) => /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message)
        ? decodeMixedTopline(message).length : message.length;
    const columns = game.nhDisplay?.cols ?? 80;
    const fits = visibleLength(msg) + visibleLength(stopped) + 3 < columns - 8;
    const stored = (message: string) => wrapStoredToplines(message, columns);
    if (game.nhDisplay)
        game.nhDisplay.stoppedTopline = fits ? stored(`${stopped}  ${msg}`) : stored(msg);
    if (fits) game._toplines = stored(`${game._toplines}  ${msg}`);
    else {
        rememberToplines();
        game._toplines = stored(msg);
    }
}

// C topl.c:update_topl()
// C win/tty/topl.c:update_topl() also owns bare tty_putstr() output from singleton menus.
// Sample WIN_STOP on entry: Escape at an older line suppresses subsequent
// calls, while the incoming line from this call still gets drawn.
export async function updateTopline(
    msg: string, options: ToplinePagingOptions = {},
): Promise<number | null> {
    const paging = { ...options };
    const urgent = paging.urgent ?? false;
    const pending = game._pending_message || '';
    const visibleLength = (message: string) => /[\x0e\x0f]|\x1b\[[0-9;]*C/.test(message)
        ? decodeMixedTopline(message).length : message.length;
    const columns = game.nhDisplay?.cols ?? 80;
    // update_topl() stores gt.toplines with its word wrap already applied
    // (a space replaced by a newline), so recall and paging never re-split.
    const stored = (message: string) => wrapStoredToplines(message, columns);
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
    } else if (!msg.startsWith('You die')
        && visibleLength(msg) + visibleLength(pending) + 3 < columns - 8) {
        game._toplines = stored(`${game._toplines}  ${msg}`);
        // addtopl() appends to the visible line, which can include
        // SUPPRESS_HISTORY text absent from gt.toplines.
        replaceTopline(`${pending}  ${msg}`);
        dismissal = null;
    } else {
        dismissal = await pageTopline(pending, paging);
        // xwaitforspace() replaces dismiss_more with 1 on Escape.
        if (dismissal === 27) paging.dismissKey = 1;
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
function wrapStoredToplines(message: string, columns: number): string {
    const cells: { text: string; splittable: boolean; raw: number }[] = [];
    let dec = false;
    for (let raw = 0; raw < message.length; raw++) {
        const ch = message.charAt(raw);
        if (ch === '\x0e') { dec = true; continue; }
        if (ch === '\x0f') { dec = false; continue; }
        if (ch === '\x1b' && message.charAt(raw + 1) === '[') {
            let end = raw + 2;
            while (end < message.length && /[0-9;]/.test(message.charAt(end))) end++;
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
    const breaks = new Set<number>();
    while (cells.length - start >= columns) {
        let split = start + columns - 1;
        while (split > start && !cells[split]?.splittable) split--;
        if (split === start) {
            const next = cells.findIndex((cell, index) =>
                index >= start && cell.splittable);
            if (next < 0) break;
            split = next;
        }
        breaks.add(cells[split]?.raw ?? split);
        start = split + 1;
    }
    if (!breaks.size) return message;
    let wrapped = '';
    for (let raw = 0; raw < message.length; raw++)
        wrapped += breaks.has(raw) ? '\n' : message.charAt(raw);
    return wrapped;
}

// C topl.c:tty_yn_function(): numeric response entry.
// Also C topl.c:removetopl(): inlined here when erasing digits or abandoning the count.
export async function readChoiceNumber(
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
