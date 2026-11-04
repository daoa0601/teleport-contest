// High-score identities used by doppelgangers, corpses, and statues.
// C refs: topten.c:get_rnd_toptenentry(), classmon(), tt_doppel(), tt_oname().

import { CORPSTAT_FEMALE, CORPSTAT_MALE } from './const.js';
import { canSeeMonster } from './display.js';
import { impossible } from './diagnostics.js';
import { game, requireLiveGame } from './gstate.js';
import { set_corpsenm } from './mkobj.js';
import { MONSTER_NAME } from './monster_data.js';
import { setMonsterGivenName } from './do_name.js';
import { roles } from './roles.js';
import { rn2, rnd } from './rng.js';
import { loadScoreRecords } from './score_records.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { ScoreRecord } from './score_records.js';
import { objectWeight } from './mkobj.js';

interface ToptenOptions {
    state?: GameState;
    rollOne?: (limit: number) => number;
}

const FIRST_PLAYER_MONSTER = MONSTER_NAME.indexOf('archeologist');
const LAST_PLAYER_MONSTER = MONSTER_NAME.indexOf('wizard');
const TOP_NAME_RANK = 10; // sysopt.tt_oname_maxrank in the pinned build

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

// C topten.c:classmon(): the record's role letters to a player-monster
// form.
async function roleMonster(code: string, state: GameState): Promise<number> {
    const role = roles.find(candidate => code.slice(0, 3) === candidate.filecode);
    // roles.js stores player-monster offsets rather than absolute species.
    if (role)
        return role.mnum < 0 ? MONSTER_NAME.indexOf('human') : FIRST_PLAYER_MONSTER + role.mnum;
    if (code === 'E') return MONSTER_NAME.indexOf('ranger');
    await impossible(`What weird role is this? (${code})`, { state });
    return MONSTER_NAME.indexOf('human mummy');
}

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
