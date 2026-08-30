import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import {
    COLS_80, ROWS_24, decodeScreen, diffCell,
} from '../frozen/screen-decode.mjs';

function normalizedRngSlice(entries) {
    return (entries || [])
        .filter(entry => typeof entry === 'string'
            && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry))
        .map(entry => entry.replace(/\s*@\s.*$/, '')
            .replace(/^\d+\s+/, '').trim());
}

function firstSequenceDifference(actual, expected) {
    const length = Math.max(actual.length, expected.length);
    let index = 0;
    while (index < length && actual[index] === expected[index]) index++;
    return index === length ? null : {
        index,
        actualLength: actual.length,
        expectedLength: expected.length,
        actual: actual.slice(Math.max(0, index - 2), index + 3),
        expected: expected.slice(Math.max(0, index - 2), index + 3),
    };
}

function firstScreenDifference(actualEncoded, expectedEncoded) {
    const actual = decodeScreen(actualEncoded || '');
    const expected = decodeScreen(expectedEncoded || '');
    for (let y = 0; y < ROWS_24; y++) {
        for (let x = 0; x < COLS_80; x++) {
            if (!diffCell(actual[y][x], expected[y][x])) continue;
            return {
                x, y,
                actual: actual[y][x],
                expected: expected[y][x],
            };
        }
    }
    return null;
}

function assertBoundedSessionParity(result, segment) {
    const screens = result.getScreens();
    const cursors = result.getCursors();
    const rngSlices = result.getRngSlices();
    assert.equal(screens.length, segment.steps.length);
    assert.equal(cursors.length, segment.steps.length);
    assert.equal(rngSlices.length, segment.steps.length);
    for (let step = 0; step < segment.steps.length; step++) {
        const expected = segment.steps[step];
        const rng = firstSequenceDifference(
            normalizedRngSlice(rngSlices[step]),
            normalizedRngSlice(expected.rng),
        );
        const screen = firstScreenDifference(screens[step], expected.screen);
        const cursor = firstSequenceDifference(
            cursors[step] || [], expected.cursor || [],
        );
        if (rng || screen || cursor) {
            assert.fail(`step ${step} parity mismatch ${JSON.stringify({
                rng, screen, cursor,
            })}`);
        }
    }
}

async function withBridgeFreeMode(callback) {
    const previous = process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_BRIDGE_FREE = '1';
    try {
        return await callback();
    } finally {
        if (previous === undefined) delete process.env.TELEPORT_BRIDGE_FREE;
        else process.env.TELEPORT_BRIDGE_FREE = previous;
    }
}

test('public Samurai replay stays exact while bridge-free policy is enabled', async () => {
    await withBridgeFreeMode(async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0017-samurai-altar-pray.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const result = await runSegment({ ...session, storage: new Map() });

        assertBoundedSessionParity(result, session);
        assert.deepEqual(result.getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 0,
            forbiddenHits: 0,
            bridges: {},
        });
    });
});

test('public Rogue replays stay exact while bridge-free policy is enabled', async () => {
    await withBridgeFreeMode(async () => {
        for (const filename of [
            'seed0077-rogue-chargen.session.json',
            'seed1500-rogue-explore-move.session.json',
            'seed0060-orc-rogue-kick-search.session.json',
            'seed0013-rogue-friday13-combat.session.json',
        ]) {
            const session = JSON.parse(fs.readFileSync(
                new URL(`../sessions/${filename}`, import.meta.url),
                'utf8',
            )).segments[0];
            const result = await runSegment({
                ...session, storage: new Map(),
            });

            assertBoundedSessionParity(result, session);
            assert.deepEqual(result.getBridgeUsageLedger(), {
                bridgeFree: true,
                totalHits: 0,
                forbiddenHits: 0,
                bridges: {},
            }, filename);
        }
    });
});

test('public Rogue save/restore stays exact while bridge-free policy is enabled', async () => {
    await withBridgeFreeMode(async () => {
        const segments = JSON.parse(fs.readFileSync(
            new URL(
                '../sessions/seed0013-friday13-save-then-fullmoon-restore.session.json',
                import.meta.url,
            ),
            'utf8',
        )).segments;
        const storage = new InMemoryStorage();
        for (const segment of segments) {
            const result = await runSegment({ ...segment, storage });
            assertBoundedSessionParity(result, segment);
            assert.deepEqual(result.getBridgeUsageLedger(), {
                bridgeFree: true,
                totalHits: 0,
                forbiddenHits: 0,
                bridges: {},
            });
        }
    });
});

test('public Priest replays stay exact while bridge-free policy is enabled', async () => {
    await withBridgeFreeMode(async () => {
        for (const filename of [
            'seed0501-priest-cast-read-turn.session.json',
            'seed0106-priest-extcmd-sweep.session.json',
        ]) {
            const session = JSON.parse(fs.readFileSync(
                new URL(`../sessions/${filename}`, import.meta.url),
                'utf8',
            )).segments[0];
            const result = await runSegment({
                ...session, storage: new Map(),
            });

            assertBoundedSessionParity(result, session);
            assert.deepEqual(result.getBridgeUsageLedger(), {
                bridgeFree: true,
                totalHits: 0,
                forbiddenHits: 0,
                bridges: {},
            }, filename);
        }
    });
});
