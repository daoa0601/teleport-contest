// Native tty menu window ownership (win/tty/wintty.c).
import { BUFSZ, ROWNO, NHW_MENU, PICK_NONE, PICK_ONE, PICK_ANY, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT } from './const.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { bot, clearMessageWindow, docrt, flushPendingTopline, flush_screen } from './display.js';
import { getLine } from './query.js';
import { NO_COLOR } from './terminal.js';
const ATR_NONE = 0;
function display() { return game.nhDisplay; }
function putLine(col, row, text, attr = ATR_NONE) {
    const d = display();
    if (!d)
        return;
    d.putstr(col, row, text, NO_COLOR, attr);
}
function clearRect(left, top, right, bottom) {
    const d = display();
    if (!d)
        return;
    for (let row = top; row < Math.min(d.rows, bottom); row++) {
        for (let col = left; col < Math.min(d.cols, right); col++)
            d.setCell(col, row, ' ', NO_COLOR, 0);
    }
}
// Native tty_end_menu() measures every assembled row, including later pages,
// after assigning selectors. Margins and the largest pager also occupy width.
export function menuLayout(rows, columns, terminalRows) {
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
    // Native retains this bounded prompt; multi-page counters are rebuilt on display.
    const endMarker = '(end) '.slice(0, columns);
    const pager = pageCount > 1 ? `(${pageCount} of ${pageCount}) ` : endMarker;
    const width = clippedRows.reduce((widest, row) => Math.max(widest, row.text.length + 2), Math.min(columns, pager.length));
    const maxRows = (pageCount > 1 ? pageSize : rows.length) + 1;
    return { rows: clippedRows, pageSize, pageCount, maxRows, width, endMarker };
}
// The pinned tty build enables H2344_BROKEN: corner windows occupy at
// most half the terminal and at most 82 columns from its left edge.
export function windowOrigin(columns, rows, maxcol, maxrow, overlay) {
    if (maxrow >= rows || !overlay)
        return 0;
    return Math.max(0, Math.min(82, Math.floor(columns / 2), columns - maxcol - 1));
}
export function menuSelector(index) {
    return String.fromCharCode(index < 26 ? 97 + index : 65 + index - 26);
}
export function selectableMenuText(key, text, marker = '-') {
    return `${key} ${marker} ${text.slice(0, BUFSZ - 1)}`;
}
export function paintMenuPage(d, menu, page, rows, underlay, previousPageLines = 0) {
    const { boundary, maxRows, pageCount } = menu;
    if (boundary === 0)
        d.clearScreen();
    else {
        clearRect(boundary, 0, d.cols, maxRows);
        // A shorter corner page exposes the map again below two blank rows.
        // Keep those cells from the already-painted map, like docorner().
        const firstRestoredRow = Math.min(rows.length + 3, maxRows - 1);
        if (underlay && previousPageLines > rows.length) {
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
        // tty_end_menu retains the row; process_menu_window also clips it to
        // the current terminal width when a retained menu is redisplayed.
        for (let col = 0; col < line.text.length && left + col < d.cols - 1; col++) {
            const attr = col < line.attributeStart ? ATR_NONE : line.attr ?? ATR_NONE;
            const color = col < line.attributeStart ? NO_COLOR : line.color ?? NO_COLOR;
            d.setCell(left + col, row, line.text.charAt(col), color, attr);
        }
    }
    const marker = pageCount > 1 ? `(${page + 1} of ${pageCount})` : menu.endMarker;
    putLine(left, rows.length, marker);
    d.setCursor(left + marker.length, rows.length);
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
export function tty_create_nhwindow(_type) {
    return { entries: [], layout: null, offx: 0, active: false, cancelled: false, destroyed: false, underlay: null };
}
export async function tty_clear_nhwindow(window) {
    requireWindow(window);
    // Native clear erases an active window without dismissing it. A full
    // screen redraw belongs to dismissal, where hallucinations may change.
    if (window.active) {
        if (window.offx === 0)
            display()?.clearScreen();
        else
            await restoreMenuCorner(window);
    }
    window.entries = [];
    window.layout = null;
}
export async function tty_start_menu(window) {
    await tty_clear_nhwindow(window);
}
export function tty_add_menu(window, entry) {
    requireWindow(window);
    window.entries.push({
        text: entry.identifier === null ? entry.text : selectableMenuText(entry.selector || '?', entry.text),
        attr: entry.attr ?? ATR_NONE,
        color: entry.color ?? NO_COLOR,
        identifier: entry.identifier,
        key: entry.selector ?? '',
        group: entry.group ?? '',
        itemflags: entry.itemflags ?? 0,
        selected: !!((entry.itemflags ?? 0) & MENU_ITEMFLAGS_SELECTED),
        count: -1,
    });
    window.layout = null;
}
export function tty_end_menu(window, prompt = null) {
    requireWindow(window);
    if (prompt !== null) {
        const heading = { text: prompt, attr: game.iflags.menu_headings?.attr ?? 1,
            color: game.iflags.menu_headings?.color ?? NO_COLOR,
            identifier: null, key: '', group: '', itemflags: 0, selected: false, count: -1 };
        window.entries.unshift(heading, { ...heading, text: '', attr: ATR_NONE, color: NO_COLOR });
    }
    const d = display();
    if (!d)
        return;
    const pageSize = Math.min(52, d.rows - 1);
    let selector = 0;
    for (const [index, row] of window.entries.entries()) {
        if (index % pageSize === 0)
            selector = 0;
        if (row.identifier !== null && !row.key) {
            row.key = menuSelector(selector++);
            row.text = row.key + row.text.slice(1);
        }
        // Native stores the clipped text, so search sees only the displayed description.
        row.text = row.text.slice(0, d.cols - 2);
    }
    window.layout = menuLayout(window.entries, d.cols, d.rows);
}
export async function tty_display_nhwindow(window, how = PICK_NONE) {
    requireWindow(window);
    if (window.cancelled)
        return { cancelled: true, key: 27, selections: [] };
    const d = display();
    if (!d)
        return { cancelled: true, key: 27, selections: [] };
    if (!window.layout)
        tty_end_menu(window);
    const measured = window.layout;
    if (!measured)
        throw new Error('The menu has no completed layout');
    // tty_end_menu() retains dimensions; tty_display_nhwindow() chooses the
    // origin each time, so redisplay honors the current overlay setting.
    const layout = { ...measured, boundary: windowOrigin(d.cols, d.rows, measured.width, measured.maxRows, game.flags.menu_overlay !== false) };
    // Native message-window display returns immediately while WIN_STOP is set.
    if (!game._suppressMessagesUntilInput)
        await flushPendingTopline();
    clearMessageWindow();
    // An active menu covers the map already; retain its backing cells when
    // displaying it again, rather than saving the menu as its own underlay.
    if (!window.active)
        window.underlay = snapshotMenuUnderlay();
    window.offx = layout.boundary;
    window.active = true;
    const result = await process_menu_window(d, window.entries, layout, how, window.underlay);
    window.cancelled = result.cancelled;
    return result;
}
export async function tty_select_menu(window, how) {
    const previousStatusDisabled = game._statusUpdatesDisabled;
    const restoreStatusUpdates = () => {
        if (previousStatusDisabled === undefined)
            delete game._statusUpdatesDisabled;
        else
            game._statusUpdatesDisabled = previousStatusDisabled;
    };
    game._statusUpdatesDisabled = true;
    try {
        return await tty_display_nhwindow(window, how);
    }
    finally {
        try {
            // C select_menu() restores bot_disabled before the window is
            // destroyed, so a corner menu's docorner() can run bot().
            if (window.offx !== 0)
                restoreStatusUpdates();
            await tty_dismiss_nhwindow(window);
        }
        finally {
            restoreStatusUpdates();
        }
    }
}
export async function tty_dismiss_nhwindow(window) {
    window.cancelled = false;
    if (!window.active)
        return;
    window.active = false;
    if (window.offx === 0) {
        await docrt();
        await flush_screen(1);
    }
    else
        await restoreMenuCorner(window);
    window.underlay = null;
}
async function restoreMenuCorner(window) {
    const d = display();
    if (!d || !window.underlay)
        return;
    // erase_menu_or_text() calls docorner(offx, maxrow + 1, 0).
    // A prior full-screen clear must stay blank outside that rectangle.
    const left = Math.max(0, window.offx - 1);
    const bottom = Math.min(d.rows, (window.layout?.maxRows ?? 0) + 1);
    for (let row = 0; row < bottom; row++) {
        for (let col = left; col < d.cols; col++) {
            const cell = window.underlay[row]?.[col];
            if (cell)
                d.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    d.clearRow(0);
    // docorner() redraws both status lines when the erased area reaches them.
    if (bottom >= Math.min(d.rows - 2, ROWNO + 1))
        await bot();
}
export async function tty_destroy_nhwindow(window) {
    requireWindow(window);
    await tty_dismiss_nhwindow(window);
    await tty_clear_nhwindow(window);
    window.destroyed = true;
}
function requireWindow(window) {
    if (window.destroyed)
        throw new Error('The tty menu window has been destroyed');
}
async function process_menu_window(d, rows, layout, how, underlay) {
    const groups = groupAccelerators(rows, how);
    let page = 0;
    let count = null;
    let repaint = true;
    let previousPageLines = 0;
    const result = (key, cancelled = false) => ({
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
            }), underlay, previousPageLines);
            repaint = false;
        }
        else {
            const footer = layout.pageCount > 1 ? `(${page + 1} of ${layout.pageCount})` : layout.endMarker;
            d.setCursor(layout.boundary + 1 + footer.length, pageRows.length);
        }
        let key = await nhgetch();
        let letter = String.fromCharCode(key);
        // PICK_ONE includes unique group shortcuts among explicit choices,
        // so a digit shortcut selects its group even after a count prefix.
        const explicit = pageRows.some(row => row.key === letter)
            || how === PICK_ONE && groups.has(letter);
        if (!explicit) {
            key = game.commandBindings.menuCommand(key);
            letter = String.fromCharCode(key);
        }
        // xwaitforspace ignores invalid input without resetting a count.
        if (!explicit && !groups.has(letter) && !'0123456789 \x1b\n\r><^|.,@\\-~:'.includes(letter))
            continue;
        if (!explicit && /[0-9]/.test(letter) && (count !== null || !groups.has(letter))) {
            const next = (count ?? 0n) * 10n + BigInt(letter);
            count = next > 9223372036854775807n ? null : next || null;
            continue;
        }
        const selectedCount = count === null ? -1 : Number(count);
        const counting = count !== null;
        count = null;
        if (!explicit && key === 27) {
            if (counting)
                continue;
            for (const row of rows) {
                row.selected = false;
                row.count = -1;
            }
            return result(key, true);
        }
        if (!explicit && (key === 10 || key === 13 || key === 32 && page === layout.pageCount - 1))
            return result(key);
        if (!explicit && ' ><^|'.includes(letter)) {
            const next = letter === '^' ? 0 : letter === '|' ? layout.pageCount - 1
                : letter === '<' ? Math.max(0, page - 1) : Math.min(layout.pageCount - 1, page + 1);
            repaint = next !== page;
            // Native only records the old height for next-page movement.
            // Other page commands retain that value, including zero.
            if (next !== page && (letter === ' ' || letter === '>'))
                previousPageLines = pageRows.length;
            page = next;
            continue;
        }
        const update = (row) => {
            const index = pageRows.indexOf(row);
            if (index >= 0)
                set_item_state(d, layout.boundary, index, row);
        };
        // Native bulk commands precede group shortcuts unless the key is
        // an explicit choice (including unique groups in PICK_ONE).
        if (!explicit && '.@,\\-~'.includes(letter)) {
            if (how !== PICK_ANY && !'-\\'.includes(letter))
                continue;
            const targets = ',\\~'.includes(letter) ? pageRows : rows;
            for (const row of targets) {
                if (row.identifier === null || !allowsBulkChange(row))
                    continue;
                if ('.,'.includes(letter)) {
                    if (row.selected)
                        continue;
                    row.selected = true;
                }
                else if ('-\\'.includes(letter)) {
                    if (!row.selected)
                        continue;
                    row.selected = false;
                }
                else
                    row.selected = !row.selected;
                if (!row.selected)
                    row.count = -1;
                update(row);
            }
            continue;
        }
        if (how !== PICK_NONE && groups.has(letter)) {
            for (const row of rows) {
                if (row.identifier === null || row.group !== letter)
                    continue;
                row.selected = !row.selected;
                row.count = row.selected ? selectedCount : -1;
                update(row);
            }
            if (how === PICK_ONE)
                return result(key);
            continue;
        }
        if (explicit) {
            if (how === PICK_NONE)
                continue;
            const row = pageRows.find(row => row.key === letter);
            if (!row || row.identifier === null)
                continue;
            toggleItem(row, selectedCount);
            update(row);
            if (how === PICK_ONE)
                return result(key);
            continue;
        }
        if (letter === ':' && how !== PICK_NONE) {
            const query = await getLine('Search for:', (_ch, code) => code >= 32 && code !== 127, { inMenu: true });
            if (!query)
                continue;
            for (const row of rows) {
                if (row.identifier === null || !menuSearchMatches(query, row.text))
                    continue;
                toggleItem(row, selectedCount);
                update(row);
                if (how === PICK_ONE)
                    return result(key);
            }
        }
    }
}
function toggleItem(row, count) {
    if (row.selected && count === -1) {
        row.selected = false;
        row.count = -1;
    }
    else {
        row.selected = true;
        if (count > 0)
            row.count = count;
    }
}
function set_item_state(d, boundary, row, item) {
    d.setCell(boundary + 3, row, item.selected ? item.count === -1 ? '+' : '#' : '-', item.color ?? NO_COLOR, item.attr ?? ATR_NONE);
}
function allowsBulkChange(row) {
    if (!(row.itemflags & MENU_ITEMFLAGS_SKIPINVERT))
        return true;
    const mode = game.iflags.menuinvertmode ?? 1;
    return mode === 0 || mode === 1 && row.selected;
}
function groupAccelerators(rows, how) {
    if (how === PICK_NONE)
        return new Set();
    const counts = new Map();
    for (const row of rows) {
        if (row.group && row.group !== row.key)
            counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
    }
    if (counts.size === 0)
        return new Set();
    return new Set(rows.filter(row => row.group && (row.group !== row.key || row.group === '$')
        && (how === PICK_ANY || counts.get(row.group) === 1)).map(row => row.group));
}
function menuSearchMatches(query, text) {
    // strutil.c:pmatchi() uses lowc(), which changes only ASCII A..Z.
    const lowerAscii = (value) => value.replace(/[A-Z]/g, letter => letter.toLowerCase());
    const pattern = [...lowerAscii(query)].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(pattern).test(lowerAscii(text));
}
//# sourceMappingURL=tty_menu.js.map