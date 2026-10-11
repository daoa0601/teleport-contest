#!/usr/bin/env node
// Generate mondata.c's direct little_to_big() relation for every configured
// PM_* index. Runtime code performs the same bidirectional transitive walk as
// big_little_match(); keeping this projection direct preserves the source
// graph instead of baking one witnessed pair or a transitive closure.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const includeDir = join(root, 'nethack-c/upstream/include');
const sourcePath = join(root, 'nethack-c/upstream/src/mondata.c');
const target = join(root, 'src/js/monster_data.ts');
const begin = '// BEGIN GENERATED MONSTER GROWTH DATA';
const end = '// END GENERATED MONSTER GROWTH DATA';
const compiler = process.env.CC || 'cc';
const mondata = readFileSync(sourcePath, 'utf8');
const tableMatch = mondata.match(/static const short grownups\[\]\[2\]\s*=\s*\{([\s\S]*?)\n\};/);
const tableBody = tableMatch?.[1];
if (tableBody === undefined)
    throw new Error('could not find mondata.c grownups table');
const rawPairs = Array.from(tableBody.matchAll(/\{\s*(PM_[A-Z0-9_]+)\s*,\s*(PM_[A-Z0-9_]+)\s*\}/g), (match) => {
    const little = match[1], big = match[2];
    if (little === undefined || big === undefined)
        throw new Error(`incomplete grownups pair: ${match[0]}`);
    return [little, big];
});
if (!rawPairs.length)
    throw new Error('grownups table contains no PM_* pairs');
// mondata.c deliberately retains deferred pairs inside disabled preprocessor
// blocks. Intersect with the configured monsters.h enum so those rows cannot
// leak into the projection as undeclared or, worse, misnumbered indices.
const configuredProjection = execFileSync(compiler, [
    '-E', '-P', '-x', 'c', '-', `-I${includeDir}`,
], {
    input: '#include "config.h"\n#define MONS_ENUM\n#include "monsters.h"\n',
    encoding: 'utf8',
});
const configured = new Set(configuredProjection.match(/\bPM_[A-Z0-9_]+\b/g) || []);
const pairs = rawPairs.filter(([little, big]) => configured.has(little) && configured.has(big));
if (!pairs.length)
    throw new Error('configured grownups table is empty');
const projection = `
#include <stdio.h>
#include "config.h"

enum monster_index {
#define MONS_ENUM
#include "monsters.h"
#undef MONS_ENUM
    NUMMONS
};

int
main(void)
{
    int index;
    int growth[NUMMONS];
    for (index = 0; index < NUMMONS; ++index)
        growth[index] = index;
${pairs.map(([little, big]) => `    growth[${little}] = ${big};`).join('\n')}
    putchar('[');
    for (index = 0; index < NUMMONS; ++index) {
        if (index) putchar(',');
        printf("%d", growth[index]);
    }
    puts("]");
    return 0;
}
`;
const temporary = mkdtempSync(join(tmpdir(), 'teleport-monster-growth-'));
try {
    const binary = join(temporary, 'project-monster-growth');
    execFileSync(compiler, [
        '-x', 'c', '-', '-o', binary, `-I${includeDir}`,
    ], { input: projection, encoding: 'utf8' });
    const parsed = JSON.parse(execFileSync(binary, [], { encoding: 'utf8' }));
    if (!Array.isArray(parsed) || parsed.length !== 383)
        throw new Error('expected 383 configured monster growth targets');
    const growth = parsed.map((value, index) => {
        if (typeof value !== 'number' || !Number.isInteger(value)
            || value < 0 || value >= parsed.length)
            throw new Error(`invalid growth target at monster ${index}`);
        return value;
    });
    const generated = [
        begin,
        `export const MONSTER_GROWTH_TARGET: readonly number[] = ${JSON.stringify(growth)};`,
        end,
    ].join('\n');
    const previous = readFileSync(target, 'utf8');
    const start = previous.indexOf(begin);
    const finish = previous.indexOf(end);
    const updated = start < 0 || finish < start
        ? `${previous.trimEnd()}\n\n${generated}\n`
        : previous.slice(0, start) + generated
            + previous.slice(finish + end.length);
    writeFileSync(target, updated);
}
finally {
    rmSync(temporary, { recursive: true, force: true });
}
//# sourceMappingURL=generate-monster-growth-data.mjs.map