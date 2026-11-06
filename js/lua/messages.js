// C nhlua.c:nhl_pline() and nhl_text().
import { flushPendingTopline } from '../topl.js';
import { plineWithContinuation } from '../pline.js';
import { NethackLuaError } from './errors.js';
import { showTextMenuOverlay } from '../windows.js';
import { luaCheckString } from './runtime.js';
// C nhlua.c:nhl_pline().
export async function luaPline(...args) {
    if (args.length !== 1 && args.length !== 2)
        throw new NethackLuaError('Wrong args');
    await plineWithContinuation(messageString(args[0]));
    if (args[1] != null && args[1] !== false)
        await flushPendingTopline();
}
// C nhlua.c:nhl_text().
export async function luaText(...args) {
    if (!args.length)
        return;
    const text = messageString(args[0]);
    const lines = [];
    // The pinned C reads argument 1 but pops the last argument. Multiple
    // arguments therefore display the first string repeatedly.
    for (let argument = 0; argument < args.length; argument++)
        lines.push(...textMenuLines(text));
    await flushPendingTopline();
    await showTextMenuOverlay(lines);
}
// Part of C nhlua.c:nhl_pline(), nhl_text(): the luaL_checkstring read.
function messageString(value) {
    // nhl_pline() and nhl_text() read their text with luaL_checkstring.
    return luaCheckString(1, value);
}
// Part of C nhlua.c:nhl_text(): the 76-column line split at blanks and
// newlines.
function textMenuLines(text) {
    const lines = [];
    let start = 0;
    do {
        const newline = text.indexOf('\n', start);
        let end = newline >= 0 && newline - start <= 76
            ? newline : Math.min(start + 76, text.length - 1);
        while (end > start && text[end] !== ' ' && text[end] !== '\n')
            end--;
        // nhl_text() replaces the split character with NUL and skips it,
        // including at the end of a string without a trailing newline.
        lines.push(text.slice(start, end));
        start = end + 1;
    } while (start < text.length);
    return lines;
}
//# sourceMappingURL=messages.js.map