import type { Cursor } from './session-types.mjs';
import { arrayValue, decodeCursor } from './session-types.mjs';

export interface ReplayStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    readonly length: number;
    key(index: number): string | null;
}

export interface ReplayInput {
    seed: number;
    datetime: string;
    nethackrc: string;
    moves: string;
    storage: ReplayStorage;
}

export interface ReplayCapture {
    screens: string[];
    cursors: (Cursor | null)[];
    rngLog: string[];
    rngSlices: string[][];
}

export type ReplayRunner = (input: ReplayInput) => Promise<ReplayCapture>;

/** A viewer may import an alternate port URL, so validate that boundary. */
export async function loadReplayRunner(url: string): Promise<ReplayRunner> {
    const module: unknown = await import(url);
    if (!isRecord(module) || !isCallable(module.runSegment)) {
        throw new Error(`${url} must export runSegment(input)`);
    }
    const runSegment = module.runSegment;
    return async input => {
        const game: unknown = await runSegment(input);
        if (!isRecord(game)) throw new Error('runSegment must return a game capture');
        return {
            screens: stringArray(captureValue(game, 'getScreens'), 'getScreens'),
            cursors: cursorArray(captureValue(game, 'getCursors')),
            rngLog: stringArray(captureValue(game, 'getRngLog'), 'getRngLog'),
            rngSlices: rngSlices(captureValue(game, 'getRngSlices')),
        };
    };
}

export function createReplayStorage(): ReplayStorage {
    const entries = new Map<string, string>();
    return {
        getItem: key => entries.get(key) ?? null,
        setItem: (key, value) => { entries.set(key, String(value)); },
        removeItem: key => { entries.delete(key); },
        get length() { return entries.size; },
        key: index => [...entries.keys()][index] ?? null,
    };
}

function captureValue(game: Record<string, unknown>, name: string): unknown {
    const method = game[name];
    if (!isCallable(method)) throw new Error(`Game capture is missing ${name}()`);
    return method.call(game);
}

function stringArray(value: unknown, field: string): string[] {
    const entries = arrayValue(value, `${field}() result`);
    if (!entries.every((entry): entry is string => typeof entry === 'string')) {
        throw new Error(`${field}() must return an array of strings`);
    }
    return entries;
}

function cursorArray(value: unknown): (Cursor | null)[] {
    return arrayValue(value, 'getCursors() result').map(cursor => cursor === null ? null : decodeCursor(cursor));
}

function rngSlices(value: unknown): string[][] {
    return arrayValue(value, 'getRngSlices() result')
        .map((slice, index) => stringArray(slice, `getRngSlices()[${index}]`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCallable(value: unknown): value is (...args: unknown[]) => unknown {
    return typeof value === 'function';
}
