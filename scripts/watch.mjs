import { spawn } from 'node:child_process';
import { watch, statSync } from 'node:fs';
import { constants } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
async function main() {
    const target = readTarget(process.argv.slice(2));
    const watchers = [];
    let requestedRevision = 0;
    let processedRevision = -1;
    let rebuilding = false;
    let stopping = false;
    let compiler = null;
    let runningTarget = null;
    async function stop(signal, code) {
        if (stopping)
            return;
        stopping = true;
        for (const watcher of watchers)
            watcher.close();
        await Promise.all([stopProcess(runningTarget, signal), stopProcess(compiler, signal)]);
        process.exitCode = code;
    }
    async function rebuild() {
        if (rebuilding || stopping)
            return;
        rebuilding = true;
        try {
            while (!stopping && requestedRevision !== processedRevision) {
                // No browser or test process may keep running stale emitted code.
                await stopProcess(runningTarget, 'SIGTERM');
                runningTarget = null;
                if (stopping)
                    break;
                const revision = requestedRevision;
                compiler = startProcess('npm', ['run', 'compile']);
                const result = await compiler.finished;
                compiler = null;
                processedRevision = revision;
                if (stopping || revision !== requestedRevision)
                    continue;
                if (result !== 0) {
                    console.error('Compilation failed; waiting for source changes.');
                    continue;
                }
                runningTarget = startProcess(target.command, target.args);
            }
        }
        finally {
            rebuilding = false;
        }
    }
    function changed() {
        requestedRevision++;
        void rebuild().catch(async (error) => {
            console.error(error);
            await stop('SIGTERM', 1);
        });
    }
    function observe(path, recursive) {
        let modified = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
        const watcher = watch(path, { recursive }, () => {
            if (!recursive) {
                // macOS can report metadata events when npm reads its manifest.
                // Those events must not restart the compilation that caused them.
                const nextModified = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
                if (nextModified === modified)
                    return;
                modified = nextModified;
            }
            changed();
        });
        watcher.on('error', (error) => {
            console.error(error);
            void stop('SIGTERM', 1);
        });
        watchers.push(watcher);
    }
    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
        // The parent shell may forward the same process-group signal again
        // while children are stopping. Keep the guarded handler installed.
        process.on(signal, () => {
            void stop(signal, signalExitCode(signal));
        });
    }
    try {
        observe(join(root, 'src'), true);
        observe(join(root, 'test', 'browser'), true);
        for (const file of ['package.json', 'tsconfig.json', 'tsconfig.build.json',
            '.oxlintrc.json', 'vite.config.ts', 'playwright.config.ts']) {
            observe(join(root, file), false);
        }
        await rebuild();
    }
    catch (error) {
        await stop('SIGTERM', 1);
        throw error;
    }
}
function readTarget(argv) {
    const [mode, ...args] = argv;
    if (mode === 'dev') {
        return { command: join(root, 'node_modules', '.bin', 'vp'), args: ['dev', ...args] };
    }
    if (mode === 'test' && args.length > 0 && args.every(isTestFile)) {
        return {
            command: process.execPath,
            args: ['--test', '--test-concurrency=1', ...args.map(path => resolve(root, path))],
        };
    }
    throw new Error('Usage: node scripts/watch.mjs dev [Vite options]\n'
        + '   or: node scripts/watch.mjs test test/example.test.js [more test files]');
}
function isTestFile(path) {
    return !path.startsWith('-') && path.endsWith('.test.js')
        && statSync(resolve(root, path), { throwIfNoEntry: false })?.isFile() === true;
}
function startProcess(command, args) {
    const child = spawn(command, args, {
        cwd: root,
        stdio: 'inherit',
        detached: process.platform !== 'win32',
    });
    const result = {
        child,
        exited: false,
        finished: new Promise(resolveResult => {
            child.once('error', (error) => {
                console.error(error);
                resolveResult(1);
            });
            child.once('close', (code, signal) => {
                result.exited = true;
                resolveResult(code ?? (signal ? signalExitCode(signal) : 1));
            });
        }),
    };
    return result;
}
async function stopProcess(running, signal) {
    if (!running || running.exited)
        return;
    signalProcess(running.child, signal);
    const forceStop = setTimeout(() => signalProcess(running.child, 'SIGKILL'), 2000);
    forceStop.unref();
    try {
        await running.finished;
    }
    finally {
        clearTimeout(forceStop);
    }
}
function signalProcess(child, signal) {
    if (child.pid === undefined)
        return;
    try {
        if (process.platform === 'win32')
            child.kill(signal);
        else
            process.kill(-child.pid, signal);
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
            return;
        throw error;
    }
}
function signalExitCode(signal) {
    return 128 + (constants.signals[signal] ?? 1);
}
void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=watch.mjs.map