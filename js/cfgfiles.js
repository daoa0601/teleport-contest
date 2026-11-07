// cfgfiles.ts — .nethackrc statement parsing and config error reporting.
// C ref: cfgfiles.c — get_uchars(), choose_random_part(), the section
// handlers, find_optparam(), the cnf_line_*() statement handlers and their
// config_line_stmt[] table (parse_config_line()), the config_error_*()
// reporting frames, parse_conf_buf(), parse_conf_str()/parse_conf_file()
// and rcfile(). Statement handlers call into options.ts (C options.c:
// parseoptions(), parsebindings(), add_autopickup_exception()), keeping
// C's cfgfiles.c → options.c call direction.
import { bindingFields, bindingKeyCode, menuCommandKeyError, parseAutopickupException, parseOptions, visctrl, MENU_KEY_OPTIONS, } from './options.js';
import { mungSpaces } from './hacklib.js';
import { parseMenuColoring } from './coloratt.js';
import { parseAutocomplete, resetCommandAutocomplete } from './cmd.js';
import { addMessageTypeRule } from './message_types.js';
import { parseStatusHl1, replayStatusHiliteOperations } from './botl.js';
import { str2role } from './role.js';
import { game } from './gstate.js';
import { CommandBindings } from './command_bindings.js';
import { C_ATR_INVERSE } from './color_attr.js';
import { cutConfigBytes } from './coloratt.js';
import { rawPrintf, truncatePlineMessage } from './pline.js';
import { rawPrint } from './input.js';
import { getret } from './wintty.js';
import { rn2 } from './rng.js';
import { BUFSZ, PL_NSIZ, PL_PSIZ, WARNCOUNT, def_warnsyms, PARANOID_PRAY, PARANOID_SWIM, PARANOID_TRAP, } from './const.js';
// C cfgfiles.c:config_erradd() and config_error_done(): the collected form
// of one config_error_init() frame. Each error echoes its source line once
// (the first error on that line), is prefixed "Line %d: " and " * ", gains
// punctuation, and the frame closes with "%d errors in %s." and a wait.
// Startup parses options before init_nhwindows(), so pline() uses
// raw_print; vpline()'s BUFSZ-1 byte truncate shortens even early
// raw_print() output while retaining its last three bytes. Each source ends
// with wait_synch()/getret(), before asking for a hero name or creating the
// game windows. It does not use the gameplay message pager. Keep earlier
// sources visible until the caller leaves configuration startup.
export async function displayConfigurationErrors(reports) {
    // getret() writes its prompt to the terminal; nothing to do without one.
    if (!game.nhDisplay)
        return;
    for (const report of reports) {
        let previousLine = null;
        for (const error of report.errors) {
            if (error.raw) {
                rawPrintf(error.message);
                if (error.pause !== false)
                    await getret();
                continue;
            }
            if (error.lineNumber !== previousLine)
                rawPrint(truncatePlineMessage(`\n${error.sourceLine}`));
            previousLine = error.lineNumber;
            const line = error.lineNumber > 0 ? `Line ${error.lineNumber}: ` : '';
            const punctuation = /[.!?]$/.test(error.message) ? '' : '.';
            rawPrint(truncatePlineMessage(` * ${line}${error.message}${punctuation}`));
        }
        const count = report.errors.filter(error => !error.raw).length;
        // C config_error_done() prints its summary (and waits) only when at
        // least one config_error_add() fired; raw diagnostics never count.
        if (!count)
            continue;
        rawPrint(truncatePlineMessage(`\n${count} error${count === 1 ? '' : 's'} in ${report.source}.\n`));
        await getret();
    }
}
// C cfgfiles.c:get_uchars(). Zeros are stored unless the list is being
// modified in place, but every parsed number still counts toward the
// `size` limit; parsing stops at the first character that is neither a
// digit nor whitespace, or once `size` numbers were read.
function parseUcharList(bytes, size, modifyInPlace) {
    const values = [];
    let count = 0;
    let number = 0;
    let haveNumber = false;
    let index = 0;
    for (;;) {
        const byte = bytes[index];
        if (byte === 32 || byte === 9 || byte === 10 || byte === undefined) {
            if (haveNumber) {
                if (number !== 0 || !modifyInPlace)
                    values.push(number & 0xFF);
                count++;
                number = 0;
                haveNumber = false;
            }
            if (count === size || byte === undefined)
                return { values, syntaxError: false };
            index++;
        }
        else if (byte >= 48 && byte <= 57) {
            haveNumber = true;
            // C accumulates into an unsigned int and wraps at 2^32.
            number = (number * 10 + (byte - 48)) >>> 0;
            index++;
        }
        else {
            return { values, syntaxError: true };
        }
    }
}
// C cfgfiles.c:choose_random_part(): consumes one core rn2() for the choice,
// then extracts the chosen part verbatim; an empty part selects nothing.
function chooseRandomPart(value) {
    let parts = 1;
    for (const character of value)
        if (character === ',')
            parts++;
    let remaining = rn2(parts);
    let index = 0;
    while (remaining > 0 && index < value.length) {
        index++;
        if (value[index] === ',')
            remaining--;
    }
    if (index >= value.length)
        return null;
    if (value[index] === ',')
        index++;
    let end = index;
    while (end < value.length && value[end] !== ',')
        end++;
    return end > index ? value.slice(index, end) : null;
}
// C cfgfiles.c:is_config_section(): "[name]" optionally followed by spaces
// and a '#comment'. Returns undefined when the line is not a section header.
function configSectionName(statement) {
    const trimmed = statement.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (!trimmed.startsWith('['))
        return undefined;
    const close = trimmed.indexOf(']');
    if (close < 0)
        return undefined;
    let tail = close + 1;
    while (trimmed[tail] === ' ')
        tail++;
    if (tail < trimmed.length && trimmed[tail] !== '#')
        return undefined;
    return trimmed.slice(1, close).replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
}
// C cfgfiles.c:handle_config_section(): consumes a "[name]" section header
// (frees the current section before checking anything else, ends the
// sections at "[]", and reports a header seen before any CHOOSE), and drops
// statements that belong to a section other than the chosen one. Returns
// true when the statement is consumed instead of dispatched.
function handleConfigSection(statement, sections, report, sourceLine, lineNumber) {
    const section = configSectionName(statement);
    if (section !== undefined) {
        // C frees config_section_current before checking whether a
        // choice exists, so every header leaves the current section
        // unset until a named one is entered.
        sections.current = null;
        if (sections.chosen === null) {
            report.errors.push({ sourceLine, lineNumber,
                message: cutConfigBytes(`Section "[${section}]" without CHOOSE`, BUFSZ - 1) });
        }
        else if (section) {
            sections.current = section;
        }
        else {
            // free_config_sections(): an empty section name ends them.
            sections.chosen = null;
        }
        return true;
    }
    return sections.current !== null && sections.current !== sections.chosen;
}
// C cfgfiles.c:find_optparam(): the first '=' or ':' in the statement.
function findOptparam(bytes) {
    return bytes.findIndex(byte => byte === 58 || byte === 61);
}
// C cfgfiles.c:cnf_line_OPTIONS() and its sibling cnf_line_*() handlers:
// one case per config_line_stmt[] row. Statements with no effect in this
// port are accepted silently, as C's handlers do on this platform.
function handleConfigStatement(statement, valueBytes, valueText, result, addError, addRawError) {
    switch (statement) {
        // Accepted by the C table without effect in this port: path prefixes
        // are ignored on this platform, WIZKIT names a file this runtime cannot
        // supply, and SYMBOLS/ROGUESYMBOLS validation needs the symbol-name
        // tables, which are missing — their bad-value diagnostics remain
        // unported.
        case 'HACKDIR':
        case 'LEVELDIR':
        case 'LEVELS':
        case 'SAVEDIR':
        case 'BONESDIR':
        case 'DATADIR':
        case 'SCOREDIR':
        case 'LOCKDIR':
        case 'CONFIGDIR':
        case 'TROUBLEDIR':
        case 'ROGUESYMBOLS':
        case 'SYMBOLS':
        case 'WIZKIT':
        case 'QT_TILEWIDTH':
        case 'QT_TILEHEIGHT':
        case 'QT_FONTSIZE':
        case 'QT_COMPACT':
            break;
        case 'HILITE_STATUS': {
            const operations = [];
            parseStatusHl1(valueText, addError, true, operations);
            replayStatusHiliteOperations(operations, result.iflags);
            break;
        }
        case 'MENUCOLOR': {
            const rule = parseMenuColoring(valueText, addError);
            if (rule) {
                result.flags.menucolors = true;
                (result.iflags.menuColorings ??= []).unshift(rule);
            }
            break;
        }
        case 'OPTIONS':
            // cnf_line_OPTIONS() → parseoptions(); parseConfigLine() handles
            // OPTIONS itself and never dispatches it here.
            break;
        case 'BINDINGS':
            // options.c:parsebindings(): each field is "key:command"; an
            // unparseable key or unknown command is reported, a menu-command
            // key must pass illegal_menu_cmd_key() (whose own diagnostic
            // precedes parsebindings()'s "Bad menu key"), and bind_key()
            // reports its parameter complaints while accepting the binding.
            for (const field of bindingFields(valueText)) {
                const separator = field.indexOf(':');
                if (separator < 0)
                    continue;
                const keyText = field.slice(0, separator);
                const command = field.slice(separator + 1).trim();
                if (keyText === 'mouse1' || keyText === 'mouse2') {
                    if (result.commandBindings.bindMouseButton(keyText === 'mouse1' ? 1 : 2, command))
                        continue;
                    addError(`Error binding mouse button ${keyText === 'mouse1' ? 1 : 2}`);
                }
                const code = bindingKeyCode(keyText);
                if (!code) {
                    addError(`Unknown key binding key '${keyText}'`);
                    continue;
                }
                if (result.commandBindings.bindSpecialKey(code, command))
                    continue;
                if (MENU_KEY_OPTIONS[command] === true) {
                    const illegal = menuCommandKeyError(code);
                    if (illegal) {
                        addError(illegal);
                        addError(`Bad menu key ${visctrl(code)}:${command}`);
                    }
                    else if (!result.commandBindings.bindMenuKey(code, command))
                        addRawError('out of menu map space.', false);
                    continue;
                }
                const bound = result.commandBindings.bindKey(code, command);
                if (!bound.accepted)
                    addError(`Unknown key binding command '${command}'`);
                else if (bound.error)
                    addError(bound.error);
            }
            break;
        case 'AUTOCOMPLETE':
            parseAutocomplete(valueText, addRawError);
            break;
        case 'AUTOPICKUP_EXCEPTION': {
            // ga.apelist is prepended, so the newest rule matches first.
            const rule = parseAutopickupException(valueText, addError);
            if (rule)
                (result.iflags.autopickupExceptions ??= []).unshift(rule);
            break;
        }
        case 'MSGTYPE': {
            const error = addMessageTypeRule(valueText, result.iflags.messageTypes ??= []);
            if (error)
                addError(error);
            break;
        }
        case 'NAME':
            // cnf_line_NAME() strncpy's PL_NSIZ-1 bytes; a UTF-8 name cut at
            // that limit keeps its partial final sequence as one character.
            result.name = new TextDecoder().decode(valueBytes.subarray(0, PL_NSIZ - 1));
            break;
        case 'ROLE':
        case 'CHARACTER':
            // cnf_line_ROLE() assigns only when str2role() >= 0; ROLE_RANDOM
            // (-2) for 'random'/'*'/'@' and ROLE_NONE (-1) for anything
            // unrecognized both leave the previous role in place. str2role()
            // returns null for an empty value, which likewise leaves it unset.
            if (str2role(valueText))
                result.role = valueText;
            break;
        case 'dogname':
        case 'catname':
            // Unlike the dogname/catname options, the statements copy the munged
            // bytes without sanitize_name(); keep the same byte-string form the
            // options produce.
            result.flags[statement] = String.fromCharCode(...valueBytes.subarray(0, PL_PSIZ - 1));
            break;
        case 'WARNINGS': {
            // cnf_line_WARNINGS() calls assign_warnings() unconditionally:
            // values parsed before a syntax error are still applied.
            const { values, syntaxError } = parseUcharList(valueBytes, WARNCOUNT, false);
            assignWarningSymbols(values, result.iflags);
            if (syntaxError)
                addRawError('Syntax error in WARNINGS');
            break;
        }
        case 'BOULDER': {
            // cnf_line_BOULDER() stores the override in the primary symbol set;
            // initoptions_finish() publishes it as the boulder's map glyph.
            // get_uchars() leaves the slot alone for an explicit zero, but a
            // nonzero value truncated to a zero uchar (e.g. 256) clears the
            // override: get_othersym() reads zero as "no override".
            const { values, syntaxError } = parseUcharList(valueBytes, 1, true);
            if (syntaxError)
                addRawError('Syntax error in BOULDER');
            else if (values[0] !== undefined)
                result.boulderSym = values[0] ? String.fromCharCode(values[0]) : '';
            break;
        }
    }
}
// C cfgfiles.c:cnf_line_WARNINGS() → get_uchars() + assign_warnings().
// Numeric statements set each level whose parsed value is nonzero; explicit
// zeros and unparsed trailing entries leave the previous symbol in place.
function assignWarningSymbols(values, flags) {
    const previous = flags.warningSymbols;
    flags.warningSymbols = def_warnsyms.map((warning, index) => values[index] ? String.fromCharCode(values[index] & 0xFF)
        : previous?.charAt(index) || warning.ch).join('');
}
// C cfgfiles.c:parse_config_line()'s config_line_stmt[] table. SYSCF-only
// rows are never reached while reading an rc file. The numeric length is the
// minimum abbreviation, matched case-insensitively against the statement
// name (match_varname() → match_optname(..., val_allowed=TRUE)).
const CONFIG_STATEMENTS = [
    ['OPTIONS', 4], ['AUTOPICKUP_EXCEPTION', 5], ['BINDINGS', 4],
    ['AUTOCOMPLETE', 5], ['MSGTYPE', 7], ['HACKDIR', 4], ['LEVELDIR', 4],
    ['LEVELS', 4], ['SAVEDIR', 4], ['BONESDIR', 5], ['DATADIR', 4],
    ['SCOREDIR', 4], ['LOCKDIR', 4], ['CONFIGDIR', 4], ['TROUBLEDIR', 4],
    ['NAME', 4], ['ROLE', 4], ['CHARACTER', 4], ['dogname', 3], ['catname', 3],
    ['BOULDER', 3], ['MENUCOLOR', 9], ['HILITE_STATUS', 6], ['WARNINGS', 5],
    ['ROGUESYMBOLS', 4], ['SYMBOLS', 4], ['WIZKIT', 6], ['QT_TILEWIDTH', 12],
    ['QT_TILEHEIGHT', 13], ['QT_FONTSIZE', 11], ['QT_COMPACT', 10],
];
// C cfgfiles.c:parse_config_line(): mungspaces() condenses the statement,
// find_optparam() locates the first '=' or ':', the config_line_stmt[] table
// matches the statement name, and the matched handler runs.
// cnf_line_OPTIONS() hands the original, uncondensed statement — from its
// own find_optparam(), skipping nothing after the delimiter — to
// parseoptions(); every other handler receives the condensed value.
function parseConfigLine(bytes, result, state, addError, addRawError) {
    const mungedBytes = mungSpaces(bytes);
    const delimiter = findOptparam(mungedBytes);
    if (delimiter < 0) {
        addError("Not a config statement, missing '='");
        return;
    }
    // skip past '=' (or ':'), then the one space between it and the value
    let nameEnd = delimiter;
    while (nameEnd > 0 && mungedBytes[nameEnd - 1] === 32)
        nameEnd--;
    let valueStart = delimiter + 1;
    if (mungedBytes[valueStart] === 32)
        valueStart++;
    const valueBytes = mungedBytes.subarray(valueStart);
    const name = new TextDecoder().decode(mungedBytes.subarray(0, nameEnd)).toLowerCase();
    let match = null;
    for (const [statement, minimum] of CONFIG_STATEMENTS) {
        if (name.length >= minimum && statement.toLowerCase().startsWith(name)) {
            match = statement;
            break;
        }
    }
    if (!match) {
        addError('Unknown config statement');
        return;
    }
    if (match === 'OPTIONS') {
        parseOptions(bytes.subarray(findOptparam(bytes) + 1), result, state, true, addError, addRawError);
        return;
    }
    handleConfigStatement(match, valueBytes, new TextDecoder().decode(valueBytes), result, addError, addRawError);
}
// options.c:initoptions(): the default paranoia bits before any option.
const DEFAULT_PARANOIA_BITS = PARANOID_PRAY | PARANOID_SWIM | PARANOID_TRAP;
// C cfgfiles.c:rcfile(): the .nethackrc read — config_error_init() frames
// read_config_file() (parse_conf_file() below, whose name the report
// source carries), then the NETHACKOPTIONS environment parse when it holds
// options rather than a file name. The caller displays each frame's errors
// between the two halves, where C's config_error_done() waits once per
// frame.
export function parseNethackrc(rc, sources = {}) {
    // Each engine start is one native process: AUTOCOMPLETE= adjustments
    // from a previous game must not carry over.
    resetCommandAutocomplete();
    const result = {
        name: '', role: null, race: null, gender: null, align: null,
        configErrors: [],
        flags: { paranoia_bits: DEFAULT_PARANOIA_BITS }, iflags: { wc2_petattr: C_ATR_INVERSE }, commandBindings: new CommandBindings(),
    };
    const fileReport = { source: sources.fileName || '.nethackrc', errors: [] };
    parseConfiguration(rc, result, fileReport, true);
    result.configErrors.push(fileReport);
    result.commandBindings.finishConfiguration();
    if (sources.nethackOptions != null)
        parseNethackOptions(sources.nethackOptions, result);
    return result;
}
// C cfgfiles.c:parse_conf_buf() counts physical lines, including comments,
// and attributes a continued statement to its final physical line. The
// diagnostic echoes that line; OPTIONS values retain internal whitespace.
// config_error_nextline()'s bookkeeping is the sourceLine/lineNumber pair
// yielded with each statement.
function* configurationLines(rc, report) {
    let pending = new Uint8Array(0);
    let lineNumber = 0;
    let sourceLine = '';
    const sections = { chosen: null, current: null };
    const physicalLines = rc.split('\n');
    for (const [index, raw] of physicalLines.entries()) {
        const length = new TextEncoder().encode(raw).length;
        const hasNewline = index < physicalLines.length - 1;
        // split() leaves an empty element after the final newline. fgets()
        // never reads that element, so an unfinished continuation stays unused.
        if (!hasNewline && !raw)
            break;
        if (length > 4 * BUFSZ - 2 || (!hasNewline && length === 4 * BUFSZ - 2)) {
            // parse_conf_buf() rejects a full fgets buffer before advancing
            // the error frame, so this diagnostic still names the prior line.
            report.errors.push({ sourceLine, lineNumber, message: 'Line too long, skipping' });
            continue;
        }
        lineNumber++;
        const original = raw.split('\0')[0] ?? '';
        const continued = original.endsWith('\\');
        // C leaves ep at the removed backslash's NUL, so its whitespace
        // trimming loop does not visit the spaces before a continuation.
        sourceLine = continued ? original.slice(0, -1) : original.replace(/[ \t\r]+$/, '');
        const content = sourceLine.replace(/^[ \t]+/, '');
        if (content && !content.startsWith('#')) {
            // Keep native bytes through option parsing: truncation can split
            // a UTF-8 character, and sanitize_name() must see the retained byte.
            const bytes = new TextEncoder().encode(content);
            const separator = pending.length ? 1 : 0;
            const joined = new Uint8Array(pending.length + separator + bytes.length);
            joined.set(pending);
            if (separator)
                joined[pending.length] = 32;
            joined.set(bytes, pending.length + separator);
            pending = joined.subarray(0, 4 * BUFSZ - 1);
        }
        if (continued || !pending.length)
            continue;
        // handle_config_section() calls trimspaces() on every completed
        // statement, including one ended by a comment or blank line.
        let end = pending.length;
        while (end > 0 && (pending[end - 1] === 32 || pending[end - 1] === 9))
            end--;
        const statement = new TextDecoder().decode(pending.subarray(0, end));
        if (handleConfigSection(statement, sections, report, sourceLine, lineNumber)) {
            pending = new Uint8Array(0);
            continue;
        }
        // CHOOSE= is handled before any statement; its value keeps the raw
        // spacing after the delimiter, and the section choice consumes one
        // core rn2() (cfgfiles.c:choose_random_part()).
        const delimiter = statement.search(/[:=]/);
        let nameEnd = delimiter < 0 ? statement.length : delimiter;
        while (nameEnd > 0 && (statement[nameEnd - 1] === ' '
            || statement[nameEnd - 1] === '\t'))
            nameEnd--;
        const name = statement.slice(0, nameEnd).toLowerCase();
        if (name.length >= 6 && 'choose'.startsWith(name)) {
            if (delimiter < 0) {
                report.errors.push({ sourceLine, lineNumber,
                    message: cutConfigBytes('Format is CHOOSE=section1,section2,...', BUFSZ - 1) });
            }
            else {
                // C frees the previous choice before drawing, so a failed
                // CHOOSE leaves no section chosen.
                sections.chosen = chooseRandomPart(statement.slice(delimiter + 1));
                if (sections.chosen === null)
                    report.errors.push({ sourceLine, lineNumber,
                        message: cutConfigBytes('No config section to choose', BUFSZ - 1) });
            }
            pending = new Uint8Array(0);
            continue;
        }
        yield { bytes: pending.subarray(0, end), sourceLine, lineNumber };
        pending = new Uint8Array(0);
    }
}
// C cfgfiles.c:parse_conf_str(): run rc-file statements against a live game
// state (the Lua API's config parse), as C does for its Lua callers with
// config_error_init(FALSE, "parse_conf_str", FALSE) around the same
// parse_conf_buf() machinery.
export function applyNethackrc(rc, state = game) {
    const result = {
        configErrors: [],
        flags: state.flags, iflags: state.iflags,
        commandBindings: state.commandBindings,
    };
    const report = { source: 'parse_conf_str', errors: [] };
    parseConfiguration(rc, result, report, true);
    result.configErrors.push(report);
    if (result.monTelecontrol !== undefined)
        state._monTelecontrol = result.monTelecontrol;
    if (result.monPolycontrol !== undefined)
        state._monPolycontrol = result.monPolycontrol;
    if (result.fruit !== undefined)
        state.fruitName = result.fruit;
    if (result.preferred_pet !== undefined)
        state.preferred_pet = result.preferred_pet;
    // cnf_line_BOULDER() writes straight into the live symbol override.
    if (result.boulderSym !== undefined)
        state.boulderSym = result.boulderSym;
    if (result.rogueBoulderSym !== undefined)
        state.rogueBoulderSym = result.rogueBoulderSym;
    if (result.symset !== undefined || result.symsetCleared)
        state.symset = result.symset || null;
    if (result.rogueSymset !== undefined || result.rogueSymsetCleared)
        state.rogueSymset = result.rogueSymset || null;
    return result;
}
// C cfgfiles.c:parse_conf_file(): drive configurationLines()
// (parse_conf_buf()) and hand each completed statement to
// parse_config_line(); the NETHACKOPTIONS environment form skips the
// statement machinery and feeds the string straight to parseoptions(), as
// rcfile()'s xtraopts call does. cnf_parser_init()/cnf_parser_done() state
// is the generator's locals, and free_config_sections() is the sections
// object each parse starts from.
function parseConfiguration(rc, result, report, fromFile) {
    const state = {
        paranoiaBits: result.flags.paranoia_bits ?? DEFAULT_PARANOIA_BITS,
        paranoiaSeen: false,
        optionsSeen: new Map(),
        characterOptionsSeen: new Map(),
    };
    if (!rc && fromFile)
        return result;
    const lines = fromFile ? configurationLines(rc, report)
        : [{ bytes: new TextEncoder().encode(rc.split('\0')[0] ?? ''), sourceLine: '', lineNumber: 0 }];
    for (const { bytes, sourceLine, lineNumber } of lines) {
        const addError = (message) => {
            report.errors.push({ sourceLine, lineNumber, message: message.slice(0, BUFSZ - 1) });
        };
        const addRawError = (message, pause = true) => {
            report.errors.push({ sourceLine, lineNumber, message, raw: true, pause });
        };
        if (fromFile)
            parseConfigLine(bytes, result, state, addError, addRawError);
        else
            parseOptions(bytes, result, state, false, addError, addRawError);
    }
    if (state.paranoiaSeen)
        result.flags.paranoia_bits = state.paranoiaBits;
    return result;
}
// Part of C cfgfiles.c:rcfile(): the NETHACKOPTIONS half around
// parseoptions().
// rcfile()'s NETHACKOPTIONS half (cfgfiles.c): config_error_init(FALSE,
// envname, FALSE) around parseoptions(), then config_error_done(). C waits
// for the rc file's errors first; the caller displays them between the two
// parses.
export function parseNethackOptions(options, result) {
    const report = { source: 'NETHACKOPTIONS', errors: [] };
    parseConfiguration(options, result, report, false);
    result.configErrors.push(report);
    result.commandBindings.finishConfiguration();
    return report;
}
//# sourceMappingURL=cfgfiles.js.map