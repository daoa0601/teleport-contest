// end.js — End-of-game disclosure and terminal presentation.
// C refs: end.c disclose()/really_done(), insight.c, dungeon.c.
import { goodbye } from './role.js';
import { AMULET_CLASS, GEM_CLASS } from './objclass.js';
import { OBJ_NAME } from './object_data.js';
import { objectClassForType, objectBaseCost, AMULET_OF_LIFE_SAVING, BAG_OF_TRICKS, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, FAKE_AMULET_OF_YENDOR, JADE, OBJECT_NAMES, SPE_BOOK_OF_THE_DEAD, STATUE, } from './object_data.js';
import { formatFeltMessage } from './hero_speech.js';
import { recorderLocalEpochSeconds, recorderLocalHour } from './calendar.js';
import { adjustAttribute, currentAttribute } from './attrib.js';
import { encumber_msg } from './pickup.js';
import { cureHeroSickness } from './potion.js';
import { removeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { endmultishot } from './dothrow.js';
import { BUFSZ, MGIVENNAME, M_AP_MONSTER, M_AP_TYPE, PARANOID_DIE, PARANOID_QUIT, PLNMSG_OK_DONT_DIE, ismnum, A_CON, A_WIS, ACH_BLND, ACH_NUDE, ACH_UWIN, ASCENDED, BURNING, CHOKING, DIED, ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD, ESCAPED, GENOCIDED, PANICKED, QUIT, STARVING, STONING, TRICKED, In_endgame, In_quest, Is_astralevel, Is_knox_level, KILLED_BY, KILLED_BY_AN, NO_KILLER_PREFIX, TT_LAVA, Upolyd } from './const.js';
import { isok, setMulti, paranoidQuery } from './cmd.js';
import { PanicTermination } from './panic_termination.js';
import { endVoluntaryMultiTurn, heroGoldAmount } from './hack.js';
import { achievementEntries, recordAchievement, finalConductLines, listGenocided, setVanqOrder, showFinalAttributes, vanquishedLines, vanquishedTypeCount, } from './insight.js';
import { game, requireInitializedGame } from './gstate.js';
import { releaseHeroFromMonster } from './mon.js';
import { heroFormSticks } from './polyself.js';
import { monsterName } from './do_name.js';
import { scheduleLevelChange } from './do.js';
import { nhgetch } from './input.js';
import { bot } from './botl.js';
import { canSpotMonster, flush_screen } from './display.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline, resetToplineClip } from './tty_topline.js';
import { vision_recalc } from './vision.js';
import { shopkeeperKillerName, finishShopkeeperRepossession, settleShopkeepersOnExit, deleteObject } from './shk.js';
import { plineWithContinuation } from './pline.js';
import { consumeInventoryItem, identifyObjectForDisclosure, showIdentifiedInventory, lootSortMode, sortObjects, currency, stack_object } from './invent.js';
import { showDisclosureOverlay, showTextPages, showTextWindow } from './windows.js';
import { artifactById } from './artifact.js';
import { MONSTER_GENO, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { NO_COLOR } from './terminal.js';
import { d, rn2 } from './rng.js';
import { mksobj, isContainer, placeObjectSynchronously } from './mkobj.js';
import { makePlural, withIndefiniteArticle, objectDescription, definiteName, objectName, simpleObjectName, observeObjectForNaming } from './objnam.js';
import { recordObjectEncounter, recordObjectKnowledge } from './o_init.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { deepestLevelReached, depth } from './dungeon.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { hiddenGold, payVaultGuardOnExit } from './vault.js';
import { init_uhunger } from './eat.js';
import { dungeonOverviewDisclosure } from './dungeon.js';
import { canMakeBones, createBonesFromDeath } from './bones.js';
import { force_launch_placement, launch_in_progress } from './trap.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { clearNonlocalPriestsOnExit } from './priest.js';
import { promptChoice, promptYesNo } from './query.js';
import { clearHeroRemains, setHeroRemainsFromDeath, setHeroRemainsFromMonster } from './death_remains.js';
import { finishInUseInventory } from './restore.js';
import { requireInitializedHero } from './hero_types.js';
import { collectLevelFollowers } from './dog.js';
import { adjustedMonsterLevel } from './makemon.js';
import { restoreBallAndChainPlacement } from './ball.js';
import { isAccessibleAt } from './monmove.js';
import { resetUtrap } from './trap.js';
import { DTHSZ, KILLED_BY_PREFIXES, formatKiller, loadScoreRecords, saveScoreRecords, scoreListLines } from './topten.js';
import { monsterHasProperName } from './mondata.js';
import { expelHero } from './mhitu.js';
// C end.c:done() records the fatal event before "But wait...". The caller
// identifies the amulet after that message returns, then consumes it and
// revives the hero after the crumble message.
export function beginHeroLifeSaving() {
    const amulet = game.uamul || game.u?.uamul;
    if (amulet?.otyp !== AMULET_OF_LIFE_SAVING)
        return null;
    recordHeroFatalEvent();
    return { amulet };
}
function recordHeroFatalEvent() {
    game.u.umortality = (game.u.umortality || 0) + 1;
    if (game.u.uhp !== 0 || (Upolyd(game.u) && game.u.mh !== 0)) {
        game.u.uhp = 0;
        game.u.mh = 0;
        game.context.botl = true;
    }
}
export function identifyLifeSavingAmulet(random = rn2) {
    recordObjectEncounter(AMULET_OF_LIFE_SAVING);
    if (!game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING)) {
        recordObjectKnowledge(AMULET_OF_LIFE_SAVING);
        if (!game.u._exercise)
            game.u._exercise = [0, 0, 0, 0, 0, 0];
        if (Math.abs(game.u._exercise[A_WIS]) < 50)
            game.u._exercise[A_WIS] += random(19) > currentAttribute(A_WIS) ? 1 : 0;
    }
}
export async function completeHeroLifeSaving(transaction, { deathType = null } = {}) {
    const amulet = transaction?.amulet;
    if (!amulet)
        return false;
    await consumeInventoryItem(amulet, game);
    const change = adjustAttribute(A_CON, -1);
    if (change.changed && game.program_state.in_moveloop)
        await encumber_msg();
    await restoreHeroAfterDeath({ deathType });
    if (game.program_state.gameover)
        return false;
    if (deathType === GENOCIDED)
        return false;
    game._lifeSavedCount = (game._lifeSavedCount || 0) + 1;
    return true;
}
// C ref: end.c:savelife().  Wizard/explore refusal and amulet life saving
// share this viability repair after their distinct prompt/item transactions.
export async function restoreHeroAfterDeath({ deathType = null } = {}) {
    requireInitializedHero(game.u);
    const constitution = currentAttribute(A_CON);
    const giveHp = 50 + 10 * Math.trunc(constitution / 2);
    game.u.ulevel = Math.max(1, game.u.ulevel);
    game.u.uhpmax = Math.max(game.u.uhpmax, game.u.ulevel, 10);
    game.u.uhppeak = Math.max(game.u.uhppeak ?? 0, game.u.uhpmax);
    game.u.uhp = Math.min(game.u.uhpmax, giveHp);
    if (Upolyd(game.u))
        game.u.mh = Math.min(game.u.mhmax, giveHp);
    if ((game.u.uhunger ?? 900) < 500 || deathType === CHOKING)
        await init_uhunger(game, plineWithContinuation);
    if (game.u.sickTurns === 1)
        cureHeroSickness();
    game.context.move = 0;
    // end.c:savelife() replaces any earlier negative multi (including a
    // monster paralysis spell) with exactly -1.  The interrupted actor can
    // finish its remaining attack slots, but no older helpless interval may
    // allocate another autonomous monster turn afterward. The shared
    // helplessness recovery publishes nomovemsg when that turn ends.
    setMulti(-1);
    game._helplessReason = game.urole?.key === 'tourist'
        ? 'being toyed with by Fate' : 'attempting to cheat Death';
    game._helplessDoneMessage = 'You survived that attempt on your life.';
    if (game.u.utrap && game.u.utraptype === TT_LAVA)
        await resetUtrap(false);
    game.context.botl = true;
    clearHeroRemains(game);
    setPropertyTimeout('unchanging', 0);
    removeIntrinsicProperty('unchanging');
    await flush_screen(1);
    // end.c:savelife() truncates any in-flight volley (endmultishot(FALSE)).
    await endmultishot(false);
    const holder = game.u.ustuck;
    if (game.u.uswallow) {
        if (!holder)
            throw new Error('Swallowed hero has no engulfing monster');
        await expelHero(holder);
    }
    else if (holder) {
        const heroHoldsMonster = heroFormSticks(game);
        const name = monsterName(holder, { capitalized: !heroHoldsMonster });
        await plineWithContinuation(heroHoldsMonster
            ? `You release ${name}.` : `${name} releases you.`);
        await releaseHeroFromMonster(holder);
    }
    return game.u.uhp;
}
export async function finishHeroDeath({ killer, killerFormat = KILLED_BY_AN, beforeFinalDeath = null, deathCause = null, deathVerb = 'died', deathLineShown = false, deathType = null, }) {
    const how = deathType ?? DIED;
    if (how === TRICKED && game.flags.debug) {
        delete game._deathKiller;
        return false;
    }
    if (how === QUIT) {
        await finishOrdinaryQuit();
        return true;
    }
    if (how === ESCAPED || how === ASCENDED) {
        await finishLivingGame(how === ESCAPED ? 'escaped' : 'ascended');
        return true;
    }
    // losehp() announces the fatal hit before done() changes mortality or
    // identifies a life-saving amulet. tty keeps this message on its own line.
    if (!deathLineShown && how < PANICKED) {
        await plineWithContinuation('You die...', { urgent: true });
    }
    // done() forces status while HP is still raw, then normalizes it for
    // recovery and disclosure. A later pline owns the next status update.
    if (how !== PANICKED && !game.program_state.panicking)
        await bot();
    if (how < PANICKED)
        recordHeroFatalEvent();
    const amulet = game.uamul || game.u?.uamul;
    if (how <= GENOCIDED && amulet?.otyp === AMULET_OF_LIFE_SAVING) {
        await plineWithContinuation('But wait...');
        identifyLifeSavingAmulet();
        await plineWithContinuation(`Your medallion ${heroIsBlind() ? 'feels warm' : 'begins to glow'}!`);
        if (deathType === CHOKING)
            await plineWithContinuation('You vomit ...');
        await plineWithContinuation(formatFeltMessage('much better!'));
        await plineWithContinuation('The medallion crumbles to dust!');
        await completeHeroLifeSaving({ amulet }, { deathType });
        if (game.program_state.gameover)
            return true;
        if (deathType === GENOCIDED) {
            await plineWithContinuation('Unfortunately you are still genocided...');
        }
        else {
            return false;
        }
    }
    if (how <= GENOCIDED && (game.flags?.debug || game.flags?.explore || game.discover)) {
        const answer = await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_DIE), 'Die?');
        if (!answer) {
            await plineWithContinuation(`OK, so you don't ${how === CHOKING ? 'choke' : 'die'}.`);
            game._lastPlineKind = PLNMSG_OK_DONT_DIE;
            await restoreHeroAfterDeath({ deathType });
            if (game.program_state.gameover)
                return true;
            return false;
        }
    }
    if (how !== PANICKED)
        await beforeFinalDeath?.();
    setHeroRemainsFromDeath(deathType, game);
    await finishOrdinaryDeath({ killer, killerFormat, deathCause, deathVerb, deathType });
    return true;
}
function conductState(state = game) {
    if (!state.u.uconduct)
        state.u.uconduct = {};
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
        recordGameLogEvent('killed for the first time', { state, flags: LL_CONDUCT });
}
// The final disclosure's overview lines, through dungeon.ts's
// dungeonOverviewDisclosure() (dungeon.c show_overview() with why > 0);
// only real deaths (final == 2) list the hero's own resting place.
function overviewLines(killer, deathVerb = 'killed', deathCause = null, ending = null) {
    const cause = deathCause || killerDeathCause(killer, deathVerb);
    return dungeonOverviewDisclosure(ending, cause);
}
function gameSummaryValues(outcome, deathType = DIED) {
    requireInitializedHero(game.u);
    const visibleGold = heroGoldAmount(game);
    const gold = visibleGold + hiddenGold(game, true);
    const initialGold = game._initialGoldCount || 0;
    const gain = Math.max(0, gold - initialGold);
    const currentDepth = depth(game.u?.uz);
    const deepest = deepestLevelReached();
    let depthBonus = 50 * (deepest - 1);
    if (deepest > 20)
        depthBonus += 1000 * (deepest > 30 ? 10 : deepest - 20);
    let score = (game.u?.urexp || 0) + gain + depthBonus;
    if (outcome === 'died' && deathType < PANICKED)
        score -= Math.trunc(gain / 10);
    const original = game.u.ualignbase?.[1] ?? game.u.ualign.type;
    const current = game.u.ualignbase?.[0] ?? game.u.ualign.type;
    if (outcome === 'ascended' && game.u.ualign.type === original)
        score += current === original ? score : Math.trunc(score / 2);
    return { gold, score, depth: currentDepth, moves: game.moves ?? 1 };
}
function terminalLine(row, col, value, attr = 0) {
    const display = game.nhDisplay;
    for (let index = 0; index < value.length; index++)
        display?.setCell(col + index, row, value.charAt(index), NO_COLOR, attr);
}
// C rip.c:center()
function tombstoneLine(value) {
    const text = String(value).slice(0, 16);
    const col = 28 - Math.trunc((text.length + 1) / 2);
    return `${' '.repeat(col - 19)}${text}${' '.repeat(37 - col - text.length)}`;
}
function tombstoneYear(when) {
    const year = Number(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric',
    }).format(new Date(when * 1000)));
    // C calendar.c:yyyymmdd() treats tm_year below 70 as a two-digit year.
    const calendarYear = year < 1970 ? year + 100 : year;
    return String(calendarYear % 10000).padStart(4, ' ');
}
function currentDungeonName() {
    const dnum = game.u?.uz?.dnum ?? 0;
    return game.dungeons?.[dnum]?.dname
        || game.dungeons?.[0]?.dname
        || 'The Dungeons of Doom';
}
// C end.c:ends[] describes the outcome, separately from killer attribution.
const ENDINGS = [
    'died', 'choked', 'were poisoned', 'starved', 'drowned', 'burned',
    'dissolved in the lava', 'were crushed', 'turned to stone',
    'turned into slime', 'were genocided', 'panicked', 'were tricked',
    'quit', 'escaped', 'ascended',
];
const DEATH_NAMES = [
    'died', 'choked', 'poisoned', 'starvation', 'drowning', 'burning',
    'dissolving under the heat and pressure', 'crushed', 'turned to stone',
    'turned into slime', 'genocided', 'panic', 'trickery', 'quit', 'escaped', 'ascended',
];
function finalLocationLine(verb, score) {
    const here = game.u.uz;
    let text;
    if (here?.dnum === 0 && here.dlevel <= 0) {
        text = `You ${here.dlevel < 0 ? 'passed away' : verb} beyond the confines of the dungeon`;
    }
    else {
        const where = Is_astralevel(here) ? 'The Astral Plane'
            : game._tutorialActive ? 'The Tutorial' : currentDungeonName();
        text = `You ${verb} in ${where}`;
        if (!In_endgame(here) && !Is_knox_level(here))
            text += ` on dungeon level ${In_quest(here) ? here?.dlevel : depth(here)}`;
    }
    return `${text} with ${score} point${plur(score)},`;
}
// C rip.c:genl_outrip().  The stone receives up to four cause rows, each at
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
            const space = remaining.lastIndexOf(' ', 16);
            // Native's backward scan reaches zero after a space at index
            // one, so that case hard-splits just like an unbroken word.
            count = space > 1 ? space : 16;
        }
        rows.push(remaining.slice(0, count));
        remaining = remaining[count] === ' '
            ? remaining.slice(count + 1) : remaining.slice(count);
    }
    return rows;
}
function deathSummaryLines(killer, { gold, score, moves }, endtime, { deathVerb = 'died', deathCause = null, deathType = null, } = {}) {
    const name = game.plname || 'player';
    const year = tombstoneYear(endtime);
    const role = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const goodbye = game.urole?.goodbye || 'Goodbye';
    const stoneGold = Math.min(999_999_999, Math.max(0, gold));
    const causeRows = tombstoneDeathRows(
    // C rip.c:113 formats the stone with formatkiller(buf, BUFSZ, how,
    // FALSE): sanitized and bounded, never the helplessness suffix.
    formatKiller(deathCause || killerDeathCause(killer, deathVerb), BUFSZ, false));
    const stone = [
        [23, '----------'],
        [22, '/          \\'],
        [21, '/    REST    \\'],
        [20, '/      IN      \\'],
        [19, '/     PEACE      \\'],
        [18, '/                  \\'],
        [18, `|${tombstoneLine(name)}|`],
        [18, `|${tombstoneLine(`${stoneGold} Au`)}|`],
        [18, `|${tombstoneLine(causeRows[0])}|`],
        [18, `|${tombstoneLine(causeRows[1])}|`],
        [18, `|${tombstoneLine(causeRows[2])}|`],
        [18, `|${tombstoneLine(causeRows[3])}|`],
        [18, `|       ${year}       |`],
        [17, '*|     *  *  *      | *'],
        [8, '_________)/\\\\_//(\\/( /\\)/\\//\\/|_)_______'.replace('( /', '(/')],
    ];
    const tombstone = game.flags.tombstone !== false
        && (deathType === null || deathType < GENOCIDED);
    return [
        ...(tombstone ? ['', ...stone.map(([col, text]) => ' '.repeat(col) + text), '', ''] : []),
        `${goodbye} ${name} the ${role}...`, '',
        finalLocationLine(deathVerb, score),
        `and ${gold} piece${plur(gold)} of gold, after ${moves} move${plur(moves)}.`,
        `You were level ${game.u?.ulevel || 1} with a maximum of ${game.u?.uhpmax || 1} hit point${plur(game.u?.uhpmax || 1)} when you ${deathVerb}.`,
        '',
    ];
}
// C hacklib.c plur(): the summary lines in end.c pluralize every count.
function plur(count) {
    return count === 1 ? '' : 's';
}
function roleName() {
    return game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
}
function renderQuitSummaryPage({ gold, score, moves }) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = false;
    terminalLine(0, 0, `${goodbye()} ${game.plname || 'player'} the ${roleName()}...`);
    terminalLine(2, 0, finalLocationLine('quit', score));
    terminalLine(3, 0, `and ${gold} piece${plur(gold)} of gold, after ${moves} move${plur(moves)}.`);
    terminalLine(4, 0, `You were level ${game.u?.ulevel || 1} with a maximum of ${game.u?.uhpmax || 1} hit point${plur(game.u?.uhpmax || 1)} when you quit.`);
    terminalLine(23, 0, '--More--');
    display?.setCursor(8, 23);
}
function scoreIdentity() {
    const state = requireInitializedGame();
    const gender = game.flags?.female ? 'Fem' : 'Mal';
    const align = (game.u?.ualign?.type || 0) < 0 ? 'Cha'
        : (game.u?.ualign?.type || 0) > 0 ? 'Law' : 'Neu';
    return {
        name: String(game.plname || 'player').slice(0, 10),
        role: state.urole.filecode,
        race: state.urace.filecode,
        gender,
        align,
    };
}
// C svk.killer.name/format (decl.c) are assigned by each fatal caller and
// expanded by topten.c:formatkiller() with killed_by_prefix[how] and an()
// for the KILLED_BY formats. The port composes that expansion once where
// the killer is assigned and threads the resulting cause string through
// the ending; topten.ts:formatKiller() owns the shared tail every C call
// site adds: sanitization, the caller's buffer bound and the
// incl_helpless suffix.
export function killerDeathCause(killer, deathVerb = 'died', deathType = null, killerFormat = KILLED_BY_AN) {
    const raw = String(killer || 'unknown cause');
    const prefix = deathType === null ? undefined : KILLED_BY_PREFIXES[deathType];
    if (killerFormat === NO_KILLER_PREFIX || prefix === '')
        return raw;
    if (prefix === undefined && deathVerb !== 'died')
        return `${deathVerb} by ${raw}`;
    const name = killerFormat === KILLED_BY ? raw : withIndefiniteArticle(raw);
    return `${prefix ?? 'killed by '}${name}`;
}
// The topten.c:topten() record phase — this game's entry (C lines 668-700),
// composed from the killer plumbing end.c's done() callers own. Stays in
// end.ts: moving it to topten.ts would need killerDeathCause(),
// scoreIdentity() and currentDungeonName() from here, an end.ts <->
// topten.ts import cycle.
function currentScoreRecord(summary, { outcome = 'died', killer = '', deathVerb = 'died', deathCause = null, deathType = null, } = {}) {
    let cause = deathCause || (outcome === 'quit' ? 'quit'
        : killerDeathCause(killer, deathVerb));
    if (game.u.uhave?.amulet) {
        cause += ' (with the Amulet)';
    }
    else if (outcome === 'escaped') {
        if (Is_astralevel(game.u.uz))
            cause += ' (in celestial disgrace)';
        else if (game.inventory.some(object => object.otyp === FAKE_AMULET_OF_YENDOR))
            cause += ' (with a fake Amulet)';
    }
    return {
        points: summary.score,
        deathdnum: game.u?.uz?.dnum ?? 0,
        deathlev: summary.depth,
        maxlvl: deepestLevelReached(true),
        hp: game.u?.uhp ?? 0,
        maxhp: game.u?.uhpmax ?? 1,
        ...scoreIdentity(),
        dungeon: currentDungeonName(),
        outcome,
        // C topten.c:694 formats the record's death field with
        // formatkiller(..., sizeof t0->death == DTHSZ + 1, TRUE).
        death: formatKiller(cause, DTHSZ + 1, true),
    };
}
// The topten.c:topten() record update — pointsmin, the insertion rank,
// PERSMAX per role and ENTRYMAX (C lines 756-816). Stays beside
// currentScoreRecord() for the same end.ts <-> topten.ts import cycle;
// the display half of topten() is topten.ts scoreListLines().
function updateScoreRecord(current) {
    const prior = loadScoreRecords();
    if (game.flags.debug || game.flags.explore || game.discover) {
        return {
            records: prior,
            rank: prior.length + 1,
            inserted: false,
        };
    }
    const ordered = prior.filter(record => record.points >= 1);
    if (current.points >= 1) {
        const insertAt = ordered.findIndex(record => record.points < current.points);
        ordered.splice(insertAt < 0 ? ordered.length : insertAt, 0, current);
    }
    // The contest storage represents one native uid.  PERSMAX applies per
    // uid and role, so retain at most three entries for each role while
    // preserving score order, then enforce ENTRYMAX.
    const roleCounts = new Map();
    const records = [];
    for (const record of ordered) {
        const count = roleCounts.get(record.role) || 0;
        if (count >= 3)
            continue;
        roleCounts.set(record.role, count + 1);
        records.push(record);
        if (records.length >= 100)
            break;
    }
    const currentIndex = records.indexOf(current);
    if (currentIndex >= 0 || records.length !== prior.length)
        saveScoreRecords(records);
    const previous = currentIndex < 0
        ? records.filter(record => record.role === current.role)[2] : null;
    return {
        records,
        rank: currentIndex >= 0 ? currentIndex + 1
            : previous ? records.indexOf(previous) + 1 : records.length + 1,
        inserted: currentIndex >= 0,
        previous,
    };
}
// C end.c:really_done()/topten(): raw scores have no input wait. NHW_TEXT
// scores retain tty paging, then exit_nhwindows clears the terminal.
// Also C wintty.c:tty_raw_print_bold(): inlined here for bold raw score rows.
async function finishScoreDisplay(current, { stopPrinting = false } = {}) {
    const update = updateScoreRecord(current);
    const mode = game.flags.debug ? 'wizard'
        : game.flags.explore || game.discover ? 'discover' : null;
    const lines = mode ? [{ text: '' }, {
            text: `Since you were in ${mode} mode, the score list will not be checked.`,
        }] : scoreListLines(current, update, stopPrinting);
    game._preserveLeadingStyledBlanks = true;
    clearMessageWindow();
    if (game.iflags?.toptenwin) {
        if (!stopPrinting) {
            const pages = [];
            for (let first = 0; first < lines.length; first += 23) {
                const page = lines.slice(first, first + 23);
                while (page.length < 23)
                    page.push({ text: '' });
                page.push({ text: '--More--' });
                pages.push({ lines: page, cursor: [8, 23] });
            }
            await showTextPages(pages, { validKeys: [27, 32, 10, 13] });
        }
        game.nhDisplay?.clearScreen();
        game.nhDisplay?.setCursor(0, 0);
    }
    else {
        const display = game.nhDisplay;
        display?.clearScreen();
        let row = 0;
        for (const line of lines) {
            if (display && row === display.rows) {
                display.scrollUp();
                row--;
            }
            terminalLine(row++, 0, line.text, line.attr || 0);
        }
        if (display && row === display.rows) {
            display.scrollUp();
            row--;
        }
        display?.setCursor(0, row);
    }
    if (stopPrinting) {
        const display = game.nhDisplay;
        for (let count = 0; count < 2; count++) {
            const row = (display?.cursorRow ?? 0) + 1;
            if (display && row >= display.rows)
                display.scrollUp();
            display?.setCursor(0, Math.min(row, (display?.rows ?? 24) - 1));
        }
    }
    game.program_state.windows_exited = true;
}
async function waitForCurrentMore() {
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}
// C options.c optfn_disclose(): a prefix letter (y n ? + - #) applies to
// the category letter that follows it; a bare category discloses without
// asking; 'k' and 'd' are legacy aliases for vanquished and overview.  The
// special 'a' answers only survive on the vanquished and genocided
// categories; elsewhere they degrade to plain yes.
export const DISCLOSURE_CATEGORIES = ['i', 'a', 'v', 'g', 'c', 'o'];
export function parseDisclosureSettings(raw) {
    const settings = {
        i: '', a: '', v: '', g: '', c: '', o: '',
    };
    // An unset option leaves the zero-initialized defaults: ask, answer no.
    if (raw === undefined || raw === null)
        return settings;
    const text = String(raw).trim();
    if (text === '' || text.toLowerCase() === 'all') {
        for (const category of DISCLOSURE_CATEGORIES)
            settings[category] = 'y';
        return settings;
    }
    if (text.toLowerCase() === 'none') {
        for (const category of DISCLOSURE_CATEGORIES)
            settings[category] = '-';
        return settings;
    }
    let prefix = null;
    for (const character of text) {
        const code = character.toLowerCase();
        if (code === ' ')
            continue;
        const resolved = code === 'k' ? 'v' : code === 'd' ? 'o' : code;
        const category = DISCLOSURE_CATEGORIES.find(entry => entry === resolved);
        if (category) {
            let value = prefix ?? '+';
            if (prefix && category !== 'v' && category !== 'g') {
                if (prefix === '?')
                    value = 'y';
                else if (prefix === '#')
                    value = '+';
            }
            settings[category] = value;
            prefix = null;
        }
        else if (['y', 'n', '?', '+', '-', '#'].includes(code)) {
            prefix = code;
        }
    }
    return settings;
}
function endDiscloseSettings() {
    return parseDisclosureSettings(game.flags?.disclose);
}
// C end.c:should_query_disclose_option().
function shouldQueryDiscloseOption(category) {
    switch (endDiscloseSettings()[category]) {
        case '+': return { ask: false, defquery: 'y' };
        case '#': return { ask: false, defquery: 'a' };
        case '-': return { ask: false, defquery: 'n' };
        case 'y': return { ask: true, defquery: 'y' };
        case 'a': return { ask: true, defquery: 'a' };
        case '?': return { ask: true, defquery: 'a' };
        default: return { ask: true, defquery: 'n' };
    }
}
// C yn_function(): the answer set is shown as "[ynq]"; answers hidden
// behind ESC (the single-vanquished-species 'a') stay acceptable.
export async function ynQuestion(question, visible, defquery, { hiddenAll = false, menuable = false } = {}) {
    const choices = visible === 'ynaq' || hiddenAll ? ['y', 'n', 'a', 'q'] : ['y', 'n', 'q'];
    return await promptChoice(question, choices, defquery, { visibleChoices: visible, menuable });
}
// C end.c:disclose().  Shared by death, quitting, escape, and ascension.
// Each category consults the end_disclose option first: it either fixes
// the answer outright or asks with the option's default.
async function discloseGame({ killer = '', deathVerb = 'died', deathCause = null, possessionAnswer = null, taken = false, survived = false, deathType = null, } = {}) {
    // really_done() displays WIN_MESSAGE before disclosure or bones.
    await displayMessageWindow();
    // The final message window retains the status drawn by the fatal caller.
    // Disclosure uses committed HP after that message has been acknowledged.
    let livingCat = false;
    for (const object of game.inventory) {
        identifyObjectForDisclosure(object, true);
        if (!isQuantumBox(object))
            continue;
        if (livingCat)
            object.spe = 0;
        else {
            await observeQuantumCat(object, { makeCat: false, showMessage: false });
            livingCat = isQuantumBox(object);
        }
    }
    if (game.program_state.stopprint)
        return false;
    if (game.inventory.length) {
        if (possessionAnswer === null) {
            const question = taken
                ? `Do you want to see what you had when you ${deathVerb === 'quit' ? 'quit' : 'died'}?`
                : 'Do you want your possessions identified?';
            const { ask, defquery } = shouldQueryDiscloseOption('i');
            possessionAnswer = ask ? await ynQuestion(question, 'ynq', defquery, { menuable: true })
                : defquery;
        }
        if (possessionAnswer === 'y') {
            game.flags.force_invmenu = false;
            await showIdentifiedInventory();
            await containerContents(game.inventory, true, true, false);
        }
        if (possessionAnswer === 'q')
            return stopDisclosure();
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('a');
        const attributes = ask
            ? await ynQuestion('Do you want to see your attributes?', 'ynq', defquery, { menuable: true })
            : defquery;
        if (attributes === 'y')
            await showFinalAttributes({ final: survived ? ENL_GAMEOVERALIVE : ENL_GAMEOVERDEAD, killer });
        if (attributes === 'q')
            return stopDisclosure();
    }
    // C list_vanquished(): the sort-order choice 'a' is only offered when
    // more than one species was vanquished; with a single species it stays
    // acceptable but hidden, and an 'a' default degrades to 'y'.
    if (!game.program_state.stopprint && vanquishedTypeCount() > 0) {
        const { ask, defquery } = shouldQueryDiscloseOption('v');
        const multiple = vanquishedTypeCount() > 1;
        const defaultAnswer = !multiple && defquery === 'a'
            ? 'y' : defquery;
        const vanquished = ask
            ? await ynQuestion('Do you want an account of creatures vanquished?', multiple ? 'ynaq' : 'ynq', defaultAnswer, { hiddenAll: !multiple })
            : defquery;
        if (vanquished === 'q')
            return stopDisclosure();
        if (vanquished === 'y' || vanquished === 'a') {
            // 'a' picks a sort order first; Escape in that menu forgoes
            // the list without stopping the remaining questions.
            if (!(vanquished === 'a' && multiple
                && await setVanqOrder(true) < 0))
                await showDisclosureOverlay(vanquishedLines(ask));
        }
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('g');
        await listGenocided(defquery, ask);
        if (game.program_state.stopprint)
            return false;
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('c');
        const achievements = achievementEntries(game).length;
        const question = 'Do you want to see your conduct'
            + (achievements > 0 ? ' and achievements' : '') + '?';
        const conduct = ask
            ? await ynQuestion(question, 'ynq', defquery, { menuable: true }) : defquery;
        if (conduct === 'y')
            await showDisclosureOverlay(finalConductLines());
        if (conduct === 'q')
            return stopDisclosure();
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('o');
        const overview = ask
            ? await ynQuestion('Do you want to see the dungeon overview?', 'ynq', defquery, { menuable: true })
            : defquery;
        if (overview === 'y') {
            // C end.c passes show_overview((how >= PANICKED) ? 1 : 2, how):
            // the non-death endings (TRICKED included) disclose as final 1,
            // so only a genuine death lists the hero's resting place.
            const overviewEnding = !(survived || (deathType ?? DIED) >= PANICKED)
                ? null
                : deathVerb === 'ascended' ? 'ascended'
                    : deathVerb === 'escaped' ? 'escaped'
                        : 'quit';
            await showDisclosureOverlay(overviewLines(killer, deathVerb, deathCause, overviewEnding), {
                marker: '(end)',
                // C show_overview() builds the window with add_menu(),
                // so its paged layout keeps the selector column and
                // "(x of y)" page markers.
                pagerStyle: 'menu',
            });
        }
        if (overview === 'q')
            return stopDisclosure();
    }
    return true;
}
// C end.c:done_intr()
// Native signal handlers are replaced by the caller's input cancellation.
export function stopDisclosure() {
    game.program_state.stopprint = (game.program_state.stopprint ?? 0) + 1;
    return false;
}
async function startGameExit(outcome, deathType = DIED) {
    game.program_state.gameover = true;
    game.program_state.something_worth_saving = false;
    if (deathType !== PANICKED && !game.program_state.panicking)
        await doneObjectCleanup();
    // really_done() fixes the finish time before any disclosure can wait.
    const endtime = recorderLocalEpochSeconds(game.datetime) || Date.now() / 1000;
    // end.c:1169-1170 snapshots at_night/at_midnight here, before any
    // disclosure prompt can wait, so a slow answer cannot rewrite them.
    const finalHour = recorderLocalHour(game.datetime);
    game._finalNight = {
        night: finalHour < 6 || finalHour > 21,
        midnight: finalHour === 0,
    };
    if (achievementEntries(game).length || !game.flags.beginner) {
        if (game.u.uroleplay?.blind)
            recordAchievement(game, ACH_BLND);
        if (game.u.uroleplay?.nudist)
            recordAchievement(game, ACH_NUDE);
    }
    if (outcome === 'ascended')
        recordAchievement(game, ACH_UWIN);
    if (outcome === 'died' && deathType < PANICKED
        && game.moves <= 1 && !game.program_state.stopprint) {
        // done() has committed zero HP; this pline refreshes that status.
        await plineWithContinuation(`Do not pass Go.  Do not collect 200 ${currency(200)}.`);
    }
    game._canMakeBones = outcome === 'died' && deathType < GENOCIDED
        && canMakeBones();
    if (game._canMakeBones && launch_in_progress(game))
        force_launch_placement(game);
    return endtime;
}
async function settleGameExit(outcome) {
    const silent = !!game.program_state.stopprint;
    const publish = async (message) => {
        // A real pline updates status; an existing death message alone
        // retains the status painted by the fatal caller.
        await plineWithContinuation(message);
    };
    const taken = await settleShopkeepersOnExit(outcome, { silent, publish });
    await payVaultGuardOnExit({ silent, publish });
    await clearNonlocalPriestsOnExit();
    return taken;
}
export async function finishOrdinaryDeath(options) {
    const endtime = await startGameExit('died', options.deathType ?? DIED);
    if (options.deathType != null)
        setHeroRemainsFromDeath(options.deathType, game);
    await completeOrdinaryDeath(options, endtime);
}
async function completeOrdinaryDeath({ killer, possessionAnswer = null, deathVerb = 'died', deathCause = null, deathType = null, killerFormat = KILLED_BY_AN, }, endtime) {
    const how = deathType ?? DIED;
    if (!killer && how === GENOCIDED)
        killerFormat = NO_KILLER_PREFIX;
    if (!killer && (how === STARVING || how === BURNING))
        killerFormat = KILLED_BY;
    if (!killer || how >= PANICKED)
        killer = DEATH_NAMES[how] ?? 'died';
    if (how >= PANICKED)
        deathCause = killer;
    deathCause ||= killerDeathCause(killer, deathVerb, deathType, killerFormat);
    if (deathType !== null)
        deathVerb = ENDINGS[deathType] ?? deathVerb;
    game._deathKiller = killer;
    fixupDeath(how);
    const taken = how === PANICKED ? false : await settleGameExit('died');
    let showSummary;
    if (how === PANICKED) {
        await displayMessageWindow();
        showSummary = !game.program_state.stopprint;
    }
    else {
        showSummary = await discloseGame({ killer, deathVerb, deathCause, possessionAnswer, taken, deathType });
    }
    if (game._canMakeBones && taken)
        await finishShopkeeperRepossession();
    // really_done() counts remaining loose and contained gold before bones
    // removes the inventory. Repossessed gold has already left the hero.
    const summary = gameSummaryValues('died', how);
    game.u.urexp = summary.score;
    const arise = game.u.ugrave_arise;
    if (arise !== undefined && arise >= 0 && !game.program_state.stopprint) {
        const revenant = MONSTER_NAME[arise] === 'green slime'
            ? 'revenant persists' : 'body rises from the dead';
        await plineWithContinuation(`Your ${revenant} as ${withIndefiniteArticle(monsterTypeName(arise, !!game.flags.female))}...`);
        await displayMessageWindow();
    }
    await createBonesFromDeath(deathCause || killerDeathCause(killer, deathVerb), promptYesNo, endtime);
    if (showSummary) {
        game._preserveLeadingStyledBlanks = false;
        await showTextWindow(deathSummaryLines(killer, summary, endtime, { deathVerb, deathCause, deathType }));
    }
    await finishScoreDisplay(currentScoreRecord(summary, {
        killer, deathVerb, deathCause, deathType,
    }), { stopPrinting: !showSummary });
    game.context.move = 0;
}
// C end.c:fixup_death(). These reasons describe the fatal process rather
// than an independent condition which stopped the hero from acting.
function fixupDeath(how) {
    const reason = game._helplessReason;
    const text = typeof reason === 'string' ? reason : reason?.text;
    if (how === STONING && text === 'getting stoned') {
        game._helplessReason = null;
        setMulti(0);
    }
    else if (how === STARVING && text === 'fainted from lack of food') {
        game._helplessReason = 'fainted';
    }
}
// C end.c:done2(): the #quit command — the tutorial switch-back prompt,
// the paranoid "Really quit without saving?" refusal that clears the
// question and any pending multi, and the QUIT hand-off below.
export async function doquit() {
    const abandonTutorial = !!game._tutorialActive
        && await promptChoice('Switch from the tutorial back to regular play?', ['y', 'n'], 'n', { menuable: true }) === 'y';
    const answer = !abandonTutorial && await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_QUIT), 'Really quit without saving?');
    if (!answer) {
        // C end.c:done2() clears the answered question without a docrt,
        // cancels voluntary repetition, and releases prayer/sleep only
        // after multi has reached zero. Involuntary delays remain active.
        clearMessageWindow();
        if (game.multi > 0)
            endVoluntaryMultiTurn(game);
        if ((game.multi ?? 0) === 0) {
            game.u.invulnerable = false;
            game.u.usleep = 0;
        }
        await flush_screen(1);
        game.context.move = 0;
        if (abandonTutorial) {
            const prior = game.u.ucamefrom;
            if (!prior)
                throw new Error('Tutorial exit has no prior dungeon level');
            scheduleLevelChange([prior, { arrival: 'stairs' }], undefined, 'Resuming regular play.');
        }
        return;
    }
    if (game.flags.debug) {
        const dump = await promptChoice('Dump core?', ['y', 'n', 'q'], 'q', { menuable: true });
        if (dump === 'y') {
            game.program_state.windows_exited = true;
            game.program_state.gameover = true;
            game.context.move = 0;
            // NH_abort() terminates the native process before done(QUIT).
            // The engine exposes that termination to its host.
            throw new PanicTermination('Wizard requested a core dump');
        }
        if (dump === 'q')
            stopDisclosure();
    }
    await finishOrdinaryQuit();
}
// C refs: end.c done(QUIT)/really_done().  QUIT skips the tombstone,
// but otherwise owns disclosures, a role-aware summary text window, and the
// score-list handoff as one terminal transaction.
export async function finishOrdinaryQuit() {
    requireInitializedHero(game.u);
    await bot();
    const endtime = await startGameExit('quit');
    // really_done() admits bones while the outcome is still QUIT, then
    // converts an already-dead hero without another death or recovery phase.
    if (game.u.uhp < 1) {
        game.u.umortality = (game.u.umortality ?? 0) + 1;
        game._canMakeBones = false;
        const cause = "quit while already on Charon's boat";
        await completeOrdinaryDeath({ killer: cause, deathCause: cause }, endtime);
        return;
    }
    const taken = await settleGameExit('quit');
    const showSummary = await discloseGame({ deathVerb: 'quit', taken, survived: true });
    const summary = gameSummaryValues('quit');
    game.u.urexp = summary.score;
    const current = currentScoreRecord(summary, { outcome: 'quit' });
    if (showSummary) {
        renderQuitSummaryPage(summary);
        await waitForCurrentMore();
    }
    await finishScoreDisplay(current, { stopPrinting: !showSummary });
    game.context.move = 0;
}
export async function finishLivingGame(outcome) {
    requireInitializedHero(game.u);
    await bot();
    await startGameExit(outcome);
    const taken = await settleGameExit(outcome);
    const showSummary = await discloseGame({ deathVerb: outcome, taken, survived: true });
    const pets = await collectLevelFollowers(game, true);
    const summary = gameSummaryValues(outcome);
    const possessions = collectFinalPossessions();
    summary.score += possessions.points;
    for (const pet of pets)
        summary.score += pet.mhp;
    const names = pets.map(pet => monsterName(pet));
    if (possessions.quantumCat) {
        summary.score += d(adjustedMonsterLevel(MONSTER_NAME.indexOf('housecat')), 8);
        names.push("Schroedinger's cat");
    }
    game.u.urexp = summary.score;
    const current = currentScoreRecord(summary, {
        outcome, deathCause: outcome,
    });
    if (showSummary) {
        const title = outcome === 'ascended'
            ? (game.flags.female ? 'Demigoddess' : 'Demigod') : roleName();
        const lines = [`${goodbye()} ${game.plname || 'player'} the ${title}...`, ''];
        const company = ['You', ...names].join(' and ');
        if (names.length)
            lines.push(company);
        const action = outcome === 'ascended' ? 'went to your reward' : 'escaped from the dungeon';
        lines.push(`${names.length ? '' : 'You '}${action} with ${summary.score} point${plur(summary.score)},`);
        lines.push(...await finalPossessionLines(possessions));
        lines.push(`and ${summary.gold} piece${summary.gold === 1 ? '' : 's'} of gold, after ${summary.moves} move${summary.moves === 1 ? '' : 's'}.`);
        lines.push(`You were level ${game.u.ulevel} with a maximum of ${game.u.uhpmax} hit point${plur(game.u.uhpmax)} when you ${outcome}.`);
        const pages = [];
        for (let first = 0; first < lines.length; first += 22) {
            const page = lines.slice(first, first + 22);
            while (page.length < 23)
                page.push('');
            page.push('--More--');
            pages.push({ lines: page, cursor: [8, 23] });
        }
        await showTextPages(pages, { validKeys: [27, 32, 10, 13] });
    }
    await finishScoreDisplay(current, { stopPrinting: !showSummary });
    game.context.move = 0;
}
function objectBaseValue(type) {
    const value = objectBaseCost(type);
    if (value === undefined)
        throw new RangeError(`No base value for object type ${type}`);
    return value;
}
// The final-disclosure inventory walk.
// C end.c:get_valuables(): amulets and non-artifact gems, glass merged
// into one slot, recursing through containers.
// C end.c:sort_valuables(): most copies first within each of gems and
// amulets (the listing prints the gems before the amulets).
// C end.c:artifact_score(): the counting pass — artifacts and the three
// invocation items add five-halves their value as points; artiname() is
// the artifact's own name from the record.
function collectFinalPossessions() {
    const artifacts = [];
    const valuables = new Map();
    let lastGlass = -1;
    for (const [index, name] of OBJECT_NAMES.entries())
        if (name?.startsWith('worthless piece of'))
            lastGlass = index;
    let points = 0;
    const quantumCat = game.inventory.some(isQuantumBox);
    function visit(objects) {
        for (const object of objects) {
            const artifact = artifactById(object.oartifact);
            if (artifact || [BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD].includes(object.otyp)) {
                const value = artifact ? artifact.cost || 100 * objectBaseValue(object.otyp)
                    : objectBaseValue(object.otyp);
                const score = Math.trunc(value * 5 / 2);
                points += score;
                artifacts.push({ object, value, points: score,
                    name: artifact?.name || `The ${OBJ_NAME(object.otyp)}` });
            }
            else if (!object.contents?.length
                && (object.oclass === AMULET_CLASS
                    || object.oclass === GEM_CLASS && object.otyp <= lastGlass)) {
                const type = object.oclass === GEM_CLASS && object.otyp > JADE ? JADE + 1 : object.otyp;
                valuables.set(type, (valuables.get(type) || 0) + object.quan);
            }
            if (object.contents?.length)
                visit(object.contents);
        }
    }
    visit(game.inventory);
    const groups = [...valuables].sort(([a, countA], [b, countB]) => {
        const aIsGem = objectClassForType(a) === GEM_CLASS;
        const bIsGem = objectClassForType(b) === GEM_CLASS;
        return Number(bIsGem) - Number(aIsGem) || countB - countA || a - b;
    });
    for (const [type, count] of groups)
        points += count * objectBaseValue(type);
    return { points, artifacts, valuables: groups, quantumCat };
}
// C end.c:artifact_score(): the listing pass — identify each artifact or
// invocation item and report its value and points.
async function finalPossessionLines(possessions) {
    const lines = possessions.artifacts.map(({ object, value, points, name }) => {
        recordObjectKnowledge(object.otyp);
        object.known = object.dknown = object.bknown = object.rknown = true;
        return `${name} (worth ${value} ${currency(value)} and ${points} points)`;
    });
    for (const [type, count] of possessions.valuables) {
        const worth = count * objectBaseValue(type);
        const prefix = String(count).padStart(8);
        if (type === JADE + 1) {
            lines.push(`${prefix} worthless piece${count === 1 ? '' : 's'} of colored glass,`);
        }
        else {
            const object = await mksobj(type, false, false);
            object.known = object.dknown = true;
            object.quan = count;
            recordObjectKnowledge(type);
            const name = objectName(object);
            lines.push(`${prefix} ${count === 1 ? name : makePlural(name)} (worth ${worth} ${currency(2)}),`);
            await deleteObject(object);
        }
    }
    return lines;
}
// C end.c:done_in_by(). Fatal attribution describes the real killer even
// when its appearance, given name, or the hero's hallucination differs.
const G_UNIQ = 0x1000;
function fatalMonsterDescription(monster) {
    const current = monster.mnum;
    const champion = ismnum(monster.cham) ? monster.cham : current;
    const mimicker = M_AP_TYPE(monster) === M_AP_MONSTER;
    const imitator = current !== champion || mimicker;
    const givenName = MGIVENNAME(monster) || monster.name;
    const ghost = current === MONSTER_NAME.indexOf('ghost');
    const personal = (species) => monsterHasProperName(species);
    const unique = (species) => !!((MONSTER_GENO[species] ?? 0) & G_UNIQ);
    const uniqueKiller = unique(current) && !(imitator && !mimicker)
        && (current !== MONSTER_NAME.indexOf('high cleric') || monster.ispriest);
    let article = uniqueKiller ? personal(current) ? '' : 'the ' : null;
    if (ghost && givenName)
        article = 'the ';
    let name = monster.minvis ? 'invisible ' : '';
    if (heroIsHallucinating(game) && canSpotMonster(monster))
        name += 'hallucinogen-distorted ';
    if (imitator) {
        const vampire = ['vampire', 'vampire leader', 'Vlad the Impaler']
            .some(species => champion === MONSTER_NAME.indexOf(species));
        const apparentSpecies = mimicker ? monster.mappearance : current;
        if (apparentSpecies === undefined || !ismnum(apparentSpecies))
            throw new Error('A monster killer has an invalid monster disguise.');
        const real = monsterTypeName(champion, monster.female);
        const apparent = !mimicker && vampire && real.toLowerCase().includes('vampire')
            && current === MONSTER_NAME.indexOf('vampire bat')
            ? 'bat' : monsterTypeName(apparentSpecies, monster.female);
        const shape = vampire || personal(apparentSpecies) ? apparent
            : unique(apparentSpecies) && apparentSpecies !== MONSTER_NAME.indexOf('high cleric')
                ? `the ${apparent}` : withIndefiniteArticle(apparent);
        name += vampire ? `${real} in ${shape} form`
            : `${real} ${mimicker ? 'disguised as' : 'imitating'} ${shape}`;
    }
    else if (ghost) {
        name += `ghost${givenName ? ` of ${givenName}` : ''}`;
    }
    else if (monster.isshk) {
        name += shopkeeperKillerName(monster);
        article = '';
    }
    else if (monster.ispriest || monster.isminion) {
        name += monsterName(monster, { article: 'none', exact: true, suppressSaddle: true });
    }
    else {
        name += monsterTypeName(current, monster.female);
        if (givenName)
            name += ` ${monster.mextra?.ebones ? 'of' : 'called'} ${givenName}`;
    }
    return article === null ? withIndefiniteArticle(name) : article + name;
}
export async function finishMonsterAttackDeath(monster, { pagerOwned = false, attribution = { kind: 'done-in-by' }, deathType = null, } = {}) {
    const customCause = attribution.kind === 'death-inflicted-by';
    const announcesDeath = !customCause || attribution.announcesDeath;
    const fatalLine = deathType === STONING ? 'You turn to stone...' : 'You die...';
    const hpSaveSentinel = game.u.uhp === -1;
    const projectedFatalLine = !!game._pending_message
        && !game._suppressMessagesUntilInput;
    if (projectedFatalLine && announcesDeath && deathType !== STONING) {
        // You("die...") runs vpline(): pending vision changes and the raw
        // injury reach the map before tty pages older prose.
        if (game.vision_full_recalc)
            await vision_recalc(0);
        await flush_screen(1);
        await waitForCurrentMonsterMore();
    }
    // Petrification can append to a short hit or page a longer one. Both
    // happen in done_in_by(), before done() records zero HP for life saving.
    const petrificationAnnounced = announcesDeath && deathType === STONING;
    if (petrificationAnnounced)
        await plineWithContinuation(fatalLine);
    const fatalKiller = customCause ? attribution.killer : fatalMonsterDescription(monster);
    const fatalDeathCause = customCause
        ? attribution.deathCause ?? killerDeathCause(fatalKiller, 'died', deathType, attribution.killerFormat ?? KILLED_BY)
        : `${deathType === STONING ? 'petrified' : 'killed'} by ${fatalKiller}`;
    if (!customCause) {
        // done_in_by() removes redundant attribution only for the causing monster.
        const reason = game._helplessReason;
        if (reason && typeof reason !== 'string' && reason.monsterId === monster.m_id) {
            const firstSpace = reason.text.indexOf(' ');
            if (firstSpace >= 0)
                game._helplessReason = { ...reason, text: reason.text.slice(0, firstSpace) };
        }
        setHeroRemainsFromMonster(monster, game);
    }
    // done_in_by() announces the death while HP still holds the lethal
    // (often negative) value; done() commits zero afterwards. The
    // life-saving transaction performs done()'s commit itself.
    const lifeSaving = beginHeroLifeSaving();
    if (lifeSaving) {
        // "But wait..." can page the fatal line. Native makeknown()
        // and its Wisdom exercise draw wait for that acknowledgement.
        const medallionEffect = heroIsBlind(game) ? 'feels warm' : 'begins to glow';
        if (announcesDeath && !petrificationAnnounced)
            await plineWithContinuation(fatalLine);
        await plineWithContinuation('But wait...');
        identifyLifeSavingAmulet();
        await plineWithContinuation(`Your medallion ${medallionEffect}!`);
        const dismissal = await plineWithContinuation(formatFeltMessage('much better!'));
        // ESC at tty --More-- sets WIN_STOP: the new overflow
        // message is still installed, but later messages in this
        // input transaction (starting with the crumble line) are
        // suppressed.  Other dismissal keys retain the source
        // follow-up.
        if (dismissal !== 27) {
            await plineWithContinuation('The medallion crumbles to dust!');
        }
        else {
            game._suppressMessagesUntilInput = true;
        }
        await completeHeroLifeSaving(lifeSaving);
        return !!game.program_state.gameover;
    }
    // C end.c:done() records every fatal event and forces HP to zero
    // before it tests LifeSaved or offers the debug/explore "Die?"
    // escape. done_in_by() has already announced the death by then, so
    // its pager still shows the lethal HP; done()'s own message flush
    // does not. The amulet branch commits in beginHeroLifeSaving().
    const commitFatalEvent = () => {
        game.u.umortality = (game.u.umortality || 0) + 1;
        if (game.u.uhp !== 0 || (Upolyd(game.u) && game.u.mh !== 0)) {
            game.u.uhp = 0;
            game.u.mh = 0;
            game.context.botl = true;
        }
    };
    const previousStatusDisabled = game._statusUpdatesDisabled;
    if (hpSaveSentinel)
        game._statusUpdatesDisabled = true;
    try {
        if (announcesDeath && game._suppressMessagesUntilInput && deathType !== STONING) {
            await plineWithContinuation(fatalLine);
            commitFatalEvent();
            if (pagerOwned && !game._suppressMessagesUntilInput)
                await waitForCurrentMonsterMore(fatalLine);
        }
        else if (announcesDeath) {
            if (!petrificationAnnounced)
                await plineWithContinuation(fatalLine);
            commitFatalEvent();
            // tty_yn_function() skips more() while Escape's WIN_STOP is set.
            if ((game.flags?.debug || game.flags?.explore) && !game._suppressMessagesUntilInput)
                await waitForCurrentMonsterMore(fatalLine);
        }
        else {
            commitFatalEvent();
        }
    }
    finally {
        if (previousStatusDisabled === undefined)
            delete game._statusUpdatesDisabled;
        else
            game._statusUpdatesDisabled = previousStatusDisabled;
    }
    if (game.flags?.debug || game.flags?.explore) {
        const die = await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_DIE), 'Die?');
        if (!die) {
            await plineWithContinuation("OK, so you don't die.");
            await restoreHeroAfterDeath();
            if (game.program_state.gameover)
                return true;
            return false;
        }
    }
    await finishOrdinaryDeath({
        killer: fatalKiller, deathCause: fatalDeathCause, deathType,
        deathVerb: deathType === STONING ? 'were petrified' : 'died',
    });
    game.context.move = 0;
    return true;
}
// losehp() enters urgent_pline(), whose map flush precedes paging the
// previous message. Its pending HP request must reach that pager.
export async function finishHeroDeathAfterMonsterMessage(options) {
    await flush_screen(1);
    await waitForCurrentMonsterMore();
    return finishHeroDeath(options);
}
export async function waitForCurrentMonsterMore(fallbackMessage = '') {
    if (!game._pending_message) {
        game._pending_message = fallbackMessage;
        resetToplineClip();
    }
    return flushPendingTopline();
}
// C end.c:container_contents(), shared by final disclosure and #loot ':'.
export async function containerContents(list, identified, allContainers, reportEmpty) {
    for (const box of list) {
        if (isContainer(box) || box.otyp === STATUE) {
            box.cknown = true;
            if (identified)
                box.lknown = true;
            if (box.otyp === BAG_OF_TRICKS)
                continue;
            if (box.contents?.length) {
                const lines = [`Contents of ${definiteName(objectName(box))}:`, ''];
                if (isQuantumBox(box)) {
                    lines.push("  Schroedinger's cat!");
                }
                else {
                    if (!identified)
                        for (const object of box.contents)
                            observeObjectForNaming(object);
                    for (const object of sortObjects(box.contents, { mode: lootSortMode() })) {
                        if (identified)
                            identifyObjectForDisclosure(object);
                        lines.push(`  ${await objectDescription(object, { withPrice: true })}`);
                    }
                }
                await showDisclosureOverlay(lines, { pagerStyle: 'text', restoreUnderlay: true });
                if (allContainers)
                    await containerContents(box.contents, identified, true, reportEmpty);
            }
            else if (reportEmpty) {
                const name = definiteName(simpleObjectName(box));
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} is empty.`);
                await displayMessageWindow();
            }
        }
        if (!allContainers)
            break;
    }
}
// C end.c:done_object_cleanup(), shared by terminal outcomes and saves.
export async function doneObjectCleanup() {
    await finishInUseInventory(true);
    const flightFields = ['_thrownObject', '_kickedObject'];
    if (flightFields.some(field => game[field]?.where === 'free')) {
        const { ux, uy } = game.u;
        let ox = ux + (game.u.dx ?? 0);
        let oy = uy + (game.u.dy ?? 0);
        if (!isok(ox, oy) || !isAccessibleAt(ox, oy)) {
            ox = ux;
            oy = uy;
        }
        // Native bypasses flooreffects: finish cleanup rather than trigger
        // further destruction, falls, or contact effects from a projectile.
        for (const field of flightFields) {
            const object = game[field];
            if (object?.where !== 'free')
                continue;
            placeObjectSynchronously(object, ox, oy);
            await stack_object(object);
            game[field] = null;
        }
    }
    const chain = game.uchain || game.u.uchain;
    if (chain?.where === 'free')
        await restoreBallAndChainPlacement(-1);
}
//# sourceMappingURL=end.js.map