#!/usr/bin/env node

// Generate permonst.mcolor from the configured monsters.h table.  Defining
// MON as a marker-delimited projection lets the C preprocessor resolve every
// conditional monster row and every CLR_*/HI_* alias without reconstructing
// the other twelve MON arguments in JavaScript.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const includeDir = join(root, 'nethack-c/upstream/include');
const target = join(root, 'js/monster_data.js');
const begin = '// BEGIN GENERATED MONSTER COLOR DATA';
const end = '// END GENERATED MONSTER COLOR DATA';
const compiler = process.env.CC || 'cc';

const projection = String.raw`
#define MON(nam, sym, lvl, gen, atk, siz, mr1, mr2, flg1, flg2, flg3, d, col, bn) MON_COLOR_BEGIN col MON_COLOR_END
#include "monsters.h"
`;
const preprocessed = execFileSync(compiler, [
    '-E', '-P', '-x', 'c', '-',
    '-include', 'config.h', '-include', 'color.h', `-I${includeDir}`,
], { input: projection, encoding: 'utf8' });
const colors = [...preprocessed.matchAll(
    /MON_COLOR_BEGIN\s+(-?\d+)\s+MON_COLOR_END/g,
)].map(match => Number(match[1]));

if (colors.length !== 383 || colors.some(color => !Number.isInteger(color)))
    throw new Error(`expected 383 configured monster colors, found ${colors.length}`);

const generated = [
    begin,
    `export const MONSTER_COLOR = ${JSON.stringify(colors)};`,
    end,
].join('\n');
const previous = readFileSync(target, 'utf8');
const start = previous.indexOf(begin);
const finish = previous.indexOf(end);
if (start < 0 || finish < start)
    throw new Error(`generated markers missing from ${target}`);
const updated = previous.slice(0, start)
    + generated
    + previous.slice(finish + end.length);
writeFileSync(target, updated);
