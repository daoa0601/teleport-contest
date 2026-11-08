// static-gaps-edges.test.js — `static-gaps.mjs edges` ledger exit status.
//
// The edges ledger freezes every C call edge the port counterpart reaches,
// including the edges reached through a cited port (a caller whose port
// calls the TS function whose first line cites `C trap.c:t_at()` keeps the
// `t_at` edge). `--check-ledger` fails when a present edge is lost. The run
// needs the pinned C sources, so it skips where no tree resolves. The test
// asserts exit status only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
// CI checks out the submodule as nethack-c/upstream; worktrees link the main
// checkout's copy through nethack-c/upstream_link; the main checkout itself
// may hold the built recorder tree.
const cRoot = ['nethack-c/upstream', 'nethack-c/upstream_link', 'nethack-c/recorder']
    .map(dir => join(root, dir))
    .find(dir => existsSync(join(dir, 'src', 'allmain.c')));
void test('the repository keeps every present C call edge', { skip: cRoot === undefined && 'no pinned C sources' }, () => {
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'static-gaps.mjs'), 'edges',
        '--check-ledger', join(root, 'docs', 'ledger', 'c-edges.tsv')], {
        cwd: root,
        env: { ...process.env, NETHACK_SOURCE: cRoot },
        encoding: 'utf8',
        timeout: 300000,
        maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `edges --check-ledger: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
});
//# sourceMappingURL=static-gaps-edges.test.js.map