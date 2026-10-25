// Native menu callers and tty text windows.
// Menus collect their entries here; tty_menu.ts owns layout and selection.
// C refs: windows.c and win/tty/wintty.c.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { clearMessageWindow, displayMessageWindow, docrt, flush_screen } from './display.js';
import { NO_COLOR } from './terminal.js';
import { C_ATR_INVERSE, terminalAttrFromCAttr } from './color_attr.js';
import { BUFSZ, NHW_MENU, PICK_NONE, PICK_ONE, PICK_ANY, MENU_ITEMFLAGS_SELECTED,
    MENU_ITEMFLAGS_SKIPMENUCOLORS } from './const.js';
import type { GameDisplay } from './game_display.js';
import { windowOrigin, tty_create_nhwindow, tty_start_menu,
    tty_add_menu, tty_end_menu, tty_select_menu, tty_destroy_nhwindow } from './tty_menu.js';
import type { TextMenuLine, TtyMenuWindow } from './tty_menu.js';
export type { TextMenuLine, MenuUnderlay } from './tty_menu.js';
export { snapshotMenuUnderlay, restoreMenuUnderlay } from './tty_menu.js';

export const ATR_NONE = 0;
export const ATR_INVERSE = 1;

export type TextMenuEntry = string | TextMenuLine;

export interface InventoryMenuItem<T = never> extends TextMenuLine {
    key?: string;
    value?: T;
    itemflags?: number;
}

export interface InventorySection<T = never> {
    heading?: string | null;
    items: readonly InventoryMenuItem<T>[];
}

export interface InventorySelection<T = never> {
    key: number;
    count: number | null;
    value?: T;
}

export interface InventoryWindowOptions {
    pickMode?: typeof PICK_NONE | typeof PICK_ONE;
    headingAttr?: number;
    title?: string | null;
    preselectedKey?: string | null;
}

export interface ChoiceMenuItem extends TextMenuLine {
    key: string;
    marker?: '-' | '*';
}

export type ChoiceMenuEntry = TextMenuEntry | ChoiceMenuItem;

export interface ChoiceWindowOptions {
    title: string;
    entries: readonly ChoiceMenuEntry[];
}

export interface PageLocalMenuItem<T> extends TextMenuLine {
    key?: string;
    groupAccelerator?: string;
    itemFlags?: number;
    value: T;
    selectable?: true;
    separatorBefore?: boolean;
}

export interface SelectableMenuItem<T> extends PageLocalMenuItem<T> {
    key: string;
}

export interface MenuLabel extends TextMenuLine {
    selectable: false;
    itemFlags?: number;
}

export type MultiSelectItem<T> = SelectableMenuItem<T> | MenuLabel;
export type PageLocalMultiSelectItem<T> = PageLocalMenuItem<T> | MenuLabel;

export interface PageLocalMultiSelectSection<T> {
    heading?: string | null;
    items: readonly PageLocalMultiSelectItem<T>[];
}

export interface MultiSelectSection<T> extends PageLocalMultiSelectSection<T> {
    items: readonly MultiSelectItem<T>[];
}

export interface CountedSelection<T> {
    value: T;
    count: number;
}

interface MultiSelectWindowBaseOptions {
    title: string;
    omitHeadings?: boolean;
    introLines?: readonly string[];
    returnCounts?: boolean;
    pickOne?: boolean;
    signalEscape?: boolean;
}

export type MultiSelectWindowOptions<T> = MultiSelectWindowBaseOptions & (
    | { pageLocalKeys: true; sections: readonly PageLocalMultiSelectSection<T>[] }
    | { pageLocalKeys?: false; sections: readonly MultiSelectSection<T>[] }
);

export interface TextPage {
    lines: readonly (TextMenuEntry | null)[];
    cursor?: readonly [number, number];
}

export interface PagedPickOneMenuOptions<T> {
    rows: readonly TextMenuEntry[];
    choices: ReadonlyMap<string, T>;
    // end_menu()'s prompt, drawn in the menu_headings style above the rows.
    prompt?: string | null;
}

function display(): GameDisplay | null {
    return game.nhDisplay;
}

function putLine(col: number, row: number, text: string, attr = ATR_NONE): void {
    const d = display();
    if (!d || row < 0 || row >= d.rows) return;
    for (let i = 0, x = col; i < text.length && x < d.cols; i++) {
        if (text.charAt(i) === '\t') x += 8 - (x % 8);
        else {
            if (x >= 0) d.setCell(x, row, text.charAt(i), NO_COLOR, attr);
            x++;
        }
    }
}

function clearRect(left: number, top: number, right: number, bottom: number): void {
    const d = display();
    if (!d) return;
    for (let row = Math.max(0, top); row < Math.min(d.rows, bottom); row++) {
        for (let col = Math.max(0, left); col < Math.min(d.cols, right); col++) {
            d.setCell(col, row, ' ', NO_COLOR, ATR_NONE);
        }
    }
}

// C windows.c:add_menu_heading() suppresses class highlighting in disclosure
// and passes MENU_ITEMFLAGS_SKIPMENUCOLORS so menucoloring rules leave the
// heading's own style alone.
export function addMenuHeading<T>(window: TtyMenuWindow<T>, text: string): void {
    tty_add_menu(window, {
        identifier: null, text,
        attr: game.program_state.gameover ? ATR_NONE : terminalAttrFromCAttr(game.iflags.menu_headings?.attr ?? C_ATR_INVERSE),
        color: game.program_state.gameover ? NO_COLOR : game.iflags.menu_headings?.color ?? NO_COLOR,
        itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS,
    });
}

/**
 * Build an inventory menu with the native tty window owner.
 * Items carry their displayed text and selector.
 * Return a selected key/count, Escape, or key 0 for an unselected dismissal.
 */
export async function showInventoryWindow<T = never>(sections: readonly InventorySection<T>[], {
    pickMode = PICK_NONE, headingAttr, title = null, preselectedKey = null,
}: InventoryWindowOptions = {}): Promise<InventorySelection<T>> {
    if (!display()) return { key: 27, count: null };
    const window = tty_create_nhwindow<InventoryMenuItem<T>>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const section of sections) {
            if (!section.items.length) continue;
            if (section.heading != null) {
                if (headingAttr === undefined) addMenuHeading(window, section.heading);
                else tty_add_menu(window, { identifier: null, text: section.heading, attr: headingAttr,
                    itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS });
            }
            for (const item of section.items) tty_add_menu(window, {
                identifier: item.key || item.value !== undefined ? item : null,
                text: item.text, attr: item.attr ?? ATR_NONE,
                ...(item.key ? { selector: item.key } : {}),
                itemflags: (item.itemflags ?? 0)
                    | (item.key === preselectedKey ? MENU_ITEMFLAGS_SELECTED : 0),
            });
        }
        tty_end_menu(window, title);
        const result = await tty_select_menu(window, pickMode);
        // Native PICK_ONE can return the preset and the new choice together.
        const selection = result.selections.find(item => item.selector !== preselectedKey)
            ?? result.selections[0];
        if (result.cancelled) return { key: 27, count: null };
        if (!selection) return { key: 0, count: null };
        return { key: selection.selector.charCodeAt(0), count: selection.count === -1 ? null : selection.count,
            ...(selection.identifier.value === undefined ? {} : { value: selection.identifier.value }) };
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

/**
 * Display a blocking disclosure window. Text windows wrap prose and use
 * `--More--`; menu-built overviews retain their rows and use the native
 * menu layout and page controls.
 */
export async function showDisclosureOverlay(lines: readonly TextMenuEntry[], {
    marker = '--More--', restoreUnderlay = false,
    pagerStyle = 'text', extraDismissKey = null, skipPendingPager = false,
}: {
    marker?: string; restoreUnderlay?: boolean;
    pagerStyle?: 'text' | 'menu'; extraDismissKey?: number | null;
    skipPendingPager?: boolean;
} = {}): Promise<number> {
    const d = display();
    if (!d) return 27;
    // tty_display_nhwindow() pages a NEED_MORE topline before the window,
    // but a TOPLINE_SPECIAL_PROMPT line is only erased, never paged.
    if (skipPendingPager) clearMessageWindow();
    else await displayMessageWindow();
    const entries = lines.map(line => typeof line === 'string' ? { text: line } : line);
    if (pagerStyle === 'menu') {
        return await showTextMenuOverlay(entries);
    }
    const prose = entries.map(line => ({ ...line, text: compressTextWindowLine(line.text, d.cols) }));
    const dataWidth = prose.reduce((widest, line) => Math.max(widest, line.text.length), 0);
    // putstr-built windows wrap prose but retain their original width
    // when deciding placement.
    const content = prose.flatMap(line => textWindowRows(line.text, d.cols)
        .map(text => ({ ...line, text })));

    // The pinned H2344_BROKEN path permits corners narrower than ten
    // columns. Only excess height or a disabled overlay clears the screen
    // for the full-screen renderer. A window too wide for a corner keeps
    // offset zero but still overlays just its own rows.
    const cornerOffset = windowOrigin(d.cols, d.rows, dataWidth + 1, content.length,
        game.flags.menu_overlay !== false);
    if (content.length >= d.rows || game.flags.menu_overlay === false) {
        return await pageDisclosureWindow(d, content, marker, extraDismissKey);
    }

    // process_text_window() pads a corner row with one space; dmore()
    // starts the marker one column past the window offset.
    const textLeft = cornerOffset === 0 ? 0 : cornerOffset + 1;
    const left = cornerOffset + 1;
    // Replace the preceding question across the whole message row.
    d.clearRow(0);
    // A dismissed corner window restores the already-painted map rather
    // than recomputing vision. Callers may retain a final page after exit.
    const underlay = restoreUnderlay
        ? d.grid.map(row => row.map(cell => ({ ...cell }))) : null;
    const underlayCursor = restoreUnderlay
        ? { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible } : null;
    clearRect(cornerOffset, 0, d.cols, content.length + 1);
    for (const [row, line] of content.entries()) putLine(textLeft, row, line.text, line.attr);
    putLine(left, content.length, marker);

    const cursorOffset = marker === '(end)' ? marker.length + 1 : marker.length;
    d.setCursor(left + cursorOffset, content.length);
    let key: number;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key) && key !== extraDismissKey);
    // erase_menu_or_text() redraws the whole screen for a zero offset.
    if (cornerOffset === 0) {
        await docrt();
        await flush_screen(1);
    } else if (underlay && underlayCursor) {
        for (const [row, cells] of underlay.entries()) {
            for (const [col, cell] of cells.entries()) {
                d.setCell(col, row, cell.ch, cell.color, cell.attr);
            }
        }
        d.setCursor(underlayCursor.col, underlayCursor.row);
        d.cursorVisible = underlayCursor.visible;
    }
    return key;
}

// Text-backed menu windows page prose without accepting menu commands.
async function pageDisclosureWindow(
    d: GameDisplay, lines: readonly TextMenuLine[], marker: string,
    extraDismissKey: number | null = null,
): Promise<number> {
    const pageSize = d.rows - 1;
    const pageCount = Math.max(1, Math.ceil(lines.length / pageSize));
    try {
        for (let page = 0; page < pageCount; page++) {
            const content = lines.slice(page * pageSize, (page + 1) * pageSize);
            d.clearScreen();
            for (const [row, line] of content.entries()) putLine(0, row, line.text, line.attr);
            putLine(1, content.length, marker);
            d.setCursor(1 + marker.length, content.length);
            let key: number;
            do key = await nhgetch();
            while (![27, 32, 10, 13].includes(key) && key !== extraDismissKey);
            if (key === 27 || page === pageCount - 1) return key;
        }
        return 27;
    } finally {
        await docrt();
        await flush_screen(1);
    }
}

/**
 * Display Lua `nh.text()` output.  Despite its name, that API creates an
 * NHW_MENU/PICK_NONE window in C.  With tty menu_overlay enabled, sparse menu
 * rows are painted over the live map at the computed corner offset.
 *
 * `viaPutstr` marks windows C fills with putstr() instead of add_menu_str()
 * (the shop bill, the unpaid-items list, novel passages, the quest pager);
 * putstr() never passes through add_menu()'s menucoloring, so their lines
 * carry MENU_ITEMFLAGS_SKIPMENUCOLORS.
 */
export async function showTextMenuOverlay(lines: readonly TextMenuEntry[], {
    viaPutstr = false,
}: { viaPutstr?: boolean } = {}): Promise<number> {
    if (!display()) return 27;
    const window = tty_create_nhwindow<never>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const line of lines) tty_add_menu(window, { identifier: null,
            ...(viaPutstr ? { itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS } : {}),
            ...(typeof line === 'string' ? { text: line } : line) });
        tty_end_menu(window);
        return (await tty_select_menu(window, PICK_NONE)).key;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

/** Return a PICK_ONE selector, Escape, or zero when no item is selected. */
export async function showChoiceWindow({ title, entries }: ChoiceWindowOptions): Promise<number> {
    if (!display()) return 27;
    const window = tty_create_nhwindow<ChoiceMenuItem>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const entry of entries) {
            if (typeof entry === 'string') tty_add_menu(window, { identifier: null, text: entry });
            else if ('key' in entry) tty_add_menu(window, {
                identifier: entry, selector: entry.key, text: entry.text,
                attr: entry.attr ?? ATR_NONE, color: entry.color ?? NO_COLOR,
                itemflags: entry.marker === '*' ? MENU_ITEMFLAGS_SELECTED : 0,
            });
            else tty_add_menu(window, { ...entry, identifier: null });
        }
        tty_end_menu(window, title);
        const result = await tty_select_menu(window, PICK_ONE);
        if (result.cancelled) return 27;
        // A new choice takes precedence over the preselected default.
        const selection = result.selections.find(item => item.identifier.marker !== '*')
            ?? result.selections[0];
        return selection?.selector.charCodeAt(0) ?? 0;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

/**
 * Display a PICK_ANY tty menu.  Sections contain
 * `{ heading, items: [{ key, text, value }] }`; items with `selectable: false`
 * are labels. The tty owner handles selection markers and paging.
 */
export function showMultiSelectWindow<T>(options: MultiSelectWindowOptions<T> & {
    returnCounts: true; signalEscape: true;
}): Promise<CountedSelection<T>[] | null>;
export function showMultiSelectWindow<T>(options: MultiSelectWindowOptions<T> & {
    returnCounts: true; signalEscape?: false;
}): Promise<CountedSelection<T>[]>;
export function showMultiSelectWindow<T>(options: MultiSelectWindowOptions<T> & {
    returnCounts?: false; signalEscape: true;
}): Promise<T[] | null>;
export function showMultiSelectWindow<T>(options: MultiSelectWindowOptions<T> & {
    returnCounts?: false; signalEscape?: false;
}): Promise<T[]>;
export function showMultiSelectWindow<T>(options: MultiSelectWindowOptions<T> & {
    signalEscape?: false;
}): Promise<T[] | CountedSelection<T>[]>;
export function showMultiSelectWindow<T>(options: MultiSelectWindowOptions<T>): Promise<T[] | CountedSelection<T>[] | null>;
export async function showMultiSelectWindow<T>({
    title, sections, omitHeadings = false, introLines = [],
    pageLocalKeys = false, returnCounts = false, pickOne = false, signalEscape = false,
}: MultiSelectWindowOptions<T>): Promise<T[] | CountedSelection<T>[] | null> {
    if (!display()) return [];
    const window = tty_create_nhwindow<PageLocalMenuItem<T>>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const text of introLines) tty_add_menu(window, { identifier: null, text });
        for (const section of sections) {
            if (!section.items.length) continue;
            if (!omitHeadings) {
                if (section.heading == null) throw new TypeError('A visible menu section requires a heading');
                addMenuHeading(window, section.heading);
            }
            for (const item of section.items) {
                if (item.selectable === false) {
                    tty_add_menu(window, { identifier: null, text: item.text,
                        attr: item.attr ?? ATR_NONE, color: item.color ?? NO_COLOR,
                        itemflags: item.itemFlags ?? 0 });
                    continue;
                }
                if (!pageLocalKeys && !item.key) throw new TypeError('The menu item requires a selector');
                if (item.separatorBefore) tty_add_menu(window, { identifier: null, text: '--' });
                tty_add_menu(window, { identifier: item, text: item.text,
                    attr: item.attr ?? ATR_NONE, color: item.color ?? NO_COLOR,
                    ...(item.key ? { selector: item.key } : {}),
                    ...(item.groupAccelerator ? { group: item.groupAccelerator } : {}), itemflags: item.itemFlags ?? 0 });
            }
        }
        tty_end_menu(window, title || null);
        const result = await tty_select_menu(window, pickOne ? PICK_ONE : PICK_ANY);
        if (result.cancelled) return signalEscape ? null : [];
        return returnCounts ? result.selections.map(selection => ({ value: selection.identifier.value, count: selection.count }))
            : result.selections.map(selection => selection.identifier.value);
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

// C tty_putstr(NHW_TEXT) buffers rows, including empty rows, and flushes at
// terminal height minus its footer. A trailing blank can therefore own a page.
export async function showTextWindow(lines: Iterable<TextMenuEntry> | AsyncIterable<TextMenuEntry>): Promise<number> {
    const d = display();
    if (!d) return 27;
    if (d.rows < 2 || d.cols < 2)
        throw new RangeError('A text window requires a content row and a pager row');

    const pageSize = d.rows - 1;
    let page: TextMenuEntry[] = [];
    let key = 32;
    const displayPage = async () => {
        while (page.length < pageSize) page.push('');
        key = await showTextPages([{ lines: [...page, '--More--'], cursor: [8, pageSize] }]);
        page = [];
    };
    for await (const entry of lines) {
        const line = typeof entry === 'string' ? { text: entry } : entry;
        for (const row of textWindowRows(line.text, d.cols)) {
            // tty_putstr flushes a full page before buffering the new row.
            // Its caller has already computed this line at that boundary.
            if (key === 27) continue;
            if (page.length === pageSize) await displayPage();
            if (key !== 27) page.push({ ...line, text: row });
        }
    }
    // A cancelled window ignores more rows, but the producer still runs:
    // pager.c's look lists continue applying observation side effects.
    if (key !== 27) await displayPage();
    return key;
}

function textWindowRows(text: string, columns: number): string[] {
    text = compressTextWindowLine(text, columns);
    const rows: string[] = [];
    while (text.length >= columns) {
        let split = columns - 1;
        while (split > 0 && text.charAt(split) !== ' ' && text.charAt(split) !== '\n') split--;
        if (!split) break;
        rows.push(text.slice(0, split));
        text = text.slice(split + 1);
    }
    // tty text rendering truncates an indivisible oversized word; unlike topline
    // messages, its text-window renderer does not wrap at the final column.
    rows.push(text.slice(0, columns - 1));
    return rows;
}

// tty_putstr() compresses long lines before buffering them. It leaves
// indentation alone on short lines and reserves BUFSZ's terminator slot.
function compressTextWindowLine(text: string, columns: number): string {
    if (text.length < columns && !text.includes('\n')) return text;
    const compressed = text.replace(/[ \n]+/g, ' ').replace(/^ /, '').slice(0, BUFSZ - 1);
    return compressed.length === BUFSZ - 1 || compressed.endsWith(' ')
        ? compressed.slice(0, -1) : compressed;
}

/**
 * Display one or more full-screen tty text pages.  Each page has
 * `{ lines, cursor }`; a line is either a string or `{ text, attr }`.
 * Escape closes the window, while any other key advances to the next page.
 */
export async function showTextPages(
    pages: readonly TextPage[],
    { validKeys = [27, 32, 10, 13] }: { validKeys?: readonly number[] | null } = {},
): Promise<number> {
    const d = display();
    if (!d) return 27;

    let key = 27;
    for (const page of pages) {
        d.clearScreen();
        for (const [row, line] of page.lines.entries()) {
            if (row >= d.rows) break;
            if (!line) continue;
            if (typeof line === 'string') putLine(0, row, line);
            else putLine(line.col ?? 0, row, line.text || '',
                line.attr || ATR_NONE);
        }
        const cursor: readonly [number, number] = page.cursor || [0, 0];
        d.setCursor(cursor[0], cursor[1]);
        do {
            key = await nhgetch();
        } while (validKeys && !validKeys.includes(key));
        if (key === 27) break;
    }
    return key;
}

/**
 * Display a paged PICK_ONE menu. `rows` contains strings or
 * `{ text, attr }` entries and already includes the title/blank rows. Choice
 * letters select visible entries; space advances and `<` goes back.
 * C refs: tty select_menu() and dungeon.c print_dungeon(TRUE).
 */
export async function showPagedPickOneMenu<T>({ rows, choices, prompt = null }: PagedPickOneMenuOptions<T>): Promise<T | null> {
    if (!display()) return null;
    const window = tty_create_nhwindow<T>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const entry of rows) {
            const row = typeof entry === 'string' ? { text: entry } : entry;
            const selector = row.text.charAt(0);
            const identifier = choices.get(selector);
            const selectable = identifier !== undefined && row.text.slice(1, 4) === ' - ';
            tty_add_menu(window, { text: selectable ? row.text.slice(4) : row.text,
                identifier: selectable ? identifier : null,
                ...(selectable ? { selector } : {}), attr: row.attr ?? ATR_NONE,
                itemflags: row.itemflags ?? 0 });
        }
        tty_end_menu(window, prompt);
        const result = await tty_select_menu(window, PICK_ONE);
        return result.selections[0]?.identifier ?? null;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}
