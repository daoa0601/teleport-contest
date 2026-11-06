// gap-args.mts — TRUE/FALSE call arguments the port spells differently.
//
// The `edges` mode proves that a port counterpart makes each C call; it
// cannot see the arguments. A literal TRUE/FALSE that the port spells as the
// opposite `true`/`false` is a bug class the call graph cannot express: the
// reset_utrap(TRUE) callers that passed `false` all had the edge present.
// This mode records, for every CallExpr inside a C function, the arguments
// spelled `TRUE` or `FALSE` — the macro spelling at the expansion location,
// not the folded 1/0, so `makeknown(x)` (whose TRUEs live in a header macro
// body) and `safe_teleds(TELEDS_NO_FLAGS)` do not count; locations marked
// `isMacroArgExpansion` (booleans written inside another macro's argument
// list, `Sprintf(buf, "%s", piousness(TRUE, ...))`) are skipped too, because
// clang versions report different positions for them. What remains is
// compared, per (C caller, C callee) pair, against the bare `true`/`false`
// literals of the counterpart calls.
//
// Reach rule, same depth as `edges`: a call counts when it sits in the
// caller counterpart's own body, or in a port function that one calls up to
// REACH_DEPTH deep, except that a reached function which counterparts a
// DIFFERENT C function owns its calls (they are compared in that function's
// own pair) and the walk does not continue through it; only helpers without
// a C counterpart — code the port moved out of the caller — are
// transparent. This keeps C's `fix_worst_trouble → safe_teleds → teleds →
// reset_utrap(FALSE)` chain, and potionbreathe's exercise() calls, out of
// the pairs that merely call into those functions.
//
// Comparison per pair: each side contributes one sequence per call site
// that spells at least one boolean literal (other arguments ignored) — a
// port call whose flags all hide in defaults or variables is not an
// occurrence, so a pair that also passes a non-literal flag still
// compares, while a call whose flag hides in an options object stays one
// and makes the pair uncomparable. Equal multisets match; the same number
// of calls and per-call boolean counts with different values is a mismatch;
// else — different call counts, per-call counts split differently across
// the calls, or a flag moved into an options object such as
// `{ silent: true }` — is uncomparable. A mismatch is an audit lead, not a
// verdict: a signature that renames or inverts the flag reads as one
// until a human classifies it. Sessions, the RNG ledgers and the state
// oracle still decide.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { INFRASTRUCTURE_FILES, baseName, calleeName, forEachTopLevelDecl, walkJson } from './c-sources.mjs';
import { REACH_DEPTH, counterpartsOf, portIndex, readAliases } from './gap-edges.mjs';
import { arrayValue, numberValue, objectValue, stringValue } from './session-types.mjs';
const EXTRACTOR_VERSION = 'args-7';
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
}
// The expressions TRUE and FALSE expand to: ParenExpr → CStyleCastExpr →
// IntegerLiteral (global.h spells them `((boolean) 1)` and `((boolean) 0)`).
// Any other argument shape — an identifier, an operator, more than one
// literal — is not a bare boolean macro argument.
const WRAPPER_KINDS = new Set(['ParenExpr', 'ImplicitCastExpr', 'CStyleCastExpr']);
function literalOf(node) {
    const kind = node['kind'];
    if (kind === 'IntegerLiteral')
        return node;
    if (typeof kind !== 'string' || !WRAPPER_KINDS.has(kind))
        return null;
    const inner = node['inner'];
    if (!Array.isArray(inner) || inner.length !== 1)
        return null;
    const child = asRecord(inner[0]);
    return child === null ? null : literalOf(child);
}
// clang's JSON dumper omits a location's `file` and `line` when they equal
// the last location it printed (LastLocFilename/LastLocLine across the whole
// dump, in print order: `loc`, then `range.begin`, `range.end`, and within a
// macro location `spellingLoc` before `expansionLoc`). Which locations come
// out elided depends on the clang version, so reading one in isolation drops
// real arguments — CI's clang lost `getrumor(..., TRUE)` (engrave.c) this
// way while the local one lost others. This replays the print order over one
// call subtree, seeded with the tracker state at the call, and returns each
// argument's own range.begin.expansionLoc — the token it spells — resolved.
export function argumentTokens(call, seed) {
    const state = { file: seed.file, line: seed.line };
    const tokens = [];
    const advance = (value, path, capture) => {
        if (Array.isArray(value)) {
            for (const item of value)
                advance(item, path, capture);
            return;
        }
        if (typeof value !== 'object' || value === null)
            return;
        const record = Object.fromEntries(Object.entries(value));
        if (typeof record['offset'] === 'number') {
            const file = record['file'];
            const line = record['line'];
            if (typeof file === 'string')
                state.file = file;
            if (typeof line === 'number')
                state.line = line;
            // Only the argument's own range.begin.expansionLoc counts;
            // nested wrapper nodes carry the same token but deeper paths.
            // A macro-argument expansion is skipped: clang versions disagree
            // on where it points (CI's resolves the argument's position,
            // this one points at the enclosing Sprintf() token), so those
            // spellings are not stable across the dumpers.
            if (capture !== null && capture.token === null && path === 'range.begin.expansionLoc'
                && record['isMacroArgExpansion'] !== true) {
                const col = record['col'], tokLen = record['tokLen'];
                if (typeof col === 'number' && typeof tokLen === 'number') {
                    capture.token = {
                        file: typeof file === 'string' ? file : state.file,
                        line: typeof line === 'number' ? line : state.line,
                        col, tokLen,
                    };
                }
            }
        }
        for (const [key, child] of Object.entries(record)) {
            if (key === 'includedFrom' || typeof child !== 'object' || child === null)
                continue;
            advance(child, path === '' ? key : `${path}.${key}`, capture);
        }
    };
    for (const [key, child] of Object.entries(call)) {
        if (key === 'includedFrom' || typeof child !== 'object' || child === null)
            continue;
        if (key !== 'inner') {
            advance(child, '', null);
            continue;
        }
        // The callee comes first; every following child is an argument.
        if (Array.isArray(child)) {
            child.forEach((element, index) => {
                if (typeof element !== 'object' || element === null)
                    return;
                if (index === 0) {
                    advance(element, '', null);
                    return;
                }
                const capture = { token: null };
                advance(element, '', capture);
                tokens.push(capture.token);
            });
        }
    }
    return tokens;
}
function readTokenAt(token, readLines) {
    const lines = readLines(token.file);
    const text = lines === null ? null : lines[token.line - 1];
    if (typeof text !== 'string')
        return null;
    return text.slice(token.col - 1, token.col - 1 + token.tokLen);
}
// `TRUE`/`FALSE` when the argument is exactly the macro's literal and the
// resolved expansion location spells the macro name itself.
function booleanArg(arg, token, readLines) {
    const record = asRecord(arg);
    if (record === null || token === null)
        return null;
    const literal = literalOf(record);
    if (literal === null)
        return null;
    const spelled = readTokenAt(token, readLines);
    const value = literal['value'];
    if (spelled === 'TRUE' && value === '1')
        return 'TRUE';
    if (spelled === 'FALSE' && value === '0')
        return 'FALSE';
    return null;
}
// The call's own line for the report. An omitted `line` means the line
// equals the previously printed location's, in print order: the expansion
// location falls back to the spelling location printed just before it, and
// only a spelling location that omits its line too falls back to the
// tracker's line from before the call (enter runs before the call's range
// children, so that is the location just above the call).
export function callLine(call, lastLine) {
    const range = asRecord(call['range']);
    const begin = range === null ? null : asRecord(range['begin']);
    if (begin !== null && typeof begin['line'] === 'number')
        return begin['line'];
    if (begin !== null) {
        const expansion = asRecord(begin['expansionLoc']);
        if (expansion !== null && typeof expansion['line'] === 'number')
            return expansion['line'];
        const spelling = asRecord(begin['spellingLoc']);
        if (spelling !== null && typeof spelling['line'] === 'number')
            return spelling['line'];
    }
    return lastLine;
}
async function extractArgFacts(tree, file) {
    const calls = [];
    const functions = [];
    const linesOf = new Map();
    const readLines = (path) => {
        if (!linesOf.has(path)) {
            try {
                linesOf.set(path, readFileSync(join(tree.dir, path), 'utf8').split('\n'));
            }
            catch {
                linesOf.set(path, null);
            }
        }
        return linesOf.get(path) ?? null;
    };
    await forEachTopLevelDecl(tree, file, (decl, tracker) => {
        // Every chunk is walked, not only functions: the tracker must see
        // the locations of the declarations in between too, or its file and
        // line go stale and the next function resolves its own location
        // against them (Linux dropped random_engraving to a header this
        // way). Only a FunctionDecl collects calls.
        const name = decl['name'];
        const collect = decl['kind'] === 'FunctionDecl' && typeof name === 'string';
        const pending = [];
        // The file of the declaration's own location: `loc`/`range` print
        // before previousDecl and inner, so the first location in the chunk
        // resolves — through the tracker, which has seen everything printed
        // before it — to the file this declaration is spelled in. Neither
        // end of the decl works instead: a trailing reference can leave the
        // tracker in a header, and on clang 14 the definition's previousDecl
        // and parameter-type locations (headers again) print before the
        // body, which dropped Linux's random_engraving into savefile.h.
        let declFile = null;
        let hasBody = false;
        let depth = 0;
        walkJson(decl, tracker, node => {
            depth++;
            if (declFile === null && typeof node['offset'] === 'number')
                declFile = tracker.current;
            if (node['kind'] === 'CompoundStmt')
                hasBody = true;
            if (!collect || node['kind'] !== 'CallExpr')
                return;
            const callee = calleeName(node);
            if (callee === null)
                return;
            const inner = node['inner'];
            if (!Array.isArray(inner))
                return;
            // The tracker state at enter is the print-order predecessor of
            // the call's own locations, exactly what the replay needs.
            const tokens = argumentTokens(node, { file: tracker.current, line: tracker.line });
            const args = [];
            for (let index = 1; index < inner.length; index++) {
                const value = booleanArg(inner[index], tokens[index - 1] ?? null, readLines);
                if (value !== null)
                    args.push({ index: index - 1, value });
            }
            if (args.length)
                pending.push({ caller: name, callee, line: callLine(node, tracker.line), args });
        }, node => {
            depth--;
            // Commit only when the walk returns to the declaration itself:
            // a recursive call's referencedDecl reuses the declaration's
            // id, and a leave in mid-walk would append the calls collected
            // so far a second time (mkobj.c obj_nexto_xy doubled its calls).
            if (collect && depth === 0 && hasBody && declFile === file) {
                functions.push(name);
                const callerFile = baseName(file);
                calls.push(...pending.map(call => ({ file: callerFile, caller: call.caller,
                    callee: call.callee, line: call.line, args: call.args })));
            }
        });
    });
    return { calls, functions };
}
function decodeArgCall(value, label) {
    const row = objectValue(value, label);
    const args = arrayValue(row['args'], `${label}.args`).map((item, index) => {
        const arg = objectValue(item, `${label}.args[${index}]`);
        const bool = stringValue(arg['value'], `${label}.args[${index}].value`);
        if (bool !== 'TRUE' && bool !== 'FALSE')
            throw new Error(`${label}.args[${index}].value must be TRUE or FALSE`);
        return { index: numberValue(arg['index'], `${label}.args[${index}].index`), value: bool };
    });
    if (!args.length)
        throw new Error(`${label}.args must not be empty`);
    return {
        file: stringValue(row['file'], `${label}.file`),
        caller: stringValue(row['caller'], `${label}.caller`),
        callee: stringValue(row['callee'], `${label}.callee`),
        line: numberValue(row['line'], `${label}.line`),
        args,
    };
}
function decodeArgFacts(value, label) {
    const row = objectValue(value, label);
    return {
        calls: arrayValue(row['calls'], `${label}.calls`).map((call, index) => decodeArgCall(call, `${label}.calls[${index}]`)),
        functions: arrayValue(row['functions'], `${label}.functions`).map(name => stringValue(name, `${label} function`)),
    };
}
// Per-file results cached by content, extractor version and clang arguments,
// like the c-facts cache the messages mode uses.
export async function cArgFacts(tree, cacheDir) {
    // The macOS SDK replaces the libc string functions with
    // __builtin___*_chk macros, which turns every TRUE/FALSE written in
    // their arguments (Sprintf is an object-like macro, so its arguments
    // are plain tokens on glibc) into a macro-argument token pointing at
    // the outer invocation — invisible here. _FORTIFY_SOURCE=0 keeps both
    // platforms on the plain functions (verified: -U alone does not
    // disable Apple's), so the same spellings are extracted. Only this
    // extraction gets the flag; the shared tree feeds the other modes.
    const plainLibc = { dir: tree.dir, files: tree.files, clangArgs: [...tree.clangArgs, '-D_FORTIFY_SOURCE=0'] };
    const dir = join(cacheDir, 'c-args');
    mkdirSync(dir, { recursive: true });
    const pending = [...plainLibc.files];
    const results = new Map();
    const worker = async () => {
        for (let file = pending.shift(); file !== undefined; file = pending.shift()) {
            const key = createHash('sha256').update(EXTRACTOR_VERSION).update('\0').update(plainLibc.clangArgs.join(' '))
                .update('\0').update(readFileSync(join(plainLibc.dir, file))).digest('hex').slice(0, 16);
            const cached = join(dir, `${baseName(file)}.${key}.json`);
            if (existsSync(cached)) {
                results.set(file, decodeArgFacts(JSON.parse(readFileSync(cached, 'utf8')), cached));
                continue;
            }
            const facts = await extractArgFacts(plainLibc, file);
            writeFileSync(cached, JSON.stringify(facts) + '\n');
            results.set(file, facts);
            process.stderr.write(`  ${file}: ${facts.calls.length} boolean-literal calls, ${facts.functions.length} functions\n`);
        }
    };
    await Promise.all(Array.from({ length: 3 }, () => worker()));
    const definedIn = new Map();
    for (const file of tree.files) {
        for (const name of results.get(file)?.functions ?? [])
            if (!definedIn.has(name))
                definedIn.set(name, baseName(file));
    }
    return { calls: tree.files.flatMap(file => results.get(file)?.calls ?? []), definedIn };
}
// The multiset comparison of one pair, pure so tests can pin its rules.
export function classifyArgs(cSequences, portCalls) {
    if (portCalls.some(call => call.optionsObject)) {
        return { verdict: 'uncomparable', reason: 'the port passes a flag in an options object' };
    }
    if (cSequences.length !== portCalls.length) {
        return { verdict: 'uncomparable', reason: `${cSequences.length} C call sites, ${portCalls.length} port calls` };
    }
    const key = (values) => values.join(',');
    const cKeys = cSequences.map(sequence => key(sequence.map(value => value.toLowerCase()))).sort();
    const portKeys = portCalls.map(call => key(call.values)).sort();
    if (cKeys.join(';') === portKeys.join(';'))
        return { verdict: 'match', reason: '' };
    // The same number of booleans overall is not enough: the port may split
    // them differently across its calls (C 1+3 against port 2+2), and then
    // no call aligns with a C call. Equal multisets of per-call counts still
    // allow a mismatch, because pairing the equal-length calls shows the
    // differing values.
    const counts = (lengths) => [...lengths].sort((a, b) => a - b).join(',');
    if (counts(cSequences.map(sequence => sequence.length))
        !== counts(portCalls.map(call => call.values.length))) {
        return { verdict: 'uncomparable', reason: 'different numbers of boolean arguments per call' };
    }
    return { verdict: 'mismatch', reason: 'the same calls with the same argument counts spell different values' };
}
// Include the caller's C file so a same-named static function in another
// file cannot cover a lost match. Port module moves do not change the key.
export function argLedgerKey(file, caller, callee, cSequences) {
    const canonical = cSequences.map(sequence => sequence.map(value => value.toLowerCase()).join('+')).sort().join(';');
    return `${file}\t${caller}\t${callee}\t${canonical}`;
}
export function argRowKey(row) {
    return argLedgerKey(row.file, row.caller, row.callee, row.cCalls.map(call => call.args.map(arg => arg.value)));
}
function portCallArgs(node) {
    const values = [];
    let optionsObject = false;
    for (const argument of node.arguments) {
        if (argument.kind === ts.SyntaxKind.TrueKeyword || argument.kind === ts.SyntaxKind.FalseKeyword) {
            values.push(argument.kind === ts.SyntaxKind.TrueKeyword ? 'true' : 'false');
        }
        else if (ts.isObjectLiteralExpression(argument)) {
            optionsObject ||= argument.properties.some(property => ts.isPropertyAssignment(property)
                && (property.initializer.kind === ts.SyntaxKind.TrueKeyword
                    || property.initializer.kind === ts.SyntaxKind.FalseKeyword));
        }
    }
    return { values, optionsObject };
}
export async function compareArgs(root, tree, cacheDir) {
    const { calls, definedIn } = await cArgFacts(tree, cacheDir);
    const index = portIndex(root);
    const aliases = readAliases(join(root, 'docs', 'ledger', 'c-ts-aliases.tsv'));
    // Which port functions counterpart which C functions; a function that
    // counterparts a C function other than the caller owns its calls.
    const ownedBy = new Map();
    for (const name of definedIn.keys()) {
        const file = definedIn.get(name) ?? '?';
        for (const fn of counterpartsOf(index, aliases, name, file).fns) {
            ownedBy.set(fn, new Set([...(ownedBy.get(fn) ?? []), name]));
        }
    }
    // Pair the C occurrences: (file, caller) → callee → calls. The file keys
    // the pair so that two static functions sharing a name stay separate
    // instead of being checked against whichever file `definedIn` recorded
    // first.
    const pairs = new Map();
    for (const call of calls) {
        const key = `${call.file}\u0000${call.caller}`;
        const entry = pairs.get(key)
            ?? { file: call.file, caller: call.caller, callees: new Map() };
        entry.callees.set(call.callee, [...(entry.callees.get(call.callee) ?? []), call]);
        pairs.set(key, entry);
    }
    const rows = [];
    let comparedCalls = 0;
    const sorted = [...pairs.values()].sort((a, b) => a.file.localeCompare(b.file) || a.caller.localeCompare(b.caller));
    for (const entry of sorted) {
        const caller = entry.caller;
        for (const [callee, callsInFile] of [...entry.callees].sort((a, b) => a[0].localeCompare(b[0]))) {
            const calleeFile = definedIn.get(callee) ?? '?';
            const calleeCounterparts = counterpartsOf(index, aliases, callee, calleeFile);
            if (!calleeCounterparts.fns.length)
                continue;
            // This pair's caller is the function as defined in this one file.
            const counterparts = counterpartsOf(index, aliases, caller, entry.file);
            const mapping = counterparts.mapping;
            const callerFns = new Set(counterparts.fns);
            if (!callerFns.size)
                continue;
            const calleeFns = new Set(calleeCounterparts.fns);
            // Walk REACH_DEPTH levels, attributing only the calls of the
            // caller counterparts and of helpers no other C function owns.
            const seen = new Set();
            const portCalls = [];
            // A call inside a nested closure belongs to the enclosing
            // function's own list as well as the closure's, and the walk
            // passes through the closure; one call node counts once.
            const attributed = new Set();
            let frontier = [...callerFns];
            for (let depth = 0; depth <= REACH_DEPTH && frontier.length; depth++) {
                const next = [];
                for (const fn of frontier) {
                    if (seen.has(fn))
                        continue;
                    seen.add(fn);
                    // A function that counterparts a different C function
                    // owns its calls and its callees: charging them to this
                    // caller would credit, say, potionbreathe's exercise()
                    // calls to dip_potion_explosion, which merely calls the
                    // vapor helper. The walk stops at such a function.
                    const owners = ownedBy.get(fn);
                    if (!callerFns.has(fn) && owners !== undefined
                        && [...owners].some(owner => owner !== caller))
                        continue;
                    for (const call of index.callsOf(fn)) {
                        if (!calleeFns.has(call.callee) || attributed.has(call.node))
                            continue;
                        attributed.add(call.node);
                        const args = portCallArgs(call.node);
                        // An occurrence spells at least one bare literal, the
                        // same rule the C side applies, so the
                        // reset_utrap(TRUE)-vs-false class still compares when
                        // the pair also passes a non-literal flag (a default or
                        // a variable) elsewhere. A call whose flag hides in an
                        // options object stays an occurrence: dropping it
                        // would let a lone matching literal call freeze the
                        // pair as a match — C foo(x, TRUE) + foo(y, var)
                        // against port foo(x, { silent: false }) + foo(y,
                        // true) — where nothing can align the object's flag.
                        if (!args.values.length && !args.optionsObject)
                            continue;
                        const source = call.node.getSourceFile();
                        portCalls.push({ fn: index.locate(fn),
                            line: source.getLineAndCharacterOfPosition(call.node.getStart(source)).line + 1,
                            values: args.values, optionsObject: args.optionsObject });
                    }
                    next.push(...index.calleesOf(fn));
                }
                frontier = next;
            }
            const cCalls = callsInFile.map(call => ({ line: call.line, args: call.args }));
            const { verdict, reason } = classifyArgs(cCalls.map(call => call.args.map(arg => arg.value)), portCalls);
            comparedCalls += cCalls.length;
            rows.push({
                file: entry.file, caller, callee, mapping,
                infrastructure: INFRASTRUCTURE_FILES.has(entry.file),
                port: [...callerFns].map(index.locate).sort(),
                cCalls, portCalls, verdict, reason,
            });
        }
    }
    return { rows, comparedCalls };
}
//# sourceMappingURL=gap-args.mjs.map