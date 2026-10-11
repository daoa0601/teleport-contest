// The saved high-score list shared by game completion and identity selection.

import { game } from './gstate.js';
import type { GameState } from './game_state.js';

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

export function loadScoreRecords(state: GameState = game): ScoreRecord[] {
    let raw: string | null;
    try {
        const storage = state.storage;
        raw = storage?.getItem(SCORE_RECORD_STORAGE_KEY) ?? null;
    } catch {
        return [];
    }
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const records: unknown = JSON.parse(raw);
        return Array.isArray(records)
            ? records.filter(validScoreRecord).slice(0, 100) : [];
    } catch {
        return [];
    }
}

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

function validScoreRecord(record: unknown): record is ScoreRecord {
    if (typeof record !== 'object' || record === null) return false;
    return 'points' in record && typeof record.points === 'number' && Number.isFinite(record.points)
        && 'deathdnum' in record && typeof record.deathdnum === 'number' && Number.isInteger(record.deathdnum)
        && 'deathlev' in record && typeof record.deathlev === 'number' && Number.isInteger(record.deathlev)
        && 'maxlvl' in record && typeof record.maxlvl === 'number' && Number.isInteger(record.maxlvl)
        && 'hp' in record && typeof record.hp === 'number' && Number.isFinite(record.hp)
        && 'maxhp' in record && typeof record.maxhp === 'number' && Number.isFinite(record.maxhp)
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
