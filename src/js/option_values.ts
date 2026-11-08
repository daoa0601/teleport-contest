// Text-entered option values. C refs: options.c:optfn_*() value echo and
// parsing helpers, botl.c:parse_status_hl1().
import { game } from './gstate.js';
import { plineWithContinuation } from './pline.js';

// Part of C options.c:optfn_pile_limit(), optfn_menuinvertmode(),
// optfn_suppress_alert(): echo each option's current value.
export function textOptionValue(name: string): string | null {
    switch (name) {
    case 'pile_limit': return String(game.flags.pile_limit ?? 5);
    case 'menuinvertmode': return String(game.iflags.menuinvertmode ?? 1);
    case 'suppress_alert': return game.flags.suppress_alert || '(none)';
    default: return null;
    }
}


// Port only: which options take a typed value in the edit UI.
export function isTextOption(name: string): boolean {
    return ['packorder', 'pile_limit', 'menuinvertmode', 'hilite_status', 'statuslines',
        'scores', 'suppress_alert', 'statushilites'].includes(name);
}



// Port only: parse an integer like the native atoi used by option handlers.
export function cInteger(value: string): number {
    const prefix = value.match(/^\s*[+-]?\d+/)?.[0];
    return prefix ? Number(prefix) : 0;
}

// Part of C cfgfiles.c:config_erradd(): adds punctuation at the interactive boundary.
export async function optionError(message: string): Promise<void> {
    await plineWithContinuation(/[.!?]$/.test(message) ? message : `${message}.`);
}

