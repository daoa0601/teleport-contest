// wintty.ts — the home of C win/tty/wintty.c.
//
// Every mapped wintty.c function has one TS counterpart here, in wintty.c's
// source order. Status content decisions live in botl.ts; glyph choice and
// vision live in display.ts. Functions whose browser port lives elsewhere:
//   tty_clear_nhwindow(WIN_MESSAGE)/tty_create_nhwindow(NHW_MESSAGE)/
//   tty_display_nhwindow(WIN_MESSAGE)   -> tty_topline.ts (topl.c module)
//   tty_putstr()   -> updateTopline (tty_topline.ts, NHW_MESSAGE) and
//                     showTextWindow (windows.ts, NHW_TEXT)
//   tty_putmixed() -> the mixed-glyph decode paths in tty_topline.ts
//   g_putch()      -> the captured glyph cells in game_display.ts/display.ts
//   tty_raw_print()/tty_raw_print_bold() -> pline.ts rawPrint, end.ts scores
//   tty_nhgetch()/tty_nh_poskey() -> input.ts (the browser input seam)
//   tty_init_nhwindows()/tty_askname() -> jsmain.ts (the browser entry)
//   tty_display_file() -> pager.ts displayHelpFile (imports the cmd map)
//   process_text_window() -> the paging drivers in windows.ts plus
//                            paintMenuPage's putstr-rows branch below

import { game } from './gstate.js';
import { clipToplineToColumn, clearMessageWindow, decodeMixedTopline, flushPendingTopline, pageTopline, updateTopline } from './tty_topline.js';
import { plineWithContinuation, rawPrint } from './pline.js';
import { BUFSZ, COLNO, ROWNO, NHW_MENU, PICK_NONE, PICK_ONE, PICK_ANY,
    MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPMENUCOLORS, HI_ZAP, BL_LEVELDESC, BL_GOLD, BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC,
    BL_XP, BL_HD, BL_EXP, BL_TIME, BL_HUNGER, BL_CAP, BL_CONDITION, BL_VERS,
    CLR_MAX, HL_ATTCLR_BOLD, HL_ATTCLR_DIM, HL_ATTCLR_ITALIC, HL_ATTCLR_ULINE,
    HL_ATTCLR_BLINK, HL_ATTCLR_INVERSE } from './const.js';
import { NO_COLOR, ATR_INVERSE, ATR_BOLD, ATR_UNDERLINE, CLR_GRAY, DEC_TO_UNICODE } from './terminal.js';
import { ATR_BLINK, TERMINAL_DIM, TERMINAL_ITALIC } from './terminal_attributes.js';
import { statusConditionBit, bot, repadWithDashes } from './botl.js';
import { docrt, flush_screen, row_refresh, ROGUE_SYMSETS, shownSymbolSet } from './display.js';
import { getMenuColoring, menuitem_invert_test } from './menu_coloring.js';
import { nhgetch } from './input.js';
import { tty_getlin } from './query.js';
import { C_ATR_INVERSE, terminalAttrFromCAttr } from './color_attr.js';
import type { ConditionText, StatusFieldSpan, StatusLine2Fields, StatusStyle } from './botl.js';
import type { MapLocation } from './map_types.js';
import type { TerminalCell, TerminalColor } from './terminal.js';
import type { GameDisplay } from './game_display.js';

const ANSI_DEFAULT = 39;
const ANSI_COLOR = [
    90,  // CLR_BLACK     0 → tty dark gray when wc2_darkgray is enabled
    31,  // CLR_RED       1
    32,  // CLR_GREEN     2
    33,  // CLR_BROWN     3
    34,  // CLR_BLUE      4
    35,  // CLR_MAGENTA   5
    36,  // CLR_CYAN      6
    39,  // CLR_GRAY      7 → tty's ordinary foreground
    39,  // NO_COLOR      8 → default
    91,  // CLR_ORANGE    9
    92,  // CLR_BRIGHT_GREEN  10
    93,  // CLR_YELLOW    11
    94,  // CLR_BRIGHT_BLUE   12
    95,  // CLR_BRIGHT_MAGENTA 13
    96,  // CLR_BRIGHT_CYAN   14
    97,  // CLR_WHITE     15
    90,  // remembered room/corridor while blind (tty dark gray)
];

// ── Terminal access shared by the wintty.c ports ──
function display(): GameDisplay | null { return game.nhDisplay; }
function putLine(col: number, row: number, text: string, attr = ATR_NONE): void {
    const d = display();
    if (!d) return;
    d.putstr(col, row, text, NO_COLOR, attr);
}
function clearRect(left: number, top: number, right: number, bottom: number): void {
    const d = display();
    if (!d) return;
    for (let row = top; row < Math.min(d.rows, bottom); row++) {
        for (let col = left; col < Math.min(d.cols, right); col++) d.setCell(col, row, ' ', NO_COLOR, 0);
    }
}
const ATR_NONE = 0;

// ── Menu window objects (C struct WinDesc for NHW_MENU) ──
export interface TextMenuLine {
    text: string;
    attr?: number;
    color?: TerminalColor;
    col?: number;
    // Entry-level add_menu() flags; MENU_ITEMFLAGS_SKIPMENUCOLORS keeps a
    // heading out of menucolor rule matching.
    itemflags?: number;
}
export type MenuUnderlay = readonly (readonly TerminalCell[])[];
export interface PaintedMenuRow extends TextMenuLine { attributeStart: number }
export interface MenuLayout<T extends TextMenuLine> {
    rows: readonly (T & PaintedMenuRow)[];
    pageSize: number;
    pageCount: number;
    maxRows: number;
    width: number;
    endMarker: string;
    /** C filled this window with putstr(), so display uses the text rules. */
    putstrMeasured: boolean;
}
interface DisplayedMenuLayout<T extends TextMenuLine> extends MenuLayout<T> {
    boundary: number;
}
export type MenuPickMode = typeof PICK_NONE | typeof PICK_ONE | typeof PICK_ANY;
export interface TtyMenuEntry<T> extends TextMenuLine {
    identifier: T | null;
    selector?: string;
    group?: string;
}
interface TtyMenuRow<T> extends TextMenuLine {
    identifier: T | null;
    key: string;
    group: string;
    itemflags: number;
    selected: boolean;
    count: number;
}
export interface TtyMenuWindow<T> {
    entries: TtyMenuRow<T>[];
    layout: MenuLayout<TtyMenuRow<T>> | null;
    offx: number;
    active: boolean;
    cancelled: boolean;
    destroyed: boolean;
    underlay: MenuUnderlay | null;
}
export interface TtyMenuSelection<T> { identifier: T; selector: string; count: number }
export interface TtyMenuResult<T> {
    cancelled: boolean;
    key: number;
    selections: TtyMenuSelection<T>[];
}

// C wintty.c:getret()
// One more newline, then the prompt (cbreak is off before
// init_nhwindows(), so it asks for "return"), then xwaitforspace().
// The caller has already checked that a display exists.
export async function getret(): Promise<void> {
    rawPrint('');
    const display = game.nhDisplay;
    if (!display) return;
    const prompt = 'Hit return to continue: ';
    display.putstr(0, display.cursorRow, prompt, NO_COLOR, 0);
    display.setCursor(prompt.length, display.cursorRow);
    display.flush();
    let key;
    do key = await nhgetch();
    while (key !== 10 && key !== 13);
}

// C wintty.c:tty_suspend_nhwindows()
// settty() clears the screen and raw-prints the farewell line.
function tty_suspend_nhwindows(farewell: string): void {
    game.nhDisplay?.clearScreen();
    rawPrint(farewell);
}

// C wintty.c:tty_exit_nhwindows()
// The port marks the windows exited before the farewell (raw output
// checks the flag), then suspends; nh_terminate() never returns here.
export function tty_exit_nhwindows(farewell: string): void {
    game.program_state.windows_exited = true;
    tty_suspend_nhwindows(farewell);
}

export function tty_create_nhwindow<T>(_type: typeof NHW_MENU): TtyMenuWindow<T> {
    return { entries: [], layout: null, offx: 0, active: false, cancelled: false, destroyed: false, underlay: null };
}

function requireWindow<T>(window: TtyMenuWindow<T>): void {
    if (window.destroyed) throw new Error('The tty menu window has been destroyed');
}

// C wintty.c:erase_menu_or_text()
async function erase_menu_or_text<T>(window: TtyMenuWindow<T>, clear = false): Promise<void> {
    if (window.offx === 0) {
        if (clear) display()?.clearScreen();
        else {
            const d = display();
            if (d) d.statusVisible = false;
            await docrt();
            await flush_screen(1);
        }
        return;
    }
    const d = display();
    if (!d) return;
    // docorner(offx, maxrow + 1, 0). A prior full-screen clear must stay
    // blank outside that rectangle.
    const left = Math.max(0, window.offx - 1);
    const bottom = Math.min(d.rows, (window.layout?.maxRows ?? 0) + 1);
    if (clear) {
        // During character selection, docorner() clears the base window;
        // there are no map cells to redraw over the erased name-entry text.
        clearRect(left, 0, d.cols, bottom);
        return;
    }
    await docorner(d, left, bottom);
}

// C wintty.c:free_window_info()
function free_window_info<T>(window: TtyMenuWindow<T>): void {
    window.entries = [];
    window.layout = null;
}

// C wintty.c:tty_clear_nhwindow()
export async function tty_clear_nhwindow<T>(window: TtyMenuWindow<T>): Promise<void> {
    requireWindow(window);
    // Native clear erases an active window without dismissing it. A full
    // screen redraw belongs to dismissal, where hallucinations may change.
    if (window.active) {
        if (window.offx === 0) display()?.clearScreen();
        else await erase_menu_or_text(window);
    }
    free_window_info(window);
}

// C wintty.c:toggle_menu_curr(): toggle a specific entry. `lineno >= 0`
// means the entry is on the displayed page (C's in_view), so its marker is
// repainted through set_item_state().
function toggle_menu_curr<T>(
    d: GameDisplay, boundary: number, row: TtyMenuRow<T>, lineno: number, count: number,
): void {
    if (row.selected && count === -1) {
        row.selected = false;
        row.count = -1;
    } else {
        row.selected = true;
        if (count > 0) row.count = count;
    }
    if (lineno >= 0) set_item_state(d, boundary, lineno, row);
}

// C wintty.c:dmore()
// Paint the pager prompt past the window's edge, leave the cursor after it,
// and wait for a response in `valid` (xwaitforspace's accepted set).
export async function dmore(
    d: GameDisplay, col: number, row: number, prompt: string, valid: (key: number) => boolean,
): Promise<number> {
    putLine(col, row, prompt);
    d.setCursor(col + prompt.length, row);
    let key: number;
    do key = await nhgetch();
    while (!valid(key));
    return key;
}

// C wintty.c:set_item_state()
function set_item_state<T>(d: GameDisplay, boundary: number, row: number, item: TtyMenuRow<T>): void {
    d.setCell(boundary + 3, row, item.selected ? item.count === -1 ? '+' : '#' : '-',
        item.color ?? NO_COLOR, item.attr ?? ATR_NONE);
}

// C wintty.c:set_all_on_page(): select all [ignores pending count, if any]
function set_all_on_page<T>(d: GameDisplay, boundary: number, pageRows: readonly TtyMenuRow<T>[]): void {
    for (const [n, curr] of pageRows.entries()) {
        if (curr.identifier === null /* not selectable */
            || curr.selected /* already selected */
            || !menuitem_invert_test(curr.itemflags, curr.selected))
            continue;
        curr.selected = true;
        set_item_state(d, boundary, n, curr);
    }
}

// C wintty.c:unset_all_on_page(): unselect all
function unset_all_on_page<T>(d: GameDisplay, boundary: number, pageRows: readonly TtyMenuRow<T>[]): void {
    for (const [n, curr] of pageRows.entries()) {
        if (curr.identifier === null /* skip if not selectable */
            || !curr.selected /* skip if already de-selected */
            || !menuitem_invert_test(curr.itemflags, curr.selected))
            continue;
        curr.selected = false;
        curr.count = -1;
        set_item_state(d, boundary, n, curr);
    }
}

// C wintty.c:invert_all_on_page(): invert current page. `acc` is the group
// accelerator ('' => all), `count` the pending count (-1 for non-group).
function invert_all_on_page<T>(
    d: GameDisplay, boundary: number, pageRows: readonly TtyMenuRow<T>[], acc: string, count: number,
): void {
    for (const [n, curr] of pageRows.entries()) {
        if (curr.identifier === null /* not selectable */
            || (acc ? curr.group !== acc /* skip if not group 'acc' */
                /* inverting all rather than a group; skip if flagged */
                : !menuitem_invert_test(curr.itemflags, curr.selected)))
            continue;
        if (curr.selected) {
            curr.selected = false;
            curr.count = -1;
        } else {
            curr.selected = true;
            if (count > 0) curr.count = count;
        }
        set_item_state(d, boundary, n, curr);
    }
}

// C wintty.c:invert_all(): invert all entries that match the group
// accelerator (or all if empty). The current page is handled first because
// only its entries need screen updating.
function invert_all<T>(
    d: GameDisplay, boundary: number, pageRows: readonly TtyMenuRow<T>[],
    rows: readonly TtyMenuRow<T>[], acc: string, count: number,
): void {
    invert_all_on_page(d, boundary, pageRows, acc, count);
    const onCurrPage = new Set(pageRows);
    for (const curr of rows) {
        if (onCurrPage.has(curr) || curr.identifier === null
            || (acc ? curr.group !== acc
                : !menuitem_invert_test(curr.itemflags, curr.selected)))
            continue;
        if (curr.selected) {
            curr.selected = false;
            curr.count = -1;
        } else {
            curr.selected = true;
            if (count > 0) curr.count = count;
        }
    }
}

// C wintty.c:toggle_menu_attr(): each menu cell's color and attribute.
// Highlighting starts at attr_n: the whole line for headings, the
// description past "a - " for menu entries.
function toggle_menu_attr(line: PaintedMenuRow, col: number): { color: TerminalColor; attr: number } {
    return col < line.attributeStart
        ? { color: NO_COLOR, attr: ATR_NONE }
        : { color: line.color ?? NO_COLOR, attr: line.attr ?? ATR_NONE };
}

// C wintty.c:process_menu_window()
async function process_menu_window<T>(
    d: GameDisplay, rows: TtyMenuRow<T>[], layout: DisplayedMenuLayout<TtyMenuRow<T>>,
    how: MenuPickMode, underlay: MenuUnderlay | null,
): Promise<TtyMenuResult<T>> {
    const groups = groupAccelerators(rows, how);
    let page = 0;
    let count: bigint | null = null;
    let repaint = true;
    let previousPageLines = 0;
    const result = (key: number, cancelled = false): TtyMenuResult<T> => ({
        key, cancelled,
        selections: rows.flatMap(row => row.selected && row.identifier !== null
            ? [{ identifier: row.identifier, selector: row.key, count: row.count }] : []),
    });
    const pageFooter = (): string =>
        layout.pageCount > 1 ? `(${page + 1} of ${layout.pageCount})` : layout.endMarker;
    for (;;) {
        const first = page * layout.pageSize;
        const pageRows = rows.slice(first, first + layout.pageSize);
        // resp: the page's selectors, the group accelerators, digits, the
        // page commands and any key mapped to a menu command. Anything
        // else xwaitforspace() discards without resetting a count.
        const inResp = (raw: number): boolean => {
            const rawLetter = String.fromCharCode(raw);
            if (pageRows.some(row => row.key === rawLetter) || groups.has(rawLetter)) return true;
            const mapped = String.fromCharCode(game.commandBindings.menuCommand(raw));
            return groups.has(mapped) || '0123456789 \x1b\n\r><^|.,@\\-~:'.includes(mapped);
        };
        let key: number;
        if (repaint) {
            paintMenuPage(d, layout, page, layout.rows.slice(first, first + layout.pageSize).map((row, index) => {
                const item = pageRows[index];
                const marker = item?.selected ? item.count === -1 ? '*' : '#' : '-';
                return { ...row, text: item?.identifier !== null && item?.selected
                    ? row.text.slice(0, 2) + marker + row.text.slice(3) : row.text };
            }), underlay, previousPageLines);
            repaint = false;
            key = await dmore(d, layout.boundary + 1, pageRows.length, pageFooter(), inResp);
        } else {
            // just put the cursor back... then xwaitforspace(resp)
            const footer = pageFooter();
            d.setCursor(layout.boundary + 1 + footer.length, pageRows.length);
            do key = await nhgetch();
            while (!inResp(key));
        }
        let letter = String.fromCharCode(key);
        // PICK_ONE includes unique group shortcuts among explicit choices,
        // so a digit shortcut selects its group even after a count prefix.
        const explicit = pageRows.some(row => row.key === letter)
            || how === PICK_ONE && groups.has(letter);
        if (!explicit) {
            key = game.commandBindings.menuCommand(key);
            letter = String.fromCharCode(key);
        }
        if (!explicit && /[0-9]/.test(letter) && (count !== null || !groups.has(letter))) {
            const next: bigint = (count ?? 0n) * 10n + BigInt(letter);
            count = next > 9223372036854775807n ? null : next || null;
            continue;
        }
        const selectedCount = count === null ? -1 : Number(count);
        const counting = count !== null;
        count = null;
        if (!explicit && key === 27) {
            if (counting) continue;
            for (const row of rows) { row.selected = false; row.count = -1; }
            return result(key, true);
        }
        if (!explicit && (key === 10 || key === 13 || key === 32 && page === layout.pageCount - 1)) return result(key);
        if (!explicit && ' ><^|'.includes(letter)) {
            const next = letter === '^' ? 0 : letter === '|' ? layout.pageCount - 1
                : letter === '<' ? Math.max(0, page - 1) : Math.min(layout.pageCount - 1, page + 1);
            repaint = next !== page;
            // Native only records the old height for next-page movement.
            // Other page commands retain that value, including zero.
            if (next !== page && (letter === ' ' || letter === '>')) previousPageLines = pageRows.length;
            page = next;
            continue;
        }
        // Native bulk commands precede group shortcuts unless the key is
        // an explicit choice (including unique groups in PICK_ONE).
        if (!explicit && '.@,\\-~'.includes(letter)) {
            if (how !== PICK_ANY && !'-\\'.includes(letter)) continue;
            if (letter === ',') {
                set_all_on_page(d, layout.boundary, pageRows);
            } else if (letter === '.') {
                // entries on the current page need screen updating
                set_all_on_page(d, layout.boundary, pageRows);
                // set the rest; entries on the current page will be skipped
                // because all of those will be 'already selected' now
                const onCurrPage = new Set(pageRows);
                for (const row of rows) {
                    if (onCurrPage.has(row) || row.identifier === null || row.selected
                        || !menuitem_invert_test(row.itemflags, row.selected))
                        continue;
                    row.selected = true;
                }
            } else if (letter === '\\') {
                unset_all_on_page(d, layout.boundary, pageRows);
            } else if (letter === '-') {
                // entries on the current page need screen updating
                unset_all_on_page(d, layout.boundary, pageRows);
                // unset the rest; entries on the current page will be skipped
                // because none of those will still be in 'selected' state
                const onCurrPage = new Set(pageRows);
                for (const row of rows) {
                    if (onCurrPage.has(row) || row.identifier === null || !row.selected
                        || !menuitem_invert_test(row.itemflags, row.selected))
                        continue;
                    row.selected = false;
                    row.count = -1;
                }
            } else if (letter === '~') {
                invert_all_on_page(d, layout.boundary, pageRows, '', -1);
            } else {
                invert_all(d, layout.boundary, pageRows, rows, '', -1);
            }
            continue;
        }
        if (how !== PICK_NONE && groups.has(letter)) {
            // group accelerator; for the PICK_ONE case, we know that it
            // matches exactly one item in order to be in gacc[]
            invert_all(d, layout.boundary, pageRows, rows, letter, selectedCount);
            if (how === PICK_ONE) return result(key);
            continue;
        }
        if (explicit) {
            if (how === PICK_NONE) continue;
            // find, toggle, and possibly update
            const row = pageRows.find(row => row.key === letter);
            if (!row || row.identifier === null) continue;
            toggle_menu_curr(d, layout.boundary, row, pageRows.indexOf(row), selectedCount);
            if (how === PICK_ONE) return result(key);
            continue;
        }
        if (letter === ':' && how !== PICK_NONE) {
            const query = await tty_getlin('Search for:', (_ch, code) => code >= 32 && code !== 127, { inMenu: true });
            if (!query) continue;
            for (const row of rows) {
                if (row.identifier === null || !menuSearchMatches(query, row.text)) continue;
                toggle_menu_curr(d, layout.boundary, row, pageRows.indexOf(row), selectedCount);
                if (how === PICK_ONE) return result(key);
            }
        }
    }
}

function groupAccelerators<T>(rows: readonly TtyMenuRow<T>[], how: MenuPickMode): Set<string> {
    if (how === PICK_NONE) return new Set();
    const counts = new Map<string, number>();
    for (const row of rows) {
        if (row.group && row.group !== row.key) counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
    }
    if (counts.size === 0) return new Set();
    return new Set(rows.filter(row => row.group && (row.group !== row.key || row.group === '$')
        && (how === PICK_ANY || counts.get(row.group) === 1)).map(row => row.group));
}

function menuSearchMatches(query: string, text: string): boolean {
    // strutil.c:pmatchi() uses lowc(), which changes only ASCII A..Z.
    const lowerAscii = (value: string) => value.replace(/[A-Z]/g, letter => letter.toLowerCase());
    const pattern = [...lowerAscii(query)].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(pattern).test(lowerAscii(text));
}

export function paintMenuPage<T extends TextMenuLine>(
    d: GameDisplay, menu: DisplayedMenuLayout<T>, page: number,
    rows: readonly PaintedMenuRow[], underlay: MenuUnderlay | null,
    previousPageLines = 0,
): void {
    const { boundary, maxRows, pageCount } = menu;
    if (boundary === 0) d.clearScreen();
    else {
        clearRect(boundary, 0, d.cols, maxRows);
        // A shorter corner page exposes the map again below two blank rows.
        // Keep those cells from the already-painted map, like docorner().
        const firstRestoredRow = Math.min(rows.length + 3, maxRows - 1);
        if (underlay && previousPageLines > rows.length) {
            for (let row = firstRestoredRow; row < maxRows; row++) {
                for (let col = boundary; col < d.cols; col++) {
                    const cell = underlay[row]?.[col];
                    if (cell) d.setCell(col, row, cell.ch, cell.color, cell.attr);
                }
            }
        }
    }
    // A putstr()-filled window displays through process_text_window(): its
    // rows start at the window origin with no padding until the origin is
    // nonzero, when every row gains one leading space. tty_end_menu()-built
    // menus instead render every row one column past the boundary.
    const left = menu.putstrMeasured && boundary === 0 ? boundary : boundary + 1;
    for (const [row, line] of rows.entries()) {
        // tty_end_menu retains the row; process_menu_window also clips it to
        // the current terminal width when a retained menu is redisplayed.
        for (let col = 0; col < line.text.length && left + col < d.cols - 1; col++) {
            const style = toggle_menu_attr(line, col);
            d.setCell(left + col, row, line.text.charAt(col), style.color, style.attr);
        }
    }
    // dmore() paints the pager prompt at (boundary + 1, rows.length) and
    // leaves the cursor after it once the page is drawn.
}

export async function tty_display_nhwindow<T>(window: TtyMenuWindow<T>, how: MenuPickMode = PICK_NONE): Promise<TtyMenuResult<T>> {
    requireWindow(window);
    if (window.cancelled) return { cancelled: true, key: 27, selections: [] };
    const d = display();
    if (!d) return { cancelled: true, key: 27, selections: [] };
    if (!window.layout) tty_end_menu(window);
    const measured = window.layout;
    if (!measured) throw new Error('The menu has no completed layout');
    // tty_end_menu() retains dimensions; tty_display_nhwindow() chooses the
    // origin each time, so redisplay honors the current overlay setting.
    const layout = { ...measured, boundary: windowOrigin(d.cols, d.rows,
        measured.width, measured.maxRows, game.flags.menu_overlay !== false) };
    // Native message-window display returns immediately while WIN_STOP is set.
    if (!game._suppressMessagesUntilInput) await flushPendingTopline();
    clearMessageWindow();
    // An active menu covers the map already; retain its backing cells when
    // displaying it again, rather than saving the menu as its own underlay.
    if (!window.active) window.underlay = snapshotMenuUnderlay();
    window.offx = layout.boundary;
    window.active = true;
    const result = await process_menu_window(d, window.entries, layout, how, window.underlay);
    window.cancelled = result.cancelled;
    return result;
}

// The pinned tty build enables H2344_BROKEN: corner windows occupy at
// most half the terminal and at most 82 columns from its left edge.
export function windowOrigin(columns: number, rows: number, maxcol: number, maxrow: number, overlay: boolean): number {
    if (maxrow >= rows || !overlay) return 0;
    return Math.max(0, Math.min(82, Math.floor(columns / 2), columns - maxcol - 1));
}

export function menuSelector(index: number): string {
    return String.fromCharCode(index < 26 ? 97 + index : 65 + index - 26);
}

// C display_nhwindow() followed by destroy_nhwindow(): windows the core
// shows this way (the quest pager, the unpaid-items list, the shop bill,
// novel passages) are never wrapped in select_menu(), so bot_disabled
// stays clear and their dismissal's docorner()/docrt() runs bot()
// immediately, redrawing a wrecked status window at once.
export async function tty_display_and_dismiss<T>(
    window: TtyMenuWindow<T>, how: MenuPickMode = PICK_NONE,
): Promise<TtyMenuResult<T>> {
    const result = await tty_display_nhwindow(window, how);
    await tty_dismiss_nhwindow(window);
    return result;
}

// C wintty.c:tty_dismiss_nhwindow()
// A menu shown during role/race selection clears the screen: C's
// program_state.in_role_selection forces clearscreen in erase_menu_or_text().
export async function tty_dismiss_nhwindow<T>(window: TtyMenuWindow<T>, roleSelection = false): Promise<void> {
    window.cancelled = false;
    if (!window.active) return;
    window.active = false;
    await erase_menu_or_text(window, roleSelection);
    window.underlay = null;
}

export async function tty_destroy_nhwindow<T>(window: TtyMenuWindow<T>): Promise<void> {
    requireWindow(window);
    await tty_dismiss_nhwindow(window);
    await tty_clear_nhwindow(window);
    window.destroyed = true;
}

// C wintty.c:compress_str()
// tty_putstr() compresses long lines before buffering them. It leaves
// indentation alone on short lines and reserves BUFSZ's terminator slot.
export function compressStr(text: string, columns: number): string {
    if (text.length < columns && !text.includes('\n')) return text;
    const compressed = text.replace(/[ \n]+/g, ' ').replace(/^ /, '').slice(0, BUFSZ - 1);
    return compressed.length === BUFSZ - 1 || compressed.endsWith(' ')
        ? compressed.slice(0, -1) : compressed;
}

export function selectableMenuText(key: string, text: string, marker = '-'): string {
    return `${key} ${marker} ${text.slice(0, BUFSZ - 1)}`;
}

export async function tty_start_menu<T>(window: TtyMenuWindow<T>): Promise<void> {
    await tty_clear_nhwindow(window);
}

export function tty_add_menu<T>(window: TtyMenuWindow<T>, entry: TtyMenuEntry<T>): void {
    requireWindow(window);
    // C windows.c:add_menu() consults the menucoloring rules before the
    // entry reaches the window port: the first matching rule replaces both
    // the caller's color and attribute, so entries that carry their own
    // style are recolored too. Headings opt out with SKIPMENUCOLORS.
    let attr = entry.attr;
    let color = entry.color;
    if (!((entry.itemflags ?? 0) & MENU_ITEMFLAGS_SKIPMENUCOLORS)) {
        const rule = getMenuColoring(entry.text);
        if (rule) {
            attr = terminalAttrFromCAttr(rule.attr);
            color = rule.color;
        }
    }
    window.entries.push({
        text: entry.identifier === null ? entry.text : selectableMenuText(entry.selector || '?', entry.text),
        attr: attr ?? ATR_NONE,
        color: color ?? NO_COLOR,
        identifier: entry.identifier,
        key: entry.selector ?? '',
        group: entry.group ?? '',
        itemflags: entry.itemflags ?? 0,
        selected: !!((entry.itemflags ?? 0) & MENU_ITEMFLAGS_SELECTED),
        count: -1,
    });
    window.layout = null;
}

// Native tty_end_menu() measures every assembled row, including later pages,
// after assigning selectors. Margins and the largest pager also occupy width.
export function menuLayout<T extends TextMenuLine>(
    rows: readonly T[], columns: number, terminalRows: number,
    putstrMeasured = false,
): MenuLayout<T> {
    if (terminalRows < 2 || columns < 2)
        throw new RangeError('A menu requires a content row, a pager row, and two columns');
    const pageSize = Math.min(52, terminalRows - 1);
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const clippedRows = rows.map(row => ({
        ...row,
        text: row.text.slice(0, columns - 2),
        // Native checks the stored prefix before rendering selection markers.
        // Fake menu entries use that same prefix without a selectable value.
        attributeStart: 'key' in row && typeof row.key === 'string' && row.key.length > 0
            || /^. [-+#] /.test(row.text) ? 4 : 0,
    }));
    // tty_end_menu() keeps "(end) " and the page counters; a window filled
    // only with putstr() never runs it, so dmore() falls back to the
    // default "--More--" prompt.
    const endMarker = putstrMeasured ? '--More--' : '(end) '.slice(0, columns);
    const pager = putstrMeasured ? endMarker
        : pageCount > 1 ? `(${pageCount} of ${pageCount}) `.slice(0, columns) : endMarker;
    // putstr() measures a line as strlen + 1; tty_end_menu() re-measures its
    // own rows, and every stored line, as strlen + 2.
    const width = clippedRows.reduce((widest, row) =>
        Math.max(widest, row.text.length + (putstrMeasured ? 1 : 2)),
        putstrMeasured ? 0 : Math.min(columns, pager.length));
    const maxRows = (pageCount > 1 ? pageSize : rows.length) + 1;
    return { rows: clippedRows, pageSize, pageCount, maxRows, width, endMarker, putstrMeasured };
}

export function tty_end_menu<T>(window: TtyMenuWindow<T>, prompt: string | null = null,
    putstrMeasured = false,
): void {
    requireWindow(window);
    if (prompt !== null) {
        const heading: TtyMenuRow<T> = { text: prompt, attr: terminalAttrFromCAttr(game.iflags.menu_headings?.attr ?? C_ATR_INVERSE),
            color: game.iflags.menu_headings?.color ?? NO_COLOR,
            identifier: null, key: '', group: '', itemflags: 0, selected: false, count: -1 };
        window.entries.unshift(heading, { ...heading, text: '', attr: ATR_NONE, color: NO_COLOR });
    }
    const d = display();
    if (!d) return;
    const pageSize = Math.min(52, d.rows - 1);
    let selector = 0;
    for (const [index, row] of window.entries.entries()) {
        if (index % pageSize === 0) selector = 0;
        if (row.identifier !== null && !row.key) {
            row.key = menuSelector(selector++);
            row.text = row.key + row.text.slice(1);
        }
        // Native stores the clipped text, so search sees only the displayed description.
        row.text = row.text.slice(0, d.cols - 2);
    }
    window.layout = menuLayout(window.entries, d.cols, d.rows, putstrMeasured);
}

export async function tty_select_menu<T>(window: TtyMenuWindow<T>, how: MenuPickMode,
    roleSelection = false): Promise<TtyMenuResult<T>> {
    const previousStatusDisabled = game._statusUpdatesDisabled;
    const restoreStatusUpdates = () => {
        if (previousStatusDisabled === undefined) delete game._statusUpdatesDisabled;
        else game._statusUpdatesDisabled = previousStatusDisabled;
    };
    // C select_menu() keeps bot_disabled set through the whole windowport
    // call, so the dismissal's docorner() leaves a covered status window
    // damaged until the next moveloop bot() renders it in full.
    game._statusUpdatesDisabled = true;
    try {
        try {
            return await tty_display_nhwindow(window, how);
        } finally {
            await tty_dismiss_nhwindow(window, roleSelection);
        }
    } finally {
        restoreStatusUpdates();
    }
}

// C wintty.c:tty_message_menu(): the preceding prompt has already been answered.
// A selectable singleton uses bare tty output, without pline's status update.
export async function showMessageMenu(
    letter: string, pickMode: typeof PICK_NONE | typeof PICK_ONE, message: string,
): Promise<number> {
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

export function snapshotMenuUnderlay(): MenuUnderlay | null {
    const d = display();
    return d?.grid?.map(row => row.map(cell => ({ ...cell }))) || null;
}

export function restoreMenuUnderlay(snapshot: MenuUnderlay | null): void {
    const d = display();
    if (!d || !snapshot) return;
    for (const [row, cells] of snapshot.entries()) {
        if (row >= d.rows) break;
        for (let [col, cell] of cells.entries()) {
            if (col >= d.cols) break;
            // docorner() clears the final terminal column and row_refresh()
            // never repaints it (the map ends at column COLNO-2), so a
            // restored snapshot must not repaint old content there either.
            if (col === d.cols - 1) break;
            d.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    d.clearRow(0);
}

// C wintty.c:docorner()
async function docorner(d: GameDisplay, left: number, bottom: number): Promise<void> {
    // docorner() cl_end()s every covered row from the menu's left edge and
    // then repaints only the map rows from the glyph buffer. The message
    // and status rows stay blank past that edge; nothing else redraws them.
    // The erased top line stays clipped until a topline writer repaints it.
    d.toplineClipColumn = left;
    for (let row = 0; row < bottom; row++) {
        d.setCursor(left, row);
        clearRect(left, row, d.cols, row + 1);
        if (row >= 1 && row <= ROWNO) row_refresh(left + 1, COLNO - 1, row - 1);
    }
    if (bottom >= Math.min(d.rows - 2, ROWNO + 1)) {
        // docorner() requests a full status repaint. Until bot() succeeds,
        // retain the erased cells; menu selection and self-genocide can
        // both suppress that repaint.
        game.context.botl = true;
        d.statusVisible = false;
        await bot();
    }
}

// ── Serialize a map row with DEC line-drawing and ANSI colors ──
// Also C wintty.c:end_glyphout(): inlined here to end color and graphics modes after the row.
function render_map_row(y: number) {
    if (!game.level) return '';
    let firstCol = -1, lastCol = -1;
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level.at(x, y);
        if (loc?.disp_ch && loc.disp_ch !== ' ') {
            if (firstCol < 0) firstCol = x;
            lastCol = x;
        }
    }
    if (firstCol < 0) return '';

    let output = '';
    let activeColor = ANSI_DEFAULT;  // default
    let activeDec = false;

    // Leading gap
    const gap = firstCol - 1;
    if (gap > 4) output += `\x1b[${gap}C`;
    else if (gap > 0) output += ' '.repeat(gap);

    for (let x = firstCol; x <= lastCol; x++) {
        const loc = game.level.at(x, y);
        const ch = loc?.disp_ch ?? ' ';
        const color = loc?.disp_color ?? NO_COLOR;
        const dec = !!loc?.disp_decgfx;

        if (ch === ' ') {
            // Space runs
            let run = 1;
            while (x + run <= lastCol && (game.level.at(x + run, y)?.disp_ch ?? ' ') === ' ') run++;
            if (activeDec) { output += '\x0f'; activeDec = false; }
            if (run > 4) output += `\x1b[${run}C`;
            else output += ' '.repeat(run);
            x += run - 1;
            continue;
        }

        let wantAnsi = ANSI_COLOR[color] ?? ANSI_DEFAULT;
        if (wantAnsi !== activeColor) {
            output += `\x1b[${wantAnsi}m`;
            activeColor = wantAnsi;
        }

        // DEC mode switching
        if (dec && !activeDec) { output += '\x0e'; activeDec = true; }
        else if (!dec && activeDec) { output += '\x0f'; activeDec = false; }

        output += ch;
    }

    // Reset state at end of row (C does per-row SO/SI)
    if (activeColor !== ANSI_DEFAULT) output += `\x1b[${ANSI_DEFAULT}m`;
    if (activeDec) output += '\x0f';

    return output;
}

// ── Serialize terminal grid for screen comparison ──
export function serialize_terminal_grid(display: Pick<GameDisplay, 'rows' | 'cols' | 'grid'>) {
    function characterAt(row: number, column: number): string {
        const cell = display.grid[row]?.[column];
        if (!cell) throw new RangeError(`Missing terminal cell (${column}, ${row})`);
        return cell.ch;
    }
    let output = '';
    let lastRow = 0;
    for (let r = 0; r < display.rows; r++) {
        for (let c = 0; c < display.cols; c++) {
            if (characterAt(r, c) !== ' ') { lastRow = r; break; }
        }
    }
    for (let r = 0; r <= lastRow; r++) {
        let lastCol = -1;
        for (let c = display.cols - 1; c >= 0; c--) {
            if (characterAt(r, c) !== ' ') { lastCol = c; break; }
        }
        if (lastCol < 0) { if (r < lastRow) output += '\n'; continue; }
        let firstCol = 0;
        for (let c = 0; c <= lastCol; c++) {
            if (characterAt(r, c) !== ' ') { firstCol = c; break; }
        }
        if (firstCol > 4) output += `\x1b[${firstCol}C`;
        else if (firstCol > 0) output += ' '.repeat(firstCol);
        for (let c = firstCol; c <= lastCol; c++) output += characterAt(r, c);
        if (r < lastRow) output += '\n';
    }
    return output;
}

// C wintty.c: the tty prints one map row of glyphs per repaint sweep.
export function writeMapRow(display: GameDisplay, y: number): void {
    for (let x = 1; x < COLNO; x++) {
        const loc = game.level?.at(x, y);
        if (!loc?.disp_ch) continue;
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
export function writeMapCell(display: GameDisplay, x: number, y: number,
    loc: MapLocation, frameColor: number | null,
): void {
    const ch = loc.disp_decgfx ? (DEC_TO_UNICODE[loc.disp_ch] || loc.disp_ch) : loc.disp_ch;
    const name = shownSymbolSet().name?.toLowerCase() ?? '';
    const byteGlyph = !loc.disp_decgfx && ROGUE_SYMSETS[name]?.ibm === true;
    display.setMapCell(x - 1, y + 1, ch, loc.disp_color ?? NO_COLOR,
        loc.disp_attr ?? 0, frameColor, byteGlyph);
}

// C wintty.c:tty_clear_nhwindow(WIN_MAP): clear the map rows of the
// physical screen.
export function clearMapDisplay() {
    for (let row = 1; row <= ROWNO; row++) game.nhDisplay?.clearRow(row);
}

// The tty status rows currently on screen: the windowport's cached lines
// when the status window is live, else whatever the grid still holds.
function displayedStatusLines(): readonly [string, string] {
    const display = game.nhDisplay;
    if (display?.statusVisible && !game._statusUpdatesDisabled)
        return display.statusLines ?? ['', ''];
    const row = (index: number) => game.nhDisplay?.grid[index]
        ?.map(cell => cell.ch).join('').trimEnd() ?? '';
    return [row(22), row(23)];
}

// C wintty.c:render_status()/tty_putstatusfield() paint the status window;
// the highlight spans follow wintty.c's tty_status_update() styling.
export function writeStatusLines(display: GameDisplay, lines: readonly [string, string]): void {
    for (const [index, text] of lines.entries()) {
        const row = 22 + index;
        const plain = text.replace(/\x1b\[(\d+)C/g,
            (_match, count) => ' '.repeat(Number(count)));
        display.clearRow(row);
        let column = 0, attr = 0;
        for (const part of plain.split(/(\x1b\[[0-9;]+m)/)) {
            if (part.startsWith('\x1b[')) {
                if (part === '\x1b[7m') attr |= ATR_INVERSE;
                else if (part === '\x1b[5m') attr |= ATR_BLINK;
                else if (part === '\x1b[0m') attr = 0;
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
                        if (!cell) continue;
                        const lit = col < span.start + fill;
                        display.setCell(col, row, cell.ch,
                            lit ? bar.color : NO_COLOR, lit ? bar.attr : blink);
                    }
                    continue;
                }
                const style = display.statusHighlights.style(span);
                for (let col = span.start; col < Math.min(span.end, display.cols - 1); col++) {
                    const cell = display.grid[row]?.[col];
                    if (!cell) continue;
                    display.setCell(col, row, cell.ch, style.color, style.attr);
                }
            }
        }
    }
}

// ── wintty.c:make_things_fit() — shrinking the second status row ──

export interface StatusLine2Layout {
    text: string;
    spans: readonly StatusFieldSpan[];
    capacityBlank: boolean;
    levelPrefixChanged: boolean;
}

const capacityText: readonly (readonly string[])[] = [
    ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'],
    ['', 'Burden', 'Stress', 'Strain', 'Overtax', 'Overload'],
    ['', 'Brd', 'Strs', 'Strn', 'Ovtx', 'Ovld'],
];

// C wintty.c:make_things_fit() tries all condition abbreviations, then both
// encumbrance abbreviations, then Dlvl -> Dl, before truncating at cols-1.
// C wintty.c:shrink_enc().
// C wintty.c:shrink_dlvl().
// C wintty.c:set_condition_length().
// Also C botl.c:stat_cap_indx(): inlined here; fields.capacity supplies the cached index.
export function renderStatusLine2(
    fields: StatusLine2Fields,
    columns: number,
    capacityBlank = false,
    levelPrefixChanged = false,
): StatusLine2Layout {
    const attempts: readonly (readonly [0 | 1 | 2, 0 | 1 | 2, boolean])[] = [
        [0, 0, false], [1, 0, false], [2, 0, false],
        [2, 1, false], [2, 2, false], [2, 2, true],
    ];
    let line = '';
    let spans: StatusFieldSpan[] = [];
    let emptyCapacitySpace = fields.capacity === 0 && capacityBlank;
    // shrink_dlvl(0) restores Dlvl, even when the original label was Tutorial.
    const fullLocation = levelPrefixChanged
        ? fields.location.replace(/^[^:]+:/, 'Dlvl:') : fields.location;
    let prefixChanged = levelPrefixChanged;
    for (const [conditionSize, capacitySize, shortLevel] of attempts) {
        const location = shortLevel ? fullLocation.replace(/^[^:]+:/, 'Dl:') : fullLocation;
        if (location !== fullLocation) prefixChanged = true;
        line = '';
        spans = [];
        const append = (text: string, field: number, condition?: number) => {
            const start = line.length;
            line += text;
            spans.push({ field, start, end: line.length, ...(condition !== undefined ? { condition } : {}) });
        };
        const appendSeparated = (text: string, field: number) => { line += ' '; append(text, field); };
        append(location, BL_LEVELDESC);
        appendSeparated(fields.gold, BL_GOLD);
        line += ' ';
        append(`HP:${fields.health.hitpoints}`, BL_HP);
        append(`(${fields.health.maximumHitpoints})`, BL_HPMAX);
        appendSeparated(`Pw:${fields.health.power}`, BL_ENE);
        append(`(${fields.health.maximumPower})`, BL_ENEMAX);
        appendSeparated(`AC:${fields.health.armorClass}`, BL_AC);
        const [level, experience] = fields.experience.split('/');
        appendSeparated(level ?? '', fields.experience.startsWith('HD:') ? BL_HD : BL_XP);
        if (experience !== undefined) { line += '/'; append(experience, BL_EXP); }
        if (fields.moves !== null) appendSeparated(`T:${fields.moves}`, BL_TIME);
        if (fields.hunger) appendSeparated(fields.hunger, BL_HUNGER);
        const load = capacityText[capacitySize]?.[fields.capacity] ?? '';
        // shrink_enc() leaves a blank even for an unencumbered hero.
        // Restoring the full label on later flushes preserves that blank.
        if (fields.capacity === 0 && capacitySize > 0) emptyCapacitySpace = true;
        if (load || emptyCapacitySpace) appendSeparated(load, BL_CAP);
        for (const condition of fields.conditions) {
            line += ' ';
            append(condition[conditionSize], BL_CONDITION, statusConditionBit(condition));
        }
        for (const equipment of fields.equipment) appendSeparated(equipment.text, equipment.field);
        if (fields.version) {
            // The last field is right justified, with its leading separator
            // still counted by make_things_fit().
            const gap = Math.max(1, columns - 1 - line.length - fields.version.length);
            line += ' '.repeat(gap);
            append(fields.version, BL_VERS);
        }
        if (line.length <= columns - 1)
            return { text: line, spans, capacityBlank: emptyCapacitySpace, levelPrefixChanged: prefixChanged };
    }
    return {
        text: line.slice(0, Math.max(0, columns - 1)),
        spans,
        capacityBlank: emptyCapacitySpace,
        levelPrefixChanged: prefixChanged,
    };
}

// ── wintty.c:render_status() BL_TITLE branch — the hitpoint bar ──
// wintty.c:render_status()'s BL_TITLE branch.  The tty draws the bar's
// colour and attribute from the title cell's stored style
// (StatusHighlights.barStyle), so this builds only the bracketed text;
// wintty.c:5212-5213 repads a critical title's trailing space pairs with
// dashes through botl.c:repad_with_dashes() (botl.ts).
export function hitpointBar(title: string, critical: boolean): string {
    const text = critical ? repadWithDashes(title.slice(0, 30).padEnd(30))
        : title.slice(0, 30).padEnd(30);
    return `[${text}]`;
}

// ── wintty.c:condattr()/condcolor() ──
// C wintty.c:condattr().
// C wintty.c:condcolor().
export function conditionStyle(mask: number, masks: readonly number[]): StatusStyle {
    let color = NO_COLOR, attr = 0;
    for (let index = 0; index < CLR_MAX; index++) {
        if (mask & (masks[index] ?? 0)) { color = index; break; }
    }
    for (const [index, bit] of [[HL_ATTCLR_BOLD, ATR_BOLD], [HL_ATTCLR_DIM, TERMINAL_DIM],
        [HL_ATTCLR_ITALIC, TERMINAL_ITALIC], [HL_ATTCLR_ULINE, ATR_UNDERLINE],
        [HL_ATTCLR_BLINK, ATR_BLINK], [HL_ATTCLR_INVERSE, ATR_INVERSE]] as const)
        if (mask & (masks[index] ?? 0)) attr |= bit;
    return { color, attr };
}

// ── Build screen output ──

export function _buildScreenOutput() {
    const display = game?.nhDisplay;
    if (!display) return;

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
            for (let row = 1; row < display.rows; row++) display.repaintRow(row);
        } else {
            display.repaintScreen();
            // tty_putmixed() folds DEC markers before update_topl() paints.
            // Only the graphics kludge paints the leading glyph cell.
            const msg = messageText;
            if (msg.includes('\x0e')) {
                const cells = decodeMixedTopline(msg);
                for (const [c, cell] of cells.entries()) {
                    if (c >= display.cols) break;
                    display.setCell(
                        c, 0,
                        cell.dec && !game._toplineGlyphPainted ? ' ' : cell.ch,
                        NO_COLOR, 0,
                    );
                }
            } else {
                for (let c = 0; c < Math.min(msg.length, display.cols); c++)
                    display.setCell(c, 0, msg.charAt(c), NO_COLOR, 0);
            }
        }
        if (!blankMainWindow) {
            // Map — write characters to grid (DEC → Unicode for browser display)
            for (let y = 0; y < ROWNO; y++) writeMapRow(display, y);
            // Status lines
            writeStatusLines(display, status);
            const cursorOverride = game._cursorOverride;
            if (Array.isArray(cursorOverride)) {
                display.setCursor(cursorOverride[0], cursorOverride[1]);
            } else if (game.u?.ux > 0) {
                display.setCursor(game.u.ux - 1, game.u.uy + 1);
            }
        }
    }
}
