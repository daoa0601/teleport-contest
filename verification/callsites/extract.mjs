// Find every call in src/js that resolves to an rng.ts draw function, directly,
// through an alias such as c_d, or through an injected `typeof rn2` field, and
// translate its arguments and dominating guards into terms for check.py.
//
//   node verification/callsites/extract.mjs > .cache/rng-callsites.json
//
// Terms are JSON: {num}, {leaf, text, facts}, {op, args}, {ite}, {cmp}, {not},
// {and}, {or}, {bool}. Leaves are keyed by normalized source text, so a guard
// and an argument that spell the same stable value share one symbol.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rngFile = path.join(repo, 'src/js/rng.ts');
const DRAWS = new Set(['rn2', 'rnd', 'rnl', 'd', 'rnz', 'rne', 'rn1', 'rn2Display']);

const config = ts.getParsedCommandLineOfConfigFile(path.join(repo, 'tsconfig.json'), {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); },
});
const program = ts.createProgram(config.fileNames, config.options);
const checker = program.getTypeChecker();

function drawName(call) {
    const decl = checker.getResolvedSignature(call)?.getDeclaration();
    if (!decl || path.resolve(decl.getSourceFile().fileName) !== rngFile) return null;
    const name = decl.name && ts.isIdentifier(decl.name) ? decl.name.text : null;
    return name && DRAWS.has(name) ? name : null;
}

const text = (n) => n.getText().replace(/\s+/g, ' ');

function strip(n) {
    while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)
        || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n)) n = n.expression;
    return n;
}

function enclosingFunction(n) {
    for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
    return null;
}

// A variable is stable when it is const, or a let/var/parameter never assigned
// after its declaration. Only stable identifiers may be inlined or unified.
const stableCache = new Map();
function stableDeclaration(id) {
    const symbol = resolve(id);
    const decl = symbol?.valueDeclaration;
    if (!decl || !(ts.isVariableDeclaration(decl) || ts.isParameter(decl))) return null;
    if (stableCache.has(decl)) return stableCache.get(decl);
    let stable = true;
    const isConst = ts.isVariableDeclaration(decl) && ts.isVariableDeclarationList(decl.parent)
        && (decl.parent.flags & ts.NodeFlags.Const) !== 0;
    if (!isConst) {
        const scope = enclosingFunction(decl) ?? decl.getSourceFile();
        const visit = (n) => {
            if (!stable) return;
            const target = ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
                && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment ? n.left
                : (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n))
                    && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)
                    ? n.operand : null;
            if (target && ts.isIdentifier(strip(target)) && checker.getSymbolAtLocation(strip(target)) === symbol) {
                stable = false;
            }
            ts.forEachChild(n, visit);
        };
        visit(scope);
    }
    const result = stable ? decl : null;
    stableCache.set(decl, result);
    return result;
}

function literalRange(n) {
    const type = checker.getTypeAtLocation(n);
    const parts = type.isUnion() ? type.types : [type];
    if (parts.length && parts.every((t) => t.isNumberLiteral())) {
        const values = parts.map((t) => t.value);
        return values.length === 1 ? { num: values[0] } : { min: Math.min(...values), max: Math.max(...values) };
    }
    return null;
}

function resolve(id) {
    let symbol = checker.getSymbolAtLocation(id);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
}

// A table is a const array literal without spreads that cannot change: its
// declared type is readonly (lint rejects the casts that could bypass that),
// or every reference only indexes it or reads its length.
const tableCache = new Map();
// Whether an expression is written: assigned (also inside a destructuring
// pattern), incremented, decremented, or deleted.
function isWritten(n) {
    let child = n;
    let p = n.parent;
    while (ts.isParenthesizedExpression(p) || ts.isArrayLiteralExpression(p) || ts.isSpreadElement(p)
        || ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isObjectLiteralExpression(p)) {
        child = p;
        p = p.parent;
    }
    if (ts.isBinaryExpression(p) && p.left === child
        && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true;
    if ((ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer === child) return true;
    if (ts.isPrefixUnaryExpression(n.parent) || ts.isPostfixUnaryExpression(n.parent)) {
        const op = n.parent.operator;
        return op === ts.SyntaxKind.PlusPlusToken || op === ts.SyntaxKind.MinusMinusToken;
    }
    return ts.isDeleteExpression(n.parent);
}

function tableOf(n) {
    n = strip(n);
    if (!ts.isIdentifier(n)) return null;
    const symbol = resolve(n);
    const decl = symbol?.valueDeclaration;
    if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer || !(decl.parent.flags & ts.NodeFlags.Const)) return null;
    const init = strip(decl.initializer);
    if (!ts.isArrayLiteralExpression(init) || init.elements.some((e) => ts.isSpreadElement(e))) return null;
    if (tableCache.has(decl)) return tableCache.get(decl);
    const declared = checker.getTypeAtLocation(decl.name);
    let readOnly = !checker.isArrayType(declared) && !checker.isTupleType(declared) ? false
        : checker.typeToString(declared).startsWith('readonly ');
    if (!readOnly) {
        readOnly = true;
        const visit = (m) => {
            if (!readOnly) return;
            if (ts.isIdentifier(m) && m !== decl.name && resolve(m) === symbol) {
                const p = m.parent;
                const indexed = ts.isElementAccessExpression(p) && p.expression === m && !isWritten(p);
                const length = ts.isPropertyAccessExpression(p) && p.expression === m && p.name.text === 'length';
                const importing = ts.isImportSpecifier(p) || ts.isExportSpecifier(p);
                if (!indexed && !length && !importing) readOnly = false;
            }
            ts.forEachChild(m, visit);
        };
        const exported = (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Export) !== 0;
        if (exported) {
            for (const file of program.getSourceFiles()) if (path.relative(repo, file.fileName).startsWith('src/')) visit(file);
        } else {
            visit(enclosingFunction(decl) ?? decl.getSourceFile());
        }
    }
    const table = readOnly ? init.elements : null;
    tableCache.set(decl, table);
    return table;
}

// table[index], with the index known or not. Out-of-range reads are undefined
// in JavaScript; the range fact assumes the index is in bounds.
function tableRead(tableNode, indexNode, n, depth) {
    const table = tableOf(tableNode);
    if (!table) return null;
    const index = term(indexNode, depth);
    if ('num' in index && Number.isInteger(index.num) && index.num >= 0 && index.num < table.length) {
        return term(table[index.num], depth);
    }
    const values = table.map((e) => term(e, depth));
    if (!values.length || !values.every((v) => 'num' in v)) return null;
    const nums = values.map((v) => v.num);
    return { leaf: true, text: text(n), facts: [['range', Math.min(...nums), Math.max(...nums)]], data: true };
}

// requireMonsterData(table, i)-style accessors: <T>(table: readonly T[], i): T
// that return table[i] or throw.
function isTableAccessor(decl) {
    if (!decl || !ts.isFunctionDeclaration(decl) || decl.typeParameters?.length !== 1 || decl.parameters.length !== 2) return false;
    const t = decl.typeParameters[0].name.text;
    return decl.type?.getText() === t && decl.parameters[0].type?.getText() === `readonly ${t}[]`;
}

const BITWISE = {
    '&': (a, b) => a & b, '|': (a, b) => a | b, '^': (a, b) => a ^ b,
    '<<': (a, b) => a << b, '>>': (a, b) => a >> b, '>>>': (a, b) => a >>> b,
};
const MATH = new Set(['max', 'min', 'abs', 'floor', 'ceil', 'trunc', 'round', 'sign']);

function term(n, depth = 0) {
    n = strip(n);
    if (ts.isNumericLiteral(n)) return { num: Number(n.text) };
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) {
        return { op: '-', args: [{ num: 0 }, term(n.operand, depth)] };
    }
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.PlusToken) return term(n.operand, depth);
    if (ts.isPrefixUnaryExpression(n) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) {
        const op = n.operator === ts.SyntaxKind.PlusPlusToken ? '+' : '-';
        return { op, args: [term(n.operand, depth), { num: 1 }] };
    }
    const literal = literalRange(n);
    if (literal && 'num' in literal) return literal;
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.TildeToken) {
        const a = term(n.operand, depth);
        if ('num' in a) return { num: ~a.num };
    }
    if (ts.isBinaryExpression(n)) {
        const op = n.operatorToken.getText();
        if (['+', '-', '*', '/', '%'].includes(op)) return { op, args: [term(n.left, depth), term(n.right, depth)] };
        if (op === '**' && ts.isNumericLiteral(strip(n.right)) && strip(n.right).text === '2') {
            const base = term(n.left, depth);
            return { op: '*', args: [base, base] };
        }
        if (BITWISE[op]) {
            const a = term(n.left, depth), b = term(n.right, depth);
            if ('num' in a && 'num' in b) return { num: BITWISE[op](a.num, b.num) };
            const mask = op === '&' ? ('num' in b ? b.num : 'num' in a ? a.num : null) : null;
            if (mask !== null && mask >= 0) return { leaf: true, text: text(n), facts: [['range', 0, mask]] };
        }
        if (op === '||') return { ite: [truth(n.left, depth), term(n.left, depth), term(n.right, depth)] };
        if (op === '??') return { ite: [{ bool: `?? ${text(n)}` }, term(n.left, depth), term(n.right, depth)] };
    }
    if (ts.isConditionalExpression(n)) {
        return { ite: [truth(n.condition, depth), term(n.whenTrue, depth), term(n.whenFalse, depth)] };
    }
    if (ts.isCallExpression(n)) {
        const callee = strip(n.expression);
        if (ts.isPropertyAccessExpression(callee) && text(callee.expression) === 'Math' && MATH.has(callee.name.text)) {
            return { op: `Math.${callee.name.text}`, args: n.arguments.map((a) => term(a, depth)) };
        }
        const draw = drawName(n);
        if (draw) return { leaf: true, text: text(n), draw, args: n.arguments.map((a) => term(a, depth)) };
        if (ts.isIdentifier(callee) && callee.text === 'Number' && n.arguments.length === 1) {
            const arg = n.arguments[0];
            if ((checker.getTypeAtLocation(arg).flags & ts.TypeFlags.BooleanLike) !== 0) {
                return { ite: [truth(arg, depth), { num: 1 }, { num: 0 }] };
            }
        }
    }
    if (ts.isIdentifier(n) && depth < 6) {
        const decl = stableDeclaration(n);
        const moduleConst = decl && ts.isVariableDeclaration(decl) && !enclosingFunction(decl)
            && (decl.parent.flags & ts.NodeFlags.Const) !== 0;
        if (decl && ts.isVariableDeclaration(decl) && decl.initializer
            && (enclosingFunction(decl) === enclosingFunction(n) || moduleConst)) {
            return term(decl.initializer, depth + 1);
        }
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'length') {
        const table = tableOf(n.expression);
        if (table) return { num: table.length };
    }
    if (ts.isElementAccessExpression(n)) {
        const read = tableRead(n.expression, n.argumentExpression, n, depth);
        if (read) return read;
    }
    if (ts.isCallExpression(n) && n.arguments.length === 2
        && isTableAccessor(checker.getResolvedSignature(n)?.getDeclaration())) {
        const read = tableRead(n.arguments[0], n.arguments[1], n, depth);
        if (read) return read;
    }
    const facts = [];
    if (literal) facts.push(['range', literal.min, literal.max]);
    if (ts.isPropertyAccessExpression(n) && ['length', 'size'].includes(n.name.text)) facts.push(['nonneg']);
    const leaf = { leaf: true, text: text(n), facts };
    if (ts.isPropertyAccessExpression(n) && ['lx', 'hx', 'ly', 'hy'].includes(n.name.text)) {
        leaf.owner = ownerType(n.expression, depth);
    }
    if (depth < SUMMARY_DEPTH) {
        if (ts.isCallExpression(n)) {
            const decl = checker.getResolvedSignature(n)?.getDeclaration();
            const key = decl && summarize(decl, depth + 1);
            if (key) leaf.fn = key;
        } else if (ts.isIdentifier(n)) {
            const decl = stableDeclaration(n);
            if (decl && ts.isParameter(decl) && enclosingFunction(n) === decl.parent) {
                const key = summarize(decl.parent, depth + 1);
                if (key) leaf.param = { fn: key, index: decl.parent.parameters.indexOf(decl) };
            }
        }
    }
    return leaf;
}

function truth(n, depth = 0) {
    n = strip(n);
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) {
        return { not: truth(n.operand, depth) };
    }
    if (ts.isBinaryExpression(n)) {
        const op = n.operatorToken.getText();
        if (op === '&&') return { and: [truth(n.left, depth), truth(n.right, depth)] };
        if (op === '||') return { or: [truth(n.left, depth), truth(n.right, depth)] };
        if (['<', '<=', '>', '>=', '===', '!==', '==', '!='].includes(op)) {
            const numeric = (e) => {
                const t = checker.getTypeAtLocation(e);
                return (t.flags & ts.TypeFlags.NumberLike) !== 0;
            };
            if (numeric(n.left) && numeric(n.right)) {
                return { cmp: op.replace('===', '==').replace('!==', '!='), args: [term(n.left, depth), term(n.right, depth)] };
            }
        }
    }
    const t = checker.getTypeAtLocation(n);
    if ((t.flags & ts.TypeFlags.NumberLike) !== 0) return { cmp: '!=', args: [term(n, depth), { num: 0 }] };
    return { bool: text(n) };
}

// One level of interprocedural facts. For a function with a body in src/js:
// its return expressions with their guards, and, when the function never
// escapes (every reference is a direct call), every caller's arguments.
const SUMMARY_DEPTH = 3;
const summaries = {};
const callsOf = new Map();       // declaration -> call expressions
const escaped = new Set();       // declarations referenced other than as a callee

function declKey(decl) {
    return `${path.relative(repo, decl.getSourceFile().fileName)}:${decl.getStart()}`;
}

function summarize(decl, depth) {
    if (!decl || !ts.isFunctionLike(decl) || !decl.body) return null;
    if (!path.relative(repo, decl.getSourceFile().fileName).startsWith('src/js/')) return null;
    const key = declKey(decl);
    if (key in summaries) return key;
    summaries[key] = null;   // cycle guard
    const returns = [];
    if (!ts.isBlock(decl.body)) {
        returns.push({ term: term(decl.body, depth), guards: [] });
    } else {
        const visit = (n) => {
            if (n !== decl && ts.isFunctionLike(n)) return;
            if (ts.isReturnStatement(n)) {
                returns.push(n.expression ? { term: term(n.expression, depth), guards: guards(n, depth) } : { undefined: true });
            }
            ts.forEachChild(n, visit);
        };
        visit(decl.body);
        if (!exits(decl.body)) returns.push({ undefined: true });
    }
    const callers = escaped.has(decl) ? null : (callsOf.get(decl) ?? []).map((call) => ({
        site: `${path.relative(repo, call.getSourceFile().fileName)}:${call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line + 1}`,
        args: decl.parameters.map((prm, i) => (i < call.arguments.length ? term(call.arguments[i], depth)
            : prm.initializer ? term(prm.initializer, depth) : { undefined: true })),
        guards: guards(call, depth),
    }));
    summaries[key] = { name: decl.name ? decl.name.getText() : '(anonymous)', returns, callers };
    return key;
}

// The type of a record whose fields are read. A parameter of a non-escaping
// function takes the type every direct caller passes, so a helper declared
// over Rectangle still counts as a room helper when only rooms reach it.
function ownerType(n, depth) {
    n = strip(n);
    const type = checker.typeToString(checker.getNonNullableType(checker.getTypeAtLocation(n)));
    if (!ts.isIdentifier(n) || depth >= SUMMARY_DEPTH) return type;
    const decl = stableDeclaration(n);
    if (!decl || !ts.isParameter(decl) || enclosingFunction(n) !== decl.parent || escaped.has(decl.parent)) return type;
    const index = decl.parent.parameters.indexOf(decl);
    const owners = new Set((callsOf.get(decl.parent) ?? []).map((call) =>
        call.arguments[index] ? ownerType(call.arguments[index], depth + 1) : 'undefined'));
    return owners.size === 1 ? [...owners][0] : type;
}

function indexCalls() {
    for (const file of program.getSourceFiles()) {
        if (!path.relative(repo, file.fileName).startsWith('src/')) continue;
        const visit = (n) => {
            if (ts.isCallExpression(n)) {
                const decl = checker.getResolvedSignature(n)?.getDeclaration();
                if (decl && ts.isFunctionLike(decl)) {
                    if (!callsOf.has(decl)) callsOf.set(decl, []);
                    callsOf.get(decl).push(n);
                }
            }
            if (ts.isIdentifier(n)) {
                const p = n.parent;
                const callee = (ts.isCallExpression(p) && p.expression === n)
                    || (ts.isPropertyAccessExpression(p) && p.name === n && ts.isCallExpression(p.parent) && p.parent.expression === p);
                const declaring = (p.name === n) && (ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isMethodDeclaration(p));
                const importing = ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p);
                if (!callee && !declaring && !importing) {
                    let symbol = checker.getSymbolAtLocation(n);
                    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
                    for (const decl of symbol?.declarations ?? []) {
                        escaped.add(decl);
                        if (ts.isVariableDeclaration(decl) && decl.initializer) escaped.add(strip(decl.initializer));
                    }
                }
            }
            ts.forEachChild(n, visit);
        };
        visit(file);
    }
}

const exits = (s) => {
    if (ts.isBlock(s)) return s.statements.length > 0 && exits(s.statements[s.statements.length - 1]);
    return ts.isReturnStatement(s) || ts.isThrowStatement(s) || ts.isContinueStatement(s) || ts.isBreakStatement(s);
};

// Conditions that hold whenever the call runs, within its function.
function guards(call, depth = 0) {
    const truth0 = truth;
    const truthAt = (e) => truth0(e, depth);
    const out = [];
    let child = call;
    for (let p = call.parent; p && !ts.isFunctionLike(p); child = p, p = p.parent) {
        if (ts.isIfStatement(p) && child !== p.expression) {
            out.push(child === p.thenStatement ? truthAt(p.expression) : { not: truthAt(p.expression) });
        } else if (ts.isConditionalExpression(p) && child !== p.condition) {
            out.push(child === p.whenTrue ? truthAt(p.condition) : { not: truthAt(p.condition) });
        } else if (ts.isBinaryExpression(p) && child === p.right) {
            const op = p.operatorToken.kind;
            if (op === ts.SyntaxKind.AmpersandAmpersandToken) out.push(truthAt(p.left));
            if (op === ts.SyntaxKind.BarBarToken) out.push({ not: truthAt(p.left) });
        } else if ((ts.isWhileStatement(p) || ts.isForStatement(p)) && child === p.statement && p.condition !== undefined) {
            out.push(truthAt(ts.isWhileStatement(p) ? p.expression : p.condition));
        } else if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) {
            for (const s of p.statements) {
                if (s === child) break;
                if (ts.isIfStatement(s) && !s.elseStatement && exits(s.thenStatement)) out.push({ not: truthAt(s.expression) });
            }
        }
    }
    return out;
}

indexCalls();
const sites = [];
for (const file of program.getSourceFiles()) {
    const rel = path.relative(repo, file.fileName);
    if (!rel.startsWith('src/js/') || path.resolve(file.fileName) === rngFile) continue;
    const visit = (n) => {
        if (ts.isCallExpression(n)) {
            const draw = drawName(n);
            if (draw) {
                const fn = enclosingFunction(n);
                const fnName = fn && fn.name ? fn.name.getText() : '(anonymous)';
                sites.push({
                    file: rel, line: file.getLineAndCharacterOfPosition(n.getStart()).line + 1,
                    fn: fnName, draw, callee: text(n.expression), args: n.arguments.map((a) => text(a)),
                    terms: n.arguments.map((a) => term(a)), guards: guards(n),
                });
            }
        }
        ts.forEachChild(n, visit);
    };
    visit(file);
}
process.stdout.write(JSON.stringify({ sites, summaries }));
