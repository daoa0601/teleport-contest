// achievements.js — Ordered, event-time achievement state.
// C refs: include/you.h enum achievements; insight.c record_achievement(),
// achieve_rank().
//
// Achievements are history, not a projection of the current dungeon cache.
// Store their source identifiers in attainment order so disclosure remains
// correct after a level has been left, a rank has been lost, or an actor has
// disappeared.

export const ACH_HELL = 2;
export const ACH_MINE = 15;
export const ACH_TOWN = 16;
export const ACH_RNK1 = 23;
export const ACH_RNK8 = 30;

export function recordAchievement(state, achievement) {
    if (!state?.u || !Number.isInteger(achievement) || !achievement) return false;
    if (!Array.isArray(state.u.uachieved)) state.u.uachieved = [];
    const identity = Math.abs(achievement);
    if (state.u.uachieved.some(entry => Math.abs(entry) === identity))
        return false;
    state.u.uachieved.push(achievement);
    return true;
}

export function rankAchievement(rank, female = false) {
    if (!Number.isInteger(rank) || rank < 1 || rank > 8) return 0;
    const achievement = ACH_RNK1 + rank - 1;
    return female ? -achievement : achievement;
}

export function achievementEntries(state) {
    return Array.isArray(state?.u?.uachieved)
        ? state.u.uachieved.filter(Number.isInteger) : [];
}

export function recordDungeonEntryAchievements(state, oldDepth, newDepth) {
    const oldDungeon = state?.dungeons?.[oldDepth?.dnum ?? 0];
    const newDungeon = state?.dungeons?.[newDepth?.dnum ?? 0];
    if (!oldDungeon?.flags?.hellish && newDungeon?.flags?.hellish)
        recordAchievement(state, ACH_HELL);
    if ((oldDepth?.dnum ?? 0) !== (newDepth?.dnum ?? 0)
        && newDungeon?.dname === 'The Gnomish Mines') {
        recordAchievement(state, ACH_MINE);
    }
}
