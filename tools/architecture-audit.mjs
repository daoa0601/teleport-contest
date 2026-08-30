import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionRoot = path.join(root, 'js');
const stateSchemaPath = path.join(root, 'js', 'state_schema.js');

async function javascriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return javascriptFiles(target);
        return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
    }));
    return nested.flat().sort();
}

function relative(file) {
    return path.relative(root, file);
}

function lineNumber(text, index) {
    return text.slice(0, index).split('\n').length;
}

function findMatches(text, pattern) {
    const matches = [];
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
        matches.push({ text: match[0], line: lineNumber(text, match.index) });
    }
    return matches;
}

function addPatternFailures(failures, file, text, rule) {
    for (const match of findMatches(text, rule.pattern)) {
        failures.push(
            `${relative(file)}:${match.line}: ${rule.message}: ${match.text}`,
        );
    }
}

const forbiddenPatterns = [
    {
        pattern: /\bseed\d{3,}\b/giu,
        message: 'production code names a recorded seed',
    },
    {
        pattern: /(?:\.session\.json|\bsessions\/)/giu,
        message: 'production code refers to recorded session data',
    },
    {
        pattern: /\b(?:replayMoves|fastforward)\b/gu,
        message: 'production code contains a replay or fast-forward path',
    },
    {
        pattern: /\bthis\._moves\b/gu,
        message: 'the game owner must not retain future input',
    },
    {
        pattern: /\b(?:NethackGame|onEmptyQueue|_preNhgetchHook)\b/gu,
        message: 'production code contains a deleted runtime path',
    },
    {
        pattern: /Input queue empty/giu,
        message: 'input exhaustion must be an InputGate result',
    },
    {
        pattern: /\b(?:rng|display)[A-Za-z0-9_]*debt\b/giu,
        message: 'production code contains fixed RNG compensation',
    },
    {
        pattern: /\blua(?:Rng|RandomContext)\b/gu,
        message: 'Lua must consume CORE rather than a third RNG context',
    },
    {
        pattern: /\b(?:game|g|state)(?:\?\.|\.)moves\s*===?\s*\d+/gu,
        message: 'production code branches on an exact move number',
    },
    {
        pattern: /\bWebAssembly\b|\bnew\s+(?:Worker|SharedWorker)\s*\(|\b(?:from\s+|import\s*\(|require\s*\()\s*['"](?:node:)?(?:fs(?:\/promises)?|child_process|worker_threads|http|https|net)['"]/gu,
        message: 'browser game code depends on a forbidden runtime capability',
    },
];

const rawInputOwners = new Set([
    'js/input.js',
    'js/game_display.js',
    'js/terminal.js',
]);

const futureInputOwners = new Set(['js/jsmain.js']);

async function main() {
    const stateSchema = await import(pathToFileURL(stateSchemaPath));
    const knownPrivateFields = new Set([
        ...stateSchema.PERSISTENT_STATE_KEYS,
        ...stateSchema.TRANSIENT_STATE_KEYS,
    ].filter(name => name.startsWith('_')));
    const failures = [];

    for (const field of stateSchema.PERSISTENT_STATE_KEYS) {
        if (stateSchema.TRANSIENT_STATE_KEYS.has(field)) {
            failures.push(`js/state_schema.js: ${field} is both saved and transient`);
        }
    }

    for (const file of await javascriptFiles(productionRoot)) {
        const name = relative(file);
        const text = await readFile(file, 'utf8');

        for (const rule of forbiddenPatterns)
            addPatternFailures(failures, file, text, rule);

        if (!rawInputOwners.has(name)) {
            addPatternFailures(failures, file, text, {
                pattern: /\.readKey\s*\(/gu,
                message: 'raw input must pass through js/input.js',
            });
            addPatternFailures(failures, file, text, {
                pattern: /(?:function|const|let|var)\s+nhgetch\b/gu,
                message: 'nhgetch may only be defined by js/input.js',
            });
        }

        if (!futureInputOwners.has(name)) {
            addPatternFailures(failures, file, text, {
                pattern: /\b(?:input|options?|opts)\.moves\b/gu,
                message: 'only the contest adapter may read future input',
            });
        }

        const stateFieldPattern = /\b(?:game|g|state)(?:\?\.|\.)(_[A-Za-z0-9_]+)/gu;
        for (const match of text.matchAll(stateFieldPattern)) {
            if (!knownPrivateFields.has(match[1])) {
                failures.push(
                    `${name}:${lineNumber(text, match.index)}: ${match[1]} is missing from js/state_schema.js`,
                );
            }
        }
    }

    if (failures.length) {
        console.error('Architecture audit failed:\n');
        for (const failure of failures) console.error(`- ${failure}`);
        process.exitCode = 1;
        return;
    }

    console.log('Architecture audit passed.');
}

await main();
