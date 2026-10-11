// High-score identities used by doppelgangers, corpses, and statues.
// C refs: topten.c:get_rnd_toptenentry(), classmon(), tt_doppel(), tt_oname().

import { CORPSTAT_FEMALE, CORPSTAT_MALE } from './const.js';
import { canSeeMonster } from './display.js';
import { impossible } from './diagnostics.js';
import { game, requireLiveGame } from './gstate.js';
import { set_corpsenm } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { roles } from './roles.js';
import { rn2, rnd } from './rng.js';
import { loadScoreRecords } from './score_records.js';
import { objectWeight } from './weight.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { ScoreRecord } from './score_records.js';

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

async function roleMonster(code: string, state: GameState): Promise<number> {
    const role = roles.find(candidate => code.slice(0, 3) === candidate.filecode);
    // roles.js stores player-monster offsets rather than absolute species.
    if (role)
        return role.mnum < 0 ? MONSTER_NAME.indexOf('human') : FIRST_PLAYER_MONSTER + role.mnum;
    if (code === 'E') return MONSTER_NAME.indexOf('ranger');
    await impossible(`What weird role is this? (${code})`, { state });
    return MONSTER_NAME.indexOf('human mummy');
}
