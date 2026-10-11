#!/usr/bin/env node
// Generate the static permonst inputs used by exper.c:experience().  The C
// projection keeps monsters.h's conditional rows and attack constants as the
// authority, while JS retains the dynamic monster level, armor, and repeated-
// kill parts of the calculation at runtime.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const includeDir = join(root, 'nethack-c/upstream/include');
const target = join(root, 'src/js/monster_data.ts');
const begin = '// BEGIN GENERATED MONSTER EXPERIENCE DATA';
const end = '// END GENERATED MONSTER EXPERIENCE DATA';
const compiler = process.env.CC || 'cc';
function integers(value, count, label) {
    if (!Array.isArray(value) || value.length !== count)
        throw new Error(`expected ${count} ${label} values`);
    return value.map((entry, index) => {
        if (typeof entry !== 'number' || !Number.isInteger(entry))
            throw new Error(`invalid integer in ${label} at index ${index}`);
        return entry;
    });
}
function rows(value, width, label) {
    if (!Array.isArray(value) || value.length !== 383)
        throw new Error(`expected 383 configured monster ${label} rows`);
    return value.map((row, index) => integers(row, width, `${label}[${index}]`));
}
function attackRows(value) {
    if (!Array.isArray(value) || value.length !== 383)
        throw new Error('expected 383 configured monster attack rows');
    return value.map((row, index) => {
        if (!Array.isArray(row) || row.length !== 6)
            throw new Error(`expected six attacks for monster ${index}`);
        return row.map((attack, attackIndex) => integers(attack, 4, `monster ${index}, attack ${attackIndex}`));
    });
}
function jsonLine(line, label) {
    if (line === undefined)
        throw new Error(`missing ${label} in C projection`);
    return JSON.parse(line);
}
const source = String.raw `
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
    const [rowsLine, resistanceLine, bodyLine, soundLine, attacksLine, mailDaemonLine,] = execFileSync(binary, [], {
        encoding: 'utf8',
    }).trim().split('\n');
    const experience = rows(jsonLine(rowsLine, 'XP'), 5, 'XP');
    const magicResistance = integers(jsonLine(resistanceLine, 'MR'), 383, 'MR');
    const body = rows(jsonLine(bodyLine, 'body'), 2, 'body');
    const sound = integers(jsonLine(soundLine, 'sound'), 383, 'sound');
    const attacks = attackRows(jsonLine(attacksLine, 'attacks'));
    const mailDaemon = Number(mailDaemonLine);
    if (!Number.isInteger(mailDaemon))
        throw new Error('invalid mail daemon index');
    const generated = [
        begin,
        `export const MONSTER_EXPERIENCE_META: readonly MonsterExperience[] = ${JSON.stringify(experience)};`,
        `export const MONSTER_MAGIC_RESISTANCE: readonly number[] = ${JSON.stringify(magicResistance)};`,
        `export const MONSTER_BODY_META: readonly MonsterBody[] = ${JSON.stringify(body)};`,
        `export const MONSTER_SOUND: readonly number[] = ${JSON.stringify(sound)};`,
        `export const MONSTER_ATTACKS: readonly MonsterAttacks[] = ${JSON.stringify(attacks)};`,
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
}
finally {
    rmSync(temporary, { recursive: true, force: true });
}
//# sourceMappingURL=generate-monster-experience-data.mjs.map