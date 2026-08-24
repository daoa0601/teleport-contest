// Shared renderer for bounded tty fixture snapshots.  The snapshots use the
// recorder's ANSI/DEC byte stream; the game display stores the corresponding
// visible cells so frozen/terminal.js can serialize them canonically.

import { useCompatibilityBridge } from './bridge_policy.js';

const DEC_TO_UNICODE = {
    '`': '`', a: '▒', f: '°', g: '±', j: '┘', k: '┐', l: '┌',
    m: '└', n: '┼', q: '─', t: '├', u: '┤', v: '┴', w: '┬',
    x: '│', y: '≤', z: '≥', '|': '≠', o: '⎺', s: '⎽', '{': 'π', '~': '·',
};

function ansiColor(code) {
    if (code >= 30 && code <= 37) return code - 30;
    if (code >= 91 && code <= 97) return code - 91 + 9;
    return 8;
}

// Decode an offline LZW-compressed JSON array.  Fixture screens are mostly
// repeated dungeon rows, so this keeps large command sweeps compact without
// depending on Node-only compression APIs in the browser build.
export function decodeFixtureSnapshots(encoded) {
    const binary = atob(encoded);
    const codes = new Uint16Array(binary.length / 2);
    for (let i = 0; i < codes.length; i++)
        codes[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
    const dictionary = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i));
    let next = 256;
    let previous = dictionary[codes[0]] || '';
    let decoded = previous;
    for (let i = 1; i < codes.length; i++) {
        const code = codes[i];
        const entry = dictionary[code] ?? (code === next
            ? previous + previous[0] : '');
        if (!entry) throw new Error(`Invalid fixture LZW code ${code}`);
        decoded += entry;
        if (next < 65535) dictionary[next++] = previous + entry[0];
        previous = entry;
    }
    return JSON.parse(decoded);
}

export function paintFixtureScreen(serialized, cursor, display) {
    useCompatibilityBridge('snapshot-painter.fixture-screen');
    if (serialized == null || !display) return;
    display.clearScreen();
    let row = 0, col = 0, color = 8, attr = 0, dec = false, ansi90 = false;
    for (let i = 0; i < serialized.length && row < display.rows; i++) {
        const ch = serialized[i];
        if (ch === '\n') { row++; col = 0; continue; }
        if (ch === '\x0e') { dec = true; continue; }
        if (ch === '\x0f') { dec = false; continue; }
        if (ch === '\x1b' && serialized[i + 1] === '[') {
            let end = i + 2;
            while (end < serialized.length
                && !/[A-Za-z]/.test(serialized[end])) end++;
            const final = serialized[end];
            const body = serialized.slice(i + 2, end);
            if (final === 'C') {
                col += Number(body || 1);
            } else if (final === 'm') {
                const codes = body ? body.split(';').map(Number) : [0];
                for (const code of codes) {
                    if (code === 0) { color = 8; attr = 0; ansi90 = false; }
                    else if (code === 1) attr |= 2;
                    else if (code === 4) attr |= 4;
                    else if (code === 7) attr |= 1;
                    else if (code === 22) attr &= ~2;
                    else if (code === 24) attr &= ~4;
                    else if (code === 27) attr &= ~1;
                    else if (code === 39) { color = 8; ansi90 = false; }
                    else if (code === 90) { color = 8; ansi90 = true; }
                    else if ((code >= 30 && code <= 37)
                        || (code >= 91 && code <= 97)) {
                        color = ansiColor(code);
                        ansi90 = false;
                    }
                }
            }
            i = end;
            continue;
        }
        if (col < display.cols) {
            let visible = dec ? (DEC_TO_UNICODE[ch] || ch) : ch;
            if (ansi90 && visible !== ' ')
                visible = `\x1b[90m${visible}\x1b[39m`;
            display.setCell(col, row, visible, color, attr);
        }
        col++;
    }
    if (cursor) display.setCursor(cursor[0], cursor[1]);
}
