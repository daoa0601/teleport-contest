// Change a monster's species without rebuilding the monster.
// C ref: mondata.c set_mon_data() and mon.c mondead().

import { NON_PM } from './const.js';
import {
    MONSTER_COLOR, MONSTER_MOVE, monsterClassSymbol,
} from './monster_data.js';

const WERE_SPECIES_PAIRS = [
    [15, 262], // werejackal, human werejackal
    [21, 263], // werewolf, human werewolf
    [91, 261], // wererat, human wererat
];
const HUMAN_WERE_SPECIES = new Map(WERE_SPECIES_PAIRS);
const COUNTER_WERE_SPECIES = new Map(WERE_SPECIES_PAIRS.flatMap(
    ([beast, human]) => [[beast, human], [human, beast]],
));

export function counterWereSpecies(mnum) {
    return COUNTER_WERE_SPECIES.get(mnum) ?? null;
}

export function setMonsterSpecies(monster, mnum) {
    const oldSpeed = MONSTER_MOVE[monster.mnum] ?? monster.mmove ?? 0;
    const newSpeed = MONSTER_MOVE[mnum] ?? monster.mmove ?? 0;
    if (monster.movement && newSpeed < oldSpeed && oldSpeed > 0) {
        monster.movement = Math.trunc(
            monster.movement * newSpeed / oldSpeed,
        );
    }
    monster.mnum = mnum;
    monster.mmove = newSpeed;
    monster.symbol = monsterClassSymbol(mnum);
    monster.color = MONSTER_COLOR[mnum];
    return monster;
}

export function restoreMonsterTrueSpecies(monster) {
    const storedSpecies = Number.isInteger(monster.cham) && monster.cham >= 0
        ? monster.cham : null;
    const trueSpecies = storedSpecies
        ?? HUMAN_WERE_SPECIES.get(monster.mnum);
    if (!Number.isInteger(trueSpecies) || trueSpecies < 0) return null;

    const oldSpecies = monster.mnum;
    setMonsterSpecies(monster, trueSpecies);
    if (storedSpecies !== null) monster.cham = NON_PM;
    return { oldSpecies, trueSpecies };
}
