// gap-edges.mts — C call-graph edges that the port's counterpart lacks.
//
// For each C function with a port counterpart (the same name ignoring case
// and underscores, or an entry in docs/ledger/c-ts-aliases.tsv), every C function it calls
// should be reachable from the counterpart: named in its body, in the body
// of a port function it calls, up to REACH_DEPTH calls deep (code that the
// port moved into a helper still counts), or called through a port whose
// own first-line citation names the C function (`trapAt`, whose comment
// block opens with `// C trap.c:t_at()`, reaches `t_at`). A missing edge is
// a place to audit: a check, effect or roll that C performs on that path
// and the port does not. Names alone cannot prove an edge correct;
// sessions, ledgers and proofs still do that.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { INFRASTRUCTURE_FILES, baseName } from './c-sources.mjs';
import { isPortSource, portProgram } from './port-program.mjs';
import { arrayValue, objectValue, stringValue } from './session-types.mjs';
const EXTRACTOR_VERSION = 'edges-1';
export const REACH_DEPTH = 2;
// Callees whose job the port does through its own message and naming layer;
// the message map (`static-gaps messages`) covers what they print.
const HELPER_CALLEES = new Set([
    'pline', 'pline_The', 'pline_xy', 'You', 'Your', 'You_cant', 'You_feel', 'You_hear', 'You_see', 'There',
    'verbalize', 'Norep', 'custompline', 'urgent_pline', 'impossible', 'panic', 'debugcore',
    'mon_nam', 'Monnam', 'a_monnam', 'x_monnam', 'y_monnam', 'l_monnam', 'noit_mon_nam', 'noit_Monnam',
    'some_mon_nam', 'Some_Monnam', 'mon_nam_too', 'an', 'An', 'the', 'The', 'just_an', 's_suffix', 'upstart',
    'upwords', 'plur', 'makeplural', 'makesingular', 'xname', 'doname', 'yname', 'Yname2', 'ysimple_name',
    'simpleonames', 'cxname', 'cxname_singular', 'aobjnam', 'Tobjnam', 'otense', 'vtense', 'yobjnam',
    'Yobjnam2', 'distant_name', 'killer_xname', 'singular', 'pmname', 'Mgender', 'pronoun_gender',
    'body_part', 'mbodypart', 'eos', 'strkitten', 'nh_snprintf', 'copynchars', 'lcase', 'ucase', 'highc',
    'lowc', 'strstri', 'fuzzymatch', 'Strcpy', 'Sprintf', 'Strcat', 'is_art',
]);
function graphArgs(tree) {
    return ['--analyze', '-Xclang', '-analyzer-checker=debug.DumpCallGraph',
        ...tree.clangArgs.filter(arg => arg !== '-fsyntax-only'), '-o', '/dev/null'];
}
function run(tree, file) {
    return new Promise((resolve, reject) => {
        const child = spawn('clang', [...graphArgs(tree), file], { cwd: tree.dir, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { out += chunk; });
        child.stderr.on('data', (chunk) => { out += chunk; });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`clang call graph failed on ${file}: ${out.slice(0, 2000)}`)));
    });
}
// `Function: NAME calls: a b c` per function defined in the translation unit.
function parseGraph(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        const match = /^\s*Function: (\S+) calls:(.*)$/.exec(line);
        if (!match?.[1] || match[1] === '<' || match[2] === undefined)
            continue;
        rows.push([match[1], match[2].trim().split(/\s+/).filter(Boolean)]);
    }
    return rows;
}
// `definedIn` maps each function to the .c file that defines its body; the
// call-graph dump also lists merely declared callees, and header inlines.
export async function cCallGraph(tree, cacheDir, definedIn) {
    const dir = join(cacheDir, 'c-graph');
    mkdirSync(dir, { recursive: true });
    const perFile = new Map();
    const pending = [...tree.files];
    const worker = async () => {
        for (let file = pending.shift(); file !== undefined; file = pending.shift()) {
            const key = createHash('sha256').update(EXTRACTOR_VERSION).update('\0').update(graphArgs(tree).join(' '))
                .update('\0').update(readFileSync(join(tree.dir, file))).digest('hex').slice(0, 16);
            const cached = join(dir, `${baseName(file)}.${key}.json`);
            if (existsSync(cached)) {
                const parsed = JSON.parse(readFileSync(cached, 'utf8'));
                perFile.set(file, arrayValue(parsed, cached).map((value, index) => {
                    const pair = arrayValue(value, `${cached}[${index}]`);
                    return [stringValue(pair[0], 'caller'), arrayValue(pair[1], 'callees').map(callee => stringValue(callee, 'callee'))];
                }));
                continue;
            }
            const rows = parseGraph(await run(tree, file));
            writeFileSync(cached, JSON.stringify(rows) + '\n');
            perFile.set(file, rows);
        }
    };
    await Promise.all(Array.from({ length: 4 }, () => worker()));
    const calls = new Map();
    for (const file of tree.files) {
        for (const [caller, callees] of perFile.get(file) ?? []) {
            if (definedIn.get(caller) !== baseName(file))
                continue;
            calls.set(caller, new Set(callees.filter(callee => definedIn.has(callee) && callee !== caller)));
        }
    }
    const fileOf = new Map(definedIn);
    return { calls, fileOf };
}
// Names compared without case or underscores: `trapname` matches `trapName`
// and `mount_steed` matches `mountSteed`.
export function normalizedName(name) {
    return name.toLowerCase().replace(/_/g, '');
}
// Lower-case words of a C or camelCase name.
function words(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split('_').filter(Boolean);
}
// Every word of the multi-word C name appears, in order, as the start of a
// word of the port name: `heal_legs` ~ `healHeroLegs`, `can_saddle` ~
// `monsterCanBeSaddled`.
function wordMatch(cWords, portWords) {
    if (cWords.length < 2)
        return false;
    let at = 0;
    for (const word of portWords)
        if (at < cWords.length && word.startsWith(cWords[at] ?? ''))
            at++;
    return at === cWords.length;
}
// The function's own origin citation: the FIRST comment line of the block
// above the declaration must open with `C file.c:name()`. Mentions later in
// the block, or mid-prose ("reads X() as", "through X()", "via X()"), are
// callee coverage for the edges mode and never an origin.
export function originCitation(firstComment) {
    if (!firstComment)
        return null;
    const match = /^\/\/\s*(?:C\s+)?[A-Za-z0-9_]+\.[ch]:\s*([A-Za-z_][A-Za-z0-9_]*)\(\)/.exec(firstComment);
    return match?.[1] ?? null;
}
// The `file.c:` prefix of a first-line origin citation, `trap.c` in
// `// C trap.c:t_at()`; the file an origin name is defined in, which keeps
// C files that define names normalizing apart (`muse.c`'s `mbhit` is not
// `artifact.c`'s `Mb_hit`) from matching each other's origins.
export function originCitationFile(firstComment) {
    if (!firstComment)
        return undefined;
    return /^\/\/\s*(?:C\s+)?([A-Za-z0-9_]+\.[ch]):/.exec(firstComment)?.[1];
}
const PART_OF_PREFIX = /^\/\/\s*Part of C /;
const PART_OF_FILE = /[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*\.[ch]/;
const PART_OF_NAME = /[A-Za-z_][A-Za-z0-9_]*/;
const PART_OF_WRAPPED = /^(?:[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*\.[ch]:)?[A-Za-z_][A-Za-z0-9_]*\(/;
export function partOfHeader(comments) {
    const first = comments[0];
    if (first === undefined || !PART_OF_PREFIX.test(first))
        return null;
    const entries = [];
    // Consumed [start, end) spans per comment line, blanked out at the end.
    const spans = new Map();
    const consume = (start, end) => {
        const span = spans.get(line);
        spans.set(line, span ? [span[0], end] : [start, end]);
    };
    let file = null;
    let line = 0;
    let at = first.search(/Part of C /) + 'Part of C '.length;
    consume(0, at);
    for (;;) {
        const text = comments[line];
        if (text === undefined)
            return null;
        while (text.charAt(at) === ' ')
            at++;
        const entryStart = at;
        // The optional `file.c:` prefix; a bare name inherits the file.
        const fileMatch = PART_OF_FILE.exec(text.slice(at));
        if (fileMatch && text.charAt(at + fileMatch[0].length) === ':') {
            file = fileMatch[0];
            at += fileMatch[0].length + 1;
        }
        const nameMatch = PART_OF_NAME.exec(text.slice(at));
        if (!nameMatch)
            return null;
        at += nameMatch[0].length;
        // `name()` or `name(args)`: a simple argument list only.
        const close = text.indexOf(')', at);
        if (text.charAt(at) !== '(' || close === -1 || /[(,:]/.test(text.slice(at + 1, close)))
            return null;
        at = close + 1;
        if (file === null)
            return null;
        entries.push({ file, name: nameMatch[0] });
        while (text.charAt(at) === ' ')
            at++;
        if (text.startsWith(':', at)) {
            consume(entryStart, at + 1);
            const masked = comments.map((comment, index) => {
                const span = spans.get(index);
                return span ? comment.slice(0, span[0]) + ' '.repeat(span[1] - span[0]) + comment.slice(span[1])
                    : comment;
            });
            return { entries, masked };
        }
        // A comma before the colon separates entries (`/` and `and` name
        // alternatives too); the colon must follow an entry. Spaces are
        // already skipped, so `and` is tested without its leading one.
        const wrapped = text.startsWith(',', at);
        if (wrapped)
            at++;
        else if (text.startsWith('/', at))
            at++;
        else if (text.startsWith('and ', at))
            at += 'and '.length;
        else
            return null;
        while (text.charAt(at) === ' ')
            at++;
        if (at < text.length) {
            consume(entryStart, at);
            continue;
        }
        // The list wraps onto the next comment line, but only when this one
        // ended with a comma: a line that simply stops is not a list.
        if (!wrapped)
            return null;
        const next = comments[line + 1];
        if (next === undefined)
            return null;
        const stripped = next.replace(/^\/\/\s*/, '');
        if (!PART_OF_WRAPPED.test(stripped))
            return null;
        consume(entryStart, text.length);
        line++;
        at = next.length - stripped.length;
    }
}
// `name(` or `name()` in comment text, normalized.
function citations(comments) {
    const names = new Set();
    for (const comment of comments) {
        for (const match of comment.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\(/g))
            if (match[1])
                names.add(normalizedName(match[1]));
    }
    return names;
}
function commentsIn(text) {
    return [...text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)].map(match => match[0]);
}
// The comments directly above a declaration (or its variable statement).
function leadingComments(fn) {
    const source = fn.getSourceFile();
    let anchor = fn;
    if (!ts.isFunctionDeclaration(fn) && !ts.isMethodDeclaration(fn)) {
        while (anchor.parent && !ts.isVariableStatement(anchor) && !ts.isSourceFile(anchor.parent))
            anchor = anchor.parent;
    }
    return (ts.getLeadingCommentRanges(source.text, anchor.getFullStart()) ?? [])
        .map(range => source.text.slice(range.pos, range.end));
}
export function portIndex(root) {
    const program = portProgram(root);
    const checker = program.getTypeChecker();
    const byName = new Map();
    const add = (name, fn) => {
        const key = normalizedName(name);
        byName.set(key, [...(byName.get(key) ?? []), fn]);
    };
    const collect = (node) => {
        if (ts.isFunctionDeclaration(node) && node.name && node.body)
            add(node.name.text, node);
        else if (ts.isMethodDeclaration(node) && node.body && ts.isIdentifier(node.name))
            add(node.name.text, node);
        else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
            && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
            add(node.name.text, node.initializer);
        }
        ts.forEachChild(node, collect);
    };
    for (const source of program.getSourceFiles())
        if (isPortSource(root, source))
            collect(source);
    const byCitation = new Map();
    const byOrigin = new Map();
    const byPart = new Map();
    // The `Part of C` header when the comment block opens with one: its
    // names attribute the function to C functions and, being its origin,
    // stop counting as its citations.
    const headers = new Map();
    const headerOf = (fn, comments) => {
        const known = headers.get(fn);
        if (known !== undefined)
            return known;
        const header = partOfHeader(comments);
        headers.set(fn, header);
        return header;
    };
    for (const fns of byName.values()) {
        for (const fn of fns) {
            const comments = leadingComments(fn);
            const header = headerOf(fn, comments);
            for (const name of citations(header ? header.masked : comments)) {
                byCitation.set(name, [...(byCitation.get(name) ?? []), fn]);
            }
            const origin = originCitation(comments[0]);
            if (origin) {
                const key = normalizedName(origin);
                byOrigin.set(key, [...(byOrigin.get(key) ?? []), fn]);
            }
            for (const entry of header?.entries ?? []) {
                const key = normalizedName(entry.name);
                byPart.set(key, [...(byPart.get(key) ?? []), { fn, file: entry.file }]);
            }
        }
    }
    const direct = new Map();
    const asPortFunction = (declaration) => {
        if (!declaration)
            return null;
        if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration))
            return declaration.body ? declaration : null;
        if (ts.isVariableDeclaration(declaration) && declaration.initializer
            && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
            return declaration.initializer;
        }
        return null;
    };
    // A port function's own first-line origin, memoized so every call site
    // of one callee shares the record; `Part of C` headers and prose
    // mentions are not origins (originCitation reads the first line only).
    const originMemos = new Map();
    const originOf = (fn) => {
        const known = originMemos.get(fn);
        if (known !== undefined)
            return known;
        const first = leadingComments(fn)[0];
        const name = originCitation(first);
        const file = originCitationFile(first);
        const origin = name !== null && file !== undefined ? { name, file } : null;
        originMemos.set(fn, origin);
        return origin;
    };
    const directOf = (fn) => {
        const known = direct.get(fn);
        if (known)
            return known;
        const names = new Set();
        const raw = new Set();
        const callees = new Set();
        const calls = [];
        // The C origins of the resolved callees, keyed by normalized C
        // name: a port that calls a cited port under its TS name still
        // calls the C function that port counterparts.
        const origins = new Map();
        const visit = (node) => {
            if (ts.isIdentifier(node)) {
                names.add(normalizedName(node.text));
                raw.add(node.text);
            }
            else if (ts.isCallExpression(node)) {
                let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node.expression)
                    ? node.expression.name : node.expression);
                if (symbol && symbol.flags & ts.SymbolFlags.Alias)
                    symbol = checker.getAliasedSymbol(symbol);
                // The call list records self-calls too (a recursive C caller
                // passes booleans to itself, end.c container_contents); the
                // callee set keeps excluding them, so the reach depth of the
                // edges mode is unchanged.
                const resolved = new Set();
                for (const declaration of symbol?.declarations ?? []) {
                    const callee = asPortFunction(declaration);
                    if (callee)
                        resolved.add(callee);
                }
                for (const callee of resolved) {
                    calls.push({ node, callee });
                    if (callee !== fn)
                        callees.add(callee);
                    const origin = originOf(callee);
                    if (!origin)
                        continue;
                    const key = normalizedName(origin.name);
                    const reached = origins.get(key) ?? [];
                    if (!reached.includes(origin))
                        origins.set(key, [...reached, origin]);
                }
            }
            ts.forEachChild(node, visit);
        };
        // Parameters too: the port injects random functions as defaulted or
        // typed parameters (`random = rn2`, `rollDice: RollDice`).
        for (const parameter of fn.parameters)
            visit(parameter);
        if (fn.body)
            visit(fn.body);
        // The Part-of header's own names are the function's origin, not
        // callees it covers, so they are blanked out of its citations.
        const comments = leadingComments(fn);
        const header = headerOf(fn, comments);
        const cited = citations([...(header ? header.masked : comments), ...commentsIn(fn.body?.getFullText() ?? '')]);
        const entry = { names, raw, cited, callees, calls, origins };
        direct.set(fn, entry);
        return entry;
    };
    const reach = (fn) => {
        const names = new Set();
        const raw = new Set();
        const cited = new Set();
        const origins = new Map();
        const seen = new Set();
        let frontier = [fn];
        for (let depth = 0; depth <= REACH_DEPTH && frontier.length; depth++) {
            const next = [];
            for (const current of frontier) {
                if (seen.has(current))
                    continue;
                seen.add(current);
                const entry = directOf(current);
                for (const name of entry.names)
                    names.add(name);
                for (const name of entry.cited)
                    cited.add(name);
                for (const name of entry.raw)
                    raw.add(name);
                for (const [key, reached] of entry.origins)
                    origins.set(key, [...(origins.get(key) ?? []), ...reached]);
                next.push(...entry.callees);
            }
            frontier = next;
        }
        return { names, raw, cited, origins };
    };
    const locate = (fn) => {
        const source = fn.getSourceFile();
        return `${relative(root, source.fileName)}:${source.getLineAndCharacterOfPosition(fn.getStart(source)).line + 1}`;
    };
    const callsOf = (fn) => directOf(fn).calls;
    const calleesOf = (fn) => [...directOf(fn).callees];
    return { byName, byCitation, byOrigin, byPart, reach, callsOf, calleesOf, locate };
}
export function readAliases(path) {
    const aliases = new Map();
    if (!existsSync(path))
        return aliases;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line || line.startsWith('#'))
            continue;
        const [cName, portName] = line.split('\t');
        if (cName && portName)
            aliases.set(cName, [...(aliases.get(cName) ?? []), portName]);
    }
    return aliases;
}
// `caller<TAB>callee<TAB>verdict<TAB>note` rows from c-edges-justified.tsv:
// edges a reader confirmed the port covers without naming the callee
// (`inlined`), or that cannot change what the player sees (`n/a`).
function readJustified(path) {
    const justified = new Map();
    if (!existsSync(path))
        return justified;
    readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
        if (!line || line.startsWith('#'))
            return;
        const [caller, callee, verdict, note] = line.split('\t');
        if (!caller || !callee || (verdict !== 'inlined' && verdict !== 'n/a') || !note) {
            throw new Error(`${path}:${index + 1}: expected caller, callee, inlined|n/a and a note`);
        }
        justified.set(`${caller}\t${callee}`, verdict);
    });
    return justified;
}
// The port functions that counterpart a C function: the same name ignoring
// case and underscores (with the origin-citation file disambiguating C files
// that define names that normalize alike), a `Part of C` header naming it,
// the c-ts-aliases.tsv entries, or — only when no same-named port function
// exists — a leading-comment citation of the C name. A Part-of helper is a
// fragment of the C function's body, so it counterparts every C function
// its header names even when a same-named port function also exists, and
// the entry's file keeps same-normalizing C functions apart. `ownOriginOnly`
// reads only a comment block that opens with the port's own
// `C file.c:name()` citation (the owners view, where a Part-of line is not
// an origin).
export function counterpartsOf(index, aliases, caller, file, ownOriginOnly = false) {
    // Two C files can define names that normalize alike: a port function
    // whose comment block opens with muse.c's `mbhit()` is not
    // artifact.c's `Mb_hit()`.
    const portsCaller = (fn) => {
        const first = leadingComments(fn)[0];
        const origin = originCitation(first);
        const originFile = originCitationFile(first);
        return !origin || origin === caller || normalizedName(origin) !== normalizedName(caller) || originFile === file;
    };
    const ownName = (index.byName.get(normalizedName(caller)) ?? []).filter(portsCaller);
    const byName = [...new Set([...ownName,
            ...(aliases.get(caller) ?? []).flatMap(name => index.byName.get(normalizedName(name)) ?? [])])];
    const portNames = (cName) => [cName, ...(aliases.get(cName) ?? [])].map(normalizedName);
    const citationIndex = ownOriginOnly ? index.byOrigin : index.byCitation;
    const partFns = ownOriginOnly ? [] : [...new Set((index.byPart.get(normalizedName(caller)) ?? [])
            .filter(entry => entry.file === file || baseName(entry.file) === file)
            .map(entry => entry.fn))];
    // A citation counts when the C name itself has no same-named port
    // function; an alias adds counterparts but never hides a citation.
    const fns = [...new Set([...byName, ...partFns,
            ...(ownName.length ? [] : portNames(caller).flatMap(name => citationIndex.get(name) ?? []).filter(portsCaller))])];
    return { fns, mapping: byName.length ? 'name' : partFns.length ? 'part' : 'citation' };
}
export async function compareEdges(root, tree, cacheDir, definedIn, ownOriginOnly = false) {
    const graph = await cCallGraph(tree, cacheDir, definedIn);
    const index = portIndex(root);
    const aliases = readAliases(join(root, 'docs', 'ledger', 'c-ts-aliases.tsv'));
    const justified = readJustified(join(root, 'docs', 'ledger', 'c-edges-justified.tsv'));
    const portNames = (cName) => [cName, ...(aliases.get(cName) ?? [])].map(normalizedName);
    const citationIndex = ownOriginOnly ? index.byOrigin : index.byCitation;
    const rows = [];
    const unmapped = [];
    for (const [caller, callees] of [...graph.calls].sort((a, b) => a[0].localeCompare(b[0]))) {
        const file = graph.fileOf.get(caller) ?? '?';
        const counterparts = counterpartsOf(index, aliases, caller, file, ownOriginOnly);
        if (!counterparts.fns.length) {
            unmapped.push({ file, function: caller });
            continue;
        }
        const reached = new Set(), cited = new Set(), rawWords = [];
        const origins = new Map();
        for (const fn of counterparts.fns) {
            const reach = index.reach(fn);
            for (const name of reach.names)
                reached.add(name);
            for (const name of reach.cited)
                cited.add(name);
            for (const name of reach.raw)
                rawWords.push(words(name));
            for (const [key, list] of reach.origins)
                origins.set(key, [...(origins.get(key) ?? []), ...list]);
        }
        const row = { file, function: caller, mapping: counterparts.mapping,
            port: counterparts.fns.map(index.locate), present: [], cited: [], justified: [], missing: [], infrastructure: INFRASTRUCTURE_FILES.has(file) };
        for (const callee of [...callees].sort()) {
            if (HELPER_CALLEES.has(callee))
                continue;
            const names = portNames(callee);
            // A callee reached through a cited port counts when the origin
            // names it exactly (one C symbol) or names its defining C file:
            // muse.c's `mbhit` is not artifact.c's `Mb_hit`.
            const calleeFile = graph.fileOf.get(callee) ?? '?';
            const throughCitedPort = (origins.get(normalizedName(callee)) ?? [])
                .some(origin => origin.name === callee || origin.file === calleeFile);
            if (throughCitedPort || names.some(name => reached.has(name)))
                row.present.push(callee);
            else if (justified.has(`${caller}\t${callee}`))
                row.justified.push(callee);
            else if (names.some(name => cited.has(name)) || rawWords.some(portWords => wordMatch(words(callee), portWords))) {
                row.cited.push(callee);
            }
            else
                row.missing.push(callee);
        }
        rows.push(row);
    }
    return { rows, unmapped };
}
//# sourceMappingURL=gap-edges.mjs.map