#!/usr/bin/env node
// Print a bounded per-input parity diagnosis for one recorded session.
// This intentionally never flattens or formats a whole-session RNG transcript.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    COLS_80, ROWS_24, decodeScreen, diffCell,
} from '../frozen/screen-decode.mjs';
import { normalizeSession } from '../frozen/session_loader.mjs';

const sessionArg = process.argv[2];
if (!sessionArg) {
    console.error('usage: node scripts/first-session-divergence.mjs SESSION');
    process.exit(2);
}

process.env.TELEPORT_DISABLE_FIXTURES = '1';
const { runSegment } = await import('../js/jsmain.js');

const limit = Math.max(
    1, Number.parseInt(process.env.DIVERGENCE_LIMIT || '5', 10) || 5,
);
const parsedMaxStep = Number.parseInt(
    process.env.DIVERGENCE_MAX_STEP || '',
    10,
);
const maxStep = Number.isFinite(parsedMaxStep) && parsedMaxStep >= 0
    ? parsedMaxStep
    : null;
const sessionPath = resolve(sessionArg);
const session = normalizeSession(
    JSON.parse(readFileSync(sessionPath, 'utf8')),
);

function isRngCall(entry) {
    return typeof entry === 'string'
        && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry);
}

function normalizeRng(entry) {
    return String(entry || '')
        .replace(/\s*@\s.*$/, '')
        .replace(/^\d+\s+/, '')
        .trim();
}

function firstRngDifference(actual, expected) {
    const got = (actual || []).filter(isRngCall).map(normalizeRng);
    const want = (expected || []).filter(isRngCall).map(normalizeRng);
    const total = Math.max(got.length, want.length);
    let index = 0;
    while (index < total && got[index] === want[index]) index++;
    if (index === total) return null;
    return {
        index,
        actualLength: got.length,
        expectedLength: want.length,
        actual: got.slice(Math.max(0, index - 2), index + 3),
        expected: want.slice(Math.max(0, index - 2), index + 3),
    };
}

function firstScreenDifference(actualEncoded, expectedEncoded) {
    const actual = decodeScreen(actualEncoded || '');
    const expected = decodeScreen(expectedEncoded || '');
    for (let y = 0; y < ROWS_24; y++) {
        for (let x = 0; x < COLS_80; x++) {
            if (!diffCell(actual[y][x], expected[y][x])) continue;
            const rowStart = Math.max(0, y - 1);
            const rowEnd = Math.min(ROWS_24, y + 2);
            const rows = grid => grid.slice(rowStart, rowEnd).map(row =>
                row.map(cell => cell.ch).join('').trimEnd());
            return {
                x, y,
                actualCell: actual[y][x],
                expectedCell: expected[y][x],
                rowStart,
                actualRows: rows(actual),
                expectedRows: rows(expected),
            };
        }
    }
    return null;
}

function sameCursor(actual, expected) {
    if (!Array.isArray(expected)) return true;
    return Array.isArray(actual)
        && actual[0] === expected[0]
        && actual[1] === expected[1]
        && actual[2] === expected[2];
}

const storage = new Map();
const storageHandle = {
    getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
        storage.set(key, String(value));
    },
    removeItem(key) {
        storage.delete(key);
    },
    get length() {
        return storage.size;
    },
    key(index) {
        return [...storage.keys()][index] ?? null;
    },
};

let globalStep = 0;
let mismatchCount = 0;
let shown = 0;
for (let segmentIndex = 0;
    segmentIndex < session.segments.length;
    segmentIndex++) {
    const segment = session.segments[segmentIndex];
    const result = await runSegment({
        seed: segment.seed,
        datetime: segment.datetime,
        nethackrc: segment.nethackrc,
        moves: maxStep === null
            ? segment.moves
            : segment.moves.slice(0, maxStep),
        storage: storageHandle,
    });
    const screens = result.getScreens?.() || [];
    const cursors = result.getCursors?.() || [];
    const rngSlices = result.getRngSlices?.() || [];

    const stepCount = maxStep === null
        ? segment.steps.length
        : Math.min(segment.steps.length, maxStep + 1);
    for (let step = 0; step < stepCount; step++, globalStep++) {
        const expected = segment.steps[step];
        const screen = firstScreenDifference(
            screens[step], expected.screen,
        );
        const cursor = sameCursor(cursors[step], expected.cursor)
            ? null
            : { actual: cursors[step], expected: expected.cursor };
        const rng = firstRngDifference(rngSlices[step], expected.rng);
        if (!screen && !cursor && !rng) continue;
        mismatchCount++;
        if (shown >= limit) continue;
        console.log(JSON.stringify({
            segment: segmentIndex,
            step,
            globalStep,
            input: step > 0 ? segment.moves[step - 1] : null,
            screen,
            cursor,
            rng,
        }));
        shown++;
    }
}

console.log(JSON.stringify({
    session: sessionPath,
    steps: globalStep,
    mismatches: mismatchCount,
    shown,
    limit,
    maxStep,
}));
