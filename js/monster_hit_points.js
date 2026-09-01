// Hit-point rules shared by monster creation, revival, and polymorph.
// C refs: makemon.c golemhp(), newmonhp(), and monhp_per_lvl().

import { MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { rnd, rn2 } from './rng.js';

const GOLEM_HIT_POINTS = new Map([
    ['straw golem', 20],
    ['paper golem', 20],
    ['rope golem', 30],
    ['gold golem', 60],
    ['leather golem', 40],
    ['wood golem', 50],
    ['flesh golem', 40],
    ['clay golem', 70],
    ['stone golem', 100],
    ['glass golem', 80],
    ['iron golem', 120],
]);

export function golemHitPoints(mnum) {
    if (MONSTER_SYMBOL[mnum] !== 55) return null;
    return GOLEM_HIT_POINTS.get(MONSTER_NAME[mnum]) ?? null;
}

export function monsterHitPointsPerLevel(monster, {
    rollOne = rnd,
    randomBelow = rn2,
} = {}) {
    const mnum = monster.mnum;
    const speciesLevel = MONSTER_LEVEL[mnum] ?? 0;
    let hitPoints = rollOne(8);
    const fixedGolemHitPoints = golemHitPoints(mnum);

    if (fixedGolemHitPoints != null && speciesLevel > 0) {
        hitPoints = Math.trunc(fixedGolemHitPoints / speciesLevel);
    } else if (speciesLevel > 49) {
        hitPoints = 4 + rollOne(4);
    } else if (MONSTER_SYMBOL[mnum] === 30 && mnum >= 143) {
        hitPoints = 4 + randomBelow(5);
    } else if (!(monster.m_lev > 0)) {
        hitPoints = rollOne(4);
    }
    return hitPoints;
}
