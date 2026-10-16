import { luaSyntaxError } from './syntax_error.js';
const keywords = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
    'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or',
    'repeat', 'return', 'then', 'true', 'until', 'while',
]);
const doubleSymbols = new Set([
    '==', '~=', '<=', '>=', '//', '<<', '>>', '..', '::',
]);
function isNameStart(char) {
    return /[A-Za-z_]/u.test(char || '');
}
function isNamePart(char) {
    return /[A-Za-z0-9_]/u.test(char || '');
}
function longBracketLevel(source, offset) {
    if (source[offset] !== '[')
        return -1;
    let cursor = offset + 1;
    while (source[cursor] === '=')
        cursor++;
    return source[cursor] === '[' ? cursor - offset - 1 : -1;
}
export function lexLua(source, filename = '<lua>') {
    const tokens = [];
    let offset = 0;
    let line = 1;
    let tokenStart = 0;
    function fail(message, near) {
        throw luaSyntaxError(filename, line, message, near);
    }
    function advance() {
        const char = source.charAt(offset++);
        if (char === '\n' || char === '\r') {
            const following = source[offset];
            if ((following === '\n' || following === '\r') && following !== char)
                offset++;
            line++;
        }
        return char;
    }
    function add(token) {
        tokens.push({ ...token, line, text: source.slice(tokenStart, offset) });
    }
    function readLongString(level, comment = false) {
        const startingLine = line;
        const openingLength = level + 2;
        for (let index = 0; index < openingLength; index++)
            advance();
        if (source[offset] === '\n' || source[offset] === '\r')
            advance();
        const start = offset;
        const closing = `]${'='.repeat(level)}]`;
        const end = source.indexOf(closing, offset);
        if (end < 0) {
            while (offset < source.length)
                advance();
            fail(`unfinished long ${comment ? 'comment' : 'string'} (starting at line ${startingLine})`, '<eof>');
        }
        while (offset < end)
            advance();
        const value = source.slice(start, end);
        for (let index = 0; index < closing.length; index++)
            advance();
        return value;
    }
    function skipComment() {
        advance();
        advance();
        const level = longBracketLevel(source, offset);
        if (level >= 0) {
            readLongString(level, true);
            return;
        }
        while (offset < source.length && source[offset] !== '\n'
            && source[offset] !== '\r')
            advance();
    }
    function readQuotedString(quote) {
        advance();
        let value = '';
        while (offset < source.length) {
            if (source[offset] === '\n' || source[offset] === '\r')
                fail('unfinished string', `'${source.slice(tokenStart, offset)}'`);
            const char = advance();
            if (char === quote)
                return value;
            if (char !== '\\') {
                value += char;
                continue;
            }
            const escaped = advance();
            const simple = {
                a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r',
                t: '\t', v: '\v', '\\': '\\', '"': '"', "'": "'",
            };
            const replacement = simple[escaped];
            if (replacement !== undefined) {
                value += replacement;
            }
            else if (escaped === 'z') {
                while (/\s/u.test(source[offset] || ''))
                    advance();
            }
            else if (escaped === '\n' || escaped === '\r') {
                value += '\n';
            }
            else {
                value += escaped;
            }
        }
        fail('unfinished string', '<eof>');
    }
    function readNumber() {
        const start = offset;
        if (source.startsWith('0x', offset)
            || source.startsWith('0X', offset)) {
            advance();
            advance();
            while (/[0-9A-Fa-f.]/u.test(source[offset] || ''))
                advance();
            if (/[pP]/u.test(source[offset] || '')) {
                advance();
                if (/[+-]/u.test(source[offset] || ''))
                    advance();
                while (/\d/u.test(source[offset] || ''))
                    advance();
            }
        }
        else {
            while (/\d/u.test(source[offset] || ''))
                advance();
            if (source[offset] === '.' && source[offset + 1] !== '.') {
                advance();
                while (/\d/u.test(source[offset] || ''))
                    advance();
            }
            if (/[eE]/u.test(source[offset] || '')) {
                advance();
                if (/[+-]/u.test(source[offset] || ''))
                    advance();
                while (/\d/u.test(source[offset] || ''))
                    advance();
            }
        }
        const raw = source.slice(start, offset);
        const value = /^0x/iu.test(raw) ? Number.parseInt(raw, 16) : Number(raw);
        if (!Number.isFinite(value))
            fail('malformed number', `'${raw}'`);
        return value;
    }
    while (offset < source.length) {
        const char = source.charAt(offset);
        if (/\s/u.test(char)) {
            advance();
            continue;
        }
        if (char === '-' && source[offset + 1] === '-') {
            skipComment();
            continue;
        }
        tokenStart = offset;
        const level = longBracketLevel(source, offset);
        if (level >= 0) {
            add({ type: 'string', value: readLongString(level) });
            continue;
        }
        if (char === '"' || char === "'") {
            add({ type: 'string', value: readQuotedString(char) });
            continue;
        }
        if (/\d/u.test(char)
            || (char === '.' && /\d/u.test(source[offset + 1] || ''))) {
            add({ type: 'number', value: readNumber() });
            continue;
        }
        if (isNameStart(char)) {
            const start = offset;
            while (isNamePart(source[offset]))
                advance();
            const value = source.slice(start, offset);
            add({ type: keywords.has(value) ? 'keyword' : 'name', value });
            continue;
        }
        if (source.startsWith('...', offset)) {
            advance();
            advance();
            advance();
            add({ type: 'symbol', value: '...' });
            continue;
        }
        const pair = source.slice(offset, offset + 2);
        if (doubleSymbols.has(pair)) {
            advance();
            advance();
            add({ type: 'symbol', value: pair });
            continue;
        }
        advance();
        add({ type: 'symbol', value: char });
    }
    tokens.push({ type: 'eof', value: '<eof>', line, text: '' });
    return tokens;
}
//# sourceMappingURL=lexer.js.map