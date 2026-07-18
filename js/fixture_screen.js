// Shared renderer for bounded tty fixture snapshots.  The snapshots use the
// recorder's ANSI/DEC byte stream; the game display stores the corresponding
// visible cells so frozen/terminal.js can serialize them canonically.

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

export function paintFixtureScreen(serialized, cursor, display) {
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
