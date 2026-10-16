// end.js — End-of-game disclosure and terminal presentation.
// C refs: end.c disclose()/really_done(), insight.c, dungeon.c.

import { formatFeltMessage } from './hero_speech.js';
import { recorderLocalEpochSeconds } from './calendar.js';
import { adjustAttribute, currentAttribute, reportHeroEncumbrance } from './attrib.js';
import { cureHeroSickness } from './hero_illness.js';
import { removeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { resetHeroTrap } from './terrain_movement.js';
import { PARANOID_DIE, PARANOID_QUIT, PLNMSG_OK_DONT_DIE } from './const.js';
import { PanicTermination } from './panic_termination.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { achievementEntries, recordAchievement } from './achievements.js';
import { game, requireInitializedGame } from './gstate.js';
import { expelHero, releaseHeroFromMonster } from './hero_expulsion.js';
import { heroFormSticks } from './hero_species.js';
import { monsterName } from './monster_name.js';
import { collectLevelFollowers } from './monster_followers.js';
import { scheduleLevelChange } from './level_change.js';
import { nhgetch } from './input.js';
import {
    bot, clearMessageWindow, displayMessageWindow, flush_screen, pline, plineWithContinuation,
} from './display.js';
import { consumeInventoryItem, identifyObjectForDisclosure, showIdentifiedInventory } from './invent.js';
import { containerContents } from './container_contents.js';
import { finalConductLines, showFinalAttributes } from './insight.js';
import {
    ATR_INVERSE, ATR_NONE, showDisclosureOverlay, showInventoryWindow, showTextPages, showTextWindow,
} from './windows.js';
import { artifactById } from './artifacts.js';
import {
    MONSTER_CLASS_EXPLAIN, MONSTER_DIFFICULTY, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { ATR_BOLD, NO_COLOR } from './terminal.js';
import { d, rn2 } from './rng.js';
import { mksobj } from './mklev.js';
import { adjustedMonsterLevel } from './monster_hit_points.js';
import { deleteObject } from './object_delete.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { objectName } from './objnam.js';
import { objectClassForType, recordObjectEncounter, recordObjectKnowledge } from './object_knowledge.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { deepestLevelReached, depth } from './hacklib.js';
import { recordGameLogEvent } from './gamelog.js';
import { hiddenGold } from './gold.js';
import { heroGoldAmount } from './hero_gold.js';
import { doneObjectCleanup } from './object_cleanup.js';
import { restoreHeroNutrition } from './hunger.js';
import {
    A_CON, A_WIS, ACH_BLND, ACH_NUDE, ACH_UWIN, ASCENDED, BURNING, CHOKING, DIED, ESCAPED, G_EXTINCT, G_GENOD, GENOCIDED,
    PANICKED, QUIT, STARVING, STONING, TRICKED,
    In_endgame, In_quest, Is_astralevel, Is_knox_level, KILLED_BY, KILLED_BY_AN, NO_KILLER_PREFIX, PICK_ONE, TT_LAVA, Upolyd,
} from './const.js';
import {
    AMULET_OF_LIFE_SAVING, BELL_OF_OPENING, FAKE_AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION, JADE, OBJECT_COST, OBJECT_NAMES,
    SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { createBonesFromDeath } from './bones_death.js';
import { canMakeBones } from './bones_admission.js';
import { restoreLaunchedObjectForBones } from './rolling_boulder.js';
import { heroIsBlind } from './senses.js';
import { finishShopkeeperRepossession, settleShopkeepersOnExit } from './shop_settlement.js';
import type { ShopExitOutcome } from './shop_settlement.js';
import { payVaultGuardOnExit } from './vault_exit.js';
import { currency } from './currency.js';
import { clearNonlocalPriestsOnExit } from './priest.js';
import { paranoidQuery, promptChoice, promptYesNo } from './query.js';
import {
    clearHeroRemains, setHeroRemainsFromDeath,
} from './death_remains.js';

import { loadScoreRecords, saveScoreRecords } from './score_records.js';
import { requireInitializedHero } from './hero_types.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { InventoryMenuItem, TextMenuEntry, TextMenuLine, TextPage } from './windows.js';
import type { ScoreOutcome, ScoreRecord } from './score_records.js';

export interface DeathDamage {
    hpKey: 'mh' | 'uhp';
    hpBefore: number;
    damage: number;
}

export type KillerFormat = typeof KILLED_BY | typeof KILLED_BY_AN | typeof NO_KILLER_PREFIX;

export interface OrdinaryDeathOptions {
    killer: string;
    killerFormat?: KillerFormat;
    possessionAnswer?: string | null;
    deathVerb?: string;
    deathCause?: string | null;
    deathType?: number | null;
}

export interface FinishHeroDeathOptions extends OrdinaryDeathOptions {
    beforeFinalDeath?: (() => unknown) | null;
    deathLineShown?: boolean;
    /** Raw lethal damage is available to handlers which defer death presentation. */
    damage?: DeathDamage;
}

export type DeathHandler = (options: FinishHeroDeathOptions) => boolean | Promise<boolean>;
/** Terminal death callers await the transition and discard its return value. */
export type OrdinaryDeathHandler = (options: OrdinaryDeathOptions) => unknown;
export interface LifeSavingTransaction { amulet: GameObject }
interface RevivalOptions { deathType?: number | null }
type LivingOutcome = 'escaped' | 'ascended';
interface GameSummary { gold: number; score: number; depth: number; moves: number }
interface DeathDescription { deathVerb?: string; deathCause?: string | null }
interface DisclosureOptions extends DeathDescription {
    killer?: string;
    possessionAnswer?: string | null;
    taken?: boolean;
}
interface ScoreOptions extends DeathDescription {
    outcome?: ScoreOutcome;
    killer?: string;
    deathType?: number | null;
}
interface ScoreUpdate {
    records: ScoreRecord[];
    rank: number;
    inserted: boolean;
    previous?: ScoreRecord | null | undefined;
}
interface FinalArtifact { object: GameObject; value: number; points: number; name: string }
interface FinalPossessions {
    points: number;
    artifacts: FinalArtifact[];
    valuables: Array<[number, number]>;
    quantumCat: boolean;
}

export { SCORE_RECORD_STORAGE_KEY } from './score_records.js';

const AMULET_CLASS = 5;
const GEM_CLASS = 13;

// C end.c:done() records the fatal event before "But wait...". The caller
// identifies the amulet after that message returns, then consumes it and
// revives the hero after the crumble message.
export function beginHeroLifeSaving(): LifeSavingTransaction | null {
    const amulet = game.uamul || game.u?.uamul;
    if (amulet?.otyp !== AMULET_OF_LIFE_SAVING) return null;

    recordHeroFatalEvent();
    return { amulet };
}

function recordHeroFatalEvent(): void {
    game.u.umortality = (game.u.umortality || 0) + 1;
    if (game.u.uhp !== 0 || (Upolyd(game.u) && game.u.mh !== 0)) {
        game.u.uhp = 0;
        game.u.mh = 0;
        game.context.botl = true;
    }
}

export function identifyLifeSavingAmulet(random = rn2): void {
    recordObjectEncounter(AMULET_OF_LIFE_SAVING);
    if (!game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING)) {
        recordObjectKnowledge(AMULET_OF_LIFE_SAVING);
        if (!game.u._exercise)
            game.u._exercise = [0, 0, 0, 0, 0, 0];
        if (Math.abs(game.u._exercise[A_WIS]) < 50)
            game.u._exercise[A_WIS] += random(19) > currentAttribute(A_WIS) ? 1 : 0;
    }
}

export async function completeHeroLifeSaving(
    transaction: LifeSavingTransaction | null | undefined,
    { deathType = null }: RevivalOptions = {},
): Promise<boolean> {
    const amulet = transaction?.amulet;
    if (!amulet) return false;

    await consumeInventoryItem(amulet, game);

    const change = adjustAttribute(A_CON, -1);
    if (change.changed && game.program_state.in_moveloop)
        await reportHeroEncumbrance();

    await restoreHeroAfterDeath({ deathType });
    if (game.program_state.gameover) return false;
    if (deathType === GENOCIDED) return false;
    game._lifeSavedCount = (game._lifeSavedCount || 0) + 1;
    return true;
}

// C ref: end.c:savelife().  Wizard/explore refusal and amulet life saving
// share this viability repair after their distinct prompt/item transactions.
export async function restoreHeroAfterDeath({ deathType = null }: RevivalOptions = {}) {
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
        await plineWithContinuation(restoreHeroNutrition());
    if (game.u.sickTurns === 1) cureHeroSickness();
    game.context.move = 0;
    // end.c:savelife() replaces any earlier negative multi (including a
    // monster paralysis spell) with exactly -1.  The interrupted actor can
    // finish its remaining attack slots, but no older helpless interval may
    // allocate another autonomous monster turn afterward. The shared
    // helplessness recovery publishes nomovemsg when that turn ends.
    endVoluntaryMultiTurn(game);
    game.multi = -1;
    game._helplessTurns = 1;
    game._helplessReason = game.urole?.key === 'tourist'
        ? 'being toyed with by Fate' : 'attempting to cheat Death';
    game._helplessDoneMessage = 'You survived that attempt on your life.';
    if (game.u.utrap && game.u.utraptype === TT_LAVA)
        await resetHeroTrap(false);
    game.context.botl = true;
    clearHeroRemains(game);
    setPropertyTimeout('unchanging', 0);
    removeIntrinsicProperty('unchanging');
    await flush_screen(1);
    const holder = game.u.ustuck;
    if (game.u.uswallow) {
        if (!holder) throw new Error('Swallowed hero has no engulfing monster');
        await expelHero(holder);
    } else if (holder) {
        const heroHoldsMonster = heroFormSticks(game);
        const name = monsterName(holder, { capitalized: !heroHoldsMonster });
        await plineWithContinuation(heroHoldsMonster
            ? `You release ${name}.` : `${name} releases you.`);
        await releaseHeroFromMonster(holder);
    }
    return game.u.uhp;
}

export async function finishHeroDeath({
    killer,
    killerFormat = KILLED_BY_AN,
    beforeFinalDeath = null,
    deathCause = null,
    deathVerb = 'died',
    deathLineShown = false,
    deathType = null,
}: FinishHeroDeathOptions): Promise<boolean> {
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
    if (how !== PANICKED && !game.program_state.panicking) await bot();
    if (how < PANICKED) recordHeroFatalEvent();
    const amulet = game.uamul || game.u?.uamul;
    if (how <= GENOCIDED && amulet?.otyp === AMULET_OF_LIFE_SAVING) {
        await plineWithContinuation('But wait...');
        identifyLifeSavingAmulet();
        await plineWithContinuation(`Your medallion ${heroIsBlind() ? 'feels warm' : 'begins to glow'}!`);
        if (deathType === CHOKING) await plineWithContinuation('You vomit ...');
        await plineWithContinuation(formatFeltMessage('much better!'));
        await plineWithContinuation('The medallion crumbles to dust!');
        await completeHeroLifeSaving({ amulet }, { deathType });
        if (game.program_state.gameover) return true;
        if (deathType === GENOCIDED) {
            await plineWithContinuation('Unfortunately you are still genocided...');
        } else {
            return false;
        }
    }

    if (how <= GENOCIDED && (game.flags?.debug || game.flags?.explore || game.discover)) {
        const answer = await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_DIE), 'Die?');
        if (!answer) {
            await plineWithContinuation(`OK, so you don't ${how === CHOKING ? 'choke' : 'die'}.`);
            game._lastPlineKind = PLNMSG_OK_DONT_DIE;
            await restoreHeroAfterDeath({ deathType });
            if (game.program_state.gameover) return true;
            return false;
        }
    }

    if (how !== PANICKED) await beforeFinalDeath?.();
    setHeroRemainsFromDeath(deathType, game);
    await finishOrdinaryDeath({ killer, killerFormat, deathCause, deathVerb, deathType });
    return true;
}

function conductState(state: GameState = game) {
    if (!state.u.uconduct) state.u.uconduct = {};
    return state.u.uconduct;
}

// xkilled() breaks killer conduct before its credited kill pline can suspend
// on an older tty message.  Vanquished/mvitals bookkeeping happens later,
// after mondead(), so keep this mutation independently callable.
export function recordHeroKillConduct(state: GameState = game) {
    const conduct = conductState(state);
    const firstKill = !(conduct.killer || 0);
    conduct.killer = (conduct.killer || 0) + 1;
    if (firstKill)
        recordGameLogEvent('killed for the first time', { state });
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

function vanqSortMode(): number {
    return game.flags.vanqSortmode ?? VANQ_MLVL_MNDX;
}

function speciesIsUnique(mnum: number): boolean {
    return !!((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) && mnum !== PM_HIGH_CLERIC;
}

function monsterClassOrder(mlet: number): number {
    if (mlet > S_ZOMBIE) {
        const position = PUNCTUATION_CLASS_ORDER.indexOf(mlet);
        if (position >= 0) return S_ZOMBIE + 1 + position;
    }
    return mlet;
}

function compareCaseInsensitive(left: string, right: string): number {
    return left.toLowerCase() < right.toLowerCase() ? -1
        : left.toLowerCase() > right.toLowerCase() ? 1 : 0;
}

// C insight.c:vanqsort_cmp() over internal monster indexes.
function vanqsortCompare(mode: number, mnum1: number, mnum2: number): number {
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
        result = compareCaseInsensitive(
            MONSTER_NAME[mnum1] || '', MONSTER_NAME[mnum2] || '');
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
                if (mode === VANQ_MCLS_HTOL) result = -result;
            }
        }
        break;
    }
    case VANQ_COUNT_H_L:
    case VANQ_COUNT_L_H: {
        const died1 = game.mvitals?.[mnum1]?.died ?? 0;
        const died2 = game.mvitals?.[mnum2]?.died ?? 0;
        result = died2 - died1;
        if (mode === VANQ_COUNT_L_H) result = -result;
        break;
    }
    default:
        result = (MONSTER_LEVEL[mnum2] ?? 0) - (MONSTER_LEVEL[mnum1] ?? 0);
        break;
    }
    return result === 0 ? mnum1 - mnum2 : result;
}

interface VanquishedEntry {
    mnum: number;
    name: string;
    count: number;
    unique: boolean;
    pname: boolean;
}

function vanquishedEntries(): VanquishedEntry[] {
    return (game.mvitals || []).flatMap((vital, mnum) => {
        const count = vital?.died ?? 0;
        if (!count) return [];
        return [{
            mnum,
            name: MONSTER_NAME[mnum] || 'monster',
            count,
            unique: speciesIsUnique(mnum),
            pname: !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME),
        }];
    }).sort((a, b) => vanqsortCompare(vanqSortMode(), a.mnum, b.mnum));
}

function vanquishedTypeCount(): number {
    return (game.mvitals || []).filter(vital => (vital?.died ?? 0) > 0).length;
}

// C upstart(): capitalize the first letter of a class header.
function upstart(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// C N_times(): "once", "twice", "thrice", then "N times".
function timesText(count: number): string {
    if (count === 2) return 'twice';
    if (count === 3) return 'thrice';
    return `${count} times`;
}

// C list_vanquished() indents each entry so its name column lines up with
// the three-digit count prefix of multiple-kill rows.
function vanquishedIndent(text: string): number {
    if (/^the /i.test(text)) return 0;
    if (/^an /i.test(text)) return 1;
    if (/^a /i.test(text)) return 2;
    return /[0-9]/.test(text.charAt(2)) ? 0 : 4;
}

export function vanquishedLines(ask = false): TextMenuEntry[] {
    const mode = vanqSortMode();
    const entries = vanquishedEntries();
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const classHeaders = (mode === VANQ_MCLS_LTOH || mode === VANQ_MCLS_HTOL)
        && entries.length > 1;
    const uniqHeaders = mode === VANQ_ALPHA_SEP;
    const lines: TextMenuEntry[] = ['Vanquished creatures:', ''];
    let previousClass = 0;
    let wasUnique = false;
    let riderHeader = false;
    for (const entry of entries) {
        const rider = RIDER_MONSTERS.has(entry.mnum);
        const mlet = MONSTER_SYMBOL[entry.mnum] ?? 0;
        if (classHeaders && (mlet !== previousClass || (riderHeader && !rider))) {
            lines.push({
                text: upstart(rider ? 'Rider' : MONSTER_CLASS_EXPLAIN[mlet] ?? ''),
                attr: ask ? ATR_NONE : game.iflags.menu_headings?.attr ?? ATR_INVERSE,
            });
            riderHeader = rider;
            previousClass = mlet;
        }
        let text: string;
        if (entry.unique) {
            text = `${entry.pname ? '' : 'the '}${entry.name}`;
            if (entry.count > 1) text += ` (${timesText(entry.count)})`;
            wasUnique = true;
        } else {
            if (uniqHeaders && wasUnique) {
                lines.push('');
                wasUnique = false;
            }
            if (entry.count === 1) {
                text = withIndefiniteArticle(entry.name);
            } else {
                text = `${String(entry.count).padStart(3)} ${makePlural(entry.name)}`;
            }
        }
        const indent = vanquishedIndent(text) + (classHeaders ? 1 : 0);
        lines.push(' '.repeat(indent) + text);
    }
    if (entries.length > 1) lines.push('');
    if (entries.length > 1)
        lines.push(`${total} creatures vanquished.`);
    return lines;
}

interface GoneSpecies {
    mnum: number;
    genocided: boolean;
    extinctOnly: boolean;
}

// C insight.c:num_gone()/num_genocides()/num_extinct(): end-of-game
// disclosure reports genocides and extinctions together; uniques are
// never listed, and a species carrying both flags counts once.
function goneSpecies(includeExtinct = true): GoneSpecies[] {
    return (game.mvitals || []).flatMap((vital, mnum) => {
        const flags = vital?.mvflags ?? 0;
        if (!flags || speciesIsUnique(mnum)) return [];
        const genocided = !!(flags & G_GENOD);
        const extinctOnly = (flags & (G_GENOD | G_EXTINCT)) === G_EXTINCT;
        return genocided || (includeExtinct && extinctOnly)
            ? [{ mnum, genocided, extinctOnly }] : [];
    });
}

function genocidedLines(
    gone: GoneSpecies[], genocided: number, extinct: number, ask: boolean,
): TextMenuEntry[] {
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
    const lines: TextMenuEntry[] = [
        `${genocided ? 'Genocided' : 'Extinct'}${extinct && genocided ? ' or extinct' : ''} species:`,
        '',
    ];
    let previousClass = 0;
    for (const species of ordered) {
        const mlet = MONSTER_SYMBOL[species.mnum] ?? 0;
        if (classHeaders && mlet !== previousClass) {
            lines.push({
                text: upstart(MONSTER_CLASS_EXPLAIN[mlet] ?? ''),
                attr: ask ? ATR_NONE : game.iflags.menu_headings?.attr ?? ATR_INVERSE,
            });
            previousClass = mlet;
        }
        const name = makePlural(MONSTER_NAME[species.mnum] || 'monster');
        lines.push(` ${name}${species.extinctOnly ? ' (extinct)' : ''}`);
    }
    lines.push('');
    if (genocided > 0) lines.push(`${genocided} species genocided.`);
    if (extinct > 0) lines.push(`${extinct} species extinct.`);
    return lines;
}

// C insight.c:list_genocided(), shared by live commands and final disclosure.
export async function listGenocided(defquery: DisclosureDefault | 'g' = 'y', ask = false): Promise<void> {
    const genociding = defquery === 'g';
    const defaultAnswer: DisclosureDefault = defquery === 'g' ? 'y' : defquery;
    const includeExtinct = !genociding && !!(game.program_state.gameover
        || game.flags.debug || game.flags.explore || game.discover);
    const gone = goneSpecies(includeExtinct);
    if (!gone.length) {
        if (!game.program_state.gameover)
            await pline(`No creatures have been genocided${genociding ? ' yet' : ''}.`);
        return;
    }
    const genocided = gone.filter(species => species.genocided).length;
    const extinct = gone.filter(species => species.extinctOnly).length;
    const question = `Do you want a list of ${extinct && !genocided ? 'extinct ' : ''}species${
        genocided ? ' genocided' : ''}${extinct && genocided ? ' and extinct' : ''}?`;
    const multiple = gone.length > 1;
    const answer = ask ? await ynQuestion(question, multiple ? 'ynaq' : 'ynq', defaultAnswer,
        { hiddenAll: !multiple }) : defaultAnswer;
    if (answer === 'q') { stopDisclosure(); return; }
    if (answer !== 'y' && answer !== 'a') return;
    if (answer === 'a' && multiple && await setVanqOrder(false) < 0) return;
    await showDisclosureOverlay(genocidedLines(gone, genocided, extinct, ask), {
        restoreUnderlay: true,
    });
}

function visitedMainDungeonLevels() {
    const levels = new Set<number>();
    if ((game.u?.uz?.dnum ?? 0) === 0) levels.add(game.u.uz?.dlevel || 1);
    for (const key of game._levelCache?.keys?.() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        if (dnum === 0 && dlevel !== undefined && Number.isInteger(dlevel)) levels.add(dlevel);
    }
    return [...levels].sort((a, b) => a - b);
}

function overviewLines(killer: string, deathVerb = 'killed', deathCause: string | null = null) {
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

function gameSummaryValues(outcome: ScoreOutcome, deathType = DIED): GameSummary {
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
    if (outcome === 'died' && deathType < PANICKED) score -= Math.trunc(gain / 10);
    const original = game.u.ualignbase?.[1] ?? game.u.ualign.type;
    const current = game.u.ualignbase?.[0] ?? game.u.ualign.type;
    if (outcome === 'ascended' && game.u.ualign.type === original)
        score += current === original ? score : Math.trunc(score / 2);
    return { gold, score, depth: currentDepth, moves: game.moves ?? 1 };
}

function terminalLine(row: number, col: number, value: string, attr = 0) {
    const display = game.nhDisplay;
    for (let index = 0; index < value.length; index++)
        display?.setCell(col + index, row, value.charAt(index), NO_COLOR, attr);
}

function tombstoneLine(value: string | undefined) {
    const text = String(value).slice(0, 16);
    const col = 28 - Math.trunc((text.length + 1) / 2);
    return `${' '.repeat(col - 19)}${text}${' '.repeat(37 - col - text.length)}`;
}

function tombstoneYear(when: number): string {
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
const ENDINGS: readonly string[] = [
    'died', 'choked', 'were poisoned', 'starved', 'drowned', 'burned',
    'dissolved in the lava', 'were crushed', 'turned to stone',
    'turned into slime', 'were genocided', 'panicked', 'were tricked',
    'quit', 'escaped', 'ascended',
];

const DEATH_NAMES: readonly string[] = [
    'died', 'choked', 'poisoned', 'starvation', 'drowning', 'burning',
    'dissolving under the heat and pressure', 'crushed', 'turned to stone',
    'turned into slime', 'genocided', 'panic', 'trickery', 'quit', 'escaped', 'ascended',
];

function finalLocationLine(verb: string, score: number): string {
    const here = game.u.uz;
    let text: string;
    if (here?.dnum === 0 && here.dlevel <= 0) {
        text = `You ${here.dlevel < 0 ? 'passed away' : verb} beyond the confines of the dungeon`;
    } else {
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
function tombstoneDeathRows(cause: string) {
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

function deathSummaryLines(killer: string, { gold, score, moves }: GameSummary, endtime: number, {
    deathVerb = 'died', deathCause = null, deathType = null,
}: DeathDescription & { deathType?: number | null } = {}): string[] {
    const name = game.plname || 'player';
    const year = tombstoneYear(endtime);
    const role = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const goodbye = game.urole?.goodbye || 'Goodbye';
    const stoneGold = Math.min(999_999_999, Math.max(0, gold));
    const causeRows = tombstoneDeathRows(
        sanitizeDeathCause(deathCause || deathCauseRecord(killer, deathVerb)),
    );
    const stone: ReadonlyArray<readonly [number, string]> = [
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
function plur(count: number): string {
    return count === 1 ? '' : 's';
}

function roleGoodbye() {
    return game.urole?.goodbye || 'Goodbye';
}

function roleName() {
    return game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
}

function renderQuitSummaryPage({ gold, score, moves }: GameSummary) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = false;
    terminalLine(
        0, 0,
        `${roleGoodbye()} ${game.plname || 'player'} the ${roleName()}...`,
    );
    terminalLine(
        2, 0,
        finalLocationLine('quit', score),
    );
    terminalLine(3, 0, `and ${gold} piece${plur(gold)} of gold, after ${moves} move${plur(moves)}.`);
    terminalLine(
        4, 0,
        `You were level ${game.u?.ulevel || 1} with a maximum of ${
            game.u?.uhpmax || 1} hit point${plur(game.u?.uhpmax || 1)} when you quit.`,
    );
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

// topten.c:formatkiller() selects the cause prefix from the death type.
// The final summary's verb describes the hero and is a separate choice.
const DEATH_CAUSE_PREFIXES: readonly string[] = [
    'killed by ', 'choked on ', 'poisoned by ', 'died of ',
    'drowned in ', 'burned by ', 'dissolved in ', 'crushed to death by ',
    'petrified by ', 'turned to slime by ', 'killed by ',
    '', '', '', '', '',
];

function deathCauseRecord(
    killer: string, deathVerb = 'died', deathType: number | null = null,
    killerFormat: KillerFormat = KILLED_BY_AN,
) {
    const raw = String(killer || 'unknown cause');
    const prefix = deathType === null ? undefined : DEATH_CAUSE_PREFIXES[deathType];
    if (killerFormat === NO_KILLER_PREFIX || prefix === '') return raw;
    if (prefix === undefined && deathVerb !== 'died') return `${deathVerb} by ${raw}`;
    const name = killerFormat === KILLED_BY ? raw : withIndefiniteArticle(raw);
    return `${prefix ?? 'killed by '}${name}`;
}

// C topten.c:formatkiller() sanitizes killer names for every caller, including rip.c.
function sanitizeDeathCause(cause: string): string {
    return cause.replaceAll(',', ';').replaceAll('=', '_').replaceAll('\t', ' ');
}

// C topten.c:formatkiller(TRUE). Score records include involuntary delay;
// the tombstone, bones epitaph, and overview use the cause without it.
function scoreDeathCause(cause: string, deathType: number | null): string {
    const scoreDeathSize = 100; // C topten.c:DTHSZ, excluding the terminator.
    const cleanCause = sanitizeDeathCause(cause).slice(0, scoreDeathSize);
    if ((game._helplessTurns ?? 0) <= 0 && game.multi >= 0) return cleanCause;
    const helplessness = game._helplessReason;
    let reason = (typeof helplessness === 'string' ? helplessness : helplessness?.text) || 'helpless';
    if (deathType === STONING && reason === 'getting stoned') return cleanCause;
    if (deathType === STARVING && reason === 'fainted from lack of food') reason = 'fainted';
    // formatkiller() consumes a byte while reading the cause terminator,
    // then requires room for the suffix's own terminator too.
    const remaining = scoreDeathSize - cleanCause.length;
    const suffix = `, while ${reason}`;
    return suffix.length + 1 <= remaining ? cleanCause + suffix
        : ', while helpless'.length + 1 <= remaining
            ? `${cleanCause}, while helpless` : cleanCause;
}

function currentScoreRecord(summary: GameSummary, {
    outcome = 'died', killer = '', deathVerb = 'died', deathCause = null, deathType = null,
}: ScoreOptions = {}): ScoreRecord {
    let cause = deathCause || (outcome === 'quit' ? 'quit'
        : deathCauseRecord(killer, deathVerb));
    if (game.u.uhave?.amulet) {
        cause += ' (with the Amulet)';
    } else if (outcome === 'escaped') {
        if (Is_astralevel(game.u.uz)) cause += ' (in celestial disgrace)';
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
        death: scoreDeathCause(cause, deathType),
    };
}

function updateScoreRecord(current: ScoreRecord): ScoreUpdate {
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
    const roleCounts = new Map<string, number>();
    const records: ScoreRecord[] = [];
    for (const record of ordered) {
        const count = roleCounts.get(record.role) || 0;
        if (count >= 3) continue;
        roleCounts.set(record.role, count + 1);
        records.push(record);
        if (records.length >= 100) break;
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

function capitalizeScoreCause(value: string) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function scoreEntryText(record: ScoreRecord, rank: number) {
    const rankText = rank ? String(rank).padStart(3) : '   ';
    const points = String(record.points || 0).padStart(10);
    let line = `${rankText} ${points}  ${record.name.slice(0, 10)}-${
        record.role}${record.race.startsWith('?') ? '' : `-${record.race}`}-${
        record.gender}${record.align.startsWith('?') ? '' : `-${record.align}`} `;
    const death = record.death;
    const astralDungeon = !!game.astral_level
        && record.deathdnum === game.astral_level.dnum;
    if (death.startsWith('ascended'))
        return `${line}ascended to demigod${record.gender.startsWith('F') ? 'dess' : ''}-hood.`;
    if (death.startsWith('escaped')) {
        const circumstance = death.slice(7).startsWith(' (') ? death.slice(9) : '';
        line += `escaped the dungeon ${circumstance}[max level ${record.maxlvl}]`;
        const closing = line.indexOf(')');
        if (closing >= 0) line = astralDungeon ? line.slice(0, closing)
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
    } else {
        line += ` in ${record.dungeon}`;
        if (!game.knox_level || record.deathdnum !== game.knox_level.dnum)
            line += ` on level ${record.deathlev}`;
        if (record.deathlev !== record.maxlvl)
            line += ` [max ${record.maxlvl}]`;
    }
    if (death.startsWith('quit ')) line += death.slice(4);
    line += '.';
    if (!quit && !starved) line += `  ${capitalizeScoreCause(death)
        .replace('; the ', ', the ')}.`;
    return line;
}

function wrappedScoreEntryLines(record: ScoreRecord, rank: number, bold: boolean) {
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

function scoreListLines(current: ScoreRecord, update: ScoreUpdate, stopPrinting: boolean) {
    const lines: TextMenuLine[] = [{ text: '' }];
    if (update.previous) {
        lines.push({ text: `You didn't beat your previous score of ${update.previous.points} points.` }, { text: '' });
    }
    if (stopPrinting) return lines;
    if (update.inserted) {
        const rank = update.rank;
        const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'th'
            : (['th', 'st', 'nd', 'rd'][rank % 10] || 'th');
        lines.push({ text:
            update.rank <= 10
                ? 'You made the top ten list!'
                : `You reached the ${rank}${suffix} place on the top 100 list.`,
        }, { text: '' });
    }
    const top = game.flags.end_top ?? 3;
    const around = game.flags.end_around ?? 2;
    const own = game.flags.end_own ?? false;
    if (!top && !around && !own) return lines;
    lines.push({ text: ' No  Points     Name                                                   Hp [max]' });
    const addEntry = (record: ScoreRecord, rank: number, bold: boolean) => {
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
        if (record === update.previous) addEntry(current, 0, true);
    }
    if (update.rank > update.records.length) addEntry(current, 0, true);
    return lines;
}

// C end.c:really_done()/topten(): raw scores have no input wait. NHW_TEXT
// scores retain tty paging, then exit_nhwindows clears the terminal.
async function finishScoreDisplay(current: ScoreRecord, { stopPrinting = false } = {}) {
    const update = updateScoreRecord(current);
    const mode = game.flags.debug ? 'wizard'
        : game.flags.explore || game.discover ? 'discover' : null;
    const lines: TextMenuLine[] = mode ? [{ text: '' }, {
        text: `Since you were in ${mode} mode, the score list will not be checked.`,
    }] : scoreListLines(current, update, stopPrinting);
    game._preserveLeadingStyledBlanks = true;
    clearMessageWindow();
    if (game.iflags?.toptenwin) {
        if (!stopPrinting) {
            const pages: TextPage[] = [];
            for (let first = 0; first < lines.length; first += 23) {
                const page = lines.slice(first, first + 23);
                while (page.length < 23) page.push({ text: '' });
                page.push({ text: '--More--' });
                pages.push({ lines: page, cursor: [8, 23] });
            }
            await showTextPages(pages, { validKeys: [27, 32, 10, 13] });
        }
        game.nhDisplay?.clearScreen();
        game.nhDisplay?.setCursor(0, 0);
    } else {
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
            if (display && row >= display.rows) display.scrollUp();
            display?.setCursor(0, Math.min(row, (display?.rows ?? 24) - 1));
        }
    }
    game.program_state.windows_exited = true;
}

async function waitForCurrentMore() {
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}

// C options.c optfn_disclose(): a prefix letter (y n ? + - #) applies to
// the category letter that follows it; a bare category discloses without
// asking; 'k' and 'd' are legacy aliases for vanquished and overview.  The
// special 'a' answers only survive on the vanquished and genocided
// categories; elsewhere they degrade to plain yes.
const DISCLOSURE_CATEGORIES = ['i', 'a', 'v', 'g', 'c', 'o'] as const;
type DisclosureCategory = (typeof DISCLOSURE_CATEGORIES)[number];
type DisclosureDefault = 'y' | 'n' | 'a';

function endDiscloseSettings(): Record<DisclosureCategory, string> {
    const settings: Record<DisclosureCategory, string> = {
        i: '', a: '', v: '', g: '', c: '', o: '',
    };
    const raw = game.flags?.disclose;
    // An unset option leaves the zero-initialized defaults: ask, answer no.
    if (raw === undefined || raw === null) return settings;
    const text = String(raw).trim();
    if (text === '' || text.toLowerCase() === 'all') {
        for (const category of DISCLOSURE_CATEGORIES) settings[category] = 'y';
        return settings;
    }
    if (text.toLowerCase() === 'none') {
        for (const category of DISCLOSURE_CATEGORIES) settings[category] = '-';
        return settings;
    }
    let prefix: string | null = null;
    for (const character of text) {
        const code = character.toLowerCase();
        if (code === ' ') continue;
        const resolved = code === 'k' ? 'v' : code === 'd' ? 'o' : code;
        const category = DISCLOSURE_CATEGORIES.find(entry => entry === resolved);
        if (category) {
            let value = prefix ?? '+';
            if (prefix && category !== 'v' && category !== 'g') {
                if (prefix === '?') value = 'y';
                else if (prefix === '#') value = '+';
            }
            settings[category] = value;
            prefix = null;
        } else if (['y', 'n', '?', '+', '-', '#'].includes(code)) {
            prefix = code;
        }
    }
    return settings;
}

// C end.c:should_query_disclose_option().
function shouldQueryDiscloseOption(
    category: DisclosureCategory,
): { ask: boolean; defquery: DisclosureDefault } {
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
const VANQ_ORDER_CHOICES: ReadonlyArray<readonly [number, string]> = [
    [VANQ_MLVL_MNDX, 't'], [VANQ_MSTR_MNDX, 'd'], [VANQ_ALPHA_SEP, 'a'],
    [VANQ_ALPHA_MIX, 'A'], [VANQ_MCLS_HTOL, 'C'], [VANQ_MCLS_LTOH, 'c'],
    [VANQ_COUNT_H_L, 'n'], [VANQ_COUNT_L_H, 'z'],
];

function vanqOrderDescription(mode: number, forVanquished: boolean): string {
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

async function setVanqOrder(forVanquished: boolean): Promise<number> {
    const current = vanqSortMode();
    const items: InventoryMenuItem<number>[] = [];
    let preselectedKey: string | null = null;
    for (const [mode, letter] of VANQ_ORDER_CHOICES) {
        // The two uppercase orders exist in the comparator but stay
        // unlisted; counting orders don't apply to genocided species.
        if (mode === VANQ_ALPHA_MIX || mode === VANQ_MCLS_HTOL
            || (!forVanquished
                && (mode === VANQ_COUNT_H_L || mode === VANQ_COUNT_L_H)))
            continue;
        items.push({
            text: vanqOrderDescription(mode, forVanquished),
            key: letter, value: mode,
        });
        if (mode === current) preselectedKey = letter;
    }
    const selected = await showInventoryWindow([{ items }], {
        title: `Sort order for ${forVanquished
            ? 'vanquished monster counts (also genocided types)'
            : 'genocided monster types (also vanquished counts)'}`,
        pickMode: PICK_ONE, preselectedKey,
    });
    if (selected.key === 27) return -1;
    const mode = selected.value
        ?? items.find(item => item.key === String.fromCharCode(selected.key))?.value
        ?? current;
    game.flags.vanqSortmode = mode;
    return mode;
}

// C yn_function(): the answer set is shown as "[ynq]"; answers hidden
// behind ESC (the single-vanquished-species 'a') stay acceptable.
async function ynQuestion(
    question: string, visible: 'ynq' | 'ynaq', defquery: DisclosureDefault,
    { hiddenAll = false }: { hiddenAll?: boolean } = {},
): Promise<'y' | 'n' | 'a' | 'q'> {
    const choices: Array<'y' | 'n' | 'a' | 'q'>
        = visible === 'ynaq' || hiddenAll ? ['y', 'n', 'a', 'q'] : ['y', 'n', 'q'];
    return await promptChoice(
        question, choices, defquery, { visibleChoices: visible },
    );
}

// C end.c:disclose().  Shared by death, quitting, escape, and ascension.
// Each category consults the end_disclose option first: it either fixes
// the answer outright or asks with the option's default.
async function discloseGame({
    killer = '', deathVerb = 'died', deathCause = null, possessionAnswer = null,
    taken = false,
}: DisclosureOptions = {}) {
    // really_done() displays WIN_MESSAGE before disclosure or bones.
    await displayMessageWindow();
    // The final message window retains the status drawn by the fatal caller.
    // Disclosure uses committed HP after that message has been acknowledged.
    let livingCat = false;
    for (const object of game.inventory) {
        identifyObjectForDisclosure(object, true);
        if (!isQuantumBox(object)) continue;
        if (livingCat) object.spe = 0;
        else {
            await observeQuantumCat(object, { makeCat: false, showMessage: false });
            livingCat = isQuantumBox(object);
        }
    }
    if (game.program_state.stopprint) return false;
    if (game.inventory.length) {
        if (possessionAnswer === null) {
            const question = taken
                ? `Do you want to see what you had when you ${deathVerb === 'quit' ? 'quit' : 'died'}?`
                : 'Do you want your possessions identified?';
            const { ask, defquery } = shouldQueryDiscloseOption('i');
            possessionAnswer = ask ? await ynQuestion(question, 'ynq', defquery)
                : defquery;
        }
        if (possessionAnswer === 'y') {
            game.flags.force_invmenu = false;
            await showIdentifiedInventory();
            await containerContents(game.inventory, true, true, false);
        }
        if (possessionAnswer === 'q') return stopDisclosure();
    }

    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('a');
        const attributes = ask
            ? await ynQuestion('Do you want to see your attributes?', 'ynq', defquery)
            : defquery;
        if (attributes === 'y') await showFinalAttributes();
        if (attributes === 'q') return stopDisclosure();
    }

    // C list_vanquished(): the sort-order choice 'a' is only offered when
    // more than one species was vanquished; with a single species it stays
    // acceptable but hidden, and an 'a' default degrades to 'y'.
    if (!game.program_state.stopprint && vanquishedTypeCount() > 0) {
        const { ask, defquery } = shouldQueryDiscloseOption('v');
        const multiple = vanquishedTypeCount() > 1;
        const defaultAnswer: DisclosureDefault = !multiple && defquery === 'a'
            ? 'y' : defquery;
        const vanquished = ask
            ? await ynQuestion(
                'Do you want an account of creatures vanquished?',
                multiple ? 'ynaq' : 'ynq', defaultAnswer, { hiddenAll: !multiple },
            )
            : defquery;
        if (vanquished === 'q') return stopDisclosure();
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
        if (game.program_state.stopprint) return false;
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
        if (conduct === 'q') return stopDisclosure();
    }

    if (!game.program_state.stopprint) {
        const { ask, defquery } = shouldQueryDiscloseOption('o');
        const overview = ask
            ? await ynQuestion(
                'Do you want to see the dungeon overview?', 'ynq', defquery,
            )
            : defquery;
        if (overview === 'y') {
            await showDisclosureOverlay(
                overviewLines(killer, deathVerb, deathCause), {
                    marker: '(end)',
                    // C show_overview() builds the window with add_menu(),
                    // so its paged layout keeps the selector column and
                    // "(x of y)" page markers.
                    pagerStyle: 'menu',
                },
            );
        }
        if (overview === 'q') return stopDisclosure();
    }

    return true;
}

function stopDisclosure(): false {
    game.program_state.stopprint = (game.program_state.stopprint ?? 0) + 1;
    return false;
}

async function startGameExit(outcome: ShopExitOutcome, deathType = DIED): Promise<number> {
    game.program_state.gameover = true;
    game.program_state.something_worth_saving = false;
    if (deathType !== PANICKED && !game.program_state.panicking) await doneObjectCleanup();
    // really_done() fixes the finish time before any disclosure can wait.
    const endtime = recorderLocalEpochSeconds(game.datetime) || Date.now() / 1000;
    if (achievementEntries(game).length || !game.flags.beginner) {
        if (game.u.uroleplay?.blind) recordAchievement(game, ACH_BLND);
        if (game.u.uroleplay?.nudist) recordAchievement(game, ACH_NUDE);
    }
    if (outcome === 'ascended') recordAchievement(game, ACH_UWIN);
    if (outcome === 'died' && deathType < PANICKED
        && game.moves <= 1 && !game.program_state.stopprint) {
        // done() has committed zero HP; this pline refreshes that status.
        await plineWithContinuation(`Do not pass Go.  Do not collect 200 ${currency(200)}.`);
    }
    game._canMakeBones = outcome === 'died' && deathType < GENOCIDED
        && canMakeBones();
    if (game._canMakeBones) restoreLaunchedObjectForBones(game);
    return endtime;
}

async function settleGameExit(outcome: ShopExitOutcome): Promise<boolean> {
    const silent = !!game.program_state.stopprint;
    const publish = async (message: string): Promise<void> => {
        // A real pline updates status; an existing death message alone
        // retains the status painted by the fatal caller.
        await plineWithContinuation(message);
    };
    const taken = await settleShopkeepersOnExit(outcome, { silent, publish });
    await payVaultGuardOnExit({ silent, publish });
    await clearNonlocalPriestsOnExit();
    return taken;
}

export async function finishOrdinaryDeath(options: OrdinaryDeathOptions): Promise<void> {
    const endtime = await startGameExit('died', options.deathType ?? DIED);
    if (options.deathType != null) setHeroRemainsFromDeath(options.deathType, game);
    await completeOrdinaryDeath(options, endtime);
}

async function completeOrdinaryDeath({
    killer, possessionAnswer = null, deathVerb = 'died', deathCause = null,
    deathType = null, killerFormat = KILLED_BY_AN,
}: OrdinaryDeathOptions, endtime: number): Promise<void> {
    const how = deathType ?? DIED;
    if (!killer && how === GENOCIDED) killerFormat = NO_KILLER_PREFIX;
    if (!killer && (how === STARVING || how === BURNING)) killerFormat = KILLED_BY;
    if (!killer || how >= PANICKED) killer = DEATH_NAMES[how] ?? 'died';
    if (how >= PANICKED) deathCause = killer;
    deathCause ||= deathCauseRecord(killer, deathVerb, deathType, killerFormat);
    if (deathType !== null) deathVerb = ENDINGS[deathType] ?? deathVerb;
    game._deathKiller = killer;
    fixupDeath(how);
    const taken = how === PANICKED ? false : await settleGameExit('died');
    let showSummary: boolean;
    if (how === PANICKED) {
        await displayMessageWindow();
        showSummary = !game.program_state.stopprint;
    } else {
        showSummary = await discloseGame({ killer, deathVerb, deathCause, possessionAnswer, taken });
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
        await plineWithContinuation(`Your ${revenant} as ${
            withIndefiniteArticle(monsterTypeName(arise, !!game.flags.female))}...`);
        await displayMessageWindow();
    }
    await createBonesFromDeath(
        deathCause || deathCauseRecord(killer, deathVerb), promptYesNo,
    );

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
function fixupDeath(how: number): void {
    const reason = game._helplessReason;
    const text = typeof reason === 'string' ? reason : reason?.text;
    if (how === STONING && text === 'getting stoned') {
        game._helplessReason = null;
        game._helplessTurns = 0;
        game.multi = 0;
    } else if (how === STARVING && text === 'fainted from lack of food') {
        game._helplessReason = 'fainted';
    }
}

export async function doquit() {
    const abandonTutorial = !!game._tutorialActive
        && await promptChoice('Switch from the tutorial back to regular play?', ['y', 'n'], 'n') === 'y';
    const answer = !abandonTutorial && await paranoidQuery(
        !!((game.flags.paranoia_bits ?? 0) & PARANOID_QUIT), 'Really quit without saving?',
    );
    if (!answer) {
        // C end.c:done2() clears the answered question without a docrt,
        // cancels voluntary repetition, and releases prayer/sleep only
        // after multi has reached zero. Involuntary delays remain active.
        clearMessageWindow();
        if (game.multi > 0) endVoluntaryMultiTurn(game);
        if ((game.multi ?? 0) === 0) {
            game.u.invulnerable = false;
            game.u.usleep = 0;
        }
        await flush_screen(1);
        game.context.move = 0;
        if (abandonTutorial) {
            const prior = game.u.ucamefrom;
            if (!prior) throw new Error('Tutorial exit has no prior dungeon level');
            scheduleLevelChange([prior, { arrival: 'stairs' }], undefined, 'Resuming regular play.');
        }
        return;
    }
    if (game.flags.debug) {
        const dump = await promptChoice('Dump core?', ['y', 'n', 'q'], 'q');
        if (dump === 'y') {
            game.program_state.windows_exited = true;
            game.program_state.gameover = true;
            game.context.move = 0;
            // NH_abort() terminates the native process before done(QUIT).
            // The engine exposes that termination to its host.
            throw new PanicTermination('Wizard requested a core dump');
        }
        if (dump === 'q') stopDisclosure();
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

export async function finishLivingGame(outcome: LivingOutcome) {
    requireInitializedHero(game.u);
    await bot();
    await startGameExit(outcome);
    const taken = await settleGameExit(outcome);
    const showSummary = await discloseGame({ deathVerb: outcome, taken });
    const pets = await collectLevelFollowers(game, true);
    const summary = gameSummaryValues(outcome);
    const possessions = collectFinalPossessions();
    summary.score += possessions.points;
    for (const pet of pets) summary.score += pet.mhp;
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
        const lines = [`${roleGoodbye()} ${game.plname || 'player'} the ${title}...`, ''];
        const company = ['You', ...names].join(' and ');
        if (names.length) lines.push(company);
        const action = outcome === 'ascended' ? 'went to your reward' : 'escaped from the dungeon';
        lines.push(`${names.length ? '' : 'You '}${action} with ${summary.score} point${plur(summary.score)},`);
        lines.push(...await finalPossessionLines(possessions));
        lines.push(`and ${summary.gold} piece${summary.gold === 1 ? '' : 's'} of gold, after ${summary.moves} move${summary.moves === 1 ? '' : 's'}.`);
        lines.push(`You were level ${game.u.ulevel} with a maximum of ${game.u.uhpmax} hit point${plur(game.u.uhpmax)} when you ${outcome}.`);
        const pages: TextPage[] = [];
        for (let first = 0; first < lines.length; first += 22) {
            const page = lines.slice(first, first + 22);
            while (page.length < 23) page.push('');
            page.push('--More--');
            pages.push({ lines: page, cursor: [8, 23] });
        }
        await showTextPages(pages, { validKeys: [27, 32, 10, 13] });
    }
    await finishScoreDisplay(current, { stopPrinting: !showSummary });
    game.context.move = 0;
}

function objectBaseValue(type: number): number {
    const value = OBJECT_COST[type];
    if (value === undefined) throw new RangeError(`No base value for object type ${type}`);
    return value;
}

function collectFinalPossessions(): FinalPossessions {
    const artifacts: FinalArtifact[] = [];
    const valuables = new Map<number, number>();
    let lastGlass = -1;
    for (const [index, name] of OBJECT_NAMES.entries())
        if (name?.startsWith('worthless piece of')) lastGlass = index;
    let points = 0;
    const quantumCat = game.inventory.some(isQuantumBox);
    function visit(objects: readonly GameObject[]) {
        for (const object of objects) {
            const artifact = artifactById(object.oartifact);
            if (artifact || [BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD].includes(object.otyp)) {
                const value = artifact ? artifact.cost || 100 * objectBaseValue(object.otyp)
                    : objectBaseValue(object.otyp);
                const score = Math.trunc(value * 5 / 2);
                points += score;
                artifacts.push({ object, value, points: score,
                    name: artifact?.name || `The ${OBJECT_NAMES[object.otyp]}` });
            } else if (!object.contents?.length
                && (object.oclass === AMULET_CLASS
                    || object.oclass === GEM_CLASS && object.otyp <= lastGlass)) {
                const type = object.oclass === GEM_CLASS && object.otyp > JADE ? JADE + 1 : object.otyp;
                valuables.set(type, (valuables.get(type) || 0) + object.quan);
            }
            if (object.contents?.length) visit(object.contents);
        }
    }
    visit(game.inventory);
    const groups = [...valuables].sort(([a, countA], [b, countB]) => {
        const aIsGem = objectClassForType(a) === GEM_CLASS;
        const bIsGem = objectClassForType(b) === GEM_CLASS;
        return Number(aIsGem) - Number(bIsGem) || countB - countA || a - b;
    });
    for (const [type, count] of groups) points += count * objectBaseValue(type);
    return { points, artifacts, valuables: groups, quantumCat };
}

async function finalPossessionLines(possessions: FinalPossessions) {
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
        } else {
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
