import { parse } from '@babel/parser';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Oxlint can ignore ESLint directives, but its native suppression comments
// cannot be disabled. Check parsed comments before starting the linter.
const targets = process.argv.slice(2);
const inputs = targets.length ? targets : ['src', 'vite.config.ts', 'playwright.config.ts', 'test/browser'];
for (const input of inputs) checkPath(input);

function checkPath(path: string): void {
    if (statSync(path).isDirectory()) {
        for (const entry of readdirSync(path)) checkPath(join(path, entry));
        return;
    }
    if (/\.(?:cts|tsx|js|mjs|cjs|jsx)$/.test(path)) {
        console.error(`${path}: Unsupported authored source extension; use .ts or .mts so compilation and type-safety checks cover this file.`);
        process.exitCode = 1;
        return;
    }
    if (!/\.(?:ts|mts)$/.test(path)) return;
    const source = readFileSync(path, 'utf8');
    const parsed = parse(source, {
        sourceFilename: path,
        sourceType: 'module',
        plugins: [
            ['typescript', { dts: /\.d\.(?:ts|mts)$/.test(path) }],
            'decoratorAutoAccessors',
        ],
        attachComment: false,
    });
    for (const comment of parsed.comments ?? []) {
        if (!/\boxlint-(?:disable|enable)(?:-next-line|-line)?\b/.test(comment.value)) continue;
        console.error(`${path}:${comment.loc?.start.line ?? 1}: Remove the lint suppression comment; fix the type error instead.`);
        process.exitCode = 1;
    }
    checkDefiniteAssignments(parsed.program, path);
}

function checkDefiniteAssignments(value: unknown, path: string): void {
    if (Array.isArray(value)) {
        const children: readonly unknown[] = value;
        for (const child of children) checkDefiniteAssignments(child, path);
        return;
    }
    if (!isRecord(value)) return;
    if (value.definite === true
        && (value.type === 'VariableDeclarator' || value.type === 'ClassProperty'
            || value.type === 'ClassPrivateProperty' || value.type === 'ClassAccessorProperty')) {
        const start = isRecord(value.loc) ? value.loc.start : null;
        const line = isRecord(start) && typeof start.line === 'number' ? start.line : 1;
        console.error(`${path}:${line}: Replace the definite-assignment assertion with initialization or a checked missing-value state.`);
        process.exitCode = 1;
    }
    for (const child of Object.values(value)) checkDefiniteAssignments(child, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
