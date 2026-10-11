// Species birth counts and extinction.
// C refs: makemon.c:propagate() and mbirth_limit().

import { G_EXTINCT, G_GONE, G_NOCORPSE } from './const.js';
import { game } from './gstate.js';
import { MONSTER_GENO, MONSTER_NAME } from './monster_data.js';
import type { MonsterPopulationState, MonsterVital } from './monster_types.js';

const G_NOGEN = 0x0200;
const G_UNIQ = 0x1000;
const MAXMONNO = 120;
const PM_NAZGUL = MONSTER_NAME.indexOf('Nazgul');
const PM_ERINYS = MONSTER_NAME.indexOf('erinys');
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');

// C allmain.c:newgame(): start a fresh species history before object and
// monster creation. Restore keeps its saved history and never calls this.
export function initializeMonsterVitals(state: MonsterPopulationState = game): void {
    state.mvitals = MONSTER_GENO.map(generation => ({
        mvflags: generation & G_NOCORPSE, born: 0, died: 0,
    }));
}

// Admission uses the previous count and flags. Ordinary makemon() ignores
// the result and can explicitly create extinct species; ghostly restoration
// rejects them and must not tally a rejected actor.
export function propagateMonsterSpecies(
    species: number, tally: boolean, ghostly: boolean,
    state: MonsterPopulationState = game,
): boolean {
    state.mvitals ||= [];
    const vital = state.mvitals[species] ||= { mvflags: 0, born: 0, died: 0 };
    const next = speciesAfterBirth(species, vital, tally, ghostly);
    vital.born = next.born;
    vital.mvflags = next.mvflags;
    return next.admitted;
}

function speciesAfterBirth(
    species: number, vital: MonsterVital, tally: boolean, ghostly: boolean,
): { admitted: boolean; born: number; mvflags: number } {
    const limit = monsterBirthLimit(species);
    const previousBorn = vital.born ?? 0;
    const previousFlags = vital.mvflags ?? 0;
    const admitted = previousBorn < limit && !(previousFlags & G_GONE);
    const born = tally && previousBorn < 255 && (!ghostly || admitted)
        ? previousBorn + 1 : previousBorn;
    const generation = MONSTER_GENO[species] ?? 0;
    const unique = !!(generation & G_UNIQ);
    const exhausted = born >= limit && !(generation & G_NOGEN);
    const extinct = (unique && species !== PM_HIGH_CLERIC) || exhausted;
    const mvflags = previousFlags | (extinct ? G_EXTINCT : 0);
    return { admitted, born, mvflags };
}

export function monsterBirthLimit(species: number): number {
    return species === PM_NAZGUL ? 9 : species === PM_ERINYS ? 3 : MAXMONNO;
}
