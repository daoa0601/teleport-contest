// C options.c:msgtype_parse_add(), msgtype_type(), hide_unhide_msgtypes().
import { MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP } from './const.js';

type MessageType = typeof MSGTYP_NORMAL | typeof MSGTYP_NOREP
    | typeof MSGTYP_NOSHOW | typeof MSGTYP_STOP;

export interface MessageTypeRule {
    type: MessageType;
    pattern: RegExp;
    disabled: boolean;
}

const MESSAGE_TYPES: ReadonlyArray<readonly [string, MessageType]> = [
    ['show', MSGTYP_NORMAL], ['hide', MSGTYP_NOSHOW], ['noshow', MSGTYP_NOSHOW],
    ['stop', MSGTYP_STOP], ['more', MSGTYP_STOP], ['norep', MSGTYP_NOREP],
];

export function addMessageTypeRule(value: string, rules: MessageTypeRule[]): string | null {
    // sscanf() accepts a ten-character type and up to 255 pattern characters;
    // the closing quote and trailing input do not affect its two conversions.
    const match = value.match(/^\s*(\S{1,10})\s+"([^"]{1,255})/);
    if (!match?.[1] || !match[2]) return 'Malformed MSGTYPE';
    const name = match[1];
    const entry = MESSAGE_TYPES.find(([type]) => type.startsWith(name.toLowerCase()));
    if (!entry) return `Unknown message type '${name}'`;
    try {
        rules.unshift({ type: entry[1], pattern: new RegExp(posixPattern(match[2]), 's'), disabled: false });
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return `MSGTYPE regex error: ${posixRegexDiagnostic(error)}`;
    }
    return null;
}

export function messageTypeFor(
    text: string, noRepeat: boolean, rules: readonly MessageTypeRule[] = [],
): MessageType {
    const rule = rules.find(entry => entry.pattern.test(text));
    if (!rule) return noRepeat ? MSGTYP_NOREP : MSGTYP_NORMAL;
    // A disabled matching rule still wins over older rules and Norep().
    return rule.disabled ? MSGTYP_NORMAL : rule.type;
}

export function hideUnhideMessageTypes(
    hide: boolean, mask: number, rules: readonly MessageTypeRule[] = [],
): void {
    for (const rule of rules) {
        if (rule.type !== MSGTYP_NORMAL && ((1 << rule.type) & mask)) rule.disabled = hide;
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
function posixPattern(pattern: string): string {
    let result = '';
    let inSet = false;
    let setStart = -1;
    let repeatable = false;
    let groupDepth = 0;
    let branchStart = 0;
    for (let index = 0; index < pattern.length; index++) {
        const ch = pattern.charAt(index);
        if (inSet && pattern.startsWith('[:', index)) {
            const end = pattern.indexOf(':]', index + 2);
            const range = end >= 0 ? POSIX_CLASSES.get(pattern.slice(index + 2, end)) : undefined;
            if (range === undefined) throw new SyntaxError('invalid character class');
            result += range;
            index = end + 1;
        } else if (inSet && (pattern.startsWith('[.', index) || pattern.startsWith('[=', index))) {
            const end = pattern.indexOf(`${pattern.charAt(index + 1)}]`, index + 2);
            const character = pattern.slice(index + 2, end);
            // The native process retains the C locale: collating symbols and
            // equivalence classes each contain one character.
            if (end < 0 || character.length !== 1)
                throw new SyntaxError('invalid collating element');
            result += '[]\\^-'.includes(character) ? `\\${character}` : character;
            index = end + 1;
        } else if (ch === '\\') {
            if (inSet) result += '\\\\';
            else {
                const escaped = pattern.charAt(++index);
                if (!escaped) throw new SyntaxError('trailing backslash (\\)');
                result += posixEscape(escaped);
            }
        } else if (!inSet && ch === '[') {
            inSet = true;
            setStart = index + (pattern[index + 1] === '^' ? 2 : 1);
            result += ch;
        } else if (inSet && ch === ']') {
            if (index === setStart) result += '\\]';
            else { inSet = false; result += ch; }
        } else if (!inSet && ch === '(' && pattern.charAt(index + 1) === '?') {
            // POSIX ERE has no group prefixes; '?' here has no operand.
            throw new SyntaxError('repetition-operator operand invalid');
        } else if (!inSet && ch === '(') {
            groupDepth++;
            branchStart = index + 1;
            result += ch;
        } else if (!inSet && ch === '|') {
            if (index === branchStart) throw new SyntaxError('empty (sub)expression');
            branchStart = index + 1;
            result += ch;
        } else if (!inSet && ch === ')' && groupDepth > 0) {
            // An empty group is valid, but either side of '|' needs an expression.
            if (index === branchStart && pattern.charAt(index - 1) === '|')
                throw new SyntaxError('empty (sub)expression');
            groupDepth--;
            result += ch;
        } else if (!inSet && ch === '{') {
            const repetition = posixRepetition(pattern.slice(index), repeatable);
            if (repetition === null) {
                result += ch;
                repeatable = true;
            } else {
                result += repetition;
                index += repetition.length - 1;
                repeatable = false;
            }
        } else if (!inSet && ch === '$') result += '(?![\\s\\S])';
        else result += ch;
        // Counted repetition needs an atom, rather than an anchor, group
        // opening, alternative or another repetition operator.
        if (!inSet && ch !== '{') repeatable = !'(^$|*+?'.includes(ch);
    }
    if (inSet) throw new SyntaxError('brackets ([ ]) not balanced');
    if (groupDepth > 0) throw new SyntaxError('parentheses not balanced');
    if (branchStart === pattern.length) throw new SyntaxError('empty (sub)expression');
    return result;
}

function posixRepetition(pattern: string, repeatable: boolean): string | null {
    const repetition = /^\{([0-9]+)(?:,([0-9]*))?/.exec(pattern);
    // A brace starts a counted repetition only when followed by a digit.
    if (!repetition?.[1]) return null;
    if (!repeatable) throw new SyntaxError('repetition-operator operand invalid');
    const minimum = Number(repetition[1]);
    const maximum = repetition[2] === undefined ? minimum
        : repetition[2] === '' ? null : Number(repetition[2]);
    if (minimum > 255 || (maximum !== null && maximum > 255))
        throw new SyntaxError('maximum repetition exceeds 255');
    if (maximum !== null && minimum > maximum)
        throw new SyntaxError('invalid repetition count(s)');
    const end = repetition[0].length;
    if (end === pattern.length) throw new SyntaxError('braces not balanced');
    if (pattern.charAt(end) !== '}') throw new SyntaxError('invalid repetition count(s)');
    return pattern.slice(0, end + 1);
}

function posixRegexDiagnostic(error: SyntaxError): string {
    // Translation errors already use the macOS recorder's regerror() text.
    // The JavaScript compiler detects these remaining ERE syntax errors.
    const message = error.message;
    if (message.endsWith(': Unterminated group')) return 'parentheses not balanced';
    if (message.endsWith(': Range out of order in character class')) return 'invalid character range';
    if (message.endsWith(': numbers out of order in {} quantifier')) return 'invalid repetition count(s)';
    if (message.endsWith(': Nothing to repeat')) return 'repetition-operator operand invalid';
    return message;
}

function posixEscape(character: string): string {
    // The macOS recorder treats escaped letters, digits and non-operators
    // literally; only JavaScript's expression operators still need escaping.
    return '\\^$.*+?()[]{}|'.includes(character) ? `\\${character}` : character;
}
