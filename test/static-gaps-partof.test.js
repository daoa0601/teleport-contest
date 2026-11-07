// static-gaps-partof.test.js — `Part of C` helper attribution in static-gaps.
//
// A helper whose leading comment opens with `Part of C file.c:name(): …` is
// a counterpart of that C function even when a same-named port function
// exists, so its calls count toward the C function's edges and argument
// pairs, and the ledgers freeze them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The same scratch-tree shape static-gaps-args.test.js uses: a minimal C
// tree under NETHACK_SOURCE and one port module, with the real script.
function scratch(name, cFiles, port) {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const cache = join(root, '.cache');
    mkdirSync(cache, { recursive: true });
    const dir = mkdtempSync(join(cache, name));
    const scripts = join(dir, 'scripts');
    const cRoot = join(dir, 'native');
    mkdirSync(scripts);
    mkdirSync(join(dir, 'src', 'js'), { recursive: true });
    mkdirSync(join(cRoot, 'src'), { recursive: true });
    mkdirSync(join(cRoot, 'include'));
    copyFileSync(join(root, 'scripts', 'static-gaps.mjs'), join(scripts, 'static-gaps.mjs'));
    symlinkSync(join(root, 'scripts', 'lib'), join(scripts, 'lib'), 'dir');
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
    writeFileSync(join(cRoot, 'include', 'nhlua.h'), '');
    // allmain.c is the marker resolveCSourceTree() looks for.
    writeFileSync(join(cRoot, 'src', 'allmain.c'), 'int set_flag(int flag) { return flag; }\n');
    for (const [file, text] of Object.entries(cFiles))
        writeFileSync(join(cRoot, 'src', file), text);
    const writePort = (text) => { writeFileSync(join(dir, 'src', 'js', 'part.ts'), text); };
    writePort(port);
    const ledger = join(dir, 'ledger.tsv');
    const run = (mode, option, expectedStatus) => {
        const result = spawnSync(process.execPath, [join(scripts, 'static-gaps.mjs'), mode, option, ledger], {
            cwd: dir,
            env: { ...process.env, NETHACK_SOURCE: cRoot },
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 64 * 1024,
        });
        assert.equal(result.status, expectedStatus, `${mode} ${option}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    };
    return { root: dir, run, writePort };
}
void test('the argument ledger freezes a Part-of helper boolean', () => {
    const portWith = (flag) => `
export function callee(flag: boolean): boolean { return flag; }
export function caller(): boolean { return true; }
// Part of C caller.c:caller(): the fragment that performs the call.
export function callerCall(): boolean { return callee(${flag}); }
`;
    const world = scratch('static-gaps-partof-args-', {
        'callee.c': 'int callee(int flag) { return flag; }\n',
        'caller.c': '#define TRUE ((unsigned char) 1)\n#define FALSE ((unsigned char) 0)\n'
            + 'int callee(int flag);\nstatic int caller(void) { return callee(TRUE); }\n',
    }, portWith('true'));
    try {
        // The helper's `callee(true)` is the port of the C caller's
        // `callee(TRUE)`, so the pair matches and freezes.
        world.run('args', '--write-ledger', 0);
        world.run('args', '--check-ledger', 0);
        world.writePort(portWith('false'));
        world.run('args', '--check-ledger', 1);
    }
    finally {
        rmSync(world.root, { recursive: true, force: true });
    }
});
void test('the edge ledger freezes a Part-of helper call', () => {
    const portWith = (calls) => `
export function callee(): number { return 0; }
export function caller(): void {}
// Part of C caller.c:caller(): the fragment that performs the call.
export function callerCall(): void { ${calls ? 'callee();' : ''} }
`;
    const world = scratch('static-gaps-partof-edges-', {
        'caller.c': 'static int callee(void) { return 0; }\n'
            + 'static int caller(void) { return callee(); }\n',
    }, portWith(true));
    try {
        // The C caller reaches callee only through the Part-of helper.
        world.run('edges', '--write-ledger', 0);
        world.run('edges', '--check-ledger', 0);
        world.writePort(portWith(false));
        world.run('edges', '--check-ledger', 1);
    }
    finally {
        rmSync(world.root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=static-gaps-partof.test.js.map