// The saved high-score list shared by game completion and identity selection.
import { game } from './gstate.js';
const ENTRYMAX = 100; // sysopt.entrymax (config.h ENTRYMAX) in the pinned build
export const SCORE_RECORD_STORAGE_KEY = 'teleport-contest:record:v1';
export function loadScoreRecords(state = game) {
    let raw;
    try {
        const storage = state.storage;
        raw = storage?.getItem(SCORE_RECORD_STORAGE_KEY) ?? null;
    }
    catch {
        return [];
    }
    if (typeof raw !== 'string' || !raw)
        return [];
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return [];
    }
    if (!Array.isArray(parsed))
        return [];
    // C topten.c:topten()/readentry(): one malformed line, or the first
    // entry below sysopt.pointsmin, ends the readable record; later lines
    // never enter the list and are lost when the file is rewritten.
    const records = [];
    for (const candidate of parsed) {
        if (!validScoreRecord(candidate) || candidate.points < 1)
            break;
        records.push(readNativeFieldWidths(candidate));
        if (records.length >= ENTRYMAX)
            break; // sysopt.entrymax
    }
    return records;
}
// readentry() copynchars(): identity columns hold ROLESZ chars, the name
// NAMSZ, and the death description DTHSZ.
const ROLE_WIDTH = 3;
const NAME_WIDTH = 10;
const DEATH_WIDTH = 100;
function readNativeFieldWidths(record) {
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
export function saveScoreRecords(records, state = game) {
    const value = JSON.stringify(records);
    try {
        const storage = state.storage;
        if (storage) {
            storage.setItem(SCORE_RECORD_STORAGE_KEY, value);
            return true;
        }
    }
    catch {
        return false;
    }
    return false;
}
function validScoreRecord(record) {
    if (typeof record !== 'object' || record === null)
        return false;
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
//# sourceMappingURL=score_records.js.map