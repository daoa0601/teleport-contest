// wintty.c / terminal rendering — painting the map and status rows onto
// the physical screen grid. Status content decisions live in botl.ts;
// glyph choice and vision live in display.ts.
import { game } from './gstate.js';
import { clipToplineToColumn, decodeMixedTopline } from './tty_topline.js';
import { COLNO, ROWNO, HI_ZAP } from './const.js';
import { NO_COLOR, ATR_INVERSE, CLR_GRAY, DEC_TO_UNICODE } from './terminal.js';
import { ATR_BLINK } from './terminal_attributes.js';
import { ROGUE_SYMSETS, shownSymbolSet } from './display.js';
const ANSI_DEFAULT = 39;
const ANSI_COLOR = [
    90, // CLR_BLACK     0 → tty dark gray when wc2_darkgray is enabled
    31, // CLR_RED       1
    32, // CLR_GREEN     2
    33, // CLR_BROWN     3
    34, // CLR_BLUE      4
    35, // CLR_MAGENTA   5
    36, // CLR_CYAN      6
    39, // CLR_GRAY      7 → tty's ordinary foreground
    39, // NO_COLOR      8 → default
    91, // CLR_ORANGE    9
    92, // CLR_BRIGHT_GREEN  10
    93, // CLR_YELLOW    11
    94, // CLR_BRIGHT_BLUE   12
    95, // CLR_BRIGHT_MAGENTA 13
    96, // CLR_BRIGHT_CYAN   14
    97, // CLR_WHITE     15
    90, // remembered room/corridor while blind (tty dark gray)
];
// ── Serialize a map row with DEC line-drawing and ANSI colors ──
function render_map_row(y) {
    if (!game.level)
        return '';
    let firstCol = -1, lastCol = -1;
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level.at(x, y);
        if (loc?.disp_ch && loc.disp_ch !== ' ') {
            if (firstCol < 0)
                firstCol = x;
            lastCol = x;
        }
    }
    if (firstCol < 0)
        return '';
    let output = '';
    let activeColor = ANSI_DEFAULT; // default
    let activeDec = false;
    // Leading gap
    const gap = firstCol - 1;
    if (gap > 4)
        output += `\x1b[${gap}C`;
    else if (gap > 0)
        output += ' '.repeat(gap);
    for (let x = firstCol; x <= lastCol; x++) {
        const loc = game.level.at(x, y);
        const ch = loc?.disp_ch ?? ' ';
        const color = loc?.disp_color ?? NO_COLOR;
        const dec = !!loc?.disp_decgfx;
        if (ch === ' ') {
            // Space runs
            let run = 1;
            while (x + run <= lastCol && (game.level.at(x + run, y)?.disp_ch ?? ' ') === ' ')
                run++;
            if (activeDec) {
                output += '\x0f';
                activeDec = false;
            }
            if (run > 4)
                output += `\x1b[${run}C`;
            else
                output += ' '.repeat(run);
            x += run - 1;
            continue;
        }
        let wantAnsi = ANSI_COLOR[color] ?? ANSI_DEFAULT;
        if (wantAnsi !== activeColor) {
            output += `\x1b[${wantAnsi}m`;
            activeColor = wantAnsi;
        }
        // DEC mode switching
        if (dec && !activeDec) {
            output += '\x0e';
            activeDec = true;
        }
        else if (!dec && activeDec) {
            output += '\x0f';
            activeDec = false;
        }
        output += ch;
    }
    // Reset state at end of row (C does per-row SO/SI)
    if (activeColor !== ANSI_DEFAULT)
        output += `\x1b[${ANSI_DEFAULT}m`;
    if (activeDec)
        output += '\x0f';
    return output;
}
// ── Serialize terminal grid for screen comparison ──
export function serialize_terminal_grid(display) {
    function characterAt(row, column) {
        const cell = display.grid[row]?.[column];
        if (!cell)
            throw new RangeError(`Missing terminal cell (${column}, ${row})`);
        return cell.ch;
    }
    let output = '';
    let lastRow = 0;
    for (let r = 0; r < display.rows; r++) {
        for (let c = 0; c < display.cols; c++) {
            if (characterAt(r, c) !== ' ') {
                lastRow = r;
                break;
            }
        }
    }
    for (let r = 0; r <= lastRow; r++) {
        let lastCol = -1;
        for (let c = display.cols - 1; c >= 0; c--) {
            if (characterAt(r, c) !== ' ') {
                lastCol = c;
                break;
            }
        }
        if (lastCol < 0) {
            if (r < lastRow)
                output += '\n';
            continue;
        }
        let firstCol = 0;
        for (let c = 0; c <= lastCol; c++) {
            if (characterAt(r, c) !== ' ') {
                firstCol = c;
                break;
            }
        }
        if (firstCol > 4)
            output += `\x1b[${firstCol}C`;
        else if (firstCol > 0)
            output += ' '.repeat(firstCol);
        for (let c = firstCol; c <= lastCol; c++)
            output += characterAt(r, c);
        if (r < lastRow)
            output += '\n';
    }
    return output;
}
// The tty status rows currently on screen: the windowport's cached lines
// when the status window is live, else whatever the grid still holds.
function displayedStatusLines() {
    const display = game.nhDisplay;
    if (display?.statusVisible && !game._statusUpdatesDisabled)
        return display.statusLines ?? ['', ''];
    const row = (index) => game.nhDisplay?.grid[index]
        ?.map(cell => cell.ch).join('').trimEnd() ?? '';
    return [row(22), row(23)];
}
// C wintty.c:render_status()/tty_putstatusfield() paint the status window;
// the highlight spans follow wintty.c's tty_status_update() styling.
export function writeStatusLines(display, lines) {
    for (const [index, text] of lines.entries()) {
        const row = 22 + index;
        const plain = text.replace(/\x1b\[(\d+)C/g, (_match, count) => ' '.repeat(Number(count)));
        display.clearRow(row);
        let column = 0, attr = 0;
        for (const part of plain.split(/(\x1b\[[0-9;]+m)/)) {
            if (part.startsWith('\x1b[')) {
                if (part === '\x1b[7m')
                    attr |= ATR_INVERSE;
                else if (part === '\x1b[5m')
                    attr |= ATR_BLINK;
                else if (part === '\x1b[0m')
                    attr = 0;
                continue;
            }
            const visible = part.slice(0, Math.max(0, display.cols - 1 - column));
            display.putstr(column, row, visible, NO_COLOR, attr);
            column += visible.length;
        }
        if (display.statusVisible) {
            for (const span of display.statusHighlights.spans[index] ?? []) {
                if (span.hitpointBar) {
                    // wintty.c:5231-5253: the lit cells take the title
                    // cell's colour and attribute; the unlit tail keeps only
                    // the blink bit, and an empty bar (0 HP) keeps none.
                    const bar = display.statusHighlights.barSpanStyle();
                    const fill = span.fill ?? 0;
                    const blink = fill > 0 && bar.attr & ATR_BLINK ? ATR_BLINK : 0;
                    for (let col = span.start; col < Math.min(span.end, display.cols - 1); col++) {
                        const cell = display.grid[row]?.[col];
                        if (!cell)
                            continue;
                        const lit = col < span.start + fill;
                        display.setCell(col, row, cell.ch, lit ? bar.color : NO_COLOR, lit ? bar.attr : blink);
                    }
                    continue;
                }
                const style = display.statusHighlights.style(span);
                for (let col = span.start; col < Math.min(span.end, display.cols - 1); col++) {
                    const cell = display.grid[row]?.[col];
                    if (!cell)
                        continue;
                    display.setCell(col, row, cell.ch, style.color, style.attr);
                }
            }
        }
    }
}
// ── Build screen output ──
export function _buildScreenOutput() {
    const display = game?.nhDisplay;
    if (!display)
        return;
    let output = '';
    const blankMainWindow = !!game._suppressMapStatusForFlush;
    // Row 0: message
    const preserveMessageRow = display.preserveEmptyMessageRow
        && !game._pending_message && !game._retained_message && !game._promptOwnsTopline;
    const visibleMessage = game._pending_message
        || game._retained_message
        || (preserveMessageRow ? display.grid[0]?.map(cell => cell.ch).join('').trimEnd() : '')
        || '';
    // A corner window's docorner() erased the physical top line past its
    // left edge; the full-screen repaint must not restore it while the
    // clipped message still owns the row. Every topline writer resets the
    // clip when it repaints; the preserve cache holds the row otherwise.
    const messageText = preserveMessageRow || display.toplineClipColumn === null
        ? visibleMessage : clipToplineToColumn(visibleMessage, display.toplineClipColumn);
    if (game.program_state?.saving) {
        if (!preserveMessageRow) {
            display.clearRow(0);
            display.putstr(0, 0, messageText.slice(0, display.cols), NO_COLOR);
        }
        return;
    }
    output += messageText + '\n';
    // Rows 1-21: map (rendered with DEC + ANSI, per-row SO/SI)
    for (let y = 0; y < ROWNO; y++) {
        output += (blankMainWindow ? '' : render_map_row(y)) + '\n';
    }
    // Row 22-23: status
    const status = displayedStatusLines();
    output += (blankMainWindow ? '' : status[0]) + '\n';
    output += blankMainWindow ? '' : status[1];
    game._screen_output = output;
    // Also write to grid for serialize_terminal_grid
    if (display.grid) {
        if (preserveMessageRow) {
            for (let row = 1; row < display.rows; row++)
                display.repaintRow(row);
        }
        else {
            display.repaintScreen();
            // tty_putmixed() folds DEC markers before update_topl() paints.
            // Only the graphics kludge paints the leading glyph cell.
            const msg = messageText;
            if (msg.includes('\x0e')) {
                const cells = decodeMixedTopline(msg);
                for (const [c, cell] of cells.entries()) {
                    if (c >= display.cols)
                        break;
                    display.setCell(c, 0, cell.dec && !game._toplineGlyphPainted ? ' ' : cell.ch, NO_COLOR, 0);
                }
            }
            else {
                for (let c = 0; c < Math.min(msg.length, display.cols); c++)
                    display.setCell(c, 0, msg.charAt(c), NO_COLOR, 0);
            }
        }
        if (!blankMainWindow) {
            // Map — write characters to grid (DEC → Unicode for browser display)
            for (let y = 0; y < ROWNO; y++)
                writeMapRow(display, y);
            // Status lines
            writeStatusLines(display, status);
            const cursorOverride = game._cursorOverride;
            if (Array.isArray(cursorOverride)) {
                display.setCursor(cursorOverride[0], cursorOverride[1]);
            }
            else if (game.u?.ux > 0) {
                display.setCursor(game.u.ux - 1, game.u.uy + 1);
            }
        }
    }
}
// C wintty.c: the tty prints one map row of glyphs per repaint sweep.
export function writeMapRow(display, y) {
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level?.at(x, y);
        if (!loc?.disp_ch)
            continue;
        const color = loc.disp_color ?? NO_COLOR;
        const attr = loc.disp_attr ?? 0;
        const highlight = game._mapPositionHighlight;
        const frameColor = highlight?.background && game.flags.color !== false
            && highlight.isValidLocation(x, y) ? HI_ZAP : null;
        // Plain blanks erase retained tty glyphs. Colored AIR spaces still
        // use map painting so their foreground color survives.
        if (loc.disp_ch === ' ' && frameColor === null && !(attr & 5)
            && (color === NO_COLOR || color === CLR_GRAY)) {
            display.setCell(x - 1, y + 1, ' ', color, attr);
            continue;
        }
        writeMapCell(display, x, y, loc, frameColor);
    }
}
// C wintty.c:tty_print_glyph(): one glyph cell onto the terminal grid.
export function writeMapCell(display, x, y, loc, frameColor) {
    const ch = loc.disp_decgfx ? (DEC_TO_UNICODE[loc.disp_ch] || loc.disp_ch) : loc.disp_ch;
    const name = shownSymbolSet().name?.toLowerCase() ?? '';
    const byteGlyph = !loc.disp_decgfx && ROGUE_SYMSETS[name]?.ibm === true;
    display.setMapCell(x - 1, y + 1, ch, loc.disp_color ?? NO_COLOR, loc.disp_attr ?? 0, frameColor, byteGlyph);
}
// C wintty.c:tty_clear_nhwindow(WIN_MAP): clear the map rows of the
// physical screen.
export function clearMapDisplay() {
    for (let row = 1; row <= ROWNO; row++)
        game.nhDisplay?.clearRow(row);
}
//# sourceMappingURL=wintty.js.map