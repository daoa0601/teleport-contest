import { lexLua } from './lexer.js';
import type { LuaToken } from './lexer.js';
import { luaSyntaxError } from './syntax_error.js';
import type {
    AssignmentTarget, BinaryOperator, Expression, FunctionExpression,
    IfClause, LiteralExpression, Program, Statement, StatementBody, TableExpression,
    TableField, UnaryOperator,
} from './ast.js';

export type { Expression, Program, Statement } from './ast.js';

const binaryPrecedence: Readonly<Record<BinaryOperator, number>> = {
    or: 1, and: 2,
    '<': 3, '>': 3, '<=': 3, '>=': 3, '~=': 3, '==': 3,
    '|': 4, '~': 5, '&': 6, '<<': 7, '>>': 7,
    '..': 8, '+': 9, '-': 9,
    '*': 10, '/': 10, '//': 10, '%': 10, '^': 12,
};

function isBinaryOperator(value: string | number): value is BinaryOperator {
    return typeof value === 'string' && Object.hasOwn(binaryPrecedence, value);
}

function isUnaryOperator(value: string | number): value is UnaryOperator {
    return value === 'not' || value === '#' || value === '-' || value === '~';
}

const rightAssociative = new Set(['..', '^']);
const blockEnds = new Set(['end', 'else', 'elseif', 'until']);

export function parseLua(source: string, filename = '<lua>'): Program {
    const tokens = lexLua(source, filename);
    let cursor = 0;

    function current(): LuaToken {
        const token = tokens[cursor];
        if (!token) throw new Error('Lua parser advanced past the end of its tokens');
        return token;
    }

    function fail(message: string, token = current()): never {
        const near = token.type === 'eof' ? '<eof>' : `'${token.text}'`;
        throw luaSyntaxError(filename, token.line, message, near);
    }

    function is(value: string): boolean {
        const token = current();
        return (token.type === 'symbol' || token.type === 'keyword')
            && token.value === value;
    }

    function atBlockEnd(stops: ReadonlySet<string>): boolean {
        const value = current().value;
        return typeof value === 'string' && stops.has(value);
    }

    function take(value: string | null = null): LuaToken {
        const token = current();
        if (value !== null && token.value !== value)
            fail(`'${value}' expected`, token);
        cursor++;
        return token;
    }

    function takeName(): string {
        const token = current();
        if (token.type !== 'name') fail('<name> expected');
        take();
        return token.value;
    }

    // Lua check_match() identifies the opening construct when it is on an earlier line.
    function takeClosing(value: string, opening: LuaToken): void {
        if (!is(value)) {
            const context = opening.line === current().line ? ''
                : ` (to close '${opening.value}' at line ${opening.line})`;
            fail(`'${value}' expected${context}`);
        }
        take(value);
    }

    function parseExpressionList(): Expression[] {
        const expressions = [parseExpression()];
        while (is(',')) {
            take(',');
            expressions.push(parseExpression());
        }
        return expressions;
    }

    function parseBlock(stops: ReadonlySet<string> = blockEnds): Statement[] {
        const body: Statement[] = [];
        while (current().type !== 'eof' && !atBlockEnd(stops)) {
            if (is(';')) {
                take(';');
                continue;
            }
            const line = current().line;
            body.push({ ...parseStatement(), line });
            if (is(';')) take(';');
        }
        return body;
    }

    function parseFunctionBody(opening: LuaToken): FunctionExpression {
        take('(');
        const parameters: string[] = [];
        let vararg = false;
        if (!is(')')) {
            for (;;) {
                if (is('...')) {
                    take('...');
                    vararg = true;
                    break;
                }
                if (current().type !== 'name') fail("<name> or '...' expected");
                parameters.push(takeName());
                if (!is(',')) break;
                take(',');
            }
        }
        take(')');
        const body = parseBlock(new Set(['end']));
        takeClosing('end', opening);
        return { type: 'Function', filename, line: opening.line, parameters, vararg, body };
    }

    function parseFunctionStatement(): Extract<StatementBody, { type: 'Assign' }> {
        const opening = take('function');
        let target: AssignmentTarget = { type: 'Name', name: takeName() };
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
        const expression = parseFunctionBody(opening);
        if (method) expression.parameters.unshift('self');
        return { type: 'Assign', targets: [target], expressions: [expression] };
    }

    function parseLocalStatement(): StatementBody {
        take('local');
        if (is('function')) {
            const opening = take('function');
            const name = takeName();
            return {
                type: 'LocalFunction', name,
                // Lua localfunc() passes the header's current line to body().
                expression: parseFunctionBody({ ...opening, line: current().line }),
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

    function parseIfStatement(): Extract<StatementBody, { type: 'If' }> {
        const opening = take('if');
        const clauses: IfClause[] = [];
        let condition = parseExpression();
        take('then');
        clauses.push({ condition, body: parseBlock() });
        while (is('elseif')) {
            take('elseif');
            condition = parseExpression();
            take('then');
            clauses.push({ condition, body: parseBlock() });
        }
        let otherwise: Statement[] = [];
        if (is('else')) {
            take('else');
            otherwise = parseBlock(new Set(['end']));
        }
        takeClosing('end', opening);
        return { type: 'If', clauses, otherwise };
    }

    function parseForStatement(): StatementBody {
        const opening = take('for');
        const first = takeName();
        if (is('=')) {
            take('=');
            const start = parseExpression();
            take(',');
            const stop = parseExpression();
            const step: Expression = is(',')
                ? (take(','), parseExpression())
                : { type: 'Literal', value: 1 };
            take('do');
            const body = parseBlock(new Set(['end']));
            takeClosing('end', opening);
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
        takeClosing('end', opening);
        return { type: 'ForGeneric', names, expressions, body };
    }

    function parseWhileStatement(): Extract<StatementBody, { type: 'While' }> {
        const opening = take('while');
        const condition = parseExpression();
        take('do');
        const body = parseBlock(new Set(['end']));
        takeClosing('end', opening);
        return { type: 'While', condition, body };
    }

    function parseRepeatStatement(): Extract<StatementBody, { type: 'Repeat' }> {
        const opening = take('repeat');
        const body = parseBlock(new Set(['until']));
        takeClosing('until', opening);
        return { type: 'Repeat', body, condition: parseExpression() };
    }

    function parseReturnStatement(): Extract<StatementBody, { type: 'Return' }> {
        take('return');
        if (current().type === 'eof' || atBlockEnd(blockEnds)
            || is(';')) return { type: 'Return', expressions: [] };
        return { type: 'Return', expressions: parseExpressionList() };
    }

    function assignable(expression: Expression): expression is AssignmentTarget {
        return expression.type === 'Name' || expression.type === 'Index';
    }

    function parseAssignmentOrCall(): StatementBody {
        const first = parseSuffixedExpression();
        if (first.type === 'Call' || first.type === 'MethodCall') {
            if (!is(',') && !is('=')) return { type: 'CallStatement', call: first };
        }
        if ((!is(',') && !is('=')) || !assignable(first)) fail('syntax error');
        const targets: AssignmentTarget[] = [first];
        while (is(',')) {
            take(',');
            const target = parseSuffixedExpression();
            if (!assignable(target)) fail('syntax error');
            targets.push(target);
        }
        take('=');
        return { type: 'Assign', targets, expressions: parseExpressionList() };
    }

    function parseStatement(): StatementBody {
        if (is('local')) return parseLocalStatement();
        if (is('function')) return parseFunctionStatement();
        if (is('if')) return parseIfStatement();
        if (is('for')) return parseForStatement();
        if (is('while')) return parseWhileStatement();
        if (is('repeat')) return parseRepeatStatement();
        if (is('do')) {
            const opening = take('do');
            const body = parseBlock(new Set(['end']));
            takeClosing('end', opening);
            return { type: 'Do', body };
        }
        if (is('return')) return parseReturnStatement();
        if (is('break')) {
            take('break');
            return { type: 'Break' };
        }
        return parseAssignmentOrCall();
    }

    function parseTable(): TableExpression {
        const opening = take('{');
        const fields: TableField[] = [];
        while (!is('}')) {
            if (is('[')) {
                take('[');
                const key = parseExpression();
                take(']');
                take('=');
                fields.push({ key, value: parseExpression() });
            } else if (current().type === 'name'
                && tokens[cursor + 1]?.value === '=') {
                const key: LiteralExpression = { type: 'Literal', value: takeName() };
                take('=');
                fields.push({ key, value: parseExpression() });
            } else {
                fields.push({ key: null, value: parseExpression() });
            }
            if (is(',') || is(';')) take();
            else break;
        }
        takeClosing('}', opening);
        return { type: 'Table', fields };
    }

    function parseArguments(): Expression[] {
        if (is('(')) {
            const opening = take('(');
            const args = is(')') ? [] : parseExpressionList();
            takeClosing(')', opening);
            return args;
        }
        if (is('{')) return [parseTable()];
        if (current().type === 'string')
            return [{ type: 'Literal', value: take().value }];
        fail('function arguments expected');
    }

    function parsePrimary(): Expression {
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
            const opening = take('function');
            // Lua simpleexp() passes the line reached after reading 'function'.
            return parseFunctionBody({ ...opening, line: current().line });
        }
        if (is('{')) return parseTable();
        if (token.type === 'name') {
            take();
            return { type: 'Name', name: token.value };
        }
        if (is('(')) {
            const opening = take('(');
            const expression = parseExpression();
            takeClosing(')', opening);
            return { type: 'Group', expression };
        }
        fail('unexpected symbol');
    }

    function parseSuffixedExpression(): Expression {
        const line = current().line;
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
                    type: 'MethodCall', line, target: expression, method,
                    args: parseArguments(),
                };
            } else if (is('(') || is('{') || current().type === 'string') {
                expression = {
                    type: 'Call', line, callee: expression,
                    args: parseArguments(),
                };
            } else {
                return expression;
            }
        }
    }

    function parseExpression(minimum = 1): Expression {
        let left: Expression;
        const unaryOperator = current().value;
        if ((is('not') || is('#') || is('-') || is('~'))
            && isUnaryOperator(unaryOperator)) {
            take();
            const operator = unaryOperator;
            left = {
                type: 'Unary', operator,
                expression: parseExpression(11),
            };
        } else {
            left = parseSuffixedExpression();
        }

        for (;;) {
            const operator = current().value;
            if (!isBinaryOperator(operator)) break;
            const precedence = binaryPrecedence[operator];
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
    if (current().type !== 'eof') fail('<eof> expected');
    return { type: 'Chunk', body, filename };
}
