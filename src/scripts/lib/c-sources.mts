// c-sources.mts — the pinned NetHack C sources as clang sees them.
//
// Static analyses read C facts from clang's own JSON AST, never from regular
// expressions over the source text, so macros, `#if` branches and string
// concatenation are resolved exactly as the recorder build resolves them.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { isAbsolute } from 'node:path';

// Files that are mostly error handling, options parsing, file I/O or
// debugging output. Kept equal to state-oracle.mts's INFRASTRUCTURE set,
// which moves here at the next approved measurement-hash change.
export const INFRASTRUCTURE_FILES: ReadonlySet<string> = new Set(['alloc.c', 'cfgfiles.c', 'coloratt.c', 'date.c',
    'dlb.c', 'files.c', 'glyphs.c', 'hacklib.c', 'mdlib.c', 'nhlobj.c', 'nhlsel.c', 'nhlua.c', 'nhmd4.c', 'options.c',
    'report.c', 'restore.c', 'rnd.c', 'save.c', 'selvar.c', 'sfbase.c', 'sfstruct.c', 'strutil.c', 'symbols.c',
    'sys.c', 'utf8map.c', 'version.c', 'windows.c']);

// The tty window port is part of what the game draws.
const TTY_FILES = ['wintty.c', 'topl.c', 'getline.c'];

export interface CSourceTree {
    dir: string;
    // Paths relative to `dir`, e.g. `src/uhitm.c`.
    files: string[];
    clangArgs: string[];
}

// The patched recorder tree when it has been built, else the pinned
// upstream submodule. `$NETHACK_SOURCE` overrides both.
export function resolveCSourceTree(root: string, cacheDir: string): CSourceTree {
    const override = process.env['NETHACK_SOURCE'];
    const candidates = override ? [isAbsolute(override) ? override : join(root, override)]
        : [join(root, 'nethack-c', 'recorder'), join(root, 'nethack-c', 'upstream')];
    const dir = candidates.find(candidate => existsSync(join(candidate, 'src', 'allmain.c')));
    if (!dir) {
        throw new Error('No NetHack C sources; run `git submodule update --init nethack-c/upstream` '
            + 'or set NETHACK_SOURCE');
    }
    const includes = [join(dir, 'include')];
    if (!existsSync(join(dir, 'include', 'nhlua.h'))) {
        // Upstream generates nhlua.h during the build; supply the same text.
        const lua = [join(dir, 'submodules', 'lua'), ...luaSourceDirs(dir)]
            .find(candidate => existsSync(join(candidate, 'lua.h')));
        if (!lua) {
            throw new Error(`No Lua headers under ${dir}; run `
                + '`git -C nethack-c/upstream submodule update --init submodules/lua`');
        }
        const shim = join(cacheDir, 'include');
        mkdirSync(shim, { recursive: true });
        writeFileSync(join(shim, 'nhlua.h'), '#include "lua.h"\n'
            + 'LUA_API int   (lua_error) (lua_State *L) NORETURN;\n'
            + '#include "lualib.h"\n#include "lauxlib.h"\n');
        includes.push(shim, lua);
    }
    const files = [
        ...readdirSync(join(dir, 'src')).filter(name => name.endsWith('.c')).sort().map(name => `src/${name}`),
        ...TTY_FILES.filter(name => existsSync(join(dir, 'win', 'tty', name))).map(name => `win/tty/${name}`),
    ];
    // Flags mirror verification/equivalence/cfront.py and the recorder build.
    const clangArgs = ['-fsyntax-only', '-w', ...includes.map(path => `-I${path}`),
        '-DNOTPARMDECL', '-DNO_TIMED_DELAY'];
    return { dir, files, clangArgs };
}

function luaSourceDirs(dir: string): string[] {
    const lib = join(dir, 'lib');
    if (!existsSync(lib)) return [];
    return readdirSync(lib).filter(name => name.startsWith('lua')).map(name => join(lib, name, 'src'));
}

export function baseName(file: string): string {
    return file.slice(file.lastIndexOf('/') + 1);
}

// Streams the translation unit's top-level declarations one at a time, so a
// 100 MB dump never has to be held as one parsed object. clang writes a
// location's "file" only when it changes, in emission order; `onDecl`
// receives the file current at each declaration's start.
export async function forEachTopLevelDecl(tree: CSourceTree, file: string,
    onDecl: (decl: Record<string, unknown>, tracker: FileTracker) => void): Promise<void> {
    const child = spawn('clang', [...tree.clangArgs, '-Xclang', '-ast-dump=json', file],
        { cwd: tree.dir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { if (stderr.length < 4000) stderr += chunk; });
    const exit = new Promise<number>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', code => resolve(code ?? 1));
    });
    const tracker = new FileTracker();
    let chunk: string[] | null = null;
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    for await (const line of lines) {
        if (chunk === null) {
            if (line === '    {') chunk = [line];
            continue;
        }
        if (line === '    }' || line === '    },') {
            chunk.push('    }');
            const parsed: unknown = JSON.parse(chunk.join('\n'));
            chunk = null;
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                onDecl(recordOf(parsed), tracker);
            }
            continue;
        }
        chunk.push(line);
    }
    const code = await exit;
    if (code !== 0) throw new Error(`clang failed on ${file} (exit ${code}): ${stderr.slice(0, 2000)}`);
}

function recordOf(value: object): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value));
}

// Follows clang's last-written location file through a walk in key order.
export class FileTracker {
    current = '';
    // Call on every object in emission order before visiting its children.
    observe(node: Record<string, unknown>): void {
        const file = node['file'];
        if (typeof file === 'string' && 'offset' in node) this.current = file;
    }
}

// Visits every object below `value` in emission (key) order, skipping the
// `includedFrom` records, which do not move clang's location state.
export function walkJson(value: unknown, tracker: FileTracker,
    enter: (node: Record<string, unknown>) => void, leave?: (node: Record<string, unknown>) => void): void {
    if (Array.isArray(value)) {
        for (const item of value) walkJson(item, tracker, enter, leave);
        return;
    }
    if (typeof value !== 'object' || value === null) return;
    const node = recordOf(value);
    tracker.observe(node);
    enter(node);
    for (const [key, child] of Object.entries(node)) {
        if (key === 'includedFrom' || typeof child !== 'object' || child === null) continue;
        walkJson(child, tracker, enter, leave);
    }
    leave?.(node);
}

// The name a CallExpr calls, when its callee is a plain function reference.
export function calleeName(call: Record<string, unknown>): string | null {
    const inner = call['inner'];
    if (!Array.isArray(inner)) return null;
    let callee: unknown = inner[0];
    while (typeof callee === 'object' && callee !== null && !Array.isArray(callee)) {
        const node = recordOf(callee);
        const kind = node['kind'];
        if (kind === 'DeclRefExpr') {
            const decl = node['referencedDecl'];
            if (typeof decl !== 'object' || decl === null || Array.isArray(decl)) return null;
            const name = recordOf(decl)['name'];
            return typeof name === 'string' ? name : null;
        }
        if (kind !== 'ImplicitCastExpr' && kind !== 'ParenExpr') return null;
        const next = node['inner'];
        callee = Array.isArray(next) ? next[0] : null;
    }
    return null;
}

export function absolutePath(tree: CSourceTree, file: string): string {
    return join(tree.dir, file);
}
