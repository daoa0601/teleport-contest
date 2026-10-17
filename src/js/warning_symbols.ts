// options.c:warning_opts()/assign_warnings(); drawing.c:def_warnsyms.
import { def_warnsyms } from './const.js';
import { game } from './gstate.js';
import type { InterfaceFlags } from './flags.js';
import { decodeOptionEscapes } from './option_escapes.js';

export function setWarningSymbols(value: string, flags: InterfaceFlags): void {
    const decoded = decodeOptionEscapes(value).split('\0', 1)[0] ?? '';
    const previous = flags.warningSymbols;
    flags.warningSymbols = def_warnsyms.map((warning, index) => decoded.charAt(index)
        || previous?.charAt(index) || warning.ch).join('');
}

export function warningSymbols() {
    return def_warnsyms.map((warning, index) => ({ ...warning,
        ch: game.iflags.warningSymbols?.charAt(index) || warning.ch,
    }));
}
