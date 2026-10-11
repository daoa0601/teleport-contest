export type LuaTokenData =
    | { type: 'number'; value: number }
    | { type: 'string' | 'name' | 'keyword' | 'symbol' | 'eof'; value: string };

export type LuaToken = LuaTokenData & { line: number; column: number };

const keywords = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
    'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or',
    'repeat', 'return', 'then', 'true', 'until', 'while',
]);

const doubleSymbols = new Set([
    '==', '~=', '<=', '>=', '//', '<<', '>>', '..', '::',
]);

function isNameStart(char: string | undefined): boolean {
    return /[A-Za-z_]/u.test(char || '');
}

function isNamePart(char: string | undefined): boolean {
    return /[A-Za-z0-9_]/u.test(char || '');
}

function longBracketLevel(source: string, offset: number): number {
    if (source[offset] !== '[') return -1;
    let cursor = offset + 1;
    while (source[cursor] === '=') cursor++;
    return source[cursor] === '[' ? cursor - offset - 1 : -1;
}

export function lexLua(source: string, filename = '<lua>'): LuaToken[] {
    const tokens: LuaToken[] = [];
    let offset = 0;
    let line = 1;
    let column = 1;

    function fail(message: string): never {
        throw new SyntaxError(`${filename}:${line}:${column}: ${message}`);
    }

    function advance(): string {
        const char = source.charAt(offset++);
        if (char === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
        return char;
    }

    function add(token: LuaTokenData, tokenLine = line, tokenColumn = column): void {
        tokens.push({ ...token, line: tokenLine, column: tokenColumn });
    }

    function readLongString(level: number): string {
        const openingLength = level + 2;
        for (let index = 0; index < openingLength; index++) advance();
        if (source[offset] === '\n') advance();
        const start = offset;
        const closing = `]${'='.repeat(level)}]`;
        const end = source.indexOf(closing, offset);
        if (end < 0) fail('unterminated long string');
        while (offset < end) advance();
        const value = source.slice(start, end);
        for (let index = 0; index < closing.length; index++) advance();
        return value;
    }

    function skipComment(): void {
        advance();
        advance();
        const level = longBracketLevel(source, offset);
        if (level >= 0) {
            readLongString(level);
            return;
        }
        while (offset < source.length && source[offset] !== '\n') advance();
    }

    function readQuotedString(quote: string): string {
        advance();
        let value = '';
        while (offset < source.length) {
            const char = advance();
            if (char === quote) return value;
            if (char !== '\\') {
                value += char;
                continue;
            }
            const escaped = advance();
            const simple: Readonly<Record<string, string>> = {
                a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r',
                t: '\t', v: '\v', '\\': '\\', '"': '"', "'": "'",
            };
            const replacement = simple[escaped];
            if (replacement !== undefined) {
                value += replacement;
            } else if (escaped === 'z') {
                while (/\s/u.test(source[offset] || '')) advance();
            } else if (escaped === '\n') {
                value += '\n';
            } else {
                value += escaped;
            }
        }
        fail('unterminated string');
    }

    function readNumber(): number {
        const start = offset;
        if (source.startsWith('0x', offset)
            || source.startsWith('0X', offset)) {
            advance();
            advance();
            while (/[0-9A-Fa-f.]/u.test(source[offset] || '')) advance();
            if (/[pP]/u.test(source[offset] || '')) {
                advance();
                if (/[+-]/u.test(source[offset] || '')) advance();
                while (/\d/u.test(source[offset] || '')) advance();
            }
        } else {
            while (/\d/u.test(source[offset] || '')) advance();
            if (source[offset] === '.' && source[offset + 1] !== '.') {
                advance();
                while (/\d/u.test(source[offset] || '')) advance();
            }
            if (/[eE]/u.test(source[offset] || '')) {
                advance();
                if (/[+-]/u.test(source[offset] || '')) advance();
                while (/\d/u.test(source[offset] || '')) advance();
            }
        }
        const raw = source.slice(start, offset);
        const value = /^0x/iu.test(raw) ? Number.parseInt(raw, 16) : Number(raw);
        if (!Number.isFinite(value)) fail(`invalid number ${raw}`);
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

        const tokenLine = line;
        const tokenColumn = column;
        const level = longBracketLevel(source, offset);
        if (level >= 0) {
            add({ type: 'string', value: readLongString(level) }, tokenLine, tokenColumn);
            continue;
        }
        if (char === '"' || char === "'") {
            add({ type: 'string', value: readQuotedString(char) }, tokenLine, tokenColumn);
            continue;
        }
        if (/\d/u.test(char)
            || (char === '.' && /\d/u.test(source[offset + 1] || ''))) {
            add({ type: 'number', value: readNumber() }, tokenLine, tokenColumn);
            continue;
        }
        if (isNameStart(char)) {
            const start = offset;
            while (isNamePart(source[offset])) advance();
            const value = source.slice(start, offset);
            add({ type: keywords.has(value) ? 'keyword' : 'name', value },
                tokenLine, tokenColumn);
            continue;
        }
        if (source.startsWith('...', offset)) {
            advance(); advance(); advance();
            add({ type: 'symbol', value: '...' }, tokenLine, tokenColumn);
            continue;
        }
        const pair = source.slice(offset, offset + 2);
        if (doubleSymbols.has(pair)) {
            advance(); advance();
            add({ type: 'symbol', value: pair }, tokenLine, tokenColumn);
            continue;
        }
        if ('+-*/%^#&~|<>=(){}[];:,.'.includes(char)) {
            advance();
            add({ type: 'symbol', value: char }, tokenLine, tokenColumn);
            continue;
        }
        fail(`unexpected character ${JSON.stringify(char)}`);
    }

    tokens.push({ type: 'eof', value: '<eof>', line, column });
    return tokens;
}
