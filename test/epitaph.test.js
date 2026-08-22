import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { runSegment } from '../js/jsmain.js';
import { assertRngThrough } from './parity_assertions.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const knightCombat = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0104-knight-ride-combat.session.json', import.meta.url),
    'utf8',
)).segments[0];

const isRng = call => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(call);
const withoutSource = call => call.replace(/\s+@.*$/, '');

test('random epitaph selection belongs to generic grave creation', async () => {
    const expected = knightCombat.steps.flatMap(step => (step.rng || [])
        .filter(isRng)
        .map(withoutSource));
    const result = await runSegment({ ...knightCombat, storage: new Map() });

    assertRngThrough(result, knightCombat, undefined, 'seed0104');
    assert.equal(expected.length, 3223);
    assert.equal(expected.filter(call => call.startsWith('rn2(24075)=')).length, 1);
    assert.ok(expected.includes('rn2(24075)=11551'));
});
