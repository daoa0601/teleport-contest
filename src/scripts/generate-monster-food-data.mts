#!/usr/bin/env node

// Generate the permonst conveyed-resistance table (mconveys) used by shop
// corpse pricing and eating.  The C projection keeps monsters.h's
// conditional rows as the authority: MON()'s mr2 argument is read straight
// from the configured table, in PM order.  Nutrition (cnutrit) is already
// projected as MONSTER_BODY_META column 1 and is only re-exported as a
// named view here.

import { execFileSync } from 'node:child_process';
import {
    mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const includeDir = join(root, 'nethack-c/upstream/include');
const target = join(root, 'src/js/monster_data.ts');
const begin = '// BEGIN GENERATED MONSTER FOOD DATA';
const end = '// END GENERATED MONSTER FOOD DATA';
const compiler = process.env.CC || 'cc';

const source = String.raw`
#include <stdio.h>
#include "config.h"
#include "permonst.h"
#include "wintype.h"
#include "sym.h"
#include "color.h"

struct food_projection {
    unsigned conveys; /* MON()'s mr2: resistances conveyed */
};

static const struct food_projection rows[] = {
#define MON(nam, sym, lvl, gen, atk, siz, mr1, mr2, flg1, flg2, flg3, d, \
            col, bn)                                                     \
    { mr2 }
#include "monsters.h"
#undef MON
};

int main(void) {
    size_t i;
    putchar('[');
    for (i = 0; i < sizeof rows / sizeof rows[0]; ++i) {
        if (i) putchar(',');
        printf("%u", rows[i].conveys);
    }
    puts("]");
    printf("%d\n", NUMMONS);
    return 0;
}
`;

const temporary = mkdtempSync(join(tmpdir(), 'teleport-monster-food-'));
try {
    const binary = join(temporary, 'project-monster-food');
    execFileSync(compiler, [
        '-x', 'c', '-', '-o', binary, `-I${includeDir}`,
    ], { input: source, encoding: 'utf8' });
    const [conveysLine, nummonsLine]
        = execFileSync(binary, [], { encoding: 'utf8' }).trim().split('\n');
    if (conveysLine === undefined || nummonsLine === undefined)
        throw new Error('missing convey masks or NUMMONS in C projection');
    const parsed: unknown = JSON.parse(conveysLine);
    const nummons = Number(nummonsLine);
    if (!Number.isInteger(nummons) || nummons <= 0)
        throw new Error(`invalid configured NUMMONS ${nummonsLine}`);
    if (!Array.isArray(parsed) || parsed.length !== nummons)
        throw new Error(`expected ${nummons} convey masks`);
    const conveys = parsed.map((value: unknown, index): number => {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
            throw new Error(`invalid convey mask at monster ${index}`);
        return value;
    });

    const generated = [
        begin,
        `export const MONSTER_CONVEYS: readonly number[] = ${JSON.stringify(conveys)};`,
        '// Named view for pricing/eating: nutrition is MONSTER_BODY_META',
        '// column 1 (SIZ nut, already projected); one canonical source.',
        'export const MONSTER_NUTRITION: readonly number[] = MONSTER_BODY_META.map(',
        '    row => row[1]);',
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
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
