import { execFileSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';

const CONTEST_PROCESS = /(?:npm test|node\s+--test|ps_test_runner\.mjs(?:\s+sessions)?|record-session\.mjs|sealed-corpus-(?:record|evaluate)\.mjs)/;

export function matchingContestProcesses({ ownPid = process.pid } = {}) {
    const output = execFileSync('ps', [
        '-axo', 'pid=,ppid=,etime=,rss=,command=',
    ], { encoding: 'utf8' });
    const rows = output.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const fields = line.split(/\s+/);
        return { pid: Number(fields[0]), ppid: Number(fields[1]), line };
    });
    const byPid = new Map(rows.map(row => [row.pid, row]));
    const ancestors = new Set([ownPid]);
    let cursor = byPid.get(ownPid)?.ppid;
    while (cursor && !ancestors.has(cursor)) {
        ancestors.add(cursor);
        cursor = byPid.get(cursor)?.ppid;
    }
    return rows.filter(row => !ancestors.has(row.pid) && CONTEST_PROCESS.test(row.line))
        .map(row => row.line);
}

export function assertNoContestProcesses() {
    const matches = matchingContestProcesses();
    if (matches.length > 0) {
        throw new Error(
            `another Contest recorder, evaluator, scorer, or test process is active (${matches.length} match${matches.length === 1 ? '' : 'es'})`,
        );
    }
}

export function assertCleanGateInputs(repoRoot) {
    const tracked = execFileSync('git', [
        'status', '--porcelain', '--untracked-files=no',
    ], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const relevantUntracked = execFileSync('git', [
        'ls-files', '--others', '--exclude-standard', '--',
        'js', 'scripts', 'frozen', 'sealed-corpus',
    ], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const count = [...tracked.split('\n'), ...relevantUntracked.split('\n')]
        .filter(Boolean).length;
    if (count > 0) {
        throw new Error(`gate inputs are not committed and clean (${count} relevant path${count === 1 ? '' : 's'})`);
    }
}

export async function acquireGateOperationLock(gateRoot, operation) {
    const lockPath = path.join(
        path.resolve(gateRoot), 'private', 'state', 'operation.lock',
    );
    let handle;
    try {
        handle = await fsp.open(lockPath, 'wx', 0o600);
    } catch (error) {
        if (error.code === 'EEXIST') {
            throw new Error('sealed gate operation lock exists; verify the prior owner before recovery');
        }
        throw error;
    }
    await handle.writeFile(JSON.stringify({ operation, pid: process.pid }));
    await handle.sync();
    let released = false;
    return async () => {
        if (released) return;
        released = true;
        await handle.close();
        await fsp.rm(lockPath, { force: true });
    };
}
