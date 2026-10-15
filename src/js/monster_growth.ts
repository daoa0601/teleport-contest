// Monster experience, level gains, and adult forms.
// C ref: makemon.c grow_up().

import { withIndefiniteArticle } from './object_grammar.js';
import { G_GENOD, MGIVENNAME } from './const.js';
import { canSpotMonster } from './display.js';
import { monsterName, monsterSubjectPronoun } from './monster_name.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GROWTH_TARGET, MONSTER_LEVEL,
    MONSTER_SYMBOL, monsterIsNonliving, monsterIsPlayerMonster,
    monsterTypeName,
} from './monster_data.js';
import { setMonsterSpecies } from './monster_species.js';
import { game } from './gstate.js';
import { rn2, rnd } from './rng.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

type GrowthState = GameState;
type Roll = (sides: number) => number;
interface RollLog { push(text: string): number }

interface GrowthIncrease {
    maximum: number;
    current: number;
    hpThreshold: number;
}

interface GrowthTotals {
    leveled?: boolean;
    maxIncrease?: number;
    currentIncrease?: number;
}

export type MonsterGrowth =
    | (GrowthTotals & {
        alive: boolean;
        changedSpecies: false;
        genocided?: false;
        oldType?: number;
        newType?: number;
        newFemale?: boolean;
        message?: null;
        applied?: boolean;
    })
    | (GrowthTotals & {
        alive: boolean;
        changedSpecies: true;
        genocided: boolean;
        oldType: number;
        newType: number;
        newFemale: boolean;
        message: string;
        applied?: boolean;
    });

export interface MonsterGrowthOptions {
    victim?: Monster | null;
    state?: GrowthState;
    rollOne?: Roll;
    random?: Roll;
    calls?: RollLog | null;
}

const M1_HUMANOID = 0x00020000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const S_GOLEM = 55;
const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;
const PM_AIR_ELEMENTAL = 154;
const PM_FIRE_ELEMENTAL = 155;
const PM_EARTH_ELEMENTAL = 156;
const PM_WATER_ELEMENTAL = 157;

function sameLevel(left: DungeonLocation | null | undefined, right: DungeonLocation | null | undefined): boolean {
    return !!left && !!right
        && left.dnum === right.dnum
        && left.dlevel === right.dlevel;
}

function isHomeElemental(mnum: number, state: GrowthState): boolean {
    const level = state.u?.uz;
    if (mnum === PM_AIR_ELEMENTAL)
        return sameLevel(level, state.air_level);
    if (mnum === PM_FIRE_ELEMENTAL)
        return sameLevel(level, state.fire_level);
    if (mnum === PM_EARTH_ELEMENTAL)
        return sameLevel(level, state.earth_level);
    if (mnum === PM_WATER_ELEMENTAL)
        return sameLevel(level, state.water_level);
    return false;
}

function targetSpecies(mnum: number, killedMonster: Monster | null): number {
    if (!killedMonster && mnum === PM_KILLER_BEE) return PM_QUEEN_BEE;
    return MONSTER_GROWTH_TARGET[mnum] ?? mnum;
}

function resultingGender(monster: Monster, newType: number): boolean {
    const flags = MONSTER_FLAGS2[newType] ?? 0;
    if (flags & M2_MALE) return false;
    if (flags & M2_FEMALE) return true;
    return !!monster.female;
}

function growthMessage(
    monster: Monster, newType: number, oldFemale: boolean, newFemale: boolean, state: GrowthState,
): string {
    const gender = oldFemale !== newFemale ? newFemale ? 'female ' : 'male ' : '';
    const newName = gender + monsterTypeName(newType, newFemale);
    const subject = monsterName(monster, {
        state, article: 'your', capitalized: true,
        suppressSaddle: !!MGIVENNAME(monster) || monster === state.u.usteed,
    });
    const verb = oldFemale !== newFemale
        ? 'changes into'
        : (MONSTER_FLAGS1[newType] ?? 0) & M1_HUMANOID
            ? 'becomes' : 'grows up into';
    return `${subject} ${verb} ${withIndefiniteArticle(newName)}.`;
}

function genocidedGrowthMessage(monster: Monster, newType: number, state: GrowthState): string {
    const subject = monsterName(monster, { state });
    // grow_up announces death before changing species or gender.
    const newName = monsterTypeName(newType, monster.female);
    const pronoun = monsterSubjectPronoun(monster, { state });
    const fate = monsterIsNonliving(newType) ? 'expires' : 'dies';
    return `As ${subject} grows up into ${withIndefiniteArticle(newName)}, ${pronoun} ${fate}!`;
}

function recordRoll(calls: RollLog | null, text: string): void {
    if (calls) calls.push(text);
}

function growthFromKill(monster: Monster, victim: Monster, state: GrowthState, rollOne: Roll, random: Roll, calls: RollLog | null): GrowthIncrease {
    const level = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
    let hpThreshold = level ? level * 8 : 4;
    if (level && MONSTER_SYMBOL[monster.mnum] === S_GOLEM) {
        hpThreshold = (Math.trunc((monster.mhpmax ?? 1) / 10) + 1)
            * 10 - 1;
    } else if (level && isHomeElemental(monster.mnum, state)) {
        hpThreshold *= 3;
    }

    const victimLevel = victim.m_lev ?? MONSTER_LEVEL[victim.mnum] ?? 0;
    const range = victimLevel + 1;
    let maximum = rollOne(range);
    recordRoll(calls, `rnd(${range})`);
    if ((monster.mhpmax ?? 1) + maximum > hpThreshold + 1) {
        maximum = Math.max(
            hpThreshold + 1 - (monster.mhpmax ?? 1), 0,
        );
    }
    let current = 0;
    if (maximum > 1) {
        current = random(maximum);
        recordRoll(calls, `rn2(${maximum})`);
    }
    return { maximum, current, hpThreshold };
}

function growthWithoutKill(rollOne: Roll, calls: RollLog | null): GrowthIncrease {
    const increase = rollOne(8);
    recordRoll(calls, 'rnd(8)');
    return { maximum: increase, current: increase, hpThreshold: 0 };
}

export function growMonster(
    monster: Monster | null | undefined,
    {
        victim = null,
        state = game,
        rollOne = rnd,
        random = rn2,
        calls = null,
    }: MonsterGrowthOptions = {},
): MonsterGrowth {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
        return { alive: false, changedSpecies: false };

    const oldType = monster.mnum;
    const oldFemale = !!monster.female;
    const oldLevel = monster.m_lev ?? MONSTER_LEVEL[oldType] ?? 0;
    const newType = targetSpecies(oldType, victim);
    const oldSpeciesLevel = MONSTER_LEVEL[oldType] ?? 0;
    const targetLevel = MONSTER_LEVEL[newType] ?? oldSpeciesLevel;
    const increase = victim
        ? growthFromKill(monster, victim, state, rollOne, random, calls)
        : growthWithoutKill(rollOne, calls);

    monster.mhpmax = (monster.mhpmax ?? monster.mhp ?? 1)
        + increase.maximum;
    monster.mhp = (monster.mhp ?? 1) + increase.current;
    if (monster.mhpmax <= increase.hpThreshold) {
        return {
            alive: true,
            changedSpecies: false,
            leveled: false,
            maxIncrease: increase.maximum,
            currentIncrease: increase.current,
        };
    }

    let levelLimit = victim ? Math.trunc(3 * oldSpeciesLevel / 2) : 50;
    if (oldType !== newType && targetLevel > levelLimit)
        levelLimit = targetLevel;
    if (monsterIsPlayerMonster(oldType))
        levelLimit = 30;
    else if (levelLimit < 5) levelLimit = 5;
    else if (levelLimit > 49) levelLimit = oldSpeciesLevel > 49 ? 50 : 49;

    monster.m_lev = (monster.m_lev ?? oldSpeciesLevel) + 1;
    let speciesChange: {
        genocided: boolean;
        newFemale: boolean;
        message: string;
    } | null = null;
    if (monster.m_lev >= targetLevel && newType !== oldType) {
        const newFemale = resultingGender(monster, newType);
        const genocided = !!((state.mvitals?.[newType]?.mvflags ?? 0) & G_GENOD);
        const message = !canSpotMonster(monster) ? '' : genocided
            ? genocidedGrowthMessage(monster, newType, state)
            : growthMessage(monster, newType, oldFemale, newFemale, state);
        speciesChange = { genocided, newFemale, message };
        levelLimit = monster.m_lev;
    }

    if (!speciesChange?.genocided && monster.m_lev > levelLimit) {
        monster.m_lev--;
        if (monster.mhpmax === increase.hpThreshold + 1)
            monster.mhpmax--;
    }
    monster.mhpmax = Math.min(monster.mhpmax, 400);
    monster.mhp = Math.min(monster.mhp, monster.mhpmax);

    const totals = {
        leveled: monster.m_lev > oldLevel,
        maxIncrease: increase.maximum,
        currentIncrease: increase.current,
    };
    if (!speciesChange) return {
        ...totals,
        alive: true,
        changedSpecies: false,
        genocided: false,
        oldType,
        newType: oldType,
        newFemale: oldFemale,
        message: null,
    };
    return {
        ...totals,
        ...speciesChange,
        alive: !speciesChange.genocided,
        changedSpecies: true,
        oldType,
        newType,
    };
}

export function finishMonsterGrowth(monster: Monster, growth: MonsterGrowth | null | undefined): boolean {
    if (!growth?.changedSpecies || growth.applied) return false;
    setMonsterSpecies(monster, growth.newType);
    if (monster.cham === growth.oldType) monster.cham = growth.newType;
    monster.female = growth.newFemale;
    growth.applied = true;
    return true;
}
