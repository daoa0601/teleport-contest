// options.c:warning_opts()/assign_warnings(); drawing.c:def_warnsyms.
import { def_warnsyms } from './const.js';
import { game } from './gstate.js';
import { decodeOptionEscapes } from './option_escapes.js';
export function setWarningSymbols(value, flags) {
    const decoded = decodeOptionEscapes(value).split('\0', 1)[0] ?? '';
    const previous = flags.warningSymbols;
    flags.warningSymbols = def_warnsyms.map((warning, index) => decoded.charAt(index)
        || previous?.charAt(index) || warning.ch).join('');
}
// C cfgfiles.c:cnf_line_WARNINGS() → get_uchars() + assign_warnings().
// Numeric statements set each level whose parsed value is nonzero; explicit
// zeros and unparsed trailing entries leave the previous symbol in place.
export function assignWarningSymbols(values, flags) {
    const previous = flags.warningSymbols;
    flags.warningSymbols = def_warnsyms.map((warning, index) => values[index] ? String.fromCharCode(values[index] & 0xFF)
        : previous?.charAt(index) || warning.ch).join('');
}
export function warningSymbols() {
    return def_warnsyms.map((warning, index) => ({ ...warning,
        ch: game.iflags.warningSymbols?.charAt(index) || warning.ch,
    }));
}
//# sourceMappingURL=warning_symbols.js.map