// exper.js — Monster experience and score awards.
// C refs: exper.c experience()/more_experienced(), mon.c xkilled().

import { game } from './gstate.js';
import {
    MONSTER_EXPERIENCE_META, MONSTER_LEVEL, MONSTER_MOVE, PM_MAIL_DAEMON,
} from './monster_data.js';

const NORMAL_SPEED = 12;

export function newExperienceThreshold(level) {
    if (level < 1) return 0;
    if (level < 10) return 10 * (2 ** level);
    if (level < 20) return 10000 * (2 ** (level - 10));
    return 10000000 * (level - 19);
}

// C exper.c:losexp(NULL).  HP and power gains are indexed by the level at
// which they were rolled; losing that level removes the exact same values.
export function loseExperienceLevel(state = game) {
    const u = state.u;
    const oldLevel = u.ulevel ?? 1;
    if (oldLevel > 1) u.ulevel = oldLevel - 1;
    else u.uexp = 0;

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
