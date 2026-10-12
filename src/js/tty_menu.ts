// Native tty menu window ownership (win/tty/wintty.c).
import { BUFSZ, ROWNO, NHW_MENU, PICK_NONE, PICK_ONE, PICK_ANY,
    MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT } from './const.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { bot, clearMessageWindow, docrt, flushPendingTopline, flush_screen } from './display.js';
import { getLine } from './query.js';
import { NO_COLOR } from './terminal.js';
import type { TerminalCell } from './terminal.js';
import type { GameDisplay } from './game_display.js';

const ATR_NONE = 0;
export interface TextMenuLine { text: string; attr?: number; col?: number }
export type MenuUnderlay = readonly (readonly TerminalCell[])[];
export interface PaintedMenuRow extends TextMenuLine { attributeStart: number }
export interface MenuLayout<T extends TextMenuLine> {
    rows: readonly (T & PaintedMenuRow)[];
    pageSize: number;
    pageCount: number;
    maxRows: number;
    boundary: number;
}
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
// Native tty_end_menu() measures every assembled row, including later pages,
// after assigning selectors. Margins and the largest pager also occupy width.
export function menuLayout<T extends TextMenuLine>(
    rows: readonly T[], columns: number, terminalRows: number, overlay: boolean,
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
    const pager = pageCount > 1 ? `(${pageCount} of ${pageCount}) ` : '(end) ';
    const width = clippedRows.reduce((widest, row) => Math.max(widest, row.text.length + 2),
        Math.min(columns, pager.length));
    const maxRows = (pageCount > 1 ? pageSize : rows.length) + 1;
    const boundary = windowOrigin(columns, terminalRows, width, maxRows, overlay);
    return { rows: clippedRows, pageSize, pageCount, maxRows, boundary };
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

export function selectableMenuText(key: string, text: string, marker = '-'): string {
    return `${key} ${marker} ${text.slice(0, BUFSZ - 1)}`;
}

export function paintMenuPage<T extends TextMenuLine>(
    d: GameDisplay, menu: MenuLayout<T>, page: number,
    rows: readonly PaintedMenuRow[], underlay: MenuUnderlay | null,
): void {
    const { boundary, maxRows, pageCount } = menu;
    if (boundary === 0) d.clearScreen();
    else {
        clearRect(boundary, 0, d.cols, maxRows);
        // A shorter corner page exposes the map again below two blank rows.
        // Keep those cells from the already-painted map, like docorner().
        const firstRestoredRow = Math.min(rows.length + 3, maxRows - 1);
        if (underlay && rows.length + 1 < maxRows) {
            for (let row = firstRestoredRow; row < maxRows; row++) {
                for (let col = boundary; col < d.cols; col++) {
                    const cell = underlay[row]?.[col];
                    if (cell) d.setCell(col, row, cell.ch, cell.color, cell.attr);
                }
            }
        }
    }
    const left = boundary + 1;
    for (const [row, line] of rows.entries()) {
        for (let col = 0; col < line.text.length; col++) {
            const attr = col < line.attributeStart ? ATR_NONE : line.attr ?? ATR_NONE;
            d.setCell(left + col, row, line.text.charAt(col), NO_COLOR, attr);
        }
    }
    const marker = pageCount > 1 ? `(${page + 1} of ${pageCount})` : '(end) ';
    putLine(left, rows.length, marker);
    d.setCursor(Math.min(d.cols - 1, left + marker.length), rows.length);
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
        for (const [col, cell] of cells.entries()) {
            if (col >= d.cols) break;
            d.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    d.clearRow(0);
}

export type MenuPickMode = typeof PICK_NONE | typeof PICK_ONE | typeof PICK_ANY;
export interface TtyMenuEntry<T> extends TextMenuLine {
    identifier: T | null;
    selector?: string;
    group?: string;
    itemflags?: number;
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

export function tty_create_nhwindow<T>(_type: typeof NHW_MENU): TtyMenuWindow<T> {
    return { entries: [], layout: null, offx: 0, active: false, cancelled: false, destroyed: false, underlay: null };
}

export async function tty_clear_nhwindow<T>(window: TtyMenuWindow<T>): Promise<void> {
    requireWindow(window);
    // Native clear erases an active window without dismissing it. A full
    // screen redraw belongs to dismissal, where hallucinations may change.
    if (window.active) {
        if (window.offx === 0) display()?.clearScreen();
        else await restoreMenuCorner(window);
    }
    window.entries = [];
    window.layout = null;
}

export async function tty_start_menu<T>(window: TtyMenuWindow<T>): Promise<void> {
    await tty_clear_nhwindow(window);
}

export function tty_add_menu<T>(window: TtyMenuWindow<T>, entry: TtyMenuEntry<T>): void {
    requireWindow(window);
    window.entries.push({
        text: entry.identifier === null ? entry.text : selectableMenuText(entry.selector || '?', entry.text),
        attr: entry.attr ?? ATR_NONE,
        identifier: entry.identifier,
        key: entry.selector ?? '',
        group: entry.group ?? '',
        itemflags: entry.itemflags ?? 0,
        selected: !!((entry.itemflags ?? 0) & MENU_ITEMFLAGS_SELECTED),
        count: -1,
    });
    window.layout = null;
}

export function tty_end_menu<T>(window: TtyMenuWindow<T>, prompt: string | null = null): void {
    requireWindow(window);
    if (prompt !== null) {
        const heading: TtyMenuRow<T> = { text: prompt, attr: game.iflags.menu_headings?.attr ?? 1,
            identifier: null, key: '', group: '', itemflags: 0, selected: false, count: -1 };
        window.entries.unshift(heading, { ...heading, text: '', attr: ATR_NONE });
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
    window.layout = menuLayout(window.entries, d.cols, d.rows, game.flags.menu_overlay !== false);
}

export async function tty_display_nhwindow<T>(window: TtyMenuWindow<T>, how: MenuPickMode = PICK_NONE): Promise<TtyMenuResult<T>> {
    requireWindow(window);
    if (window.cancelled) return { cancelled: true, key: 27, selections: [] };
    const d = display();
    if (!d) return { cancelled: true, key: 27, selections: [] };
    if (!window.layout) tty_end_menu(window);
    const layout = window.layout;
    if (!layout) throw new Error('The menu has no completed layout');
    await flushPendingTopline();
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

export async function tty_select_menu<T>(window: TtyMenuWindow<T>, how: MenuPickMode): Promise<TtyMenuResult<T>> {
    try {
        return await tty_display_nhwindow(window, how);
    } finally {
        await tty_dismiss_nhwindow(window);
    }
}

export async function tty_dismiss_nhwindow<T>(window: TtyMenuWindow<T>): Promise<void> {
    window.cancelled = false;
    if (!window.active) return;
    window.active = false;
    if (window.offx === 0) {
        await docrt();
        await flush_screen(1);
    } else await restoreMenuCorner(window);
    window.underlay = null;
}

async function restoreMenuCorner<T>(window: TtyMenuWindow<T>): Promise<void> {
    const d = display();
    if (!d || !window.underlay) return;
    // erase_menu_or_text() calls docorner(offx, maxrow + 1, 0).
    // A prior full-screen clear must stay blank outside that rectangle.
    const left = Math.max(0, window.offx - 1);
    const bottom = Math.min(d.rows, (window.layout?.maxRows ?? 0) + 1);
    for (let row = 0; row < bottom; row++) {
        for (let col = left; col < d.cols; col++) {
            const cell = window.underlay[row]?.[col];
            if (cell) d.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    d.clearRow(0);
    // docorner() redraws both status lines when the erased area reaches them.
    if (bottom >= Math.min(d.rows - 2, ROWNO + 1)) await bot();
}

export async function tty_destroy_nhwindow<T>(window: TtyMenuWindow<T>): Promise<void> {
    requireWindow(window);
    await tty_dismiss_nhwindow(window);
    await tty_clear_nhwindow(window);
    window.destroyed = true;
}

function requireWindow<T>(window: TtyMenuWindow<T>): void {
    if (window.destroyed) throw new Error('The tty menu window has been destroyed');
}

async function process_menu_window<T>(
    d: GameDisplay, rows: TtyMenuRow<T>[], layout: MenuLayout<TtyMenuRow<T>>,
    how: MenuPickMode, underlay: MenuUnderlay | null,
): Promise<TtyMenuResult<T>> {
    const groups = groupAccelerators(rows, how);
    let page = 0;
    let count: bigint | null = null;
    let repaint = true;
    const result = (key: number, cancelled = false): TtyMenuResult<T> => ({
        key, cancelled,
        selections: rows.flatMap(row => row.selected && row.identifier !== null
            ? [{ identifier: row.identifier, selector: row.key, count: row.count }] : []),
    });
    for (;;) {
        const first = page * layout.pageSize;
        const pageRows = rows.slice(first, first + layout.pageSize);
        if (repaint) {
            paintMenuPage(d, layout, page, layout.rows.slice(first, first + layout.pageSize).map((row, index) => {
                const item = pageRows[index];
                const marker = item?.selected ? item.count === -1 ? '*' : '#' : '-';
                return { ...row, text: item?.identifier !== null && item?.selected
                    ? row.text.slice(0, 2) + marker + row.text.slice(3) : row.text };
            }), underlay);
            repaint = false;
        } else {
            const footer = layout.pageCount > 1 ? `(${page + 1} of ${layout.pageCount})` : '(end) ';
            d.setCursor(layout.boundary + 1 + footer.length, pageRows.length);
        }
        const key = await nhgetch();
        const letter = String.fromCharCode(key);
        // PICK_ONE includes unique group shortcuts among explicit choices,
        // so a digit shortcut selects its group even after a count prefix.
        const explicit = pageRows.some(row => row.key === letter)
            || how === PICK_ONE && groups.has(letter);
        // xwaitforspace ignores invalid input without resetting a count.
        if (!explicit && !groups.has(letter) && !'0123456789 \x1b\n\r><^|.,@\\-~:'.includes(letter)) continue;
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
            page = next;
            continue;
        }
        const update = (row: TtyMenuRow<T>) => {
            const index = pageRows.indexOf(row);
            if (index >= 0) set_item_state(d, layout.boundary, index, row);
        };
        // Native bulk commands precede group shortcuts unless the key is
        // an explicit choice (including unique groups in PICK_ONE).
        if (!explicit && '.@,\\-~'.includes(letter)) {
            if (how !== PICK_ANY && !'-\\'.includes(letter)) continue;
            const targets = ',\\~'.includes(letter) ? pageRows : rows;
            for (const row of targets) {
                if (row.identifier === null || !allowsBulkChange(row)) continue;
                if ('.,'.includes(letter)) {
                    if (row.selected) continue;
                    row.selected = true;
                } else if ('-\\'.includes(letter)) {
                    if (!row.selected) continue;
                    row.selected = false;
                }
                else row.selected = !row.selected;
                if (!row.selected) row.count = -1;
                update(row);
            }
            continue;
        }
        if (how !== PICK_NONE && groups.has(letter)) {
            for (const row of rows) {
                if (row.identifier === null || row.group !== letter) continue;
                row.selected = !row.selected;
                row.count = row.selected ? selectedCount : -1;
                update(row);
            }
            if (how === PICK_ONE) return result(key);
            continue;
        }
        if (explicit) {
            if (how === PICK_NONE) continue;
            const row = pageRows.find(row => row.key === letter);
            if (!row || row.identifier === null) continue;
            toggleItem(row, selectedCount);
            update(row);
            if (how === PICK_ONE) return result(key);
            continue;
        }
        if (letter === ':' && how !== PICK_NONE) {
            const query = await getLine('Search for:', (_ch, code) => code >= 32 && code < 127, { inMenu: true });
            if (!query) continue;
            for (const row of rows) {
                if (row.identifier === null || !menuSearchMatches(query, row.text)) continue;
                toggleItem(row, selectedCount);
                update(row);
                if (how === PICK_ONE) return result(key);
            }
        }
    }
}

function toggleItem<T>(row: TtyMenuRow<T>, count: number): void {
    if (row.selected && count === -1) {
        row.selected = false;
        row.count = -1;
    } else {
        row.selected = true;
        if (count > 0) row.count = count;
    }
}

function set_item_state<T>(d: GameDisplay, boundary: number, row: number, item: TtyMenuRow<T>): void {
    d.setCell(boundary + 3, row, item.selected ? item.count === -1 ? '+' : '#' : '-',
        NO_COLOR, item.attr ?? ATR_NONE);
}

function allowsBulkChange<T>(row: TtyMenuRow<T>): boolean {
    if (!(row.itemflags & MENU_ITEMFLAGS_SKIPINVERT)) return true;
    const mode = game.iflags.menuinvertmode ?? 1;
    return mode === 0 || mode === 1 && row.selected;
}

function groupAccelerators<T>(rows: readonly TtyMenuRow<T>[], how: MenuPickMode): Set<string> {
    if (how === PICK_NONE) return new Set();
    const counts = new Map<string, number>();
    for (const row of rows) {
        if (row.group && row.group !== row.key) counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
    }
    return new Set(rows.filter(row => row.group && (row.group !== row.key || row.group === '$')
        && (how === PICK_ANY || counts.get(row.group) === 1)).map(row => row.group));
}

function menuSearchMatches(query: string, text: string): boolean {
    const pattern = [...query].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(pattern, 'i').test(text);
}
