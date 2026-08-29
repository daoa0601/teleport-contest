import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { decodeScreen } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { assertRngThrough } from './parity_assertions.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const knight = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[7];

test('seed0030 pony contact pages between its two missed attack slots',
    async () => {
        const lastStep = 26;
        const result = await runSegment({
            ...knight,
            moves: knight.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, knight, lastStep, 'seed0030 segment 7');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(knight.steps[step].screen),
                `seed0030 segment 7 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                knight.steps[step].cursor,
                `seed0030 segment 7 cursor ${step}`,
            );
        }
    });
