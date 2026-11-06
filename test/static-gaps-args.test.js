// static-gaps-args.test.js — `static-gaps.mjs args` ledger exit status.
//
// The ledger freezes matching TRUE/FALSE call arguments; a later change to
// one of two same-named C callers must fail the check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
void test('the argument ledger detects a regression in one of two same-named C callers', t => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const cache = join(root, '.cache');
    mkdirSync(cache, { recursive: true });
    const scratch = mkdtempSync(join(cache, 'static-gaps-args-ledger-'));
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
    const callerSource = (flag) => `
#define TRUE ((unsigned char) 1)
#define FALSE ((unsigned char) 0)
int set_flag(int flag);
static int update_flag(void) { return set_flag(${flag}); }
`;
    writeFileSync(join(cRoot, 'src', 'first.c'), callerSource('TRUE'));
    writeFileSync(join(cRoot, 'src', 'second.c'), callerSource('TRUE'));
    writeFileSync(join(scratch, 'src', 'js', 'flags.ts'), `
export function setFlag(flag: boolean): boolean { return flag; }
export function updateFlag(): boolean { return setFlag(true); }
`);
    const ledger = join(scratch, 'c-args.tsv');
    const run = (option, expectedStatus) => {
        const result = spawnSync(process.execPath, [join(scripts, 'static-gaps.mjs'), 'args', option, ledger], {
            cwd: scratch,
            env: { ...process.env, NETHACK_SOURCE: cRoot },
            encoding: 'utf8',
            timeout: 15000,
            maxBuffer: 64 * 1024,
        });
        assert.equal(result.status, expectedStatus, `${option}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    };
    run('--write-ledger', 0);
    run('--check-ledger', 0);
    // The first file still matches; it cannot cover the second file's loss.
    writeFileSync(join(cRoot, 'src', 'second.c'), callerSource('FALSE'));
    run('--check-ledger', 1);
});
//# sourceMappingURL=static-gaps-args.test.js.map