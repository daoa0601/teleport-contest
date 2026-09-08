// windows.js — Minimal tty menu and text-window rendering.
// C refs: windows.c, wintty.c, tty.c.
//
// NetHack captures input while menus are visible, so modal windows must
// render into the same 24x80 terminal grid before calling nhgetch().

// This module deliberately contains no session-specific output.  Commands
// provide state-derived lines and this layer handles placement, attributes,
// pagination, cursor position, and input boundaries.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';

export const ATR_NONE = 0;
export const ATR_INVERSE = 1;

function display() {
    return game?.nhDisplay;
}

function putLine(col, row, text, attr = ATR_NONE) {
    const d = display();
    if (!d || row < 0 || row >= d.rows) return;
    for (let i = 0; i < text.length && col + i < d.cols; i++) {
        if (col + i >= 0) d.setCell(col + i, row, text[i], NO_COLOR, attr);
    }
}

function clearRect(left, top, right, bottom) {
    const d = display();
    if (!d) return;
    for (let row = Math.max(0, top); row < Math.min(d.rows, bottom); row++) {
        for (let col = Math.max(0, left); col < Math.min(d.cols, right); col++) {
            d.setCell(col, row, ' ', NO_COLOR, ATR_NONE);
        }
    }
}

export function snapshotMenuUnderlay() {
    const d = display();
    return d?.grid?.map(row => row.map(cell => ({ ...cell }))) || null;
}

export function restoreMenuUnderlay(snapshot) {
    const d = display();
    if (!d || !snapshot) return;
    for (let row = 0; row < Math.min(d.rows, snapshot.length); row++) {
        for (let col = 0; col < Math.min(d.cols, snapshot[row].length); col++) {
            const cell = snapshot[row][col];
            d.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    d.clearRow(0);
}

/**
 * Display the tty inventory menu at the right edge of the map.
 * `sections` is [{ heading, items: ["a - item", ...] }, ...].
 */
export async function showInventoryWindow(sections, {
    selectableKeys = null, loopUntilValid = false,
    headingAttr = ATR_INVERSE,
} = {}) {
    const d = display();
    if (!d) return 27;

    const rows = [];
    for (const section of sections) {
        if (!section?.items?.length) continue;
        rows.push({ text: section.heading, attr: headingAttr });
        for (const text of section.items) rows.push({ text, attr: ATR_NONE });
    }
    // A 23-row menu can still overlay the map and first status row while
    // preserving the final status row.  Only content beyond that becomes a
    // standalone paged tty menu.
    const fullPage = rows.length + 1 > 23;
    const widest = rows.reduce((n, row) => Math.max(n, row.text.length), 0);
    // A menu which displaces the two status rows becomes a full tty page and
    // is laid out from column one.  Shorter menus remain right-aligned over
    // the map with two blank columns at the edge.
    // tty corner menus reserve a 39-column window even when their contents
    // are narrower: 37 content columns plus the two edge/separator columns.
    const left = fullPage ? 1 : Math.max(0, d.cols - Math.max(37, widest) - 2);
    if (fullPage) {
        const pageSize = 23;
        const pageCount = Math.ceil(rows.length / pageSize);
        for (let page = 0; page < pageCount; page++) {
            d.clearScreen();
            const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
            for (let row = 0; row < pageRows.length; row++)
                putLine(left, row, pageRows[row].text, pageRows[row].attr);
            const marker = pageCount > 1
                ? `(${page + 1} of ${pageCount})` : '(end)';
            putLine(left, pageRows.length, marker);
            d.setCursor(left + marker.length + Number(pageCount === 1),
                pageRows.length);
            const key = await nhgetch();
            if (selectableKeys?.includes(String.fromCharCode(key))) return key;
            if (key === 27) return key;
        }
        return 32;
    }

    rows.push({ text: '(end)', attr: ATR_NONE });
    // tty menus reserve a blank separator column immediately to their left.
    clearRect(left - 1, 0, d.cols, Math.min(23, rows.length));
    for (let row = 0; row < rows.length && row < d.rows; row++)
        putLine(left, row, rows[row].text, rows[row].attr);

    const endRow = Math.min(rows.length - 1, d.rows - 1);
    d.setCursor(Math.min(d.cols - 1, left + 6), endRow);
    let key;
    do key = await nhgetch();
    while (loopUntilValid && ![27, 32, 10, 13].includes(key)
        && !selectableKeys?.includes(String.fromCharCode(key)));
    return key;
}

/**
 * Display a blocking tty text/menu window over the right side of the map.
 * NetHack reserves at least 39 columns for these windows; wider content
 * pushes their left edge farther west.  Unlike a choice menu, disclosure
 * windows finish with either `--More--` or `(end)` and accept one dismissal
 * key before returning to their caller.
 */
export async function showDisclosureOverlay(lines, {
    marker = '--More--', minWidth = 38, restoreUnderlay = false,
} = {}) {
    const d = display();
    if (!d) return 27;

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
        ? [d.cursorCol, d.cursorRow, d.cursorVisible] : null;
    clearRect(left - 1, 0, d.cols, Math.min(d.rows, rows.length));
    for (let row = 0; row < rows.length && row < d.rows; row++)
        putLine(left, row, rows[row]);

    const markerRow = Math.min(rows.length - 1, d.rows - 1);
    const cursorOffset = marker === '(end)' ? marker.length + 1 : marker.length;
    d.setCursor(Math.min(d.cols - 1, left + cursorOffset), markerRow);
    const key = await nhgetch();
    if (underlay) {
        for (let row = 0; row < d.rows; row++) {
            for (let col = 0; col < d.cols; col++) {
                const cell = underlay[row][col];
                d.setCell(col, row, cell.ch, cell.color, cell.attr);
            }
        }
        d.setCursor(underlayCursor[0], underlayCursor[1]);
        d.cursorVisible = underlayCursor[2];
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
    if (!d) return 27;

    const rows = lines.map(line => typeof line === 'string'
        ? { text: line, attr: ATR_NONE }
        : { text: line.text || '', attr: line.attr || ATR_NONE });
    const pageSize = d.rows - 1;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const widest = Math.max(5, ...rows.map(row => row.text.length));
    // tty's maxcol includes a leading and trailing margin; process_menu_window
    // writes the content one cell east of offx.
    const maxcol = widest + 2;
    const boundary = pageCount > 1 ? 0 : Math.max(0, Math.min(
        82, Math.floor(d.cols / 2), d.cols - maxcol - 1,
    ));
    d.clearRow(0);
    // tty_select_menu() dismisses a corner NHW_MENU with docorner(), which
    // copies the already-painted map buffer back into the covered rectangle.
    // It does not call docrt() and recompute live glyph precedence.  Preserve
    // that presentation buffer here so a mapped trap, engraving, or other
    // deliberate overlay survives the menu exactly as it does in tty.
    const underlay = d.grid.map(row => row.map(cell => ({ ...cell })));
    const underlayCursor = [d.cursorCol, d.cursorRow, d.cursorVisible];
    let page = 0;
    try {
        for (;;) {
            const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
            if (pageCount > 1) d.clearScreen();
            else clearRect(boundary, 0, d.cols, pageRows.length + 1);
            for (let row = 0; row < pageRows.length; row++)
                putLine(boundary + 1, row, pageRows[row].text, pageRows[row].attr);
            const marker = pageCount > 1 ? `(${page + 1} of ${pageCount})` : '(end)';
            putLine(boundary + 1, pageRows.length, marker);
            d.setCursor(Math.min(d.cols - 1, boundary + marker.length + 2), pageRows.length);

            const key = await nhgetch();
            if ([0, 27, 10, 13].includes(key)) return key;
            if (key === 32 && page === pageCount - 1) return key;
            switch (String.fromCharCode(key)) {
            case ' ':
            case '>': page = Math.min(page + 1, pageCount - 1); break;
            case '<': page = Math.max(0, page - 1); break;
            case '^': page = 0; break;
            case '|': page = pageCount - 1; break;
            }
        }
    } finally {
        for (let row = 0; row < d.rows; row++) {
            for (let col = 0; col < d.cols; col++) {
                const cell = underlay[row][col];
                d.setCell(col, row, cell.ch, cell.color, cell.attr);
            }
        }
        d.setCursor(underlayCursor[0], underlayCursor[1]);
        d.cursorVisible = underlayCursor[2];
    }
}

/**
 * Display a short tty choice window over the right side of the map.
 * `entries` is an array of strings or `{ text, attr }` rows.  The caller
 * owns the command semantics; this layer only preserves the nested input
 * boundary and terminal layout.
 */
export async function showChoiceWindow({
    title, entries, left = null, validKeys = null, restoreUnderlay = false,
}) {
    const d = display();
    if (!d) return 27;

    const underlay = restoreUnderlay
        ? d.grid.map(row => row.map(cell => ({ ...cell }))) : null;
    const underlayCursor = restoreUnderlay
        ? [d.cursorCol, d.cursorRow, d.cursorVisible] : null;

    const rows = [
        // tty menu prompts inherit `menu_headings`; the default is inverse.
        { text: title, attr: ATR_INVERSE },
        { text: '', attr: ATR_NONE },
        ...entries.map(entry => typeof entry === 'string'
            ? { text: entry, attr: ATR_NONE }
            : { text: entry.text || '', attr: entry.attr || ATR_NONE }),
        { text: '(end)', attr: ATR_NONE },
    ];
    const widest = rows.reduce((n, row) => Math.max(n, row.text.length), 0);
    const windowLeft = left ?? Math.max(0, d.cols - widest - 2);
    // tty process_menu_window() reserves and clears the separator cell west
    // of every corner overlay, even when that cell currently contains a map
    // glyph rather than whitespace.
    clearRect(windowLeft - 1, 0, d.cols, Math.min(d.rows, rows.length));
    for (let row = 0; row < rows.length && row < d.rows; row++)
        putLine(windowLeft, row, rows[row].text, rows[row].attr);

    const endRow = Math.min(rows.length - 1, d.rows - 1);
    d.setCursor(Math.min(d.cols - 1, windowLeft + 6), endRow);
    let key;
    do key = await nhgetch();
    while (validKeys && !validKeys.includes(key));
    if (underlay) {
        for (let row = 0; row < d.rows; row++) {
            for (let col = 0; col < d.cols; col++) {
                const cell = underlay[row][col];
                d.setCell(col, row, cell.ch, cell.color, cell.attr);
            }
        }
        d.setCursor(underlayCursor[0], underlayCursor[1]);
        d.cursorVisible = underlayCursor[2];
    }
    return key;
}

/**
 * Display a PICK_ANY tty menu.  Sections contain
 * `{ heading, items: [{ key, text, value }] }`; selected rows are redrawn
 * with `+` and each keypress is returned separately.
 */
export async function showMultiSelectWindow({
    title, sections, left = null, omitHeadings = false, introLines = [],
    blankAfterTitle = true, pageLocalKeys = false,
    titleAttr = ATR_INVERSE, returnCounts = false, pickOne = false,
}) {
    const d = display();
    if (!d) return [];

    const allItems = sections.flatMap(section => section.items || []);
    const selected = new Set();
    const selectedCounts = new Map();
    let page = 0;
    let pendingCount = null;
    const selectionMarker = item => selected.has(item)
        ? selectedCounts.has(item) ? '#' : '+'
        : '-';
    const selectedValues = () => allItems
        .filter(item => selected.has(item))
        .map(item => returnCounts ? {
            value: item.value,
            count: selectedCounts.get(item) ?? -1,
        } : item.value);
    const render = () => {
        const rows = [
            { text: title, attr: titleAttr },
            ...(blankAfterTitle ? [{ text: '', attr: ATR_NONE }] : []),
            ...introLines.map(text => ({ text, attr: ATR_NONE })),
        ];
        const itemRows = [];
        for (const section of sections) {
            if (!section?.items?.length) continue;
            if (!omitHeadings)
                rows.push({ text: section.heading, attr: ATR_INVERSE });
            for (const item of section.items) {
                if (item.separatorBefore)
                    rows.push({ text: '--', attr: ATR_NONE });
                itemRows.push({ row: rows.length, item });
                rows.push({
                    text: `${item.key} ${selectionMarker(item)} ${item.text}`,
                    attr: ATR_NONE,
                    item,
                });
            }
        }
        const widest = rows.reduce((n, row) => Math.max(n, row.text.length), 0);
        const windowLeft = left ?? Math.max(0, d.cols - widest - 2);
        const pageSize = 23;
        const pageCount = Math.ceil(rows.length / pageSize);
        const paged = pageCount > 1;
        const unkeyedPageRows = paged
            ? rows.slice(page * pageSize, (page + 1) * pageSize)
            : rows;
        const pageItems = itemRows
            .filter(entry => Math.trunc(entry.row / pageSize) === page)
            .map(entry => entry.item);
        const localKey = index => index < 26
            ? String.fromCharCode(97 + index)
            : index < 52 ? String.fromCharCode(65 + index - 26)
                : String(index - 51);
        const pageKeys = new Map(pageItems.map((item, index) => [
            item, pageLocalKeys ? localKey(index) : item.key,
        ]));
        const pageRows = unkeyedPageRows.map(row => !row.item ? row : ({
            ...row,
            text: `${pageKeys.get(row.item)} ${
                selectionMarker(row.item)
            } ${row.item.text}`,
        }));
        const marker = paged ? `(${page + 1} of ${pageCount})` : '(end)';
        if (paged) d.clearScreen();
        // process_menu_window() positions at the corner window's first
        // logical column and clears to end-of-line before writing its leading
        // margin.  `windowLeft` is the first text column in this JS view, so
        // the tty boundary includes the separator cell immediately west.
        clearRect(windowLeft - 1, 0, d.cols,
            Math.min(d.rows, pageRows.length + 1));
        for (let row = 0; row < pageRows.length && row < d.rows; row++)
            putLine(windowLeft, row, pageRows[row].text, pageRows[row].attr);
        const markerRow = Math.min(pageRows.length, d.rows - 1);
        putLine(windowLeft, markerRow, marker);
        d.setCursor(Math.min(d.cols - 1,
            windowLeft + marker.length + Number(!paged)), markerRow);
        return {
            pageCount,
            pageItems,
            pageKeys,
        };
    };

    for (;;) {
        const { pageCount, pageItems, pageKeys } = render();
        const key = await nhgetch();
        if (returnCounts && key >= 48 && key <= 57) {
            const digit = key - 48;
            const next = Math.min(
                Number.MAX_SAFE_INTEGER,
                (pendingCount ?? 0) * 10 + digit,
            );
            if (next > 0) pendingCount = next;
            continue;
        }
        if (key === 27) {
            if (pendingCount !== null) {
                pendingCount = null;
                continue;
            }
            return [];
        }
        const count = pendingCount;
        pendingCount = null;
        if (key === 10 || key === 13) {
            return selectedValues();
        }
        const letter = String.fromCharCode(key);
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
            if (pickOne) continue;
            if (selected.size === allItems.length) {
                selected.clear();
                selectedCounts.clear();
            } else {
                for (const candidate of allItems) selected.add(candidate);
                selectedCounts.clear();
            }
            continue;
        }
        if (letter === '.') {
            if (pickOne) continue;
            for (const candidate of pageItems) {
                selected.add(candidate);
                selectedCounts.delete(candidate);
            }
            continue;
        }
        const item = pageLocalKeys
            ? pageItems.find(candidate => pageKeys.get(candidate) === letter)
            : allItems.find(candidate => candidate.key === letter);
        if (!item) continue;
        if (pickOne) {
            return [returnCounts ? {
                value: item.value,
                count: count ?? -1,
            } : item.value];
        }
        if (selected.has(item) && count === null) {
            selected.delete(item);
            selectedCounts.delete(item);
        } else {
            selected.add(item);
            if (count === null) selectedCounts.delete(item);
            else selectedCounts.set(item, count);
        }
    }
}

/**
 * Display one or more full-screen tty text pages.  Each page has
 * `{ lines, cursor }`; a line is either a string or `{ text, attr }`.
 * Escape closes the window, while any other key advances to the next page.
 */
export async function showTextPages(pages, { validKeys = null } = {}) {
    const d = display();
    if (!d) return 27;

    let key = 27;
    for (const page of pages) {
        d.clearScreen();
        for (let row = 0; row < page.lines.length && row < d.rows; row++) {
            const line = page.lines[row];
            if (!line) continue;
            if (typeof line === 'string') putLine(0, row, line);
            else putLine(line.col ?? 0, row, line.text || '',
                line.attr || ATR_NONE);
        }
        const cursor = page.cursor || [0, 0];
        d.setCursor(cursor[0], cursor[1]);
        do {
            key = await nhgetch();
        } while (validKeys && !validKeys.includes(key));
        if (key === 27) break;
    }
    return key;
}

/**
 * Display a full-screen, paged PICK_ONE menu. `rows` contains strings or
 * `{ text, attr }` entries and already includes the title/blank rows. Choice
 * letters can be selected from any page; space advances and `<` goes back.
 * C refs: tty select_menu() and dungeon.c print_dungeon(TRUE).
 */
export async function showPagedPickOneMenu({
    rows, choices, left = 1, returnCancels = false,
}) {
    const d = display();
    if (!d) return null;
    const pageSize = 23;
    const pageCount = Math.ceil(rows.length / pageSize);
    let page = 0;

    for (;;) {
        d.clearScreen();
        const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
        for (let row = 0; row < pageRows.length; row++) {
            const entry = pageRows[row];
            if (typeof entry === 'string') putLine(left, row, entry);
            else putLine(left, row, entry?.text || '', entry?.attr || ATR_NONE);
        }
        const marker = `(${page + 1} of ${pageCount})`;
        putLine(left, pageRows.length, marker);
        d.setCursor(left + marker.length, pageRows.length);

        const key = await nhgetch();
        if (key === 27) return null;
        if (returnCancels && (key === 10 || key === 13)) return null;
        const letter = String.fromCharCode(key);
        if (choices.has(letter)) return choices.get(letter);
        if (letter === '<') page = (page + pageCount - 1) % pageCount;
        else page = (page + 1) % pageCount;
    }
}
