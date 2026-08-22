#!/usr/bin/env node

// Generate the static permonst inputs used by exper.c:experience().  The C
// projection keeps monsters.h's conditional rows and attack constants as the
// authority, while JS retains the dynamic monster level, armor, and repeated-
// kill parts of the calculation at runtime.

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
const begin = '// BEGIN GENERATED MONSTER EXPERIENCE DATA';
const end = '// END GENERATED MONSTER EXPERIENCE DATA';
const compiler = process.env.CC || 'cc';

const source = String.raw`
#include <stdio.h>
#include "config.h"
#include "weight.h"
#include "permonst.h"
#include "wintype.h"
#include "sym.h"
#include "color.h"

#define NO_ATTK { 0, 0, 0, 0 }
#define LVL(lvl, mov, ac, mr, aln) lvl, mov, ac, mr, aln
#define ATTK(at, ad, n, d) { at, ad, n, d }
#define A(a1, a2, a3, a4, a5, a6) { a1, a2, a3, a4, a5, a6 }
#define SIZ(wt, nut, snd, siz) wt, nut, snd

struct xp_projection {
    int level, move, ac, mr, alignment;
    struct attack attacks[NATTK];
    unsigned long flags2;
    int symbol;
    int weight, nutrition, sound;
};

static const struct xp_projection rows[] = {
#define MON(nam, sym, lvl, gen, atk, siz, mr1, mr2, flg1, flg2, flg3, d, col, bn) \
    { lvl, atk, flg2, sym, siz }
#include "monsters.h"
#undef MON
#undef SIZ
};

int main(void) {
    size_t i;
    putchar('[');
    for (i = 0; i < sizeof rows / sizeof rows[0]; ++i) {
        int j, attack_bonus = 0, level_multiplier = 0;
        int flat_bonus = 0, eel_wrap = 0;
        for (j = 0; j < NATTK; ++j) {
            const struct attack *a = &rows[i].attacks[j];
            if (a->aatyp > AT_BUTT) {
                attack_bonus += a->aatyp == AT_WEAP ? 5
                    : a->aatyp == AT_MAGC ? 10 : 3;
            }
            if (a->adtyp > AD_PHYS && a->adtyp < AD_BLND)
                level_multiplier += 2;
            else if (a->adtyp == AD_DRLI || a->adtyp == AD_STON
                     || a->adtyp == AD_SLIM)
                flat_bonus += 50;
            else if (a->adtyp != AD_PHYS)
                level_multiplier += 1;
            if ((int) a->damd * (int) a->damn > 23)
                level_multiplier += 1;
            if (a->adtyp == AD_WRAP && rows[i].symbol == S_EEL)
                eel_wrap = 1;
        }
        if (rows[i].flags2 & M2_NASTY) level_multiplier += 7;
        if (i) putchar(',');
        printf("[%d,%d,%d,%d,%d]", rows[i].ac, attack_bonus,
               level_multiplier, flat_bonus, eel_wrap);
    }
    puts("]");
    putchar('[');
    for (i = 0; i < sizeof rows / sizeof rows[0]; ++i) {
        if (i) putchar(',');
        printf("%d", rows[i].mr);
    }
    puts("]");
    putchar('[');
    for (i = 0; i < sizeof rows / sizeof rows[0]; ++i) {
        if (i) putchar(',');
        printf("[%d,%d]", rows[i].weight, rows[i].nutrition);
    }
    puts("]");
    putchar('[');
    for (i = 0; i < sizeof rows / sizeof rows[0]; ++i) {
        if (i) putchar(',');
        printf("%d", rows[i].sound);
    }
    puts("]");
    putchar('[');
    for (i = 0; i < sizeof rows / sizeof rows[0]; ++i) {
        int j;
        if (i) putchar(',');
        putchar('[');
        for (j = 0; j < NATTK; ++j) {
            const struct attack *a = &rows[i].attacks[j];
            if (j) putchar(',');
            printf("[%u,%u,%u,%u]", (unsigned) a->aatyp,
                   (unsigned) a->adtyp, (unsigned) a->damn,
                   (unsigned) a->damd);
        }
        putchar(']');
    }
    puts("]");
    printf("%d\n", PM_MAIL_DAEMON);
    return 0;
}
`;

const temporary = mkdtempSync(join(tmpdir(), 'teleport-monster-xp-'));
try {
    const binary = join(temporary, 'project-monster-xp');
    execFileSync(compiler, [
        '-x', 'c', '-', '-o', binary, `-I${includeDir}`,
    ], { input: source, encoding: 'utf8' });
    const [
        rowsLine, resistanceLine, bodyLine, soundLine, attacksLine,
        mailDaemonLine,
    ]
        = execFileSync(binary, [], {
        encoding: 'utf8',
    }).trim().split('\n');
    const rows = JSON.parse(rowsLine);
    const magicResistance = JSON.parse(resistanceLine);
    const body = JSON.parse(bodyLine);
    const sound = JSON.parse(soundLine);
    const attacks = JSON.parse(attacksLine);
    const mailDaemon = Number(mailDaemonLine);
    if (rows.length !== 383 || rows.some(row => row.length !== 5
        || row.some(value => !Number.isInteger(value)))) {
        throw new Error(`expected 383 configured monster XP rows, found ${rows.length}`);
    }
    if (magicResistance.length !== 383
        || magicResistance.some(value => !Number.isInteger(value))) {
        throw new Error(`expected 383 monster MR values, found ${magicResistance.length}`);
    }
    if (body.length !== 383 || body.some(row => row.length !== 2
        || row.some(value => !Number.isInteger(value)))) {
        throw new Error(`expected 383 configured monster body rows, found ${body.length}`);
    }
    if (sound.length !== 383
        || sound.some(value => !Number.isInteger(value))) {
        throw new Error(`expected 383 configured monster sound values, found ${sound.length}`);
    }
    if (attacks.length !== 383 || attacks.some(row => row.length !== 6
        || row.some(attack => attack.length !== 4
            || attack.some(value => !Number.isInteger(value))))) {
        throw new Error(`expected 383 configured monster attack rows, found ${attacks.length}`);
    }
    if (!Number.isInteger(mailDaemon)) throw new Error('invalid mail daemon index');

    const generated = [
        begin,
        `export const MONSTER_EXPERIENCE_META = ${JSON.stringify(rows)};`,
        `export const MONSTER_MAGIC_RESISTANCE = ${JSON.stringify(magicResistance)};`,
        `export const MONSTER_BODY_META = ${JSON.stringify(body)};`,
        `export const MONSTER_SOUND = ${JSON.stringify(sound)};`,
        `export const MONSTER_ATTACKS = ${JSON.stringify(attacks)};`,
        `export const PM_MAIL_DAEMON = ${mailDaemon};`,
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
