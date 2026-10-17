import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBogusMonsterName } from '../js/display.js';
import { initRng } from '../js/rng.js';

// makedefs prepends its default entry "grue" to the compiled bogusmon file.
// rumors.c:get_rnd_line() wraps to that first entry when the random offset
// lands in the final line, so "bogon" (bogusmon()'s fallback for an
// unreadable file) never appears while the file is present.
void test('hallucinated bogus monster names wrap to the compiled default entry', () => {
    initRng(1);
    const names = new Map<string, number>();
    for (let draw = 0; draw < 20000; draw++) {
        const name = randomBogusMonsterName();
        names.set(name, (names.get(name) ?? 0) + 1);
    }

    assert.equal(names.has('bogon'), false);
    // "grue" is both the default entry and an ordinary entry, so it is drawn
    // noticeably more often than a typical name.
    assert.ok((names.get('grue') ?? 0) > 2 * (names.get('gnu') ?? 0));
});
