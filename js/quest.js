// quest.js — Quest scorecard, role text, and quest-character conversation.
// C refs: quest.c, questpgr.c, sounds.c; Lua ref: dat/quest.lua.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { flushPendingTopline, flush_screen, pline } from './display.js';
import { showTextPages } from './windows.js';
import { rn2 } from './rng.js';
import {
    MIN_QUEST_ALIGN, MIN_QUEST_LEVEL, STRAT_CLOSE,
} from './const.js';

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

// role_init() marks the selected role's leader species peaceful and M3_CLOSE;
// makemon() then records the particular live identity in q_score.  Register
// after ordinary construction so the constructor's existing RNG remains in
// source order even while role metadata overrides the final attitude.
export function registerQuestLeader(monster, g = game) {
    if (!monster || monster.mnum !== g.urole?.ldrnum) return false;
    const status = ensureQuestStatus(g);
    status.leader_m_id = monster.m_id;
    status.ldrgend = monster.female ? 1 : 0;
    monster.questLeader = true;
    monster.mpeaceful = 1;
    monster.mstrategy = (monster.mstrategy || 0) | STRAT_CLOSE;
    return true;
}

export function isQuestLeader(monster, g = game) {
    if (!monster) return false;
    const status = ensureQuestStatus(g);
    if (status.leader_m_id)
        return monster.m_id === status.leader_m_id;
    // Old saves can predate q_score registration.  Recover only from the
    // selected role's semantic leader identity, then make the state durable.
    return monster.mnum === g.urole?.ldrnum
        && registerQuestLeader(monster, g);
}

function questPage(lines) {
    const page = lines.slice(0, 23);
    while (page.length < 23) page.push('');
    page.push('--More--');
    return { lines: page, cursor: [8, 23] };
}

function heroName(g = game) {
    return g.plname || g.displayName?.toLowerCase() || 'adventurer';
}

function roleDeity(g = game) {
    const role = g.urole || {};
    const align = (g.u?.ualign?.type ?? 0) > 0 ? 'lawful'
        : (g.u?.ualign?.type ?? 0) < 0 ? 'chaotic' : 'neutral';
    return role.gods?.[align] || 'your god';
}

function archeologistFirstTime(g = game) {
    const homebase = g.urole?.homebase || 'the College of Archeology';
    return [
        'You are suddenly in familiar surroundings.  The buildings in the distance',
        'seem to be those of your old alma mater, but something is wrong.  It feels',
        `as if there has been a riot recently, or ${homebase} has`,
        'been under siege.',
        '',
        'All of the windows are boarded up, and there are objects scattered around',
        'the entrance.',
        '',
        'Strange forbidding shapes seem to be moving in the distance.',
    ];
}

function barbarianFirstTime(g = game) {
    const role = g.urole || {};
    const perceive = g.blind ? 'sense' : 'see';
    const homebase = role.homebase || 'the Camp of the Duali Tribe';
    const leader = role.leaderName || 'Pelias';
    return [
        'Warily you scan your surroundings, all of your senses alert for signs',
        `of possible danger.  Off in the distance, you can ${perceive} the familiar shapes`,
        `of ${homebase}.`,
        '',
        `But why, you think, should ${leader} be there?`,
        '',
        'Suddenly, the hairs on your neck stand on end as you detect the aura of',
        'evil magic in the air.',
        '',
        'Without thought, you ready your weapon, and mutter under your breath:',
        '',
        `    "By ${roleDeity(g)}, there will be blood spilt today."`,
    ];
}

function barbarianLocateFirst(g = game) {
    const intermediate = g.urole?.intermediate || 'the Duali Oasis';
    return [
        'The scent of water comes to you in the desert breeze.  You know that',
        `you have located ${intermediate}.`,
    ];
}

function barbarianLocateNext(g = game) {
    const intermediate = g.urole?.intermediate || 'the Duali Oasis';
    return `Yet again you have a chance to infiltrate ${intermediate}.`;
}

function archeologistLeaderFirst(g = game) {
    const name = heroName(g);
    return [
        `"Finally you have returned, ${name}.  You were always`,
        'my most promising student.  Allow me to see if you are ready for the',
        'most difficult task of your career."',
    ];
}

function archeologistAssignQuest(g = game) {
    const role = g.urole || {};
    const nemesis = role.nemesisName || 'the Minion of Huhetotl';
    const artifact = role.artifactName || 'the Orb of Detection';
    const intermediate = role.intermediate || 'the Tomb of the Toltec Kings';
    return [
        `Grave times have befallen the college, for ${nemesis} has`,
        `stolen ${artifact}.  Without it, the board of directors of`,
        'the university will soon have no choice but to revoke our research grants.',
        '',
        `"You must locate the entrance to ${intermediate}.  Within it,`,
        `you will find ${nemesis}.`,
        '',
        `"You must then defeat ${nemesis} and return ${artifact}`,
        'to me.',
        '',
        '"Only in this way will we be able to prevent the budget cuts that could',
        'close this college.',
        '',
        `"May the wisdom of ${roleDeity(g)} be your guide."`,
    ];
}

function archeologistBadAlign(g = game) {
    const name = heroName(g);
    const properName = name
        ? `${name[0].toUpperCase()}${name.slice(1)}` : 'Adventurer';
    const rank = g.urole?.rank;
    const rankName = (g.flags?.female ? rank?.f : rank?.m)
        || rank?.m || 'Spelunker';
    const alignment = (g.u?.ualign?.type ?? 0) > 0 ? 'lawful'
        : (g.u?.ualign?.type ?? 0) < 0 ? 'chaotic' : 'neutral';
    return [
        `"${properName}!  I've heard that you've been using sloppy techniques.  Your`,
        `results lately can hardly be called suitable for a ${rankName}!`,
        '',
        `"How could you have strayed from the ${alignment} path?  Go from here, and come`,
        'back only when you have purified yourself."',
    ];
}

function archeologistLocateFirst(g = game) {
    const intermediate = g.urole?.intermediate
        || 'the Tomb of the Toltec Kings';
    return [
        'A plain opens before you.  Beyond the plain lies a foreboding edifice.',
        '',
        'You have the feeling that you will soon find the entrance to',
        `${intermediate}.`,
    ];
}

function priestLeaderFirst(g = game) {
    const name = heroName(g);
    const child = g.flags?.female ? 'daughter' : 'son';
    return [
        `"Ah, ${name}, my ${child}.  You have returned to us at last.`,
        'A great blow has befallen our order; perhaps you can help us.',
        'First, however, I must determine if you are prepared for this',
        'great challenge."',
    ];
}

function priestAssignQuest(g = game) {
    const role = g.urole || {};
    const name = heroName(g);
    const nemesis = role.nemesisName || 'Nalzok';
    const homebase = role.homebase || 'the Great Temple';
    const guardians = role.guardianPlural || 'Acolytes';
    const artifact = role.artifactName || 'the Mitre of Holiness';
    const intermediate = role.intermediate || 'the Temple of Nalzok';
    const align = (g.u?.ualign?.type ?? 0) > 0 ? 'lawful'
        : (g.u?.ualign?.type ?? 0) < 0 ? 'chaotic' : 'neutral';
    const deity = role.gods?.[align] || 'your god';
    return [
        `"Yes, ${name}.  You are truly ready now.  Attend to me and I shall`,
        'tell you of what has transpired:',
        '',
        `"At one of the Great Festivals a short time ago, ${nemesis} and a legion`,
        `of undead invaded ${homebase}.  Many ${guardians} were killed, including`,
        `the one carrying ${artifact}.`,
        '',
        `"As a final act of vengefulness, ${nemesis} desecrated the altar here.`,
        'Without it, we could not mount a counter-attack.  Now, there are',
        `barely enough ${guardians} left to keep the undead at bay.`,
        '',
        `"We need you to find ${intermediate}, then, from there, travel`,
        `to ${nemesis}'s lair.  If you can manage to defeat ${nemesis} and return`,
        `${artifact} here, we can then drive off the legions of`,
        'undead that befoul the land.',
        '',
        `"Go with ${deity} as your guide, ${name}."`,
    ];
}

function priestFirstTime(g = game) {
    const role = g.urole || {};
    const homebase = role.homebase || 'the Great Temple';
    const leader = role.leaderName || 'the Arch Priest';
    return [
        `You find yourself standing in sight of ${homebase}.  Something`,
        `is obviously wrong here.  The doors to ${homebase}, which usually`,
        'stand open, are closed.  Strange human shapes shamble around',
        'outside.',
        '',
        `You realize that ${leader} needs your assistance!`,
    ];
}

function priestLocateFirst(g = game) {
    const role = g.urole || {};
    const intermediate = role.intermediate || 'the Temple of Nalzok';
    const leader = role.leaderName || 'the Arch Priest';
    const nemesis = role.nemesisName || 'Nalzok';
    return [
        'You stand facing a large graveyard.  The sky above is filled with clouds',
        'that seem to get thicker closer to the center.  You sense the presence of',
        'undead in larger numbers than you have ever encountered before.',
        '',
        `You remember the descriptions of ${intermediate}, given to you by`,
        `${leader}.  It is ahead that you will find ${nemesis}'s trail.`,
    ];
}

function priestGoalFirst() {
    return [
        'The stench of brimstone is all about you, and the shrieks and moans',
        'of tortured souls assault your psyche.',
        '',
        'Ahead, there is a small clearing amidst the bubbling pits of lava...',
    ];
}

function archeologistGoalFirst(g = game) {
    const leader = g.urole?.leaderName || 'Lord Carnarvon';
    const artifact = g.urole?.artifactName || 'the Orb of Detection';
    return [
        'A strange feeling washes over you, and you think back to things you',
        `learned during the many lectures of ${leader}.`,
        '',
        `You realize the feeling must be the presence of ${artifact}.`,
    ];
}

function knightGoalFirst(g = game) {
    const perceive = g.blind ? 'sense' : 'see';
    return [
        `As you exit the swamps, you ${perceive} before you a huge, gaping hole in the`,
        'side of a hill.  From within, you smell the foul stench of carrion.',
        '',
        'The pools on either side of the entrance are fouled with blood, and',
        'pieces of rusted metal and broken weapons show above the surface.',
    ];
}

function priestNextTime(g = game) {
    const homebase = g.urole?.homebase || 'the Great Temple';
    return `Once again, you stand before ${homebase}.`;
}

function archeologistNextTime(g = game) {
    const homebase = g.urole?.homebase || 'the College of Archeology';
    return `Once again, you are back at ${homebase}.`;
}

function archeologistLocateNext(g = game) {
    const intermediate = g.urole?.intermediate
        || 'the Tomb of the Toltec Kings';
    return `Once again, you are near the entrance to ${intermediate}.`;
}

function archeologistGoalNext(g = game) {
    const artifact = g.urole?.artifactName || 'the Orb of Detection';
    return `The familiar presence of ${artifact} is in the ether.`;
}

function archeologistGoalAlt(g = game) {
    const nemesis = (g.urole?.nemesisName || 'the Minion of Huhetotl')
        .replace(/^the /, '');
    return `You have returned to ${nemesis}'s lair.`;
}

function priestLocateNext(g = game) {
    const intermediate = g.urole?.intermediate || 'the Temple of Nalzok';
    return `Again, you stand before ${intermediate}.`;
}

function wizardFirstTime(g = game) {
    const leader = g.urole?.leaderName || 'Neferet the Green';
    return [
        'You are suddenly in familiar surroundings.  You notice what appears to',
        'be a large, squat stone structure nearby.  Wait!  That looks like the',
        `tower of your former teacher, ${leader}.`,
        '',
        'However, things are not the same as when you were last here.  Mists and',
        'areas of unexplained darkness surround the tower.  There is movement in',
        'the shadows.',
        '',
        'Your teacher would never allow such unaesthetic forms to surround the',
        'tower...  unless something were dreadfully wrong!',
    ];
}

function wizardLocateFirst(g = game) {
    const nemesis = g.urole?.nemesisName || 'the Dark One';
    const possessive = nemesis.endsWith('s')
        ? `${nemesis}'`
        : `${nemesis}'s`;
    return 'Wisps of fog swirl nearby.  '
        + `You feel that ${possessive} lair is close.`;
}

const QUEST_TEXT = {
    Arc: {
        firsttime: archeologistFirstTime,
        leader_first: archeologistLeaderFirst,
        assignquest: archeologistAssignQuest,
        badalign: archeologistBadAlign,
        locate_first: archeologistLocateFirst,
        goal_first: archeologistGoalFirst,
    },
    Bar: {
        firsttime: barbarianFirstTime,
        locate_first: barbarianLocateFirst,
    },
    Kni: {
        goal_first: knightGoalFirst,
    },
    Pri: {
        firsttime: priestFirstTime,
        locate_first: priestLocateFirst,
        goal_first: priestGoalFirst,
        leader_first: priestLeaderFirst,
        assignquest: priestAssignQuest,
    },
    Wiz: {
        firsttime: wizardFirstTime,
    },
};

const QUEST_LINE = {
    Bar: {
        locate_next: barbarianLocateNext,
    },
    Arc: {
        nexttime: archeologistNextTime,
        locate_next: archeologistLocateNext,
        goal_next: archeologistGoalNext,
        goal_alt: archeologistGoalAlt,
    },
    Pri: {
        nexttime: priestNextTime,
        locate_next: priestLocateNext,
    },
    Wiz: {
        locate_first: wizardLocateFirst,
    },
};

// questpgr.c loads quest.lua afresh for each qt_pager() lookup.  Its nhlib
// dependency shuffles the three alignment names before the requested message
// is resolved, even though these two Priest texts do not reference that list.
function prepareQtDelivery(messageId, g = game) {
    rn2(3);
    rn2(2);
    const pageText = QUEST_TEXT[g.urole?.filecode]?.[messageId];
    if (pageText) return { page: questPage(pageText(g)) };
    const lineText = QUEST_LINE[g.urole?.filecode]?.[messageId];
    return lineText ? { line: lineText(g) } : {};
}

function prepareQtPager(messageId, g = game) {
    return prepareQtDelivery(messageId, g).page || null;
}

function prepareQtLine(messageId, g = game) {
    return prepareQtDelivery(messageId, g).line || null;
}

function objectContainsQuestArtifact(object) {
    if (!object) return false;
    if (object.questArtifact || object.isQuestArtifact) return true;
    return (object.contents || []).some(objectContainsQuestArtifact);
}

function levelContainsQuestArtifact(g = game) {
    const level = g.level;
    if ((level?.objects || []).flat(2).some(objectContainsQuestArtifact))
        return true;
    if ((level?.buriedObjects || []).some(objectContainsQuestArtifact))
        return true;
    return (level?.monsters || []).some(monster =>
        (monster.minvent || monster.inventory || [])
            .some(objectContainsQuestArtifact));
}

async function displayPreparedQtPager(page, g = game) {
    if (!page) return false;
    // goto_level's arrival owner has already displayed and acknowledged its
    // explicit `--More--` line.  Direct quest_talk() enters with an ordinary
    // pending pline, which opening the text window must flush here.
    if (g._pending_message
        && !g._pending_message.endsWith('--More--'))
        await flushPendingTopline();
    g._pending_message = '';
    g._retained_message = '';
    await showTextPages([page], { validKeys: [27, 32, 10, 13] });
    g._pending_message = '';
    g._retained_message = '';
    return true;
}

async function qtPager(messageId, g = game) {
    return displayPreparedQtPager(prepareQtPager(messageId, g), g);
}

// C do.c:goto_level() leaves its level-teleport pline pending and then calls
// quest.c:onquest().  qt_pager() has already loaded quest.lua and substituted
// the role text when opening its text window forces the older pline's More
// acknowledgement.  Keep lookup and display separate so the Lua RNG remains
// on the command which entered the level while the next key still belongs to
// the pending materialization line.
export function prepareQuestArrival({ fromDepth, firstVisit = true } = {},
    g = game) {
    if (g.u?.uevent?.qcompleted) return null;
    if (g.dungeons?.[g.u?.uz?.dnum ?? 0]?.dname !== 'The Quest') return null;

    const prototype = g._activeSpecialLevel?.prototype || '';
    const status = ensureQuestStatus(g);
    if (prototype.endsWith('-strt')) {
        if (!status.first_start) {
            return {
                page: prepareQtPager('firsttime', g),
                commit() { status.first_start = true; },
            };
        }
        const fromOtherDungeon = fromDepth?.dnum !== g.u?.uz?.dnum;
        const fromAbove = fromDepth?.dnum === g.u?.uz?.dnum
            && (fromDepth?.dlevel ?? g.u.uz.dlevel)
                < (g.u?.uz?.dlevel ?? 0);
        if (fromOtherDungeon || fromAbove) {
            // quest.c:on_start() uses nexttime for the first three rejected
            // returns. It is a pline message, but quest.lua loading and
            // substitution still precede collision with the pending level-
            // teleport message.
            if ((status.not_ready ?? 0) <= 2)
                return { line: prepareQtLine('nexttime', g) };
            // Priest othertime is an unexercised multiline pline branch;
            // keep the control-flow boundary explicit until that transcript
            // supplies its tty pagination contract.
            return null;
        }
        return null;
    }
    if (prototype.endsWith('-loca')) {
        if (status.killed_nemesis) return null;
        const fromAbove = (fromDepth?.dlevel ?? g.u.uz.dlevel)
            < (g.u?.uz?.dlevel ?? 0);
        if (!status.first_locate) {
            const delivery = fromAbove
                ? prepareQtDelivery('locate_first', g)
                : {};
            return {
                ...delivery,
                commit() { status.first_locate = true; },
            };
        }
        if (fromAbove)
            return { line: prepareQtLine('locate_next', g) };
    }
    if (prototype.endsWith('-goal')) {
        if (status.killed_nemesis) return null;
        if (!status.made_goal) {
            return {
                page: prepareQtPager('goal_first', g),
                commit() { status.made_goal = 1; },
            };
        }
        const messageId = levelContainsQuestArtifact(g)
            ? 'goal_next' : 'goal_alt';
        return {
            line: prepareQtLine(messageId, g),
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
export function prepareMainQuestPortalCall({ firstVisit = true } = {},
    g = game) {
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

    rn2(3);
    rn2(2);
    if (event.qcalled) {
        return [g.urole?.key === 'rogue'
            ? `You again sense ${g.urole?.leaderName || 'your leader'} demanding your attendance.`
            : `You again sense ${g.urole?.leaderName || 'your leader'} pleading for help.`];
    }

    event.qcalled = true;
    const leader = g.urole?.leaderName || 'your leader';
    const homebase = g.urole?.homebase || 'your quest home';
    return [
        `You receive a faint telepathic message from ${leader}:`,
        `Your help is urgently needed at ${homebase}!`,
        'Look for a ...ic transporter.',
        "You couldn't quite make out that last message.",
    ];
}

export async function displayPreparedQuestArrival(arrival, g = game) {
    if (!arrival) return false;
    if (arrival.page) await displayPreparedQtPager(arrival.page, g);
    else if (arrival.line) await pline(arrival.line);
    arrival.commit?.();
    return !!(arrival.page || arrival.line);
}

async function questMore(message, g = game) {
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
    return String.fromCharCode(key).toLowerCase();
}

function originalAlignment(g = game) {
    return g.u?.ualignbase?.[1] ?? g.u?.ualign?.type ?? 0;
}

function currentBaseAlignment(g = game) {
    return g.u?.ualignbase?.[0] ?? g.u?.ualign?.type ?? 0;
}

async function questPurity(talk, g = game) {
    const original = originalAlignment(g);
    if (g.flags?.debug && talk
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original
        && (g.u?.ualign?.record ?? 0) < MIN_QUEST_ALIGN) {
        await questMore(
            `You are currently ${g.u.ualign.record} and require ${MIN_QUEST_ALIGN}.--More--`,
            g,
        );
        if (await wizardAdjustAlignment(g) === 'y')
            g.u.ualign.record = MIN_QUEST_ALIGN;
    }
    if ((g.u?.ualign?.record ?? 0) >= MIN_QUEST_ALIGN
        && (g.u?.ualign?.type ?? 0) === original
        && currentBaseAlignment(g) === original) return 1;
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

// Ported source block: chat_with_leader()'s first-contact, capable, pure
// assignment path.  The durable state and dispatch seams are shared with the
// remaining rejection/completion branches, which stay explicit future work.
export async function chatWithQuestLeader(monster, {
    exerciseWisdom = null,
} = {}, g = game) {
    if (!isQuestLeader(monster, g)) return false;
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
