// exper.js — Hero levels, monster experience, and score awards.
// C refs: exper.c pluslvl()/experience()/more_experienced(), mon.c xkilled().

import { game } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { rnd, rn2 } from './rng.js';
import { A_CON, A_WIS } from './const.js';
import { plineWithContinuation } from './display.js';
import {
    rankAchievement, recordAchievement,
} from './achievements.js';
import {
    MONSTER_EXPERIENCE_META, MONSTER_LEVEL, MONSTER_MOVE, PM_MAIL_DAEMON,
} from './monster_data.js';
import { grantIntrinsicProperty } from './properties.js';

const NORMAL_SPEED = 12;

export function newExperienceThreshold(level) {
    if (level < 1) return 0;
    if (level < 10) return 10 * (2 ** level);
    if (level < 20) return 10000 * (2 ** (level - 10));
    return 10000000 * (level - 19);
}

function xlevToRank(level) {
    return level <= 2 ? 0 : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
}

function constitutionHpBonus(constitution) {
    if (constitution <= 3) return -2;
    if (constitution <= 6) return -1;
    if (constitution <= 14) return 0;
    if (constitution <= 16) return 1;
    if (constitution === 17) return 2;
    if (constitution === 18) return 3;
    return 4;
}

function levelHpIncrease() {
    const u = game.u;
    const role = game.urole?.hpadv || {};
    const race = game.urace?.hpadv || {};
    const lower = u.ulevel < (game.urole?.xlev ?? 10);
    const fixed = lower ? 'lofix' : 'hifix';
    const random = lower ? 'lornd' : 'hirnd';
    let hp = (role[fixed] || 0) + (race[fixed] || 0);
    if ((role[random] || 0) > 0) hp += rnd(role[random]);
    if ((race[random] || 0) > 0) hp += rnd(race[random]);
    const constitution = u.acurr?.a?.[A_CON] || 0;
    return Math.max(1, hp + constitutionHpBonus(constitution));
}

function energyModifier(energy) {
    if (['priest', 'wizard'].includes(game.urole?.key)) return 2 * energy;
    if (['healer', 'knight'].includes(game.urole?.key))
        return Math.trunc((3 * energy) / 2);
    if (['barbarian', 'valkyrie'].includes(game.urole?.key))
        return Math.trunc((3 * energy) / 4);
    return energy;
}

function levelEnergyIncrease() {
    const u = game.u;
    const role = game.urole?.enadv || {};
    const race = game.urace?.enadv || {};
    const lower = u.ulevel < (game.urole?.xlev ?? 10);
    const fixed = lower ? 'lofix' : 'hifix';
    const random = lower ? 'lornd' : 'hirnd';
    const range = Math.trunc((u.acurr?.a?.[A_WIS] || 0) / 2)
        + (role[random] || 0) + (race[random] || 0);
    return Math.max(1, energyModifier(
        rn2(range) + (role[fixed] || 0) + (race[fixed] || 0),
    ));
}

export function gainExperienceLevel({ incremental = false } = {}) {
    const u = game.u;
    const oldRank = xlevToRank(u.ulevel);
    const hp = levelHpIncrease();
    const energy = levelEnergyIncrease();
    if (!Array.isArray(u.uhpinc)) u.uhpinc = Array(30).fill(0);
    if (!Array.isArray(u.ueninc)) u.ueninc = Array(30).fill(0);
    // newhp() and newpw() retain each increment under the level that earned
    // it so loseExperienceLevel() can remove the same values later.
    u.uhpinc[u.ulevel] = hp;
    u.ueninc[u.ulevel] = energy;
    u.uhp += hp;
    u.uhpmax += hp;
    u.uhppeak = Math.max(u.uhppeak || 0, u.uhpmax);
    u.uen += energy;
    u.uenmax += energy;
    u.uenpeak = Math.max(u.uenpeak || 0, u.uenmax);
    if (incremental) {
        const followingThreshold = newExperienceThreshold(u.ulevel + 1);
        if (u.uexp >= followingThreshold)
            u.uexp = followingThreshold - 1;
    } else {
        u.uexp = newExperienceThreshold(u.ulevel);
    }
    u.ulevel++;
    u.ulevelmax = Math.max(u.ulevelmax || 0, u.ulevel);
    const newRank = xlevToRank(u.ulevel);
    if (newRank > oldRank) {
        recordAchievement(
            game,
            rankAchievement(newRank, !!game.flags?.female),
        );
    }
    game.urole.rank = game.urole.title?.[newRank] || game.urole.name;
}

// C attrib.c role_abil[]: adjabil() runs after the new level's welcome
// message, so callers await this separately from gainExperienceLevel().
const ROLE_LEVEL_ABILITIES = {
    archeologist: [
        [5, 'stealth', 'stealthy'], [10, 'fast', 'quick'],
    ],
    barbarian: [
        [7, 'fast', 'quick'], [15, 'stealth', 'stealthy'],
    ],
    caveman: [
        [7, 'fast', 'quick'], [15, 'warning', 'sensitive'],
    ],
    healer: [[15, 'warning', 'sensitive']],
    knight: [[7, 'fast', 'quick']],
    monk: [
        [3, 'poisonResistance', 'healthy'],
        [5, 'stealth', 'stealthy'],
        [7, 'warning', 'sensitive'],
        [9, 'searching', 'perceptive'],
        [11, 'fireResistance', 'cool'],
        [13, 'coldResistance', 'warm'],
        [15, 'shockResistance', 'insulated'],
        [17, 'teleportControl', 'controlled'],
    ],
    priest: [
        [15, 'warning', 'sensitive'], [20, 'fireResistance', 'cool'],
    ],
    ranger: [
        [7, 'stealth', 'stealthy'], [15, 'seeInvisible', ''],
    ],
    rogue: [[10, 'searching', 'perceptive']],
    samurai: [[15, 'stealth', 'stealthy']],
    tourist: [
        [10, 'searching', 'perceptive'], [20, 'poisonResistance', 'hardy'],
    ],
    valkyrie: [
        [3, 'stealth', 'stealthy'], [7, 'fast', 'quick'],
    ],
    wizard: [
        [15, 'warning', 'sensitive'],
        [17, 'teleportControl', 'controlled'],
    ],
};

export async function gainLevelAbilities(oldLevel, newLevel) {
    const abilities = ROLE_LEVEL_ABILITIES[game.urole?.key] || [];
    for (const [level, property, message] of abilities) {
        if (oldLevel >= level || newLevel < level) continue;
        const alreadyHadAbility = !!game.u[property];
        grantIntrinsicProperty(property, 'experience', game);
        if (!alreadyHadAbility && message)
            await plineWithContinuation(`You feel ${message}!`);
    }
}

// C exper.c:losexp(NULL).  HP and power gains are indexed by the level at
// which they were rolled; losing that level removes the exact same values.
export function loseExperienceLevel(state = game) {
    const u = state.u;
    const oldLevel = u.ulevel ?? 1;
    if (oldLevel > 1) {
        u.ulevel = oldLevel - 1;
        recordGameLogEvent(`lost experience level ${oldLevel}`, { state });
    } else {
        u.uexp = 0;
        recordGameLogEvent('lost all experience', { state });
    }

    const level = u.ulevel ?? 1;
    const hpLoss = Number(u.uhpinc?.[level] || 0);
    const energyLoss = Number(u.ueninc?.[level] || 0);
    const oldHpMax = u.uhpmax ?? 1;
    const minimumHpMax = Math.max(level, 10);
    u.uhpmax = Math.min(oldHpMax,
        Math.max(minimumHpMax, oldHpMax - hpLoss));
    u.uhp = Math.max(1, Math.min(u.uhpmax, (u.uhp ?? 1) - hpLoss));

    u.uenmax = Math.max(0, (u.uenmax ?? 0) - energyLoss);
    u.uen = Math.max(0, Math.min(u.uenmax, (u.uen ?? 0) - energyLoss));
    if ((u.uexp || 0) > 0)
        u.uexp = newExperienceThreshold(level) - 1;

    return { oldLevel, newLevel: level, hpLoss, energyLoss };
}

export function monsterExperience(monster, {
    killCount = 1, amphibious = false,
} = {}) {
    const mnum = monster?.mnum ?? -1;
    const level = Number.isFinite(monster?.m_lev)
        ? monster.m_lev : (MONSTER_LEVEL[mnum] ?? 0);
    const [baseAc = 10, attackBonus = 0, levelMultiplier = 0,
        flatBonus = 0, eelWrap = 0] = MONSTER_EXPERIENCE_META[mnum] || [];
    const armorClass = Number.isFinite(monster?.mac) ? monster.mac
        : Number.isFinite(monster?.ac) ? monster.ac : baseAc;
    const speed = MONSTER_MOVE[mnum] ?? monster?.mmove ?? NORMAL_SPEED;

    let award = 1 + level * level;
    if (armorClass < 3)
        award += (7 - armorClass) * (armorClass < 0 ? 2 : 1);
    if (speed > NORMAL_SPEED)
        award += speed > (3 * NORMAL_SPEED / 2) ? 5 : 3;
    award += attackBonus + flatBonus + levelMultiplier * level;
    if (eelWrap && !amphibious) award += 1000;
    if (level > 8) award += 50;
    if (mnum === PM_MAIL_DAEMON) award = 1;

    if (monster?.mrevived || monster?.mcloned) {
        let threshold = 20;
        let band = 0;
        let remainingKills = killCount;
        while (remainingKills > threshold && award > 1) {
            award = Math.trunc((award + 1) / 2);
            remainingKills -= threshold;
            if (band++ & 1) threshold += 20;
        }
    }
    return award;
}

export function awardMonsterExperience(monster, {
    state = game, killCount = 1, amphibious = false,
} = {}) {
    const award = monsterExperience(monster, { killCount, amphibious });
    state.u.uexp = (state.u.uexp || 0) + award;
    state.u.urexp = (state.u.urexp || 0) + 4 * award;
    return award;
}
