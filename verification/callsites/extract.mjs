// Find emitted calls that resolve to an RNG draw, directly,
// through an alias such as c_d, or through an injected `typeof rn2` field, and
// using authored types to identify injected callbacks. Translate the emitted
// arguments and dominating guards into terms for check.py.
//
//   node verification/callsites/extract.mjs > .cache/rng-callsites.json
//
// Terms are JSON: {num}, {leaf, text, facts}, {op, args}, {ite}, {cmp}, {not},
// {and}, {or}, {bool}. Leaf identities include the root binding and separate
// calls or stale reads; equal spelling alone never justifies a guard.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { domainMutants } from './mutants.mjs';

const repo = process.argv[2] === '--root' ? path.resolve(process.argv[3])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rngFile = path.join(repo, 'src/js/rng.ts');
const DRAWS = new Set(['rn2', 'rnd', 'rnl', 'd', 'rnz', 'rne', 'rn1', 'rn2Display']);

const config = ts.getParsedCommandLineOfConfigFile(path.join(repo, 'tsconfig.json'), {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); },
});
const typedProgram = ts.createProgram(config.fileNames.filter(f => f.startsWith(path.join(repo, 'src/js/'))), config.options);
const typedChecker = typedProgram.getTypeChecker();
const emittedFiles = config.fileNames.filter(f => f.startsWith(path.join(repo, 'src/js/')))
    .map(f => f.replace(path.join(repo, 'src/'), `${repo}/`).replace(/\.mts$/, '.mjs').replace(/\.ts$/, '.js'))
    .filter(f => fs.existsSync(f));
const emittedOptions = { ...config.options, allowJs: true, checkJs: true };
let program = ts.createProgram(emittedFiles, emittedOptions);
let checker = program.getTypeChecker();
const typedCalls = new Map();
const typedExpressions = new Map();

function typedDrawName(call) {
    const decl = typedChecker.getResolvedSignature(call)?.getDeclaration();
    if (!decl || path.resolve(decl.getSourceFile().fileName) !== rngFile) return null;
    const name = decl.name && ts.isIdentifier(decl.name) ? decl.name.text : null;
    return name && DRAWS.has(name) ? name : null;
}

// Types identify injected RNG callbacks. The argument, guards, assignments and
// table initializers below always come from the emitted JavaScript. Pair the
// runtime call inventories, rejecting missing or reordered callees rather than
// silently checking a TypeScript call absent from the scoring program.
function runtimeCalls(file) {
    const calls = [];
    const visit = n => {
        if (ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return;
        if (ts.isFunctionDeclaration(n) && !n.body) return;
        if (ts.isCallExpression(n)) calls.push(n);
        ts.forEachChild(n, visit);
    };
    visit(file);
    return calls;
}

function calleeKey(n) {
    n = strip(n);
    if (ts.isIdentifier(n)) return n.text;
    if (ts.isPropertyAccessExpression(n)) return `${calleeKey(n.expression)}.${n.name.text}`;
    return ts.SyntaxKind[n.kind];
}

function expressionKey(n) {
    const names = [];
    for (let p = n; p; p = p.parent) {
        if (ts.isFunctionLike(p)) names.push(p.name?.getText() ?? '(anonymous)');
    }
    return `${names.join('/')}|${text(n)}`;
}

function indexEmittedSources() {
    for (const file of program.getSourceFiles()) {
        const rel = path.relative(repo, file.fileName);
        if (!rel.startsWith('js/')) continue;
        const source = typedProgram.getSourceFile(path.join(repo, 'src', rel.replace(/\.js$/, '.ts')));
        if (!source) throw new Error(`No authored source for ${rel}`);
        const authored = runtimeCalls(source), emitted = runtimeCalls(file);
        const hasDraws = authored.some(call => typedDrawName(call));
        if (hasDraws && authored.length !== emitted.length) throw new Error(`Call inventory differs in ${rel}; run npm run compile`);
        const paired = authored.length === emitted.length
            && authored.every((call, i) => calleeKey(call.expression) === calleeKey(emitted[i].expression));
        for (let i = 0; (hasDraws || paired) && i < emitted.length; i++) {
            if (calleeKey(authored[i].expression) !== calleeKey(emitted[i].expression)) {
                throw new Error(`Callee differs in ${rel} at runtime call ${i + 1}: ${text(strip(authored[i].expression))} / ${text(strip(emitted[i].expression))}; run npm run compile`);
            }
            typedCalls.set(emitted[i], authored[i]);
        }
        const expressions = new Map();
        const visit = n => {
            if (ts.isTypeNode(n)) return;
            if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)
                || ts.isCallExpression(n)) {
                const key = expressionKey(n);
                if (!expressions.has(key)) expressions.set(key, []);
                expressions.get(key).push(n);
            }
            ts.forEachChild(n, visit);
        };
        visit(source);
        typedExpressions.set(file, expressions);
    }
}

const declaredTypes = new Map();
function declaredType(n) {
    if (declaredTypes.has(n)) return declaredTypes.get(n);
    const nodes = typedExpressions.get(n.getSourceFile())?.get(expressionKey(n)) ?? [];
    const types = new Set(nodes.map(node => typedChecker.typeToString(
        typedChecker.getNonNullableType(typedChecker.getTypeAtLocation(node)))));
    const result = types.size === 1 ? [...types][0] : null;
    declaredTypes.set(n, result);
    return result;
}

function drawName(call) {
    const typed = typedCalls.get(call);
    const decl = checker.getResolvedSignature(call)?.getDeclaration();
    const direct = decl && path.relative(repo, decl.getSourceFile().fileName) === 'js/rng.js'
        && decl.name && DRAWS.has(decl.name.getText()) ? decl.name.getText() : null;
    if (direct && !typed) throw new Error(`Emitted RNG call absent from the typed inventory: ${call.getSourceFile().fileName}`);
    return direct || (typed ? typedDrawName(typed) : null);
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

// Callback claims belong to their lexical scope, not a file-wide anonymous pool.
function functionScope(n) {
    const names = [];
    for (let p = n.parent; p; p = p.parent) {
        if (!ts.isFunctionLike(p)) continue;
        const parent = p.parent;
        if (p.name) names.unshift(text(p.name));
        else if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isParameter(parent)) {
            names.unshift(text(parent.name));
        } else if (ts.isCallExpression(parent) && parent.arguments.includes(p)) {
            names.unshift(`${text(parent.expression)} argument ${parent.arguments.indexOf(p) + 1}`);
        } else names.unshift('(anonymous)');
    }
    return names.join('/') || '(module)';
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
            if (ts.isIdentifier(n) && resolve(n) === symbol && isWritten(n)) {
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

// A later assignment need not hide the initializer at an earlier read. The
// declaration must dominate that read, and an enclosing loop must not carry
// a write from a previous iteration past it. Captured writes are rejected.
function initialAt(id) {
    const stable = stableDeclaration(id);
    if (stable) return stable;
    const symbol = resolve(id), decl = symbol?.valueDeclaration;
    if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer
        || enclosingFunction(decl) !== enclosingFunction(id)) return null;
    const statement = decl.parent.parent, block = statement.parent;
    if (!ts.isVariableStatement(statement) || !ts.isBlock(block)) return null;
    let child = id;
    while (child.parent && child.parent !== block) child = child.parent;
    if (child.parent !== block || block.statements.indexOf(statement) >= block.statements.indexOf(child)) return null;
    let clean = true;
    const writes = n => {
        if (ts.isIdentifier(n) && resolve(n) === symbol && isWritten(n)) {
            if (enclosingFunction(n) !== enclosingFunction(id)
                || n.getStart() > decl.initializer.getEnd() && n.getStart() < id.getStart()) clean = false;
            for (let p = id.parent; p && p !== enclosingFunction(id); p = p.parent) {
                if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isWhileStatement(p)
                    || ts.isDoStatement(p) || ts.isForInStatement(p)) && decl.getEnd() < p.getStart()
                    && n.getStart() >= p.getStart() && n.getEnd() <= p.getEnd()) clean = false;
            }
        }
        ts.forEachChild(n, writes);
    };
    writes(enclosingFunction(id).body);
    return clean ? decl : null;
}

function resolve(id) {
    let symbol = ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id
        ? checker.getShorthandAssignmentValueSymbol(id.parent) : checker.getSymbolAtLocation(id);
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
    let readOnly = (declaredType(decl.name) ?? checker.typeToString(declared)).startsWith('readonly ');
    if (!readOnly) {
        readOnly = true;
        const visit = (m) => {
            if (!readOnly) return;
            if (ts.isIdentifier(m) && m !== decl.name && resolve(m) === symbol) {
                const p = m.parent;
                const indexed = ts.isElementAccessExpression(p) && p.expression === m && !isWritten(p);
                const length = ts.isPropertyAccessExpression(p) && p.expression === m && p.name.text === 'length';
                const iterated = ts.isForOfStatement(p) && p.expression === m;
                const importing = ts.isImportSpecifier(p) || ts.isExportSpecifier(p);
                if (!indexed && !length && !iterated && !importing) readOnly = false;
            }
            ts.forEachChild(m, visit);
        };
        const exported = (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Export) !== 0;
        if (exported) {
            for (const file of program.getSourceFiles()) if (path.relative(repo, file.fileName).startsWith('js/')) visit(file);
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
    return { leaf: true, text: text(n), key: valueKey(n), facts: [['range', Math.min(...nums), Math.max(...nums)]], data: true };
}

const BITWISE = {
    '&': (a, b) => a & b, '|': (a, b) => a | b, '^': (a, b) => a ^ b,
    '<<': (a, b) => a << b, '>>': (a, b) => a >> b, '>>>': (a, b) => a >>> b,
};
const MATH = new Set(['max', 'min', 'abs', 'floor', 'ceil', 'trunc', 'round', 'sign']);

let checkingCall = null;
const locals = {};

function inContext(node, action) {
    const previous = checkingCall;
    checkingCall = node;
    try { return action(); } finally { checkingCall = previous; }
}

function constantNumber(t) {
    if ('num' in t) return t.num;
    if (!('op' in t)) return null;
    const args = t.args.map(constantNumber);
    if (args.some(v => v === null)) return null;
    if (t.op === '+') return args[0] + args[1];
    if (t.op === '-') return args[0] - args[1];
    if (t.op === '*') return args[0] * args[1];
    if (t.op === '/') return args[0] / args[1];
    return null;
}

function pureMath(n) {
    return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && globalBuiltin(n.expression.expression, 'Math') && MATH.has(n.expression.name.text);
}

function globalBuiltin(n, name) {
    if (!ts.isIdentifier(n) || n.text !== name) return false;
    const decl = resolve(n)?.valueDeclaration;
    return decl?.getSourceFile().fileName.endsWith('/lib.es5.d.ts') ?? false;
}

function intrinsicSize(n) {
    if (!['length', 'size'].includes(n.name.text)) return false;
    const type = declaredType(n.expression)
        ?? checker.typeToString(checker.getTypeAtLocation(n.expression));
    if (n.name.text === 'size') return /^(Readonly)?(Map|Set)</.test(type);
    return n.name.text === 'length' && (type === 'string' || type.endsWith('[]')
        || type.startsWith('readonly [') || type.startsWith('['));
}

// Reusing a guard requires more than equal spelling. Unknown calls and await
// invalidate heap reads; writes invalidate scalar reads too. For a guard
// outside a loop, inspect the whole loop because a later iteration may reach
// the site after writes located below it in source order.
function stableBetween(expression, call) {
    if (!call || expression.getSourceFile() !== call.getSourceFile()) return false;
    const fn = enclosingFunction(call);
    if (!fn || enclosingFunction(expression) !== fn) return false;
    const symbols = new Set();
    let heap = false, capturedScalar = false;
    const reads = n => {
        if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)
            || ts.isCallExpression(n) && !pureMath(n)) heap = true;
        if (ts.isIdentifier(n)) {
            const symbol = resolve(n), decl = symbol?.valueDeclaration;
            symbols.add(symbol);
            if (decl && (ts.isVariableDeclaration(decl) || ts.isParameter(decl))
                && enclosingFunction(decl) !== fn && !stableDeclaration(n)) capturedScalar = true;
        }
        ts.forEachChild(n, reads);
    };
    reads(expression);
    const low = expression.getEnd(), high = call.getEnd();
    if (low > high) return true; // the argument itself
    let safe = true;
    const invalidates = n => isWritten(n)
        && (ts.isIdentifier(n) ? symbols.has(resolve(n)) : heap);
    const inspect = n => {
        if (!safe || n.getEnd() <= low || n.getStart() >= high) return;
        if (ts.isFunctionLike(n)) return;
        if ((heap || capturedScalar) && (ts.isAwaitExpression(n)
            || ts.isCallExpression(n) && n !== call && !pureMath(n))) safe = false;
        if (invalidates(n)) safe = false;
        ts.forEachChild(n, inspect);
    };
    inspect(fn.body);
    // A called closure could write a captured scalar even without a visible
    // assignment at the call site. Reject such bindings conservatively.
    const captures = n => {
        if (ts.isIdentifier(n) && symbols.has(resolve(n)) && isWritten(n)
            && enclosingFunction(n) !== fn) safe = false;
        ts.forEachChild(n, captures);
    };
    captures(fn.body);
    for (let p = call.parent; p && p !== fn; p = p.parent) {
        if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)
            || ts.isWhileStatement(p) || ts.isDoStatement(p)) && expression.getEnd() < p.getStart()) {
            const loopWrites = n => {
                if (invalidates(n)) safe = false;
                if ((heap || capturedScalar) && (ts.isAwaitExpression(n)
                    || ts.isCallExpression(n) && n !== call && !pureMath(n))) safe = false;
                ts.forEachChild(n, loopWrites);
            };
            loopWrites(p);
        }
    }
    return safe;
}

function valueKey(n) {
    const bindings = new Set();
    const bindingKey = decl => `${path.relative(repo, decl.getSourceFile().fileName)}:${decl.getStart()}`;
    const visit = child => {
        const fieldName = ts.isPropertyAccessExpression(child.parent) && child.parent.name === child;
        if (ts.isIdentifier(child) && !fieldName) {
            const binding = resolve(child)?.valueDeclaration;
            if (binding) bindings.add(bindingKey(binding));
        }
        ts.forEachChild(child, visit);
    };
    visit(n);
    const scope = [...bindings].sort().join(',');
    // Separate repeated calls, shadowed bindings and stale snapshots. The text
    // stays available for the explicitly documented C-state assumptions.
    const fresh = ts.isCallExpression(n) || !stableBetween(n, checkingCall);
    return `${scope}|${text(n)}${fresh ? `@${n.getStart()}` : ''}`;
}

function localSummary(n, depth) {
    const symbol = resolve(n), decl = symbol?.valueDeclaration;
    if (!decl || !ts.isVariableDeclaration(decl) || !ts.isIdentifier(decl.name)
        || !decl.initializer || !enclosingFunction(decl)) return null;
    const key = declKey(decl);
    if (key in locals) return key;
    locals[key] = null;
    const updates = [];
    let supported = true;
    const visit = m => {
        if (ts.isIdentifier(m) && resolve(m) === symbol && isWritten(m)) {
            const p = m.parent;
            if ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && p.operand === m) {
                updates.push({ op: p.operator === ts.SyntaxKind.PlusPlusToken ? '+' : '-', args: [{ self: true }, { num: 1 }] });
            } else if (ts.isBinaryExpression(p) && p.left === m) {
                const op = p.operatorToken.getText();
                if (op === '=') updates.push(inContext(p, () => term(p.right, depth + 1)));
                else if (['+=', '-=', '*='].includes(op)) updates.push({ op: op[0], args: [{ self: true }, inContext(p, () => term(p.right, depth + 1))] });
                else supported = false;
            } else supported = false;
        }
        ts.forEachChild(m, visit);
    };
    visit(enclosingFunction(decl).body);
    const initial = inContext(decl.initializer, () => term(decl.initializer, depth + 1));
    locals[key] = supported ? { name: text(n), initial, updates } : null;
    return key;
}

function term(n, depth = 0) {
    n = strip(n);
    if (ts.isNumericLiteral(n)) return { num: Number(n.text) };
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) {
        return { op: '-', args: [{ num: 0 }, term(n.operand, depth)] };
    }
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.PlusToken) return term(n.operand, depth);
    if (ts.isPrefixUnaryExpression(n) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) {
        // Only an entire argument is modeled. In ++x - x the second read
        // observes the write, so ordinary algebra over one symbol is wrong.
        if (checkingCall && ts.isCallExpression(checkingCall)
            && checkingCall.arguments.some(arg => strip(arg) === n)) {
            const prior = term(n.operand, depth);
            const snapshot = t => {
                if ('leaf' in t) return { ...t, key: `${t.key ?? t.text} before @${n.getStart()}` };
                if ('args' in t) return { ...t, args: t.args.map(snapshot) };
                return t;
            };
            const op = n.operator === ts.SyntaxKind.PlusPlusToken ? '+' : '-';
            return { op, args: [snapshot(prior), { num: 1 }] };
        }
        return { leaf: true, text: text(n), key: `${valueKey(n)} increment`, facts: [] };
    }
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
            const left = constantNumber(a), right = constantNumber(b);
            if (left !== null && right !== null) return { num: BITWISE[op](left, right) };
            const mask = op === '&' ? ('num' in b ? b.num : 'num' in a ? a.num : null) : null;
            if (mask !== null && mask >= 0) return { leaf: true, text: text(n), key: valueKey(n), facts: [['range', 0, mask]] };
        }
        if (op === '||') return { ite: [truth(n.left, depth), term(n.left, depth), term(n.right, depth)] };
        if (op === '??') return { ite: [{ bool: `?? ${valueKey(n)}` }, term(n.left, depth), term(n.right, depth)] };
    }
    if (ts.isConditionalExpression(n)) {
        return { ite: [truth(n.condition, depth), term(n.whenTrue, depth), term(n.whenFalse, depth)] };
    }
    if (ts.isCallExpression(n)) {
        const callee = strip(n.expression);
        if (pureMath(n)) {
            return { op: `Math.${callee.name.text}`, args: n.arguments.map((a) => term(a, depth)) };
        }
        const draw = drawName(n);
        if (draw) return { leaf: true, text: text(n), key: valueKey(n), draw, args: n.arguments.map((a) => term(a, depth)) };
        if (globalBuiltin(callee, 'Number') && n.arguments.length === 1) {
            const arg = n.arguments[0];
            if ((checker.getTypeAtLocation(arg).flags & ts.TypeFlags.BooleanLike) !== 0) {
                return { ite: [truth(arg, depth), { num: 1 }, { num: 0 }] };
            }
        }
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'indexOf' && n.arguments.length === 1) {
            const table = tableOf(callee.expression), search = strip(n.arguments[0]);
            if (table && ts.isStringLiteral(search) && table.every(ts.isStringLiteral)) {
                return { num: table.findIndex(entry => entry.text === search.text) };
            }
        }
    }
    if (ts.isIdentifier(n) && depth < 6) {
        const decl = initialAt(n);
        const moduleConst = decl && ts.isVariableDeclaration(decl) && !enclosingFunction(decl)
            && (decl.parent.flags & ts.NodeFlags.Const) !== 0;
        if (decl && ts.isVariableDeclaration(decl) && decl.initializer
            && (enclosingFunction(decl) === enclosingFunction(n) || moduleConst)) {
            return term(decl.initializer, depth + 1);
        }
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'length') {
        const decl = ts.isIdentifier(n.expression) ? stableDeclaration(n.expression) : null;
        const value = decl && ts.isVariableDeclaration(decl) && decl.initializer ? strip(decl.initializer) : strip(n.expression);
        if (ts.isStringLiteral(value)) return { num: value.text.length };
        const table = tableOf(n.expression);
        if (table) return { num: table.length };
    }
    if (ts.isElementAccessExpression(n)) {
        const read = tableRead(n.expression, n.argumentExpression, n, depth);
        if (read) return read;
    }
    const facts = [];
    if (ts.isPropertyAccessExpression(n) && intrinsicSize(n)) facts.push(['nonneg']);
    const leaf = { leaf: true, text: text(n), key: valueKey(n), facts };
    if (ts.isCallExpression(n)) {
        const decl = checker.getResolvedSignature(n)?.getDeclaration();
        if (decl?.name?.getText() === 'currentAttribute'
            && path.relative(repo, decl.getSourceFile().fileName) === 'js/attrib.js'
            && n.arguments[0]) leaf.attribute = constantNumber(term(n.arguments[0], depth));
    }
    if (ts.isIdentifier(n) && depth < 6) {
        const local = localSummary(n, depth);
        if (local) leaf.local = local;
    }
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
                if ((t.isUnion() ? t.types : [t]).every(part => (part.flags & ts.TypeFlags.NumberLike) !== 0)) return true;
                const typed = declaredType(e);
                return typed === 'number' || typed !== null && /^-?\d+( \| -?\d+)*$/.test(typed);
            };
            if (numeric(n.left) && numeric(n.right)) {
                return { cmp: op.replace('===', '==').replace('!==', '!='), args: [term(n.left, depth), term(n.right, depth)] };
            }
        }
    }
    const t = checker.getTypeAtLocation(n);
    if ((t.flags & ts.TypeFlags.NumberLike) !== 0) return { cmp: '!=', args: [term(n, depth), { num: 0 }] };
    return { bool: valueKey(n) };
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
    if (!path.relative(repo, decl.getSourceFile().fileName).startsWith('js/')) return null;
    const key = declKey(decl);
    if (key in summaries) return key;
    summaries[key] = null;   // cycle guard
    const returns = [];
    if (!ts.isBlock(decl.body)) {
        returns.push(inContext(decl.body, () => ({ term: term(decl.body, depth), guards: [] })));
    } else {
        const visit = (n) => {
            if (n !== decl && ts.isFunctionLike(n)) return;
            if (ts.isReturnStatement(n)) {
                returns.push(n.expression ? inContext(n, () => ({ term: term(n.expression, depth), guards: guards(n, depth) })) : { undefined: true });
            }
            ts.forEachChild(n, visit);
        };
        visit(decl.body);
        if (!exits(decl.body)) returns.push({ undefined: true });
    }
    const callers = escaped.has(decl) ? null : (callsOf.get(decl) ?? []).map((call) => inContext(call, () => ({
        site: `${path.relative(repo, call.getSourceFile().fileName)}:${call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line + 1}`,
        args: decl.parameters.map((prm, i) => (i < call.arguments.length ? term(call.arguments[i], depth)
            : prm.initializer ? term(prm.initializer, depth) : { undefined: true })),
        guards: guards(call, depth),
    })));
    summaries[key] = { name: decl.name ? decl.name.getText() : '(anonymous)', returns, callers };
    return key;
}

// The type of a record whose fields are read. A parameter of a non-escaping
// function takes the type every direct caller passes, so a helper declared
// over Rectangle still counts as a room helper when only rooms reach it.
function ownerType(n, depth) {
    n = strip(n);
    const type = declaredType(n) ?? checker.typeToString(checker.getNonNullableType(checker.getTypeAtLocation(n)));
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
        if (!path.relative(repo, file.fileName).startsWith('js/')) continue;
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
    const truthAt = (e) => stableBetween(e, call) ? truth0(e, depth) : { bool: `stale guard @${e.getStart()}` };
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
        } else if (ts.isWhileStatement(p) && child === p.statement) {
            out.push(truthAt(p.expression));
        } else if (ts.isForStatement(p) && child === p.statement && p.condition) {
            out.push(truthAt(p.condition));
        } else if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) {
            for (const s of p.statements) {
                if (s === child) break;
                if (ts.isIfStatement(s) && !s.elseStatement && exits(s.thenStatement)) out.push({ not: truthAt(s.expression) });
            }
        }
    }
    return out;
}

indexEmittedSources();
if (process.argv.includes('--mutate-domains')) {
    const overrides = domainMutants(program, drawName, repo);
    const host = ts.createCompilerHost(emittedOptions), read = host.readFile;
    host.readFile = file => overrides.get(path.resolve(file)) ?? read(file);
    program = ts.createProgram(emittedFiles, emittedOptions, host);
    checker = program.getTypeChecker();
    typedCalls.clear();
    typedExpressions.clear();
    declaredTypes.clear();
    indexEmittedSources();
}
indexCalls();
const sites = [];
for (const file of program.getSourceFiles()) {
    const rel = path.relative(repo, file.fileName);
    if (!rel.startsWith('js/') || rel === 'js/rng.js') continue;
    const visit = (n) => {
        if (ts.isCallExpression(n)) {
            const draw = drawName(n);
            if (draw) {
                checkingCall = n;
                const authored = typedCalls.get(n);
                sites.push({
                    file: path.relative(repo, authored.getSourceFile().fileName),
                    line: authored.getSourceFile().getLineAndCharacterOfPosition(authored.getStart()).line + 1,
                    emitted: { file: rel, line: file.getLineAndCharacterOfPosition(n.getStart()).line + 1 },
                    fn: functionScope(n), draw, callee: text(n.expression), args: n.arguments.map((a) => text(a)),
                    terms: n.arguments.map((a) => term(a)), guards: guards(n),
                });
            }
        }
        ts.forEachChild(n, visit);
    };
    visit(file);
}
process.stdout.write(JSON.stringify({ sites, summaries, locals }));
