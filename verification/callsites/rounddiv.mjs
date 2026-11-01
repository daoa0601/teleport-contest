// List resolved native rounddiv calls and the named emitted port calls.
// rg only selects translation units; clang's typed AST identifies C calls.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: repo, encoding: 'utf8',
}).trim();
const recorder = process.env.NETHACK_RECORDER || resolve(common, '..', 'nethack-c/recorder');
const candidates = execFileSync('rg', ['-l', '-w', 'rounddiv', '--glob', '*.c', resolve(recorder, 'src')], {
    encoding: 'utf8',
}).trim().split('\n');

function directCallee(node) {
    while (['ImplicitCastExpr', 'ParenExpr'].includes(node?.kind)) node = node.inner[0];
    return node?.kind === 'DeclRefExpr' ? node : undefined;
}
function position(node, end = false) {
    const location = node.range[end ? 'end' : 'begin'];
    const expanded = location.expansionLoc || location;
    return expanded.offset + (end ? expanded.tokLen : 0);
}
function cCalls(node, source, file, audit, owner = '') {
    if (node.kind === 'DeclRefExpr' && node.referencedDecl?.name === 'rounddiv') {
        audit.references.add(node.id);
    }
    if (node.kind === 'FunctionDecl' && node.inner?.some(child => child.kind === 'CompoundStmt')) {
        owner = node.name;
    }
    if (node.kind === 'CallExpr' && directCallee(node.inner[0])?.referencedDecl?.name === 'rounddiv') {
        audit.calls.add(directCallee(node.inner[0]).id);
        const start = position(node);
        const line = source.subarray(0, start).toString().split('\n').length;
        const expression = source.subarray(start, position(node, true)).toString();
        console.log(`${file}:${line} ${owner} ${expression}`);
    }
    for (const child of node.inner || []) cCalls(child, source, file, audit, owner);
}
for (const file of candidates) {
    const dump = execFileSync('clang', ['-fsyntax-only', `-I${recorder}/include`,
        '-DNOTPARMDECL', '-DNO_TIMED_DELAY', '-Xclang', '-ast-dump=json', file],
        { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    const audit = { references: new Set(), calls: new Set() };
    cCalls(JSON.parse(dump), readFileSync(file), file.slice(recorder.length + 1), audit);
    if ([...audit.references].some(reference => !audit.calls.has(reference))) {
        throw new Error(`rounddiv address escapes in ${file}; inspect indirect callers`);
    }
}

const names = new Set(['roundDiv', 'roundNutritionTime']);
for (const label of ['js/polyself.js', 'js/eat.js']) {
    const source = ts.createSourceFile(label, readFileSync(resolve(repo, label), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node, owner = '') {
        if (ts.isFunctionDeclaration(node)) owner = node.name?.text || owner;
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            console.log(`${label}:${line + 1} ${owner} ${node.getText(source)}`);
        }
        ts.forEachChild(node, child => visit(child, owner));
    }
    visit(source);
}
// monmulti's port inlines its positive-denominator rounding.
const label = 'js/mthrowu.js';
const source = ts.createSourceFile(label, readFileSync(resolve(repo, label), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function inlineVolley(node, owner = '') {
    if (ts.isFunctionDeclaration(node)) owner = node.name?.text || owner;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(source) === 'Math' && node.expression.name.text === 'trunc'
        && node.arguments[0] && ts.isBinaryExpression(node.arguments[0])
        && node.arguments[0].operatorToken.kind === ts.SyntaxKind.SlashToken
        && node.arguments[0].right.getText(source) === '3') {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        console.log(`${label}:${line + 1} ${owner} ${node.getText(source)}`);
    }
    ts.forEachChild(node, child => inlineVolley(child, owner));
}
inlineVolley(source);
