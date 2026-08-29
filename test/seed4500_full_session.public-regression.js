import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { decodeScreen } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';

test('seed4500 complete C/Lua coverage session stays source-exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL(
            '../sessions/seed4500-knight-coverage.session.json',
            import.meta.url,
        ),
        'utf8',
    )).segments[0];

    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(session);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }
    assert.equal(result.getRngSlices().length, session.steps.length);
    assert.equal(result.getScreens().length, session.steps.length);
    assert.equal(result.getCursors().length, session.steps.length);

    for (let index = 0; index < session.steps.length; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }
});
