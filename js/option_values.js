// Text-entered option values. C refs: options.c:optfn_*(), botl.c:parse_status_hl1().
import { game } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { OBJECT_CLASS_SYMBOLS } from './display.js';
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
// C options.c:optfn_pickup_types(): the object-class letter validation
// loop.
export function optfnPickupTypes(value) {
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