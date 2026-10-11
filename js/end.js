// end.js — End-of-game disclosure and terminal presentation.
// C refs: end.c disclose()/really_done(), insight.c, dungeon.c.
import { endVoluntaryMultiTurn } from './command_state.js';
import { achievementEntries } from './achievements.js';
import { game, requireGameLevel, requireInitializedGame } from './gstate.js';
import { expelHero, releaseHeroFromMonster } from './hero_expulsion.js';
import { heroFormSticks } from './hero_species.js';
import { monsterName } from './monster_name.js';
import { nhgetch } from './input.js';
import { bot, clearMessageWindow, displayMessageWindow, flush_screen, pline, plineWithContinuation, } from './display.js';
import { consumeInventoryItem, showIdentifiedInventory } from './invent.js';
import { finalConductLines, showFinalAttributes } from './insight.js';
import { showDisclosureOverlay, showPagedPickOneMenu, showTextPages, showTextWindow, } from './windows.js';
import { artifactById } from './artifacts.js';
import { MONSTER_CLASS_EXPLAIN, MONSTER_DIFFICULTY, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, } from './monster_data.js';
import { ATR_BOLD, NO_COLOR } from './terminal.js';
import { d, rn2 } from './rng.js';
import { mksobj } from './mklev.js';
import { adjustedMonsterLevel } from './monster_hit_points.js';
import { deleteObject } from './object_delete.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { objectName } from './objnam.js';
import { objectClassForType, recordObjectKnowledge } from './object_knowledge.js';
import { rebasePrayerAfterLifeSaving } from './pray.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { deepestLevelReached, depth } from './hacklib.js';
import { recordGameLogEvent } from './gamelog.js';
import { hiddenGold } from './gold.js';
import { heroGoldAmount } from './hero_gold.js';
import { doneObjectCleanup } from './object_cleanup.js';
import { restoreHeroNutrition } from './hunger.js';
import { A_CON, A_WIS, CHOKING, DIED, G_EXTINCT, G_GENOD, GENOCIDED, Is_astralevel, STRAT_WAITFORU, Upolyd, } from './const.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, JADE, OBJECT_COST, OBJECT_NAMES, SPE_BOOK_OF_THE_DEAD, } from './object_data.js';
import { createBonesFromDeath } from './bones_death.js';
import { canMakeBones } from './bones_admission.js';
import { heroIsBlind } from './senses.js';
import { finishShopkeeperRepossession, settleShopkeepersOnExit } from './shop_settlement.js';
import { payVaultGuardOnExit } from './vault_exit.js';
import { clearNonlocalPriestsOnExit } from './priest.js';
import { promptChoice, promptYesNo } from './query.js';
import { clearHeroRemains, setHeroRemainsFromDeath, } from './death_remains.js';
import { loadScoreRecords, saveScoreRecords } from './score_records.js';
import { requireInitializedHero } from './hero_types.js';
export { SCORE_RECORD_STORAGE_KEY } from './score_records.js';
const AMULET_CLASS = 5;
const GEM_CLASS = 13;
// C refs: end.c done()/savelife() and o_init.c makeknown().  The fatal-hit
// caller owns tty suspension, but end.c owns the two state commits on either
// side of that pager: identification before it and consumption/revival after.
export function beginHeroLifeSaving(random = rn2) {
    const amulet = game.uamul || game.u?.uamul;
    if (amulet?.otyp !== AMULET_OF_LIFE_SAVING)
        return null;
    recordHeroFatalEvent();
    identifyLifeSavingAmulet(random);
    return { amulet };
}
function recordHeroFatalEvent() {
    game.u.umortality = (game.u.umortality || 0) + 1;
    if (game.u.uhp !== 0 || (Upolyd(game.u) && game.u.mh !== 0)) {
        game.u.uhp = 0;
        game.u.mh = 0;
    }
}
function identifyLifeSavingAmulet(random = rn2) {
    if (!game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING)) {
        recordObjectKnowledge(AMULET_OF_LIFE_SAVING);
        const wisdom = game.u?.acurr?.a?.[A_WIS] ?? 10;
        const amount = random(19) > wisdom ? 1 : 0;
        if (!game.u._exercise)
            game.u._exercise = [0, 0, 0, 0, 0, 0];
        game.u._exercise[A_WIS] += amount;
    }
}
export async function completeHeroLifeSaving(transaction, { deathType = null } = {}) {
    const amulet = transaction?.amulet;
    if (!amulet)
        return false;
    await consumeInventoryItem(amulet, game);
    const attributes = game.u?.acurr?.a;
    if (attributes)
        attributes[A_CON] = Math.max(3, (attributes[A_CON] ?? 3) - 1);
    if (!game.u._exercise)
        game.u._exercise = [0, 0, 0, 0, 0, 0];
    game.u._exercise[A_CON] = 0;
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
    const constitution = game.u?.acurr?.a?.[A_CON] ?? 3;
    const giveHp = 50 + 10 * Math.trunc(constitution / 2);
    game.u.uhp = Math.min(game.u.uhpmax ?? giveHp, giveHp);
    if (Upolyd(game.u))
        game.u.mh = Math.min(game.u.mhmax, giveHp);
    if ((game.u.uhunger ?? 900) < 500 || deathType === CHOKING)
        await plineWithContinuation(restoreHeroNutrition());
    game.context.move = 0;
    // end.c:savelife() replaces any earlier negative multi (including a
    // monster paralysis spell) with exactly -1.  The interrupted actor can
    // finish its remaining attack slots, but no older helpless interval may
    // allocate another autonomous monster turn afterward.  Its visible
    // nomovemsg is projected by allmain's debug-death continuation.
    endVoluntaryMultiTurn(game);
    game._helplessTurns = 1;
    game._helplessReason = 'attempting to cheat Death';
    game._helplessDoneMessage = '';
    clearHeroRemains(game);
    rebasePrayerAfterLifeSaving(game);
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
export async function finishHeroDeath({ killer, beforeFinalDeath = null, deathCause = null, deathVerb = 'died', deathLineShown = false, deathType = null, }) {
    // losehp() announces the fatal hit before done() changes mortality or
    // identifies a life-saving amulet. tty keeps this message on its own line.
    if (!deathLineShown) {
        await plineWithContinuation('You die...', { urgent: true });
    }
    // done() forces status while HP is still raw, then normalizes it for
    // recovery and disclosure. A later pline owns the next status update.
    await bot();
    recordHeroFatalEvent();
    const amulet = game.uamul || game.u?.uamul;
    if (amulet?.otyp === AMULET_OF_LIFE_SAVING) {
        await plineWithContinuation('But wait...');
        identifyLifeSavingAmulet();
        await plineWithContinuation(`Your medallion ${heroIsBlind() ? 'feels warm' : 'begins to glow'}!`);
        if (deathType === CHOKING)
            await plineWithContinuation('You vomit ...');
        await plineWithContinuation('You feel much better!');
        await plineWithContinuation('The medallion crumbles to dust!');
        await completeHeroLifeSaving({ amulet }, { deathType });
        if (game.program_state.gameover)
            return true;
        if (deathType === GENOCIDED) {
            await plineWithContinuation('Unfortunately you are still genocided...');
        }
        else {
            game._deathSurvivedMessagePending = true;
            return false;
        }
    }
    if (game.flags?.debug || game.flags?.explore) {
        const answer = await promptYesNo('Die? [yn] (n) ');
        if (answer !== 'y') {
            await plineWithContinuation("OK, so you don't die.");
            await restoreHeroAfterDeath({ deathType });
            if (game.program_state.gameover)
                return true;
            game._deathSurvivedMessagePending = true;
            return false;
        }
    }
    await beforeFinalDeath?.();
    setHeroRemainsFromDeath(deathType, game);
    await finishOrdinaryDeath({ killer, deathCause, deathVerb, deathType });
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
        recordGameLogEvent('killed for the first time', { state });
}
async function promptDeathQuestion(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length + 1, 0);
    return String.fromCharCode(await nhgetch()).toLowerCase();
}
// C insight.c:list_vanquished()/vanqsort_cmp().  The order comes from
// flags.vanq_sortmode, chosen through the tty sort menu below; the default
// "traditional" order is monster level high to low, then internal index.
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
const VANQ_MLVL_MNDX = 0;
const VANQ_MSTR_MNDX = 1;
const VANQ_ALPHA_SEP = 2;
const VANQ_ALPHA_MIX = 3;
const VANQ_MCLS_HTOL = 4;
const VANQ_MCLS_LTOH = 5;
const VANQ_COUNT_H_L = 6;
const VANQ_COUNT_L_H = 7;
const RIDER_MONSTERS = new Set(['Death', 'Famine', 'Pestilence']
    .map(name => MONSTER_NAME.indexOf(name)));
const S_ZOMBIE = 52;
// C vanqsort_cmp(): punctuation classes order after S_ZOMBIE in this
// sequence rather than by their internal indexes.
const PUNCTUATION_CLASS_ORDER = [58, 57, 55, 54, 56, 53];
function vanqSortMode() {
    return game.flags.vanqSortmode ?? VANQ_MLVL_MNDX;
}
function speciesIsUnique(mnum) {
    return !!((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) && mnum !== PM_HIGH_CLERIC;
}
function monsterClassOrder(mlet) {
    if (mlet > S_ZOMBIE) {
        const position = PUNCTUATION_CLASS_ORDER.indexOf(mlet);
        if (position >= 0)
            return S_ZOMBIE + 1 + position;
    }
    return mlet;
}
function compareCaseInsensitive(left, right) {
    return left.toLowerCase() < right.toLowerCase() ? -1
        : left.toLowerCase() > right.toLowerCase() ? 1 : 0;
}
// C insight.c:vanqsort_cmp() over internal monster indexes.
function vanqsortCompare(mode, mnum1, mnum2) {
    let result = 0;
    switch (mode) {
        case VANQ_MSTR_MNDX:
            result = (MONSTER_DIFFICULTY[mnum2] ?? 0) - (MONSTER_DIFFICULTY[mnum1] ?? 0);
            break;
        case VANQ_ALPHA_SEP:
        case VANQ_ALPHA_MIX:
            if (mode === VANQ_ALPHA_SEP) {
                const unique1 = speciesIsUnique(mnum1) ? 1 : 0;
                const unique2 = speciesIsUnique(mnum2) ? 1 : 0;
                if (unique1 !== unique2) {
                    result = unique2 - unique1;
                    break;
                }
            }
            result = compareCaseInsensitive(MONSTER_NAME[mnum1] || '', MONSTER_NAME[mnum2] || '');
            break;
        case VANQ_MCLS_HTOL:
        case VANQ_MCLS_LTOH: {
            const class1 = monsterClassOrder(MONSTER_SYMBOL[mnum1] ?? 0);
            const class2 = monsterClassOrder(MONSTER_SYMBOL[mnum2] ?? 0);
            result = class1 - class2;
            if (result === 0) {
                // Riders share a class with major demons but sort first.
                result = (RIDER_MONSTERS.has(mnum2) ? 1 : 0)
                    - (RIDER_MONSTERS.has(mnum1) ? 1 : 0);
                if (result === 0) {
                    result = (MONSTER_LEVEL[mnum1] ?? 0) - (MONSTER_LEVEL[mnum2] ?? 0);
                    if (mode === VANQ_MCLS_HTOL)
                        result = -result;
                }
            }
            break;
        }
        case VANQ_COUNT_H_L:
        case VANQ_COUNT_L_H: {
            const died1 = game.mvitals?.[mnum1]?.died ?? 0;
            const died2 = game.mvitals?.[mnum2]?.died ?? 0;
            result = died2 - died1;
            if (mode === VANQ_COUNT_L_H)
                result = -result;
            break;
        }
        default:
            result = (MONSTER_LEVEL[mnum2] ?? 0) - (MONSTER_LEVEL[mnum1] ?? 0);
            break;
    }
    return result === 0 ? mnum1 - mnum2 : result;
}
function vanquishedEntries() {
    return (game.mvitals || []).flatMap((vital, mnum) => {
        const count = vital?.died ?? 0;
        if (!count)
            return [];
        return [{
                mnum,
                name: MONSTER_NAME[mnum] || 'monster',
                count,
                unique: speciesIsUnique(mnum),
                pname: !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME),
            }];
    }).sort((a, b) => vanqsortCompare(vanqSortMode(), a.mnum, b.mnum));
}
function vanquishedTypeCount() {
    return (game.mvitals || []).filter(vital => (vital?.died ?? 0) > 0).length;
}
// C upstart(): capitalize the first letter of a class header.
function upstart(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
// C N_times(): "once", "twice", "thrice", then "N times".
function timesText(count) {
    if (count === 2)
        return 'twice';
    if (count === 3)
        return 'thrice';
    return `${count} times`;
}
// C list_vanquished() indents each entry so its name column lines up with
// the three-digit count prefix of multiple-kill rows.
function vanquishedIndent(text) {
    if (/^the /i.test(text))
        return 0;
    if (/^an /i.test(text))
        return 1;
    if (/^a /i.test(text))
        return 2;
    return /[0-9]/.test(text.charAt(2)) ? 0 : 4;
}
export function vanquishedLines() {
    const mode = vanqSortMode();
    const entries = vanquishedEntries();
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const classHeaders = (mode === VANQ_MCLS_LTOH || mode === VANQ_MCLS_HTOL)
        && entries.length > 1;
    const uniqHeaders = mode === VANQ_ALPHA_SEP;
    const lines = ['Vanquished creatures:', ''];
    let previousClass = 0;
    let wasUnique = false;
    let riderHeader = false;
    for (const entry of entries) {
        const rider = RIDER_MONSTERS.has(entry.mnum);
        const mlet = MONSTER_SYMBOL[entry.mnum] ?? 0;
        if (classHeaders && (mlet !== previousClass || (riderHeader && !rider))) {
            lines.push(upstart(rider
                ? 'Rider' : MONSTER_CLASS_EXPLAIN[mlet] ?? ''));
            riderHeader = rider;
            previousClass = mlet;
        }
        let text;
        if (entry.unique) {
            text = `${entry.pname ? '' : 'the '}${entry.name}`;
            if (entry.count > 1)
                text += ` (${timesText(entry.count)})`;
            wasUnique = true;
        }
        else {
            if (uniqHeaders && wasUnique) {
                lines.push('');
                wasUnique = false;
            }
            if (entry.count === 1) {
                text = withIndefiniteArticle(entry.name);
            }
            else {
                text = `${String(entry.count).padStart(3)} ${makePlural(entry.name)}`;
            }
        }
        const indent = vanquishedIndent(text) + (classHeaders ? 1 : 0);
        lines.push(' '.repeat(indent) + text);
    }
    if (entries.length > 1)
        lines.push('');
    if (entries.length > 1)
        lines.push(`${total} creatures vanquished.`);
    return lines;
}
// C insight.c:num_gone()/num_genocides()/num_extinct(): end-of-game
// disclosure reports genocides and extinctions together; uniques are
// never listed, and a species carrying both flags counts once.
function goneSpecies() {
    return (game.mvitals || []).flatMap((vital, mnum) => {
        const flags = vital?.mvflags ?? 0;
        if (!flags || speciesIsUnique(mnum))
            return [];
        const genocided = !!(flags & G_GENOD);
        const extinctOnly = (flags & (G_GENOD | G_EXTINCT)) === G_EXTINCT;
        return genocided || extinctOnly
            ? [{ mnum, genocided, extinctOnly }] : [];
    });
}
function genocidedLines(gone, genocided, extinct) {
    let mode = vanqSortMode();
    // C list_genocided(): with more than one species the shared sort mode
    // drives the order, except that counting orders degrade to plain
    // alphabetical because every listed species counts once.
    if (gone.length > 1
        && (mode === VANQ_COUNT_H_L || mode === VANQ_COUNT_L_H))
        mode = VANQ_ALPHA_MIX;
    const ordered = gone.length > 1
        ? [...gone].sort((a, b) => vanqsortCompare(mode, a.mnum, b.mnum))
        : gone;
    const classHeaders = gone.length > 1
        && (mode === VANQ_MCLS_LTOH || mode === VANQ_MCLS_HTOL);
    const lines = [
        `${genocided ? 'Genocided' : 'Extinct'}${extinct && genocided ? ' or extinct' : ''} species:`,
        '',
    ];
    let previousClass = 0;
    for (const species of ordered) {
        const mlet = MONSTER_SYMBOL[species.mnum] ?? 0;
        if (classHeaders && mlet !== previousClass) {
            lines.push(upstart(MONSTER_CLASS_EXPLAIN[mlet] ?? ''));
            previousClass = mlet;
        }
        const name = makePlural(MONSTER_NAME[species.mnum] || 'monster');
        lines.push(` ${name}${species.extinctOnly ? ' (extinct)' : ''}`);
    }
    lines.push('');
    if (genocided > 0)
        lines.push(`${genocided} species genocided.`);
    if (extinct > 0)
        lines.push(`${extinct} species extinct.`);
    return lines;
}
function visitedMainDungeonLevels() {
    const levels = new Set();
    if ((game.u?.uz?.dnum ?? 0) === 0)
        levels.add(game.u.uz?.dlevel || 1);
    for (const key of game._levelCache?.keys?.() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        if (dnum === 0 && dlevel !== undefined && Number.isInteger(dlevel))
            levels.add(dlevel);
    }
    return [...levels].sort((a, b) => a - b);
}
function overviewLines(killer, deathVerb = 'killed', deathCause = null) {
    const cause = deathCause || deathCauseRecord(killer, deathVerb);
    if (game._tutorialActive) {
        return [
            'The Dungeons of Doom:',
            '   Level 1:',
            'The Tutorial:',
            '   Level 1: <- You were here.',
            '      Final resting place for',
            `         you, ${cause}.`,
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
        if (current && !['quit', 'escaped', 'ascended'].includes(deathVerb)) {
            lines.push('      Final resting place for');
            lines.push(`         you, ${cause}.`);
        }
    }
    return lines;
}
function gameSummaryValues(outcome) {
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
    if (outcome === 'died')
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
            while (count > 0 && remaining[count] !== ' ')
                count--;
            if (count === 0)
                count = 16;
        }
        rows.push(remaining.slice(0, count));
        remaining = remaining[count] === ' '
            ? remaining.slice(count + 1) : remaining.slice(count);
    }
    return rows;
}
function deathSummaryLines(killer, { gold, score, depth, moves }, { deathVerb = 'died', deathCause = null, deathType = null, } = {}) {
    const name = game.plname || 'player';
    const year = String(game.datetime || '').slice(0, 4) || '2026';
    const role = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const goodbye = game.urole?.goodbye || 'Goodbye';
    const deathDungeon = game._tutorialActive
        ? 'The Tutorial' : currentDungeonName();
    const causeRows = tombstoneDeathRows(deathCause || deathCauseRecord(killer, deathVerb));
    const stone = [
        [23, '----------'],
        [22, '/          \\'],
        [21, '/    REST    \\'],
        [20, '/      IN      \\'],
        [19, '/     PEACE      \\'],
        [18, '/                  \\'],
        [18, `|${tombstoneLine(name)}|`],
        [18, `|${tombstoneLine(`${gold} Au`)}|`],
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
        `You ${deathVerb} in ${deathDungeon} on dungeon level ${depth} with ${score} points,`,
        `and ${gold} pieces of gold, after ${moves} moves.`,
        `You were level ${game.u?.ulevel || 1} with a maximum of ${game.u?.uhpmax || 1} hit points when you ${deathVerb}.`,
        '',
    ];
}
function roleGoodbye() {
    return game.urole?.goodbye || 'Goodbye';
}
function roleName() {
    return game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
}
function renderQuitSummaryPage({ gold, score, depth, moves }) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = false;
    terminalLine(0, 0, `${roleGoodbye()} ${game.plname || 'player'} the ${roleName()}...`);
    terminalLine(2, 0, `You quit in ${currentDungeonName()} on dungeon level ${depth} with ${score} points,`);
    terminalLine(3, 0, `and ${gold} pieces of gold, after ${moves} moves.`);
    terminalLine(4, 0, `You were level ${game.u?.ulevel || 1} with a maximum of ${game.u?.uhpmax || 1} hit points when you quit.`);
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
function deathCauseRecord(killer, deathVerb = 'died') {
    const raw = String(killer || 'unknown cause');
    if (deathVerb !== 'died')
        return `${deathVerb} by ${raw}`;
    if (/^(?:an?|the) /i.test(raw)
        || /^(?:Mr|Mrs|Ms|Miss|Sir|Lady|Lord)\.?\s/.test(raw))
        return `killed by ${raw}`;
    const article = /^[aeiou]/i.test(raw) ? 'an' : 'a';
    return `killed by ${article} ${raw}`;
}
function currentScoreRecord(summary, { outcome = 'died', killer = '', deathVerb = 'died', deathCause = null, } = {}) {
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
        death: outcome === 'quit' ? 'quit'
            : deathCause || deathCauseRecord(killer, deathVerb),
    };
}
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
function capitalizeScoreCause(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
function scoreEntryText(record, rank) {
    const rankText = rank ? String(rank).padStart(3) : '   ';
    const points = String(record.points || 0).padStart(10);
    let line = `${rankText} ${points}  ${record.name.slice(0, 10)}-${record.role}${record.race.startsWith('?') ? '' : `-${record.race}`}-${record.gender}${record.align.startsWith('?') ? '' : `-${record.align}`} `;
    const death = record.death;
    const astralDungeon = !!game.astral_level
        && record.deathdnum === game.astral_level.dnum;
    if (death.startsWith('ascended'))
        return `${line}ascended to demigod${record.gender.startsWith('F') ? 'dess' : ''}-hood.`;
    if (death.startsWith('escaped')) {
        const circumstance = death.slice(7).startsWith(' (') ? death.slice(9) : '';
        line += `escaped the dungeon ${circumstance}[max level ${record.maxlvl}]`;
        const closing = line.indexOf(')');
        if (closing >= 0)
            line = astralDungeon ? line.slice(0, closing)
                : line.slice(0, closing) + ' ' + line.slice(closing + 1);
        return `${line}.`;
    }
    const quit = death.startsWith('quit');
    const starved = death.startsWith('died of st');
    line += quit ? 'quit' : starved ? 'starved to death'
        : death.startsWith('choked') ? `choked on h${record.gender.startsWith('F') ? 'er' : 'is'} food`
            : death.startsWith('poisoned') ? 'was poisoned'
                : death.startsWith('crushed') ? 'was crushed to death'
                    : death.startsWith('petrified by ') ? 'turned to stone' : 'died';
    if (astralDungeon) {
        const plane = new Map([[-5, 'Astral'], [-4, 'Water'], [-3, 'Fire'], [-2, 'Air'], [-1, 'Earth']]).get(record.deathlev) || 'Void';
        line += record.deathlev === -5 ? ` on the ${plane} Plane`
            : ` on the Plane of ${plane}`;
    }
    else {
        line += ` in ${record.dungeon}`;
        if (!game.knox_level || record.deathdnum !== game.knox_level.dnum)
            line += ` on level ${record.deathlev}`;
        if (record.deathlev !== record.maxlvl)
            line += ` [max ${record.maxlvl}]`;
    }
    if (death.startsWith('quit '))
        line += death.slice(4);
    line += '.';
    if (!quit && !starved)
        line += `  ${capitalizeScoreCause(death)
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
        if (split <= 15)
            split = wrapColumn - 1;
        if (split > 5 && line.slice(split - 5, split) === ' [max')
            split -= 5;
        const remainder = line[split] === ' '
            ? line.slice(split + 1) : line.slice(split);
        let emitted = line.slice(0, split);
        if (bold)
            emitted = emitted.padEnd(79);
        lines.push(emitted);
        line = `${' '.repeat(16)}${remainder}`;
    }
    const hpColumn = 80 - 7 - hp.length;
    if (line.length <= hpColumn) {
        line = line.padEnd(hpColumn) + hp
            + ` ${record.maxhp < 10 ? '  '
                : record.maxhp < 100 ? ' ' : ''}[${record.maxhp}]`;
    }
    if (bold)
        line = line.padEnd(79);
    lines.push(line);
    return lines;
}
function scoreListLines(current, update, stopPrinting) {
    const lines = [{ text: '' }];
    if (update.previous) {
        lines.push({ text: `You didn't beat your previous score of ${update.previous.points} points.` }, { text: '' });
    }
    if (stopPrinting)
        return lines;
    if (update.inserted) {
        const rank = update.rank;
        const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'th'
            : (['th', 'st', 'nd', 'rd'][rank % 10] || 'th');
        lines.push({ text: update.rank <= 10
                ? 'You made the top ten list!'
                : `You reached the ${rank}${suffix} place on the top 100 list.`,
        }, { text: '' });
    }
    const top = game.flags.end_top ?? 3;
    const around = game.flags.end_around ?? 2;
    const own = game.flags.end_own ?? false;
    if (!top && !around && !own)
        return lines;
    lines.push({ text: ' No  Points     Name                                                   Hp [max]' });
    const addEntry = (record, rank, bold) => {
        for (const text of wrappedScoreEntryLines(record, rank, bold))
            lines.push({ text, attr: bold ? ATR_BOLD : 0 });
    };
    const aroundStart = update.rank - around;
    for (const [index, record] of update.records.entries()) {
        const rank = index + 1;
        if (!(rank <= top
            || (rank >= aroundStart && rank <= update.rank + around) || own))
            continue;
        if (rank === aroundStart
            && update.rank > top + around + 1 && !own)
            lines.push({ text: '' });
        addEntry(record, rank, rank === update.rank);
        if (record === update.previous)
            addEntry(current, 0, true);
    }
    if (update.rank > update.records.length)
        addEntry(current, 0, true);
    return lines;
}
// C end.c:really_done()/topten(): raw scores have no input wait. NHW_TEXT
// scores retain tty paging, then exit_nhwindows clears the terminal.
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
const DISCLOSURE_CATEGORIES = ['i', 'a', 'v', 'g', 'c', 'o'];
function endDiscloseSettings() {
    const settings = {
        i: '', a: '', v: '', g: '', c: '', o: '',
    };
    const raw = game.flags?.disclose;
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
// C insight.c:set_vanq_order().  A PICK_ONE menu over the vanqorders
// table; the currently chosen order is preselected, and Escape cancels
// by leaving the menu unanswered (select_menu returns -1).
const VANQ_ORDER_CHOICES = [
    [VANQ_MLVL_MNDX, 't'], [VANQ_MSTR_MNDX, 'd'], [VANQ_ALPHA_SEP, 'a'],
    [VANQ_ALPHA_MIX, 'A'], [VANQ_MCLS_HTOL, 'C'], [VANQ_MCLS_LTOH, 'c'],
    [VANQ_COUNT_H_L, 'n'], [VANQ_COUNT_L_H, 'z'],
];
function vanqOrderDescription(mode, forVanquished) {
    switch (mode) {
        case VANQ_MLVL_MNDX:
            return 'traditional: by monster level, by internal monster index';
        case VANQ_MSTR_MNDX:
            return 'by monster difficulty rating, by internal monster index';
        case VANQ_ALPHA_SEP:
            // Uniques cannot be genocided, so their separation is unlisted there.
            return forVanquished
                ? 'alphabetically, first unique monsters, then others'
                : 'alphabetically';
        case VANQ_MCLS_LTOH:
            return 'by monster class, low to high level within class';
        case VANQ_COUNT_H_L:
            return 'by count, high to low, by internal index within tied count';
        default:
            return 'by count, low to high, by internal index within tied count';
    }
}
async function setVanqOrder(forVanquished) {
    const current = vanqSortMode();
    const rows = ['', `Sort order for ${forVanquished
            ? 'vanquished monster counts (also genocided types)'
            : 'genocided monster types (also vanquished counts)'}`];
    const choices = new Map();
    for (const [mode, letter] of VANQ_ORDER_CHOICES) {
        // The two uppercase orders exist in the comparator but stay
        // unlisted; counting orders don't apply to genocided species.
        if (mode === VANQ_ALPHA_MIX || mode === VANQ_MCLS_HTOL
            || (!forVanquished
                && (mode === VANQ_COUNT_H_L || mode === VANQ_COUNT_L_H)))
            continue;
        rows.push(`${letter} ${mode === current ? '+' : '-'} ${vanqOrderDescription(mode, forVanquished)}`);
        choices.set(letter, mode);
    }
    const selected = await showPagedPickOneMenu({ rows, choices });
    if (selected === null)
        return -1;
    game.flags.vanqSortmode = selected;
    return selected;
}
// C yn_function(): the answer set is shown as "[ynq]"; answers hidden
// behind ESC (the single-vanquished-species 'a') stay acceptable.
async function ynQuestion(question, visible, defquery, { hiddenAll = false } = {}) {
    const choices = visible === 'ynaq' || hiddenAll ? ['y', 'n', 'a', 'q'] : ['y', 'n', 'q'];
    return await promptChoice(`${question} [${visible}] (${defquery}) `, choices, defquery, 0);
}
// C end.c:disclose().  Shared by death, quitting, escape, and ascension.
// Each category consults the end_disclose option first: it either fixes
// the answer outright or asks with the option's default.
async function discloseGame({ killer = '', deathVerb = 'died', deathCause = null, possessionAnswer = null, taken = false, } = {}) {
    // really_done() displays WIN_MESSAGE before disclosure or bones.
    await displayMessageWindow();
    // The final message window retains the status drawn by the fatal caller.
    // Disclosure uses committed HP after that message has been acknowledged.
    delete game._statusHpOverride;
    let livingCat = false;
    for (const object of game.inventory) {
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
            possessionAnswer = ask ? await ynQuestion(question, 'ynq', defquery)
                : defquery;
        }
        if (possessionAnswer === 'y')
            await showIdentifiedInventory();
        if (possessionAnswer === 'q')
            return stopDisclosure();
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('a');
        const attributes = ask
            ? await ynQuestion('Do you want to see your attributes?', 'ynq', defquery)
            : defquery;
        if (attributes === 'y')
            await showFinalAttributes();
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
                await showDisclosureOverlay(vanquishedLines());
        }
    }
    // C list_genocided(): nothing is asked when no species is gone, and
    // the question adapts to which of genocided/extinct apply.
    if (!game.program_state.stopprint) {
        const gone = goneSpecies();
        const genocided = gone.filter(species => species.genocided).length;
        const extinct = gone.filter(species => species.extinctOnly).length;
        if (gone.length > 0) {
            const { ask, defquery } = shouldQueryDiscloseOption('g');
            const question = `Do you want a list of ${extinct && !genocided ? 'extinct ' : ''}species${genocided ? ' genocided' : ''}${extinct && genocided ? ' and extinct' : ''}?`;
            const multiple = gone.length > 1;
            // Unlike the vanquished question, one gone species keeps an
            // 'a' default visible in "(a)" while the choice stays hidden.
            const answer = ask
                ? await ynQuestion(question, multiple ? 'ynaq' : 'ynq', defquery, { hiddenAll: !multiple })
                : defquery;
            if (answer === 'q')
                return stopDisclosure();
            if (answer === 'y' || answer === 'a') {
                if (!(answer === 'a' && multiple
                    && await setVanqOrder(false) < 0))
                    await showDisclosureOverlay(genocidedLines(gone, genocided, extinct));
            }
        }
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('c');
        const achievements = achievementEntries(game).length;
        const question = 'Do you want to see your conduct'
            + (achievements > 0 ? ' and achievements' : '') + '?';
        const conduct = ask
            ? await ynQuestion(question, 'ynq', defquery) : defquery;
        if (conduct === 'y')
            await showDisclosureOverlay(finalConductLines());
        if (conduct === 'q')
            return stopDisclosure();
    }
    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('o');
        const overview = ask
            ? await ynQuestion('Do you want to see the dungeon overview?', 'ynq', defquery)
            : defquery;
        if (overview === 'y') {
            await showDisclosureOverlay(overviewLines(killer, deathVerb, deathCause), {
                marker: '(end)', minWidth: game._tutorialActive ? 38 : 39,
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
function stopDisclosure() {
    game.program_state.stopprint = (game.program_state.stopprint ?? 0) + 1;
    return false;
}
async function startGameExit(outcome, deathType = DIED) {
    game.program_state.gameover = true;
    game.program_state.something_worth_saving = false;
    await doneObjectCleanup();
    game._canMakeBones = outcome === 'died' && deathType < GENOCIDED
        && canMakeBones();
}
async function settleGameExit(outcome) {
    const silent = !!game.program_state.stopprint;
    const publish = async (message) => {
        // A real pline updates status; an existing death message alone
        // retains the status painted by the fatal caller.
        delete game._statusHpOverride;
        await plineWithContinuation(message);
    };
    const taken = await settleShopkeepersOnExit(outcome, { silent, publish });
    await payVaultGuardOnExit({ silent, publish });
    await clearNonlocalPriestsOnExit();
    return taken;
}
export async function finishOrdinaryDeath(options) {
    await startGameExit('died', options.deathType ?? DIED);
    if (options.deathType != null)
        setHeroRemainsFromDeath(options.deathType, game);
    await completeOrdinaryDeath(options);
}
async function completeOrdinaryDeath({ killer, possessionAnswer = null, deathVerb = 'died', deathCause = null, deathType = null, }) {
    game._deathKiller = killer;
    const taken = await settleGameExit('died');
    const showSummary = await discloseGame({ killer, deathVerb, deathCause, possessionAnswer, taken });
    if (game._canMakeBones && taken)
        await finishShopkeeperRepossession();
    // really_done() counts remaining loose and contained gold before bones
    // removes the inventory. Repossessed gold has already left the hero.
    const summary = gameSummaryValues('died');
    game.u.urexp = summary.score;
    await createBonesFromDeath(deathCause || deathCauseRecord(killer, deathVerb), promptDeathQuestion);
    if (showSummary) {
        game._preserveLeadingStyledBlanks = false;
        await showTextWindow(deathSummaryLines(killer, summary, { deathVerb, deathCause, deathType }));
    }
    await finishScoreDisplay(currentScoreRecord(summary, {
        killer, deathVerb, deathCause,
    }), { stopPrinting: !showSummary });
    game.context.move = 0;
}
export async function doquit() {
    const answer = await promptYesNo('Really quit without saving? [yn] (n) ');
    if (answer !== 'y') {
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
        return;
    }
    await finishOrdinaryQuit();
}
// C refs: end.c done(QUIT)/really_done().  QUIT skips the tombstone,
// but otherwise owns disclosures, a role-aware summary text window, and the
// score-list handoff as one terminal transaction.
export async function finishOrdinaryQuit() {
    requireInitializedHero(game.u);
    await bot();
    await startGameExit('quit');
    // really_done() admits bones while the outcome is still QUIT, then
    // converts an already-dead hero without another death or recovery phase.
    if (game.u.uhp < 1) {
        game.u.umortality = (game.u.umortality ?? 0) + 1;
        game._canMakeBones = false;
        const cause = "quit while already on Charon's boat";
        await completeOrdinaryDeath({ killer: cause, deathCause: cause });
        return;
    }
    const taken = await settleGameExit('quit');
    const showSummary = await discloseGame({ deathVerb: 'quit', taken });
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
    const showSummary = await discloseGame({ deathVerb: outcome, taken });
    const pets = takeEscapingPets();
    const summary = gameSummaryValues(outcome);
    const possessions = collectFinalPossessions();
    summary.score += possessions.points;
    for (const pet of pets)
        summary.score += pet.mhp;
    const names = pets.map(pet => pet.name || `the ${MONSTER_NAME[pet.mnum]}`);
    if (possessions.quantumCat) {
        summary.score += d(adjustedMonsterLevel(MONSTER_NAME.indexOf('housecat')), 8);
        names.push("Schroedinger's cat");
    }
    game.u.urexp = summary.score;
    const disgrace = outcome === 'escaped' && Is_astralevel(game.u.uz);
    const current = currentScoreRecord(summary, {
        outcome, deathCause: outcome + (disgrace ? ' (in celestial disgrace)' : ''),
    });
    if (showSummary) {
        const title = outcome === 'ascended'
            ? (game.flags.female ? 'Demigoddess' : 'Demigod') : roleName();
        const lines = [`${roleGoodbye()} ${game.plname || 'player'} the ${title}...`, ''];
        const company = ['You', ...names].join(' and ');
        if (names.length)
            lines.push(company);
        const action = outcome === 'ascended' ? 'went to your reward' : 'escaped from the dungeon';
        lines.push(`${names.length ? '' : 'You '}${action} with ${summary.score} point${summary.score === 1 ? '' : 's'},`);
        lines.push(...await finalPossessionLines(possessions));
        lines.push(`and ${summary.gold} piece${summary.gold === 1 ? '' : 's'} of gold, after ${summary.moves} move${summary.moves === 1 ? '' : 's'}.`);
        lines.push(`You were level ${game.u.ulevel} with a maximum of ${game.u.uhpmax} hit points when you ${outcome}.`);
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
function takeEscapingPets() {
    const pets = [];
    const level = requireGameLevel();
    for (const monster of level.monsters) {
        if (!((monster.mtame ?? 0) > 0) || monster.dead || monster.mhp <= 0)
            continue;
        monster.mtrapped = monster.meating = monster.msleeping = monster.mfrozen = 0;
        monster.mcanmove = 1;
        if ((monster.mstrategy ?? 0) & STRAT_WAITFORU)
            continue;
        if (Math.max(Math.abs(monster.mx - game.u.ux), Math.abs(monster.my - game.u.uy)) > 1)
            continue;
        if ((monster.minvent || []).some(object => object.otyp === AMULET_OF_YENDOR))
            continue;
        pets.unshift(monster);
        monster.mx = monster.my = 0;
        monster.mlstmv = game.moves;
    }
    level.monsters = level.monsters.filter(monster => !pets.includes(monster));
    return pets;
}
function objectBaseValue(type) {
    const value = OBJECT_COST[type];
    if (value === undefined)
        throw new RangeError(`No base value for object type ${type}`);
    return value;
}
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
                    name: artifact?.name || `The ${OBJECT_NAMES[object.otyp]}` });
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
        return Number(aIsGem) - Number(bIsGem) || countB - countA || a - b;
    });
    for (const [type, count] of groups)
        points += count * objectBaseValue(type);
    return { points, artifacts, valuables: groups, quantumCat };
}
async function finalPossessionLines(possessions) {
    const lines = possessions.artifacts.map(({ object, value, points, name }) => {
        recordObjectKnowledge(object.otyp);
        object.known = object.dknown = object.bknown = object.rknown = true;
        return `${name} (worth ${value} zorkmids and ${points} points)`;
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
            lines.push(`${prefix} ${count === 1 ? name : makePlural(name)} (worth ${worth} zorkmids),`);
            await deleteObject(object);
        }
    }
    return lines;
}
//# sourceMappingURL=end.js.map