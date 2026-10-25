import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNethackrc } from '../js/options.js';

const PLAY = 'OPTIONS=name:Traveler,!legacy,!tutorial,!autopickup';

function fileErrors(rc: string) {
    return parseNethackrc(rc).configErrors[0]?.errors ?? [];
}

void test('an unmatched option element is reported as unknown', () => {
    assert.deepEqual(
        fileErrors(`${PLAY},zzzz`).map(error => error.message),
        ["Unknown option 'zzzz'"],
    );
});

void test('the unknown-option diagnostic echoes the element after negation prefixes', () => {
    assert.deepEqual(
        fileErrors('OPTIONS=!nozzz:1').map(error => error.message),
        ["Unknown option 'zzz:1'"],
    );
});

void test('a name shorter than the option minimum length is unknown', () => {
    // "time" needs all four letters to win over timed_delay; the bare
    // "menu" is shorter than every menu_* minimum.
    assert.deepEqual(
        fileErrors('OPTIONS=tim:1').map(error => error.message),
        ["Unknown option 'tim:1'"],
    );
    assert.deepEqual(
        fileErrors('OPTIONS=menu').map(error => error.message),
        ["Unknown option 'menu'"],
    );
});

void test('known spellings an alias or abbreviation reaches stay silent', () => {
    assert.deepEqual(fileErrors('OPTIONS=prayconfirm:+pray,colour,sortl:none,pet:dog'), []);
    // Options the recorder knows but the port does not implement are
    // accepted without a diagnostic, exactly as parseoptions() does.
    assert.deepEqual(fileErrors('OPTIONS=msghistory:20,font_map:big'), []);
    assert.deepEqual(fileErrors('OPTIONS=S_door:^'), []);
});
