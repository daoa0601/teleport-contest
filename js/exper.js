// exper.js — Hero levels, monster experience, and score awards.
// C refs: exper.c pluslvl()/experience()/more_experienced(), mon.c xkilled().

import { game } from './gstate.js';
import { currentAttribute } from './attrib.js';
import { recordGameLogEvent } from './gamelog.js';
import { rnd, rn2 } from './rng.js';
import { A_CON, A_WIS } from './const.js';
import { plineWithContinuation, see_monsters } from './display.js';
import {
    rankAchievement, recordAchievement,
} from './achievements.js';
import {
    MONSTER_EXPERIENCE_META, MONSTER_LEVEL, MONSTER_MOVE, PM_MAIL_DAEMON,
} from './monster_data.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty, revokeIntrinsicProperty,
} from './properties.js';
import { adjustWeaponSkillSlots } from './skills.js';

const NORMAL_SPEED = 12;

export function newExperienceThreshold(level) {
    if (level < 1) return 0;
    if (level < 10) return 10 * (2 ** level);
    if (level < 20) return 10000 * (2 ** (level - 10));
    return 10000000 * (level - 19);
}

// C exper.c:more_experienced(). Experience and score are separate awards.
export function addExperience(experience, scoreBonus = 0, state = game) {
    state.u.uexp = (state.u.uexp || 0) + experience;
    state.u.urexp = (state.u.urexp || 0) + 4 * experience + scoreBonus;
    if (state.u.urexp >= (state.urole.key === 'wizard' ? 1000 : 2000))
        state.flags.beginner = false;
}

// C exper.c:newexplevel(). One award can raise the hero by at most one level.
export async function checkExperienceLevel() {
    const hero = game.u;
    if (hero.ulevel >= 30 || (hero.uexp || 0) < newExperienceThreshold(hero.ulevel)) return;
    const oldLevel = hero.ulevel;
    const returning = (hero.ulevelmax ?? oldLevel) > oldLevel;
    gainExperienceLevel({ incremental: true });
    await plineWithContinuation(
        `Welcome ${returning ? 'back ' : ''}to experience level ${hero.ulevel}.`,
    );
    await adjustLevelAbilities(oldLevel, hero.ulevel);
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
    const constitution = currentAttribute(A_CON);
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
    const range = Math.trunc(currentAttribute(A_WIS) / 2)
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

// C attrib.c role_abil[] and race ability tables.
const ROLE_LEVEL_ABILITIES = {
    archeologist: [
        [5, 'stealth', 'stealthy', ''], [10, 'fast', 'quick', 'slow'],
    ],
    barbarian: [
        [7, 'fast', 'quick', 'slow'], [15, 'stealth', 'stealthy', ''],
    ],
    caveman: [
        [7, 'fast', 'quick', 'slow'], [15, 'warning', 'sensitive', ''],
    ],
    healer: [[15, 'warning', 'sensitive', '']],
    knight: [[7, 'fast', 'quick', 'slow']],
    monk: [
        [3, 'poisonResistance', 'healthy', ''],
        [5, 'stealth', 'stealthy', ''],
        [7, 'warning', 'sensitive', ''],
        [9, 'searching', 'perceptive', 'unaware'],
        [11, 'fireResistance', 'cool', 'warmer'],
        [13, 'coldResistance', 'warm', 'cooler'],
        [15, 'shockResistance', 'insulated', 'conductive'],
        [17, 'teleportControl', 'controlled', 'uncontrolled'],
    ],
    priest: [
        [15, 'warning', 'sensitive', ''],
        [20, 'fireResistance', 'cool', 'warmer'],
    ],
    ranger: [
        [7, 'stealth', 'stealthy', ''], [15, 'seeInvisible', '', ''],
    ],
    rogue: [[10, 'searching', 'perceptive', '']],
    samurai: [[15, 'stealth', 'stealthy', '']],
    tourist: [
        [10, 'searching', 'perceptive', ''],
        [20, 'poisonResistance', 'hardy', ''],
    ],
    valkyrie: [
        [3, 'stealth', 'stealthy', ''], [7, 'fast', 'quick', 'slow'],
    ],
    wizard: [
        [15, 'warning', 'sensitive', ''],
        [17, 'teleportControl', 'controlled', 'uncontrolled'],
    ],
};

const RACE_LEVEL_ABILITIES = {
    elf: [[4, 'sleepResistance', 'awake', 'tired']],
};

async function adjustAbilities(abilities, origin, oldLevel, newLevel) {
    for (const [level, property, gainMessage, lossMessage] of abilities) {
        let changed = false;
        if (oldLevel < level && newLevel >= level) {
            const alreadyIntrinsic = hasIntrinsicProperty(property, null, game);
            grantIntrinsicProperty(property, origin, game);
            changed = true;
            if (!alreadyIntrinsic && gainMessage)
                await plineWithContinuation(`You feel ${gainMessage}!`);
        } else if (oldLevel >= level && newLevel < level) {
            changed = revokeIntrinsicProperty(property, origin, game);
            if (changed && !hasIntrinsicProperty(property, null, game)) {
                const message = lossMessage || (gainMessage
                    ? `less ${gainMessage}` : '');
                if (message)
                    await plineWithContinuation(`You feel ${message}!`);
            }
        }
        if (changed && (property === 'warning' || property === 'seeInvisible'))
            see_monsters();
    }
}

// C attrib.c:adjabil(). Level changes can grant or revoke role and race
// abilities, and each changed level adds or removes one weapon-skill slot.
export async function adjustLevelAbilities(oldLevel, newLevel) {
    await adjustAbilities(
        ROLE_LEVEL_ABILITIES[game.urole?.key] || [],
        'experience', oldLevel, newLevel,
    );
    await adjustAbilities(
        RACE_LEVEL_ABILITIES[game.urace?.name] || [],
        'race', oldLevel, newLevel,
    );
    adjustWeaponSkillSlots(newLevel - oldLevel, game);
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
    addExperience(award, 0, state);
    return award;
}
