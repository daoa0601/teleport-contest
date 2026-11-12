// Shared source-tree resolution for the C-derived table generators.
//
// Precedence: an explicit --source argument, then NETHACK_SOURCE (relative
// paths resolve against the repository root), then the checked-out
// nethack-c/upstream submodule, then the linked tree recorded in
// nethack-c/upstream_link. Worktrees receive no submodule contents, so the
// recorded link is what keeps `npm run generate:native` usable there.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export interface GeneratorArguments {
    readonly source?: string | undefined;
}

// Each generator accepts the same --source DIR flag; unknown arguments stay
// the generator's own business, so nothing else is parsed here.
export function parseGeneratorArguments(args: readonly string[]): GeneratorArguments {
    let source: string | undefined;
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === undefined) continue;
        if (argument === '--source') {
            const value = args[++index];
            if (value === undefined || !value.length)
                throw new Error('--source requires the C source-tree directory');
            source = value;
        } else if (argument.startsWith('--source=')) {
            source = argument.slice('--source='.length);
            if (!source.length)
                throw new Error('--source requires the C source-tree directory');
        }
    }
    if (source !== undefined && !source.trim().length)
        throw new Error('--source requires the C source-tree directory');
    return { source };
}

function absoluteDirectory(value: string): string {
    return isAbsolute(value) ? value : join(repositoryRoot, value);
}

function isSourceTree(directory: string): boolean {
    return existsSync(join(directory, 'src', 'allmain.c'));
}

function requireSourceTree(directory: string, label: string): string {
    if (!isSourceTree(directory))
        throw new Error(`${label} is not a NetHack source tree (no src/allmain.c): ${directory}`);
    return directory;
}

export function resolveGeneratorSource(requested?: string): string {
    if (requested !== undefined)
        return requireSourceTree(absoluteDirectory(requested), '--source');
    const environment = process.env['NETHACK_SOURCE'];
    if (environment !== undefined && environment.length)
        return requireSourceTree(absoluteDirectory(environment), 'NETHACK_SOURCE');
    const submodule = join(repositoryRoot, 'nethack-c', 'upstream');
    if (isSourceTree(submodule))
        return submodule;
    const link = join(repositoryRoot, 'nethack-c', 'upstream_link');
    // The recorded link is either a text file naming the tree or a symlink
    // to it; both resolve through isSourceTree.
    try {
        const linked = statSync(link).isFile() ? readFileSync(link, 'utf8').trim() : link;
        if (linked.length && isSourceTree(linked))
            return linked;
    } catch {
        // No recorded link; the error below names the ways to provide one.
    }
    throw new Error('No NetHack C sources; pass --source DIR, set NETHACK_SOURCE, or run '
        + '`git submodule update --init nethack-c/upstream`');
}

// The configured permonst row count, after the preprocessor resolves every
// conditional row. Generators use it instead of a hardcoded monster count so
// a newer source tree with more or fewer monsters regenerates cleanly.
export function configuredMonsterCount(sourceTree: string): number {
    const compiler = process.env['CC'] || 'cc';
    const preprocessed = execFileSync(compiler, [
        '-E', '-P', '-x', 'c', '-',
        '-include', 'config.h', `-I${join(sourceTree, 'include')}`,
    ], {
        input: '#define MON(nam, sym, lvl, gen, atk, siz, mr1, mr2, flg1, flg2, flg3, d, col, bn) MON_ROW\n'
            + '#include "monsters.h"\n',
        encoding: 'utf8',
    });
    const count = preprocessed.match(/MON_ROW/g)?.length ?? 0;
    if (!count) throw new Error('No configured MON() rows in monsters.h');
    return count;
}
