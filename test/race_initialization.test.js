import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { decodeScreen } from '../frozen/screen-decode.mjs';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import {
    BELL, BUGLE, LEATHER_DRUM, TOOLED_HORN, WOODEN_FLUTE, WOODEN_HARP,
} from '../js/object_data.js';
import {
    assertRngSliceExact, expectedRngSlice,
} from './parity_assertions.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const segments = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments;

const ELF_INSTRUMENTS = new Set([
    WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP, BELL, BUGLE, LEATHER_DRUM,
]);

test('Elf Wizard race inventory precedes startup attributes', async () => {
    const storage = new Map();
    for (const segmentIndex of [2, 3, 4]) {
        const segment = segments[segmentIndex];
        const result = await runSegment({
            ...segment,
            moves: '',
            storage,
        });
        assertRngSliceExact(
            result.getRngSlices()[0],
            expectedRngSlice(segment.steps[0]),
            `seed0030 segment ${segmentIndex} startup`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[0]),
            decodeScreen(segment.steps[0].screen),
        );
        assert.deepEqual(result.getCursors()[0], segment.steps[0].cursor);
        assert.ok(game.inventory.some(item => ELF_INSTRUMENTS.has(item.otyp)));
    }
});
