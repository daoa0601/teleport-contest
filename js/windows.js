// windows.ts — Minimal tty menu and text-window rendering.
// C refs: windows.c, wintty.c, tty.c.
//
// NetHack captures input while menus are visible, so modal windows must
// render into the terminal grid before calling nhgetch().
// This module deliberately contains no session-specific output.  Commands
// provide state-derived lines and this layer handles placement, attributes,
// pagination, cursor position, and input boundaries.
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { clearMessageWindow, docrt, flushPendingTopline, flush_screen } from './display.js';
import { getLine } from './query.js';
import { BUFSZ, PICK_NONE, PICK_ONE } from './const.js';
import { NO_COLOR } from './terminal.js';
export const ATR_NONE = 0;
export const ATR_INVERSE = 1;
function display() {
    return game.nhDisplay;
}
function putLine(col, row, text, attr = ATR_NONE) {
    const d = display();
    if (!d || row < 0 || row >= d.rows)
        return;
    for (let i = 0, x = col; i < text.length && x < d.cols; i++) {
        if (text.charAt(i) === '\t')
            x += 8 - (x % 8);
        else {
            if (x >= 0)
                d.setCell(x, row, text.charAt(i), NO_COLOR, attr);
            x++;
        }
    }
}
function clearRect(left, top, right, bottom) {
    const d = display();
    if (!d)
        return;
    for (let row = Math.max(0, top); row < Math.min(d.rows, bottom); row++) {
        for (let col = Math.max(0, left); col < Math.min(d.cols, right); col++) {
            d.setCell(col, row, ' ', NO_COLOR, ATR_NONE);
        }
    }
}
// Native tty_end_menu() measures every assembled row, including later pages,
// after assigning selectors. Margins and the largest pager also occupy width.
function menuLayout(rows, columns, terminalRows, overlay) {
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
    const width = clippedRows.reduce((widest, row) => Math.max(widest, row.text.length + 2), Math.min(columns, pager.length));
    const maxRows = (pageCount > 1 ? pageSize : rows.length) + 1;
    const boundary = maxRows >= terminalRows || !overlay ? 0
        : Math.max(0, Math.min(82, Math.floor(columns / 2), columns - width - 1));
    return { rows: clippedRows, pageSize, pageCount, maxRows, boundary };
}
function menuSelector(index) {
    return String.fromCharCode(index < 26 ? 97 + index : 65 + index - 26);
}
function selectableMenuText(key, text, marker = '-') {
    return `${key} ${marker} ${text.slice(0, BUFSZ - 1)}`;
}
function paintMenuPage(d, menu, page, rows, underlay) {
    const { boundary, maxRows, pageCount } = menu;
    if (boundary === 0)
        d.clearScreen();
    else {
        clearRect(boundary, 0, d.cols, maxRows);
        // A shorter corner page exposes the map again below two blank rows.
        // Keep those cells from the already-painted map, like docorner().
        const firstRestoredRow = Math.min(rows.length + 3, maxRows - 1);
        if (underlay && rows.length + 1 < maxRows) {
            for (let row = firstRestoredRow; row < maxRows; row++) {
                for (let col = boundary; col < d.cols; col++) {
                    const cell = underlay[row]?.[col];
                    if (cell)
                        d.setCell(col, row, cell.ch, cell.color, cell.attr);
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
export function snapshotMenuUnderlay() {
    const d = display();
    return d?.grid?.map(row => row.map(cell => ({ ...cell }))) || null;
}
export function restoreMenuUnderlay(snapshot) {
    const d = display();
    if (!d || !snapshot)
        return;
    for (const [row, cells] of snapshot.entries()) {
        if (row >= d.rows)
            break;
        for (const [col, cell] of cells.entries()) {
            if (col >= d.cols)
                break;
            d.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    d.clearRow(0);
}
/**
 * Display the tty inventory menu at the right edge of the map.
 * Items carry their displayed text and selector.
 * Return a selected key/count, Escape, or key 0 for an unselected dismissal.
 */
export async function showInventoryWindow(sections, { pickMode = PICK_NONE, headingAttr = ATR_INVERSE, title = null, preselectedKey = null, } = {}) {
    const d = display();
    if (!d)
        return { key: 27, count: null };
    await flushPendingTopline();
    clearMessageWindow();
    const rows = [];
    // allmain.c relays the default inverse menu-heading style to tty;
    // tty_end_menu() uses that style for the prompt as well as headings.
    if (title !== null)
        rows.push({ text: title, attr: ATR_INVERSE }, { text: '', attr: ATR_NONE });
    for (const section of sections) {
        if (!section?.items?.length)
            continue;
        if (section.heading != null)
            rows.push({ text: section.heading, attr: headingAttr });
        for (const item of section.items)
            rows.push({ attr: ATR_NONE, ...item });
    }
    // Explicit selectors do not consume automatic letters. Headers and the
    // prompt still count toward page boundaries.
    const pageSize = Math.min(52, d.rows - 1);
    let selector = 0;
    for (const [index, row] of rows.entries()) {
        if (index % pageSize === 0)
            selector = 0;
        if (row.key) {
            // Existing inventory callers supply the selector prefix.
            row.text = row.text.slice(0, BUFSZ + 3);
        }
        else if (row.value !== undefined) {
            row.key = menuSelector(selector++);
            row.text = selectableMenuText(row.key, row.text);
        }
    }
    const menu = menuLayout(rows, d.cols, d.rows, game.flags.menu_overlay !== false);
    const underlay = snapshotMenuUnderlay();
    try {
        return await readInventoryMenu(d, menu.rows, { pickMode, menu, preselectedKey }, underlay);
    }
    finally {
        // tty_dismiss_nhwindow(): a full window regenerates the map;
        // a corner window restores the glyphs it covered.
        if (menu.boundary === 0) {
            await docrt();
            await flush_screen(1);
        }
        else {
            restoreMenuUnderlay(underlay);
        }
    }
}
// C wintty.c:process_menu_window(), PICK_ONE and PICK_NONE.
async function readInventoryMenu(d, rows, { pickMode, menu, preselectedKey }, underlay) {
    const { pageSize, pageCount } = menu;
    const selectable = pickMode === PICK_ONE ? rows.filter(hasMenuKey) : [];
    let page = 0;
    let count = null;
    let repaint = true;
    let selectedKey = selectable.some(row => row.key === preselectedKey) ? preselectedKey : null;
    const selectedResult = (item) => ({
        key: item.key === selectedKey && count === null ? 0 : item.key.charCodeAt(0),
        count: count === null ? null : Number(count),
        ...(item.value === undefined ? {} : { value: item.value }),
    });
    const committedResult = () => ({ key: selectedKey?.charCodeAt(0) ?? 0, count: null });
    for (;;) {
        const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
        if (repaint)
            paintMenuPage(d, menu, page, pageRows.map(row => ({
                ...row,
                text: row.key && row.key === selectedKey
                    ? `${row.text.slice(0, 2)}*${row.text.slice(3)}` : row.text,
            })), underlay);
        repaint = false;
        const key = await nhgetch();
        const letter = String.fromCharCode(key);
        // Explicit selectors take priority over menu commands. Ordinary
        // inventory selection only accepts items on the current page.
        const item = pickMode === PICK_ONE
            ? pageRows.find((row) => hasMenuKey(row) && row.key === letter)
            : null;
        if (item) {
            return selectedResult(item);
        }
        if (/[0-9]/.test(letter)) {
            const nextCount = (count ?? 0n) * 10n + BigInt(letter);
            // AppendLongDigit() rejects native signed-long overflow.
            count = nextCount > 9223372036854775807n ? null : nextCount || null;
            continue;
        }
        if (key === 27) {
            if (count !== null) {
                count = null;
                continue;
            }
            return { key: 27, count: null };
        }
        if (key === 0 || key === 10 || key === 13)
            return committedResult();
        if (key === 32 && page === pageCount - 1)
            return committedResult();
        const nextPage = letter === '>' || key === 32 ? Math.min(page + 1, pageCount - 1)
            : letter === '<' ? Math.max(page - 1, 0)
                : letter === '^' ? 0 : letter === '|' ? pageCount - 1 : null;
        if (nextPage !== null) {
            count = null;
            repaint = nextPage !== page;
            page = nextPage;
            continue;
        }
        if (letter === ':' && pickMode === PICK_ONE) {
            const query = await getLine('Search for:', (_ch, code) => code >= 32 && code < 127);
            const found = query && selectable.find(row => inventorySearchMatches(query, row.text));
            if (found)
                return selectedResult(found);
            count = null;
            repaint = true;
            continue;
        }
        if (letter === '-' || (letter === '\\' && pageRows.some(row => row.key === selectedKey))) {
            selectedKey = null;
            repaint = true;
        }
        if ('.@,\\-~'.includes(letter))
            count = null; // bulk selection requires PICK_ANY
        // Invalid input does not navigate or cancel a count. The current
        // page remains the same input boundary.
    }
}
function hasMenuKey(row) {
    return typeof row.key === 'string' && row.key.length > 0;
}
function inventorySearchMatches(query, text) {
    const pattern = [...query].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(pattern, 'i').test(text);
}
/**
 * Display a blocking tty text/menu window over the right side of the map.
 * NetHack reserves at least 39 columns for these windows; wider content
 * pushes their left edge farther west.  Unlike a choice menu, disclosure
 * windows finish with either `--More--` or `(end)` and accept one dismissal
 * key before returning to their caller.
 */
export async function showDisclosureOverlay(lines, { marker = '--More--', minWidth = 38, restoreUnderlay = false, } = {}) {
    const d = display();
    if (!d)
        return 27;
    const widest = Math.max(marker.length, ...lines.map(line => line.length));
    // process_menu_window() leaves one terminal column to the right of a
    // PICK_NONE disclosure.  (Choice/inventory windows use a distinct
    // two-column corner margin.)
    const left = Math.max(0, d.cols - Math.max(minWidth, widest) - 1);
    const rows = [...lines, marker];
    // NHW_MENU replaces the message row rather than leaving the preceding
    // yn_function prompt visible to the west of a narrow overlay.
    d.clearRow(0);
    // In-game disclosure destroys its temporary corner window with
    // docorner(), restoring the already-painted map rather than recomputing
    // vision.  End-of-game disclosure deliberately leaves the page in place.
    const underlay = restoreUnderlay
        ? d.grid.map(row => row.map(cell => ({ ...cell }))) : null;
    const underlayCursor = restoreUnderlay
        ? { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible } : null;
    clearRect(left - 1, 0, d.cols, Math.min(d.rows, rows.length));
    for (const [row, text] of rows.entries()) {
        if (row >= d.rows)
            break;
        putLine(left, row, text);
    }
    const markerRow = Math.min(rows.length - 1, d.rows - 1);
    const cursorOffset = marker === '(end)' ? marker.length + 1 : marker.length;
    d.setCursor(Math.min(d.cols - 1, left + cursorOffset), markerRow);
    const key = await nhgetch();
    if (underlay && underlayCursor) {
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
/**
 * Display Lua `nh.text()` output.  Despite its name, that API creates an
 * NHW_MENU/PICK_NONE window in C.  With tty menu_overlay enabled, sparse menu
 * rows are painted over the live map at the computed corner offset.
 */
export async function showTextMenuOverlay(lines) {
    const d = display();
    if (!d)
        return 27;
    const rows = lines.map(line => typeof line === 'string'
        ? { text: line, attr: ATR_NONE }
        : { text: line.text || '', attr: line.attr || ATR_NONE });
    const menu = menuLayout(rows, d.cols, d.rows, game.flags.menu_overlay !== false);
    const { pageSize, pageCount } = menu;
    d.clearRow(0);
    // tty_select_menu() dismisses a corner NHW_MENU with docorner(), which
    // copies the already-painted map buffer back into the covered rectangle.
    // It does not call docrt() and recompute live glyph precedence.  Preserve
    // that presentation buffer here so a mapped trap, engraving, or other
    // deliberate overlay survives the menu exactly as it does in tty.
    const underlay = d.grid.map(row => row.map(cell => ({ ...cell })));
    const underlayCursor = { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible };
    let page = 0;
    try {
        for (;;) {
            const pageRows = menu.rows.slice(page * pageSize, (page + 1) * pageSize);
            paintMenuPage(d, menu, page, pageRows, underlay);
            const key = await nhgetch();
            if ([0, 27, 10, 13].includes(key))
                return key;
            if (key === 32 && page === pageCount - 1)
                return key;
            switch (String.fromCharCode(key)) {
                case ' ':
                case '>':
                    page = Math.min(page + 1, pageCount - 1);
                    break;
                case '<':
                    page = Math.max(0, page - 1);
                    break;
                case '^':
                    page = 0;
                    break;
                case '|':
                    page = pageCount - 1;
                    break;
            }
        }
    }
    finally {
        for (const [row, cells] of underlay.entries()) {
            for (const [col, cell] of cells.entries()) {
                d.setCell(col, row, cell.ch, cell.color, cell.attr);
            }
        }
        d.setCursor(underlayCursor.col, underlayCursor.row);
        d.cursorVisible = underlayCursor.visible;
    }
}
/**
 * Display a tty choice window, paginating when it exceeds the terminal height.
 * Keyed entries supply descriptions without a selector prefix. Other entries
 * are labels. Callers can also admit control keys through validKeys.
 */
export async function showChoiceWindow({ title, entries, validKeys = null, restoreUnderlay = false, }) {
    const d = display();
    if (!d)
        return 27;
    const underlay = snapshotMenuUnderlay();
    const underlayCursor = restoreUnderlay
        ? { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible } : null;
    const rows = [
        // tty menu prompts inherit `menu_headings`; the default is inverse.
        { text: title, attr: ATR_INVERSE },
        { text: '', attr: ATR_NONE },
        ...entries.map(entry => {
            if (typeof entry === 'string')
                return { text: entry, attr: ATR_NONE };
            if ('key' in entry)
                return {
                    key: entry.key, attr: entry.attr ?? ATR_NONE,
                    text: selectableMenuText(entry.key, entry.text, entry.marker),
                };
            return { text: entry.text, attr: entry.attr ?? ATR_NONE };
        }),
    ];
    const menu = menuLayout(rows, d.cols, d.rows, game.flags.menu_overlay !== false);
    let page = 0;
    let key;
    d.clearRow(0);
    for (;;) {
        const pageRows = menu.rows.slice(page * menu.pageSize, (page + 1) * menu.pageSize);
        paintMenuPage(d, menu, page, pageRows, underlay);
        key = await nhgetch();
        const letter = String.fromCharCode(key);
        if (pageRows.some(row => row.key === letter))
            break;
        const itemOnAnotherPage = menu.rows.some(row => row.key === letter);
        if (!itemOnAnotherPage && validKeys?.includes(key) && key !== 32)
            break;
        if (letter === '>' || key === 32 && page < menu.pageCount - 1) {
            page = Math.min(page + 1, menu.pageCount - 1);
            continue;
        }
        if (letter === '<' || letter === '^' || letter === '|') {
            page = letter === '<' ? Math.max(page - 1, 0)
                : letter === '^' ? 0 : menu.pageCount - 1;
            continue;
        }
        // A selector on another page cannot select an unseen entry.
        if (itemOnAnotherPage)
            continue;
        if (!validKeys || validKeys.includes(key))
            break;
    }
    if (underlay && underlayCursor) {
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
export async function showMultiSelectWindow({ title, sections, omitHeadings = false, introLines = [], blankAfterTitle = true, pageLocalKeys = false, titleAttr = ATR_INVERSE, returnCounts = false, pickOne = false, signalEscape = false, }) {
    const d = display();
    if (!d)
        return [];
    const allItems = sections.flatMap(section => section.items || [])
        .filter((item) => item.selectable !== false);
    const selected = new Set();
    const selectedCounts = new Map();
    let page = 0;
    let pendingCount = null;
    const selectionMarker = (item) => selected.has(item)
        ? selectedCounts.has(item) ? '#' : '+'
        : '-';
    const selectedValues = () => {
        const items = allItems.filter(item => selected.has(item));
        if (returnCounts)
            return items.map(item => ({
                value: item.value,
                count: selectedCounts.get(item) ?? -1,
            }));
        return items.map(item => item.value);
    };
    d.clearRow(0);
    const underlay = snapshotMenuUnderlay();
    const render = () => {
        const rows = [
            { text: title, attr: titleAttr },
            ...(blankAfterTitle ? [{ text: '', attr: ATR_NONE }] : []),
            ...introLines.map(text => ({ text, attr: ATR_NONE })),
        ];
        for (const section of sections) {
            if (!section?.items?.length)
                continue;
            if (!omitHeadings) {
                if (section.heading == null)
                    throw new TypeError('A visible menu section requires a heading.');
                rows.push({ text: section.heading, attr: ATR_INVERSE });
            }
            for (const item of section.items) {
                if (item.selectable === false) {
                    rows.push({ text: item.text, attr: ATR_NONE });
                    continue;
                }
                if (item.separatorBefore)
                    rows.push({ text: '--', attr: ATR_NONE });
                rows.push({
                    text: item.text,
                    attr: ATR_NONE,
                    item,
                });
            }
        }
        const pageSize = Math.min(52, d.rows - 1);
        let selector = 0;
        const rowKeys = new Map();
        for (const [index, row] of rows.entries()) {
            if (index % pageSize === 0)
                selector = 0;
            if (!row.item)
                continue;
            const key = row.item.key ?? (pageLocalKeys ? menuSelector(selector++) : undefined);
            if (key === undefined)
                throw new TypeError('A menu item requires a selector unless page-local keys are enabled.');
            rowKeys.set(row.item, key);
            row.text = selectableMenuText(key, row.item.text, selectionMarker(row.item));
        }
        const menu = menuLayout(rows, d.cols, d.rows, game.flags.menu_overlay !== false);
        const { pageCount } = menu;
        const pageRows = menu.rows.slice(page * pageSize, (page + 1) * pageSize);
        const pageItems = pageRows.flatMap(row => row.item ? [row.item] : []);
        const pageKeys = new Map();
        for (const item of pageItems) {
            const key = rowKeys.get(item);
            if (key !== undefined)
                pageKeys.set(item, key);
        }
        paintMenuPage(d, menu, page, pageRows, underlay);
        return {
            pageCount,
            pageItems,
            pageKeys,
        };
    };
    for (;;) {
        const { pageCount, pageItems, pageKeys } = render();
        const key = await nhgetch();
        const letter = String.fromCharCode(key);
        const group = allItems.filter(item => item.groupAccelerator === letter);
        const isGroup = group.some(item => item.key !== letter || letter === '$')
            && (!pickOne || group.length === 1);
        if (returnCounts && key >= 48 && key <= 57 && (!isGroup || pendingCount !== null)) {
            const digit = key - 48;
            const next = Math.min(Number.MAX_SAFE_INTEGER, (pendingCount ?? 0) * 10 + digit);
            if (next > 0)
                pendingCount = next;
            continue;
        }
        if (key === 27) {
            if (pendingCount !== null) {
                pendingCount = null;
                continue;
            }
            return signalEscape ? null : [];
        }
        const count = pendingCount;
        pendingCount = null;
        if (key === 10 || key === 13) {
            return selectedValues();
        }
        // C tty process_menu_window(): group accelerators invert matching
        // entries across pages; PICK_ONE accepts only a single match.
        if (isGroup) {
            for (const item of group) {
                if (selected.has(item)) {
                    selected.delete(item);
                    selectedCounts.delete(item);
                }
                else {
                    selected.add(item);
                    if (count !== null)
                        selectedCounts.set(item, count);
                }
            }
            if (pickOne)
                return selectedValues();
            continue;
        }
        if (letter === ' ') {
            if (pageCount > 1 && page < pageCount - 1) {
                page++;
                continue;
            }
            // tty PICK_ANY: Space is next-page only while another page
            // exists.  On the last (including only) page it commits.
            return selectedValues();
        }
        if (pageCount > 1 && letter === '<') {
            page = (page + pageCount - 1) % pageCount;
            continue;
        }
        if (letter === '@') {
            if (pickOne)
                continue;
            if (selected.size === allItems.length) {
                selected.clear();
                selectedCounts.clear();
            }
            else {
                for (const candidate of allItems)
                    selected.add(candidate);
                selectedCounts.clear();
            }
            continue;
        }
        if (letter === '.') {
            if (pickOne)
                continue;
            for (const candidate of pageItems) {
                selected.add(candidate);
                selectedCounts.delete(candidate);
            }
            continue;
        }
        const item = pageLocalKeys
            ? pageItems.find(candidate => pageKeys.get(candidate) === letter)
            : allItems.find(candidate => candidate.key === letter);
        if (!item)
            continue;
        if (pickOne) {
            if (returnCounts)
                return [{ value: item.value, count: count ?? -1 }];
            return [item.value];
        }
        if (selected.has(item) && count === null) {
            selected.delete(item);
            selectedCounts.delete(item);
        }
        else {
            selected.add(item);
            if (count === null)
                selectedCounts.delete(item);
            else
                selectedCounts.set(item, count);
        }
    }
}
// C tty_putstr(NHW_TEXT) buffers rows, including empty rows, and flushes at
// terminal height minus its footer. A trailing blank can therefore own a page.
export async function showTextWindow(lines) {
    const d = display();
    if (!d)
        return 27;
    if (d.rows < 2 || d.cols < 2)
        throw new RangeError('A text window requires a content row and a pager row');
    const rows = lines.flatMap(line => textWindowRows(line, d.cols));
    const pageSize = d.rows - 1;
    const pages = [];
    for (let first = 0; first < rows.length; first += pageSize) {
        const page = rows.slice(first, first + pageSize);
        while (page.length < pageSize)
            page.push('');
        page.push('--More--');
        pages.push({ lines: page, cursor: [8, pageSize] });
    }
    return showTextPages(pages, { validKeys: [27, 32, 10, 13] });
}
function textWindowRows(text, columns) {
    const rows = [];
    while (text.length >= columns) {
        let split = columns - 1;
        while (split > 0 && text.charAt(split) !== ' ' && text.charAt(split) !== '\n')
            split--;
        if (!split)
            break;
        rows.push(text.slice(0, split));
        text = text.slice(split + 1);
    }
    // NHW_TEXT truncates an indivisible oversized word; unlike topline
    // messages, its text-window renderer does not wrap at the final column.
    rows.push(text.slice(0, columns - 1));
    return rows;
}
/**
 * Display one or more full-screen tty text pages.  Each page has
 * `{ lines, cursor }`; a line is either a string or `{ text, attr }`.
 * Escape closes the window, while any other key advances to the next page.
 */
export async function showTextPages(pages, { validKeys = null } = {}) {
    const d = display();
    if (!d)
        return 27;
    let key = 27;
    for (const page of pages) {
        d.clearScreen();
        for (const [row, line] of page.lines.entries()) {
            if (row >= d.rows)
                break;
            if (!line)
                continue;
            if (typeof line === 'string')
                putLine(0, row, line);
            else
                putLine(line.col ?? 0, row, line.text || '', line.attr || ATR_NONE);
        }
        const cursor = page.cursor || [0, 0];
        d.setCursor(cursor[0], cursor[1]);
        do {
            key = await nhgetch();
        } while (validKeys && !validKeys.includes(key));
        if (key === 27)
            break;
    }
    return key;
}
/**
 * Display a paged PICK_ONE menu. `rows` contains strings or
 * `{ text, attr }` entries and already includes the title/blank rows. Choice
 * letters can be selected from any page; space advances and `<` goes back.
 * C refs: tty select_menu() and dungeon.c print_dungeon(TRUE).
 */
export async function showPagedPickOneMenu({ rows, choices, returnCancels = false, }) {
    const d = display();
    if (!d)
        return null;
    const menu = menuLayout(rows.map(row => typeof row === 'string' ? { text: row } : row), d.cols, d.rows, game.flags.menu_overlay !== false);
    const { pageSize, pageCount } = menu;
    d.clearRow(0);
    const underlay = snapshotMenuUnderlay();
    let page = 0;
    for (;;) {
        const pageRows = menu.rows.slice(page * pageSize, (page + 1) * pageSize);
        paintMenuPage(d, menu, page, pageRows, underlay);
        const key = await nhgetch();
        if (key === 27)
            return null;
        if (returnCancels && (key === 10 || key === 13))
            return null;
        const letter = String.fromCharCode(key);
        for (const [choice, value] of choices) {
            if (choice === letter)
                return value;
        }
        if (letter === '<')
            page = (page + pageCount - 1) % pageCount;
        else
            page = (page + 1) % pageCount;
    }
}
//# sourceMappingURL=windows.js.map