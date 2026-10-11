// C nhlua.c:nhl_pline() and nhl_text().

import { flushPendingTopline, plineWithContinuation } from '../display.js';
import { showTextMenuOverlay } from '../windows.js';
import type { LuaValue } from './runtime.js';

export async function luaPline(...args: LuaValue[]) {
    if (args.length !== 1 && args.length !== 2)
        throw new TypeError('nh.pline expects a message and an optional wait flag');
    await plineWithContinuation(messageString(args[0]));
    if (args[1] != null && args[1] !== false) await flushPendingTopline();
}

export async function luaText(...args: LuaValue[]) {
    if (!args.length) return;
    const text = messageString(args[0]);
    const lines: string[] = [];
    // The pinned C reads argument 1 but pops the last argument. Multiple
    // arguments therefore display the first string repeatedly.
    for (let argument = 0; argument < args.length; argument++)
        lines.push(...textMenuLines(text));
    await flushPendingTopline();
    await showTextMenuOverlay(lines);
}

function messageString(value: LuaValue | undefined): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    throw new TypeError('Lua message text must be a string or number');
}

function textMenuLines(text: string): string[] {
    const lines: string[] = [];
    let start = 0;
    do {
        const newline = text.indexOf('\n', start);
        let end = newline >= 0 && newline - start <= 76
            ? newline : Math.min(start + 76, text.length - 1);
        while (end > start && text[end] !== ' ' && text[end] !== '\n') end--;
        // nhl_text() replaces the split character with NUL and skips it,
        // including at the end of a string without a trailing newline.
        lines.push(text.slice(start, end));
        start = end + 1;
    } while (start < text.length);
    return lines;
}
