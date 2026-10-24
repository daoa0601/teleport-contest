// C options.c:msgtype_parse_add(), msgtype_type(), hide_unhide_msgtypes().
import { MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP } from './const.js';
const MESSAGE_TYPES = [
    ['show', MSGTYP_NORMAL], ['hide', MSGTYP_NOSHOW], ['noshow', MSGTYP_NOSHOW],
    ['stop', MSGTYP_STOP], ['more', MSGTYP_STOP], ['norep', MSGTYP_NOREP],
];
export function addMessageTypeRule(value, rules) {
    // sscanf() accepts a ten-character type and up to 255 pattern characters;
    // the closing quote and trailing input do not affect its two conversions.
    const match = value.match(/^\s*(\S{1,10})\s+"([^"]{1,255})/);
    if (!match?.[1] || !match[2])
        return 'Malformed MSGTYPE';
    const name = match[1];
    const entry = MESSAGE_TYPES.find(([type]) => type.startsWith(name.toLowerCase()));
    if (!entry)
        return `Unknown message type '${name}'`;
    try {
        rules.unshift({ type: entry[1], pattern: new RegExp(posixPattern(match[2]), 's'), disabled: false });
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return `MSGTYPE regex error: ${posixRegexDiagnostic(error)}`;
    }
    return null;
}
export function messageTypeFor(text, noRepeat, rules = []) {
    const rule = rules.find(entry => entry.pattern.test(text));
    if (!rule)
        return noRepeat ? MSGTYP_NOREP : MSGTYP_NORMAL;
    // A disabled matching rule still wins over older rules and Norep().
    return rule.disabled ? MSGTYP_NORMAL : rule.type;
}
export function hideUnhideMessageTypes(hide, mask, rules = []) {
    for (const rule of rules) {
        if (rule.type !== MSGTYP_NORMAL && ((1 << rule.type) & mask))
            rule.disabled = hide;
    }
}
const POSIX_CLASSES = new Map([
    ['alnum', 'A-Za-z0-9'], ['alpha', 'A-Za-z'], ['blank', ' \t'],
    ['cntrl', '\x00-\x1f\x7f'], ['digit', '0-9'], ['graph', '\x21-\x7e'],
    ['lower', 'a-z'], ['print', '\x20-\x7e'],
    ['punct', '\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e'],
    ['space', ' \t\r\n\v\f'], ['upper', 'A-Z'], ['xdigit', 'A-Fa-f0-9'],
]);
// The pinned build uses POSIX extended expressions. JavaScript shares its
// operators, but needs explicit POSIX classes, literal leading ']' in sets,
// and an absolute end anchor (its '$' also matches before a final newline).
function posixPattern(pattern) {
    let result = '';
    let inSet = false;
    let setStart = -1;
    for (let index = 0; index < pattern.length; index++) {
        const ch = pattern.charAt(index);
        if (inSet && pattern.startsWith('[:', index)) {
            const end = pattern.indexOf(':]', index + 2);
            const range = end >= 0 ? POSIX_CLASSES.get(pattern.slice(index + 2, end)) : undefined;
            if (range === undefined)
                throw new SyntaxError('invalid character class');
            result += range;
            index = end + 1;
        }
        else if (inSet && (pattern.startsWith('[.', index) || pattern.startsWith('[=', index))) {
            const end = pattern.indexOf(`${pattern.charAt(index + 1)}]`, index + 2);
            const character = pattern.slice(index + 2, end);
            // The native process retains the C locale: collating symbols and
            // equivalence classes each contain one character.
            if (end < 0 || character.length !== 1)
                throw new SyntaxError('invalid collating element');
            result += '[]\\^-'.includes(character) ? `\\${character}` : character;
            index = end + 1;
        }
        else if (ch === '\\') {
            if (inSet)
                result += '\\\\';
            else {
                const escaped = pattern.charAt(++index);
                if (!escaped)
                    throw new SyntaxError('trailing backslash (\\)');
                result += posixEscape(escaped);
            }
        }
        else if (!inSet && ch === '[') {
            inSet = true;
            setStart = index + (pattern[index + 1] === '^' ? 2 : 1);
            result += ch;
        }
        else if (inSet && ch === ']') {
            if (index === setStart)
                result += '\\]';
            else {
                inSet = false;
                result += ch;
            }
        }
        else if (!inSet && ch === '(' && pattern.charAt(index + 1) === '?') {
            // POSIX ERE has no group prefixes; '?' here has no operand.
            throw new SyntaxError('repetition-operator operand invalid');
        }
        else if (!inSet && ch === '$')
            result += '(?![\\s\\S])';
        else
            result += ch;
    }
    if (inSet)
        throw new SyntaxError('brackets ([ ]) not balanced');
    return result;
}
function posixRegexDiagnostic(error) {
    // Translation errors already use the macOS recorder's regerror() text.
    // The JavaScript compiler detects these remaining ERE syntax errors.
    const message = error.message;
    if (message.endsWith(': Unterminated group'))
        return 'parentheses not balanced';
    if (message.endsWith(': Range out of order in character class'))
        return 'invalid character range';
    if (message.endsWith(': numbers out of order in {} quantifier'))
        return 'invalid repetition count(s)';
    if (message.endsWith(': Nothing to repeat'))
        return 'repetition-operator operand invalid';
    return message;
}
function posixEscape(character) {
    // The macOS recorder treats escaped letters, digits and non-operators
    // literally; only JavaScript's expression operators still need escaping.
    return '\\^$.*+?()[]{}|'.includes(character) ? `\\${character}` : character;
}
//# sourceMappingURL=message_types.js.map