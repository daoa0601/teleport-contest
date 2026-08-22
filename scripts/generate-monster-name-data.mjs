#!/usr/bin/env node

// Generate each configured permonst neutral name from monsters.h.  NAM uses
// its only spelling; NAMS selects the neutral spelling exactly as C's
// pmnames[NEUTRAL] path does.  Compiling the projection preserves all source
// conditionals without duplicating monster-table parsing in JavaScript.

import { execFileSync } from 'node:child_process';
import {
    mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const includeDir = join(root, 'nethack-c/upstream/include');
const target = join(root, 'js/monster_data.js');
const begin = '// BEGIN GENERATED MONSTER NAME DATA';
const end = '// END GENERATED MONSTER NAME DATA';
const compiler = process.env.CC || 'cc';

const source = String.raw`
#include <stdio.h>
#include "config.h"

#define NAM(name) name
#define NAMS(namm, namf, namn) namn

static const char *const names[] = {
#define MON(nam, sym, lvl, gen, atk, siz, mr1, mr2, flg1, flg2, flg3, d, col, bn) nam
#include "monsters.h"
#undef MON
};

static void
json_string(const char *text)
{
    const unsigned char *cursor = (const unsigned char *) text;
    putchar('"');
    while (*cursor) {
        switch (*cursor) {
        case '"': fputs("\\\"", stdout); break;
        case '\\': fputs("\\\\", stdout); break;
        case '\b': fputs("\\b", stdout); break;
        case '\f': fputs("\\f", stdout); break;
        case '\n': fputs("\\n", stdout); break;
        case '\r': fputs("\\r", stdout); break;
        case '\t': fputs("\\t", stdout); break;
        default:
            if (*cursor < 0x20)
                printf("\\u%04x", (unsigned int) *cursor);
            else
                putchar(*cursor);
            break;
        }
        ++cursor;
    }
    putchar('"');
}

int
main(void)
{
    size_t index;
    putchar('[');
    for (index = 0; index < sizeof names / sizeof names[0]; ++index) {
        if (index) putchar(',');
        json_string(names[index]);
    }
    puts("]");
    return 0;
}
`;

const temporary = mkdtempSync(join(tmpdir(), 'teleport-monster-name-'));
try {
    const binary = join(temporary, 'project-monster-names');
    execFileSync(compiler, [
        '-x', 'c', '-', '-o', binary, `-I${includeDir}`,
    ], { input: source, encoding: 'utf8' });
    const names = JSON.parse(execFileSync(binary, [], { encoding: 'utf8' }));
    if (names.length !== 383
        || names.some(name => typeof name !== 'string' || !name.length)) {
        throw new Error(`expected 383 configured monster names, found ${names.length}`);
    }

    const generated = [
        begin,
        `export const MONSTER_NAME = ${JSON.stringify(names)};`,
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
