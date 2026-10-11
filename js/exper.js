// exper.js — Hero levels, monster experience, and score awards.
// C refs: exper.c pluslvl()/experience()/more_experienced(), mon.c xkilled().
import { game, requireLiveGame, requirePlayingGame, requireInitializedGame } from './gstate.js';
import { heroResistsLifeDrain } from './monster_resistance.js';
import { finishHeroDeath } from './end.js';
import { monsterHitPointsPerLevel } from './monster_hit_points.js';
import { returnHeroToHumanForm } from './polyself.js';
import { currentAttribute } from './attrib.js';
import { recordGameLogEvent } from './gamelog.js';
import { rnd, rn2 } from './rng.js';
import { A_CON, A_WIS, MAXULEV, Upolyd } from './const.js';
import { plineWithContinuation, see_monsters } from './display.js';
import { rankAchievement, recordAchievement, } from './achievements.js';
import { MONSTER_EXPERIENCE_META, MONSTER_LEVEL, MONSTER_MOVE, PM_MAIL_DAEMON, } from './monster_data.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty, revokeIntrinsicProperty, } from './properties.js';
import { adjustWeaponSkillSlots } from './skills.js';
const NORMAL_SPEED = 12;
const LARGEST_INT = 32767;
export function newExperienceThreshold(level) {
    if (level < 1)
        return 0;
    if (level < 10)
        return 10 * (2 ** level);
    if (level < 20)
        return 10000 * (2 ** (level - 10));
    return 10000000 * (level - 19);
}
// C exper.c:rndexp(). Large ranges are scaled to fit native rn2().
export function randomExperience({ gaining = false, state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const minimum = hero.ulevel === 1 ? 0 : newExperienceThreshold(hero.ulevel - 1);
    let range = newExperienceThreshold(hero.ulevel) - minimum;
    let factor = 1;
    while (range >= LARGEST_INT) {
        range = Math.trunc(range / 2);
        factor *= 2;
    }
    let result = minimum + factor * rn2(range);
    if (hero.ulevel === MAXULEV && gaining)
        result = Math.max(hero.uexp, result + hero.uexp - minimum);
    return result;
}
// C exper.c:more_experienced(). Experience and score are separate awards.
export function addExperience(experience, scoreBonus = 0, state = game) {
    requirePlayingGame(state);
    state.u.uexp = (state.u.uexp || 0) + experience;
    state.u.urexp = (state.u.urexp || 0) + 4 * experience + scoreBonus;
    if (state.u.urexp >= (state.urole.key === 'wizard' ? 1000 : 2000))
        state.flags.beginner = false;
}
// C exper.c:newexplevel(). One award can raise the hero by at most one level.
export async function checkExperienceLevel({ publish = plineWithContinuation } = {}) {
    const hero = requireInitializedGame().u;
    if (hero.ulevel < MAXULEV && hero.uexp >= newExperienceThreshold(hero.ulevel))
        await gainExperienceLevel({ incremental: true, publish });
}
export function experienceRankIndex(level) {
    return level <= 2 ? 0 : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
}
function constitutionHpBonus(constitution) {
    if (constitution <= 3)
        return -2;
    if (constitution <= 6)
        return -1;
    if (constitution <= 14)
        return 0;
    if (constitution <= 16)
        return 1;
    if (constitution === 17)
        return 2;
    if (constitution === 18)
        return 3;
    return 4;
}
function levelHpIncrease(state) {
    const u = state.u;
    const role = state.urole.hpadv;
    const race = state.urace.hpadv;
    const lower = u.ulevel < state.urole.xlev;
    const fixed = lower ? 'lofix' : 'hifix';
    const random = lower ? 'lornd' : 'hirnd';
    let hp = (role[fixed] || 0) + (race[fixed] || 0);
    if ((role[random] || 0) > 0)
        hp += rnd(role[random]);
    if ((race[random] || 0) > 0)
        hp += rnd(race[random]);
    const constitution = currentAttribute(A_CON);
    return Math.max(1, hp + constitutionHpBonus(constitution));
}
function energyModifier(energy, role) {
    if (['priest', 'wizard'].includes(role))
        return 2 * energy;
    if (['healer', 'knight'].includes(role))
        return Math.trunc((3 * energy) / 2);
    if (['barbarian', 'valkyrie'].includes(role))
        return Math.trunc((3 * energy) / 4);
    return energy;
}
function levelEnergyIncrease(state) {
    const u = state.u;
    const role = state.urole.enadv;
    const race = state.urace.enadv;
    const lower = u.ulevel < state.urole.xlev;
    const fixed = lower ? 'lofix' : 'hifix';
    const random = lower ? 'lornd' : 'hirnd';
    const range = Math.trunc(currentAttribute(A_WIS) / 2)
        + (role[random] || 0) + (race[random] || 0);
    return Math.max(1, energyModifier(rn2(range) + (role[fixed] || 0) + (race[fixed] || 0), state.urole.key));
}
// C exper.c:pluslvl(). Messages can suspend the whole level transition.
export async function gainExperienceLevel({ incremental = false, state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    if (!incremental)
        await publish('You feel more experienced.');
    if (Upolyd(hero)) {
        const formGain = monsterHitPointsPerLevel({ mnum: hero.umonnum, m_lev: 0 });
        hero.mh = Math.min(hero.mhmax, hero.mh + formGain);
    }
    const oldLevel = hero.ulevel;
    let hp = levelHpIncrease(state);
    if (oldLevel < MAXULEV) {
        hero.uhpinc ||= Array(MAXULEV).fill(0);
        hero.uhpinc[oldLevel] = hp;
    }
    else {
        hp = Math.min(hp, Math.max(5 - Math.trunc(hero.uhpmax / 300), 1));
    }
    hero.uhpmax += hp;
    hero.uhp = Math.min(hero.uhpmax, hero.uhp + hp);
    hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
    let energy = levelEnergyIncrease(state);
    if (oldLevel < MAXULEV) {
        hero.ueninc ||= Array(MAXULEV).fill(0);
        hero.ueninc[oldLevel] = energy;
    }
    else {
        energy = Math.min(energy, Math.max(4 - Math.trunc(hero.uenmax / 200), 1));
    }
    hero.uenmax += energy;
    hero.uenpeak = Math.max(hero.uenpeak || 0, hero.uenmax);
    hero.uen += energy;
    if (oldLevel >= MAXULEV)
        return;
    if (incremental) {
        const followingThreshold = newExperienceThreshold(oldLevel + 1);
        if (hero.uexp >= followingThreshold)
            hero.uexp = followingThreshold - 1;
    }
    else {
        hero.uexp = newExperienceThreshold(oldLevel);
    }
    hero.ulevel++;
    const returning = hero.ulevel <= hero.ulevelmax;
    await publish(`Welcome ${returning ? 'back ' : ''}to experience level ${hero.ulevel}.`);
    hero.ulevelmax = Math.max(hero.ulevelmax, hero.ulevel);
    await adjustLevelAbilities(oldLevel, hero.ulevel, publish);
    const newRank = experienceRankIndex(hero.ulevel);
    const newAchievement = newRank > experienceRankIndex(oldLevel)
        && recordAchievement(state, rankAchievement(newRank, !!state.flags.female));
    if (newAchievement) {
        const title = state.urole.rank;
        if (!title)
            throw new Error('Experience level advancement did not install the hero rank');
        const rankName = (state.flags.female && title.f) || title.m;
        recordGameLogEvent(`attained the rank of ${rankName} (level ${hero.ulevel})`, { state });
    }
    else {
        recordGameLogEvent(`${hero.ulevel <= hero.ulevelpeak ? 're' : ''}gained experience level ${hero.ulevel}`, { state });
    }
    hero.ulevelpeak = Math.max(hero.ulevelpeak, hero.ulevel);
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
async function adjustAbilities(abilities, origin, oldLevel, newLevel, publish) {
    for (const [level, property, gainMessage, lossMessage] of abilities) {
        let changed = false;
        if (oldLevel < level && newLevel >= level) {
            const alreadyIntrinsic = hasPermanentIntrinsicProperty(property, game);
            grantIntrinsicProperty(property, origin, game);
            changed = true;
            if (!alreadyIntrinsic && gainMessage)
                await publish(`You feel ${gainMessage}!`);
        }
        else if (oldLevel >= level && newLevel < level) {
            changed = revokeIntrinsicProperty(property, origin, game);
            if (changed && !hasPermanentIntrinsicProperty(property, game)) {
                const message = lossMessage || (gainMessage
                    ? `less ${gainMessage}` : '');
                if (message)
                    await publish(`You feel ${message}!`);
            }
        }
        if (changed && (property === 'warning' || property === 'seeInvisible'))
            await see_monsters();
    }
}
// C attrib.c:adjabil(). Level changes can grant or revoke role and race
// abilities, and each changed level adds or removes one weapon-skill slot.
export async function adjustLevelAbilities(oldLevel, newLevel, publish = plineWithContinuation) {
    const state = requireInitializedGame();
    state.urole.rank = state.urole.title[experienceRankIndex(newLevel)] || state.urole.name;
    await adjustAbilities(ROLE_LEVEL_ABILITIES[state.urole.key] || [], 'experience', oldLevel, newLevel, publish);
    await adjustAbilities(RACE_LEVEL_ABILITIES[state.urace.name] || [], 'race', oldLevel, newLevel, publish);
    await adjustWeaponSkillSlots(newLevel - oldLevel, game);
}
// C exper.c:losexp(). A null drainer loses experience without killing a
// level-one hero; named drain can end the game before HP/power loss.
export async function loseHeroExperience(drainer = null, { state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (drainer === '#levelchange')
        drainer = null;
    else if (heroResistsLifeDrain(state))
        return false;
    const hero = state.u;
    const oldLevel = hero.ulevel;
    if (oldLevel > 1 || drainer)
        await publish(`${state.urole.goodbye || 'Goodbye'} level ${oldLevel}.`);
    if (oldLevel > 1) {
        hero.ulevel--;
        await adjustLevelAbilities(oldLevel, hero.ulevel, publish);
        recordGameLogEvent(`lost experience level ${oldLevel}`, { state });
    }
    else {
        if (drainer && await die({
            killer: drainer, deathCause: `killed by ${drainer}`,
        }))
            return true;
        if (hero.ulevel > 1)
            return false;
        hero.uexp = 0;
        recordGameLogEvent('lost all experience', { state });
    }
    const level = hero.ulevel;
    const hpLoss = hero.uhpinc?.[level] || 0;
    const energyLoss = hero.ueninc?.[level] || 0;
    const oldHpMax = hero.uhpmax;
    hero.uhpmax = Math.min(oldHpMax, Math.max(level, 10, oldHpMax - hpLoss));
    hero.uhp = Math.max(1, Math.min(hero.uhpmax, hero.uhp - hpLoss));
    hero.uenmax = Math.max(0, (hero.uenmax || 0) - energyLoss);
    hero.uen = Math.max(0, Math.min(hero.uenmax, (hero.uen || 0) - energyLoss));
    if (hero.uexp > 0)
        hero.uexp = newExperienceThreshold(level) - 1;
    if (Upolyd(hero)) {
        // C's youmonst retains its zero-initialized m_lev; the hero's
        // experience level is separate, including in monster form.
        const formLoss = monsterHitPointsPerLevel({ mnum: hero.umonnum, m_lev: 0 });
        hero.mhmax -= formLoss;
        hero.mh -= formLoss;
        if (hero.mh <= 0) {
            const restored = await returnHeroToHumanForm(state, { publish, die });
            if (restored.died)
                return true;
        }
    }
    return false;
}
export function monsterExperience(monster, { killCount = 1, amphibious = false, } = {}) {
    const mnum = monster?.mnum ?? -1;
    const storedLevel = monster?.m_lev;
    const level = storedLevel !== undefined && Number.isFinite(storedLevel)
        ? storedLevel : (MONSTER_LEVEL[mnum] ?? 0);
    const [baseAc = 10, attackBonus = 0, levelMultiplier = 0, flatBonus = 0, eelWrap = 0] = MONSTER_EXPERIENCE_META[mnum] || [];
    const armorClass = monster?.mac !== undefined && Number.isFinite(monster.mac) ? monster.mac
        : monster?.ac !== undefined && Number.isFinite(monster.ac) ? monster.ac : baseAc;
    const speed = MONSTER_MOVE[mnum] ?? monster?.mmove ?? NORMAL_SPEED;
    let award = 1 + level * level;
    if (armorClass < 3)
        award += (7 - armorClass) * (armorClass < 0 ? 2 : 1);
    if (speed > NORMAL_SPEED)
        award += speed > (3 * NORMAL_SPEED / 2) ? 5 : 3;
    award += attackBonus + flatBonus + levelMultiplier * level;
    if (eelWrap && !amphibious)
        award += 1000;
    if (level > 8)
        award += 50;
    if (mnum === PM_MAIL_DAEMON)
        award = 1;
    if (monster?.mrevived || monster?.mcloned) {
        let threshold = 20;
        let band = 0;
        let remainingKills = killCount;
        while (remainingKills > threshold && award > 1) {
            award = Math.trunc((award + 1) / 2);
            remainingKills -= threshold;
            if (band++ & 1)
                threshold += 20;
        }
    }
    return award;
}
export function awardMonsterExperience(monster, { state = game, killCount = 1, amphibious = false, } = {}) {
    const award = monsterExperience(monster, { killCount, amphibious });
    addExperience(award, 0, state);
    return award;
}
//# sourceMappingURL=exper.js.map