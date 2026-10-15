// quest.js — Quest scorecard, role text, and quest-character conversation.
// C refs: quest.c, questpgr.c, sounds.c; Lua ref: dat/quest.lua.

import { game } from './gstate.js';
import type { GameState, QuestStatus } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import { gotoLevel } from './level_change.js';
import { nhgetch } from './input.js';
import { flushPendingTopline, flush_screen, pline } from './display.js';
import {
    MIN_QUEST_ALIGN, MIN_QUEST_LEVEL, STRAT_CLOSE,
} from './const.js';
import { monsterIsQuestNemesis } from './monster_data.js';
import { displayQuestText, prepareQuestText, qtPager } from './quest_pager.js';
import type { QuestText } from './quest_pager.js';

// C struct q_score is global game state, not a property inferred from the
// current special level.  Keeping the complete shape here makes the state
// survive level cache changes and ordinary game serialization as later quest
// branches are ported.
export function ensureQuestStatus(g: GameState = game): QuestStatus {
    if (!g.quest_status) {
        g.quest_status = {
            first_start: false,
            met_leader: false,
            not_ready: 0,
            pissed_off: false,
            got_quest: false,
            killed_leader: false,
            first_locate: false,
            met_intermed: false,
            got_final: false,
            made_goal: 0,
            met_nemesis: false,
            killed_nemesis: false,
            in_battle: false,
            cheater: false,
            touched_artifact: false,
            offered_artifact: false,
            got_thanks: false,
            ldrgend: 0,
            nemgend: 0,
            godgend: 0,
            leader_is_dead: false,
            leader_m_id: 0,
        };
    }
    return g.quest_status;
}

// C quest.c:quest_stat_check(), before dochug() returns for an inactive actor.
export function checkQuestMonsterStatus(monster: Monster, state: GameState = game): void {
    if (!monsterIsQuestNemesis(monster.mnum)) return;
    ensureQuestStatus(state).in_battle = !monster.msleeping && !!monster.mcanmove
        && Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1;
}

// role_init() marks the selected role's leader species peaceful and M3_CLOSE;
// makemon() then records the particular live identity in q_score.  Register
// after ordinary construction so the constructor's existing RNG remains in
// source order even while role metadata overrides the final attitude.
export function registerQuestLeader(
    monster: Monster | null | undefined, g: GameState = game,
): boolean {
    if (!monster || monster.mnum !== g.urole?.ldrnum) return false;
    const status = ensureQuestStatus(g);
    status.leader_m_id = monster.m_id;
    status.ldrgend = monster.female ? 1 : 0;
    monster.questLeader = true;
    monster.mpeaceful = 1;
    monster.mstrategy = (monster.mstrategy || 0) | STRAT_CLOSE;
    return true;
}

export function isQuestLeader(
    monster: Monster | null | undefined, g: GameState = game,
): boolean {
    if (!monster) return false;
    const status = ensureQuestStatus(g);
    return !!status.leader_m_id
        && monster.m_id === status.leader_m_id;
}

export function markQuestLeaderDead(
    monster: Monster | null | undefined, g: GameState = game,
): boolean {
    if (!isQuestLeader(monster, g)) return false;
    const status = ensureQuestStatus(g);
    status.leader_is_dead = true;
    status.killed_leader = true;
    return true;
}

export function markQuestLeaderAlive(
    monster: Monster | null | undefined, g: GameState = game,
): boolean {
    if (!isQuestLeader(monster, g)) return false;
    ensureQuestStatus(g).leader_is_dead = false;
    return true;
}

export function markQuestNemesisDead(
    monster: Monster | null | undefined, g: GameState = game,
): boolean {
    if (!monster || !monsterIsQuestNemesis(monster.mnum)) return false;
    ensureQuestStatus(g).killed_nemesis = true;
    return true;
}

export type QuestArrival = {
    page?: QuestText | null;
    line?: string | null;
    text?: QuestText | null;
    commit?: () => void;
};

async function prepareQtDelivery(messageId: string, state: GameState): Promise<QuestArrival> {
    const text = await prepareQuestText(messageId, state);
    return text?.output === 'pline'
        ? { line: text.lines.join('\n'), text } : { page: text };
}

function objectContainsQuestArtifact(object: GameObject | null | undefined): boolean {
    if (!object) return false;
    if (object.questArtifact) return true;
    return (object.contents || []).some(objectContainsQuestArtifact);
}

function levelContainsQuestArtifact(g: GameState = game) {
    const level = g.level;
    if ((level?.objects || []).flat(2).some(objectContainsQuestArtifact))
        return true;
    if ((level?.buriedObjects || []).some(objectContainsQuestArtifact))
        return true;
    return (level?.monsters || []).some(monster =>
        (monster.minvent || [])
            .some(objectContainsQuestArtifact));
}

// C do.c:goto_level() leaves its level-teleport pline pending and then calls
// quest.c:onquest().  qt_pager() has already loaded quest.lua and substituted
// the role text when opening its text window forces the older pline's More
// acknowledgement.  Keep lookup and display separate so the Lua RNG remains
// on the command which entered the level while the next key still belongs to
// the pending materialization line.
export async function prepareQuestArrival({ fromDepth, firstVisit = true }: {
    fromDepth?: DungeonLocation;
    firstVisit?: boolean;
} = {}, g: GameState = game): Promise<QuestArrival | null> {
    const currentDepth = g.u.uz;
    if (!currentDepth) return null;
    if (fromDepth?.dnum === currentDepth.dnum && fromDepth.dlevel === currentDepth.dlevel) return null;
    if (g.u?.uevent?.qcompleted) return null;
    if (g.dungeons?.[g.u?.uz?.dnum ?? 0]?.dname !== 'The Quest') return null;

    const prototype = g._activeSpecialLevel?.prototype || '';
    const status = ensureQuestStatus(g);
    if (prototype.endsWith('-strt')) {
        if (!status.first_start) {
            return {
                ...await prepareQtDelivery('firsttime', g),
                commit() { status.first_start = true; },
            };
        }
        const fromOtherDungeon = fromDepth?.dnum !== g.u?.uz?.dnum;
        const fromAbove = fromDepth?.dnum === g.u?.uz?.dnum
            && (fromDepth?.dlevel ?? currentDepth.dlevel)
                < (g.u?.uz?.dlevel ?? 0);
        if (fromOtherDungeon || fromAbove) {
            // quest.c:on_start() uses nexttime for the first three rejected
            // returns. It is a pline message, but quest.lua loading and
            // substitution still precede collision with the pending level-
            // teleport message.
            if ((status.not_ready ?? 0) <= 2)
                return prepareQtDelivery('nexttime', g);
            return prepareQtDelivery('othertime', g);
        }
        return null;
    }
    if (prototype.endsWith('-loca')) {
        if (status.killed_nemesis) return null;
        const fromAbove = (fromDepth?.dlevel ?? currentDepth.dlevel)
            < (g.u?.uz?.dlevel ?? 0);
        if (!status.first_locate) {
            const delivery = fromAbove
                ? await prepareQtDelivery('locate_first', g)
                : {};
            return {
                ...delivery,
                commit() { status.first_locate = true; },
            };
        }
        if (fromAbove)
            return prepareQtDelivery('locate_next', g);
    }
    if (prototype.endsWith('-goal')) {
        if (status.killed_nemesis) return null;
        if (!status.made_goal) {
            return {
                ...await prepareQtDelivery('goal_first', g),
                commit() { status.made_goal = 1; },
            };
        }
        const messageId = levelContainsQuestArtifact(g)
            ? 'goal_next' : 'goal_alt';
        return {
            ...await prepareQtDelivery(messageId, g),
            commit() {
                if (status.made_goal < 7) status.made_goal++;
            },
        };
    }
    return null;
}

// C do.c main-dungeon arrival branch: reaching the Quest entrance for the
// first time invokes com_pager("quest_portal").  Loading quest.lua consumes
// nhlib's alignment shuffle before its four plines collide with any pending
// level-teleport message.
export async function prepareMainQuestPortalCall({ firstVisit = true } = {},
    g: GameState = game) {
    if (!firstVisit) return null;
    const event = g.u?.uevent || (g.u.uevent = {});
    const status = ensureQuestStatus(g);
    if (event.qcompleted || event.qexpelled || status.leader_is_dead)
        return null;

    const currentDnum = g.u?.uz?.dnum ?? 0;
    const currentDlevel = g.u?.uz?.dlevel ?? 1;
    const questDnum = g.dungeons?.findIndex(dungeon =>
        dungeon?.dname === 'The Quest') ?? -1;
    const entrance = (g.branches || []).find(branch => {
        const hereIsEnd1 = branch?.end1?.dnum === currentDnum
            && branch.end1?.dlevel === currentDlevel;
        const hereIsEnd2 = branch?.end2?.dnum === currentDnum
            && branch.end2?.dlevel === currentDlevel;
        return (hereIsEnd1 && branch.end2?.dnum === questDnum)
            || (hereIsEnd2 && branch.end1?.dnum === questDnum);
    });
    if (!entrance || currentDnum === questDnum) return null;

    const messageId = event.qcalled
        ? g.urole?.key === 'rogue' ? 'quest_portal_demand' : 'quest_portal_again'
        : 'quest_portal';
    const text = await prepareQuestText(messageId, g, true);
    event.qcalled = true;
    return text?.lines ?? null;
}

export async function displayPreparedQuestArrival(
    arrival: QuestArrival | null, g: GameState = game,
): Promise<boolean> {
    if (!arrival) return false;
    if (arrival.page) await displayQuestText(arrival.page, g);
    else if (arrival.text) await displayQuestText(arrival.text, g);
    arrival.commit?.();
    return !!(arrival.page || arrival.line);
}

async function questMore(message: string, g: GameState = game): Promise<number> {
    await pline(message);
    await flush_screen(1);
    g.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    g._pending_message = '';
    g._retained_message = '';
    return key;
}

async function wizardAdjustAlignment(g: GameState = game) {
    await pline('adjust?');
    await flush_screen(1);
    // tty yn_function() prints an otherwise invisible separating space.
    g.nhDisplay?.setCursor(8, 0);
    // quest.c passes a null response set to yn_function(), so tty accepts
    // and returns any single byte.  Only literal `y` performs the adjustment.
    const key = await nhgetch();
    g._pending_message = '';
    g._retained_message = '';
    return String.fromCharCode(key).toLowerCase();
}

function originalAlignment(g: GameState = game) {
    return g.u?.ualignbase?.[1] ?? g.u?.ualign?.type ?? 0;
}

function currentBaseAlignment(g: GameState = game) {
    return g.u?.ualignbase?.[0] ?? g.u?.ualign?.type ?? 0;
}

async function questPurity(talk: boolean, g: GameState = game): Promise<-1 | 0 | 1> {
    const original = originalAlignment(g);
    const alignment = g.u.ualign;
    if (!alignment) throw new Error('Quest purity requires initialized hero alignment.');
    if (g.flags?.debug && talk
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original
        && (g.u?.ualign?.record ?? 0) < MIN_QUEST_ALIGN) {
        await questMore(
            `You are currently ${alignment.record} and require ${MIN_QUEST_ALIGN}.--More--`,
            g,
        );
        if (await wizardAdjustAlignment(g) === 'y')
            alignment.record = MIN_QUEST_ALIGN;
    }
    if ((g.u?.ualign?.record ?? 0) >= MIN_QUEST_ALIGN
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original) return 1;
    return currentBaseAlignment(g) !== original ? -1 : 0;
}

export function onQuestStart(g: GameState = game) {
    return g.dungeons?.[g.u?.uz?.dnum ?? 0]?.dname === 'The Quest'
        && g._activeSpecialLevel?.prototype?.endsWith('-strt');
}

// C quest.c:ok_to_quest() asks the non-interactive purity predicate.  Keep
// that scorecard decision shared with pager and level-transition callers so
// a mapped quest stair is described as blocked until the same gate opens.
export function okToQuest(g: GameState = game) {
    const status = ensureQuestStatus(g);
    const original = originalAlignment(g);
    const pure = (g.u?.ualign?.record ?? 0) >= MIN_QUEST_ALIGN
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original;
    return !!(((status.got_quest || status.got_thanks) && pure)
        || status.killed_leader);
}

// Ported source block: chat_with_leader()'s first-contact, capable, pure
// assignment path.  The durable state and dispatch seams are shared with the
// remaining rejection/completion branches, which stay explicit future work.
export async function chatWithQuestLeader(monster: Monster | null | undefined, {
    exerciseWisdom = null,
}: { exerciseWisdom?: (() => void) | null } = {}, g: GameState = game): Promise<boolean> {
    if (!monster || !isQuestLeader(monster, g)) return false;
    const status = ensureQuestStatus(g);
    if (!monster.mpeaceful || status.pissed_off) return true;

    // The current completed block is initial assignment.  Preserve command
    // ownership for later leader states without fabricating their dialogue.
    if (status.met_leader || status.got_quest || status.got_thanks)
        return true;

    if (!await qtPager('leader_first', g)) return true;
    status.met_leader = true;
    status.not_ready = 0;

    // A leader carried through the portal may be chatted with elsewhere, but
    // capability and quest assignment are meaningful only on qstart_level.
    if (!onQuestStart(g)) return true;
    if ((g.u?.ulevel ?? 1) < MIN_QUEST_LEVEL) {
        // badlevel text plus expulsion is the next alternative readiness
        // block; do not silently grant the quest when it is not yet ported.
        status.not_ready = 1;
        return true;
    }

    const purity = await questPurity(true, g);
    if (purity === 0) {
        await qtPager('badalign', g);
        if (exerciseWisdom) exerciseWisdom();
        status.not_ready = 1;
        g._questExpulsionPending = { seal: false };
        return true;
    }
    if (purity !== 1) {
        status.not_ready = 1;
        return true;
    }

    if (!await qtPager('assignquest', g)) return true;
    if (exerciseWisdom) exerciseWisdom();
    status.got_quest = true;
    return true;
}

// quest.c:expulsion(FALSE) schedules a portal arrival on the parent side of
// the Quest branch.  The deferred transition is executed by moveloop after
// the leader's modal dialogue returns, while the original hero action still
// owns the surrounding monster/global-turn transaction.
export async function performQuestExpulsion(g: GameState = game) {
    const current = g.u.uz;
    if (!current) return false;
    const branch = g.branches?.find(candidate =>
        (candidate.end1?.dnum === current.dnum
            && candidate.end1?.dlevel === current.dlevel)
        || (candidate.end2?.dnum === current.dnum
            && candidate.end2?.dlevel === current.dlevel));
    if (!branch) return false;
    const destination = branch.end1?.dnum === current.dnum
        && branch.end1?.dlevel === current.dlevel
        ? branch.end2 : branch.end1;
    if (!destination) return false;
    await gotoLevel({ ...destination }, { arrival: 'portal' });
    g._questExpulsionPending = null;
    g.context.move = 1;
    return true;
}
