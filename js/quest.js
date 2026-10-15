// quest.js — Quest scorecard, role text, and quest-character conversation.
// C refs: quest.c, questpgr.c, sounds.c; Lua ref: dat/quest.lua.
import { game } from './gstate.js';
import { gotoLevel } from './level_change.js';
import { nhgetch } from './input.js';
import { canSeeMonster, flush_screen, pline, plineWithContinuation } from './display.js';
import { MIN_QUEST_ALIGN, MIN_QUEST_LEVEL, STRAT_CLOSE, STRAT_WAITMASK, MAGIC_PORTAL, } from './const.js';
import { MONSTER_NAME, MONSTER_SOUND, monsterIsQuestNemesis } from './monster_data.js';
import { displayQuestText, prepareQuestText, qtPager, comPager } from './quest_pager.js';
import { artifactByName } from './artifacts.js';
import { exerciseWisdom as exerciseQuestWisdom } from './attrib.js';
import { fullyIdentifyObject } from './invent.js';
import { observeObject } from './object_knowledge.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, BELL_OF_OPENING } from './object_data.js';
import { objectCombatName, definiteName } from './objnam.js';
import { heroIsDeaf } from './senses.js';
import { recordGameLogEvent } from './gamelog.js';
import { monsterName } from './monster_name.js';
import { angerMonster, angerWatchGuards } from './monster_anger.js';
import { adjustHeroAlignment } from './alignment.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { rn2 } from './rng.js';
import { createPoisonGasCloud } from './regions.js';
import { deleteTrap } from './trap_lifecycle.js';
import { impossible } from './diagnostics.js';
const MS_NEMESIS = 37;
const MS_GUARDIAN = 38;
// C struct q_score is global game state, not a property inferred from the
// current special level.  Keeping the complete shape here makes the state
// survive level cache changes and ordinary game serialization as later quest
// branches are ported.
export function ensureQuestStatus(g = game) {
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
export function checkQuestMonsterStatus(monster, state = game) {
    if (!monsterIsQuestNemesis(monster.mnum))
        return;
    ensureQuestStatus(state).in_battle = !monster.msleeping && !!monster.mcanmove
        && (monster.mx !== state.u.ux || monster.my !== state.u.uy)
        && Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1;
}
// role_init() marks the selected role's leader species peaceful and M3_CLOSE;
// makemon() then records the particular live identity in q_score.  Register
// after ordinary construction so the constructor's existing RNG remains in
// source order even while role metadata overrides the final attitude.
export function registerQuestLeader(monster, g = game) {
    if (!monster || monster.mnum !== g.urole?.ldrnum)
        return false;
    const status = ensureQuestStatus(g);
    status.leader_m_id = monster.m_id;
    status.ldrgend = monster.female ? 1 : 0;
    monster.questLeader = true;
    monster.mpeaceful = 1;
    monster.mstrategy = (monster.mstrategy || 0) | STRAT_CLOSE;
    return true;
}
export function isQuestLeader(monster, g = game) {
    if (!monster)
        return false;
    const status = ensureQuestStatus(g);
    return !!status.leader_m_id
        && monster.m_id === status.leader_m_id;
}
export function markQuestLeaderDead(monster, g = game) {
    if (!isQuestLeader(monster, g))
        return false;
    const status = ensureQuestStatus(g);
    status.leader_is_dead = true;
    status.killed_leader = true;
    return true;
}
export function markQuestLeaderAlive(monster, g = game) {
    if (!isQuestLeader(monster, g))
        return false;
    ensureQuestStatus(g).leader_is_dead = false;
    return true;
}
export async function markQuestNemesisDead(monster, g = game, x = monster?.mx ?? 0, y = monster?.my ?? 0) {
    if (!monster || !monsterIsQuestNemesis(monster.mnum))
        return false;
    const status = ensureQuestStatus(g);
    if (!status.killed_nemesis) {
        status.killed_nemesis = true;
        await qtPager('killed_nemesis', g);
    }
    // stinky_nemesis() performs a second lookup even after nemdead() has
    // already announced an earlier nemesis death.
    const text = await prepareQuestText('killed_nemesis', g);
    const raw = text?.raw.replaceAll('\n', ' ') ?? '';
    if (/(?:noxious|poisonous|toxic).* (?:gas|fumes)/iu.test(raw)) {
        const moving = g.context.mon_moving;
        g.context.mon_moving = true;
        try {
            await createPoisonGasCloud(g, x, y, 5, 8);
        }
        finally {
            g.context.mon_moving = moving;
        }
    }
    return true;
}
async function prepareQtDelivery(messageId, state) {
    const text = await prepareQuestText(messageId, state);
    return text?.output === 'pline'
        ? { line: text.lines.join('\n'), text } : { page: text };
}
export function isQuestArtifact(object, state = game) {
    return !!object.oartifact
        && object.oartifact === artifactByName(state.urole?.artifactName, state)?.id;
}
function objectContainsQuestArtifact(object, state) {
    if (!object)
        return false;
    return isQuestArtifact(object, state)
        || (object.contents ?? []).some(content => objectContainsQuestArtifact(content, state));
}
function levelContainsQuestArtifact(g = game) {
    const level = g.level;
    if ((level?.objects || []).flat(2).some(object => objectContainsQuestArtifact(object, g)))
        return true;
    if ((level?.buriedObjects || []).some(object => objectContainsQuestArtifact(object, g)))
        return true;
    return (level?.monsters || []).some(monster => !monster.dead && monster.mhp > 0 && (monster.minvent || [])
        .some(object => objectContainsQuestArtifact(object, g)));
}
// C do.c:goto_level() leaves its level-teleport pline pending and then calls
// quest.c:onquest().  qt_pager() has already loaded quest.lua and substituted
// the role text when opening its text window forces the older pline's More
// acknowledgement.  Keep lookup and display separate so the Lua RNG remains
// on the command which entered the level while the next key still belongs to
// the pending materialization line.
export async function prepareQuestArrival({ fromDepth } = {}, g = game) {
    const currentDepth = g.u.uz;
    if (!currentDepth)
        return null;
    if (fromDepth?.dnum === currentDepth.dnum && fromDepth.dlevel === currentDepth.dlevel)
        return null;
    if (g.u?.uevent?.qcompleted)
        return null;
    if (g.dungeons?.[g.u?.uz?.dnum ?? 0]?.dname !== 'The Quest')
        return null;
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
        if (status.killed_nemesis)
            return null;
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
        if (status.killed_nemesis)
            return null;
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
                if (status.made_goal < 7)
                    status.made_goal++;
            },
        };
    }
    return null;
}
// C do.c main-dungeon arrival branch: reaching the Quest entrance for the
// first time invokes com_pager("quest_portal").  Loading quest.lua consumes
// nhlib's alignment shuffle before its four plines collide with any pending
// level-teleport message.
export async function prepareMainQuestPortalCall({ firstVisit = true } = {}, g = game) {
    if (!firstVisit)
        return null;
    const event = g.u?.uevent || (g.u.uevent = {});
    const status = ensureQuestStatus(g);
    if (event.qcompleted || event.qexpelled || status.leader_is_dead)
        return null;
    const currentDnum = g.u?.uz?.dnum ?? 0;
    const currentDlevel = g.u?.uz?.dlevel ?? 1;
    const questDnum = g.dungeons?.findIndex(dungeon => dungeon?.dname === 'The Quest') ?? -1;
    const entrance = (g.branches || []).find(branch => {
        const hereIsEnd1 = branch?.end1?.dnum === currentDnum
            && branch.end1?.dlevel === currentDlevel;
        const hereIsEnd2 = branch?.end2?.dnum === currentDnum
            && branch.end2?.dlevel === currentDlevel;
        return (hereIsEnd1 && branch.end2?.dnum === questDnum)
            || (hereIsEnd2 && branch.end1?.dnum === questDnum);
    });
    if (!entrance || currentDnum === questDnum)
        return null;
    const messageId = event.qcalled
        ? g.urole?.key === 'rogue' ? 'quest_portal_demand' : 'quest_portal_again'
        : 'quest_portal';
    const text = await prepareQuestText(messageId, g, true);
    event.qcalled = true;
    return text?.lines ?? null;
}
export async function displayPreparedQuestArrival(arrival, g = game) {
    if (!arrival)
        return false;
    if (arrival.page)
        await displayQuestText(arrival.page, g);
    else if (arrival.text)
        await displayQuestText(arrival.text, g);
    arrival.commit?.();
    return !!(arrival.page || arrival.line);
}
async function questMore(message, g = game) {
    await pline(message);
    await flush_screen(1);
    g.nhDisplay?.setCursor(message.length, 0);
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    g._pending_message = '';
    g._retained_message = '';
    return key;
}
async function wizardAdjustAlignment(g = game) {
    await pline('adjust?');
    await flush_screen(1);
    // tty yn_function() prints an otherwise invisible separating space.
    g.nhDisplay?.setCursor(8, 0);
    // quest.c passes a null response set to yn_function(), so tty accepts
    // and returns any single byte.  Only literal `y` performs the adjustment.
    const key = await nhgetch();
    g._pending_message = '';
    g._retained_message = '';
    return String.fromCharCode(key);
}
function originalAlignment(g = game) {
    return g.u?.ualignbase?.[1] ?? g.u?.ualign?.type ?? 0;
}
function currentBaseAlignment(g = game) {
    return g.u?.ualignbase?.[0] ?? g.u?.ualign?.type ?? 0;
}
async function questPurity(talk, g = game) {
    const original = originalAlignment(g);
    const alignment = g.u.ualign;
    if (!alignment)
        throw new Error('Quest purity requires initialized hero alignment.');
    if (g.flags?.debug && talk) {
        const alignmentName = (value) => value > 0 ? 'lawful' : value < 0 ? 'chaotic' : 'neutral';
        if (alignment.type !== original)
            await plineWithContinuation(`You are currently ${alignmentName(alignment.type)} instead of ${alignmentName(original)}.`);
        else if (currentBaseAlignment(g) !== original)
            await plineWithContinuation('You have converted.');
        else if (alignment.record < MIN_QUEST_ALIGN) {
            await questMore(`You are currently ${alignment.record} and require ${MIN_QUEST_ALIGN}.--More--`, g);
            if (await wizardAdjustAlignment(g) === 'y')
                alignment.record = MIN_QUEST_ALIGN;
        }
    }
    if ((g.u?.ualign?.record ?? 0) >= MIN_QUEST_ALIGN
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original)
        return 1;
    return currentBaseAlignment(g) !== original ? -1 : 0;
}
export function onQuestStart(g = game) {
    return g.dungeons?.[g.u?.uz?.dnum ?? 0]?.dname === 'The Quest'
        && g._activeSpecialLevel?.prototype?.endsWith('-strt');
}
// C quest.c:ok_to_quest() asks the non-interactive purity predicate.  Keep
// that scorecard decision shared with pager and level-transition callers so
// a mapped quest stair is described as blocked until the same gate opens.
export function okToQuest(g = game) {
    const status = ensureQuestStatus(g);
    const original = originalAlignment(g);
    const pure = (g.u?.ualign?.record ?? 0) >= MIN_QUEST_ALIGN
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original;
    return !!(((status.got_quest || status.got_thanks) && pure)
        || status.killed_leader);
}
// C quest.c:finish_quest(). Returning the artifact also teaches its identity;
// an Amulet visit can happen before or after formal quest completion.
export async function finishQuest(object, state = game) {
    if (object && !isQuestArtifact(object, state)) {
        if (heroIsDeaf(state))
            return;
        fullyIdentifyObject(object, state);
        if (object.otyp === AMULET_OF_YENDOR)
            await qtPager('hasamulet', state);
        else if (object.otyp === FAKE_AMULET_OF_YENDOR)
            await plineWithContinuation('"Sorry to say, this is a mere imitation of the true Amulet of Yendor."');
        else
            await plineWithContinuation(`"Ah, I see you've found ${definiteName(objectCombatName(object, { state }), state)}."`);
        return;
    }
    const status = ensureQuestStatus(state);
    if (state.u.uhave?.amulet) {
        await qtPager('hasamulet', state);
        const amulet = state.inventory.find(item => item.otyp === AMULET_OF_YENDOR);
        if (amulet)
            fullyIdentifyObject(amulet, state);
    }
    else {
        await qtPager(status.got_thanks ? 'offeredit2' : 'offeredit', state);
        if (!state.inventory.some(item => item.otyp === BELL_OF_OPENING))
            await comPager('quest_complete_no_bell', state);
    }
    status.got_thanks = true;
    if (object) {
        (state.u.uevent ??= {}).qcompleted = 1;
        fullyIdentifyObject(object, state);
    }
}
export async function touchQuestArtifact(object, state = game) {
    const status = ensureQuestStatus(state);
    if (status.touched_artifact)
        return;
    observeObject(object, state);
    status.touched_artifact = true;
    await qtPager('gotit', state);
    exerciseQuestWisdom(true, state);
}
// C chat_with_leader(): the checks after the greeting apply only at home.
export async function chatWithQuestLeader(monster, g = game) {
    if (!monster || !isQuestLeader(monster, g))
        return false;
    const status = ensureQuestStatus(g);
    if (!monster.mpeaceful || status.pissed_off)
        return true;
    if (g.u.uhave?.questart && !status.met_nemesis)
        status.cheater = true;
    if (status.got_thanks) {
        if (g.u.uhave?.amulet)
            await finishQuest(null, g);
        else
            await qtPager('posthanks', g);
    }
    else if (g.u.uhave?.questart) {
        await finishQuest(g.inventory.find(item => isQuestArtifact(item, g)) ?? null, g);
    }
    else if (status.got_quest) {
        await qtPager('encourage', g);
    }
    else {
        if (!status.met_leader) {
            await qtPager('leader_first', g);
            status.met_leader = true;
            status.not_ready = 0;
        }
        else
            await qtPager('leader_next', g);
        if (!onQuestStart(g))
            return true;
        if ((g.u.ulevel ?? 1) < MIN_QUEST_LEVEL) {
            await qtPager('badlevel', g);
            exerciseQuestWisdom(true, g);
            await scheduleQuestExpulsion(false, g);
            return true;
        }
        const purity = await questPurity(true, g);
        if (purity < 0) {
            await comPager('banished', g);
            status.pissed_off = true;
            await scheduleQuestExpulsion(false, g);
            recordGameLogEvent(`${monsterName(monster, { state: g })} has expelled you from the quest`, { state: g });
        }
        else if (purity === 0) {
            await qtPager('badalign', g);
            status.not_ready = 1;
            exerciseQuestWisdom(true, g);
            await scheduleQuestExpulsion(false, g);
        }
        else {
            await qtPager('assignquest', g);
            exerciseQuestWisdom(true, g);
            status.got_quest = true;
            recordGameLogEvent(`${monsterName(monster, { state: g })} has granted access to proceed deeper into the quest`, { state: g });
        }
    }
    return true;
}
// C quest_chat(): chat uses a random threat; spontaneous nemesis speech has
// its own encounter progression and battle gate.
export async function chatWithQuestCharacter(monster, state = game) {
    const status = ensureQuestStatus(state);
    if (isQuestLeader(monster, state)) {
        await chatWithQuestLeader(monster, state);
        if (status.pissed_off)
            await angerMonster(monster);
    }
    else if (MONSTER_SOUND[monster.mnum] === MS_NEMESIS) {
        await qtPager('discourage', state);
        status.met_nemesis = true;
    }
    else if (MONSTER_SOUND[monster.mnum] === MS_GUARDIAN) {
        await qtPager(state.u.uhave?.questart && status.killed_nemesis
            ? 'guardtalk_after' : 'guardtalk_before', state);
    }
}
export async function talkQuestCharacter(monster, state = game) {
    const status = ensureQuestStatus(state);
    if (isQuestLeader(monster, state)) {
        if (!monster.mpeaceful) {
            if (!status.pissed_off)
                await qtPager('leader_last', state);
            status.pissed_off = true;
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
        }
        if (onQuestStart(state) && !status.pissed_off)
            await chatWithQuestLeader(monster, state);
        return;
    }
    if (MONSTER_SOUND[monster.mnum] === MS_NEMESIS) {
        if (status.in_battle) {
            if (!rn2(5))
                await qtPager('discourage', state);
            return;
        }
        if (state.u.uhave?.questart)
            await qtPager('nemesis_wantsit', state);
        else if (status.made_goal === 1 || !status.met_nemesis)
            await qtPager('nemesis_first', state);
        else if (status.made_goal < 4)
            await qtPager('nemesis_next', state);
        else if (status.made_goal < 7)
            await qtPager('nemesis_other', state);
        else if (!rn2(5))
            await qtPager('discourage', state);
        if (status.made_goal < 7)
            status.made_goal++;
        status.met_nemesis = true;
    }
    else if (MONSTER_NAME[monster.mnum] === 'prisoner'
        && ((monster.mstrategy ?? 0) & STRAT_WAITMASK) !== 0) {
        if (canSeeMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { capitalized: true, state })} speaks:`);
        await plineWithContinuation('"I\'m finally free!"');
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
        monster.mpeaceful = 1;
        adjustHeroAlignment(3, state);
        await angerWatchGuards(false, { state });
    }
}
export async function scheduleQuestExpulsion(seal, state = game) {
    endVoluntaryMultiTurn(state);
    state._questExpulsionPending = { seal, portal: !state.u.uevent?.qexpelled };
    if (seal) {
        const expelled = !!state.u.uevent?.qexpelled;
        (state.u.uevent ??= {}).qexpelled = 1;
        forgetQuestOverview(state);
        const portal = state.level?.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal)
            deleteTrap(portal, state);
        else if (!expelled)
            await impossible('quest portal already gone?', { state });
    }
}
function forgetQuestOverview(state) {
    const dungeon = state.quest_dnum ?? state.u.uz?.dnum;
    if (dungeon === undefined)
        return;
    for (const key of state._overviewRecords?.keys() ?? []) {
        if (key.startsWith(`${dungeon}:`))
            state._overviewRecords?.delete(key);
    }
}
// quest.c:expulsion(FALSE) schedules a portal arrival on the parent side of
// the Quest branch.  The deferred transition is executed by moveloop after
// the leader's modal dialogue returns, while the original hero action still
// owns the surrounding monster/global-turn transaction.
export async function performQuestExpulsion(g = game) {
    const current = g.u.uz;
    if (!current)
        return false;
    const branch = g.branches?.find(candidate => candidate.end1.dnum === current.dnum || candidate.end2.dnum === current.dnum);
    if (!branch)
        return false;
    const destination = branch.end1.dnum === current.dnum ? branch.end2 : branch.end1;
    if (!destination)
        return false;
    const seal = g._questExpulsionPending?.seal;
    const expelled = !!g.u.uevent?.qexpelled;
    await gotoLevel({ ...destination }, { arrival: (g._questExpulsionPending?.portal ?? !expelled) ? 'portal' : 'random' });
    if (seal) {
        forgetQuestOverview(g);
        const portal = g.level?.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal)
            deleteTrap(portal, g);
    }
    g._questExpulsionPending = null;
    g.context.move = 1;
    return true;
}
//# sourceMappingURL=quest.js.map