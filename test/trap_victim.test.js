import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
)).segments[5];

test('trap-victim corpse uses the current fake-player monster range',
    async () => {
        const result = await runSegment({
            ...priest,
            moves: '',
            storage: new Map(),
        });

        assertRngSliceExact(
            result.getRngSlices()[0],
            expectedRngSlice(priest.steps[0]),
            'seed0030 segment 5 startup',
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[0]),
            decodeScreen(priest.steps[0].screen),
        );
        assert.deepEqual(result.getCursors()[0], priest.steps[0].cursor);
        assert.equal(game.level.objects[74][4][0].corpsenm, 334);
    });
