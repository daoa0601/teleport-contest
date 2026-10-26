// achievements.js — Ordered, event-time achievement state.
// C refs: include/you.h enum achievements; insight.c record_achievement(),
// achieve_rank(), achieve_msg[]; do.c:goto_level() branch achievements;
// botl.c:rank_to_xlev().
//
// Achievements are history, not a projection of the current dungeon cache.
// Store their source identifiers in attainment order so disclosure remains
// correct after a level has been left, a rank has been lost, or an actor has
// disappeared.  A newly recorded achievement also appends its achieve_msg[]
// line to the chronicle (livelog_printf() -> gamelog_add()) unless the game
// is already over.
import { ACH_BGRM, ACH_MINE_PRIZE, ACH_SOKO, ACH_SOKO_PRIZE, LL_ACHIEVE, LL_DUMP, LL_MINORAC, LL_SPOILER, LL_UMONST, } from './const.js';
import { recordGameLogEvent } from './gamelog.js';
import { OBJECT_NAMES } from './object_data.js';
export const ACH_HELL = 2;
export const ACH_INVK = 5;
export const ACH_MEDU = 12;
export const ACH_MINE = 15;
export const ACH_TOWN = 16;
export const ACH_SHOP = 17;
export const ACH_NOVL = 20;
export const ACH_RNK1 = 23;
export const ACH_RNK8 = 30;
// insight.c:achieve_msg[] — one chronicle line per achievement.  The rank
// entries are empty because their text is created on the fly, and the two
// prize entries get their object name appended by recordAchievement().
const ACHIEVEMENT_LOG_TEXT = [
    '', // achievements are numbered from 1
    'acquired the Bell of Opening',
    'entered Gehennom',
    'acquired the Candelabrum of Invocation',
    'acquired the Book of the Dead',
    'performed the invocation',
    'acquired The Amulet of Yendor',
    'entered the Elemental Planes',
    'entered the Astral Plane',
    'ascended',
    "acquired the Mines' End", // + prize object name
    'acquired the Sokoban', // + prize object name
    'killed Medusa',
    'hero was always blond, no, blind', // game is over when recorded
    'hero never wore armor', // game is over when recorded
    'entered the Gnomish Mines',
    'reached Mine Town',
    'entered a shop',
    'entered a temple',
    'consulted the Oracle',
    'read a Discworld novel',
    'entered Sokoban',
    'entered the Bigroom',
    '', '', '', '', '', '', '', '', // ranks: text created on the fly
    "learned castle drawbridge's tune",
];
// insight.c achieve_msg[].llflag: how each achievement classifies for
// livelog and dumplog.  Unlisted indexes (13, 14) are never logged.
const ACHIEVEMENT_LOG_FLAGS = new Map([
    ...Array.from({ length: 9 }, (_, index) => [index + 1, LL_ACHIEVE]),
    [10, LL_ACHIEVE | LL_SPOILER],
    [11, LL_ACHIEVE | LL_SPOILER],
    [12, LL_ACHIEVE | LL_UMONST],
    [15, LL_MINORAC | LL_DUMP],
    [16, LL_ACHIEVE],
    [17, LL_MINORAC],
    [18, LL_MINORAC],
    [19, LL_ACHIEVE],
    [20, LL_MINORAC | LL_DUMP],
    [21, LL_ACHIEVE],
    [22, LL_ACHIEVE],
    [23, LL_MINORAC | LL_DUMP],
    [24, LL_MINORAC | LL_DUMP],
    [25, LL_MINORAC | LL_DUMP],
    ...Array.from({ length: 5 }, (_, index) => [index + 26, LL_ACHIEVE]),
    [31, LL_MINORAC],
]);
// insight.c:record_achievement() message selection.
function achievementLogText(achievement, state) {
    const index = Math.abs(achievement);
    if (index >= ACH_RNK1 && index <= ACH_RNK8) {
        // rank_of(rank_to_xlev(...)): the title for the rank's lowest level;
        // a negated achievement records that the hero was female.
        const title = state.urole?.title?.[index - ACH_RNK1 + 1];
        if (!title)
            return null;
        const name = (achievement < 0 && title.f) || title.m;
        return `attained the rank of ${name} (level ${state.u.ulevel})`;
    }
    if (index === ACH_SOKO_PRIZE || index === ACH_MINE_PRIZE) {
        const prizes = state.context?.achieveo;
        const otyp = index === ACH_SOKO_PRIZE
            ? prizes?.soko_prize_otyp : prizes?.mines_prize_otyp;
        const name = otyp === undefined ? null : OBJECT_NAMES[otyp];
        if (!name)
            throw new Error('A level prize needs its original object type');
        return `${ACHIEVEMENT_LOG_TEXT[index]} ${name}`;
    }
    return ACHIEVEMENT_LOG_TEXT[index] || null;
}
export function recordAchievement(state, achievement) {
    if (!state?.u || !Number.isInteger(achievement) || !achievement)
        return false;
    if (!Array.isArray(state.u.uachieved))
        state.u.uachieved = [];
    const identity = Math.abs(achievement);
    if (state.u.uachieved.some(entry => Math.abs(entry) === identity))
        return false;
    state.u.uachieved.push(achievement);
    // livelog during final disclosure is suppressed by record_achievement()
    if (!state.program_state?.gameover) {
        const text = achievementLogText(achievement, state);
        if (text)
            recordGameLogEvent(text, {
                state,
                flags: ACHIEVEMENT_LOG_FLAGS.get(identity) ?? 0,
            });
    }
    return true;
}
export function rankAchievement(rank, female = false) {
    if (!Number.isInteger(rank) || rank < 1 || rank > 8)
        return 0;
    const achievement = ACH_RNK1 + rank - 1;
    return female ? -achievement : achievement;
}
export function achievementEntries(state) {
    return Array.isArray(state?.u?.uachieved)
        ? state.u.uachieved.filter(Number.isInteger) : [];
}
// do.c:goto_level(): Gehennom is logged before the branch chain; the branch
// achievement (mines or sokoban) and the bigroom follow before the livelog
// "entered <level>" line.  Callers own the endgame, quest, and Knox cases.
export function recordDungeonEntryAchievements(state, oldDepth, newDepth, { newLevel = true } = {}) {
    const oldDungeon = state?.dungeons?.[oldDepth?.dnum ?? 0];
    const newDungeon = state?.dungeons?.[newDepth?.dnum ?? 0];
    if (!oldDungeon?.flags?.hellish && newDungeon?.flags?.hellish)
        recordAchievement(state, ACH_HELL);
    const newDungeonBranch = (oldDepth?.dnum ?? 0) !== (newDepth?.dnum ?? 0);
    if (newDungeonBranch && newDungeon?.dname === 'The Gnomish Mines') {
        recordAchievement(state, ACH_MINE);
    }
    else if (newDungeonBranch && state?.sokoban_dnum === newDepth?.dnum) {
        recordAchievement(state, ACH_SOKO);
    }
    else if (newLevel) {
        const bigroom = state.specialLevels?.get('bigrm');
        if (bigroom && bigroom.dnum === newDepth?.dnum
            && bigroom.dlevel === newDepth?.dlevel)
            recordAchievement(state, ACH_BGRM);
    }
}
//# sourceMappingURL=achievements.js.map