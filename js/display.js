// display.js — Map rendering and terminal output.
// C ref: display.c — newsym, show_glyph, docrt, cls, flush_screen.

import { game } from './gstate.js';
import { cansee } from './vision.js';
import {
    COLNO, ROWNO, STONE, ROOM, CORR, SDOOR, DOOR, STAIRS,
    HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED,
} from './const.js';
import {
    NO_COLOR, CLR_GRAY, CLR_BROWN, CLR_CYAN, CLR_WHITE, CLR_YELLOW,
    DEC_TO_UNICODE,
} from './terminal.js';
import { LARGE_BOX, CHEST, GOLD_PIECE } from './object_data.js';

const OBJECT_SYMBOLS = ['', ']', ')', '[', '=', '"', '(', '%', '!', '?',
    '+', '/', '$', '*', '`', '0', '_', '.'];

function objectColor(object) {
    if (Number.isInteger(object?.color)) return object.color;
    if (object?.otyp === LARGE_BOX || object?.otyp === CHEST) return CLR_BROWN;
    if (object?.otyp === GOLD_PIECE) return CLR_YELLOW;
    // Most ordinary weapons use HI_METAL in objects.h.  Other object classes
    // remain neutral until their generated color metadata is ported.
    return object?.oclass === 2 ? CLR_CYAN : CLR_GRAY;
}

// ── ANSI color codes ──
// Maps CLR_* constants (0-15) to ANSI SGR color codes.
// C ref: wintty.c term_start_color
const ANSI_DEFAULT = 39;
const ANSI_COLOR = [
    30,  // CLR_BLACK     0
    31,  // CLR_RED       1
    32,  // CLR_GREEN     2
    33,  // CLR_BROWN     3
    34,  // CLR_BLUE      4
    35,  // CLR_MAGENTA   5
    36,  // CLR_CYAN      6
    37,  // CLR_GRAY      7
    39,  // NO_COLOR      8 → default
    91,  // CLR_ORANGE    9
    92,  // CLR_BRIGHT_GREEN  10
    93,  // CLR_YELLOW    11
    94,  // CLR_BRIGHT_BLUE   12
    95,  // CLR_BRIGHT_MAGENTA 13
    96,  // CLR_BRIGHT_CYAN   14
    97,  // CLR_WHITE     15
];

// ── Terrain to display character + color + DEC flag ──
function terrain_glyph(loc, x, y) {
    const typ = loc.typ;
    const dec = /^DECgraphics$/i.test(game.symset || '');
    switch (typ) {
    case STONE:     return { ch: ' ', color: NO_COLOR, dec: false };
    case ROOM:      return dec
        ? { ch: '~', color: NO_COLOR, dec: true }
        : { ch: '.', color: NO_COLOR, dec: false };
    case CORR:      return { ch: '#', color: NO_COLOR, dec: false };
    case SDOOR:
        if (!dec) return loc.horizontal
            ? { ch: '-', color: NO_COLOR, dec: false }
            : { ch: '|', color: NO_COLOR, dec: false };
        return loc.horizontal
            ? { ch: 'q', color: NO_COLOR, dec: true }
            : { ch: 'x', color: NO_COLOR, dec: true };
    case DOOR:
        if (loc.doormask & D_ISOPEN)
            return dec
                ? { ch: 'a', color: CLR_BROWN, dec: true }
                : { ch: '-', color: CLR_BROWN, dec: false };
        if (loc.doormask & (D_CLOSED | D_LOCKED))
            return { ch: '+', color: CLR_BROWN, dec: false };
        return dec
            ? { ch: '~', color: NO_COLOR, dec: true }
            : { ch: '.', color: NO_COLOR, dec: false };  // D_NODOOR = floor
    case STAIRS:
        // Check upstair vs downstair
        if (game.level?.upstair?.x === x && game.level?.upstair?.y === y)
            return { ch: '<', color: CLR_YELLOW, dec: false };
        return { ch: '>', color: CLR_YELLOW, dec: false };
    // Wall types → DEC line-drawing characters
    case HWALL:     return dec ? { ch: 'q', color: NO_COLOR, dec: true } : { ch: '-', color: NO_COLOR, dec: false };
    case VWALL:     return dec ? { ch: 'x', color: NO_COLOR, dec: true } : { ch: '|', color: NO_COLOR, dec: false };
    case TLCORNER:
    case TRCORNER:
    case BLCORNER:
    case BRCORNER:  return dec ? { ch: ({ [TLCORNER]: 'l', [TRCORNER]: 'k', [BLCORNER]: 'm', [BRCORNER]: 'j' })[typ], color: NO_COLOR, dec: true } : { ch: '-', color: NO_COLOR, dec: false };
    case CROSSWALL:
    case TUWALL:
    case TDWALL:
    case TLWALL:
    case TRWALL:    return dec ? { ch: ({ [CROSSWALL]: 'n', [TUWALL]: 'v', [TDWALL]: 'w', [TLWALL]: 'u', [TRWALL]: 't' })[typ], color: NO_COLOR, dec: true } : { ch: '|', color: NO_COLOR, dec: false };
    default:        return { ch: '?', color: NO_COLOR, dec: false };
    }
}

// ── show_glyph_cell ──
export function show_glyph_cell(x, y, ch, color = NO_COLOR, decgfx = false, attr = 0) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    loc.disp_ch = ch;
    loc.disp_color = color;
    loc.disp_decgfx = !!decgfx;
    loc.disp_attr = attr | 0;
    loc.gnew = 1;
}

// ── newsym ──
export function newsym(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return;

    if (game.u?.ux === x && game.u?.uy === y) {
        // Hero
        show_glyph_cell(x, y, '@', CLR_WHITE, false);
        const tg = terrain_glyph(loc, x, y);
        loc.remembered_glyph = { ch: tg.ch, color: tg.color, decgfx: tg.dec };
        return;
    }

    const monster = game.level?.monsters?.find(mon => mon.mx === x && mon.my === y);
    if (monster && cansee(x, y)) {
        show_glyph_cell(x, y, monster.symbol || '?',
            monster.pet ? CLR_WHITE : (monster.color ?? CLR_GRAY), false);
        return;
    }

    const object = game.level?.objects?.[x]?.[y]?.[0];
    if (object && cansee(x, y)) {
        const glyph = {
            ch: OBJECT_SYMBOLS[object.oclass] || '?',
            color: objectColor(object), decgfx: false,
        };
        show_glyph_cell(x, y, glyph.ch, glyph.color, false);
        if (game.level?.flags?.hero_memory) loc.remembered_glyph = glyph;
        return;
    }

    const tg = terrain_glyph(loc, x, y);
    // Only update display/memory if cell is IN_SIGHT (lit and visible)
    if (cansee(x, y)) {
        show_glyph_cell(x, y, tg.ch, tg.color, tg.dec);
        if (game.level?.flags?.hero_memory) {
            loc.remembered_glyph = { ch: tg.ch, color: tg.color, decgfx: tg.dec };
        }
    } else if (loc.remembered_glyph) {
        // Out of sight but remembered — show remembered glyph
        show_glyph_cell(x, y, loc.remembered_glyph.ch,
            loc.remembered_glyph.color, loc.remembered_glyph.decgfx);
    }
}

// ── docrt ──
export async function docrt() {
    if (!game.level) return;
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level.at(x, y);
            if (loc?.remembered_glyph) {
                show_glyph_cell(x, y, loc.remembered_glyph.ch,
                    loc.remembered_glyph.color, loc.remembered_glyph.decgfx);
            }
        }
    if (game.u?.ux > 0) show_glyph_cell(game.u.ux, game.u.uy, '@', CLR_WHITE, false);
}

// ── Serialize a map row with DEC line-drawing and ANSI colors ──
function render_map_row(y) {
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

// ── Status lines ──
export function _statusLine1() {
    const u = game.u;
    if (!u) return '';
    const name = game.displayName || game.plname || 'Hero';
    const role = game.urole?.rank?.m || game.urole?.name?.m || 'Adventurer';
    const title = `${name} the ${role}`;
    const stats = `St:${u.acurr?.a?.[0] || '?'} Dx:${u.acurr?.a?.[1] || '?'} Co:${u.acurr?.a?.[2] || '?'} In:${u.acurr?.a?.[3] || '?'} Wi:${u.acurr?.a?.[4] || '?'} Ch:${u.acurr?.a?.[5] || '?'}`;
    const align = u.ualign?.type === 0 ? 'Neutral' : u.ualign?.type > 0 ? 'Lawful' : 'Chaotic';
    // C uses cursor-forward for gap between title and stats
    // C pads to align stats starting at a fixed column
    const gap = Math.max(1, 31 - title.length);
    if (gap > 4) return `${title}\x1b[${gap}C${stats} ${align}`;
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}

export function _statusLine2() {
    const u = game.u;
    if (!u) return '';
    let line = `Dlvl:${u.uz?.dlevel || 1} $:${game._goldCount || 0} HP:${u.uhp || 0}(${u.uhpmax || 0}) Pw:${u.uen || 0}(${u.uenmax || 0}) AC:${u.uac ?? 10} Xp:${u.ulevel || 1}`;
    if (game.flags?.showexp) line += `/${u.uexp || 0}`;
    if (game.flags?.time) line += ` T:${game.moves || 1}`;
    return line;
}

// ── Serialize terminal grid for screen comparison ──
export function serialize_terminal_grid(display) {
    let output = '';
    let lastRow = 0;
    for (let r = 0; r < display.rows; r++) {
        for (let c = 0; c < display.cols; c++) {
            if (display.grid[r][c].ch !== ' ') { lastRow = r; break; }
        }
    }
    for (let r = 0; r <= lastRow; r++) {
        let lastCol = -1;
        for (let c = display.cols - 1; c >= 0; c--) {
            if (display.grid[r][c].ch !== ' ') { lastCol = c; break; }
        }
        if (lastCol < 0) { if (r < lastRow) output += '\n'; continue; }
        let firstCol = 0;
        for (let c = 0; c <= lastCol; c++) {
            if (display.grid[r][c].ch !== ' ') { firstCol = c; break; }
        }
        if (firstCol > 4) output += `\x1b[${firstCol}C`;
        else if (firstCol > 0) output += ' '.repeat(firstCol);
        for (let c = firstCol; c <= lastCol; c++) output += display.grid[r][c].ch;
        if (r < lastRow) output += '\n';
    }
    return output;
}

// ── Build screen output ──
function _buildScreenOutput() {
    const display = game?.nhDisplay;
    if (!display) return;

    let output = '';
    // Row 0: message
    output += (game._pending_message || '') + '\n';

    // Rows 1-21: map (rendered with DEC + ANSI, per-row SO/SI)
    for (let y = 0; y < ROWNO; y++) {
        output += render_map_row(y) + '\n';
    }

    // Row 22-23: status
    output += _statusLine1() + '\n';
    output += _statusLine2();

    game._screen_output = output;

    // Also write to grid for serialize_terminal_grid
    if (display.grid) {
        display.clearScreen();
        // Message line
        const msg = game._pending_message || '';
        for (let c = 0; c < Math.min(msg.length, display.cols); c++)
            display.setCell(c, 0, msg[c], NO_COLOR, 0);
        // Map — write characters to grid (DEC → Unicode for browser display)
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const loc = game.level?.at(x, y);
                if (!loc?.disp_ch || loc.disp_ch === ' ') continue;
                const ch = loc.disp_decgfx ? (DEC_TO_UNICODE[loc.disp_ch] || loc.disp_ch) : loc.disp_ch;
                display.setCell(x - 1, y + 1, ch, loc.disp_color ?? NO_COLOR, loc.disp_attr ?? 0);
            }
        }
        // Status lines
        const s1 = _statusLine1().replace(/\x1b\[[0-9;]*[A-Za-z]/g, m =>
            m.match(/\x1b\[\d+C/) ? ' '.repeat(parseInt(m.slice(2))) : '');
        for (let c = 0; c < Math.min(s1.length, display.cols); c++)
            display.setCell(c, 22, s1[c], NO_COLOR, 0);
        const s2 = _statusLine2();
        for (let c = 0; c < Math.min(s2.length, display.cols); c++)
            display.setCell(c, 23, s2[c], NO_COLOR, 0);
        // Cursor at hero
        if (game.u?.ux > 0)
            display.setCursor(game.u.ux - 1, game.u.uy + 1);
    }
}

// ── flush_screen ──
export async function flush_screen(mode) {
    _buildScreenOutput();
}

// ── cls ──
export async function cls() {
    const display = game?.nhDisplay;
    if (display?.clearScreen) display.clearScreen();
    game._pending_message = '';
}

// ── bot ──
export async function bot() {
    // Status line updates happen in _buildScreenOutput
}

// ── pline ──
export async function pline(msg) {
    game._pending_message = msg;
}
