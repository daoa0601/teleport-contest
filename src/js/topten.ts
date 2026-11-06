// topten.c's port: the saved high-score record list, the end-of-game score
// display, and the high-score identities used by doppelgangers, corpses,
// and statues.
// C refs: topten.c:formatkiller(), readentry(), writeentry(), topten()'s
// display phase, outheader(), outentry(), classmon(),
// get_rnd_toptenentry(), tt_oname(), tt_doppel(). The record update half
// of topten() stays in end.ts (updateScoreRecord) beside the killer
// composition it feeds on.

import { CORPSTAT_FEMALE, CORPSTAT_MALE } from './const.js';
import { canSeeMonster } from './display.js';
import { impossible } from './diagnostics.js';
import { game, requireLiveGame } from './gstate.js';
import { objectWeight, set_corpsenm } from './mkobj.js';
import { MONSTER_NAME } from './monster_data.js';
import { setMonsterGivenName } from './do_name.js';
import { roles } from './role.js';
import { rn2, rnd } from './rng.js';
import { ATR_BOLD } from './terminal.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { TextMenuLine } from './wintty.js';

const ENTRYMAX = 100; // sysopt.entrymax (config.h ENTRYMAX) in the pinned build
export const SCORE_RECORD_STORAGE_KEY = 'teleport-contest:record:v1';

export type ScoreOutcome = 'died' | 'quit' | 'escaped' | 'ascended';

export interface ScoreRecord {
    points: number;
    deathdnum: number;
    deathlev: number;
    maxlvl: number;
    hp: number;
    maxhp: number;
    name: string;
    role: string;
    race: string;
    gender: string;
    align: string;
    dungeon: string;
    outcome: ScoreOutcome;
    death: string;
}

// end.ts updateScoreRecord() — topten()'s record update — reports its
// result through this shape; scoreListLines() below prints it.
export interface ScoreUpdate {
    records: ScoreRecord[];
    rank: number;
    inserted: boolean;
    previous?: ScoreRecord | null | undefined;
}

interface ToptenOptions {
    state?: GameState;
    rollOne?: (limit: number) => number;
}

const FIRST_PLAYER_MONSTER = MONSTER_NAME.indexOf('archeologist');
const LAST_PLAYER_MONSTER = MONSTER_NAME.indexOf('wizard');
const TOP_NAME_RANK = 10; // sysopt.tt_oname_maxrank in the pinned build

// C topten.c:killed_by_prefix[]: the done() reason's prefix, expanded by
// formatkiller() under the KILLED_BY formats. The port composes the prefix
// where C assigns svk.killer (end.ts:killerDeathCause()), so the table
// serves that composition.
export const KILLED_BY_PREFIXES: readonly string[] = [
    /* DIED, CHOKING, POISONING, STARVING, */
    'killed by ', 'choked on ', 'poisoned by ', 'died of ',
    /* DROWNING, BURNING, DISSOLVED, CRUSHING, */
    'drowned in ', 'burned by ', 'dissolved in ', 'crushed to death by ',
    /* STONING, TURNED_SLIME, GENOCIDED, */
    'petrified by ', 'turned to slime by ', 'killed by ',
    /* PANICKED, TRICKED, QUIT, ESCAPED, ASCENDED */
    '', '', '', '', '',
];

// C include/rm.h: cemetery.how[] and topten.c:toptenentry.death[] both
// hold DTHSZ characters plus the terminator.
export const DTHSZ = 100;

// C topten.c:formatkiller(): the one owner of the formatted death cause.
// The port threads each fatal caller's composed cause text (prefix and
// article included) in place of C's svk.killer pair; this function owns
// the half every C call site runs: the sanitization (topten.c:133-149 —
// ',' becomes ';', '=' becomes '_', tab becomes space), the caller's
// buffer bound, and the incl_helpless rule (topten.c:152-161): while
// gm.multi is still negative, append ", while <multi_reason>" if it
// fits, else ", while helpless", else nothing. Call sites and bounds:
// rip.c:113 (the tombstone, BUFSZ, FALSE), dungeon.c:3709 (the final
// disclosure's "you, ..." resting-place line, BUFSZ, TRUE), end.c:1317
// (the grave engraving, BUFSZ minus the name, TRUE), topten.c:694 (the
// score entry, DTHSZ + 1, TRUE) and bones.c:585 (the cemetery entry,
// DTHSZ + 1, TRUE).
export function formatKiller(cause: string, size: number, inclHelpless: boolean): string {
    // topten.c:133-150: the copy loop's `--siz` runs before each character
    // test, so the cause holds at most size - 1 characters and reading the
    // terminator consumes one further byte of the suffix budget.
    const clean = cause.replaceAll(',', ';').replaceAll('=', '_')
        .replaceAll('\t', ' ').slice(0, size - 1);
    if (!inclHelpless) return clean;
    // C keeps one multi counter; the port splits it into the voluntary
    // repeat count and the involuntary-delay mirror (cmd.ts:currentMulti),
    // so negative helplessness is either field.
    if ((game._helplessTurns ?? 0) <= 0 && game.multi >= 0) return clean;
    const remaining = size - 1 - clean.length;
    const reason = game._helplessReason;
    const text = typeof reason === 'string' ? reason : reason?.text;
    if (text && text.length + ', while '.length + 1 <= remaining)
        return `${clean}, while ${text}`;
    if (', while helpless'.length + 1 <= remaining)
        return `${clean}, while helpless`;
    return clean;
}

// C topten.c:readentry(): parse the saved record list; one malformed
// entry ends it. C topten.c:discardexcess(): the ENTRYMAX cap applied
// while reading.
export function loadScoreRecords(state: GameState = game): ScoreRecord[] {
    let raw: string | null;
    try {
        const storage = state.storage;
        raw = storage?.getItem(SCORE_RECORD_STORAGE_KEY) ?? null;
    } catch {
        return [];
    }
    if (typeof raw !== 'string' || !raw) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    // C topten.c:topten()/readentry(): one malformed line, or the first
    // entry below sysopt.pointsmin, ends the readable record; later lines
    // never enter the list and are lost when the file is rewritten.
    const records: ScoreRecord[] = [];
    for (const candidate of parsed) {
        if (!validScoreRecord(candidate) || candidate.points < 1) break;
        records.push(readNativeFieldWidths(candidate));
        if (records.length >= ENTRYMAX) break; // sysopt.entrymax
    }
    return records;
}

// readentry() copynchars(): identity columns hold ROLESZ chars, the name
// NAMSZ, and the death description DTHSZ.
const ROLE_WIDTH = 3;
const NAME_WIDTH = 10;
const DEATH_WIDTH = 100;

// Part of C topten.c:readentry(): apply native score-record string widths.
function readNativeFieldWidths(record: ScoreRecord): ScoreRecord {
    return {
        ...record,
        role: record.role.slice(0, ROLE_WIDTH),
        race: record.race.slice(0, ROLE_WIDTH),
        gender: record.gender.slice(0, ROLE_WIDTH),
        align: record.align.slice(0, ROLE_WIDTH),
        name: record.name.slice(0, NAME_WIDTH),
        death: record.death.slice(0, DEATH_WIDTH),
    };
}

// Port only: validate score records read from storage.
// The storage boundary check C gets from fscanf's return value: only a
// row with every native field in its native type is a parseable record.
function validScoreRecord(record: unknown): record is ScoreRecord {
    if (typeof record !== 'object' || record === null) return false;
    return 'points' in record && typeof record.points === 'number' && Number.isInteger(record.points)
        && 'deathdnum' in record && typeof record.deathdnum === 'number' && Number.isInteger(record.deathdnum)
        && 'deathlev' in record && typeof record.deathlev === 'number' && Number.isInteger(record.deathlev)
        && 'maxlvl' in record && typeof record.maxlvl === 'number' && Number.isInteger(record.maxlvl)
        && 'hp' in record && typeof record.hp === 'number' && Number.isInteger(record.hp)
        && 'maxhp' in record && typeof record.maxhp === 'number' && Number.isInteger(record.maxhp)
        && 'name' in record && typeof record.name === 'string'
        && 'role' in record && typeof record.role === 'string'
        && 'race' in record && typeof record.race === 'string'
        && 'gender' in record && typeof record.gender === 'string'
        && 'align' in record && typeof record.align === 'string'
        && 'dungeon' in record && typeof record.dungeon === 'string'
        && 'outcome' in record && (record.outcome === 'died' || record.outcome === 'quit'
            || record.outcome === 'escaped' || record.outcome === 'ascended')
        && 'death' in record && typeof record.death === 'string';
}

// C topten.c:writeentry(): serialize the record list back to storage.
export function saveScoreRecords(records: readonly ScoreRecord[], state: GameState = game): boolean {
    const value = JSON.stringify(records);
    try {
        const storage = state.storage;
        if (storage) {
            storage.setItem(SCORE_RECORD_STORAGE_KEY, value);
            return true;
        }
    } catch {
        return false;
    }
    return false;
}

// C topten.c:topten(): the display half — the "didn't beat your previous
// score" and "You made the top ten list!" messages, the end_top /
// end_around / end_own windowing loop over the records, and the new entry
// shown among the prior ones. C topten.c:topten_print(): each row is one
// text line of the menu. (An earlier citation credited prscore() with the
// windowing; the loop is topten()'s — prscore() is the command-line score
// browser and prints every matching entry unwindowed.) The record update
// half of topten() is end.ts updateScoreRecord(), which produces the
// ScoreUpdate this prints and stays beside end.c's killer composition.
export function scoreListLines(current: ScoreRecord, update: ScoreUpdate, stopPrinting: boolean) {
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
    lines.push(outheader());
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

// C topten.c:outheader(): the column header line; C pads
// " No  Points     Name" with spaces up to COLNO - 9 before "Hp [max]",
// which this literal bakes in, and hands it to topten_print().
function outheader(): TextMenuLine {
    return { text: ' No  Points     Name                                                   Hp [max]' };
}

// C topten.c:outentry(): compose one score line — rank, points, the
// name-role-race-gender-align column, and the death sentence with its
// ascension, escape, and plane variants — then wrap a long line at
// column 70, avoiding a break inside " [max", and pad the hero's own
// rows so the bold attribute covers the full width —
// topten_print_bold()'s ATR_BOLD row.
function wrappedScoreEntryLines(record: ScoreRecord, rank: number, bold: boolean) {
    const wrapColumn = 70;
    const hp = record.hp <= 0 ? '-' : String(record.hp);
    const rankText = rank ? String(rank).padStart(3) : '   ';
    const points = String(record.points || 0).padStart(10);
    let line = `${rankText} ${points}  ${record.name.slice(0, 10)}-${
        record.role}${record.race.startsWith('?') ? '' : `-${record.race}`}-${
        record.gender}${record.align.startsWith('?') ? '' : `-${record.align}`} `;
    const death = record.death;
    const astralDungeon = !!game.astral_level
        && record.deathdnum === game.astral_level.dnum;
    if (death.startsWith('ascended')) {
        line += `ascended to demigod${record.gender.startsWith('F') ? 'dess' : ''}-hood.`;
    } else if (death.startsWith('escaped')) {
        const circumstance = death.slice(7).startsWith(' (') ? death.slice(9) : '';
        line += `escaped the dungeon ${circumstance}[max level ${record.maxlvl}]`;
        const closing = line.indexOf(')');
        if (closing >= 0) line = astralDungeon ? line.slice(0, closing)
            : line.slice(0, closing) + ' ' + line.slice(closing + 1);
        line += '.';
    } else {
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
        // outentry()'s second line: highc(death[0]) plus the rest, with
        // "; the " changed back to ", the " for display.
        if (!quit && !starved) {
            const cause = death.charAt(0).toUpperCase() + death.slice(1);
            line += `  ${cause.replace('; the ', ', the ')}.`;
        }
    }

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

// C topten.c:classmon(): the record's role letters to a player-monster
// form.
async function roleMonster(code: string, state: GameState): Promise<number> {
    const role = roles.find(candidate => code.slice(0, 3) === candidate.filecode);
    // role.js stores player-monster offsets rather than absolute species.
    if (role)
        return role.mnum < 0 ? MONSTER_NAME.indexOf('human') : FIRST_PLAYER_MONSTER + role.mnum;
    if (code === 'E') return MONSTER_NAME.indexOf('ranger');
    await impossible(`What weird role is this? (${code})`, { state });
    return MONSTER_NAME.indexOf('human mummy');
}

// C topten.c:get_rnd_toptenentry()
export function randomToptenEntry({ state = game, rollOne = rnd }: ToptenOptions = {}): ScoreRecord | null {
    // The app's list represents the readable native record file, including
    // its empty state. An empty file still owns the rank selection draw.
    const records = loadScoreRecords(state);
    const rank = rollOne(TOP_NAME_RANK);
    const first = records[0];
    if (!first || first.points === 0) return null;
    for (let index = 0; index < rank; index++) {
        const record = records[index];
        if (!record || record.points === 0) return first;
    }
    const selected = records[rank - 1];
    if (!selected) throw new RangeError(`Invalid high-score rank ${rank}`);
    return selected;
}

// C topten.c:tt_oname()
export async function nameObjectFromTopten(object: GameObject | null | undefined, { state = game, rollOne = rnd }: ToptenOptions = {}): Promise<GameObject | null> {
    requireLiveGame(state);
    if (!object) return null;
    const record = randomToptenEntry({ state, rollOne });
    if (!record) return null;

    set_corpsenm(object, await roleMonster(record.role, state));
    object.owt = objectWeight(object);
    if (record.gender.startsWith('F')) object.spe = CORPSTAT_FEMALE;
    else if (record.gender.startsWith('M')) object.spe = CORPSTAT_MALE;
    object.oextra ||= {};
    object.oextra.oname = record.name.slice(0, 10);
    return object;
}

// C topten.c:tt_doppel()
export async function toptenMonsterForm(monster: Monster, {
    state = game, random = rn2, rollOne = rnd,
}: ToptenOptions & { random?: (limit: number) => number } = {}): Promise<number> {
    requireLiveGame(state);
    const record = random(13) ? randomToptenEntry({ state, rollOne }) : null;
    if (!record)
        return FIRST_PLAYER_MONSTER + random(LAST_PLAYER_MONSTER - FIRST_PLAYER_MONSTER + 1);

    if (record.gender.startsWith('F')) monster.female = true;
    else if (record.gender.startsWith('M')) monster.female = false;
    const form = await roleMonster(record.role, state);
    if (canSeeMonster(monster)) setMonsterGivenName(monster, record.name.slice(0, 10));
    return form;
}
