// static-gaps-partof.test.js — `Part of C` helper attribution in static-gaps.
//
// A helper whose leading comment opens with `Part of C file.c:name(): …` is
// a counterpart of that C function even when a same-named port function
// exists, so its calls count toward the C function's argument pairs and
// call edges. The ledger freezes them, and a later C-side change — the
// same regression the frozen row exists to catch — fails the check.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Scratch {
    root: string;
    run: (mode: 'edges' | 'args', option: '--write-ledger' | '--check-ledger', expectedStatus: number) => void;
    writeC: (file: string, text: string) => void;
}

// The same scratch-tree shape static-gaps-args.test.js uses: a minimal C
// tree under NETHACK_SOURCE and one port module, with the real script.
function scratch(name: string, cFiles: Record<string, string>, port: string): Scratch {
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
    for (const [file, text] of Object.entries(cFiles)) writeFileSync(join(cRoot, 'src', file), text);
    const writeC = (file: string, text: string): void => { writeFileSync(join(cRoot, 'src', file), text); };
    writeFileSync(join(dir, 'src', 'js', 'part.ts'), port);
    const ledger = join(dir, 'ledger.tsv');
    const run = (mode: 'edges' | 'args', option: '--write-ledger' | '--check-ledger', expectedStatus: number): void => {
        const result = spawnSync(process.execPath, [join(scripts, 'static-gaps.mjs'), mode, option, ledger], {
            cwd: dir,
            env: { ...process.env, NETHACK_SOURCE: cRoot },
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 64 * 1024,
        });
        assert.equal(result.status, expectedStatus,
            `${mode} ${option}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    };
    return { root: dir, run, writeC };
}

void test('the argument ledger freezes a Part-of helper boolean', () => {
    const port = `
export function callee(flag: boolean): boolean { return flag; }
export function caller(): boolean { return true; }
// Part of C caller.c:caller(): the fragment that performs the call.
export function callerCall(): boolean { return callee(true); }
`;
    // The C caller spells callee(TRUE); the same-named port `caller` holds
    // none of that call — only the Part-of helper does.
    const callerC = (flag: 'TRUE' | 'FALSE'): string => '#define TRUE ((unsigned char) 1)\n#define FALSE ((unsigned char) 0)\n'
        + 'int callee(int flag);\nstatic int caller(void) { return callee(' + flag + '); }\n';
    const world = scratch('static-gaps-partof-args-', {
        'callee.c': 'int callee(int flag) { return flag; }\n',
        'caller.c': callerC('TRUE'),
    }, port);
    try {
        // The helper's `callee(true)` is the port of the C caller's
        // `callee(TRUE)`, so the pair matches and freezes.
        world.run('args', '--write-ledger', 0);
        world.run('args', '--check-ledger', 0);

        world.writeC('caller.c', callerC('FALSE'));
        world.run('args', '--check-ledger', 1);
    } finally {
        rmSync(world.root, { recursive: true, force: true });
    }
});

void test('the edge ledger freezes a Part-of helper call', () => {
    const port = `
export function callee(): number { return 0; }
export function caller(): void {}
// Part of C caller.c:caller(): the fragment that performs the call.
export function callerCall(): void { callee(); }
`;
    const callerC = (calls: boolean): string => 'static int callee(void) { return 0; }\n'
        + 'static int caller(void) { ' + (calls ? 'return callee();' : 'return 0;') + ' }\n';
    const world = scratch('static-gaps-partof-edges-', { 'caller.c': callerC(true) }, port);
    try {
        // The C caller reaches callee only through the Part-of helper.
        world.run('edges', '--write-ledger', 0);
        world.run('edges', '--check-ledger', 0);

        world.writeC('caller.c', callerC(false));
        world.run('edges', '--check-ledger', 1);
    } finally {
        rmSync(world.root, { recursive: true, force: true });
    }
});
