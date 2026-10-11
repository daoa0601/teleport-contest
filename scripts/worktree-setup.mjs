import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
// Prepare a linked git worktree for porting work.
//
//   node scripts/worktree-setup.mjs
//
// Worktrees receive only tracked files. The holdout pool, the probe
// recorder, the state-oracle records, and node_modules are ignored, large,
// and read-only during porting, so they are linked from the main checkout.
// Each worktree still writes its own .cache/generalization runs. The corpus
// lock checks live processes machine-wide, so worktrees share its limit.
const SHARED = ['node_modules', '.cache/holdout-dev', '.cache/probe-recorder', '.cache/state-oracle'];
function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
const top = git('rev-parse', '--show-toplevel');
const main = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
if (main === top) {
    console.log('This is the main checkout; nothing to link.');
    process.exit(0);
}
for (const path of SHARED) {
    const source = join(main, path);
    const target = join(top, path);
    if (!existsSync(source)) {
        console.log(`missing in main checkout: ${path}`);
        continue;
    }
    let present = true;
    try {
        lstatSync(target);
    }
    catch {
        present = false;
    }
    if (present) {
        console.log(`kept      ${path}`);
        continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source, target);
    console.log(`linked    ${path}`);
}
console.log(`Baselines for comparison live in ${join(main, '.cache/generalization')}.`);
//# sourceMappingURL=worktree-setup.mjs.map