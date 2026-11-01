// static-gaps.mjs — static maps of C behavior that the port lacks.
//
//   node scripts/static-gaps.mjs messages [--coverage C-COVERAGE.json] [--reviewed-ledger R.tsv] [--verbose] [--check-ledger L.tsv] [--write-ledger L.tsv]
//   node scripts/static-gaps.mjs constants [--check-ledger L.tsv] [--write-ledger L.tsv]
//   node scripts/static-gaps.mjs edges [--function NAME] [--check-ledger L.tsv] [--write-ledger L.tsv]
//   node scripts/static-gaps.mjs owners [--check-ledger L.tsv] [--write-ledger L.tsv]
//   node scripts/static-gaps.mjs screens RUN_DIR
//
// `messages` lists every C string literal (outside debugging calls) whose
// longest fixed piece, with printf conversions cut out, never appears among
// the port's string and template fragments. A missing message is a map
// entry to audit, found without a game that reaches it. Reviewed verdicts
// live in docs/ledger/c-messages-reviewed.tsv and are checked for stale
// C literals and composed-message port locations.
// Gameplay sessions, the RNG ledgers and the state oracle still decide
// whether ported code is right; this identifies leads for source review.
//
// `constants` compiles a `_Static_assert` against the pinned C headers for
// every exported upper-case constant and enum member of the port whose name
// is a C macro or enum constant (see lib/gap-constants.mts).
//
// `edges` compares each C function's static callees with what its port
// counterpart reaches (see lib/gap-edges.mts).
//
// `screens` reads a finished triage run and charges each screen-only first
// difference to the C function whose literal appears on the differing row,
// the way the RNG table charges a random-call difference to its caller.
//
// The message ledger lists every literal found present; the constant ledger
// every name whose value matches C. `--check-ledger` fails when
// a listed literal is no longer present (a lost message is a regression).
// Diagnostics go to `.cache/static-gaps/`.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    INFRASTRUCTURE_FILES, baseName, calleeName, forEachTopLevelDecl, resolveCSourceTree, walkJson,
} from './lib/c-sources.mjs';
import type { CSourceTree } from './lib/c-sources.mjs';
import { checkConstants } from './lib/gap-constants.mjs';
import { compareEdges } from './lib/gap-edges.mjs';
import type { EdgeRow } from './lib/gap-edges.mjs';
import { checkMessageReviews, messageLedgerKey } from './lib/gap-message-reviews.mjs';
import type { MessageReview } from './lib/gap-message-reviews.mjs';
import { MIXED_TOLERANCE, moduleOwnership } from './lib/module-owners.mjs';
import { arrayValue, errorMessage, numberValue, objectValue, stringValue } from './lib/session-types.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = join(ROOT, '.cache', 'static-gaps');
// Bump when the extraction rules change, to invalidate cached per-file results.
const EXTRACTOR_VERSION = 'facts-3';
// The literal must be this long, and its longest fixed piece at least
// MIN_PIECE characters, to identify a message rather than a word.
const MIN_LITERAL = 14;
const MIN_PIECE = 8;

// Calls whose literals are diagnostics for developers, not game behavior.
const DEBUG_CALLS = new Set(['impossible', 'panic', 'paniclog', 'debugpline', 'nhassert_failed', 'config_error_add',
    'raw_printf', 'raw_print', 'wait_synch', 'error', 'nh_terminate', 'livelog_printf', 'gamelog_add']);
// Calls that print or prompt; their literals are messages in the post's sense.
const MESSAGE_CALLS = new Set(['pline', 'pline_The', 'pline_xy', 'You', 'Your', 'You_feel', 'You_cant', 'You_hear',
    'You_see', 'There', 'verbalize', 'Norep', 'custompline', 'urgent_pline', 'putstr', 'putmixed', 'yn_function',
    'getlin', 'pline_mon', 'set_msg_xy', 'tty_putstr', 'display_nhwindow', 'add_menu', 'add_menu_str',
    'end_menu', 'xprname', 'livelog_printf']);

interface CLiteral {
    file: string;
    owner: string;
    callee: string;
    category: 'message' | 'text';
    literal: string;
    piece: string;
}

// `near`: absent verbatim, but present once a leading or trailing word is
// dropped, the usual sign of a message the port composes differently.
interface MessageRow extends CLiteral {
    present: boolean; near: boolean; infrastructure: boolean; executed: boolean | null;
    review: MessageReview | null;
}

function nearPresent(piece: string, text: string): boolean {
    const words = piece.split(' ');
    for (const variant of [words.slice(1), words.slice(0, -1), words.slice(1, -1)]) {
        const candidate = variant.join(' ').trim();
        if (candidate.length >= 12 && text.includes(candidate)) return true;
    }
    return false;
}

// ── C side ──

function decodeCString(spelled: string): string {
    // clang spells the literal with its quotes and C escapes.
    const body = spelled.startsWith('"') && spelled.endsWith('"') ? spelled.slice(1, -1) : spelled;
    return body.replace(/\\(?:([0-7]{1,3})|x([0-9a-fA-F]+)|(.))/g, (_match, octal: unknown, hex: unknown, char: unknown) => {
        if (typeof octal === 'string') return String.fromCharCode(parseInt(octal, 8));
        if (typeof hex === 'string') return String.fromCharCode(parseInt(hex, 16));
        const key = typeof char === 'string' ? char : '';
        return C_ESCAPES.get(key) ?? key;
    });
}

const C_ESCAPES: ReadonlyMap<string, string> = new Map([
    ['n', '\n'], ['t', '\t'], ['r', '\r'], ['a', '\x07'], ['b', '\b'], ['f', '\f'], ['v', '\v'], ['e', '\x1b']]);

// printf conversions, including flags, width, precision and length.
const CONVERSION = /%[-+ #0']*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|L|z|j|t)?[diouxXeEfgGcspn]/g;

export function longestFixedPiece(text: string): string {
    let best = '';
    for (const part of text.replace(/%%/g, '%').split(CONVERSION)) {
        const trimmed = part.trim();
        if (trimmed.length > best.length) best = trimmed;
    }
    return best;
}

// What one translation unit contributes: its literals and the functions it
// defines (bodies in the .c file itself, not header inlines).
interface FileFacts { literals: CLiteral[]; functions: string[] }

async function extractFile(tree: CSourceTree, file: string): Promise<FileFacts> {
    const literals: CLiteral[] = [];
    const functions: string[] = [];
    await forEachTopLevelDecl(tree, file, (decl, tracker) => {
        const kind = decl['kind'];
        const name = decl['name'];
        if ((kind !== 'FunctionDecl' && kind !== 'VarDecl') || typeof name !== 'string') {
            walkJson(decl, tracker, () => undefined);
            return;
        }
        const calls: string[] = [];
        // debugpline*() expands to `if (showdebug(__FILE__)) pline(...)`.
        const debugGuards: boolean[] = [];
        // __func__ is a PredefinedExpr wrapping the function name; Apple's
        // assert() passes it, glibc's does not, so it is no message text.
        let predefinedDepth = 0;
        walkJson(decl, tracker, node => {
            const nodeKind = node['kind'];
            if (nodeKind === 'CallExpr') calls.push(calleeName(node) ?? '?');
            else if (nodeKind === 'IfStmt') debugGuards.push(conditionCalls(node, 'debugcore'));
            else if (nodeKind === 'PredefinedExpr') predefinedDepth++;
        }, node => {
            const nodeKind = node['kind'];
            if (node['id'] === decl['id']) {
                // The walk ends on the body's closing brace, so the current
                // file is where the definition lives.
                const inner = decl['inner'];
                const hasBody = Array.isArray(inner) && inner.some((child: unknown) => typeof child === 'object' && child !== null
                    && Object.entries(child).some(([key, value]) => key === 'kind' && value === 'CompoundStmt'));
                if (kind === 'FunctionDecl' && tracker.current === file && hasBody) {
                    functions.push(name);
                }
                return;
            }
            if (nodeKind === 'CallExpr') { calls.pop(); return; }
            if (nodeKind === 'IfStmt') { debugGuards.pop(); return; }
            if (nodeKind === 'PredefinedExpr') { predefinedDepth--; return; }
            if (nodeKind !== 'StringLiteral' || tracker.current !== file || debugGuards.includes(true)
                || predefinedDepth > 0) return;
            const value = node['value'];
            if (typeof value !== 'string') return;
            const literal = decodeCString(value);
            const piece = longestFixedPiece(literal);
            if (literal.length < MIN_LITERAL || piece.length < MIN_PIECE) return;
            if (calls.some(call => DEBUG_CALLS.has(call) || call.startsWith('debugpline'))) return;
            const message = calls.some(call => MESSAGE_CALLS.has(call));
            literals.push({ file: baseName(file), owner: name, callee: calls.at(-1) ?? '', category: message ? 'message' : 'text',
                literal, piece });
        });
    });
    return { literals, functions };
}

function conditionCalls(ifStmt: Record<string, unknown>, name: string): boolean {
    const inner = ifStmt['inner'];
    if (!Array.isArray(inner)) return false;
    let found = false;
    const search = (value: unknown): void => {
        if (found || typeof value !== 'object' || value === null) return;
        if (Array.isArray(value)) { for (const item of value) search(item); return; }
        const node = Object.fromEntries(Object.entries(value));
        if (node['kind'] === 'CallExpr' && calleeName(node) === name) { found = true; return; }
        search(node['inner']);
    };
    search(inner[0]);
    return found;
}

function decodeLiteral(value: unknown, label: string): CLiteral {
    const row = objectValue(value, label);
    const category = stringValue(row['category'], `${label}.category`);
    if (category !== 'message' && category !== 'text') throw new Error(`${label}.category is invalid`);
    return {
        file: stringValue(row['file'], `${label}.file`), owner: stringValue(row['owner'], `${label}.owner`),
        callee: stringValue(row['callee'], `${label}.callee`), category,
        literal: stringValue(row['literal'], `${label}.literal`), piece: stringValue(row['piece'], `${label}.piece`),
    };
}

// Per-file results are cached by the file's content, the extractor version
// and the clang arguments; headers are pinned with the submodule.
async function cFacts(tree: CSourceTree): Promise<{ literals: CLiteral[]; definedIn: Map<string, string> }> {
    const cacheDir = join(CACHE, 'c-facts');
    mkdirSync(cacheDir, { recursive: true });
    const pending = [...tree.files];
    const results = new Map<string, FileFacts>();
    const worker = async (): Promise<void> => {
        for (let file = pending.shift(); file !== undefined; file = pending.shift()) {
            const key = createHash('sha256').update(EXTRACTOR_VERSION).update('\0').update(tree.clangArgs.join(' '))
                .update('\0').update(readFileSync(join(tree.dir, file))).digest('hex').slice(0, 16);
            const cached = join(cacheDir, `${baseName(file)}.${key}.json`);
            if (existsSync(cached)) {
                const parsed = objectValue(JSON.parse(readFileSync(cached, 'utf8')), cached);
                results.set(file, {
                    literals: arrayValue(parsed['literals'], cached).map((row, index) => decodeLiteral(row, `${cached}[${index}]`)),
                    functions: arrayValue(parsed['functions'], cached).map(name => stringValue(name, `${cached} function`)),
                });
                continue;
            }
            const facts = await extractFile(tree, file);
            writeFileSync(cached, JSON.stringify(facts) + '\n');
            results.set(file, facts);
            process.stderr.write(`  ${file}: ${facts.literals.length} literals, ${facts.functions.length} functions\n`);
        }
    };
    await Promise.all(Array.from({ length: 3 }, () => worker()));
    const definedIn = new Map<string, string>();
    for (const file of tree.files) {
        for (const name of results.get(file)?.functions ?? []) if (!definedIn.has(name)) definedIn.set(name, baseName(file));
    }
    return { literals: tree.files.flatMap(file => results.get(file)?.literals ?? []), definedIn };
}

// ── TypeScript side ──

// Every string, template fragment, and constant-folded `+` chain in the
// port's game sources, joined with a separator no message contains.
function portText(): string {
    const fragments: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) fragments.push(node.text);
        else if (ts.isTemplateExpression(node)) {
            fragments.push(node.head.text, ...node.templateSpans.map(span => span.literal.text));
        } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            const folded = foldedString(node);
            if (folded !== null) fragments.push(folded);
        }
        ts.forEachChild(node, visit);
    };
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (['.ts', '.mts'].includes(extname(entry.name))) {
                visit(ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, false));
            }
        }
    };
    walk(join(ROOT, 'src', 'js'));
    return fragments.join('\u0001');
}

function foldedString(node: ts.Expression): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return foldedString(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = foldedString(node.left), right = foldedString(node.right);
        return left !== null && right !== null ? left + right : null;
    }
    return null;
}

// ── Coverage and ledger ──

// Executed C functions from `state-oracle coverage`, keyed `file:function`.
function executedFunctions(path: string): Set<string> {
    const parsed = objectValue(JSON.parse(readFileSync(path, 'utf8')), path);
    const executed = new Set<string>();
    arrayValue(parsed['rows'], `${path}.rows`).forEach((value, index) => {
        const row = objectValue(value, `${path}.rows[${index}]`);
        if (numberValue(row['count'], `${path}.rows[${index}].count`) > 0) {
            executed.add(`${stringValue(row['file'], 'file')}:${stringValue(row['function'], 'function')}`);
        }
    });
    return executed;
}

function readLedger(path: string): Set<string> {
    return new Set(readFileSync(path, 'utf8').split('\n').filter(line => line && !line.startsWith('#')));
}

function optionReader(args: string[]): (name: string) => string | null {
    return name => {
        const index = args.indexOf(name);
        if (index < 0) return null;
        const value = args[index + 1];
        if (value === undefined) throw new Error(`${name} needs a value`);
        return value;
    };
}

// Fails when a ledger entry is no longer among `now`; writes `now` on request.
function applyLedger(option: (name: string) => string | null, now: string[], what: string, header: string): void {
    const current = new Set(now);
    const checkPath = option('--check-ledger');
    if (checkPath) {
        const lost = [...readLedger(checkPath)].filter(key => !current.has(key));
        if (lost.length) {
            console.error(`\n${lost.length} ledger ${what} are lost:`);
            for (const key of lost.slice(0, 50)) console.error(`  ${key}`);
            process.exitCode = 1;
        } else console.log(`\nLedger ${checkPath}: every listed ${what.replace(/s$/, '')} still holds.`);
    }
    const writePath = option('--write-ledger');
    if (writePath) {
        const keys = [...current].sort();
        writeFileSync(writePath, `# ${header}\n` + keys.join('\n') + '\n');
        console.log(`\nWrote ${keys.length} entries to ${writePath}`);
    }
}

// ── messages ──

async function messages(args: string[]): Promise<void> {
    const option = optionReader(args);
    const tree = resolveCSourceTree(ROOT, CACHE);
    process.stderr.write(`C sources: ${relative(ROOT, tree.dir)} (${tree.files.length} files)\n`);
    const { literals } = await cFacts(tree);
    const reviewPath = option('--reviewed-ledger') ?? join(ROOT, 'docs', 'ledger', 'c-messages-reviewed.tsv');
    const { reviewed, stale } = checkMessageReviews(ROOT, reviewPath, literals);
    const text = portText();
    const coveragePath = option('--coverage');
    const executed = coveragePath ? executedFunctions(coveragePath) : null;
    const rows: MessageRow[] = literals.map(literal => {
        const present = text.includes(literal.piece);
        return { ...literal, review: reviewed.get(messageLedgerKey(literal)) ?? null,
            present, near: !present && nearPresent(literal.piece, text), infrastructure: INFRASTRUCTURE_FILES.has(literal.file),
            executed: executed ? executed.has(`${literal.file}:${literal.owner}`) : null };
    });
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(join(CACHE, 'messages.json'), JSON.stringify(rows, null, 1) + '\n');

    const missing = rows.filter(row => !row.present && !row.review);
    const count = (filter: (row: MessageRow) => boolean): string =>
        `${missing.filter(filter).length} of ${rows.filter(filter).length}`;
    console.log('# Unreviewed C literals absent from the port\n');
    console.log(`messages (printed or prompted): ${count(row => row.category === 'message')}`
        + ` (${missing.filter(row => row.category === 'message' && !row.near).length} with no near match)`);
    console.log(`  in gameplay files:            ${count(row => row.category === 'message' && !row.infrastructure)}`);
    console.log(`other text (names, buffers):    ${count(row => row.category === 'text')}`);
    console.log(`  in gameplay files:            ${count(row => row.category === 'text' && !row.infrastructure)}`);
    if (executed) {
        console.log(`missing messages in functions the corpus never runs: `
            + `${missing.filter(row => row.category === 'message' && row.executed === false).length}`);
    }
    console.log('\nReviewed literals:');
    for (const verdict of ['composed', 'dead', 'out-of-scope', 'diagnostic']) {
        console.log(`  ${verdict}: ${[...reviewed.values()].filter(review => review.verdict === verdict).length}`);
    }
    if (args.includes('--verbose')) {
        for (const [key, review] of reviewed) console.log(`  [${review.verdict}] ${key}\n    ${review.reason}`);
    }
    for (const { review, reason } of stale) {
        console.error(`Stale reviewed literal (${reason}): ${messageLedgerKey(review)}\n  ${review.reason}`);
    }
    if (stale.length && option('--check-ledger')) process.exitCode = 1;
    const byFile = new Map<string, MessageRow[]>();
    for (const row of missing) {
        if (row.infrastructure || row.category !== 'message') continue;
        byFile.set(row.file, [...(byFile.get(row.file) ?? []), row]);
    }
    console.log('\n## Missing gameplay messages by file\n');
    console.log('Absent verbatim; `~` marks a near match (likely composed differently, lower priority).\n');
    for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
        console.log(`${file} (${list.length})`);
        for (const row of [...list].sort((a, b) => Number(a.near) - Number(b.near))) {
            const where = row.executed === null ? '' : row.executed ? ' [executed]' : ' [never executed]';
            console.log(`  ${row.near ? '~' : ' '} ${row.owner}${where}: ${JSON.stringify(row.literal)}`);
        }
    }
    console.log(`\nFull rows: ${relative(ROOT, join(CACHE, 'messages.json'))}`);

    applyLedger(option, rows.filter(row => row.present).map(messageLedgerKey), 'messages',
        'file\towner\tpiece — C literals present in the port (static-gaps.mjs messages)');
}

// ── constants ──

async function constants(args: string[]): Promise<void> {
    const option = optionReader(args);
    const tree = resolveCSourceTree(ROOT, CACHE);
    const rows = await checkConstants(ROOT, tree, CACHE);
    writeFileSync(join(CACHE, 'constants.json'), JSON.stringify(rows, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value, 1) + '\n');
    const of = (status: string): number => rows.filter(row => row.status === status).length;
    console.log('# Port constants checked against C\n');
    console.log(`${rows.length} names shared with C: ${of('match')} match, ${of('mismatch')} differ, `
        + `${of('incomparable')} not integer constants in C`);
    const duplicates = rows.filter(row => new Set(row.port.map(definition => definition.value)).size > 1);
    if (duplicates.length) console.log(`${duplicates.length} names have port definitions that disagree with each other`);
    console.log('\n## Values that differ from C (most used first; unused ones can simply be corrected or removed)\n');
    for (const row of rows.filter(entry => entry.status === 'mismatch').sort((a, b) => b.uses - a.uses)) {
        const where = row.port.map(definition => `${definition.file}:${definition.line} = ${definition.value}`).join(', ');
        console.log(`${row.name} [${row.uses} uses]: C ${row.cValue ?? '?'}; port ${where}`);
    }
    console.log(`\nFull rows: ${relative(ROOT, join(CACHE, 'constants.json'))}`);
    applyLedger(option, rows.filter(row => row.status === 'match').map(row => row.name), 'constants',
        'C macro and enum names whose port value matches C (static-gaps.mjs constants)');
}

// ── edges ──

async function edges(args: string[]): Promise<void> {
    const option = optionReader(args);
    const tree = resolveCSourceTree(ROOT, CACHE);
    const { rows, unmapped } = await compareEdges(ROOT, tree, CACHE, (await cFacts(tree)).definedIn);
    writeFileSync(join(CACHE, 'edges.json'), JSON.stringify({ rows, unmapped }, null, 1) + '\n');
    const only = option('--function');
    if (only) {
        for (const row of rows.filter(entry => entry.function === only)) {
            console.log(`${row.file} ${row.function} → ${row.port.join(', ')} (by ${row.mapping})`);
            console.log(`  present: ${row.present.join(' ')}`);
            console.log(`  cited:   ${row.cited.join(' ')}`);
            console.log(`  justified: ${row.justified.join(' ')}`);
            console.log(`  missing: ${row.missing.join(' ')}`);
        }
        if (unmapped.some(entry => entry.function === only)) console.log(`${only}: no port counterpart`);
        return;
    }
    const gameplay = rows.filter(row => !row.infrastructure);
    const sum = (list: readonly EdgeRow[], key: 'present' | 'cited' | 'justified' | 'missing'): number =>
        list.reduce((n, row) => n + row[key].length, 0);
    const line = (list: readonly EdgeRow[]): string => `${sum(list, 'missing')} missing, ${sum(list, 'cited')} only cited, `
        + `${sum(list, 'justified')} justified, ${sum(list, 'present')} present`;
    console.log('# C call edges the port counterpart does not reach\n');
    console.log(`${rows.length} C functions with a port counterpart `
        + `(${rows.filter(row => row.mapping === 'citation').length} found by comment citation); ${unmapped.length} without one`);
    console.log(`edges: ${line(rows)}`);
    console.log(`gameplay files: ${line(gameplay)}`);
    console.log('\n## Gameplay functions with the most missing edges (cited-only edges in brackets)\n');
    for (const row of [...gameplay].sort((a, b) => b.missing.length - a.missing.length).slice(0, 80)) {
        if (!row.missing.length) break;
        const total = row.missing.length + row.cited.length + row.justified.length + row.present.length;
        console.log(`${row.file} ${row.function} (${row.missing.length} of ${total}): ${row.missing.join(' ')}`
            + (row.cited.length ? ` [${row.cited.join(' ')}]` : ''));
    }
    console.log(`\nFull rows: ${relative(ROOT, join(CACHE, 'edges.json'))}`);
    applyLedger(option, rows.flatMap(row => row.present.map(callee => `${row.function}\t${callee}`)), 'edges',
        'caller\tcallee — C call edges the port counterpart reaches (static-gaps.mjs edges)');
}

// ── owners ──

// Folds the edges mapping by module: which C file each port module ports,
// which functions stray into other C files, and which C files are spread
// over many modules (see lib/module-owners.mts).
async function ownership(args: string[]): Promise<void> {
    const option = optionReader(args);
    const tree = resolveCSourceTree(ROOT, CACHE);
    const { rows } = await compareEdges(ROOT, tree, CACHE, (await cFacts(tree)).definedIn);
    const report = moduleOwnership(rows);
    writeFileSync(join(CACHE, 'owners.json'), JSON.stringify(report, null, 1) + '\n');
    const single = report.modules.filter(row => row.minority.length === 0).length;
    const near = report.modules.filter(row => row.minority.length && !row.beyondTolerance);
    const beyond = report.modules.filter(row => row.beyondTolerance);
    console.log('# Port modules by the C file their functions map to\n');
    console.log(`${report.modules.length} modules with mapped C functions: ${single} single-owner, `
        + `${near.length} nearly (strays within ${MIXED_TOLERANCE}), ${beyond.length} mixed beyond tolerance`);
    console.log(`${report.cFiles.length} C files with mapped functions\n`);
    console.log('## Modules mixed beyond tolerance (minority functions with their C file)\n');
    const straysOf = (row: { minority: { functions: string[] }[] }): number =>
        row.minority.reduce((total, entry) => total + entry.functions.length, 0);
    for (const row of [...beyond].sort((a, b) => straysOf(b) - straysOf(a) || a.module.localeCompare(b.module))
        .slice(0, 40)) {
        console.log(`${row.module} (${row.mapped} mapped): `
            + row.counts.map(({ file, count }) => `${file} ${count}`).join(', '));
        for (const { file, functions } of row.minority) {
            const shown = functions.slice(0, 12).join(' ');
            const more = functions.length > 12 ? ` … +${functions.length - 12}` : '';
            console.log(`    ${file}: ${shown}${more}`);
        }
    }
    console.log('\n## Nearly single-owner modules (strays within tolerance)\n');
    for (const row of [...near].sort((a, b) => a.module.localeCompare(b.module))) {
        console.log(`${row.module} (${row.mapped} mapped): `
            + row.minority.map(({ file, functions }) => `${file}: ${functions.join(' ')}`).join('; '));
    }
    console.log('\n## C files whose ports are spread across the most modules\n');
    for (const row of report.cFiles.slice(0, 40)) {
        console.log(`${row.file} (${row.modules.length} modules, ${row.mapped} mapped): `
            + row.modules.slice(0, 12).map(({ module, count }) => `${module} ${count}`).join(', '));
    }
    console.log(`\nFull rows: ${relative(ROOT, join(CACHE, 'owners.json'))}`);
    applyLedger(option, report.singleOwnerKeys, 'module owners',
        'module\tC file — port modules whose mapped C functions all come from one C file (static-gaps.mjs owners)');
}


// ── screens ──

// The C functions whose literals appear in `text`, longest piece first.
function owners(text: string, literals: readonly CLiteral[]): string[] {
    const hits = literals.filter(literal => text.includes(literal.piece))
        .sort((a, b) => b.piece.length - a.piece.length);
    const best = hits[0]?.piece.length ?? 0;
    return [...new Set(hits.filter(hit => hit.piece.length === best).map(hit => `${hit.file}:${hit.owner}`))];
}

async function screens(args: string[]): Promise<void> {
    const runDir = args[0];
    if (!runDir) throw new Error('screens needs a triage run directory');
    const { literals } = await cFacts(resolveCSourceTree(ROOT, CACHE));
    const path = join(runDir, 'results.jsonl');
    const clusters = new Map<string, string[]>();
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    let screenOnly = 0;
    console.log('# Screen-only first differences by owning C function\n');
    lines.forEach((line, index) => {
        const label = `${path}:${index + 1}`;
        const result = objectValue(JSON.parse(line), label);
        const first = result['firstDivergence'];
        if (first === null || objectValue(first, `${label}.firstDivergence`)['kind'] !== 'screen') return;
        const screen = objectValue(result['firstScreen'], `${label}.firstScreen`);
        const session = typeof result['session'] === 'string' ? result['session'] : label;
        screenOnly++;
        const add = (key: string, entry: string): void => { clusters.set(key, [...(clusters.get(key) ?? []), entry]); };
        // A cursor-only difference has no differing row to match literals on.
        if (screen['cell'] === null) {
            add('(cursor only, no differing row)', `${session}\n      cursors: ${JSON.stringify(screen['cursors'])}`);
            return;
        }
        const row = numberValue(objectValue(screen['cell'], `${label}.cell`)['row'], `${label}.cell.row`);
        const shown = arrayValue(screen['rows'], `${label}.rows`).map((value, rowIndex) => objectValue(value, `${label}.rows[${rowIndex}]`))
            .find(entry => entry['row'] === row);
        if (!shown) {
            add(`(row ${row} not recorded)`, session);
            return;
        }
        const cText = stringValue(shown['c'], `${label}.rows.c`), jsText = stringValue(shown['js'], `${label}.rows.js`);
        const cOwners = owners(cText, literals), jsOwners = owners(jsText, literals);
        const key = cOwners.length ? cOwners.join(' | ') : jsOwners.length ? `(port printed) ${jsOwners.join(' | ')}` : `(row ${row}, no literal)`;
        add(key, `${session}\n      C:  ${cText.trim().slice(0, 100)}\n      JS: ${jsText.trim().slice(0, 100)}`);
    });
    console.log(`${screenOnly} sessions whose first difference is on the screen\n`);
    for (const [key, sessions] of [...clusters].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`${key} (${sessions.length})`);
        for (const entry of sessions.slice(0, 3)) console.log(`    ${entry}`);
    }
}

const USAGE = 'usage: static-gaps.mjs {messages [--coverage C-COVERAGE.json] [--reviewed-ledger R.tsv] [--verbose] '
    + '| constants | edges [--function NAME] | owners | screens RUN_DIR} '
    + '[--check-ledger L.tsv] [--write-ledger L.tsv]';
const [command, ...rest] = process.argv.slice(2);
try {
    if (command === 'messages') await messages(rest);
    else if (command === 'constants') await constants(rest);
    else if (command === 'edges') await edges(rest);
    else if (command === 'owners') await ownership(rest);
    else if (command === 'screens') await screens(rest);
    else {
        console.error(USAGE);
        process.exitCode = 2;
    }
} catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
}
