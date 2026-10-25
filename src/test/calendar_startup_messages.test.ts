import test from 'node:test';
import assert from 'node:assert/strict';

import type { Engine } from '../js/jsmain.js';
import { runSegment } from '../js/jsmain.js';
import { fixedCalendar } from '../js/allmain.js';
import { memoryStorage } from './support/memory-storage.js';

function visibleScreen(engine: Engine): string {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

async function startWizardSession(datetime: string): Promise<Engine> {
    return runSegment({
        seed: 29371, datetime, moves: ' ', storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Iris,role:Wizard,race:human,gender:female,align:neutral,'
            + '!legacy,!autopickup,pettype:none,!tutorial',
    });
}

// C allmain.c:moveloop_preamble() lines 57-67: the moon-phase message and
// its luck change, then the Friday the 13th message and penalty.  The dates
// below are the phase-window edges of January and February 2026 computed
// from calendar.c:phase_of_the_moon().
for (const [name, datetime, lines, luck] of [
    ['the first day of a new moon', '20260118193000',
        ['Be careful!  New moon tonight.'], 0],
    ['the last day of that new moon', '20260121193000',
        ['Be careful!  New moon tonight.'], 0],
    ['the day after a new moon', '20260122193000', [], 0],
    ['the day before a new moon', '20260117193000', [], 0],
    ['the last day of a full moon', '20260106193000',
        ['You are lucky!  Full moon tonight.'], 1],
    ['the day after a full moon', '20260107193000', [], 0],
    ['a Friday the 13th outside any moon window', '20260213193000',
        ['Watch out!  Bad things can happen on Friday the 13th.'], -1],
    ['the day before that Friday the 13th', '20260212193000', [], 0],
] as const) {
    void test(`starting on ${name} announces only the calendar events in effect`, async () => {
        const engine = await startWizardSession(datetime);

        const screen = visibleScreen(engine);
        for (const line of lines)
            assert.ok(screen.includes(line), `expected "${line}" in the startup screen`);
        assert.equal(screen.includes('moon tonight.'), lines.some(l => l.includes('moon tonight.')));
        assert.equal(screen.includes('Friday the 13th.'), lines.some(l => l.includes('Friday the 13th.')));
        // A new moon has no luck effect; only a full moon raises Luck and
        // only Friday the 13th lowers it (calendar.c via change_luck()).
        assert.equal(engine.state.u.uluck ?? 0, luck);
    });
}

// calendar.c:phase_of_the_moon() returns 0-7 with 0 new and 4 full; the
// expected values below come from the C formula evaluated on the
// recorder's local calendar date for each first-of-phase day in 2026.
for (const [datetime, phase] of [
    ['20260101120000', 3], ['20260103120000', 4], ['20260107120000', 5],
    ['20260111120000', 6], ['20260114120000', 7], ['20260118120000', 0],
    ['20260122120000', 1], ['20260125120000', 2],
] as const) {
    void test(`the moon reaches phase ${phase} on ${datetime.slice(0, 8)}`, () => {
        assert.equal(fixedCalendar(datetime).moonphase, phase);
    });
}
