// end.js — End-of-game disclosure and terminal presentation.
// C refs: end.c disclose()/really_done(), insight.c, dungeon.c.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { flush_screen, pline } from './display.js';
import { showIdentifiedInventory } from './invent.js';
import { finalConductLines, showFinalAttributes } from './insight.js';
import { showDisclosureOverlay } from './windows.js';
import { MONSTER_DIFFICULTY } from './monster_data.js';
import { ATR_BOLD, NO_COLOR } from './terminal.js';
import { rn2 } from './rng.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import { rebasePrayerAfterLifeSaving } from './pray.js';
import { depth } from './hacklib.js';
import { recordGameLogEvent } from './gamelog.js';
import {
    ACCESSIBLE, DOOR, D_CLOSED, D_LOCKED, GRAVE, MM_NONAME, isok,
} from './const.js';
import { CORPSE } from './object_data.js';
import {
    bonesLevelExists, makemonAt, mksobj, place_object, saveBonesLevel,
    stack_object,
} from './mklev.js';

const AMULET_OF_LIFE_SAVING = 202;
export const SCORE_RECORD_STORAGE_KEY = 'teleport-contest:record:v1';

function isCurrentBranchLevel() {
    const here = game.u?.uz || { dnum: 0, dlevel: 1 };
    return (game.branches || []).some(branch =>
        (branch?.end1?.dnum === here.dnum
            && branch?.end1?.dlevel === here.dlevel)
        || (branch?.end2?.dnum === here.dnum
            && branch?.end2?.dlevel === here.dlevel));
}

// C ref: bones.c:can_make_bones().  The ordinary low-level death witness
// reaches the depth reservoir and rejects bones; creation and saving remain
// downstream of the returned boolean.  Keep the draw in the fatal caller so
// it precedes the death tty pager just as really_done() does.
export function probeCanMakeBones(random = rn2) {
    if (game.flags?.bones === false
        || game.level?.flags?.no_bones
        || game.level?.flags?.no_bones_level
        || game.u?.uswallow
        || game.discover) return false;
    // C bones.c:no_bones_level().  Level one may be a dungeon entrance, but
    // later local levels which are branch endpoints are multiway/terminal
    // junctions and cannot own a bones file.
    if ((game.u?.uz?.dlevel ?? 1) > 1 && isCurrentBranchLevel())
        return false;
    // A non-branch level containing a magic portal is ineligible.  Portal
    // trap type 21 is stable in NetHack's trap enum; branch endpoints are
    // derived from the initialized dungeon graph, matching Is_branchlev().
    if (game.level?.traps?.some(trap => trap.ttyp === 21)
        && !isCurrentBranchLevel()) return false;
    const dungeonDepth = depth(game.u?.uz);
    if (dungeonDepth <= 0) return false;
    const roll = random(1 + (dungeonDepth >> 2));
    return roll !== 0 || !!game.flags?.debug;
}

// C refs: end.c:really_done() and bones.c:savebones()/drop_upon_death().
// Disclosure has already finished before this owner is entered.  The named
// corpse and ghost use the ordinary constructors so identity, temporary
// corpse state, timeout, HP, and monster inventory initialization retain
// their source RNG ownership.
async function createOrdinaryBones() {
    if (!game._canMakeBones || bonesLevelExists()) return false;
    const x = game.u?.ux ?? 0;
    const y = game.u?.uy ?? 0;

    const corpse = mksobj(CORPSE, true, false);
    corpse.corpsenm = game.urace?.mnum ?? 260;
    corpse.name = `${game.plname || 'player'} corpse`;
    corpse.oname = game.plname || 'player';
    place_object(corpse, x, y);

    const deathSquare = game.level?.at?.(x, y);
    if (deathSquare) {
        deathSquare.typ = GRAVE;
        deathSquare.emptygrave = 1;
        deathSquare.graveText = `${game.plname || 'player'}, killed by ${
            game._deathKiller || 'an unknown cause'
        }`;
    }

    // The inventory array retains gi.invent head-to-tail order.  This
    // witness has no adjacent object-liking monster, so a successful
    // one-in-eight recipient gate still falls back to the death square.
    while ((game.inventory || []).length) {
        const object = game.inventory.shift();
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        if (rn2(5)) {
            object.blessed = false;
            object.cursed = true;
        }
        rn2(8);
        place_object(object, x, y);
    }

    game.in_mklev = true;
    let ghost;
    try {
        ghost = await makemonAt(287, x, y, MM_NONAME);
    } finally {
        game.in_mklev = false;
    }
    if (ghost) {
        ghost.name = game.plname || 'player';
        ghost.m_lev = game.u?.ulevel || 1;
        ghost.mhp = ghost.mhpmax = game.u?.uhpmax || 1;
        ghost.female = !!game.flags?.female;
        ghost.msleeping = 1;
        corpse.attachedMid = ghost.m_id;
    }
    game._bonesSaved = saveBonesLevel();
    return game._bonesSaved;
}

// C refs: end.c done()/savelife() and o_init.c makeknown().  The fatal-hit
// caller owns tty suspension, but end.c owns the two state commits on either
// side of that pager: identification before it and consumption/revival after.
export function beginHeroLifeSaving(random = rn2) {
    const amulet = game.uamul || game.u?.uamul;
    if (amulet?.otyp !== AMULET_OF_LIFE_SAVING) return null;

    game.u.umortality = (game.u.umortality || 0) + 1;
    if (!game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING)) {
        recordObjectKnowledge(AMULET_OF_LIFE_SAVING);
        const wisdom = game.u?.acurr?.a?.[4] ?? 10;
        const amount = random(19) > wisdom ? 1 : 0;
        if (!Array.isArray(game.u._exercise))
            game.u._exercise = Array(6).fill(0);
        game.u._exercise[4] += amount;
    }
    return { amulet };
}

export function completeHeroLifeSaving(transaction) {
    const amulet = transaction?.amulet;
    if (!amulet) return false;

    game.inventory = (game.inventory || []).filter(item => item !== amulet);
    if (game.uamul === amulet) game.uamul = null;
    if (game.u?.uamul === amulet) game.u.uamul = null;
    amulet.worn = false;
    amulet.wornSlot = null;

    const attributes = game.u?.acurr?.a;
    if (attributes) attributes[2] = Math.max(3, (attributes[2] ?? 3) - 1);
    if (!Array.isArray(game.u._exercise)) game.u._exercise = Array(6).fill(0);
    game.u._exercise[2] = 0;

    const constitution = attributes?.[2] ?? 3;
    const giveHp = 50 + 10 * Math.trunc(constitution / 2);
    game.u.uhp = Math.min(game.u.uhpmax ?? giveHp, giveHp);
    if ((game.u.uhunger ?? 900) < 500) game.u.uhunger = 900;
    game.context.move = 0;
    game._helplessTurns = 1;
    game._helplessReason = 'attempting to cheat Death';
    game._helplessDoneMessage = '';
    rebasePrayerAfterLifeSaving(game);
    game._lifeSavedCount = (game._lifeSavedCount || 0) + 1;
    return true;
}

// C ref: end.c:savelife().  Wizard/explore refusal and amulet life saving
// share this viability repair after their distinct prompt/item transactions.
export function restoreHeroAfterDeath() {
    const constitution = game.u?.acurr?.a?.[2] ?? 3;
    const giveHp = 50 + 10 * Math.trunc(constitution / 2);
    game.u.uhp = Math.min(game.u.uhpmax ?? giveHp, giveHp);
    if ((game.u.uhunger ?? 900) < 500) game.u.uhunger = 900;
    game.context.move = 0;
    // end.c:savelife() replaces any earlier negative multi (including a
    // monster paralysis spell) with exactly -1.  The interrupted actor can
    // finish its remaining attack slots, but no older helpless interval may
    // allocate another autonomous monster turn afterward.  Its visible
    // nomovemsg is projected by allmain's debug-death continuation.
    game._helplessTurns = 1;
    game._helplessReason = 'attempting to cheat Death';
    game._helplessDoneMessage = '';
    rebasePrayerAfterLifeSaving(game);
    return game.u.uhp;
}

function conductState(state = game) {
    if (!state.u.uconduct) state.u.uconduct = {};
    return state.u.uconduct;
}

// xkilled() breaks killer conduct before its credited kill pline can suspend
// on an older tty message.  Vanquished/mvitals bookkeeping happens later,
// after mondead(), so keep this mutation independently callable.
export function recordHeroKillConduct(state = game) {
    const conduct = conductState(state);
    const firstKill = !(conduct.killer || 0);
    conduct.killer = (conduct.killer || 0) + 1;
    if (firstKill)
        recordGameLogEvent('killed for the first time', { state });
}

// C xkilled()/monkilled() both update mvitals[].died; only hero kills break
// killer conduct.  Weapon-hit conduct is owned earlier by hitum(), for every
// effective wielded hit whether or not that hit kills.
export function recordVanquished(monster, name, {
    byHero = false, weaponHit = false, state = game,
} = {}) {
    if (!state._vanquishedCounts) state._vanquishedCounts = new Map();
    const mnum = monster?.mnum ?? -1;
    const prior = state._vanquishedCounts.get(mnum) || {
        mnum, name: name || 'monster', count: 0,
        difficulty: MONSTER_DIFFICULTY[mnum] ?? 0,
    };
    prior.count++;
    state._vanquishedCounts.set(mnum, prior);
    if (byHero) {
        recordHeroKillConduct(state);
        void weaponHit;
    }
}

async function promptDeathQuestion(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length + 1, 0);
    return String.fromCharCode(await nhgetch()).toLowerCase();
}

export function vanquishedLines() {
    const entries = [...(game._vanquishedCounts?.values() || [])]
        .sort((a, b) => b.difficulty - a.difficulty || a.mnum - b.mnum);
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const lines = ['Vanquished creatures:', ''];
    for (const entry of entries) {
        if (entry.count === 1) {
            const article = /^[aeiou]/i.test(entry.name) ? 'an' : 'a';
            lines.push(`  ${article} ${entry.name}`);
        } else {
            lines.push(`${String(entry.count).padStart(3)} ${entry.name}s`);
        }
    }
    if (entries.length > 1) lines.push('');
    if (entries.length > 1)
        lines.push(`${total} creatures vanquished.`);
    return lines;
}

function visitedMainDungeonLevels() {
    const levels = new Set();
    if ((game.u?.uz?.dnum ?? 0) === 0) levels.add(game.u.uz.dlevel || 1);
    for (const key of game._levelCache?.keys?.() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        if (dnum === 0 && Number.isInteger(dlevel)) levels.add(dlevel);
    }
    return [...levels].sort((a, b) => a - b);
}

function overviewLines(killer, deathVerb = 'killed') {
    if (game._tutorialActive) {
        return [
            'The Dungeons of Doom:',
            '   Level 1:',
            'The Tutorial:',
            '   Level 1: <- You were here.',
            '      Final resting place for',
            `         you, ${deathVerb} by ${killer}.`,
        ];
    }
    const levels = visitedMainDungeonLevels();
    const first = levels[0] || 1;
    const last = levels.at(-1) || first;
    const range = first === last ? `level ${first}` : `levels ${first} to ${last}`;
    const lines = [`The Dungeons of Doom: ${range}`];
    for (const level of levels) {
        const current = (game.u?.uz?.dnum ?? 0) === 0
            && (game.u?.uz?.dlevel ?? 1) === level;
        lines.push(`   Level ${level}:${current ? ' <- You were here.' : ''}`);
        if (current) {
            lines.push('      Final resting place for');
            lines.push(`         you, killed by a ${killer}.`);
        }
    }
    return lines;
}

function containedGold(objects) {
    let total = 0;
    for (const object of objects || []) {
        if (object.otyp === 449)
            total += object.quan ?? object.quantity ?? 0;
        total += containedGold(object.contents);
    }
    return total;
}

function sourceMove() {
    return game._statusTurnOverride ?? game._maintenanceMove
        ?? game.moves ?? 1;
}

// C ref: dungeon.c:deepest_lev_reached(FALSE).  The JS cache is the
// persistent record of visited floors; project every dungeon-local cache key
// through depth() before comparing it with the current floor.
function deepestVisitedDepth() {
    let deepest = depth(game.u?.uz);
    for (const key of game._levelCache?.keys?.() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        if (!Number.isInteger(dnum) || !Number.isInteger(dlevel)) continue;
        deepest = Math.max(deepest, depth({ dnum, dlevel }));
    }
    return deepest;
}

function deathSummaryValues() {
    const visibleGold = game._goldCount || 0;
    const gold = visibleGold + containedGold(game.inventory);
    const initialGold = game._initialGoldCount || 0;
    const gain = Math.max(0, gold - initialGold);
    const currentDepth = depth(game.u?.uz);
    const deepest = deepestVisitedDepth();
    let depthBonus = 50 * (deepest - 1);
    if (deepest > 20)
        depthBonus += 1000 * (deepest > 30 ? 10 : deepest - 20);
    const score = (game.u?.urexp || 0) + gain - Math.trunc(gain / 10)
        + depthBonus;
    return { gold, score, depth: currentDepth, moves: sourceMove() };
}

function terminalLine(row, col, value, attr = 0) {
    const display = game.nhDisplay;
    for (let index = 0; index < value.length; index++)
        display?.setCell(col + index, row, value[index], NO_COLOR, attr);
}

function tombstoneLine(value) {
    const text = String(value).slice(0, 16);
    const col = 28 - Math.trunc((text.length + 1) / 2);
    return `${' '.repeat(col - 19)}${text}${' '.repeat(37 - col - text.length)}`;
}

function currentDungeonName() {
    const dnum = game.u?.uz?.dnum ?? 0;
    return game.dungeons?.[dnum]?.dname
        || game.dungeons?.[0]?.dname
        || 'The Dungeons of Doom';
}

// C end.c:genl_outrip().  The stone receives up to four cause rows, each at
// most sixteen characters, split backward at a word boundary when possible.
function tombstoneDeathRows(cause) {
    let remaining = String(cause || '');
    const rows = [];
    for (let row = 0; row < 4; row++) {
        if (!remaining) {
            rows.push('');
            continue;
        }
        let count = remaining.length;
        if (count > 16) {
            count = 16;
            while (count > 0 && remaining[count] !== ' ') count--;
            if (count === 0) count = 16;
        }
        rows.push(remaining.slice(0, count));
        remaining = remaining[count] === ' '
            ? remaining.slice(count + 1) : remaining.slice(count);
    }
    return rows;
}

function renderDeathSummaryPage(killer, { gold, score, depth, moves }, {
    deathVerb = 'died',
} = {}) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = false;
    const name = game.plname || 'player';
    const year = String(game.datetime || '').slice(0, 4) || '2026';
    const role = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const goodbye = game.urole?.goodbye || 'Goodbye';
    const deathDungeon = game._tutorialActive
        ? 'The Tutorial' : currentDungeonName();
    const causeRows = tombstoneDeathRows(
        deathCauseRecord(killer, deathVerb),
    );
    const lines = [
        [1, 23, '----------'],
        [2, 22, '/          \\'],
        [3, 21, '/    REST    \\'],
        [4, 20, '/      IN      \\'],
        [5, 19, '/     PEACE      \\'],
        [6, 18, '/                  \\'],
        [7, 18, `|${tombstoneLine(name)}|`],
        [8, 18, `|${tombstoneLine(`${gold} Au`)}|`],
        [9, 18, `|${tombstoneLine(causeRows[0])}|`],
        [10, 18, `|${tombstoneLine(causeRows[1])}|`],
        [11, 18, `|${tombstoneLine(causeRows[2])}|`],
        [12, 18, `|${tombstoneLine(causeRows[3])}|`],
        [13, 18, `|       ${year}       |`],
        [14, 17, '*|     *  *  *      | *'],
        [15, 8, '_________)/\\\\_//(\\/( /\\)/\\//\\/|_)_______'.replace('( /', '(/')],
        [18, 0, `${goodbye} ${name} the ${role}...`],
        [20, 0, `You ${deathVerb} in ${deathDungeon} on dungeon level ${depth} with ${score} points,`],
        [21, 0, `and ${gold} pieces of gold, after ${moves} moves.`],
        [22, 0, `You were level ${game.u?.ulevel || 1} with a maximum of ${game.u?.uhpmax || 1} hit points when you ${deathVerb}.`],
        [23, 0, '--More--'],
    ];
    for (const [row, col, value] of lines) terminalLine(row, col, value);
    display?.setCursor(8, 23);
}

function roleGoodbye() {
    if (game.urole?.goodbye) return game.urole.goodbye;
    return {
        knight: 'Fare thee well',
        samurai: 'Sayonara',
        tourist: 'Aloha',
        valkyrie: 'Farvel',
    }[game.urole?.key] || 'Goodbye';
}

function roleName() {
    return game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
}

function renderQuitSummaryPage({ gold, score, depth, moves }) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = false;
    terminalLine(
        0, 0,
        `${roleGoodbye()} ${game.plname || 'player'} the ${roleName()}...`,
    );
    terminalLine(
        2, 0,
        `You quit in ${currentDungeonName()} on dungeon level ${
            depth} with ${score} points,`,
    );
    terminalLine(3, 0, `and ${gold} pieces of gold, after ${moves} moves.`);
    terminalLine(
        4, 0,
        `You were level ${game.u?.ulevel || 1} with a maximum of ${
            game.u?.uhpmax || 1} hit points when you quit.`,
    );
    terminalLine(23, 0, '--More--');
    display?.setCursor(8, 23);
}

function renderBlankDeathMore() {
    game.nhDisplay?.clearScreen();
    terminalLine(23, 0, '--More--');
    game.nhDisplay?.setCursor(8, 23);
}

function renderWizardScoreNotice() {
    game.nhDisplay?.clearScreen();
    terminalLine(
        1, 0,
        'Since you were in wizard mode, the score list will not be checked.',
    );
    game.nhDisplay?.setCursor(0, 2);
}

function renderTutorialScoreEntry(killer) {
    const display = game.nhDisplay;
    display?.clearScreen();
    terminalLine(1, 1, 'No  Points     Name                                                   Hp [max]');
    const role = game.urole?.key === 'ranger' ? 'Ran' : 'Adv';
    const race = game.urace?.adj === 'elven' ? 'Elf' : 'Hum';
    const gender = game.flags?.female ? 'Fem' : 'Mal';
    const align = (game.u?.ualign?.type || 0) < 0 ? 'Cha'
        : (game.u?.ualign?.type || 0) > 0 ? 'Law' : 'Neu';
    terminalLine(
        2, 13,
        `0  ${game.plname}-${role}-${race}-${gender}-${align} died in The Tutorial on level`,
        ATR_BOLD,
    );
    terminalLine(3, 16, `1.  Burned by ${killer}.`, ATR_BOLD);
    terminalLine(3, 72, '-', ATR_BOLD);
    terminalLine(3, 75, `[${game.u?.uhpmax || 1}]`, ATR_BOLD);
    display?.setCursor(0, 4);
}

function shortRoleName() {
    const codes = {
        archeologist: 'Arc', barbarian: 'Bar', caveman: 'Cav',
        healer: 'Hea', knight: 'Kni', monk: 'Mon', priest: 'Pri',
        ranger: 'Ran', rogue: 'Rog', samurai: 'Sam', tourist: 'Tou',
        valkyrie: 'Val', wizard: 'Wiz',
    };
    return codes[game.urole?.key] || 'Adv';
}

function shortRaceName() {
    const race = String(game.urace?.adj || game.urace?.noun || 'human')
        .toLowerCase();
    if (race.startsWith('elf') || race.startsWith('elv')) return 'Elf';
    if (race.startsWith('dwar')) return 'Dwa';
    if (race.startsWith('gnom')) return 'Gno';
    if (race.startsWith('orc')) return 'Orc';
    return 'Hum';
}

function scoreStorageGet(key) {
    const storage = game.storage;
    try {
        if (typeof storage?.getItem === 'function')
            return storage.getItem(key);
        if (typeof storage?.get === 'function')
            return storage.get(key) ?? null;
    } catch {
        return null;
    }
    return null;
}

function scoreStorageSet(key, value) {
    const storage = game.storage;
    try {
        if (typeof storage?.setItem === 'function') {
            storage.setItem(key, value);
            return true;
        }
        if (typeof storage?.set === 'function') {
            storage.set(key, value);
            return true;
        }
    } catch {
        return false;
    }
    return false;
}

function validScoreRecord(record) {
    return record && Number.isFinite(record.points)
        && Number.isInteger(record.deathlev)
        && Number.isInteger(record.maxlvl)
        && Number.isFinite(record.hp)
        && Number.isFinite(record.maxhp)
        && typeof record.name === 'string'
        && typeof record.role === 'string'
        && typeof record.race === 'string'
        && typeof record.gender === 'string'
        && typeof record.align === 'string'
        && typeof record.dungeon === 'string'
        && typeof record.outcome === 'string'
        && typeof record.death === 'string';
}

function loadScoreRecords() {
    const raw = scoreStorageGet(SCORE_RECORD_STORAGE_KEY);
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter(validScoreRecord).slice(0, 100)
            : [];
    } catch {
        return [];
    }
}

function saveScoreRecords(records) {
    scoreStorageSet(SCORE_RECORD_STORAGE_KEY, JSON.stringify(records));
}

function scoreIdentity() {
    const gender = game.flags?.female ? 'Fem' : 'Mal';
    const align = (game.u?.ualign?.type || 0) < 0 ? 'Cha'
        : (game.u?.ualign?.type || 0) > 0 ? 'Law' : 'Neu';
    return {
        name: String(game.plname || 'player').slice(0, 10),
        role: shortRoleName(),
        race: shortRaceName(),
        gender,
        align,
    };
}

function deathCauseRecord(killer, deathVerb = 'died') {
    const raw = String(killer || 'unknown cause');
    if (deathVerb !== 'died') return `${deathVerb} by ${raw}`;
    if (/^(?:an?|the) /i.test(raw)
        || /^(?:Mr|Mrs|Ms|Miss|Sir|Lady|Lord)\.?\s/.test(raw))
        return `killed by ${raw}`;
    const article = /^[aeiou]/i.test(raw) ? 'an' : 'a';
    return `killed by ${article} ${raw}`;
}

function currentScoreRecord(summary, {
    outcome = 'died', killer = '', deathVerb = 'died',
} = {}) {
    return {
        points: summary.score,
        deathdnum: game.u?.uz?.dnum ?? 0,
        deathlev: summary.depth,
        maxlvl: deepestVisitedDepth(),
        hp: game.u?.uhp ?? 0,
        maxhp: game.u?.uhpmax ?? 1,
        ...scoreIdentity(),
        dungeon: currentDungeonName(),
        outcome,
        death: outcome === 'quit' ? 'quit'
            : deathCauseRecord(killer, deathVerb),
    };
}

function updateScoreRecord(current) {
    const prior = loadScoreRecords();
    if (current.points < 1) {
        return {
            records: prior,
            rank: prior.length + 1,
            inserted: false,
        };
    }

    const ordered = [...prior];
    const insertAt = ordered.findIndex(record =>
        record.points < current.points);
    ordered.splice(insertAt < 0 ? ordered.length : insertAt, 0, current);

    // The contest storage represents one native uid.  PERSMAX applies per
    // uid and role, so retain at most three entries for each role while
    // preserving score order, then enforce ENTRYMAX.
    const roleCounts = new Map();
    const records = [];
    for (const record of ordered) {
        const count = roleCounts.get(record.role) || 0;
        if (count >= 3) continue;
        roleCounts.set(record.role, count + 1);
        records.push(record);
        if (records.length >= 100) break;
    }
    const currentIndex = records.indexOf(current);
    if (currentIndex >= 0) saveScoreRecords(records);
    return {
        records,
        rank: currentIndex >= 0 ? currentIndex + 1 : records.length + 1,
        inserted: currentIndex >= 0,
    };
}

function capitalizeScoreCause(value) {
    const text = String(value || '');
    return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function scoreEntryText(record, rank) {
    const rankText = rank ? String(rank).padStart(3) : '   ';
    const points = String(record.points || 0).padStart(10);
    let line = `${rankText} ${points}  ${record.name.slice(0, 10)}-${
        record.role}-${record.race}-${record.gender}-${record.align} `;
    if (record.outcome === 'quit') {
        line += `quit in ${record.dungeon} on level ${record.deathlev}`;
        if (record.deathlev !== record.maxlvl)
            line += ` [max ${record.maxlvl}]`;
        return `${line}.`;
    }

    line += `died in ${record.dungeon} on level ${record.deathlev}`;
    if (record.deathlev !== record.maxlvl)
        line += ` [max ${record.maxlvl}]`;
    line += `.  ${capitalizeScoreCause(record.death)
        .replace('; the ', ', the ')}.`;
    return line;
}

function wrappedScoreEntryLines(record, rank, bold) {
    const wrapColumn = 70;
    const hp = record.hp <= 0 ? '-' : String(record.hp);
    let line = scoreEntryText(record, rank);
    const lines = [];
    while (line.length >= wrapColumn) {
        let split = Math.min(line.length, wrapColumn);
        while (split > 0 && !(line[split] === ' ' && split < wrapColumn))
            split--;
        if (split <= 15) split = wrapColumn - 1;
        if (split > 5 && line.slice(split - 5, split) === ' [max')
            split -= 5;
        const remainder = line[split] === ' '
            ? line.slice(split + 1) : line.slice(split);
        let emitted = line.slice(0, split);
        if (bold) emitted = emitted.padEnd(79);
        lines.push(emitted);
        line = `${' '.repeat(16)}${remainder}`;
    }

    const hpColumn = 80 - 7 - hp.length;
    if (line.length <= hpColumn) {
        line = line.padEnd(hpColumn) + hp
            + ` ${record.maxhp < 10 ? '  '
                : record.maxhp < 100 ? ' ' : ''}[${record.maxhp}]`;
    }
    if (bold) line = line.padEnd(79);
    lines.push(line);
    return lines;
}

function renderScoreList(current, update) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = true;
    let row = 1;
    if (update.inserted) {
        terminalLine(
            row++, 0,
            update.rank <= 10
                ? 'You made the top ten list!'
                : `You reached the ${update.rank} place on the top 100 list.`,
        );
        row++;
    }
    terminalLine(
        row++, 0,
        ' No  Points     Name                                                   Hp [max]',
    );

    const top = 3;
    const around = 2;
    const aroundStart = update.rank - around;
    for (let index = 0; index < update.records.length; index++) {
        const rank = index + 1;
        if (!(rank <= top
            || (rank >= aroundStart && rank <= update.rank + around)))
            continue;
        if (rank === aroundStart
            && update.rank > top + around + 1)
            row++;
        const record = update.records[index];
        const bold = record === current;
        for (const line of wrappedScoreEntryLines(record, rank, bold))
            terminalLine(row++, 0, line, bold ? ATR_BOLD : 0);
    }
    if (!update.inserted) {
        for (const line of wrappedScoreEntryLines(current, 0, true))
            terminalLine(row++, 0, line, ATR_BOLD);
    }
    display?.setCursor(0, row);
}

async function waitForCurrentMore() {
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}

function disclosureSetting(code) {
    const raw = String(game.flags?.disclose || '');
    if (!raw) return null;
    const token = raw.split(/\s+/).find(candidate =>
        candidate.toLowerCase().endsWith(code));
    if (!token) return null;
    const prefix = token.slice(0, -1);
    return prefix ? prefix.at(-1).toLowerCase() : '+';
}

async function disclosureAnswer(code, message) {
    const setting = disclosureSetting(code);
    if (setting === '-') return 'n';
    if (setting === '+' || setting === '#')
        return setting === '#' && (code === 'v' || code === 'g') ? 'a' : 'y';
    return promptDeathQuestion(message);
}

// C ref: end.c:done_object_cleanup().  A fatal projectile can still be in
// OBJ_FREE limbo because losehp() enters really_done() before m_throw()
// returns.  Recover it before disclosure and bones creation, using the last
// retained hero command vector just as native does.
function doneObjectCleanup() {
    const object = game._thrownObject;
    if (!object || object.where !== 'free') {
        if (object) game._thrownObject = null;
        return;
    }

    const ux = game.u?.ux ?? 0;
    const uy = game.u?.uy ?? 0;
    let ox = ux + (game.u?.dx ?? 0);
    let oy = uy + (game.u?.dy ?? 0);
    const location = game.level?.at?.(ox, oy);
    const closedDoor = location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_LOCKED | D_CLOSED));
    if (!isok(ox, oy) || !location
        || !ACCESSIBLE(location.typ) || closedDoor) {
        ox = ux;
        oy = uy;
    }

    place_object(object, ox, oy);
    stack_object(object);
    game._thrownObject = null;
}

// The caller owns the fatal combat/RNG transaction and has already displayed
// the death line.  It may pass an explicit inventory answer for older callers;
// otherwise this function applies flags.end_disclose policy before owning the
// remaining windows and really_done()'s tombstone/score tail.  It deliberately
// performs no random calls.
export async function finishOrdinaryDeath({
    killer, possessionAnswer = null, deathVerb = 'died',
}) {
    game.program_state.gameover = true;
    game._deathKiller = killer;
    doneObjectCleanup();

    if (possessionAnswer === null) {
        possessionAnswer = await disclosureAnswer(
            'i', 'Do you want your possessions identified? [ynq] (n)',
        );
    }
    if (possessionAnswer === 'y') await showIdentifiedInventory();
    if (possessionAnswer === 'q') return;

    const attributes = await disclosureAnswer(
        'a',
        'Do you want to see your attributes? [ynq] (n)',
    );
    if (attributes === 'y') await showFinalAttributes();
    if (attributes === 'q') return;

    if (game._vanquishedCounts?.size) {
        const vanquished = await disclosureAnswer(
            'v',
            'Do you want an account of creatures vanquished? [ynaq] (n)',
        );
        if (vanquished === 'y' || vanquished === 'a')
            await showDisclosureOverlay(vanquishedLines());
        if (vanquished === 'q') return;
    }

    const conduct = await disclosureAnswer(
        'c',
        'Do you want to see your conduct? [ynq] (n)',
    );
    if (conduct === 'y')
        await showDisclosureOverlay(finalConductLines());
    if (conduct === 'q') return;

    const overview = await disclosureAnswer(
        'o',
        'Do you want to see the dungeon overview? [ynq] (n)',
    );
    if (overview === 'y') {
        await showDisclosureOverlay(overviewLines(killer, deathVerb), {
            marker: '(end)', minWidth: game._tutorialActive ? 38 : 39,
        });
    }
    if (overview === 'q') return;

    await createOrdinaryBones();

    const summary = deathSummaryValues();
    renderDeathSummaryPage(killer, summary, { deathVerb });
    await waitForCurrentMore();
    renderBlankDeathMore();
    await waitForCurrentMore();
    if (game._tutorialActive) renderTutorialScoreEntry(killer);
    else if (game.flags?.debug) renderWizardScoreNotice();
    else {
        const current = currentScoreRecord(summary, {
            killer, deathVerb,
        });
        renderScoreList(current, updateScoreRecord(current));
    }
    game.context.move = 0;
}

// C refs: end.c doquit()/done(QUIT)/really_done().  QUIT skips the tombstone,
// but otherwise owns disclosures, a role-aware summary text window, and the
// score-list handoff as one terminal transaction.
export async function finishOrdinaryQuit() {
    game.program_state.gameover = true;

    const possessionAnswer = await disclosureAnswer(
        'i', 'Do you want your possessions identified? [ynq] (n)',
    );
    if (possessionAnswer === 'y') await showIdentifiedInventory();
    if (possessionAnswer === 'q') return;

    const attributes = await disclosureAnswer(
        'a', 'Do you want to see your attributes? [ynq] (n)',
    );
    if (attributes === 'y') await showFinalAttributes();
    if (attributes === 'q') return;

    if (game._vanquishedCounts?.size) {
        const vanquished = await disclosureAnswer(
            'v',
            'Do you want an account of creatures vanquished? [ynaq] (n)',
        );
        if (vanquished === 'y' || vanquished === 'a')
            await showDisclosureOverlay(vanquishedLines());
        if (vanquished === 'q') return;
    }

    const conduct = await disclosureAnswer(
        'c', 'Do you want to see your conduct? [ynq] (n)',
    );
    if (conduct === 'y') await showDisclosureOverlay(finalConductLines());
    if (conduct === 'q') return;

    const overview = await disclosureAnswer(
        'o', 'Do you want to see the dungeon overview? [ynq] (n)',
    );
    if (overview === 'y') {
        await showDisclosureOverlay(overviewLines('', 'quit'), {
            marker: '(end)', minWidth: 39,
        });
    }
    if (overview === 'q') return;

    const summary = deathSummaryValues();
    renderQuitSummaryPage(summary);
    await waitForCurrentMore();
    const current = currentScoreRecord(summary, { outcome: 'quit' });
    renderScoreList(current, updateScoreRecord(current));
    game.context.move = 0;
}
