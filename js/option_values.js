// Text-entered option values. C refs: options.c:optfn_*(), botl.c:parse_status_hl1().
import { game } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { OBJECT_CLASS_SYMBOLS } from './display.js';
import { decodeOptionEscapes } from './message_types.js';
import { MONSTER_CLASS_SYMBOLS } from './monster_data.js';
import { WARNCOUNT } from './const.js';
// Part of C options.c:optfn_pile_limit(), optfn_menuinvertmode(),
// optfn_suppress_alert(): echo each option's current value.
export function textOptionValue(name) {
    switch (name) {
        case 'pile_limit': return String(game.flags.pile_limit ?? 5);
        case 'menuinvertmode': return String(game.iflags.menuinvertmode ?? 1);
        case 'suppress_alert': return game.flags.suppress_alert || '(none)';
        default: return null;
    }
}
// Part of C options.c:optfn_boulder(): escapes() decodes the value, then the first
// byte replaces the boulder symbol in both symbol sets. A monster-class or
// warning symbol is refused ("boulder symbol would conflict"); the warning
// test covers '1'..'5' only, so '0' passes. char is signed in the native
// build, so a decoded byte of 128..255 is negative there and is refused as
// a control character together with everything below space.
export function parseBoulderSymbolValue(value) {
    const symbol = decodeOptionEscapes(value).charAt(0);
    const code = symbol.charCodeAt(0);
    const monsterClash = MONSTER_CLASS_SYMBOLS.indexOf(symbol) > 0;
    const warningClash = code >= 49 && code < 48 + WARNCOUNT;
    if (!(code >= 32) || code > 127)
        return { error: 'boulder symbol cannot be a control character' };
    if (monsterClash)
        return { error: `Badoption - boulder symbol '${symbol}' would conflict with a monster symbol` };
    if (warningClash)
        return { error: `Badoption - boulder symbol '${symbol}' would conflict with a warning symbol` };
    return { symbol };
}
// Port only: which options take a typed value in the edit UI.
export function isTextOption(name) {
    return ['packorder', 'pile_limit', 'menuinvertmode', 'hilite_status', 'statuslines',
        'scores', 'suppress_alert', 'statushilites'].includes(name);
}
// Port only: parse an integer like the native atoi used by option handlers.
export function cInteger(value) {
    const prefix = value.match(/^\s*[+-]?\d+/)?.[0];
    return prefix ? Number(prefix) : 0;
}
// Part of C cfgfiles.c:config_erradd(): adds punctuation at the interactive boundary.
export async function optionError(message) {
    await plineWithContinuation(/[.!?]$/.test(message) ? message : `${message}.`);
}
// Part of C options.c:optfn_pickup_types(): the object-class letter
// validation loop.
export function parsePickupTypes(value) {
    value = value.replace(/^ +/, '');
    if (/^[aA]/.test(value))
        return { symbols: '', invalid: false };
    let symbols = '';
    let invalid = false;
    for (const symbol of value) {
        if (!OBJECT_CLASS_SYMBOLS.includes(symbol) || symbols.includes(symbol))
            invalid = true;
        else
            symbols += symbol;
    }
    return { symbols, invalid };
}
//# sourceMappingURL=option_values.js.map