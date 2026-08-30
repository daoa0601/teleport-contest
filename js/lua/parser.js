import { lexLua } from './lexer.js';

const binaryPrecedence = new Map([
    ['or', 1], ['and', 2],
    ['<', 3], ['>', 3], ['<=', 3], ['>=', 3], ['~=', 3], ['==', 3],
    ['|', 4], ['~', 5], ['&', 6], ['<<', 7], ['>>', 7],
    ['..', 8], ['+', 9], ['-', 9],
    ['*', 10], ['/', 10], ['//', 10], ['%', 10], ['^', 12],
]);

const rightAssociative = new Set(['..', '^']);
const blockEnds = new Set(['end', 'else', 'elseif', 'until']);

export function parseLua(source, filename = '<lua>') {
    const tokens = lexLua(source, filename);
    let cursor = 0;

    function current() {
        return tokens[cursor];
    }

    function fail(message, token = current()) {
        throw new SyntaxError(
            `${filename}:${token.line}:${token.column}: ${message}`,
        );
    }

    function is(value) {
        return current().value === value;
    }

    function take(value = null) {
        const token = current();
        if (value !== null && token.value !== value)
            fail(`expected ${value}, found ${token.value}`, token);
        cursor++;
        return token;
    }

    function takeName() {
        if (current().type !== 'name') fail(`expected a name, found ${current().value}`);
        return take().value;
    }

    function parseExpressionList() {
        const expressions = [parseExpression()];
        while (is(',')) {
            take(',');
            expressions.push(parseExpression());
        }
        return expressions;
    }

    function parseBlock(stops = blockEnds) {
        const body = [];
        while (current().type !== 'eof' && !stops.has(current().value)) {
            if (is(';')) {
                take(';');
                continue;
            }
            body.push(parseStatement());
            if (is(';')) take(';');
        }
        return body;
    }

    function parseFunctionBody() {
        take('(');
        const parameters = [];
        let vararg = false;
        if (!is(')')) {
            for (;;) {
                if (is('...')) {
                    take('...');
                    vararg = true;
                    break;
                }
                parameters.push(takeName());
                if (!is(',')) break;
                take(',');
            }
        }
        take(')');
        const body = parseBlock(new Set(['end']));
        take('end');
        return { type: 'Function', parameters, vararg, body };
    }

    function parseFunctionStatement() {
        take('function');
        let target = { type: 'Name', name: takeName() };
        while (is('.')) {
            take('.');
            target = {
                type: 'Index', target,
                key: { type: 'Literal', value: takeName() },
            };
        }
        let method = false;
        if (is(':')) {
            take(':');
            method = true;
            target = {
                type: 'Index', target,
                key: { type: 'Literal', value: takeName() },
            };
        }
        const expression = parseFunctionBody();
        if (method) expression.parameters.unshift('self');
        return { type: 'Assign', targets: [target], expressions: [expression] };
    }

    function parseLocalStatement() {
        take('local');
        if (is('function')) {
            take('function');
            const name = takeName();
            return {
                type: 'LocalFunction', name,
                expression: parseFunctionBody(),
            };
        }
        const names = [takeName()];
        while (is(',')) {
            take(',');
            names.push(takeName());
        }
        const expressions = is('=')
            ? (take('='), parseExpressionList()) : [];
        return { type: 'Local', names, expressions };
    }

    function parseIfStatement() {
        take('if');
        const clauses = [];
        let condition = parseExpression();
        take('then');
        clauses.push({ condition, body: parseBlock() });
        while (is('elseif')) {
            take('elseif');
            condition = parseExpression();
            take('then');
            clauses.push({ condition, body: parseBlock() });
        }
        let otherwise = [];
        if (is('else')) {
            take('else');
            otherwise = parseBlock(new Set(['end']));
        }
        take('end');
        return { type: 'If', clauses, otherwise };
    }

    function parseForStatement() {
        take('for');
        const first = takeName();
        if (is('=')) {
            take('=');
            const start = parseExpression();
            take(',');
            const stop = parseExpression();
            const step = is(',')
                ? (take(','), parseExpression())
                : { type: 'Literal', value: 1 };
            take('do');
            const body = parseBlock(new Set(['end']));
            take('end');
            return { type: 'ForNumeric', name: first, start, stop, step, body };
        }

        const names = [first];
        while (is(',')) {
            take(',');
            names.push(takeName());
        }
        take('in');
        const expressions = parseExpressionList();
        take('do');
        const body = parseBlock(new Set(['end']));
        take('end');
        return { type: 'ForGeneric', names, expressions, body };
    }

    function parseWhileStatement() {
        take('while');
        const condition = parseExpression();
        take('do');
        const body = parseBlock(new Set(['end']));
        take('end');
        return { type: 'While', condition, body };
    }

    function parseRepeatStatement() {
        take('repeat');
        const body = parseBlock(new Set(['until']));
        take('until');
        return { type: 'Repeat', body, condition: parseExpression() };
    }

    function parseReturnStatement() {
        take('return');
        if (current().type === 'eof' || blockEnds.has(current().value)
            || is(';')) return { type: 'Return', expressions: [] };
        return { type: 'Return', expressions: parseExpressionList() };
    }

    function assignable(expression) {
        return expression.type === 'Name' || expression.type === 'Index';
    }

    function parseAssignmentOrCall() {
        const first = parseSuffixedExpression();
        if (first.type === 'Call' || first.type === 'MethodCall') {
            if (!is(',') && !is('=')) return { type: 'CallStatement', call: first };
        }
        if (!assignable(first)) fail('expected an assignment or function call');
        const targets = [first];
        while (is(',')) {
            take(',');
            const target = parseSuffixedExpression();
            if (!assignable(target)) fail('invalid assignment target');
            targets.push(target);
        }
        take('=');
        return { type: 'Assign', targets, expressions: parseExpressionList() };
    }

    function parseStatement() {
        if (is('local')) return parseLocalStatement();
        if (is('function')) return parseFunctionStatement();
        if (is('if')) return parseIfStatement();
        if (is('for')) return parseForStatement();
        if (is('while')) return parseWhileStatement();
        if (is('repeat')) return parseRepeatStatement();
        if (is('do')) {
            take('do');
            const body = parseBlock(new Set(['end']));
            take('end');
            return { type: 'Do', body };
        }
        if (is('return')) return parseReturnStatement();
        if (is('break')) {
            take('break');
            return { type: 'Break' };
        }
        return parseAssignmentOrCall();
    }

    function parseTable() {
        take('{');
        const fields = [];
        while (!is('}')) {
            if (is('[')) {
                take('[');
                const key = parseExpression();
                take(']');
                take('=');
                fields.push({ key, value: parseExpression() });
            } else if (current().type === 'name'
                && tokens[cursor + 1]?.value === '=') {
                const key = { type: 'Literal', value: takeName() };
                take('=');
                fields.push({ key, value: parseExpression() });
            } else {
                fields.push({ key: null, value: parseExpression() });
            }
            if (is(',') || is(';')) take();
            else if (!is('}')) fail('expected a table field separator');
        }
        take('}');
        return { type: 'Table', fields };
    }

    function parseArguments() {
        if (is('(')) {
            take('(');
            const args = is(')') ? [] : parseExpressionList();
            take(')');
            return args;
        }
        if (is('{')) return [parseTable()];
        if (current().type === 'string')
            return [{ type: 'Literal', value: take().value }];
        fail('expected function arguments');
    }

    function parsePrimary() {
        const token = current();
        if (token.type === 'number' || token.type === 'string') {
            take();
            return { type: 'Literal', value: token.value };
        }
        if (is('nil') || is('true') || is('false')) {
            take();
            return {
                type: 'Literal',
                value: token.value === 'nil' ? null : token.value === 'true',
            };
        }
        if (is('...')) {
            take('...');
            return { type: 'Vararg' };
        }
        if (is('function')) {
            take('function');
            return parseFunctionBody();
        }
        if (is('{')) return parseTable();
        if (token.type === 'name') {
            take();
            return { type: 'Name', name: token.value };
        }
        if (is('(')) {
            take('(');
            const expression = parseExpression();
            take(')');
            return { type: 'Group', expression };
        }
        fail(`expected an expression, found ${token.value}`);
    }

    function parseSuffixedExpression() {
        let expression = parsePrimary();
        for (;;) {
            if (is('[')) {
                take('[');
                const key = parseExpression();
                take(']');
                expression = { type: 'Index', target: expression, key };
            } else if (is('.')) {
                take('.');
                expression = {
                    type: 'Index', target: expression,
                    key: { type: 'Literal', value: takeName() },
                };
            } else if (is(':')) {
                take(':');
                const method = takeName();
                expression = {
                    type: 'MethodCall', target: expression, method,
                    args: parseArguments(),
                };
            } else if (is('(') || is('{') || current().type === 'string') {
                expression = {
                    type: 'Call', callee: expression,
                    args: parseArguments(),
                };
            } else {
                return expression;
            }
        }
    }

    function parseExpression(minimum = 1) {
        let left;
        if (is('not') || is('#') || is('-') || is('~')) {
            const operator = take().value;
            left = {
                type: 'Unary', operator,
                expression: parseExpression(11),
            };
        } else {
            left = parseSuffixedExpression();
        }

        for (;;) {
            const operator = current().value;
            const precedence = binaryPrecedence.get(operator);
            if (!precedence || precedence < minimum) break;
            take();
            const right = parseExpression(
                rightAssociative.has(operator) ? precedence : precedence + 1,
            );
            left = { type: 'Binary', operator, left, right };
        }
        return left;
    }

    const body = parseBlock(new Set());
    if (current().type !== 'eof') fail(`unexpected ${current().value}`);
    return { type: 'Chunk', body, filename };
}
