// achievements.js — Ordered, event-time achievement state.
// C refs: include/you.h enum achievements; insight.c record_achievement(),
// achieve_rank().
//
// Achievements are history, not a projection of the current dungeon cache.
// Store their source identifiers in attainment order so disclosure remains
// correct after a level has been left, a rank has been lost, or an actor has
// disappeared.
import { recordGameLogEvent } from './gamelog.js';
import { OBJECT_NAMES } from './object_data.js';
export const ACH_HELL = 2;
export const ACH_INVK = 5;
export const ACH_MINE = 15;
export const ACH_TOWN = 16;
export const ACH_SHOP = 17;
export const ACH_NOVL = 20;
export const ACH_RNK1 = 23;
export const ACH_RNK8 = 30;
// insight.c achieve_msg[]: the livelog text of each newly recorded
// achievement.  Blind-from-birth and nudist carry no entry, and the win
// itself only reaches #chronicle through really_done()'s own log line.
const ACHIEVEMENT_JOURNAL_TEXT = new Map([
    [1, 'acquired the Bell of Opening'],
    [2, 'entered Gehennom'],
    [3, 'acquired the Candelabrum of Invocation'],
    [4, 'acquired the Book of the Dead'],
    [5, 'performed the invocation'],
    [6, 'acquired The Amulet of Yendor'],
    [7, 'entered the Elemental Planes'],
    [8, 'entered the Astral Plane'],
    [12, 'killed Medusa'],
    [15, 'entered the Gnomish Mines'],
    [16, 'reached Mine Town'],
    [17, 'entered a shop'],
    [18, 'entered a temple'],
    [19, 'consulted the Oracle'],
    [20, 'read a Discworld novel'],
    [21, 'entered Sokoban'],
    [22, 'entered the Bigroom'],
    [31, "learned castle drawbridge's tune"],
]);
function achievementJournalText(achievement, state) {
    const identity = Math.abs(achievement);
    if (identity >= ACH_RNK1 && identity <= ACH_RNK8) {
        const rank = state.urole?.title?.[identity - ACH_RNK1 + 1];
        const title = (achievement < 0 ? rank?.f : rank?.m) || rank?.m || 'Adventurer';
        return `attained the rank of ${title} (level ${state.u.ulevel})`;
    }
    if (identity === 10 || identity === 11) {
        // The Mines' End and Sokoban prize messages append the discovered
        // item; achieveo still holds its type at recording time.
        const prizes = state.context?.achieveo;
        const type = identity === 10 ? prizes?.mines_prize_otyp : prizes?.soko_prize_otyp;
        const name = type === undefined ? null : OBJECT_NAMES[type];
        if (!name)
            return null;
        return `acquired the ${identity === 10 ? "Mines' End" : 'Sokoban'} ${name}`;
    }
    return ACHIEVEMENT_JOURNAL_TEXT.get(identity) ?? null;
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
    // record_achievement() livelogs every new entry unless the game is over,
    // when disclosure-time entries have nowhere left to be logged.
    if (!state.program_state?.gameover) {
        const text = achievementJournalText(achievement, state);
        if (text)
            recordGameLogEvent(text, { state });
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
//# sourceMappingURL=achievements.js.map