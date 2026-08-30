import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Recorded public-session drift witness; not behavioral acceptance.

import { decodeScreen } from '../frozen/screen-decode.mjs';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import {
    assertRngSliceExact, expectedRngSlice,
} from './parity_assertions.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const priest = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[6];

test('Priest startup composes themed room, figurine, and skill-filtered books',
    async () => {
        const result = await runSegment({
            ...priest,
            moves: '',
            storage: new Map(),
        });

        assertRngSliceExact(
            result.getRngSlices()[0],
            expectedRngSlice(priest.steps[0]),
            'seed0030 segment 6 startup',
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[0]),
            decodeScreen(priest.steps[0].screen),
        );
        assert.deepEqual(result.getCursors()[0], priest.steps[0].cursor);

        const figurines = [];
        for (const column of game.level.objects) {
            if (!column) continue;
            for (const pile of column) {
                if (!pile) continue;
                for (const object of pile)
                    if (object.otyp === 241) figurines.push(object);
            }
        }
        assert.equal(figurines.length, 1);
        assert.equal(figurines[0].corpsenm, 230);
        assert.ok(game.inventory.some(object => object.otyp === 397));
    });
