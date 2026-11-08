// static-gaps-owners.test.js — `static-gaps.mjs owners` write-ledger guard.
//
// `--write-ledger` must refuse to drop a module-owners row whose module
// still exists: that is a lost single owner. A reviewed loss passes
// --allow-owner-loss. The test asserts exit status only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

void test('the owners ledger refuses to write a lost single owner without --allow-owner-loss', t => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const cache = join(root, '.cache');
    mkdirSync(cache, { recursive: true });
    const scratch = mkdtempSync(join(cache, 'static-gaps-owners-ledger-'));
    t.after(() => rmSync(scratch, { recursive: true, force: true }));
    const scripts = join(scratch, 'scripts');
    const cRoot = join(scratch, 'native');
    mkdirSync(scripts);
    mkdirSync(join(scratch, 'src', 'js'), { recursive: true });
    mkdirSync(join(cRoot, 'src'), { recursive: true });
    mkdirSync(join(cRoot, 'include'));
    copyFileSync(join(root, 'scripts', 'static-gaps.mjs'), join(scripts, 'static-gaps.mjs'));
    symlinkSync(join(root, 'scripts', 'lib'), join(scripts, 'lib'), 'dir');
    symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
    writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
    writeFileSync(join(cRoot, 'include', 'nhlua.h'), '');
    writeFileSync(join(cRoot, 'src', 'allmain.c'), 'int set_flag(int flag) { return flag; }\n');
    writeFileSync(join(cRoot, 'src', 'foo.c'), 'int bar(void) { return 1; }\n');
    writeFileSync(join(cRoot, 'src', 'other.c'), 'int baz(void) { return 2; }\n');
    const port = (stray: boolean): void => {
        writeFileSync(join(scratch, 'src', 'js', 'alpha.ts'), stray
            ? 'export function bar(): number { return 1; }\n'
                + 'export function baz(): number { return 2; }\n'
            : 'export function bar(): number { return 1; }\n');
    };
    port(false);
    const ledger = join(scratch, 'module-owners.tsv');
    const run = (allowOwnerLoss: boolean, expectedStatus: number): void => {
        const args = ['owners', '--write-ledger', ledger];
        if (allowOwnerLoss) args.push('--allow-owner-loss');
        const result = spawnSync(process.execPath, [join(scripts, 'static-gaps.mjs'), ...args], {
            cwd: scratch,
            env: { ...process.env, NETHACK_SOURCE: cRoot },
            encoding: 'utf8',
            timeout: 60000,
            maxBuffer: 64 * 1024,
        });
        assert.equal(result.status, expectedStatus,
            `owners${allowOwnerLoss ? ' --allow-owner-loss' : ''}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    };
    run(false, 0);

    // alpha.ts gains other.c's baz: the row for alpha.ts would be dropped
    // while the module still exists, so the write is refused.
    port(true);
    run(false, 1);
    run(true, 0);
});
