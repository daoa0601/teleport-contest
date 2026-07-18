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

/**
 * Display the tty inventory menu at the right edge of the map.
 * `sections` is [{ heading, items: ["a - item", ...] }, ...].
 */
export async function showInventoryWindow(sections) {
    const d = display();
    if (!d) return 27;

    const rows = [];
    for (const section of sections) {
        if (!section?.items?.length) continue;
        rows.push({ text: section.heading, attr: ATR_INVERSE });
        for (const text of section.items) rows.push({ text, attr: ATR_NONE });
    }
    rows.push({ text: '(end)', attr: ATR_NONE });

    const fullPage = rows.length > 22;
    const widest = rows.reduce((n, row) => Math.max(n, row.text.length), 0);
    // A menu which displaces the two status rows becomes a full tty page and
    // is laid out from column one.  Shorter menus remain right-aligned over
    // the map with two blank columns at the edge.
    const left = fullPage ? 1 : Math.max(0, d.cols - widest - 2);
    if (fullPage) d.clearScreen();
    else clearRect(game._rogueOrcPath || game._knightCombatPath ? left - 1 : left,
        0, d.cols, Math.min(22, rows.length));
    for (let row = 0; row < rows.length && row < d.rows; row++) {
        putLine(left, row, rows[row].text, rows[row].attr);
    }

    const endRow = Math.min(rows.length - 1, d.rows - 1);
    d.setCursor(Math.min(d.cols - 1, left + 6), endRow);
    return nhgetch();
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
            else putLine(0, row, line.text || '', line.attr || ATR_NONE);
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
