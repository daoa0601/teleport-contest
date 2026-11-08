// static-gaps-edges.test.js — `static-gaps.mjs edges` call-edge classification.
//
// A call through a cited port is a present edge: a caller whose port calls
// the TS function whose first line cites `C trap.c:t_at()` keeps the
// `t_at` edge, and the citing file keeps same-normalizing C names apart
// (muse.c's `mbhit` does not cover artifact.c's `Mb_hit`). Both are pinned
// through `--check-ledger` exit status on a scratch repository, the way the
// args and owners tool tests pin their guards; a lost listed edge fails the
// check, so the exit status alone is the assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
void test('edges count a call through a cited port, in the citing file only', t => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const cache = join(root, '.cache');
    mkdirSync(cache, { recursive: true });
    const scratch = mkdtempSync(join(cache, 'static-gaps-edges-ledger-'));
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
    // adj_nonconjoined_pit calls t_at; the port calls the citing trapAt.
    writeFileSync(join(cRoot, 'src', 'trap.c'), 'int t_at(void);\n'
        + 'int t_at(void) { return 1; }\n'
        + 'int adj_nonconjoined_pit(void) { return t_at(); }\n');
    // muse.c's mbhit and artifact.c's Mb_hit normalize alike; the port
    // helper cites muse.c, so hits_with_artifact's Mb_hit edge cannot ride
    // that citation.
    writeFileSync(join(cRoot, 'src', 'muse.c'), 'int mbhit(void) { return 2; }\n');
    writeFileSync(join(cRoot, 'src', 'artifact.c'), 'int Mb_hit(void);\n'
        + 'int Mb_hit(void) { return 3; }\n'
        + 'int hits_with_artifact(void) { return Mb_hit(); }\n');
    writeFileSync(join(scratch, 'src', 'js', 'port.ts'), '// C trap.c:t_at().\n'
        + 'export function trapAt(x: number): number { return x; }\n\n'
        + '// C trap.c:adj_nonconjoined_pit().\n'
        + 'export function adjNonconjoinedPit(): number { return trapAt(1); }\n\n'
        + '// C muse.c:mbhit().\n'
        + 'export function mbHitHelper(): number { return 2; }\n\n'
        + '// C artifact.c:hits_with_artifact().\n'
        + 'export function hitsWithArtifact(): number { return mbHitHelper(); }\n');
    const run = (ledgerName, rows, expectedStatus) => {
        const ledger = join(scratch, ledgerName);
        writeFileSync(ledger, `# caller\tcallee\n${rows}`);
        const result = spawnSync(process.execPath, [join(scripts, 'static-gaps.mjs'), 'edges', '--check-ledger', ledger], {
            cwd: scratch,
            env: { ...process.env, NETHACK_SOURCE: cRoot },
            encoding: 'utf8',
            timeout: 120000,
            maxBuffer: 1024 * 1024,
        });
        assert.equal(result.status, expectedStatus, `edges --check-ledger ${ledgerName}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    };
    // The edge through the citing trapAt is listed present, so the check
    // holds; before the cited-port rule it was only cited and the check
    // failed on the lost row.
    run('edges-present.tsv', 'adj_nonconjoined_pit\tt_at\n', 0);
    // The same-normalizing Mb_hit edge stays unlisted: muse.c's mbhit
    // citation must not cover artifact.c's Mb_hit, so claiming it present
    // fails the check.
    run('edges-wrong-file.tsv', 'hits_with_artifact\tMb_hit\n', 1);
});
//# sourceMappingURL=static-gaps-edges.test.js.map