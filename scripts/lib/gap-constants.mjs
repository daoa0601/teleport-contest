// gap-constants.mts — the port's named constants checked by the C compiler.
//
// Every exported upper-case numeric constant and enum member in `src/js`
// whose name is also a C macro or enum constant becomes one
// `_Static_assert(NAME == value)` compiled against the pinned headers. clang
// evaluates the C side, so macros, enums and conditional definitions resolve
// exactly as the recorder build resolves them.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { forEachTopLevelDecl, walkJson } from './c-sources.mjs';
import { isPortSource, portProgram } from './port-program.mjs';
const C_STYLE_NAME = /^[A-Z][A-Z0-9_]*$/;
// Integer operators as C evaluates them on `int` operands.
const BINARY_OPERATORS = new Map([
    [ts.SyntaxKind.PlusToken, (left, right) => left + right],
    [ts.SyntaxKind.MinusToken, (left, right) => left - right],
    [ts.SyntaxKind.AsteriskToken, (left, right) => left * right],
    [ts.SyntaxKind.BarToken, (left, right) => BigInt.asIntN(32, left | right)],
    [ts.SyntaxKind.AmpersandToken, (left, right) => BigInt.asIntN(32, left & right)],
    [ts.SyntaxKind.CaretToken, (left, right) => BigInt.asIntN(32, left ^ right)],
    [ts.SyntaxKind.LessThanLessThanToken, (left, right) => BigInt.asIntN(32, left << right)],
    [ts.SyntaxKind.GreaterThanGreaterThanToken, (left, right) => BigInt.asIntN(32, left >> right)],
]);
// Exported constants with integer values the checker can establish.
export function portConstants(root) {
    const program = portProgram(root);
    const checker = program.getTypeChecker();
    const constants = [];
    const uses = new Map();
    const count = (node) => {
        if (ts.isIdentifier(node) && C_STYLE_NAME.test(node.text))
            uses.set(node.text, (uses.get(node.text) ?? 0) + 1);
        ts.forEachChild(node, count);
    };
    const evaluate = (node, depth) => {
        if (depth > 20)
            return null;
        if (ts.isNumericLiteral(node)) {
            const value = Number(node.text);
            return Number.isSafeInteger(value) ? BigInt(value) : null;
        }
        if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
            return evaluate(node.expression, depth + 1);
        }
        if (ts.isPrefixUnaryExpression(node)) {
            const operand = evaluate(node.operand, depth + 1);
            if (operand === null)
                return null;
            if (node.operator === ts.SyntaxKind.MinusToken)
                return -operand;
            if (node.operator === ts.SyntaxKind.PlusToken)
                return operand;
            if (node.operator === ts.SyntaxKind.TildeToken)
                return BigInt.asIntN(32, ~operand);
            return null;
        }
        if (ts.isBinaryExpression(node)) {
            const left = evaluate(node.left, depth + 1), right = evaluate(node.right, depth + 1);
            if (left === null || right === null)
                return null;
            const operate = BINARY_OPERATORS.get(node.operatorToken.kind);
            return operate ? operate(left, right) : null;
        }
        if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
            if (ts.isPropertyAccessExpression(node)) {
                const member = checker.getConstantValue(node);
                return typeof member === 'number' && Number.isSafeInteger(member) ? BigInt(member) : null;
            }
            let symbol = checker.getSymbolAtLocation(node);
            if (symbol && symbol.flags & ts.SymbolFlags.Alias)
                symbol = checker.getAliasedSymbol(symbol);
            const declaration = symbol?.valueDeclaration;
            if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer)
                return null;
            if (!(ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const))
                return null;
            return evaluate(declaration.initializer, depth + 1);
        }
        return null;
    };
    for (const source of program.getSourceFiles()) {
        if (!isPortSource(root, source))
            continue;
        const file = relative(root, source.fileName);
        count(source);
        const exported = (node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        for (const statement of source.statements) {
            if (ts.isVariableStatement(statement) && exported(statement)
                && statement.declarationList.flags & ts.NodeFlags.Const) {
                for (const declaration of statement.declarationList.declarations) {
                    if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
                        continue;
                    const name = declaration.name.text;
                    if (!C_STYLE_NAME.test(name))
                        continue;
                    const value = evaluate(declaration.initializer, 0);
                    if (value !== null)
                        constants.push({ name, value, file, line: lineOf(declaration) });
                }
            }
            else if (ts.isEnumDeclaration(statement) && exported(statement)) {
                for (const member of statement.members) {
                    const value = checker.getConstantValue(member);
                    if (typeof value !== 'number' || !Number.isSafeInteger(value))
                        continue;
                    constants.push({ name: member.name.getText(source), value: BigInt(value), file, line: lineOf(member) });
                }
            }
        }
    }
    return { constants, uses };
}
// Object-like macro names and enum constant names visible through hack.h.
async function cNames(tree, cacheDir) {
    const unit = join(cacheDir, 'names.c');
    writeFileSync(unit, '#include "hack.h"\n');
    const macros = spawnSync('clang', [...tree.clangArgs.filter(arg => arg !== '-fsyntax-only'), '-E', '-dM', unit], { cwd: tree.dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (macros.status !== 0)
        throw new Error(`clang -dM failed: ${macros.stderr.slice(0, 2000)}`);
    const names = new Set();
    for (const line of macros.stdout.split('\n')) {
        const match = /^#define ([A-Za-z_][A-Za-z0-9_]*)(\(| |$)/.exec(line);
        if (match?.[1] && match[2] !== '(')
            names.add(match[1]);
    }
    await forEachTopLevelDecl(tree, unit, (decl, tracker) => {
        walkJson(decl, tracker, node => {
            const name = node['name'];
            if (node['kind'] === 'EnumConstantDecl' && typeof name === 'string')
                names.add(name);
        });
    });
    return names;
}
const literal = (value) => `(${value}LL)`;
export async function checkConstants(root, tree, cacheDir) {
    mkdirSync(cacheDir, { recursive: true });
    const known = await cNames(tree, cacheDir);
    const byName = new Map();
    const port = portConstants(root);
    for (const constant of port.constants) {
        if (!known.has(constant.name))
            continue;
        byName.set(constant.name, [...(byName.get(constant.name) ?? []), constant]);
    }
    // One assertion line per distinct port value, so duplicate definitions
    // that disagree are each checked.
    const lines = ['#include "hack.h"'];
    const lineOwner = new Map();
    for (const [name, definitions] of [...byName].sort((a, b) => a[0].localeCompare(b[0]))) {
        for (const value of new Set(definitions.map(definition => definition.value))) {
            // JS bitwise operators yield int32, so a negative port value also
            // matches the same 32 bits as an unsigned C mask (0x80000000U).
            const unsigned = value < 0n && value >= -(2n ** 31n)
                ? ` || (long long)(${name}) == ${literal(value + 2n ** 32n)}` : '';
            lines.push(`_Static_assert((long long)(${name}) == ${literal(value)}${unsigned}, "${name}");`);
            lineOwner.set(lines.length, name);
        }
    }
    const unit = join(cacheDir, 'constants.c');
    writeFileSync(unit, lines.join('\n') + '\n');
    const result = spawnSync('clang', [...tree.clangArgs, '-ferror-limit=0', unit], { cwd: tree.dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (result.error)
        throw new Error(`clang could not run the constant assertions: ${result.error.message}`);
    if (result.signal !== null || result.status === null) {
        throw new Error(`clang stopped on the constant assertions (${result.signal ?? 'no exit status'})`);
    }
    const failures = new Map();
    const diagnostics = result.stderr.split('\n');
    // A name counts as matching only when clang finished and every error it
    // reported is an assertion line's own diagnostic.
    const unexplained = diagnostics.filter(text => /\b(?:fatal )?error: /.test(text)
        && !/constants\.c:(\d+):\d+: error: /.test(text));
    const explained = diagnostics.filter(text => /constants\.c:(\d+):\d+: error: /.test(text));
    if (unexplained.length || (result.status !== 0 && !explained.length)) {
        throw new Error(`clang failed outside the constant assertions (exit ${result.status}): `
            + (unexplained[0] ?? result.stderr.slice(0, 2000)));
    }
    diagnostics.forEach((text, index) => {
        const match = /constants\.c:(\d+):\d+: error: (.*)$/.exec(text);
        if (!match?.[1] || match[2] === undefined)
            return;
        const name = lineOwner.get(Number(match[1]));
        if (!name)
            throw new Error(`clang reported an error on constants.c line ${match[1]}, which holds no assertion`);
        if (failures.get(name)?.status === 'incomparable')
            return;
        if (match[2].startsWith('static assertion failed')) {
            const note = diagnostics.slice(index + 1, index + 6).map(line => /evaluates to '(.*) == /.exec(line)?.[1])
                .find(value => value !== undefined);
            failures.set(name, { status: 'mismatch', cValue: note ?? null, detail: match[2] });
        }
        else
            failures.set(name, { status: 'incomparable', cValue: null, detail: match[2] });
    });
    return [...byName].sort((a, b) => a[0].localeCompare(b[0])).map(([name, definitions]) => {
        const failure = failures.get(name);
        const uses = (port.uses.get(name) ?? 0) - definitions.length;
        return failure ? { name, port: definitions, uses, ...failure }
            : { name, port: definitions, uses, status: 'match', cValue: String(definitions[0]?.value ?? ''), detail: '' };
    });
}
//# sourceMappingURL=gap-constants.mjs.map