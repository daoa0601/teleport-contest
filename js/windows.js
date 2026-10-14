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
import { clearMessageWindow, displayMessageWindow, docrt, flush_screen } from './display.js';
import { BUFSZ, NHW_MENU, PICK_NONE, PICK_ONE, PICK_ANY, MENU_ITEMFLAGS_SELECTED } from './const.js';
import { NO_COLOR } from './terminal.js';
import { menuLayout, windowOrigin, selectableMenuText, paintMenuPage, snapshotMenuUnderlay, restoreMenuUnderlay, tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu, tty_select_menu, tty_destroy_nhwindow } from './tty_menu.js';
export { snapshotMenuUnderlay, restoreMenuUnderlay } from './tty_menu.js';
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
/**
 * Display the tty inventory menu at the right edge of the map.
 * Items carry their displayed text and selector.
 * Return a selected key/count, Escape, or key 0 for an unselected dismissal.
 */
export async function showInventoryWindow(sections, { pickMode = PICK_NONE, headingAttr = ATR_INVERSE, title = null, preselectedKey = null, } = {}) {
    if (!display())
        return { key: 27, count: null };
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const section of sections) {
            if (!section.items.length)
                continue;
            if (section.heading != null)
                tty_add_menu(window, { identifier: null, text: section.heading, attr: headingAttr });
            for (const item of section.items)
                tty_add_menu(window, {
                    identifier: item.key || item.value !== undefined ? item : null,
                    text: item.text, attr: item.attr ?? ATR_NONE,
                    ...(item.key ? { selector: item.key } : {}),
                    itemflags: item.key === preselectedKey ? MENU_ITEMFLAGS_SELECTED : 0,
                });
        }
        tty_end_menu(window, title);
        const result = await tty_select_menu(window, pickMode);
        // Native PICK_ONE can return the preset and the new choice together.
        const selection = result.selections.find(item => item.selector !== preselectedKey)
            ?? result.selections[0];
        if (result.cancelled)
            return { key: 27, count: null };
        if (!selection)
            return { key: 0, count: null };
        return { key: selection.selector.charCodeAt(0), count: selection.count === -1 ? null : selection.count,
            ...(selection.identifier.value === undefined ? {} : { value: selection.identifier.value }) };
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
}
/**
 * Display a blocking disclosure window. Text windows wrap prose and use
 * `--More--`; menu-built overviews retain their rows and use the native
 * menu layout and page controls.
 */
export async function showDisclosureOverlay(lines, { marker = '--More--', restoreUnderlay = false, pagerStyle = 'text', } = {}) {
    const d = display();
    if (!d)
        return 27;
    await displayMessageWindow();
    const entries = lines.map(line => typeof line === 'string' ? { text: line } : line);
    if (pagerStyle === 'menu') {
        return await pageDisclosureWindow(d, entries, { marker, pagerStyle, restoreUnderlay });
    }
    const prose = entries.map(line => ({ ...line, text: compressTextWindowLine(line.text, d.cols) }));
    const dataWidth = prose.reduce((widest, line) => Math.max(widest, line.text.length), 0);
    // putstr-built windows wrap prose but retain their original width
    // when deciding placement.
    const content = prose.flatMap(line => textWindowRows(line.text, d.cols)
        .map(text => ({ ...line, text })));
    // The pinned H2344_BROKEN path permits corners narrower than ten
    // columns. A zero offset, excess height, or disabled overlay uses
    // the full-screen renderer instead.
    const cornerOffset = windowOrigin(d.cols, d.rows, dataWidth + 1, content.length, game.flags.menu_overlay !== false);
    if (content.length >= d.rows || cornerOffset === 0
        || game.flags.menu_overlay === false) {
        return await pageDisclosureWindow(d, content, { marker, pagerStyle, restoreUnderlay });
    }
    const left = cornerOffset + 1;
    const rows = [...content, { text: marker }];
    // Replace the preceding question across the whole message row.
    d.clearRow(0);
    // A dismissed corner window restores the already-painted map rather
    // than recomputing vision. Callers may retain a final page after exit.
    const underlay = restoreUnderlay
        ? d.grid.map(row => row.map(cell => ({ ...cell }))) : null;
    const underlayCursor = restoreUnderlay
        ? { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible } : null;
    clearRect(left - 1, 0, d.cols, Math.min(d.rows, rows.length));
    for (const [row, line] of rows.entries()) {
        if (row >= d.rows)
            break;
        putLine(left, row, line.text, line.attr);
    }
    const markerRow = Math.min(rows.length - 1, d.rows - 1);
    const cursorOffset = marker === '(end)' ? marker.length + 1 : marker.length;
    d.setCursor(Math.min(d.cols - 1, left + cursorOffset), markerRow);
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
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
 * Text windows use the full screen minus a pager row. Menu windows share
 * tty_end_menu()'s margins, corner placement, and 52-entry page limit with
 * inventory windows, including when a tall terminal permits corner paging.
 */
async function pageDisclosureWindow(d, lines, { marker, pagerStyle, restoreUnderlay }) {
    const menu = pagerStyle === 'menu'
        ? menuLayout(lines, d.cols, d.rows, game.flags.menu_overlay !== false) : null;
    const pageSize = menu?.pageSize ?? d.rows - 1;
    const pageCount = menu?.pageCount ?? Math.max(1, Math.ceil(lines.length / pageSize));
    if (menu)
        d.clearRow(0);
    const underlay = menu && menu.boundary > 0 ? snapshotMenuUnderlay() : null;
    const underlayCursor = { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible };
    let page = 0;
    let count = null;
    try {
        for (;;) {
            if (menu) {
                const content = menu.rows.slice(page * pageSize, (page + 1) * pageSize);
                paintMenuPage(d, menu, page, content, underlay);
            }
            else {
                const content = lines.slice(page * pageSize, (page + 1) * pageSize);
                d.clearScreen();
                for (const [row, line] of content.entries()) {
                    putLine(0, row, line.text, line.attr);
                }
                putLine(1, content.length, marker);
                d.setCursor(1 + marker.length, content.length);
            }
            const key = await nhgetch();
            if (pagerStyle === 'menu') {
                // Counts are accepted even by PICK_NONE menus. Escape
                // cancels an active count before it can close the window.
                if (key >= 48 && key <= 57) {
                    const nextCount = (count ?? 0n) * 10n + BigInt(key - 48);
                    count = nextCount > 9223372036854775807n ? null : nextCount || null;
                    continue;
                }
                // xwaitforspace() ignores keys outside the menu response
                // set without returning to the loop that resets counts.
                const letter = String.fromCharCode(key);
                if (!' \x1b\n\r\0><^|.@,\\-~:'.includes(letter))
                    continue;
                const wasCounting = count !== null;
                count = null;
                if (key === 27) {
                    if (wasCounting)
                        continue;
                    return key;
                }
                // process_menu_window(): Return commits on any page;
                // Space advances, or commits on the last page.
                if (key === 0 || key === 10 || key === 13)
                    return key;
                if (key === 32 && page === pageCount - 1)
                    return key;
                if (key === 32 || letter === '>')
                    page = Math.min(page + 1, pageCount - 1);
                else if (letter === '<')
                    page = Math.max(page - 1, 0);
                else if (letter === '^')
                    page = 0;
                else if (letter === '|')
                    page = pageCount - 1;
            }
            else if (key === 27)
                return key;
            else if (key === 32 || key === 10 || key === 13) {
                if (page === pageCount - 1)
                    return key;
                page++;
            }
        }
    }
    finally {
        if (menu && menu.boundary > 0) {
            if (restoreUnderlay) {
                restoreMenuUnderlay(underlay);
                d.setCursor(underlayCursor.col, underlayCursor.row);
                d.cursorVisible = underlayCursor.visible;
            }
        }
        else {
            // erase_menu_or_text(): a full-screen window rebuilds vision
            // and glyphs; saved cells only apply to corner windows.
            await docrt();
            await flush_screen(1);
        }
    }
}
/**
 * Display Lua `nh.text()` output.  Despite its name, that API creates an
 * NHW_MENU/PICK_NONE window in C.  With tty menu_overlay enabled, sparse menu
 * rows are painted over the live map at the computed corner offset.
 */
export async function showTextMenuOverlay(lines) {
    if (!display())
        return 27;
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const line of lines)
            tty_add_menu(window, { identifier: null,
                ...(typeof line === 'string' ? { text: line } : line) });
        tty_end_menu(window);
        return (await tty_select_menu(window, PICK_NONE)).key;
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
}
/**
 * Display a tty choice window, paginating when it exceeds the terminal height.
 * Keyed entries supply descriptions without a selector prefix. Other entries
 * are labels. Callers can also admit control keys through validKeys.
 */
export async function showChoiceWindow({ title, entries, validKeys = null, }) {
    const d = display();
    if (!d)
        return 27;
    // tty_display_nhwindow() acknowledges unread prose before painting a menu.
    await displayMessageWindow();
    const underlayCursor = { col: d.cursorCol, row: d.cursorRow, visible: d.cursorVisible };
    // Clear WIN_MESSAGE even when its display was suppressed by Escape.
    // Save the map after that erasure so dismissal cannot revive old prose.
    clearMessageWindow();
    const underlay = snapshotMenuUnderlay();
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
    // tty_destroy_nhwindow() erases every active menu before its caller
    // opens another window or asks for more input.
    if (underlay) {
        restoreMenuUnderlay(underlay);
        d.setCursor(underlayCursor.col, underlayCursor.row);
        d.cursorVisible = underlayCursor.visible;
    }
    return key;
}
export async function showMultiSelectWindow({ title, sections, omitHeadings = false, introLines = [], blankAfterTitle = true, pageLocalKeys = false, titleAttr = ATR_INVERSE, returnCounts = false, pickOne = false, signalEscape = false, }) {
    if (!display())
        return [];
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        if (title) {
            tty_add_menu(window, { identifier: null, text: title, attr: titleAttr });
            if (blankAfterTitle)
                tty_add_menu(window, { identifier: null, text: '' });
        }
        for (const text of introLines)
            tty_add_menu(window, { identifier: null, text });
        for (const section of sections) {
            if (!section.items.length)
                continue;
            if (!omitHeadings) {
                if (section.heading == null)
                    throw new TypeError('A visible menu section requires a heading');
                tty_add_menu(window, { identifier: null, text: section.heading, attr: ATR_INVERSE });
            }
            for (const item of section.items) {
                if (item.selectable === false) {
                    tty_add_menu(window, { identifier: null, text: item.text,
                        attr: item.attr ?? ATR_NONE, color: item.color ?? NO_COLOR });
                    continue;
                }
                if (!pageLocalKeys && !item.key)
                    throw new TypeError('The menu item requires a selector');
                if (item.separatorBefore)
                    tty_add_menu(window, { identifier: null, text: '--' });
                tty_add_menu(window, { identifier: item, text: item.text,
                    ...(item.key ? { selector: item.key } : {}),
                    ...(item.groupAccelerator ? { group: item.groupAccelerator } : {}), itemflags: item.itemFlags ?? 0 });
            }
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, pickOne ? PICK_ONE : PICK_ANY);
        if (result.cancelled)
            return signalEscape ? null : [];
        return returnCounts ? result.selections.map(selection => ({ value: selection.identifier.value, count: selection.count }))
            : result.selections.map(selection => selection.identifier.value);
    }
    finally {
        await tty_destroy_nhwindow(window);
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
    for (let first = 0; first < Math.max(1, rows.length); first += pageSize) {
        const page = rows.slice(first, first + pageSize);
        while (page.length < pageSize)
            page.push('');
        page.push('--More--');
        pages.push({ lines: page, cursor: [8, pageSize] });
    }
    return showTextPages(pages, { validKeys: [27, 32, 10, 13] });
}
function textWindowRows(text, columns) {
    text = compressTextWindowLine(text, columns);
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
    // tty text rendering truncates an indivisible oversized word; unlike topline
    // messages, its text-window renderer does not wrap at the final column.
    rows.push(text.slice(0, columns - 1));
    return rows;
}
// tty_putstr() compresses long lines before buffering them. It leaves
// indentation alone on short lines and reserves BUFSZ's terminator slot.
function compressTextWindowLine(text, columns) {
    if (text.length < columns && !text.includes('\n'))
        return text;
    const compressed = text.replace(/[ \n]+/g, ' ').replace(/^ /, '').slice(0, BUFSZ - 1);
    return compressed.length === BUFSZ - 1 || compressed.endsWith(' ')
        ? compressed.slice(0, -1) : compressed;
}
/**
 * Display one or more full-screen tty text pages.  Each page has
 * `{ lines, cursor }`; a line is either a string or `{ text, attr }`.
 * Escape closes the window, while any other key advances to the next page.
 */
export async function showTextPages(pages, { validKeys = [27, 32, 10, 13] } = {}) {
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
 * letters select visible entries; space advances and `<` goes back.
 * C refs: tty select_menu() and dungeon.c print_dungeon(TRUE).
 */
export async function showPagedPickOneMenu({ rows, choices }) {
    if (!display())
        return null;
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const entry of rows) {
            const row = typeof entry === 'string' ? { text: entry } : entry;
            const selector = row.text.charAt(0);
            const identifier = choices.get(selector);
            const selectable = identifier !== undefined && row.text.slice(1, 4) === ' - ';
            tty_add_menu(window, { text: selectable ? row.text.slice(4) : row.text,
                identifier: selectable ? identifier : null,
                ...(selectable ? { selector } : {}), attr: row.attr ?? ATR_NONE });
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, PICK_ONE);
        return result.selections[0]?.identifier ?? null;
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
}
//# sourceMappingURL=windows.js.map