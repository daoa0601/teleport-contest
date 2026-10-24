// sys/share/posixregex.c uses regcomp(REG_EXTENDED | REG_NOSUB).
// Public and fresh sessions are recorded on macOS (.github/workflows/fresh-batches.yml).
// The recorder never calls setlocale(), so classes and collation use the C locale.
export class PosixRegex {
    expression;
    constructor(pattern) {
        this.expression = new EreParser(cStringBytes(pattern)).parse();
    }
    test(text) {
        const bytes = cStringBytes(text);
        const matcher = new EreMatcher(bytes);
        // regexec() searches substrings; anchors constrain the original string.
        for (let start = 0; start <= bytes.length; start++) {
            if (matcher.ends(this.expression, start).size > 0)
                return true;
        }
        return false;
    }
}
function cStringBytes(text) {
    const nul = text.indexOf('\0');
    const bytes = new TextEncoder().encode(nul < 0 ? text : text.slice(0, nul));
    return Array.from(bytes, byte => String.fromCharCode(byte)).join('');
}
class EreParser {
    pattern;
    index = 0;
    constructor(pattern) {
        this.pattern = pattern;
    }
    parse() {
        return this.alternatives(false);
    }
    alternatives(inGroup) {
        const branches = [];
        do {
            const nodes = [];
            while (this.index < this.pattern.length && this.peek() !== '|'
                && !(inGroup && this.peek() === ')')) {
                nodes.push(this.piece());
            }
            if (nodes.length === 0) {
                if (inGroup && this.index === this.pattern.length)
                    throw new SyntaxError('parentheses not balanced');
                if (!(inGroup && branches.length === 0 && this.peek() === ')'))
                    throw new SyntaxError('empty (sub)expression');
            }
            branches.push({ kind: 'sequence', nodes });
            if (this.peek() !== '|')
                break;
            this.index++;
        } while (true);
        return { kind: 'alternatives', nodes: branches };
    }
    piece() {
        const node = this.atom();
        const operator = this.peek();
        if (operator === '{' && isDigit(this.pattern.charAt(this.index + 1))) {
            const [minimum, maximum] = this.bounds();
            if (node.kind === 'assertion')
                throw new SyntaxError('repetition-operator operand invalid');
            return { kind: 'repeat', node, minimum, maximum };
        }
        if (!'*+?'.includes(operator) || operator === '')
            return node;
        if (node.kind === 'assertion')
            throw new SyntaxError('repetition-operator operand invalid');
        this.index++;
        return { kind: 'repeat', node, minimum: operator === '+' ? 1 : 0,
            maximum: operator === '?' ? 1 : null };
    }
    atom() {
        const character = this.peek();
        this.index++;
        switch (character) {
            case '(': {
                const expression = this.alternatives(true);
                if (this.peek() !== ')')
                    throw new SyntaxError('parentheses not balanced');
                this.index++;
                return expression;
            }
            case '[': return this.bracket();
            case '.': return { kind: 'dot' };
            case '^': return { kind: 'assertion', assertion: 'start' };
            case '$': return { kind: 'assertion', assertion: 'end' };
            case '\\': {
                if (this.index === this.pattern.length)
                    throw new SyntaxError('trailing backslash (\\)');
                const value = this.pattern.charCodeAt(this.index++);
                return { kind: 'literal', value };
            }
            case '*':
            case '+':
            case '?':
                throw new SyntaxError('repetition-operator operand invalid');
            case '{':
                // Native parses numeric bounds before diagnosing a missing operand.
                if (isDigit(this.peek())) {
                    this.index--;
                    this.bounds();
                    throw new SyntaxError('repetition-operator operand invalid');
                }
                return { kind: 'literal', value: character.charCodeAt(0) };
            default:
                return { kind: 'literal', value: character.charCodeAt(0) };
        }
    }
    bounds() {
        this.index++;
        const minimum = this.number();
        let maximum = minimum;
        if (this.peek() === ',') {
            this.index++;
            maximum = isDigit(this.peek()) ? this.number() : null;
        }
        if (maximum !== null && minimum > maximum)
            throw new SyntaxError('invalid repetition count(s)');
        if (minimum > 255 || (maximum !== null && maximum > 255))
            throw new SyntaxError('maximum repetition exceeds 255');
        if (this.index === this.pattern.length)
            throw new SyntaxError('braces not balanced');
        if (this.peek() !== '}')
            throw new SyntaxError('invalid repetition count(s)');
        this.index++;
        return [minimum, maximum];
    }
    number() {
        const start = this.index;
        while (isDigit(this.peek()))
            this.index++;
        // tre_parse_int() saturates at INT_MAX before comparing the bounds.
        return Math.min(Number(this.pattern.slice(start, this.index)), 2147483647);
    }
    bracket() {
        for (const [spelling, assertion] of [['[:<:]]', 'word-start'], ['[:>:]]', 'word-end']]) {
            if (this.pattern.startsWith(spelling, this.index)) {
                this.index += spelling.length;
                return { kind: 'assertion', assertion };
            }
        }
        const inverted = this.peek() === '^';
        if (inverted)
            this.index++;
        const start = this.index;
        const members = new Set();
        let rangeStart = null;
        while (this.index < this.pattern.length) {
            const character = this.peek();
            if (character === ']' && this.index !== start) {
                this.index++;
                return { kind: 'set', members, inverted };
            }
            if (character === '-' && this.index !== start) {
                const next = this.pattern.charAt(this.index + 1);
                if (next === '')
                    throw new SyntaxError('brackets ([ ]) not balanced');
                if (next !== ']') {
                    if (rangeStart === null)
                        throw new SyntaxError('invalid character range');
                    this.index++;
                    const end = this.bracketElement(true);
                    if (end.character === null || rangeStart > end.character)
                        throw new SyntaxError('invalid character range');
                    for (let value = rangeStart; value <= end.character; value++)
                        members.add(value);
                    rangeStart = null;
                    continue;
                }
            }
            const element = this.bracketElement(false);
            for (const value of element.members)
                members.add(value);
            rangeStart = element.character;
        }
        throw new SyntaxError('brackets ([ ]) not balanced');
    }
    bracketElement(rangeEnd) {
        const character = this.peek();
        const delimiter = this.pattern.charAt(this.index + 1);
        if (character === '[' && delimiter === '')
            throw new SyntaxError('brackets ([ ]) not balanced');
        if (character !== '[' || !':.='.includes(delimiter) || delimiter === '') {
            this.index++;
            const value = character.charCodeAt(0);
            return { character: value, members: new Set([value]) };
        }
        // Classes and equivalence classes cannot be range endpoints, even
        // when the C locale gives an equivalence class just one member.
        if (rangeEnd && delimiter !== '.')
            throw new SyntaxError('invalid character range');
        const end = this.pattern.indexOf(`${delimiter}]`, this.index + 2);
        const diagnostic = delimiter === ':' ? 'invalid character class' : 'invalid collating element';
        if (end < 0)
            throw new SyntaxError(diagnostic);
        const name = this.pattern.slice(this.index + 2, end);
        this.index = end + 2;
        if (delimiter === ':') {
            const members = characterClass(name);
            if (members === null)
                throw new SyntaxError(diagnostic);
            return { character: null, members };
        }
        const named = POSIX_CHARACTER_NAMES.get(name);
        const value = named !== undefined ? named.charCodeAt(0)
            : name.length === 1 && name.charCodeAt(0) < 128 ? name.charCodeAt(0) : null;
        if (value === null)
            throw new SyntaxError(diagnostic);
        return { character: delimiter === '=' && named === undefined ? null : value,
            members: new Set([value]) };
    }
    peek() {
        return this.pattern.charAt(this.index);
    }
}
function isDigit(character) {
    return character >= '0' && character <= '9';
}
function characterClass(name) {
    // macOS also recognizes these BSD classes. In the C locale, none of
    // the characters are ideograms, phonograms, or special characters.
    if (name === 'ideogram' || name === 'phonogram' || name === 'special')
        return new Set();
    const matches = (value) => {
        const lower = value >= 97 && value <= 122;
        const upper = value >= 65 && value <= 90;
        const digit = value >= 48 && value <= 57;
        switch (name) {
            case 'alnum': return lower || upper || digit;
            case 'alpha': return lower || upper;
            case 'blank': return value === 32 || value === 9;
            case 'cntrl': return value < 32 || value === 127;
            case 'digit': return digit;
            case 'graph': return value >= 33 && value <= 126;
            case 'lower': return lower;
            case 'print': return value >= 32 && value <= 126;
            case 'punct': return value >= 33 && value <= 126 && !(lower || upper || digit);
            case 'rune': return true;
            case 'space': return value === 32 || (value >= 9 && value <= 13);
            case 'upper': return upper;
            case 'xdigit': return digit || (value >= 65 && value <= 70) || (value >= 97 && value <= 102);
            default: return false;
        }
    };
    const members = new Set();
    for (let value = 0; value < 128; value++)
        if (matches(value))
            members.add(value);
    return members.size > 0 ? members : null;
}
// macOS libc's regex/FreeBSD/cname.h supplies these names for collating
// symbols and equivalence classes, including their historical aliases.
const POSIX_CHARACTER_NAMES = new Map([
    ['ACK', '\x06'], ['BEL', '\x07'], ['BS', '\x08'], ['CAN', '\x18'],
    ['CR', '\r'], ['DC1', '\x11'], ['DC2', '\x12'], ['DC3', '\x13'], ['DC4', '\x14'],
    ['DEL', '\x7f'], ['DLE', '\x10'], ['EM', '\x19'], ['ENQ', '\x05'],
    ['EOT', '\x04'], ['ESC', '\x1b'], ['ETB', '\x17'], ['ETX', '\x03'],
    ['FF', '\f'], ['FS', '\x1c'], ['GS', '\x1d'], ['HT', '\t'],
    ['IS1', '\x1f'], ['IS2', '\x1e'], ['IS3', '\x1d'], ['IS4', '\x1c'],
    ['LF', '\n'], ['NAK', '\x15'], ['NUL', '\0'], ['RS', '\x1e'],
    ['SI', '\x0f'], ['SO', '\x0e'], ['SOH', '\x01'], ['STX', '\x02'],
    ['SUB', '\x1a'], ['SYN', '\x16'], ['US', '\x1f'], ['VT', '\v'],
    ['alert', '\x07'], ['ampersand', '&'], ['apostrophe', "'"], ['asterisk', '*'],
    ['backslash', '\\'], ['backspace', '\b'], ['carriage-return', '\r'],
    ['circumflex', '^'], ['circumflex-accent', '^'], ['colon', ':'], ['comma', ','],
    ['commercial-at', '@'], ['dollar-sign', '$'], ['eight', '8'], ['equals-sign', '='],
    ['exclamation-mark', '!'], ['five', '5'], ['form-feed', '\f'], ['four', '4'],
    ['full-stop', '.'], ['grave-accent', '`'], ['greater-than-sign', '>'],
    ['hyphen', '-'], ['hyphen-minus', '-'], ['left-brace', '{'], ['left-curly-bracket', '{'],
    ['left-parenthesis', '('], ['left-square-bracket', '['], ['less-than-sign', '<'],
    ['low-line', '_'], ['newline', '\n'], ['nine', '9'], ['number-sign', '#'], ['one', '1'],
    ['percent-sign', '%'], ['period', '.'], ['plus-sign', '+'], ['question-mark', '?'],
    ['quotation-mark', '"'], ['reverse-solidus', '\\'], ['right-brace', '}'],
    ['right-curly-bracket', '}'], ['right-parenthesis', ')'], ['right-square-bracket', ']'],
    ['semicolon', ';'], ['seven', '7'], ['six', '6'], ['slash', '/'], ['solidus', '/'],
    ['space', ' '], ['tab', '\t'], ['three', '3'], ['tilde', '~'], ['two', '2'],
    ['underscore', '_'], ['vertical-line', '|'], ['vertical-tab', '\v'], ['zero', '0'],
]);
class EreMatcher {
    text;
    cache = new Map();
    constructor(text) {
        this.text = text;
    }
    ends(node, start) {
        let positions = this.cache.get(node);
        if (positions === undefined) {
            positions = new Map();
            this.cache.set(node, positions);
        }
        const cached = positions.get(start);
        if (cached !== undefined)
            return cached;
        const result = this.match(node, start);
        positions.set(start, result);
        return result;
    }
    match(node, start) {
        switch (node.kind) {
            case 'literal':
                return new Set(this.text.charCodeAt(start) === node.value ? [start + 1] : []);
            case 'dot': return new Set(start < this.text.length ? [start + 1] : []);
            case 'set':
                return new Set(start < this.text.length
                    && node.members.has(this.text.charCodeAt(start)) !== node.inverted ? [start + 1] : []);
            case 'assertion': return new Set(this.assertion(node.assertion, start) ? [start] : []);
            case 'sequence': {
                let positions = new Set([start]);
                for (const part of node.nodes) {
                    positions = this.advance(part, positions);
                    if (positions.size === 0)
                        break;
                }
                return positions;
            }
            case 'alternatives': {
                const positions = new Set();
                for (const branch of node.nodes)
                    for (const end of this.ends(branch, start))
                        positions.add(end);
                return positions;
            }
            case 'repeat': return this.repeat(node, start);
        }
    }
    repeat(node, start) {
        let positions = new Set([start]);
        for (let count = 0; count < node.minimum && positions.size > 0; count++)
            positions = this.advance(node.node, positions);
        const accepted = new Set(positions);
        for (let count = node.minimum; positions.size > 0
            && (node.maximum === null || count < node.maximum); count++) {
            const next = this.advance(node.node, positions);
            // An already reached position has at least as many repetitions
            // left as a later visit. This also terminates nullable loops.
            positions = new Set(Array.from(next).filter(end => !accepted.has(end)));
            for (const end of positions)
                accepted.add(end);
        }
        return accepted;
    }
    advance(node, positions) {
        const next = new Set();
        for (const start of positions)
            for (const end of this.ends(node, start))
                next.add(end);
        return next;
    }
    assertion(assertion, position) {
        switch (assertion) {
            case 'start': return position === 0;
            case 'end': return position === this.text.length;
            case 'word-start': return !this.wordAt(position - 1) && this.wordAt(position);
            case 'word-end': return this.wordAt(position - 1) && !this.wordAt(position);
        }
    }
    wordAt(position) {
        const value = this.text.charCodeAt(position);
        return (value >= 48 && value <= 57) || (value >= 65 && value <= 90)
            || value === 95 || (value >= 97 && value <= 122);
    }
}
//# sourceMappingURL=posix_regex.js.map