// gap-edges.mts — C call-graph edges that the port's counterpart lacks.
//
// For each C function with a port counterpart (the same name ignoring case
// and underscores, or an entry in docs/ledger/c-ts-aliases.tsv), every C function it calls
// should be reachable from the counterpart: named in its body, or in the
// body of a port function it calls, up to REACH_DEPTH calls deep (code that
// the port moved into a helper still counts). A missing edge is a place to
// audit: a check, effect or roll that C performs on that path and the port
// does not. Names alone cannot prove an edge correct; sessions, ledgers and
// proofs still do that.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { INFRASTRUCTURE_FILES, baseName } from './c-sources.mjs';
import { isPortSource, portProgram } from './port-program.mjs';
import { arrayValue, objectValue, stringValue } from './session-types.mjs';
const EXTRACTOR_VERSION = 'edges-1';
const REACH_DEPTH = 2;
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
function portIndex(root) {
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
    for (const fns of byName.values()) {
        for (const fn of fns) {
            for (const name of citations(leadingComments(fn)))
                byCitation.set(name, [...(byCitation.get(name) ?? []), fn]);
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
    const directOf = (fn) => {
        const known = direct.get(fn);
        if (known)
            return known;
        const names = new Set();
        const raw = new Set();
        const callees = new Set();
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
                for (const declaration of symbol?.declarations ?? []) {
                    const callee = asPortFunction(declaration);
                    if (callee && callee !== fn)
                        callees.add(callee);
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
        const cited = citations([...leadingComments(fn), ...commentsIn(fn.body?.getFullText() ?? '')]);
        const entry = { names, raw, cited, callees };
        direct.set(fn, entry);
        return entry;
    };
    const reach = (fn) => {
        const names = new Set();
        const raw = new Set();
        const cited = new Set();
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
                next.push(...entry.callees);
            }
            frontier = next;
        }
        return { names, raw, cited };
    };
    const locate = (fn) => {
        const source = fn.getSourceFile();
        return `${relative(root, source.fileName)}:${source.getLineAndCharacterOfPosition(fn.getStart(source)).line + 1}`;
    };
    return { byName, byCitation, reach, locate };
}
function readAliases(path) {
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
export async function compareEdges(root, tree, cacheDir, definedIn) {
    const graph = await cCallGraph(tree, cacheDir, definedIn);
    const index = portIndex(root);
    const aliases = readAliases(join(root, 'docs', 'ledger', 'c-ts-aliases.tsv'));
    const justified = readJustified(join(root, 'docs', 'ledger', 'c-edges-justified.tsv'));
    const portNames = (cName) => [cName, ...(aliases.get(cName) ?? [])].map(normalizedName);
    const rows = [];
    const unmapped = [];
    for (const [caller, callees] of [...graph.calls].sort((a, b) => a[0].localeCompare(b[0]))) {
        const file = graph.fileOf.get(caller) ?? '?';
        const byName = [...new Set(portNames(caller).flatMap(name => index.byName.get(name) ?? []))];
        const counterparts = byName.length ? byName : [...new Set(portNames(caller).flatMap(name => index.byCitation.get(name) ?? []))];
        if (!counterparts.length) {
            unmapped.push({ file, function: caller });
            continue;
        }
        const reached = new Set(), cited = new Set(), rawWords = [];
        for (const fn of counterparts) {
            const reach = index.reach(fn);
            for (const name of reach.names)
                reached.add(name);
            for (const name of reach.cited)
                cited.add(name);
            for (const name of reach.raw)
                rawWords.push(words(name));
        }
        const row = { file, function: caller, mapping: byName.length ? 'name' : 'citation',
            port: counterparts.map(index.locate), present: [], cited: [], justified: [], missing: [], infrastructure: INFRASTRUCTURE_FILES.has(file) };
        for (const callee of [...callees].sort()) {
            if (HELPER_CALLEES.has(callee))
                continue;
            const names = portNames(callee);
            if (names.some(name => reached.has(name)))
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