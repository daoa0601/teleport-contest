// Hit-point rules shared by monster creation, revival, and polymorph.
// C refs: makemon.c golemhp(), newmonhp(), and monhp_per_lvl().

import {
    In_endgame, Is_airlevel, Is_earthlevel, Is_firelevel, Is_waterlevel,
} from './const.js';
import { level_difficulty } from './dungeon.js';
import { game } from './gstate.js';
import { MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { monsterDeathCount } from './monster_vitals.js';
import { d, rnd, rn2 } from './rng.js';
import type { Monster } from './monster_types.js';

export interface MonsterHitPointRandom {
    rollOne?: (sides: number) => number;
    randomBelow?: (limit: number) => number;
}

const PM_ERINYS = MONSTER_NAME.indexOf('erinys');
const PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');

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

export function golemHitPoints(mnum: number): number | null {
    if (MONSTER_SYMBOL[mnum] !== 55) return null;
    const name = MONSTER_NAME[mnum];
    return name === undefined ? null : GOLEM_HIT_POINTS.get(name) ?? null;
}

// C makemon.c:is_home_elemental(). The hero and other monsters use this rule.
export function isHomeElemental(mnum: number): boolean {
    const name = MONSTER_NAME[mnum];
    if (name === undefined) return false;
    switch (name) {
    case 'air elemental': return Is_airlevel(game.u.uz);
    case 'earth elemental': return Is_earthlevel(game.u.uz);
    case 'fire elemental': return Is_firelevel(game.u.uz);
    case 'water elemental': return Is_waterlevel(game.u.uz);
    default: return false;
    }
}

// mon.c:adj_erinys() changes the species level before any creation or drain
// calculation. Every HP branch must see that level, including fixed HP at 50.
function speciesMonsterLevel(mnum: number): number {
    const speciesLevel = MONSTER_LEVEL[mnum] ?? 0;
    return mnum === PM_ERINYS
        ? Math.min(50, speciesLevel + (game.u?.ualign?.abuse ?? 0))
        : speciesLevel;
}

// C ref: makemon.c:adj_lev(). Creation and polymorph share the live level.
export function adjustedMonsterLevel(mnum: number): number {
    const baseLevel = speciesMonsterLevel(mnum);
    if (mnum === PM_WIZARD_OF_YENDOR) {
        const deaths = monsterDeathCount(mnum);
        return Math.min(49, baseLevel + deaths);
    }
    if (baseLevel > 49) return 50;

    let adjusted = baseLevel;
    const depthDelta = level_difficulty() - baseLevel;
    if (depthDelta < 0) adjusted--;
    else adjusted += Math.trunc(depthDelta / 5);

    const heroDelta = (game.u?.ulevel ?? 1) - baseLevel;
    if (heroDelta > 0) adjusted += Math.trunc(heroDelta / 4);

    const upperLimit = Math.min(49, Math.trunc(3 * baseLevel / 2));
    return Math.min(upperLimit, Math.max(0, adjusted));
}

// C ref: makemon.c:newmonhp().
export function newMonsterHitPoints(mnum: number): { level: number; hp: number } {
    const rawLevel = speciesMonsterLevel(mnum);
    let level = adjustedMonsterLevel(mnum);
    const fixedGolemHp = golemHitPoints(mnum);
    let hp;
    let minimumBase = 0;

    if (fixedGolemHp != null) {
        hp = fixedGolemHp;
    } else if (mnum >= 311 && mnum <= 313) {
        minimumBase = 10;
        hp = d(10, 8);
    } else if (rawLevel > 49) {
        hp = 2 * (rawLevel - 6);
        level = Math.trunc(hp / 4);
    } else if (MONSTER_SYMBOL[mnum] === 30 && mnum >= 143) {
        minimumBase = level;
        hp = In_endgame(game.u?.uz) ? 8 * level : 4 * level + d(level, 4);
    } else if (!level) {
        minimumBase = 1;
        hp = rnd(4);
    } else {
        minimumBase = level;
        hp = d(level, 8);
        if (isHomeElemental(mnum)) hp *= 3;
    }
    if (minimumBase && hp === minimumBase) hp++;
    return { level, hp };
}

export function monsterHitPointsPerLevel(monster: Pick<Monster, 'mnum' | 'm_lev'>, {
    rollOne = rnd,
    randomBelow = rn2,
}: MonsterHitPointRandom = {}): number {
    const mnum = monster.mnum;
    const speciesLevel = speciesMonsterLevel(mnum);
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
