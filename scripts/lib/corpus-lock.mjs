// corpus-lock.mts — one full corpus at a time, across corpus tools.
//
// Takes .cache/generalization/corpus.lock and refuses to start while another
// suite or corpus runner is alive. Returns the release function.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { hasErrorCode, numberValue, objectValue } from './session-types.mjs';
const WORK = join(fileURLToPath(new URL('../..', import.meta.url)), '.cache/generalization');
export function acquireCorpusLock() {
    mkdirSync(WORK, { recursive: true });
    const lock = join(WORK, 'corpus.lock');
    if (existsSync(lock)) {
        const data = JSON.parse(readFileSync(lock, 'utf8'));
        const pid = numberValue(objectValue(data, 'corpus lock').pid, 'lock pid');
        if (!Number.isInteger(pid) || pid <= 0)
            throw new Error('Invalid corpus owner pid');
        let alive = true;
        try {
            process.kill(pid, 0);
        }
        catch (e) {
            if (hasErrorCode(e, 'ESRCH'))
                alive = false;
            else
                throw e;
        }
        if (alive)
            throw new Error(`Corpus owner ${pid} is still running`);
        rmSync(lock);
    }
    const processes = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n');
    // Match the node processes themselves, not shells whose command text names them.
    const busy = processes.filter(line => {
        const [pid, ...argv] = line.trim().split(/\s+/);
        const command = argv.join(' ');
        return Number(pid) !== process.pid
            && (/^npm test\b/.test(command)
                || /^\S*node\s.*(?:--test|ps_test_runner\.mjs|triage-holdout\.mjs (?:triage|eval|public)|state-oracle\.mjs (?:record|compare))/.test(command));
    });
    if (busy.length)
        throw new Error(`Another verifier is running:\n${busy.join('\n')}`);
    writeFileSync(lock, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }), { flag: 'wx' });
    return () => rmSync(lock, { force: true });
}
// Kill a detached worker's whole process group.
export function killChild(child, signal) {
    if (child.pid === undefined)
        return;
    try {
        process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
    }
    catch (e) {
        if (!hasErrorCode(e, 'ESRCH'))
            throw e;
    }
}
//# sourceMappingURL=corpus-lock.mjs.map