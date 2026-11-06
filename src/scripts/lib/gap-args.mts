// gap-args.mts — TRUE/FALSE call arguments the port spells differently.
//
// The `edges` mode proves that a port counterpart makes each C call; it
// cannot see the arguments. A literal TRUE/FALSE that the port spells as the
// opposite `true`/`false` is a bug class the call graph cannot express: the
// reset_utrap(TRUE) callers that passed `false` all had the edge present.
// This mode records, for every CallExpr inside a C function, the arguments
// spelled `TRUE` or `FALSE` — the macro spelling at the expansion location,
// not the folded 1/0, so `makeknown(x)` (whose TRUEs live in a header macro
// body) and `safe_teleds(TELEDS_NO_FLAGS)` do not count — and compares, per
// (C caller, C callee) pair, the sequences against the bare `true`/`false`
// literals of the counterpart calls.
//
// Reach rule, same depth as `edges`: a call counts when it sits in the
// caller counterpart's own body, or in a port function that one calls up to
// REACH_DEPTH deep, except that a reached function which counterparts a
// DIFFERENT C function owns its calls (they are compared in that function's
// own pair); only helpers without a C counterpart — code the port moved out
// of the caller — are transparent. This keeps C's `fix_worst_trouble →
// safe_teleds → teleds → reset_utrap(FALSE)` chain out of the
// fix_worst_trouble pair, which owns only its direct reset_utrap(TRUE).
//
// Comparison per pair: the C side contributes one TRUE/FALSE sequence per
// call site that spells at least one of them (other arguments ignored); the
// port side one true/false sequence per counterpart call. Equal multisets
// match; the same number of calls and boolean arguments with different
// values is a mismatch; anything else — different call or argument counts,
// or a flag moved into an options object such as `{ silent: true }` — is
// uncomparable. A mismatch is an audit lead, not a verdict: a signature that
// renames or inverts the flag reads as a mismatch until a human classifies
// it. Sessions, the RNG ledgers and the state oracle still decide.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { INFRASTRUCTURE_FILES, baseName, calleeName, forEachTopLevelDecl, walkJson } from './c-sources.mjs';
import type { CSourceTree } from './c-sources.mjs';
import { REACH_DEPTH, counterpartsOf, portIndex, readAliases } from './gap-edges.mjs';
import type { PortFunction } from './gap-edges.mjs';
import { arrayValue, numberValue, objectValue, stringValue } from './session-types.mjs';

const EXTRACTOR_VERSION = 'args-2';

export type CBool = 'TRUE' | 'FALSE';
export type PortBool = 'true' | 'false';

// One C call site with at least one TRUE/FALSE argument.
export interface CArgCall {
    caller: string;
    callee: string;
    line: number;
    // Boolean-literal arguments in argument order; `index` counts every
    // argument of the call, boolean or not.
    args: { index: number; value: CBool }[];
}

interface FileArgFacts { calls: CArgCall[]; functions: string[] }

// One counterpart call found on the reach path.
export interface PortArgCall {
    // The port function the call sits in, as src/js/file.ts:line.
    fn: string;
    // The call's own line in that file.
    line: number;
    values: PortBool[];
    // An argument is an object literal with a true/false property value:
    // the flag may hide there, so the pair becomes uncomparable.
    optionsObject: boolean;
}

export interface ArgRow {
    // The C file the caller is defined in.
    file: string;
    caller: string;
    callee: string;
    mapping: 'name' | 'citation';
    infrastructure: boolean;
    // Counterpart locations (caller side, then callee side).
    port: string[];
    cCalls: { line: number; args: { index: number; value: CBool }[] }[];
    portCalls: PortArgCall[];
    verdict: 'match' | 'mismatch' | 'uncomparable';
    reason: string;
}

export interface ArgReport {
    rows: ArgRow[];
    // C call occurrences whose pair was compared (both sides mapped).
    comparedCalls: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
}

// The expressions TRUE and FALSE expand to: ParenExpr → CStyleCastExpr →
// IntegerLiteral (global.h spells them `((boolean) 1)` and `((boolean) 0)`).
// Any other argument shape — an identifier, an operator, more than one
// literal — is not a bare boolean macro argument.
const WRAPPER_KINDS = new Set(['ParenExpr', 'ImplicitCastExpr', 'CStyleCastExpr']);

function literalOf(node: Record<string, unknown>): Record<string, unknown> | null {
    const kind = node['kind'];
    if (kind === 'IntegerLiteral') return node;
    if (typeof kind !== 'string' || !WRAPPER_KINDS.has(kind)) return null;
    const inner = node['inner'];
    if (!Array.isArray(inner) || inner.length !== 1) return null;
    const child = asRecord(inner[0]);
    return child === null ? null : literalOf(child);
}

function readToken(loc: Record<string, unknown>, readLines: (path: string) => string[] | null): string | null {
    const file = loc['file'], line = loc['line'], col = loc['col'], tokLen = loc['tokLen'];
    if (typeof file !== 'string' || typeof line !== 'number' || typeof col !== 'number' || typeof tokLen !== 'number') return null;
    const lines = readLines(file);
    const text = lines === null ? null : lines[line - 1];
    if (typeof text !== 'string') return null;
    return text.slice(col - 1, col - 1 + tokLen);
}

// `TRUE`/`FALSE` when the argument is exactly the macro's literal and the
// expansion location spells the macro name itself.
function booleanArg(arg: unknown, readLines: (path: string) => string[] | null): CBool | null {
    const record = asRecord(arg);
    if (record === null) return null;
    const literal = literalOf(record);
    if (literal === null) return null;
    const range = asRecord(record['range']);
    const begin = range === null ? null : asRecord(range['begin']);
    const expansion = begin === null ? null : asRecord(begin['expansionLoc']);
    if (expansion === null) return null;
    const spelled = readToken(expansion, readLines);
    const value = literal['value'];
    if (spelled === 'TRUE' && value === '1') return 'TRUE';
    if (spelled === 'FALSE' && value === '0') return 'FALSE';
    return null;
}

function callLine(call: Record<string, unknown>): number {
    const range = asRecord(call['range']);
    const begin = range === null ? null : asRecord(range['begin']);
    if (begin !== null && typeof begin['line'] === 'number') return begin['line'];
    const expansion = begin === null ? null : asRecord(begin['expansionLoc']);
    return expansion !== null && typeof expansion['line'] === 'number' ? expansion['line'] : 0;
}

async function extractArgFacts(tree: CSourceTree, file: string): Promise<FileArgFacts> {
    const calls: CArgCall[] = [];
    const functions: string[] = [];
    const linesOf = new Map<string, string[] | null>();
    const readLines = (path: string): string[] | null => {
        if (!linesOf.has(path)) {
            try {
                linesOf.set(path, readFileSync(join(tree.dir, path), 'utf8').split('\n'));
            } catch {
                linesOf.set(path, null);
            }
        }
        return linesOf.get(path) ?? null;
    };
    await forEachTopLevelDecl(tree, file, (decl, tracker) => {
        const kind = decl['kind'];
        const name = decl['name'];
        if (kind !== 'FunctionDecl' || typeof name !== 'string') return;
        const pending: CArgCall[] = [];
        // The file at the body's opening brace, not at the end of the decl:
        // a trailing reference to something declared in a header (floorfood
        // ends with one) leaves the tracker on the header, which would drop
        // a function defined right here. The first CompoundStmt in emission
        // order is the body; header declarations have none.
        let bodyFile: string | null = null;
        walkJson(decl, tracker, node => {
            if (bodyFile === null && node['kind'] === 'CompoundStmt') bodyFile = tracker.current;
            if (node['kind'] !== 'CallExpr') return;
            const callee = calleeName(node);
            if (callee === null) return;
            const inner = node['inner'];
            if (!Array.isArray(inner)) return;
            const args: { index: number; value: CBool }[] = [];
            for (let index = 1; index < inner.length; index++) {
                const value = booleanArg(inner[index], readLines);
                if (value !== null) args.push({ index: index - 1, value });
            }
            if (args.length) pending.push({ caller: name, callee, line: callLine(node), args });
        }, node => {
            if (node['id'] === decl['id'] && bodyFile === file) {
                functions.push(name);
                calls.push(...pending);
            }
        });
    });
    return { calls, functions };
}

function decodeArgCall(value: unknown, label: string): CArgCall {
    const row = objectValue(value, label);
    const args = arrayValue(row['args'], `${label}.args`).map((item, index): { index: number; value: CBool } => {
        const arg = objectValue(item, `${label}.args[${index}]`);
        const bool = stringValue(arg['value'], `${label}.args[${index}].value`);
        if (bool !== 'TRUE' && bool !== 'FALSE') throw new Error(`${label}.args[${index}].value must be TRUE or FALSE`);
        return { index: numberValue(arg['index'], `${label}.args[${index}].index`), value: bool };
    });
    if (!args.length) throw new Error(`${label}.args must not be empty`);
    return {
        caller: stringValue(row['caller'], `${label}.caller`),
        callee: stringValue(row['callee'], `${label}.callee`),
        line: numberValue(row['line'], `${label}.line`),
        args,
    };
}

function decodeArgFacts(value: unknown, label: string): FileArgFacts {
    const row = objectValue(value, label);
    return {
        calls: arrayValue(row['calls'], `${label}.calls`).map((call, index) => decodeArgCall(call, `${label}.calls[${index}]`)),
        functions: arrayValue(row['functions'], `${label}.functions`).map(name => stringValue(name, `${label} function`)),
    };
}

// Per-file results cached by content, extractor version and clang arguments,
// like the c-facts cache the messages mode uses.
export async function cArgFacts(tree: CSourceTree, cacheDir: string): Promise<{ calls: CArgCall[]; definedIn: Map<string, string> }> {
    const dir = join(cacheDir, 'c-args');
    mkdirSync(dir, { recursive: true });
    const pending = [...tree.files];
    const results = new Map<string, FileArgFacts>();
    const worker = async (): Promise<void> => {
        for (let file = pending.shift(); file !== undefined; file = pending.shift()) {
            const key = createHash('sha256').update(EXTRACTOR_VERSION).update('\0').update(tree.clangArgs.join(' '))
                .update('\0').update(readFileSync(join(tree.dir, file))).digest('hex').slice(0, 16);
            const cached = join(dir, `${baseName(file)}.${key}.json`);
            if (existsSync(cached)) {
                results.set(file, decodeArgFacts(JSON.parse(readFileSync(cached, 'utf8')), cached));
                continue;
            }
            const facts = await extractArgFacts(tree, file);
            writeFileSync(cached, JSON.stringify(facts) + '\n');
            results.set(file, facts);
            process.stderr.write(`  ${file}: ${facts.calls.length} boolean-literal calls, ${facts.functions.length} functions\n`);
        }
    };
    await Promise.all(Array.from({ length: 3 }, () => worker()));
    const definedIn = new Map<string, string>();
    for (const file of tree.files) {
        for (const name of results.get(file)?.functions ?? []) if (!definedIn.has(name)) definedIn.set(name, baseName(file));
    }
    return { calls: tree.files.flatMap(file => results.get(file)?.calls ?? []), definedIn };
}

// The multiset comparison of one pair, pure so tests can pin its rules.
export function classifyArgs(cSequences: readonly (readonly CBool[])[],
    portCalls: readonly { values: readonly PortBool[]; optionsObject: boolean }[]):
    { verdict: 'match' | 'mismatch' | 'uncomparable'; reason: string } {
    if (portCalls.some(call => call.optionsObject)) {
        return { verdict: 'uncomparable', reason: 'the port passes a flag in an options object' };
    }
    if (cSequences.length !== portCalls.length) {
        return { verdict: 'uncomparable', reason: `${cSequences.length} C call sites, ${portCalls.length} port calls` };
    }
    const key = (values: readonly string[]): string => values.join(',');
    const cKeys = cSequences.map(sequence => key(sequence.map(value => value.toLowerCase()))).sort();
    const portKeys = portCalls.map(call => key(call.values)).sort();
    if (cKeys.join(';') === portKeys.join(';')) return { verdict: 'match', reason: '' };
    if (cSequences.reduce((total, sequence) => total + sequence.length, 0)
        !== portCalls.reduce((total, call) => total + call.values.length, 0)) {
        return { verdict: 'uncomparable', reason: 'different numbers of boolean arguments' };
    }
    return { verdict: 'mismatch', reason: 'the same calls with the same argument counts spell different values' };
}

// The ledger key of a matching pair: C names plus the canonical multiset,
// so flipping one literal, or adding or dropping a call, changes the key.
export function argLedgerKey(caller: string, callee: string, cSequences: readonly (readonly CBool[])[]): string {
    const canonical = cSequences.map(sequence => sequence.map(value => value.toLowerCase()).join('+')).sort().join(';');
    return `${caller}\t${callee}\t${canonical}`;
}

export function argRowKey(row: ArgRow): string {
    return argLedgerKey(row.caller, row.callee, row.cCalls.map(call => call.args.map(arg => arg.value)));
}

function portCallArgs(node: ts.CallExpression): { values: PortBool[]; optionsObject: boolean } {
    const values: PortBool[] = [];
    let optionsObject = false;
    for (const argument of node.arguments) {
        if (argument.kind === ts.SyntaxKind.TrueKeyword || argument.kind === ts.SyntaxKind.FalseKeyword) {
            values.push(argument.kind === ts.SyntaxKind.TrueKeyword ? 'true' : 'false');
        } else if (ts.isObjectLiteralExpression(argument)) {
            optionsObject ||= argument.properties.some(property => ts.isPropertyAssignment(property)
                && (property.initializer.kind === ts.SyntaxKind.TrueKeyword
                    || property.initializer.kind === ts.SyntaxKind.FalseKeyword));
        }
    }
    return { values, optionsObject };
}

export async function compareArgs(root: string, tree: CSourceTree, cacheDir: string): Promise<ArgReport> {
    const { calls, definedIn } = await cArgFacts(tree, cacheDir);
    const index = portIndex(root);
    const aliases = readAliases(join(root, 'docs', 'ledger', 'c-ts-aliases.tsv'));

    // Which port functions counterpart which C functions; a function that
    // counterparts a C function other than the caller owns its calls.
    const ownedBy = new Map<PortFunction, Set<string>>();
    for (const name of definedIn.keys()) {
        const file = definedIn.get(name) ?? '?';
        for (const fn of counterpartsOf(index, aliases, name, file).fns) {
            ownedBy.set(fn, new Set([...(ownedBy.get(fn) ?? []), name]));
        }
    }

    // Pair the C occurrences: caller → callee → calls (with the caller's file).
    const pairs = new Map<string, Map<string, { files: Set<string>; calls: CArgCall[] }>>();
    for (const call of calls) {
        const callees = pairs.get(call.caller) ?? new Map<string, { files: Set<string>; calls: CArgCall[] }>();
        const entry = callees.get(call.callee) ?? { files: new Set<string>(), calls: [] };
        entry.files.add(definedIn.get(call.caller) ?? '?');
        entry.calls.push(call);
        callees.set(call.callee, entry);
        pairs.set(call.caller, callees);
    }

    const rows: ArgRow[] = [];
    let comparedCalls = 0;
    for (const [caller, callees] of [...pairs].sort((a, b) => a[0].localeCompare(b[0]))) {
        for (const [callee, entry] of [...callees].sort((a, b) => a[0].localeCompare(b[0]))) {
            const calleeFile = definedIn.get(callee) ?? '?';
            const calleeCounterparts = counterpartsOf(index, aliases, callee, calleeFile);
            if (!calleeCounterparts.fns.length) continue;
            // The caller can be defined in several C files; each file's
            // counterparts count.
            let mapping: 'name' | 'citation' = 'citation';
            const callerFns = new Set<PortFunction>();
            for (const file of entry.files) {
                const counterparts = counterpartsOf(index, aliases, caller, file);
                if (counterparts.mapping === 'name') mapping = 'name';
                for (const fn of counterparts.fns) callerFns.add(fn);
            }
            if (!callerFns.size) continue;
            const calleeFns = new Set(calleeCounterparts.fns);

            // Walk REACH_DEPTH levels, attributing only the calls of the
            // caller counterparts and of helpers no other C function owns.
            const seen = new Set<PortFunction>();
            const portCalls: PortArgCall[] = [];
            let frontier = [...callerFns];
            for (let depth = 0; depth <= REACH_DEPTH && frontier.length; depth++) {
                const next: PortFunction[] = [];
                for (const fn of frontier) {
                    if (seen.has(fn)) continue;
                    seen.add(fn);
                    const owners = ownedBy.get(fn);
                    const transparent = callerFns.has(fn)
                        || owners === undefined || ([...owners].every(owner => owner === caller));
                    if (transparent) {
                        for (const call of index.callsOf(fn)) {
                            if (!calleeFns.has(call.callee)) continue;
                            const args = portCallArgs(call.node);
                            const source = call.node.getSourceFile();
                            portCalls.push({ fn: index.locate(fn),
                                line: source.getLineAndCharacterOfPosition(call.node.getStart(source)).line + 1,
                                values: args.values, optionsObject: args.optionsObject });
                        }
                    }
                    next.push(...index.calleesOf(fn));
                }
                frontier = next;
            }

            const cCalls = entry.calls.map(call => ({ line: call.line, args: call.args }));
            const { verdict, reason } = classifyArgs(
                cCalls.map(call => call.args.map(arg => arg.value)), portCalls);
            comparedCalls += cCalls.length;
            rows.push({
                file: [...entry.files].sort().join('|'), caller, callee, mapping,
                infrastructure: [...entry.files].every(file => INFRASTRUCTURE_FILES.has(file)),
                port: [...callerFns].map(index.locate).sort(),
                cCalls, portCalls, verdict, reason,
            });
        }
    }
    return { rows, comparedCalls };
}
